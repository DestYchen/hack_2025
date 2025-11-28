from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import router as api_router
from app.config import get_settings
from app.db import Base, engine

settings = get_settings()
app = FastAPI(title="Comments Pipeline API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.exception_handler(HTTPException)
async def http_exception_handler(_: Request, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code, content={"status": "error", "message": exc.detail})


@app.exception_handler(Exception)
async def unhandled_exception_handler(_: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"status": "error", "message": str(exc)})


@app.on_event("startup")
async def startup_event():
    # Ensure DB schema exists and file storage directories are present.
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    from app.services.files import _ensure_dirs

    _ensure_dirs()
