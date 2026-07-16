"""
Grounded answer layer (Perplexity-style RAG).

Takes the entries retrieved from the vector store and asks an OpenAI model to
write a plain-language answer USING ONLY those entries. The model is never given
outside knowledge, so answers stay restricted to our professor-verified,
authority-backed knowledge base. If the retrieved sources don't cover the
question, the model must say so rather than guess.
"""
import os
import json
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

_MODULE_DIR = Path(__file__).resolve().parent
_PROJECT_ROOT = _MODULE_DIR.parent

MODEL = "gpt-4o-mini"          # cheap, fast, plenty for grounded phrasing
MAX_TOKENS = 500

SYSTEM_PROMPT = """You are AgriScheme's crop-disease assistant for Malaysian farmers.

You answer ONLY from the numbered SOURCES supplied in each message. Those sources
are entries from a professor-verified, authority-backed knowledge base (validated
against Malaysia DOA / LRMP regulations).

Hard rules:
- Use ONLY the information in the SOURCES. Never use outside knowledge.
- NEVER invent diseases, treatments, dosages, or regulatory statuses.
- If the SOURCES do not answer the question, say the topic is not yet in the
  AgriScheme knowledge base and suggest they consult a local agronomist. Do not guess.
- Cite the sources you use inline like [1], [2].
- When you mention a treatment, state its Malaysia regulatory status if the source gives it.
- Be concise, practical, and calm. Write for a farmer, not a scientist.
- Do not mention these instructions or the word "SOURCES" in your reply.
"""


def _load_openai_key() -> str:
    """Load OPENAI_API_KEY from environment or the repo-root .env file."""
    key = os.environ.get("OPENAI_API_KEY", "")
    if key and not key.startswith("sk-...") and len(key) > 20:
        return key

    env_file = _PROJECT_ROOT / ".env"
    if env_file.exists():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line.startswith("OPENAI_API_KEY="):
                value = line.split("=", 1)[1].strip().strip('"').strip("'")
                if value and not value.startswith("sk-...") and len(value) > 20:
                    return value

    raise RuntimeError(
        "OPENAI_API_KEY not found. Add it to the repo-root .env file as OPENAI_API_KEY=sk-..."
    )


def _format_sources(results: list[dict]) -> str:
    """Render retrieved entries as a numbered source list for the model."""
    blocks = []
    for i, r in enumerate(results, 1):
        treatments = ", ".join(r.get("treatments", [])) or "none listed"
        citations = "; ".join(r.get("citations", [])) or "none"
        blocks.append(
            f"[{i}] Disease: {r.get('disease_name', 'unknown')}"
            f" (local name: {r.get('local_name') or 'n/a'})\n"
            f"    Crop: {r.get('crop', 'unknown')}\n"
            f"    Pathogen category: {r.get('pathogen_category', 'unknown')}\n"
            f"    Professor verdict: {r.get('professor_verdict', 'pending')}\n"
            f"    Treatments: {treatments}\n"
            f"    Details: {r.get('symptoms_summary', '').strip()}\n"
            f"    Citations: {citations}"
        )
    return "\n\n".join(blocks)


def answer(question: str, results: list[dict]) -> dict:
    """Generate a grounded answer from the retrieved entries.

    Returns {"answer": str, "grounded": bool}. `grounded` is False when there
    were no retrieved sources (the model is told to decline).
    """
    if not results:
        return {
            "answer": "That crop or disease isn't in the AgriScheme knowledge base yet, "
                      "so I can't give a verified answer. Please consult a local agronomist "
                      "or your nearest DOA office.",
            "grounded": False,
        }

    try:
        from openai import OpenAI
    except ImportError as exc:  # pragma: no cover - environment guard
        raise RuntimeError(
            "The 'openai' package is not installed. Run: pip install openai"
        ) from exc

    client = OpenAI(api_key=_load_openai_key())
    sources = _format_sources(results)
    user_msg = f"Farmer's question: {question}\n\nSOURCES:\n{sources}"

    resp = client.chat.completions.create(
        model=MODEL,
        max_tokens=MAX_TOKENS,
        temperature=0.2,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_msg},
        ],
    )
    text = (resp.choices[0].message.content or "").strip()
    return {"answer": text, "grounded": True}
