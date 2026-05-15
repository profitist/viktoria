from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth.deps import get_current_user
from app.auth.models import User
from app.auth.router import router as auth_router

app = FastAPI()

origins = [
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/v1")


@app.get("/api/v1/health")
async def health(current_user: User = Depends(get_current_user)) -> dict:
    return {"status": "ok", "user_id": str(current_user.id)}


@app.get("/")
async def root():
    return {
        "status": "ok",
    }


@app.get("/api/v1/health")
async def health():
    return {
        "status": "ok",
    }


@app.get("/protected")
async def protected():
    return {
        "message": "Backend connected successfully",
    }
