"""타로냥 FastAPI 메인 애플리케이션"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

import config
from db.database import init_db
from routers import tarot, auth, readings, payment, admin

# DB 초기화 (ruff E402 회피를 위해 먼저 실행)
init_db()

app = FastAPI(title="타로냥 API", version="0.1.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(tarot.router)
app.include_router(auth.router)
app.include_router(readings.router)
app.include_router(payment.router)
app.include_router(admin.router)

# Static files (반드시 router 등록 후 mount)
app.mount("/static", StaticFiles(directory="../frontend"), name="static")


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "taronyang"}


@app.get("/")
async def index():
    return FileResponse("../frontend/index.html")


