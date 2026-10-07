"""pollmph API Application

Main FastAPI setup for pollmph, mirroring the OpenElectricity API architecture.
"""

import logging
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from pollmph.settings import settings
from pollmph.api.router import api_router
from pollmph.api.schemas import HealthResponse

logger = logging.getLogger("pollmph.api")
logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle events for pollmph FastAPI application."""
    logger.info(
        f"pollmph API starting up on {settings.environment} (v{settings.version})"
    )
    yield
    logger.info("pollmph API shutting down")


app = FastAPI(
    title=settings.title,
    version=settings.version,
    description=settings.description,
    debug=settings.debug,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS Middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Process-Time"],
)


@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    """Add X-Process-Time response header to all requests."""
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = f"{process_time:.4f}s"
    return response


@app.get("/", tags=["System"])
def root():
    """API metadata and navigation."""
    return {
        "title": settings.title,
        "version": settings.version,
        "environment": settings.environment,
        "docs_url": "/docs",
        "redoc_url": "/redoc",
        "api_v1": settings.api_prefix,
    }


@app.get("/health", response_model=HealthResponse, tags=["System"])
def health():
    """Health check endpoint."""
    return HealthResponse(
        status="ok",
        version=settings.version,
        environment=settings.environment,
    )


# Mount versioned API routes
app.include_router(api_router, prefix=settings.api_prefix)
