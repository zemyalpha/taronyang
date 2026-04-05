from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import config
from database import init_db
from routers import tarot, auth, notifications, payment
from services.daily_notify import setup_scheduler

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    setup_scheduler(app)
    yield

app = FastAPI(title="타로냥 API", version="0.1.0", lifespan=lifespan)

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
app.include_router(notifications.router)
app.include_router(payment.router)

# Static files
app.mount("/static", StaticFiles(directory="../frontend"), name="static")


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "taronyang"}


@app.get("/")
async def index():
    return FileResponse("../frontend/index.html")


@app.get("/mypage")
async def mypage():
    return FileResponse("../frontend/mypage.html")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=config.HOST, port=config.PORT, reload=config.DEBUG)
