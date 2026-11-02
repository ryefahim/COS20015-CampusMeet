
from datetime import date
from fastapi import APIRouter, Depends, Query, HTTPException

from database import get_connection
from auth import require_admin

router = APIRouter(
    prefix="/api/club_engagement",
    tags=["Reports"],
)


# Reusable function for the API and automated report scheduler
def get_club_engagement_data(
    start_date: date | None = None,
    end_date: date | None = None,
):
    if start_date and end_date and start_date > end_date:
        raise ValueError("Start date cannot be after end date.")

    connection = get_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        query = """
            SELECT
                c.ClubID,
                c.ClubName,
                c.Category,
                c.Description,
                c.Metadata,
                COUNT(CASE WHEN m.MembershipStatus = 'Active'
                    THEN m.MembershipID END) AS ActiveMembers,
                COUNT(CASE WHEN m.MembershipStatus = 'Not-Active'
                    THEN m.MembershipID END) AS InactiveMembers,
                COUNT(m.MembershipID) AS TotalMembershipRecords
            FROM Clubs c
            LEFT JOIN Memberships m ON c.ClubID = m.ClubID
        """

        conditions = []
        params = []

        if start_date:
            conditions.append("m.JoinDate >= %s")
            params.append(start_date)

        if end_date:
            conditions.append("m.JoinDate <= %s")
            params.append(end_date)

        if conditions:
            query += " AND " + " AND ".join(conditions)

        query += """
            GROUP BY
                c.ClubID, c.ClubName, c.Category,
                c.Description, c.Metadata
        """

        if conditions:
            query += " HAVING COUNT(m.MembershipID) > 0"

        query += " ORDER BY ActiveMembers DESC"

        cursor.execute(query, params)
        results = cursor.fetchall()

        return {
            "report": "Club Engagement",
            "filters": {
                "start_date": str(start_date) if start_date else None,
                "end_date": str(end_date) if end_date else None,
            },
            "total_clubs": len(results),
            "data": results,
        }

    finally:
        cursor.close()
        connection.close()


# Existing API endpoint – admin access and filtering are preserved
@router.get("/club-engagement")
def club_engagement_report(
    current_user: dict = Depends(require_admin),
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
):
    try:
        return get_club_engagement_data(start_date, end_date)

    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))

    except Exception as error:
        print("Club engagement report error:", error)
        raise HTTPException(
            status_code=500,
            detail="Unable to generate club engagement report."
        ) from error
