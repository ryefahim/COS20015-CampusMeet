
from datetime import date
from fastapi import APIRouter, Depends, Query, HTTPException

from database import get_connection
from auth import require_admin


router = APIRouter(prefix="/api/reports", tags=["Reports"])


@router.get("/resource-management")
def resource_management_report(
    current_user: dict = Depends(require_admin),
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
):
    # Validate date range
    if start_date and end_date and start_date > end_date:
        raise HTTPException(
            status_code=400,
            detail="Start date cannot be after end date."
        )

    connection = get_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        query = """
            SELECT
                r.ResourceID,
                r.ResourceName,
                r.ResourceType,
                r.Quantity,
                r.ClubID,
                c.ClubName,

                r.SupplierID,
                s.SupplierName,
                s.Email AS SupplierEmail,
                s.ServiceType AS SupplierServiceType,

                COUNT(rb.ResourceBookingID) AS TotalBookings,

                SUM(
                    CASE WHEN rb.Status = 'Approved'
                    THEN 1 ELSE 0 END
                ) AS ApprovedBookings,

                SUM(
                    CASE WHEN rb.Status = 'Pending'
                    THEN 1 ELSE 0 END
                ) AS PendingBookings,

                SUM(
                    CASE WHEN rb.Status = 'Cancelled'
                    THEN 1 ELSE 0 END
                ) AS CancelledBookings,

                SUM(
                    CASE WHEN rb.Status = 'Completed'
                    THEN 1 ELSE 0 END
                ) AS CompletedBookings

            FROM Resources r

            LEFT JOIN Clubs c
                ON r.ClubID = c.ClubID

            LEFT JOIN Suppliers s
                ON r.SupplierID = s.SupplierID

            LEFT JOIN ResourceBookings rb
                ON r.ResourceID = rb.ResourceID
        """

        params = []

        # Apply booking date filters in the JOIN so that
        # resources without matching bookings are still included.
        if start_date:
            query += " AND DATE(rb.StartDateTime) >= %s"
            params.append(start_date)

        if end_date:
            query += " AND DATE(rb.StartDateTime) <= %s"
            params.append(end_date)

        query += """
            GROUP BY
                r.ResourceID,
                r.ResourceName,
                r.ResourceType,
                r.Quantity,
                r.ClubID,
                c.ClubName,
                r.SupplierID,
                s.SupplierName,
                s.Email,
                s.ServiceType

            ORDER BY r.ResourceName ASC
        """

        cursor.execute(query, params)
        results = cursor.fetchall()

        # Convert possible NULL aggregate values to zero.
        for resource in results:
            for field in [
                "TotalBookings",
                "ApprovedBookings",
                "PendingBookings",
                "CancelledBookings",
                "CompletedBookings",
            ]:
                resource[field] = resource[field] or 0

        return {
            "report": "Resource Management",
            "filters": {
                "start_date": str(start_date) if start_date else None,
                "end_date": str(end_date) if end_date else None,
            },
            "total_resources": len(results),
            "total_quantity": sum(
                resource["Quantity"] or 0 for resource in results
            ),
            "total_bookings": sum(
                resource["TotalBookings"] for resource in results
            ),
            "data": results,
        }

    except HTTPException:
        raise

    except Exception as error:
        print("Resource management report error:", error)
        raise HTTPException(
            status_code=500,
            detail="Unable to generate resource management report."
        ) from error

    finally:
        cursor.close()
        connection.close()
