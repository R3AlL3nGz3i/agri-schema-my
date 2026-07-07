"""End-to-end orchestrator safety test (run_pipeline.main).

SAFETY INVARIANT under test: an entry that fails the Layer 1 compliance gate
(any REJECT) is NEVER embedded into the served vector store, and the run exits
non-zero. This guards the historical fail-open where --all ran compliance for
its report but embedded regardless.

Fully offline + deterministic: every phase is monkeypatched; the real
compliance.gate_failed is exercised against synthetic summaries. No network,
API, ChromaDB, or filesystem writes.
Run: python tests/test_pipeline_gate.py
"""
import sys
from contextlib import contextmanager
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import run_pipeline as rp


_REJECT_SUMMARY = {"PASS": ["a.yaml"], "FLAG": [], "REJECT": ["banned.yaml"], "errors": []}
_CLEAN_SUMMARY = {"PASS": ["a.yaml", "b.yaml"], "FLAG": ["c.yaml"], "REJECT": [], "errors": []}


@contextmanager
def _patched(compliance_summary):
    """Stub every phase; record whether phase_embed ran. Restores on exit."""
    calls = {"embed": 0}
    saved = {name: getattr(rp, name) for name in
             ("phase_scrape", "phase_seed", "phase_extract", "phase_validate",
              "phase_compliance", "phase_review", "phase_embed", "phase_grounded_review")}

    def _noop(*a, **k):
        return None

    rp.phase_scrape = _noop
    rp.phase_seed = _noop
    rp.phase_extract = _noop
    rp.phase_validate = _noop
    rp.phase_review = _noop
    rp.phase_grounded_review = _noop
    rp.phase_compliance = lambda *a, **k: compliance_summary

    def _embed(*a, **k):
        calls["embed"] += 1
        return {"ingested": 1, "skipped": 0}
    rp.phase_embed = _embed

    try:
        yield calls
    finally:
        for name, fn in saved.items():
            setattr(rp, name, fn)


def test_all_blocks_embed_on_reject():
    with _patched(_REJECT_SUMMARY) as calls:
        code = rp.main(["--all"])
    assert code == 1, "run with a REJECT must exit non-zero"
    assert calls["embed"] == 0, "REJECT entry must never reach the embedder"


def test_all_embeds_when_clean():
    with _patched(_CLEAN_SUMMARY) as calls:
        code = rp.main(["--all"])
    assert code == 0
    assert calls["embed"] == 1, "clean run must embed"


def test_standalone_embed_forces_compliance_and_blocks():
    # --embed alone (no --compliance) must still run the gate and block on REJECT.
    with _patched(_REJECT_SUMMARY) as calls:
        code = rp.main(["--embed"])
    assert code == 1
    assert calls["embed"] == 0, "standalone --embed must not bypass the gate"


def test_standalone_embed_runs_when_clean():
    with _patched(_CLEAN_SUMMARY) as calls:
        code = rp.main(["--embed"])
    assert code == 0
    assert calls["embed"] == 1


def test_compliance_only_exits_nonzero_on_reject():
    # CI usage: --compliance alone must fail the process on a REJECT.
    with _patched(_REJECT_SUMMARY) as calls:
        code = rp.main(["--compliance"])
    assert code == 1
    assert calls["embed"] == 0


if __name__ == "__main__":
    import traceback
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    failed = 0
    for t in tests:
        try:
            t()
            print(f"PASS  {t.__name__}")
        except Exception:
            failed += 1
            print(f"FAIL  {t.__name__}")
            traceback.print_exc()
    print(f"\n{len(tests) - failed}/{len(tests)} passed")
    sys.exit(1 if failed else 0)
