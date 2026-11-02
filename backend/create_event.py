
from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from mysql.connector import Error

from database import get_connection
from auth import require_admin


router = APIRouter(
    prefix="/api/admin/events",
    tags=["Admin Events"]
)


# -------------------------------------------------
# Event creation request model
# -------------------------------------------------

class CreateEventRequest(BaseModel):
    club_id: int = Field(gt=0)
    event_name: str = Field(min_length=1, max_length=100)
    start_datetime: datetime
    end_datetime: datetime
    location: str | None = Field(default=None, max_length=150)
    capacity: int | None = Field(default=None, gt=0)
    budget: Decimal | None = Field(default=None, ge=0)


# -------------------------------------------------
# Retrieve clubs for the event creation form
# Admin only
# -------------------------------------------------

@router.get("/clubs")
def get_event_clubs(
    current_user: dict = Depends(require_admin)
):
    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT ClubID, ClubName
            FROM Clubs
            ORDER BY ClubName ASC
        """)

        return cursor.fetchall()

    except Error as error:
        print("Retrieve event clubs error:", error)

        raise HTTPException(
            status_code=500,
            detail="Could not retrieve clubs."
        )

    finally:
        if cursor:
            cursor.close()

        if connection and connection.is_connected():
            connection.close()


# -------------------------------------------------
# Create a new event
# Admin only
# -------------------------------------------------

@router.post("")
def create_event(
    event: CreateEventRequest,
    current_user: dict = Depends(require_admin)
):
    connection = None
    cursor = None

    # Validate event information
    if not event.event_name.strip():
        raise HTTPException(
            status_code=400,
            detail="Event name cannot be empty."
        )

    if event.end_datetime <= event.start_datetime:
        raise HTTPException(
            status_code=400,
            detail="End date and time must be after the start date and time."
        )

    try:
        connection = get_connection()
        cursor = connection.cursor(dictionary=True)

        # Check whether the selected club exists
        cursor.execute("""
            SELECT ClubID
            FROM Clubs
            WHERE ClubID = %s
        """, (event.club_id,))

        club = cursor.fetchone()

        if not club:
            raise HTTPException(
                status_code=404,
                detail="Selected club does not exist."
            )

        # Insert the event into the database
        # EventID is automatically generated
        # Status is automatically set to Pending

        cursor.execute("""
            INSERT INTO Events (
                ClubID,
                EventName,
                StartDateTime,
                EndDateTime,
                Location,
                Capacity,
                Budget,
                Status
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, 'Pending')
        """, (
            event.club_id,
            event.event_name.strip(),
            event.start_datetime,
            event.end_datetime,
            event.location.strip() if event.location else None,
            event.capacity,
            event.budget
        ))

        event_id = cursor.lastrowid

        connection.commit()

        return {
            "message": "Event successfully created.",
            "event_id": event_id,
            "status": "Pending"
        }

    except HTTPException:
        if connection and connection.is_connected():
            connection.rollback()
        raise

    except Error as error:
        if connection and connection.is_connected():
            connection.rollback()

        print("Create event error:", error)

        raise HTTPException(
            status_code=500,
            detail="Could not create event."
        )

    finally:
        if cursor:
            cursor.close()

        if connection and connection.is_connected():
            connection.close()
