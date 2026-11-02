
import csv
import json
import logging

from pathlib import Path
from datetime import datetime
from decimal import Decimal
from zoneinfo import ZoneInfo

from apscheduler.schedulers.background import BackgroundScheduler

from database import get_connection

from reports.club_engagement import get_club_engagement_data
from reports.event_performance import get_event_performance_data
from reports.resource_management import get_resource_management_data


# --------------------------------------------------
# Configuration
# --------------------------------------------------

MELBOURNE_TZ = ZoneInfo("Australia/Melbourne")

REPORT_DIR = Path(__file__).resolve().parent / "generated_reports"

scheduler = BackgroundScheduler(timezone=MELBOURNE_TZ)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# --------------------------------------------------
# Report history
# --------------------------------------------------

def save_report_history(
    report_name,
    filename,
    filepath,
    record_count,
    status,
    error_message=None
):
    connection = get_connection()
    cursor = connection.cursor()

    try:
        query = """
            INSERT INTO ReportGenerationHistory
            (
                ReportName,
                FileName,
                FilePath,
                RecordCount,
                Status,
                ErrorMessage
            )
            VALUES (%s, %s, %s, %s, %s, %s)
        """

        cursor.execute(
            query,
            (
                report_name,
                filename,
                filepath,
                record_count,
                status,
                error_message
            )
        )

        connection.commit()

    except Exception:
        connection.rollback()
        raise

    finally:
        cursor.close()
        connection.close()


# --------------------------------------------------
# CSV generation
# --------------------------------------------------

def generate_csv(report_data, filepath):

    rows = report_data.get("data", [])

    if not rows:
        fieldnames = ["message"]
        rows = [{"message": "No records found"}]
    else:
        fieldnames = list(rows[0].keys())

    with open(filepath, "w", newline="", encoding="utf-8-sig") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()

        for row in rows:
            formatted_row = {}

            for key, value in row.items():
                if isinstance(value, (dict, list)):
                    formatted_row[key] = json.dumps(
                        value,
                        default=str
                    )
                else:
                    formatted_row[key] = value

            writer.writerow(formatted_row)


# --------------------------------------------------
# JSON generation
# --------------------------------------------------

def generate_json(report_data, filepath):

    with open(filepath, "w", encoding="utf-8") as file:
        json.dump(
            report_data,
            file,
            indent=4,
            default=str
        )


# --------------------------------------------------
# Generate an individual report
# --------------------------------------------------

def generate_report(report_name, report_function, timestamp):

    filename_base = (
        report_name.lower().replace(" ", "_")
        + "_"
        + timestamp
    )

    try:
        # Retrieve report data directly from the database
        report_data = report_function()

        record_count = len(report_data.get("data", []))

        # Generate both output formats
        output_formats = [
            ("csv", generate_csv),
            ("json", generate_json)
        ]

        for extension, generator in output_formats:

            filename = f"{filename_base}.{extension}"
            filepath = REPORT_DIR / filename

            try:
                generator(report_data, filepath)

                relative_path = filepath.relative_to(
                    Path(__file__).resolve().parent
                )

                save_report_history(
                    report_name=report_data["report"],
                    filename=filename,
                    filepath=str(relative_path),
                    record_count=record_count,
                    status="Success"
                )

                logger.info("Generated report: %s", filename)

            except Exception as error:

                logger.exception(
                    "Failed to generate %s", filename
                )

                try:
                    save_report_history(
                        report_name=report_data["report"],
                        filename=filename,
                        filepath=str(filepath),
                        record_count=record_count,
                        status="Failed",
                        error_message=str(error)
                    )
                except Exception:
                    logger.exception(
                        "Could not save failed report history"
                    )

    except Exception as error:

        logger.exception(
            "Unable to retrieve %s report data", report_name
        )

        # Record failures for both expected output formats
        for extension in ["csv", "json"]:

            filename = f"{filename_base}.{extension}"

            try:
                save_report_history(
                    report_name=report_name,
                    filename=filename,
                    filepath=str(REPORT_DIR / filename),
                    record_count=0,
                    status="Failed",
                    error_message=str(error)
                )
            except Exception:
                logger.exception(
                    "Could not record report failure"
                )


# --------------------------------------------------
# Generate all three reports
# --------------------------------------------------

def generate_all_reports():

    REPORT_DIR.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now(MELBOURNE_TZ).strftime(
        "%Y%m%d_%H%M%S"
    )

    logger.info("Starting automated report generation")

    reports = [
        ("Club Engagement", get_club_engagement_data),
        ("Event Performance", get_event_performance_data),
        ("Resource Management", get_resource_management_data)
    ]

    for report_name, report_function in reports:

        generate_report(
            report_name,
            report_function,
            timestamp
        )

    logger.info("Automated report generation completed")


# --------------------------------------------------
# Scheduler setup
# --------------------------------------------------

def start_scheduler():

    if scheduler.running:
        return

    scheduler.add_job(
        generate_all_reports,
        trigger="cron",
        day_of_week="mon",
        hour=8,
        minute=0,
        id="weekly_report_generation",
        replace_existing=True,
        max_instances=1,
        coalesce=True
    )

    scheduler.start()

    logger.info(
        "Weekly report scheduler started. "
        "Next generation: Monday at 8:00 AM Melbourne time."
    )


def stop_scheduler():

    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Report scheduler stopped")
