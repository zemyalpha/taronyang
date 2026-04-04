from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import config

app = FastAPI(title="타로냥 API", version="0.1.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files
app.mount("/static", StaticFiles(directory="../frontend"), name="static")


# --- Routes ---

@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "taronyang"}


# Frontend routes - serve HTML files
@app.get("/")
async def index():
    return FileResponse("../frontend/index.html")


@app.get("/{page}.html")
async def serve_page(page: str):
    return FileResponse(f"../frontend/{page}.html")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=config.HOST, port=config.PORT, reload=config.DEBUG)
