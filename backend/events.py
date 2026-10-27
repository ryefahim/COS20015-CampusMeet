
from fastapi import APIRouter, Depends, HTTPException
from mysql.connector import Error

from database import get_connection
from auth import get_current_user

router = APIRouter(prefix="/api/events", tags=["Events"])


def get_db_connection():
    return get_connection()


@router.get("")
def get_events(current_user: dict = Depends(get_current_user)):
    """Return approved events for clubs the student actively belongs to."""
    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT
                e.EventID,
                e.EventName,
                e.ClubID,
                c.ClubName,
                e.StartDateTime,
                e.EndDateTime,
                e.Location,
                e.Capacity,
                e.Status,
                COUNT(r.RSVP_ID) AS AttendeeCount,
                MAX(
                    CASE
                        WHEN r.StudentID = %s THEN 1
                        ELSE 0
                    END
                ) AS HasRSVPd
            FROM Events e
            JOIN Clubs c ON c.ClubID = e.ClubID
            JOIN Memberships m
                ON m.ClubID = e.ClubID
                AND m.StudentID = %s
                AND m.MembershipStatus = 'Active'
            LEFT JOIN EventRSVPs r ON r.EventID = e.EventID
            WHERE e.Status = 'Approved'
            GROUP BY
                e.EventID,
                e.EventName,
                e.ClubID,
                c.ClubName,
                e.StartDateTime,
                e.EndDateTime,
                e.Location,
                e.Capacity,
                e.Status
            ORDER BY e.StartDateTime ASC
        """, (
            current_user["StudentID"],
            current_user["StudentID"],
        ))

        return cursor.fetchall()

    except Error:
        raise HTTPException(
            status_code=500,
            detail="Could not retrieve events."
        )

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


@router.post("/{event_id}/rsvp")
def rsvp_to_event(
    event_id: int,
    current_user: dict = Depends(get_current_user)
):
    """RSVP to an approved event in one of the student's active clubs."""
    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        connection.start_transaction()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT e.EventID, e.Capacity
            FROM Events e
            JOIN Memberships m
                ON m.ClubID = e.ClubID
                AND m.StudentID = %s
                AND m.MembershipStatus = 'Active'
            WHERE e.EventID = %s
              AND e.Status = 'Approved'
              AND e.StartDateTime > NOW()
            LIMIT 1
            FOR UPDATE
        """, (current_user["StudentID"], event_id))

        event = cursor.fetchone()

        if not event:
            connection.rollback()
            raise HTTPException(
                status_code=404,
                detail="Event not found or you are not an active member of its club."
            )

        cursor.execute("""
            SELECT RSVP_ID
            FROM EventRSVPs
            WHERE EventID = %s AND StudentID = %s
        """, (event_id, current_user["StudentID"]))

        if cursor.fetchone():
            connection.rollback()
            raise HTTPException(
                status_code=409,
                detail="You have already RSVP'd to this event."
            )

        cursor.execute("""
            SELECT COUNT(*) AS total
            FROM EventRSVPs
            WHERE EventID = %s
        """, (event_id,))

        attendee_count = cursor.fetchone()["total"]

        if event["Capacity"] is not None and attendee_count >= event["Capacity"]:
            connection.rollback()
            raise HTTPException(
                status_code=409,
                detail="This event has reached its capacity."
            )

        cursor.execute("""
            INSERT INTO EventRSVPs (EventID, StudentID)
            VALUES (%s, %s)
        """, (event_id, current_user["StudentID"]))

        connection.commit()

        return {"message": "Your RSVP was successful."}

    except HTTPException:
        raise

    except Error:
        if connection and connection.is_connected():
            connection.rollback()
        raise HTTPException(
            status_code=500,
            detail="Could not RSVP to this event."
        )

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


@router.delete("/{event_id}/rsvp")
def cancel_rsvp(
    event_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Cancel the current student's RSVP."""
    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute("""
            DELETE FROM EventRSVPs
            WHERE EventID = %s AND StudentID = %s
        """, (event_id, current_user["StudentID"]))

        if cursor.rowcount == 0:
            raise HTTPException(
                status_code=404,
                detail="You have not RSVP'd to this event."
            )

        connection.commit()

        return {"message": "Your RSVP has been cancelled."}

    except HTTPException:
        raise

    except Error:
        if connection and connection.is_connected():
            connection.rollback()
        raise HTTPException(
            status_code=500,
            detail="Could not cancel your RSVP."
        )

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()
