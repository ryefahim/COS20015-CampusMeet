
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dashboard import router as dashboard_router
from auth import router as auth_router
from events import router as events_router

# Create the FastAPI application
app = FastAPI(title="CampusMeet API")

# Allow the React frontend to communicate with the backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register all API endpoints
app.include_router(auth_router)
app.include_router(dashboard_router)
app.include_router(events_router)

@app.get("/")
def home():
    return {"message": "CampusMeet API is running"}


@app.get("/api/health")
def health_check():
    return {"status": "ok"}
