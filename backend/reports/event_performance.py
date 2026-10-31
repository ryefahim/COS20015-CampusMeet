
from datetime import date

from fastapi import APIRouter, Depends, Query, HTTPException

from database import get_connection
from auth import require_admin


router = APIRouter(
    prefix="/api/reports",
    tags=["Reports"],
)


@router.get("/event-performance")
def event_performance_report(
    current_user: dict = Depends(require_admin),
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    status: str | None = Query(default=None),
    club_id: int | None = Query(default=None),
):
    # Validate date range
    if start_date and end_date and start_date > end_date:
        raise HTTPException(
            status_code=400,
            detail="Start date cannot be after end date.",
        )

    connection = get_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        query = """
            SELECT
                e.EventID,
                e.EventName,
                e.StartDateTime,
                e.EndDateTime,
                e.Location,
                e.Capacity,
                e.Budget,
                e.Status,

                c.ClubID,
                c.ClubName,
                c.Category AS ClubCategory

            FROM Events e

            LEFT JOIN Clubs c
                ON e.ClubID = c.ClubID

            WHERE 1 = 1
        """

        params = []

        # Filter by event start date
        if start_date:
            query += " AND DATE(e.StartDateTime) >= %s"
            params.append(start_date)

        if end_date:
            query += " AND DATE(e.StartDateTime) <= %s"
            params.append(end_date)

        # Filter by event status
        if status:
            allowed_statuses = [
                "Approved",
                "Pending",
                "Completed",
                "Cancelled",
            ]

            if status not in allowed_statuses:
                raise HTTPException(
                    status_code=400,
                    detail="Invalid event status.",
                )

            query += " AND e.Status = %s"
            params.append(status)

        # Filter by club
        if club_id is not None:
            query += " AND e.ClubID = %s"
            params.append(club_id)

        query += """
            ORDER BY e.StartDateTime DESC
        """

        cursor.execute(query, params)
        results = cursor.fetchall()

        return {
            "report": "Event Performance",
            "filters": {
                "start_date": str(start_date) if start_date else None,
                "end_date": str(end_date) if end_date else None,
                "status": status,
                "club_id": club_id,
            },
            "total_events": len(results),
            "data": results,
        }

    except HTTPException:
        raise

    except Exception as error:
        print("Event performance report error:", error)

        raise HTTPException(
            status_code=500,
            detail="Unable to generate event performance report.",
        ) from error

    finally:
        cursor.close()
        connection.close()


@router.patch("/events/{event_id}/status")
def update_event_status(
    event_id: int,
    new_status: str,
    current_user: dict = Depends(require_admin),
):
    allowed_statuses = ["Approved", "Cancelled"]

    if new_status not in allowed_statuses:
        raise HTTPException(
            status_code=400,
            detail="Invalid event status."
        )

    connection = get_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        cursor.execute(
            "SELECT Status FROM Events WHERE EventID = %s",
            (event_id,)
        )

        event = cursor.fetchone()

        if not event:
            raise HTTPException(
                status_code=404,
                detail="Event not found."
            )

        current_status = event["Status"]

        if current_status not in ["Pending", "Approved"]:
            raise HTTPException(
                status_code=400,
                detail="This event can no longer be updated."
            )

        if current_status == "Approved" and new_status == "Approved":
            raise HTTPException(
                status_code=400,
                detail="This event is already approved."
            )

        cursor.execute(
            """
            UPDATE Events
            SET Status = %s
            WHERE EventID = %s
            """,
            (new_status, event_id)
        )

        connection.commit()

        return {
            "message": f"Event successfully marked as {new_status}.",
            "event_id": event_id,
            "status": new_status
        }

    except HTTPException:
        connection.rollback()
        raise

    except Exception as error:
        connection.rollback()
        print("Event status update error:", error)
        raise HTTPException(
            status_code=500,
            detail="Unable to update event status."
        ) from error

    finally:
        cursor.close()
        connection.close()

