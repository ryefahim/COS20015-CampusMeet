
import os
import re
from datetime import datetime, timedelta, timezone

import jwt # pyright: ignore[reportMissingImports]
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from mysql.connector import Error, IntegrityError
from pydantic import BaseModel, Field, field_validator
from pwdlib import PasswordHash # pyright: ignore[reportMissingImports]

from database import get_connection


# --------------------------------------------------
# Configuration
# --------------------------------------------------

load_dotenv()

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")

if not JWT_SECRET_KEY or JWT_SECRET_KEY == "PASTE_YOUR_GENERATED_SECRET_HERE":
    raise RuntimeError("Set JWT_SECRET_KEY in your .env file.")

JWT_ALGORITHM = "HS256"
TOKEN_EXPIRE_MINUTES = 60

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

password_hash = PasswordHash.recommended()
bearer_scheme = HTTPBearer()


# --------------------------------------------------
# Request models
# --------------------------------------------------

class RegisterRequest(BaseModel):
    first_name: str = Field(min_length=1, max_length=50)
    last_name: str = Field(min_length=1, max_length=50)
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("first_name", "last_name")
    @classmethod
    def validate_name(cls, value):
        value = value.strip()
        if not value:
            raise ValueError("Name cannot be empty.")
        return value

    @field_validator("email")
    @classmethod
    def validate_email(cls, value):
        value = value.strip().lower()
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.com", value):
            raise ValueError("Enter an email address in the format text@text.com.")
        return value


class LoginRequest(BaseModel):
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value):
        value = value.strip().lower()
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.com", value):
            raise ValueError("Enter an email address in the format text@text.com.")
        return value


# --------------------------------------------------
# JWT token creation
# --------------------------------------------------

def create_access_token(user_id: int):
    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=TOKEN_EXPIRE_MINUTES
    )

    payload = {
        "sub": str(user_id),
        "exp": expires_at,
    }

    return jwt.encode(
        payload,
        JWT_SECRET_KEY,
        algorithm=JWT_ALGORITHM,
    )


def authentication_response(user: dict):
    return {
        "access_token": create_access_token(user["UserID"]),
        "token_type": "bearer",
        "user": user,
    }


# --------------------------------------------------
# Register a new User account
# --------------------------------------------------

@router.post("/register", status_code=201)
def register(request: RegisterRequest):
    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor()

        # Prevent duplicate student email addresses.
        cursor.execute(
            """
            SELECT StudentID
            FROM Students
            WHERE LOWER(Email) = LOWER(%s)
            LIMIT 1
            """,
            (request.email,),
        )

        if cursor.fetchone():
            raise HTTPException(
                status_code=409,
                detail="This email already has a student profile.",
            )

        # Create the student profile.
        cursor.execute(
            """
            INSERT INTO Students (FirstName, LastName, Email)
            VALUES (%s, %s, %s)
            """,
            (
                request.first_name,
                request.last_name,
                request.email,
            ),
        )

        student_id = cursor.lastrowid

        # Hash the password before storing it.
        hashed_password = password_hash.hash(request.password)

        # Public registration always creates a User, never an Admin.
        cursor.execute(
            """
            INSERT INTO UserAccounts
                (StudentID, Email, PasswordHash, Role)
            VALUES (%s, %s, %s, 'User')
            """,
            (
                student_id,
                request.email,
                hashed_password,
            ),
        )

        user_id = cursor.lastrowid
        connection.commit()

        user = {
            "UserID": user_id,
            "StudentID": student_id,
            "FirstName": request.first_name,
            "LastName": request.last_name,
            "Email": request.email,
            "Role": "User",
        }

        return authentication_response(user)

    except HTTPException:
        if connection:
            connection.rollback()
        raise

    except IntegrityError:
        if connection:
            connection.rollback()

        raise HTTPException(
            status_code=409,
            detail="An account with these details may already exist.",
        )

    except Error:
        if connection:
            connection.rollback()

        raise HTTPException(
            status_code=500,
            detail="Could not create your account.",
        )

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


# --------------------------------------------------
# Log in
# --------------------------------------------------

@router.post("/login")
def login(request: LoginRequest):
    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute(
            """
            SELECT
                ua.UserID,
                ua.StudentID,
                s.FirstName,
                s.LastName,
                ua.Email,
                ua.PasswordHash,
                ua.Role
            FROM UserAccounts ua
            JOIN Students s ON ua.StudentID = s.StudentID
            WHERE LOWER(ua.Email) = LOWER(%s)
            LIMIT 1
            """,
            (request.email,),
        )

        account = cursor.fetchone()

        if (
            not account
            or not password_hash.verify(
                request.password,
                account["PasswordHash"],
            )
        ):
            raise HTTPException(
                status_code=401,
                detail="Incorrect email or password.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        user = {
            "UserID": account["UserID"],
            "StudentID": account["StudentID"],
            "FirstName": account["FirstName"],
            "LastName": account["LastName"],
            "Email": account["Email"],
            "Role": account["Role"],
        }

        return authentication_response(user)

    except HTTPException:
        raise

    except Error:
        raise HTTPException(
            status_code=500,
            detail="Could not log in. Please try again.",
        )

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


# --------------------------------------------------
# Get the currently logged-in user
# --------------------------------------------------

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
):
    token = credentials.credentials

    try:
        payload = jwt.decode(
            token,
            JWT_SECRET_KEY,
            algorithms=[JWT_ALGORITHM],
        )

        user_id = int(payload["sub"])

    except (jwt.InvalidTokenError, KeyError, TypeError, ValueError):
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired login token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute(
            """
            SELECT
                ua.UserID,
                ua.StudentID,
                s.FirstName,
                s.LastName,
                ua.Email,
                ua.Role
            FROM UserAccounts ua
            JOIN Students s ON ua.StudentID = s.StudentID
            WHERE ua.UserID = %s
            LIMIT 1
            """,
            (user_id,),
        )

        user = cursor.fetchone()

        if not user:
            raise HTTPException(
                status_code=401,
                detail="Account not found.",
            )

        return user

    except HTTPException:
        raise

    except Error:
        raise HTTPException(
            status_code=500,
            detail="Could not verify your account.",
        )

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


# --------------------------------------------------
# Admin-only access protection
# --------------------------------------------------

def require_admin(
    current_user: dict = Depends(get_current_user),
):
    if current_user["Role"] != "Admin":
        raise HTTPException(
            status_code=403,
            detail="Admin access required.",
        )

    return current_user


# --------------------------------------------------
# Current account endpoint
# --------------------------------------------------

@router.get("/me")
def get_my_account(
    current_user: dict = Depends(get_current_user),
):
    return {"user": current_user}
