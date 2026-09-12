"""pollmph API Router

Aggregates all API version 1 subrouters.
"""

from fastapi import APIRouter
from pollmph.api.v1.propositions import router as propositions_router
from pollmph.api.v1.sentiments import router as sentiments_router
from pollmph.api.v1.summaries import router as summaries_router
from pollmph.api.v1.tasks import router as tasks_router
from pollmph.api.v1.virtual_poll import router as virtual_poll_router

api_router = APIRouter()

api_router.include_router(propositions_router)
api_router.include_router(sentiments_router)
api_router.include_router(summaries_router)
api_router.include_router(tasks_router)
api_router.include_router(virtual_poll_router)
