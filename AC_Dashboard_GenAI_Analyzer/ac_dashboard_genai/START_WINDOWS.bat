@echo off
cd backend
if not exist venv (
    python -m venv venv
)
call venv\Scripts\activate
pip install -r requirements.txt
if not exist .env (
    copy .env.example .env
    echo.
    echo IMPORTANT: Open backend\.env and add your GROQ_API_KEY.
    pause
)
uvicorn app:app --reload --host 0.0.0.0 --port 9000
