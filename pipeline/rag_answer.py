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


PLAIN_PROMPT = """You are AgriScheme's crop assistant for Malaysian farmers.

Using ONLY the numbered SOURCES, reply in 2-3 short, simple sentences a farmer can
act on right away:
1. what the problem most likely is (use the plain disease name, no Latin/scientific words),
2. what to do about it (name the main treatment; if the source gives its Malaysia legal
   status, add it in plain words like "approved for use in Malaysia"),
3. one short prevention or next-step tip only if a source supports it.

Hard rules:
- Use ONLY the SOURCES. Never invent a disease, treatment, dose, or status.
- If the SOURCES don't cover it, say so in one sentence and suggest asking a local
  agronomist. Do not guess.
- Plain everyday words, short sentences. No jargon, no headings, no citations like [1],
  no bullet points. Just a calm, direct answer.
"""


def plain_answer(question: str, results: list[dict]) -> str:
    """Short, plain-language farmer summary grounded in the retrieved entries.

    Never raises: falls back to a simple template built from the top entry if the
    LLM layer is unavailable, so the farmer always gets a readable answer.
    """
    if not results:
        return ("I couldn't find this in the verified knowledge base yet. "
                "Please check with your nearest DOA office or a local agronomist.")

    top = results[0]
    try:
        from pipeline import llm
        sources = _format_sources(results[:3])
        user_msg = f"Farmer's question: {question}\n\nSOURCES:\n{sources}"
        text = llm.complete(PLAIN_PROMPT, user_msg, max_tokens=180, temperature=0.2).strip()
        if text:
            return text
    except Exception as e:  # LLM unavailable — degrade to a template, never fail
        logger.warning("Plain answer unavailable, using template: %s", e)

    name = (top.get("local_name") or top.get("disease_name") or "a crop problem")
    treatments = top.get("treatments") or []
    if treatments:
        return (f"This looks most like {name}. A commonly used treatment is "
                f"{treatments[0]} — follow the label instructions and remove badly "
                f"affected parts. Check with a local agronomist before spraying.")
    return (f"This looks most like {name}. Remove badly affected parts and keep the "
            f"area clean. Check with a local agronomist for the right treatment.")


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

    from pipeline import llm

    sources = _format_sources(results)
    user_msg = f"Farmer's question: {question}\n\nSOURCES:\n{sources}"

    text = llm.complete(SYSTEM_PROMPT, user_msg, max_tokens=MAX_TOKENS, temperature=0.2)
    return {"answer": text, "grounded": True}
