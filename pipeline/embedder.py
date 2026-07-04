"""
ChromaDB embedder.
Ingests validated YAML entries into a vector store for semantic search.
Only ingests PASS/FLAG entries — REJECTs are excluded.
"""
import yaml
import json
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

COLLECTION_NAME = "agri_schema_my"

# Anchor paths to this module so the pipeline works cwd-independently
_MODULE_DIR = Path(__file__).resolve().parent
_PROJECT_ROOT = _MODULE_DIR.parent
_DATA_DIR = _PROJECT_ROOT / "data"
CHROMA_PATH = str(_DATA_DIR / "chroma")


def get_collection():
    import chromadb
    from chromadb.utils import embedding_functions
    client = chromadb.PersistentClient(path=CHROMA_PATH)
    ef = embedding_functions.DefaultEmbeddingFunction()
    return client.get_or_create_collection(
        name=COLLECTION_NAME,
        embedding_function=ef,
        metadata={"hnsw:space": "cosine"}
    )


def entry_to_document(entry: dict) -> tuple[str, dict]:
    """Convert YAML entry to searchable text + metadata for ChromaDB."""
    disease = entry.get("disease", {})
    symptoms = disease.get("symptoms", {})
    treatments = disease.get("treatments", [])
    pathogen = disease.get("pathogen", {})

    parts = [
        f"Crop: {entry.get('crop', '')}",
        f"Disease: {disease.get('name', '')}",
        f"Local name: {disease.get('local_name', '')}",
        f"Pathogen: {pathogen.get('species', '')} ({pathogen.get('type', '')})",
        f"Visual symptoms: {', '.join(symptoms.get('visual', []))}",
        f"Growth impact: {symptoms.get('growth', '')}",
        f"Treatments: {', '.join(t.get('compound', '') for t in treatments if t.get('compound'))}",
    ]

    document = "\n".join(p for p in parts if p.split(": ", 1)[-1].strip())

    treatment_compounds = [t.get("compound", "") for t in treatments]
    citations = disease.get("source_citations", [])

    metadata = {
        "crop": (entry.get("crop") or "unknown").lower(),
        "disease_name": disease.get("name", "unknown"),
        "local_name": disease.get("local_name") or "",
        "confidence_score": float(disease.get("confidence_score") or 0.5),
        "pathogen_type": pathogen.get("type", "unknown"),
        "treatment_compounds": json.dumps(treatment_compounds),
        "citations": json.dumps(citations),
        "professor_verdict": entry.get("professor_review", {}).get("verdict", "pending"),
    }

    return document, metadata


def ingest_all(data_dir: Path = _DATA_DIR) -> dict:
    """Ingest all non-rejected entries into ChromaDB."""
    collection = get_collection()
    ingested = 0
    skipped = 0

    for yaml_file in sorted(data_dir.glob("crops/**/diseases/*.yaml")):
        try:
            entry = yaml.safe_load(yaml_file.read_text(encoding="utf-8"))
            verdict = entry.get("professor_review", {}).get("verdict", "pending")

            if verdict == "REJECT":
                skipped += 1
                logger.info(f"Skipping REJECTED: {yaml_file.name}")
                continue

            doc_id = str(yaml_file.relative_to(data_dir)).replace("/", "__").replace(".yaml", "")
            document, metadata = entry_to_document(entry)

            collection.upsert(
                ids=[doc_id],
                documents=[document],
                metadatas=[metadata]
            )
            ingested += 1
            logger.info(f"Ingested: {doc_id}")

        except Exception as e:
            logger.error(f"Ingest failed for {yaml_file}: {e}")

    logger.info(f"Done: {ingested} ingested, {skipped} skipped")
    return {"ingested": ingested, "skipped": skipped}


def query(crop: str = None, symptom: str = None, n_results: int = 5) -> list[dict]:
    """Semantic search over the knowledge base."""
    collection = get_collection()

    parts = []
    if crop:
        parts.append(f"Crop: {crop}")
    if symptom:
        parts.append(f"Symptoms: {symptom}")
    query_text = "\n".join(parts) if parts else "crop disease treatment Malaysia"

    where = {"crop": {"$eq": crop.lower()}} if crop else None

    results = collection.query(
        query_texts=[query_text],
        n_results=n_results,
        where=where
    )

    return [
        {
            "id": results["ids"][0][i],
            "document": results["documents"][0][i],
            "metadata": results["metadatas"][0][i],
            "distance": results["distances"][0][i],
        }
        for i in range(len(results["ids"][0]))
    ]
