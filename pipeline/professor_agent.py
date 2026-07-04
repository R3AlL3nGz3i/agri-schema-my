"""
Professor Agent — AI agronomist reviewer.
Reviews each YAML entry for agronomic accuracy, safe dosages,
and verifiable citations. Flags anything that could harm a farmer.

LLM backend: Anthropic Python SDK (claude-sonnet-4-6), 3 retries, exponential backoff.
On parse failure after retries, does NOT write a cache file — avoids the stale-FLAG bug.
"""
import yaml
import json
import time
import os
from pathlib import Path
from datetime import date
from typing import Optional
import logging

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Anthropic SDK setup — load key from .env if not already in environment
# ---------------------------------------------------------------------------
_MODULE_DIR = Path(__file__).resolve().parent
_PROJECT_ROOT = _MODULE_DIR.parent

def _load_api_key() -> str:
    """Load ANTHROPIC_API_KEY from environment, .env file, or openclaw auth profiles."""
    key = os.environ.get("ANTHROPIC_API_KEY", "")
    if key and not key.startswith("sk-ant-...") and len(key) > 20:
        return key

    # Hand-parse .env
    env_file = _PROJECT_ROOT / ".env"
    if env_file.exists():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line.startswith("ANTHROPIC_API_KEY="):
                value = line.split("=", 1)[1].strip().strip('"').strip("'")
                if value and not value.startswith("sk-ant-...") and len(value) > 20:
                    return value

    # Fall back to openclaw agent auth profiles (available in openclaw workspace)
    auth_profiles_path = Path.home() / ".openclaw" / "agents" / "main" / "agent" / "auth-profiles.json"
    if auth_profiles_path.exists():
        try:
            profiles = json.loads(auth_profiles_path.read_text(encoding="utf-8"))
            anthropic_default = profiles.get("profiles", {}).get("anthropic:default", {})
            if anthropic_default.get("type") == "api_key":
                key = anthropic_default.get("key", "")
                if key and len(key) > 20:
                    return key
        except Exception:
            pass

    raise RuntimeError(
        "ANTHROPIC_API_KEY not found. Set it in environment, .env file, or openclaw auth profiles."
    )


MODEL = "claude-sonnet-4-6"
MAX_TOKENS = 2000
MAX_RETRIES = 3


PROFESSOR_SYSTEM = """You are Professor Ahmad Fauzi, a senior Malaysian agronomist
with 25 years of experience at MARDI (Malaysian Agricultural Research and Development Institute).

You are reviewing entries for an open-source crop disease knowledge base used by Malaysian farmers.
You are rigorous, skeptical, and precise. Your standards:

1. Disease symptoms and severity stages must match established literature
2. Treatment compounds and dosages must be accurate and safe for Malaysian conditions
3. Scientific names must be correct
4. Dosage errors are CRITICAL — wrong dosage = crop loss or farmer injury
5. Entries that honestly state "no curative treatment" are correct and should be credited, not penalised
6. Vague citations (lacking year/edition) are a WARNING, not grounds for REJECT — they are fixable
7. Null pre_harvest_interval on non-food crops (rubber, oil palm) is a WARNING (low severity)
8. Null pre_harvest_interval on food crops near harvest is a WARNING (must fix before publish)
9. A REJECT requires a SPECIFIC confirmed critical error — wrong dosage, dangerous compound use, or
   a citation you can positively identify as fabricated (wrong author/journal/year on a known paper)
10. Biological uncertainty and minor documentation gaps do not justify REJECT

VERDICT DEFINITIONS (use these exactly):
- PASS: Agronomically sound, safe dosages, no confirmed fabricated citations. Minor wording or
  documentation gaps are listed as notes but do not block publication. The science is correct.
- FLAG: Has one or more specific factual or safety concerns that must be corrected before
  publishing. The reviewer must NAME the specific concern (not just "this needs more detail").
- REJECT: Confirmed critical error — a specific dangerously wrong dosage, a confirmed dangerous
  compound use, or a citation positively identified as fabricated (wrong author/journal/year on
  a specific known paper). Generic citation vagueness alone does NOT justify REJECT.

Output ONLY valid JSON. No text outside the JSON structure."""

