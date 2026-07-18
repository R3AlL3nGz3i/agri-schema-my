# Backend image for AgriSchema-MY (FastAPI + ChromaDB + local MiniLM embeddings).
# Works on Hugging Face Spaces (Docker SDK, port 7860) and Render (uses $PORT).
#
# The Gemini key is NOT baked in — set GEMINI_API_KEY as a host secret.
# .env is excluded via .dockerignore so no committed key ships in the image.
FROM python:3.11-slim

# onnxruntime (used by Chroma's default all-MiniLM embeddings) needs libgomp.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Build the vector store at image-build time (downloads the ~90MB MiniLM model
# once and ingests the 23 verified disease entries into data/chroma) so the
# first /query after boot is instant. Embedding is local and needs no API key.
RUN python run_pipeline.py --embed

ENV LLM_PROVIDER=gemini
EXPOSE 7860

# HF Spaces uses 7860; Render injects $PORT.
CMD ["sh", "-c", "uvicorn api.main:app --host 0.0.0.0 --port ${PORT:-7860}"]
