
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dashboard import router as dashboard_router
from auth import router as auth_router
from events import router as events_router
from reports.club_engagement import router as club_router
from reports.event_performance import router as event_router
from reports.resource_management import router as resource_router
from create_event import router as create_event_router
from generated_reports import router as generated_reports_router

from contextlib import asynccontextmanager
from report_scheduler import (
    generate_all_reports,
    start_scheduler,
    stop_scheduler
) 


@asynccontextmanager
async def lifespan(app: FastAPI):

    # Start weekly automated report generation
    start_scheduler()

    yield

    # Stop scheduler when backend shuts down
    stop_scheduler()
# Create the FastAPI application
app = FastAPI(title="CampusMeet API", lifespan=lifespan)

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
app.include_router(club_router)
app.include_router(event_router)
app.include_router(resource_router)
app.include_router(create_event_router)
app.include_router(generated_reports_router)


@app.get("/")
def home():
    return {"message": "CampusMeet API is running"}


@app.get("/api/health")
def health_check():
    return {"status": "ok"}