PROFESSOR_PROMPT = """Review this crop disease database entry for agronomic accuracy and safety.

ENTRY:
{entry_yaml}

Output exactly this JSON:
{{
  "verdict": "PASS" | "FLAG" | "REJECT",
  "adjusted_confidence": 0.0,
  "issues": [
    {{
      "severity": "critical" | "warning" | "info",
      "field": "disease.treatments[0].dosage",
      "issue": "what is specifically wrong",
      "suggestion": "how to fix"
    }}
  ],
  "missing_treatments": ["compound names commonly used in Malaysia but absent from entry"],
  "notes": "any additional observations, including reasoning for the verdict",
  "reviewed_by": "Professor Ahmad Fauzi (AI agronomist agent)",
  "review_date": "{today}"
}}

Verdict rules (IMPORTANT — apply these strictly):
- PASS: agronomically sound, safe dosages, plausible citations (minor documentation gaps listed as info/notes only)
- FLAG: a SPECIFIC named factual or safety concern that needs fixing before publish (citation vagueness alone qualifies only if you cannot determine whether a citation is real or fabricated)
- REJECT: confirmed dangerous dosage error, confirmed dangerous compound use, OR a citation you can positively identify as fabricated (e.g. wrong author/journal attribution on a known paper)

Entries that correctly state "no curative treatment" for diseases like bacterial leaf blight or
Fusarium wilt are CORRECT — do not penalise them for honesty."""


def _slim_entry(entry: dict) -> dict:
    """Strip fields that bulk up the prompt without aiding agronomic review."""
    import copy
    slim = copy.deepcopy(entry)
    slim.pop("_source_file", None)
    slim.pop("_chunk_index", None)
    slim.pop("professor_review", None)
    # Keep only first 3 cultural controls to save tokens
    disease = slim.get("disease", {})
    cc = disease.get("cultural_controls")
    if isinstance(cc, list) and len(cc) > 3:
        disease["cultural_controls"] = cc[:3]
    return slim


