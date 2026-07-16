"""
Swappable LLM provider for the grounded-answer and photo-diagnosis layers.

One place decides which model backend to call, chosen by the LLM_PROVIDER
environment variable (or repo-root .env):

    LLM_PROVIDER=openai   -> OpenAI gpt-4o-mini      (needs OPENAI_API_KEY)
    LLM_PROVIDER=gemini   -> Google Gemini 2.0 Flash (needs GEMINI_API_KEY)

Both providers expose the same two calls — complete() for text and
complete_vision() for image+text — so pipeline/rag_answer.py and
pipeline/vision_diagnose.py stay provider-agnostic. Gemini's free tier
(no credit card) makes it the fallback when OpenAI credits run out.
"""
import base64
import os
from pathlib import Path

_PROJECT_ROOT = Path(__file__).resolve().parent.parent

OPENAI_MODEL = "gpt-4o-mini"
GEMINI_MODEL = "gemini-2.0-flash"

_PLACEHOLDERS = ("sk-...", "your-", "AIza...", "changeme")


def _from_env_file(name: str) -> str | None:
    """Read a single KEY=value from the repo-root .env (no dependency needed)."""
    env_file = _PROJECT_ROOT / ".env"
    if not env_file.exists():
        return None
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line.startswith(f"{name}="):
            value = line.split("=", 1)[1].strip().strip('"').strip("'")
            return value or None
    return None


def provider() -> str:
    """Which backend to use. Defaults to openai for back-compat."""
    return (os.environ.get("LLM_PROVIDER") or _from_env_file("LLM_PROVIDER") or "openai").strip().lower()


def _load_key(env_names: list[str], label: str) -> str:
    for name in env_names:
        value = (os.environ.get(name, "") or _from_env_file(name) or "").strip()
        if value and not value.startswith(_PLACEHOLDERS) and len(value) > 20:
            return value
    raise RuntimeError(
        f"{label} not found. Add it to the repo-root .env file as {env_names[0]}=..."
    )


# ── OpenAI ───────────────────────────────────────────────────────────────
def _openai_client():
    from openai import OpenAI
    return OpenAI(api_key=_load_key(["OPENAI_API_KEY"], "OPENAI_API_KEY"))


def _openai_text(system: str, user: str, max_tokens: int, temperature: float) -> str:
    resp = _openai_client().chat.completions.create(
        model=OPENAI_MODEL, max_tokens=max_tokens, temperature=temperature,
        messages=[{"role": "system", "content": system},
                  {"role": "user", "content": user}],
    )
    return (resp.choices[0].message.content or "").strip()


def _openai_vision(system: str, user_text: str, image_bytes: bytes, mime: str,
                   max_tokens: int, temperature: float) -> str:
    data_url = f"data:{mime};base64,{base64.b64encode(image_bytes).decode('ascii')}"
    resp = _openai_client().chat.completions.create(
        model=OPENAI_MODEL, max_tokens=max_tokens, temperature=temperature,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": [
                {"type": "text", "text": user_text},
                {"type": "image_url", "image_url": {"url": data_url}},
            ]},
        ],
    )
    return (resp.choices[0].message.content or "").strip()


# ── Gemini ───────────────────────────────────────────────────────────────
def _gemini_client():
    from google import genai
    return genai.Client(api_key=_load_key(["GEMINI_API_KEY", "GOOGLE_API_KEY"], "GEMINI_API_KEY"))


def _gemini_text(system: str, user: str, max_tokens: int, temperature: float) -> str:
    from google.genai import types
    resp = _gemini_client().models.generate_content(
        model=GEMINI_MODEL, contents=user,
        config=types.GenerateContentConfig(
            system_instruction=system, max_output_tokens=max_tokens, temperature=temperature),
    )
    return (resp.text or "").strip()


def _gemini_vision(system: str, user_text: str, image_bytes: bytes, mime: str,
                   max_tokens: int, temperature: float) -> str:
    from google.genai import types
    resp = _gemini_client().models.generate_content(
        model=GEMINI_MODEL,
        contents=[types.Part.from_bytes(data=image_bytes, mime_type=mime), user_text],
        config=types.GenerateContentConfig(
            system_instruction=system, max_output_tokens=max_tokens, temperature=temperature),
    )
    return (resp.text or "").strip()


# ── Public API ───────────────────────────────────────────────────────────
def complete(system: str, user: str, *, max_tokens: int = 500, temperature: float = 0.2) -> str:
    """Text completion via the configured provider."""
    if provider() == "gemini":
        return _gemini_text(system, user, max_tokens, temperature)
    return _openai_text(system, user, max_tokens, temperature)


def complete_vision(system: str, user_text: str, image_bytes: bytes, mime: str,
                    *, max_tokens: int = 300, temperature: float = 0.1) -> str:
    """Image+text completion via the configured provider."""
    if provider() == "gemini":
        return _gemini_vision(system, user_text, image_bytes, mime, max_tokens, temperature)
    return _openai_vision(system, user_text, image_bytes, mime, max_tokens, temperature)
