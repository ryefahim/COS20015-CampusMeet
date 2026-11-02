
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse

from database import get_connection
from auth import require_admin

router = APIRouter(
    prefix="/api/reports",
    tags=["Generated Reports"]
)

BACKEND_DIR = Path(__file__).resolve().parent
REPORT_DIR = (BACKEND_DIR / "generated_reports").resolve()


# Get generated report history
@router.get("/generated")
def get_generated_reports(
    current_user: dict = Depends(require_admin)
):
    connection = get_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        cursor.execute("""
            SELECT
                ReportRunID,
                ReportName,
                FileName,
                GeneratedAt,
                RecordCount,
                Status,
                ErrorMessage
            FROM ReportGenerationHistory
            ORDER BY GeneratedAt DESC
        """)

        return cursor.fetchall()

    except Exception as error:
        print("Generated reports history error:", error)
        raise HTTPException(
            status_code=500,
            detail="Unable to retrieve generated reports."
        ) from error

    finally:
        cursor.close()
        connection.close()


# Download a generated report
@router.get("/generated/{report_run_id}/download")
def download_generated_report(
    report_run_id: int,
    current_user: dict = Depends(require_admin)
):
    connection = get_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        cursor.execute("""
            SELECT FileName, FilePath, Status
            FROM ReportGenerationHistory
            WHERE ReportRunID = %s
        """, (report_run_id,))

        report = cursor.fetchone()

    except Exception as error:
        print("Generated report download lookup error:", error)
        raise HTTPException(
            status_code=500,
            detail="Unable to retrieve report details."
        ) from error

    finally:
        cursor.close()
        connection.close()

    if not report:
        raise HTTPException(
            status_code=404,
            detail="Report not found."
        )

    if report["Status"] != "Success":
        raise HTTPException(
            status_code=400,
            detail="This report was not generated successfully."
        )

    try:
        # Build the path using the known reports directory
        file_path = (REPORT_DIR / report["FileName"]).resolve()
        print("\n--- REPORT DOWNLOAD DEBUG ---")
        print("Report ID:", report_run_id)
        print("Filename from database:", report["FileName"])
        print("Backend directory:", BACKEND_DIR)
        print("Report directory:", REPORT_DIR)
        print("Resolved file path:", file_path)
        print("File exists:", file_path.is_file())
        print("Files in report directory:", list(REPORT_DIR.iterdir()))
        print("-----------------------------\n")

        # Ensure the file remains inside generated_reports
        file_path.relative_to(REPORT_DIR)

    except (ValueError, TypeError):
        raise HTTPException(
            status_code=400,
            detail="Invalid report file path."
        )

    if not file_path.is_file():
        print("Download file not found:", file_path)

        raise HTTPException(
            status_code=404,
            detail="Report file could not be found."
        )

    extension = file_path.suffix.lower()

    media_types = {
        ".csv": "text/csv",
        ".json": "application/json"
    }

    if extension not in media_types:
        raise HTTPException(
            status_code=400,
            detail="Unsupported report format."
        )

    return FileResponse(
        path=str(file_path),
        filename=report["FileName"],
        media_type=media_types[extension]
    )
