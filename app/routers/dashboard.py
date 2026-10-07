from pathlib import Path
from datetime import date
from fastapi import APIRouter, Request, Depends
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.project import Project
from app.models.course import Course
from app.models.course_task import Task

router = APIRouter(tags=["Dashboard"])

BASE_DIR = Path(__file__).resolve().parent.parent.parent
templates = Jinja2Templates(directory=BASE_DIR / "templates")


@router.get("/dashboard", response_class=HTMLResponse)
def dashboard_page(
    request: Request,
    db: Session = Depends(get_db)
):
    projects = (
        db.query(Project)
        .order_by(Project.created_at.desc())
        .limit(4)
        .all()
    )

    tasks = (
    db.query(Task)
    .filter(Task.due_date.isnot(None))
    .order_by(Task.due_date.asc())
    .limit(4)
    .all()
)
    upcoming_tasks_count = (
    db.query(Task)
    .filter(Task.due_date.isnot(None))
    .count()
)
    due_today_count = (
    db.query(Task)
    .filter(Task.due_date == date.today())
    .count()
)

    

    return templates.TemplateResponse(
        request=request,
        name="dashboard.html",
        context={
    "active_page": "dashboard",
    "page_title": "Dashboard",
    "projects": projects,
    "tasks": tasks,
    "upcoming_tasks_count": upcoming_tasks_count,
    "due_today_count": due_today_count,
},
    )