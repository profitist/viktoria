from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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