def _extract_json(raw: str) -> dict:
    """Extract JSON from raw response, stripping markdown fences if present."""
    text = raw.strip()
    # Strip markdown fences
    if text.startswith("```"):
        text = text.split("```", 1)[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.rsplit("```", 1)[0]
    return json.loads(text.strip())


def _call_anthropic(prompt: str) -> str:
    """Call Anthropic SDK with retries and exponential backoff."""
    import anthropic

    api_key = _load_api_key()
    client = anthropic.Anthropic(api_key=api_key)

    last_error = None
    for attempt in range(MAX_RETRIES):
        try:
            response = client.messages.create(
                model=MODEL,
                max_tokens=MAX_TOKENS,
                system=PROFESSOR_SYSTEM,
                messages=[{"role": "user", "content": prompt}]
            )
            return response.content[0].text
        except Exception as e:
            last_error = e
            wait = 2 ** attempt  # 1s, 2s, 4s
            logger.warning(f"Anthropic API attempt {attempt + 1} failed: {e}. Retrying in {wait}s...")
            time.sleep(wait)

    raise RuntimeError(f"Anthropic API failed after {MAX_RETRIES} retries: {last_error}")


def review_entry(entry: dict) -> Optional[dict]:
    """
    Run professor agent review via Anthropic SDK.
    Returns review dict, or None if JSON parse fails (caller must NOT cache None).
    """
    entry_yaml = yaml.dump(_slim_entry(entry), allow_unicode=True, default_flow_style=False)
    prompt = PROFESSOR_PROMPT.format(
        entry_yaml=entry_yaml,
        today=date.today().isoformat()
    )

    last_parse_error = None
    for attempt in range(MAX_RETRIES):
        try:
            raw = _call_anthropic(prompt)
            result = _extract_json(raw)
            # Validate required fields
            if "verdict" not in result:
                raise ValueError(f"Missing 'verdict' in response: {result}")
            if result["verdict"] not in ("PASS", "FLAG", "REJECT"):
                raise ValueError(f"Invalid verdict: {result['verdict']}")
            return result

        except (json.JSONDecodeError, ValueError, KeyError) as e:
            last_parse_error = e
            logger.warning(f"JSON parse attempt {attempt + 1}/{MAX_RETRIES} failed: {e}")
            if attempt < MAX_RETRIES - 1:
                time.sleep(1)
            continue

        except Exception as e:
            # API error is already retried in _call_anthropic
            raise

    # All parse attempts exhausted — do NOT cache a fallback FLAG
    logger.error(
        f"Professor agent returned unparseable JSON after {MAX_RETRIES} attempts. "
        f"Last error: {last_parse_error}. This entry will NOT be cached — re-run to retry."
    )
    return None


def review_all_entries(
    data_dir: Path = None,
    reviews_dir: Path = None
) -> dict:
    """
    Review all YAML entries. Caches reviews to avoid redundant API calls.
    Writes adjusted confidence back to source YAML.
    On parse failure: skips caching (avoids stale-FLAG bug).
    """
    if data_dir is None:
        data_dir = _PROJECT_ROOT / "data"
    if reviews_dir is None:
        reviews_dir = _PROJECT_ROOT / "data" / "reviews"

    reviews_dir.mkdir(parents=True, exist_ok=True)
    summary = {"PASS": [], "FLAG": [], "REJECT": [], "errors": []}

    for yaml_file in sorted(data_dir.glob("crops/**/diseases/*.yaml")):
        review_path = reviews_dir / yaml_file.relative_to(data_dir).with_suffix(".review.json")
        review_path.parent.mkdir(parents=True, exist_ok=True)

        # Use cached review if exists
        if review_path.exists():
            review = json.loads(review_path.read_text(encoding="utf-8"))
            verdict = review.get("verdict", "FLAG")
            summary[verdict].append(str(yaml_file))
            logger.info(f"Cached review {yaml_file.name}: {verdict}")
            continue

        try:
            entry = yaml.safe_load(yaml_file.read_text(encoding="utf-8"))
            logger.info(f"Professor reviewing: {yaml_file.name}")
            review = review_entry(entry)

            if review is None:
                # Parse failure — do NOT write cache file, record as error
                logger.error(f"Parse failure for {yaml_file.name} — skipping cache, will retry next run")
                summary["errors"].append(str(yaml_file))
                continue

            # Cache the successful review
            review_path.write_text(
                json.dumps(review, indent=2, ensure_ascii=False),
                encoding="utf-8"
            )

            verdict = review.get("verdict", "FLAG")
            summary[verdict].append(str(yaml_file))

            # Write adjusted confidence + review stamp back to YAML
            adj = review.get("adjusted_confidence")
            if adj is not None:
                disease = entry.setdefault("disease", {})
                disease["confidence_score"] = float(adj)
                entry["professor_review"] = {
                    "verdict": verdict,
                    "date": review.get("review_date"),
                    "reviewer": review.get("reviewed_by"),
                    "issues_count": len(review.get("issues", []))
                }
                with open(yaml_file, "w", encoding="utf-8") as f:
                    yaml.dump(entry, f, allow_unicode=True, default_flow_style=False, sort_keys=False)

            logger.info(f"  -> {verdict} (confidence: {adj})")

        except Exception as e:
            logger.error(f"Review failed for {yaml_file}: {e}")
            summary["errors"].append(str(yaml_file))

    return summary


def print_report(summary: dict):
    total = sum(len(v) for v in summary.values())
    pass_count = len(summary.get("PASS", []))
    flag_count = len(summary.get("FLAG", []))
    reject_count = len(summary.get("REJECT", []))
    error_count = len(summary.get("errors", []))

    print(f"\n{'='*60}")
    print("PROFESSOR AGENT REVIEW REPORT")
    print(f"{'='*60}")
    print(f"PASS:    {pass_count}")
    print(f"FLAG:    {flag_count}")
    print(f"REJECT:  {reject_count}")
    print(f"ERRORS:  {error_count}")

    if summary.get("REJECT"):
        print("\nREJECTED (must fix before publishing):")
        for f in summary["REJECT"]:
            print(f"  x {f}")

    if summary.get("FLAG"):
        print("\nFLAGGED (needs review):")
        for f in summary["FLAG"]:
            print(f"  ! {f}")

    if summary.get("errors"):
        print("\nERRORS (re-run to retry):")
        for f in summary["errors"]:
            print(f"  ? {f}")

    if total > 0:
        rate = pass_count / total * 100
        print(f"\nPass rate: {rate:.1f}%  (target: >60%)")
