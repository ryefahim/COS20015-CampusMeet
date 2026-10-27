
from database import get_connection

connection = None

try:
    connection = get_connection()

    if connection.is_connected():
        print("SUCCESS: Connected to MySQL!")
        print("Database:", connection.database)

        cursor = connection.cursor()
        cursor.execute("SHOW TABLES")

        print("\nTables found:")
        for row in cursor.fetchall():
            print("-", row[0])

        cursor.close()

except Exception as error:
    print("CONNECTION FAILED:", error)

finally:
    if connection and connection.is_connected():
        connection.close()
        print("\nConnection closed.")
