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
        "endpoints": ["/query", "/crops", "/crops/{crop}/diseases", "/stats"]
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
