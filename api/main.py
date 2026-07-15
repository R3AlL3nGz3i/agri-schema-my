"""
AgriSchema-MY REST API.
Query the Malaysian agriculture knowledge base by crop and symptom.
"""
import json
import sys
from pathlib import Path
from typing import Optional

import yaml
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

sys.path.append(str(Path(__file__).parent.parent))

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

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
    confidence: float
    professor_verdict: str
    symptoms_summary: str
    treatments: list[str]
    citations: list[str]
    relevance_score: float


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

    results = vector_query(crop=req.crop, symptom=req.symptom, n_results=req.n_results)

    output = []
    for r in results:
        meta = r["metadata"]
        output.append(QueryResult(
            disease_name=meta.get("disease_name", "unknown"),
            local_name=meta.get("local_name", ""),
            crop=meta.get("crop", "unknown"),
            confidence=meta.get("confidence_score", 0.0),
            professor_verdict=meta.get("professor_verdict", "pending"),
            symptoms_summary=r["document"],
            treatments=json.loads(meta.get("treatment_compounds", "[]")),
            citations=json.loads(meta.get("citations", "[]")),
            relevance_score=round(1 - r["distance"], 3)
        ))

    return output


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
