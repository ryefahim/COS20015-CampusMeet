
from fastapi import APIRouter, Depends, HTTPException
from mysql.connector import Error

from database import get_connection
from auth import get_current_user, require_admin

router = APIRouter(prefix="/api", tags=["Dashboard"])


def run_query(query, params=None, dictionary=True):
    """Run a read-only query and return its results."""
    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor(dictionary=dictionary)
        cursor.execute(query, params or ())
        return cursor.fetchall()

    except Error:
        raise HTTPException(
            status_code=500,
            detail="Could not retrieve dashboard information.",
        )

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


@router.get("/clubs")
def get_clubs():
    """List clubs for the club directory."""
    return run_query(
        """
        SELECT ClubID, ClubName, Category, Description
        FROM Clubs
        ORDER BY ClubName
        """
    )


@router.get("/dashboard/user-summary")
def get_user_summary(
    current_user: dict = Depends(get_current_user),
):
    """Return summary information for the logged-in user."""
    student_id = current_user["StudentID"]

    memberships = run_query(
        """
        SELECT COUNT(*) AS total
        FROM Memberships
        WHERE StudentID = %s AND MembershipStatus = 'Active'
        """,
        (student_id,),
    )[0]["total"]

    return {
        "active_memberships": memberships,
        "role": current_user["Role"],
    }


@router.get("/dashboard/my-memberships")
def get_my_memberships(
    current_user: dict = Depends(get_current_user),
):
    """Only return memberships belonging to the logged-in student."""
    return run_query(
        """
        SELECT
            m.MembershipID,
            m.ClubID,
            c.ClubName,
            c.Category,
            m.JoinDate,
            m.MembershipStatus
        FROM Memberships m
        JOIN Clubs c ON c.ClubID = m.ClubID
        WHERE m.StudentID = %s
        ORDER BY c.ClubName
        """,
        (current_user["StudentID"],),
    )


@router.get("/dashboard/admin-summary")
def get_admin_summary(
    current_user: dict = Depends(require_admin),
):
    """Only administrators can retrieve database-wide summaries."""
    queries = {
        "students": "SELECT COUNT(*) AS total FROM Students",
        "clubs": "SELECT COUNT(*) AS total FROM Clubs",
        "memberships": "SELECT COUNT(*) AS total FROM Memberships",
        "events": "SELECT COUNT(*) AS total FROM Events",
        "pending_events": (
            "SELECT COUNT(*) AS total FROM Events WHERE Status = 'Pending'"
        ),
    }

    summary = {}

    for name, query in queries.items():
        summary[name] = run_query(query)[0]["total"]

    return summary


@router.post("/clubs/{club_id}/join")
def join_club(
    club_id: int,
    current_user: dict = Depends(get_current_user),
):
    """Join a club or reactivate an existing membership."""
    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor(dictionary=True)

        # Check that the club exists.
        cursor.execute(
            "SELECT ClubID FROM Clubs WHERE ClubID = %s",
            (club_id,),
        )
        if cursor.fetchone() is None:
            raise HTTPException(
                status_code=404,
                detail="Club not found.",
            )

        student_id = current_user["StudentID"]

        # Find the most recent membership for this student and club.
        cursor.execute(
            """
            SELECT MembershipID, MembershipStatus
            FROM Memberships
            WHERE StudentID = %s AND ClubID = %s
            ORDER BY MembershipID DESC
            LIMIT 1
            """,
            (student_id, club_id),
        )
        membership = cursor.fetchone()

        if membership and membership["MembershipStatus"] == "Active":
            return {"message": "You are already a member of this club."}

        if membership:
            # Reactivate an existing membership.
            cursor.execute(
                """
                UPDATE Memberships
                SET MembershipStatus = 'Active',
                    JoinDate = CURDATE()
                WHERE MembershipID = %s
                """,
                (membership["MembershipID"],),
            )
        else:
            # Create a new membership.
            # Generate the next membership ID.
            cursor.execute(
                """
                SELECT COALESCE(MAX(MembershipID), 0) + 1 AS next_id
                FROM Memberships
                """
            )
            next_id = cursor.fetchone()["next_id"]

            # Create the new membership.
            cursor.execute(
                """
                INSERT INTO Memberships
                    (MembershipID, StudentID, ClubID, JoinDate, MembershipStatus)
                VALUES (%s, %s, %s, CURDATE(), 'Active')
                """,
                (next_id, student_id, club_id),
            )

        connection.commit()
        return {"message": "You have successfully joined the club."}

    except HTTPException:
        if connection and connection.is_connected():
            connection.rollback()
        raise

    except Error:
        if connection and connection.is_connected():
            connection.rollback()
        raise HTTPException(
            status_code=500,
            detail="Could not join the club.",
        )

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


@router.post("/clubs/{club_id}/leave")
def leave_club(
    club_id: int,
    current_user: dict = Depends(get_current_user),
):
    """Deactivate the logged-in student's membership."""
    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor()

        cursor.execute(
            "SELECT ClubID FROM Clubs WHERE ClubID = %s",
            (club_id,),
        )
        if cursor.fetchone() is None:
            raise HTTPException(
                status_code=404,
                detail="Club not found.",
            )

        cursor.execute(
            """
            UPDATE Memberships
            SET MembershipStatus = 'Not-Active'
            WHERE StudentID = %s
              AND ClubID = %s
              AND MembershipStatus = 'Active'
            """,
            (current_user["StudentID"], club_id),
        )

        changed = cursor.rowcount
        connection.commit()

        if changed == 0:
            return {"message": "You do not have an active membership in this club."}

        return {"message": "You have left the club."}

    except HTTPException:
        if connection and connection.is_connected():
            connection.rollback()
        raise

    except Error:
        if connection and connection.is_connected():
            connection.rollback()
        raise HTTPException(
            status_code=500,
            detail="Could not leave the club.",
        )

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()
