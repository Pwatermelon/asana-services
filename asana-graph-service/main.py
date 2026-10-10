import logging

from fastapi import Depends, FastAPI, Query

from auth_admin import require_admin
from graph_builder import build_asana_same_as_graph

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("asana_graph_service")

app = FastAPI(
    title="Asana Graph Service",
    description="Микросервис визуального графа асан (isSameAsObject). Только admin.",
    version="1.0.0",
)


@app.get("/health")
def health():
    return {"status": "ok", "service": "asana-graph-service"}


@app.get("/api/admin/asana-graph")
def asana_graph(
    include_inferred: bool = Query(False),
    only_linked: bool = Query(True),
    user: str = Depends(require_admin),
):
    logger.info(
        "graph by %s inferred=%s only_linked=%s",
        user,
        include_inferred,
        only_linked,
    )
    return build_asana_same_as_graph(
        include_inferred=include_inferred,
        only_linked=only_linked,
    )
