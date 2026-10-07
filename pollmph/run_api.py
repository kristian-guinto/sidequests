#!/usr/bin/env python3
"""Run the pollmph FastAPI server."""

import os
import sys

workspace_dir = os.path.dirname(os.path.abspath(__file__))

# Prepend 3.12-compatible packages in correct priority order
sys.path = [
    workspace_dir,
    "/home/ian/.cache/uv/archive-v0/erIBQZoURfygI6eIKimYG",
    "/home/ian/.cache/uv/archive-v0/L-_C0Xy-6tHYuBsZYqvzJ",
    "/home/ian/.cache/uv/archive-v0/JsEJK6T0uaWlokMFpB_Vr",
    "/home/ian/.cache/uv/archive-v0/bcwTa75aiIFuD4ZS7jEnH",
    "/home/ian/.cache/uv/archive-v0/3ZdDKvp-anFCg0zr2VqqQ",
    "/home/ian/.cache/uv/archive-v0/jr0DqEmjRHH246hycH35T",
    os.path.join(workspace_dir, ".venv/lib/python3.13/site-packages"),
] + sys.path

if __name__ == "__main__":
    import uvicorn
    from pollmph.settings import settings
    from pollmph.api.app import app

    host = os.getenv("HOST", settings.host)
    port = int(os.getenv("PORT", settings.port))
    print(
        f"Starting pollmph FastAPI server on http://{host}:{port} (docs: http://{host}:{port}/docs)"
    )
    uvicorn.run(app, host=host, port=port)
