from pathlib import Path
from datetime import date, timedelta
from fastapi import APIRouter, Request, Depends
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.project import Project
from app.models.course import Course
from app.models.course_task import Task
from app.models.notification import Notification

router = APIRouter(tags=["Dashboard"])

BASE_DIR = Path(__file__).resolve().parent.parent.parent
templates = Jinja2Templates(directory=BASE_DIR / "templates")


@router.get("/dashboard", response_class=HTMLResponse)
def dashboard_page(
    request: Request,
    db: Session = Depends(get_db)
):
    total_notifications_count = db.query(Notification).count()
    projects = (
        db.query(Project)
        .order_by(Project.created_at.desc())
        .limit(4)
        .all()
    )

    today = date.today()
    week_end = today + timedelta(days=6 - today.weekday())

    upcoming_tasks = (
        db.query(Task)
        .filter(
            Task.due_date > today,
            Task.status != "Done"
        )
        .order_by(Task.due_date.asc())
        .all()
    )

    due_today_tasks = (
        db.query(Task)
        .filter(
            Task.due_date == today,
            Task.status != "Done"
        )
        .order_by(Task.due_date.asc())
        .all()
    )

    this_week_tasks = (
        db.query(Task)
        .filter(
            Task.due_date >= today,
            Task.due_date <= week_end,
            Task.status != "Done"
        )
        .order_by(Task.due_date.asc())
        .all()
    )

    overdue_tasks = (
        db.query(Task)
        .filter(
            Task.due_date < today,
            Task.status != "Done"
        )
        .order_by(Task.due_date.asc())
        .all()
    )

    # Task Overview: calculate percentages automatically
    all_tasks = db.query(Task).all()
    total_tasks = len(all_tasks)

    todo_count = sum(
        1 for task in all_tasks
        if (task.status or "").strip().lower() in ["to do", "todo"]
    )

    in_progress_count = sum(
        1 for task in all_tasks
        if (task.status or "").strip().lower() == "in progress"
    )

    done_count = sum(
        1 for task in all_tasks
        if (task.status or "").strip().lower() == "done"
    )

    todo_percentage = round(todo_count / total_tasks * 100) if total_tasks else 0
    in_progress_percentage = round(in_progress_count / total_tasks * 100) if total_tasks else 0
    done_percentage = 100 - todo_percentage - in_progress_percentage if total_tasks else 0


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
    "total_notifications_count": total_notifications_count,
    "projects": projects,
    "upcoming_tasks": upcoming_tasks,
    "due_today_tasks": due_today_tasks,
    "this_week_tasks": this_week_tasks,
    "overdue_tasks": overdue_tasks,
    "upcoming_tasks_count": upcoming_tasks_count,
    "due_today_count": due_today_count,
    "todo_percentage": todo_percentage,
    "in_progress_percentage": in_progress_percentage,
    "done_percentage": done_percentage,
},
    )
