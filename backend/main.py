from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import config
from routers import tarot, auth

app = FastAPI(title="타로냥 API", version="0.1.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# DB 초기화
from db.database import init_db
init_db()

# Routers
app.include_router(tarot.router)
app.include_router(auth.router)

# Static files
app.mount("/static", StaticFiles(directory="../frontend"), name="static")


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "taronyang"}


@app.get("/")
async def index():
    return FileResponse("../frontend/index.html")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=config.HOST, port=config.PORT, reload=config.DEBUG)
