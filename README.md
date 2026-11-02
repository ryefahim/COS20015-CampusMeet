# CampusMeet

CampusMeet is a student campus events application. The frontend is built with React and Vite, and the API uses FastAPI with a MySQL database.

## Project structure

```text
CampusMeet/
├── backend/
│   ├── main.py                 # FastAPI app and API router setup
│   ├── auth.py                 # Registration, login, and JWT authentication
│   ├── database.py             # MySQL connection configuration
│   ├── dashboard.py            # Dashboard endpoints
│   ├── events.py               # Event listing endpoints
│   ├── create_event.py         # Event administration endpoints
│   ├── generated_reports.py    # Generated report endpoints
│   ├── report_scheduler.py     # Scheduled report generation
│   ├── reports/                # Club, event, and resource reports
│   └── generated_reports/      # Generated CSV and JSON report files
└── campus-meet/
    ├── index.html
    ├── package.json            # Frontend dependencies and scripts
    ├── vite.config.js
    ├── public/                 # Static images and icons
    └── src/
        ├── api/                # API client configuration
        ├── assets/             # Imported frontend assets
        ├── pages/              # App screens and report pages
        └── styles/             # Page and component styles
```

## Prerequisites

- Python 3.10 or later
- Node.js and npm
- MySQL Server
- A MySQL database and tables for CampusMeet. The repository does not include a database schema or seed script; use the schema supplied with your course/project.

## Configure the backend

Create `backend/.env` with your local MySQL credentials and a private JWT secret:

```dotenv
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_mysql_username
DB_PASSWORD=your_mysql_password
DB_NAME=campus_meet
JWT_SECRET_KEY=replace_with_a_long_random_secret
```

Generate a secret and paste its output into `JWT_SECRET_KEY`:

- macOS: `openssl rand -hex 32`
- Windows PowerShell: `[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))`

Ensure MySQL is running and the database/tables exist before starting the API. The optional connection check is `python test_connection.py` (run from the `backend` folder).

## Run on macOS

Open two Terminal windows from the repository root.

### 1. Start the API

```sh
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install fastapi uvicorn mysql-connector-python python-dotenv PyJWT 'pwdlib[argon2]' APScheduler
uvicorn main:app --reload
```

The API runs at <http://127.0.0.1:8000>. Interactive API documentation is at <http://127.0.0.1:8000/docs>.

### 2. Start the frontend

```sh
cd campus-meet
npm install
npm run dev
```

Open the URL printed by Vite, usually <http://localhost:5173>.

## Run on Windows

Open two PowerShell windows from the repository root.

### 1. Start the API

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
py -m pip install fastapi uvicorn mysql-connector-python python-dotenv PyJWT 'pwdlib[argon2]' APScheduler
uvicorn main:app --reload
```

If PowerShell blocks activation, run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` in that window, then activate the environment again. The API runs at <http://127.0.0.1:8000>; its docs are at <http://127.0.0.1:8000/docs>.

### 2. Start the frontend

```powershell
cd campus-meet
npm install
npm run dev
```

Open the URL printed by Vite, usually <http://localhost:5173>.

## Useful commands

Run these from `campus-meet`:

| Command | Description |
| --- | --- |
| `npm run dev` | Start the frontend development server |
| `npm run build` | Build the frontend for production |
| `npm run preview` | Preview a production build locally |
| `npm run lint` | Run Oxlint |

The frontend API client currently connects to `http://127.0.0.1:8000`. The backend allows the Vite development origin `http://localhost:5173`.
