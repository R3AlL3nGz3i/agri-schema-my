"""
Vision-observation layer for photo-based crop diagnosis.

Turns an uploaded plant photo into a plain-language SYMPTOM description (and,
when possible, a crop guess) using a vision model. It deliberately does NOT
name a disease, pathogen, or treatment: disease identification happens by
retrieving the observed symptoms against the professor-verified knowledge
base, so every diagnosis stays grounded in verified entries rather than the
model's own guesswork.

Reuses the OpenAI key loader from the grounded-answer layer so both features
share one credential path.
"""
import base64
import logging

logger = logging.getLogger(__name__)

MODEL = "gpt-4o-mini"          # supports image input, matches the /ask layer
MAX_TOKENS = 300

KNOWN_CROPS = ["paddy", "durian", "banana", "chilli", "tomato", "rubber", "oil_palm", "cocoa"]

VISION_PROMPT = """You are a plant-health field assistant for Malaysian farmers.

Look at the photo and describe ONLY what is visibly wrong with the plant, as
observable symptoms. Do NOT name or guess a disease, pathogen, or treatment —
a separate verified system does that.

Describe, when visible:
- affected part (leaf, stem, fruit, whole plant)
- colour changes (yellowing, browning, black or white spots)
- shape and pattern of lesions or spots
- texture (rot, powdery coating, wilting, holes)

If a crop from this list is clearly identifiable, name it: {crops}.
If you cannot tell the crop, write "crop: unknown".
If the image is not a plant, or is too blurry/dark to assess, reply with
exactly: no assessable plant symptoms

Reply in this format only:
crop: <one crop from the list, or unknown>
symptoms: <one or two sentences of observable symptoms>
"""


def _parse(text: str, crop_hint: str | None) -> dict:
    """Pull the crop + symptoms lines out of the model reply.

    The farmer-supplied crop hint always wins over the model's guess.
    """
    if "no assessable plant symptoms" in text.lower():
        return {"crop": crop_hint, "symptoms": "", "assessable": False}

    vision_crop = None
    symptoms = ""
    for line in text.splitlines():
        stripped = line.strip()
        low = stripped.lower()
        if low.startswith("crop:"):
            value = stripped.split(":", 1)[1].strip().lower().replace(" ", "_")
            if value in KNOWN_CROPS:
                vision_crop = value
        elif low.startswith("symptoms:"):
            symptoms = stripped.split(":", 1)[1].strip()

    # Fall back to the whole reply if the model ignored the format.
    if not symptoms:
        symptoms = text.strip()

    return {
        "crop": crop_hint or vision_crop,
        "symptoms": symptoms,
        "assessable": bool(symptoms),
    }


def observe(image_bytes: bytes, mime: str, crop_hint: str | None = None) -> dict:
    """Describe visible symptoms in a crop photo.

    Returns {"crop": str|None, "symptoms": str, "assessable": bool}.
    Raises on missing key / package / API error so the caller can degrade.
    """
    from openai import OpenAI
    from pipeline.rag_answer import _load_openai_key

    client = OpenAI(api_key=_load_openai_key())
    data_url = f"data:{mime};base64,{base64.b64encode(image_bytes).decode('ascii')}"
    user_text = "Assess this crop photo."
    if crop_hint:
        user_text += f" The farmer says the crop is {crop_hint.replace('_', ' ')}."

    resp = client.chat.completions.create(
        model=MODEL,
        max_tokens=MAX_TOKENS,
        temperature=0.1,
        messages=[
            {"role": "system", "content": VISION_PROMPT.format(crops=", ".join(KNOWN_CROPS))},
            {"role": "user", "content": [
                {"type": "text", "text": user_text},
                {"type": "image_url", "image_url": {"url": data_url}},
            ]},
        ],
    )
    text = (resp.choices[0].message.content or "").strip()
    return _parse(text, crop_hint)
