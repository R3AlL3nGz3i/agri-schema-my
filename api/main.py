"""
AgriSchema-MY REST API.
Query the Malaysian agriculture knowledge base by crop and symptom.
"""
import json
import logging
import re
import sys
from pathlib import Path
from typing import Optional

import yaml
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel

sys.path.append(str(Path(__file__).parent.parent))

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
IMAGES_DIR = (DATA_DIR / "vision" / "images").resolve()
_IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png"}
_SLUG_RE = re.compile(r"^[a-z0-9_]+$")
_representative_image_cache: dict[tuple[str, str], Optional[Path]] = {}
_thumbnail_cache: dict[tuple[str, str], Optional[bytes]] = {}

from pipeline.embedder import query as vector_query
from pipeline.validator import validate_all

app = FastAPI(
    title="AgriSchema-MY",
    description="Open-source Malaysian agriculture knowledge base API. "
                "Crop disease diagnosis and validated treatment data.",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


class QueryRequest(BaseModel):
    crop: Optional[str] = None
    symptom: Optional[str] = None
    n_results: int = 5


class TreatmentSummary(BaseModel):
    compound: str
    dosage: str
    regulatory_status: str


class QueryResult(BaseModel):
    disease_name: str
    local_name: str
    crop: str
    pathogen_category: str
    confidence: float
    professor_verdict: str
    symptoms_summary: str
    treatments: list[str]
    citations: list[str]
    relevance_score: float


class AskRequest(BaseModel):
    question: str
    crop: Optional[str] = None
    n_results: int = 5
    plain: bool = False         # True -> short, plain farmer summary (no citations)


class AskResponse(BaseModel):
    answer: str
    grounded: bool
    results: list[QueryResult]


class DiagnoseResponse(BaseModel):
    observation: str
    advice: str = ""            # short, plain-language "what it is + what to do"
    crop: Optional[str] = None
    crop_source: str            # "farmer" | "vision" | "unknown"
    assessable: bool
    grounded: bool
    results: list[QueryResult]


def _run_query(crop: Optional[str], symptom: Optional[str], n_results: int) -> list[QueryResult]:
    """Shared retrieval → QueryResult mapping used by /query and /ask."""
    results = vector_query(crop=crop, symptom=symptom, n_results=n_results)
    output = []
    for r in results:
        meta = r["metadata"]
        output.append(QueryResult(
            disease_name=meta.get("disease_name", "unknown"),
            local_name=meta.get("local_name", ""),
            crop=meta.get("crop", "unknown"),
            pathogen_category=meta.get("pathogen_type", "unknown"),
            confidence=meta.get("confidence_score", 0.0),
            professor_verdict=meta.get("professor_verdict", "pending"),
            symptoms_summary=r["document"],
            treatments=json.loads(meta.get("treatment_compounds", "[]")),
            citations=json.loads(meta.get("citations", "[]")),
            relevance_score=round(1 - r["distance"], 3)
        ))
    return output


@app.get("/")
def root():
    return {
        "name": "AgriSchema-MY",
        "version": "0.1.0",
        "description": "Open-source Malaysian agriculture knowledge base",
        "github": "https://github.com/agri-schema-my/agri-schema-my",
        "docs": "/docs",
        "endpoints": ["/query", "/crops", "/crops/{crop}/diseases", "/stats", "/aggregates", "/reviews"]
    }


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/query", response_model=list[QueryResult])
def query_diseases(req: QueryRequest):
    """
    Query crop diseases by crop name and/or symptom description.
    Returns ranked results with confidence scores and treatment data.
    """
    if not req.crop and not req.symptom:
        raise HTTPException(status_code=400, detail="Provide at least one of: crop, symptom")

    return _run_query(req.crop, req.symptom, req.n_results)


def _representative_image(crop: str, disease: str) -> Optional[Path]:
    """A single stable example image for a crop/disease, or None if we have none."""
    key = (crop, disease)
    if key in _representative_image_cache:
        return _representative_image_cache[key]
    result: Optional[Path] = None
    if _SLUG_RE.match(crop) and _SLUG_RE.match(disease):
        folder = (IMAGES_DIR / crop / disease).resolve()
        if folder.is_dir() and str(folder).startswith(str(IMAGES_DIR)):
            # images live in nested source subfolders, so walk recursively
            imgs = sorted(p for p in folder.rglob("*") if p.suffix.lower() in _IMAGE_SUFFIXES)
            result = imgs[0] if imgs else None
    _representative_image_cache[key] = result
    return result


def _thumbnail_bytes(crop: str, disease: str) -> Optional[bytes]:
    """Resized JPEG (max 480px) of the representative image, cached in memory."""
    key = (crop, disease)
    if key in _thumbnail_cache:
        return _thumbnail_cache[key]
    src = _representative_image(crop, disease)
    data: Optional[bytes] = None
    if src:
        from io import BytesIO
        from PIL import Image, ImageOps
        img = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
        img.thumbnail((480, 480))
        buf = BytesIO()
        img.save(buf, format="JPEG", quality=80)
        data = buf.getvalue()
    _thumbnail_cache[key] = data
    return data


@app.get("/disease-image")
def disease_image(crop: str, disease: str):
    """
    Serve one real example photo (resized thumbnail) for a crop/disease so
    researchers can eyeball the symptoms. Only ~10 of 23 KB diseases have a
    training-image folder; the rest legitimately return 404 (no fabricated
    stand-in image).
    """
    thumb = _thumbnail_bytes(crop.strip().lower(), disease.strip().lower())
    if not thumb:
        raise HTTPException(status_code=404, detail="No example image for this crop/disease")
    return Response(content=thumb, media_type="image/jpeg",
                    headers={"Cache-Control": "public, max-age=86400"})


@app.post("/ask", response_model=AskResponse)
def ask(req: AskRequest):
    """
    Grounded chatbot answer. Retrieves matching entries from the knowledge base,
    then asks an OpenAI model to answer USING ONLY those entries (never outside
    knowledge). Returns the answer plus the source entries as evidence.

    Degrades gracefully: if the answer layer is unavailable (no key / no package /
    API error), returns the retrieved results with grounded=False and a note, so
    search still works.
    """
    if not req.question or not req.question.strip():
        raise HTTPException(status_code=400, detail="Provide a question")

    results = _run_query(req.crop, req.question, req.n_results)
    dumped = [r.model_dump() for r in results]

    if req.plain:
        # Short, plain farmer summary. plain_answer never raises (templates on failure).
        from pipeline.rag_answer import plain_answer
        return AskResponse(answer=plain_answer(req.question, dumped),
                           grounded=bool(results), results=results)

    from pipeline.rag_answer import answer as generate_answer
    try:
        gen = generate_answer(req.question, dumped)
    except Exception as e:  # key/package/API failure — degrade, don't 500
        logging.getLogger("api").warning("Grounded answer unavailable: %s", e)
        note = ("I found matching entries below, but the AI answer layer is "
                "unavailable right now. See the verified results.") if results else (
                "That crop or disease isn't in the AgriScheme knowledge base yet.")
        return AskResponse(answer=note, grounded=False, results=results)

    return AskResponse(answer=gen["answer"], grounded=gen["grounded"], results=results)


@app.post("/diagnose", response_model=DiagnoseResponse)
async def diagnose(
    file: UploadFile = File(...),
    crop: Optional[str] = Form(None),
    note: Optional[str] = Form(None),
):
    """
    Photo-based diagnosis. A vision model DESCRIBES the visible symptoms (and
    guesses the crop when the farmer didn't say), then those observed symptoms
    are retrieved against the professor-verified knowledge base — the diagnosis
    itself always comes from verified entries, never the model's own guess.

    Degrades gracefully: if the vision layer is unavailable (no key / package /
    API error), falls back to any written note the farmer supplied so search
    still works, with grounded=False.
    """
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Upload an image file")

    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Empty image upload")
    if len(image_bytes) > 8 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image too large (max 8 MB)")

    crop_hint = (crop or "").strip().lower().replace(" ", "_") or None
    written_note = (note or "").strip() or None

    from pipeline.vision_diagnose import observe
    try:
        obs = observe(image_bytes, file.content_type, crop_hint)
    except Exception as e:  # key/package/API failure — degrade, don't 500
        logging.getLogger("api").warning("Vision diagnosis unavailable: %s", e)
        fallback = _run_query(crop_hint, written_note, 5) if (crop_hint or written_note) else []
        message = ("Photo recognition is unavailable right now, so I matched your "
                   "written description instead.") if fallback else (
                   "Photo recognition is unavailable right now. Add the crop and a "
                   "written symptom and I'll match it against the knowledge base.")
        return DiagnoseResponse(
            observation=message,
            crop=crop_hint,
            crop_source="farmer" if crop_hint else "unknown",
            assessable=False,
            grounded=False,
            results=fallback,
        )

    if not obs["assessable"]:
        return DiagnoseResponse(
            observation="I couldn't read clear crop symptoms from that photo. Try a "
                        "sharper, well-lit close-up of the affected leaf, fruit, or "
                        "stem — or describe what you see.",
            crop=obs["crop"],
            crop_source="farmer" if crop_hint else "unknown",
            assessable=False,
            grounded=False,
            results=[],
        )

    resolved_crop = obs["crop"]
    crop_source = "farmer" if crop_hint else ("vision" if resolved_crop else "unknown")
    query_symptom = " ".join(part for part in [obs["symptoms"], written_note] if part)
    results = _run_query(resolved_crop, query_symptom, 5)

    # Short, plain-language "what it is + what to do". Never raises (templates on failure).
    from pipeline.rag_answer import plain_answer
    advice = plain_answer(query_symptom, [r.model_dump() for r in results]) if results else ""

    return DiagnoseResponse(
        observation=obs["symptoms"],
        advice=advice,
        crop=resolved_crop,
        crop_source=crop_source,
        assessable=True,
        grounded=bool(results),
        results=results,
    )


@app.get("/crops")
def list_crops():
    """List all crops in the database."""
    crops = sorted(
        f.name for f in (DATA_DIR / "crops").iterdir()
        if f.is_dir() and not f.name.startswith(".")
    ) if (DATA_DIR / "crops").exists() else []
    return {"crops": crops, "total": len(crops)}


@app.get("/crops/{crop}/diseases")
def list_diseases(crop: str):
    """List all diseases for a specific crop."""
    disease_dir = DATA_DIR / "crops" / crop / "diseases"
    if not disease_dir.exists():
        raise HTTPException(status_code=404, detail=f"No data for crop: {crop}")

    diseases = []
    for f in sorted(disease_dir.glob("*.yaml")):
        entry = yaml.safe_load(f.read_text(encoding="utf-8"))
        d = entry.get("disease", {})
        diseases.append({
            "name": d.get("name"),
            "local_name": d.get("local_name"),
            "confidence_score": d.get("confidence_score"),
            "professor_verdict": entry.get("professor_review", {}).get("verdict", "pending"),
            "pathogen_type": d.get("pathogen", {}).get("type"),
        })

    return {"crop": crop, "diseases": diseases, "total": len(diseases)}


@app.get("/crops/{crop}/diseases/{disease_name}")
def get_disease(crop: str, disease_name: str):
    """Get the full entry for a specific crop disease."""
    filepath = DATA_DIR / "crops" / crop / "diseases" / f"{disease_name}.yaml"
    if not filepath.exists():
        raise HTTPException(status_code=404, detail=f"Not found: {crop}/{disease_name}")
    return yaml.safe_load(filepath.read_text(encoding="utf-8"))


@app.get("/aggregates")
def aggregates():
    """
    Knowledge-base rollups for the admin Dashboard & Analytics.
    Reads YAML only (no vector store needed).
    """
    crop_counts: dict[str, int] = {}
    pathogen_counts: dict[str, int] = {}
    status_counts: dict[str, int] = {}
    diseases = []

    for f in sorted(DATA_DIR.glob("crops/**/diseases/*.yaml")):
        entry = yaml.safe_load(f.read_text(encoding="utf-8"))
        d = entry.get("disease", {})
        crop = f.parent.parent.name
        pathogen_type = (d.get("pathogen") or {}).get("type") or "unknown"
        treatments = d.get("treatments") or []
        my_status = treatments[0].get("regulatory_status") if treatments else "unknown"

        crop_counts[crop] = crop_counts.get(crop, 0) + 1
        pathogen_counts[pathogen_type] = pathogen_counts.get(pathogen_type, 0) + 1
        for t in treatments:
            st = t.get("regulatory_status") or "unknown"
            status_counts[st] = status_counts.get(st, 0) + 1

        diseases.append({
            "name": d.get("name"),
            "crop": crop,
            "pathogen_type": pathogen_type,
            "my_status": my_status,
            "professor_verdict": entry.get("professor_review", {}).get("verdict", "pending"),
            "confidence_score": d.get("confidence_score"),
            "treatments": len(treatments),
        })

    return {
        "crop_coverage": [
            {"crop": c, "diseases": n} for c, n in sorted(crop_counts.items())
        ],
        "pathogen_breakdown": [
            {"type": t, "count": n}
            for t, n in sorted(pathogen_counts.items(), key=lambda kv: -kv[1])
        ],
        "regulatory_status": [
            {"status": s, "count": n}
            for s, n in sorted(status_counts.items(), key=lambda kv: -kv[1])
        ],
        "diseases": diseases,
    }


@app.get("/reviews")
def reviews():
    """
    Professor-review queue: each review JSON joined with its disease YAML.
    Reads JSON + YAML only (no vector store needed).
    """
    verdict_to_status = {"PASS": "MY_approved", "FLAG": "unknown", "REJECT": "MY_banned"}
    out = []

    for rf in sorted(DATA_DIR.glob("reviews/**/*.review.json")):
        review = json.loads(rf.read_text(encoding="utf-8"))
        crop = rf.parent.parent.name
        disease_slug = rf.name.replace(".review.json", "")

        d: dict = {}
        treatments: list = []
        yaml_path = DATA_DIR / "crops" / crop / "diseases" / f"{disease_slug}.yaml"
        if yaml_path.exists():
            entry = yaml.safe_load(yaml_path.read_text(encoding="utf-8"))
            d = entry.get("disease", {})
            treatments = d.get("treatments") or []

        pathogen = d.get("pathogen") or {}
        confidence_score = d.get("confidence_score")
        verdict = review.get("verdict", "PENDING")
        adjusted_confidence = review.get("adjusted_confidence")

        first = treatments[0] if treatments else {}
        my_status = first.get("regulatory_status") or verdict_to_status.get(verdict, "unknown")
        active_ingredient = first.get("compound")
        method = first.get("method")

        disease_display = d.get("local_name") or (d.get("name") or disease_slug).replace("_", " ").title()

        issues = review.get("issues") or []
        snippets = []
        if review.get("notes"):
            snippets.append(review["notes"])
        snippets += [i.get("issue") for i in issues if i.get("issue")]

        review_date = review.get("review_date")
        reviewed_by = review.get("reviewed_by")

        out.append({
            "id": f"{crop}/{disease_slug}",
            "crop": crop,
            "disease": disease_slug,
            "disease_display": disease_display,
            "pathogen_category": pathogen.get("type") or "unknown",
            "pathogen_name": pathogen.get("species"),
            "my_status": my_status,
            "verdict": verdict,
            "adjusted_confidence": adjusted_confidence,
            "issues": issues,
            "notes": review.get("notes"),
            "reviewed_by": reviewed_by,
            "review_date": review_date,
            "confidence": {
                "crop": confidence_score,
                "pathogen": confidence_score,
                "my_status": adjusted_confidence,
            },
            "snippets": snippets,
            "active_ingredient": active_ingredient,
            "intervention": f"{active_ingredient} — {method}" if active_ingredient and method else (active_ingredient or "Cultural / Biological"),
            "title": f"{disease_display} review — {crop}",
            "authors": [reviewed_by] if reviewed_by else [],
            "year": int(str(review_date)[:4]) if review_date else None,
            "publisher": "Professor Review",
            "doi": None,
        })

    return out


@app.get("/stats")
def stats():
    """Database statistics — entry counts, validation status, coverage."""
    validation = validate_all(DATA_DIR)

    crops = set()
    professor_pass = 0
    professor_flag = 0
    professor_reject = 0

    for f in DATA_DIR.glob("crops/**/diseases/*.yaml"):
        crops.add(f.parent.parent.name)
        entry = yaml.safe_load(f.read_text(encoding="utf-8"))
        verdict = entry.get("professor_review", {}).get("verdict")
        if verdict == "PASS":
            professor_pass += 1
        elif verdict == "FLAG":
            professor_flag += 1
        elif verdict == "REJECT":
            professor_reject += 1

    return {
        "total_entries": validation["total"],
        "schema_valid": len(validation["passed"]),
        "schema_errors": len(validation["failed"]),
        "professor_pass": professor_pass,
        "professor_flag": professor_flag,
        "professor_reject": professor_reject,
        "crops_covered": sorted(crops),
        "crops_total": len(crops),
    }
