
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
from app.models.user import User
from app.utils.dependencies import get_current_user

router = APIRouter(tags=["Dashboard"])

BASE_DIR = Path(__file__).resolve().parent.parent.parent
templates = Jinja2Templates(directory=BASE_DIR / "templates")


# 1. Load the dashboard page without requiring a bearer token
@router.get("/dashboard", response_class=HTMLResponse)
def dashboard_page(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="dashboard.html",
        context={
            "active_page": "dashboard",
            "page_title": "Dashboard",
            "total_notifications_count": 0,
            "projects": [],
            "upcoming_tasks": [],
            "due_today_tasks": [],
            "this_week_tasks": [],
            "overdue_tasks": [],
            "upcoming_tasks_count": 0,
            "due_today_count": 0,
            "todo_percentage": 0,
            "in_progress_percentage": 0,
            "done_percentage": 0,
        },
    )


# 2. Return dashboard data for the authenticated user
@router.get("/api/dashboard")
def dashboard_data(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    total_notifications_count = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id)
        .count()
    )

    projects = (
        db.query(Project)
        .filter(Project.owner_id == current_user.id)
        .order_by(Project.created_at.desc())
        .limit(4)
        .all()
    )

    user_tasks_query = (
        db.query(Task)
        .join(Course, Task.course_id == Course.id)
        .filter(Course.owner_id == current_user.id)
    )

    today = date.today()
    week_end = today + timedelta(days=6 - today.weekday())

    upcoming_tasks = (
        user_tasks_query
        .filter(Task.due_date > today, Task.status != "Done")
        .order_by(Task.due_date.asc())
        .all()
    )

    due_today_tasks = (
        user_tasks_query
        .filter(Task.due_date == today, Task.status != "Done")
        .order_by(Task.due_date.asc())
        .all()
    )

    this_week_tasks = (
        user_tasks_query
        .filter(
            Task.due_date >= today,
            Task.due_date <= week_end,
            Task.status != "Done",
        )
        .order_by(Task.due_date.asc())
        .all()
    )

    overdue_tasks = (
        user_tasks_query
        .filter(Task.due_date < today, Task.status != "Done")
        .order_by(Task.due_date.asc())
        .all()
    )

    all_tasks = user_tasks_query.all()
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

    todo_percentage = (
        round(todo_count / total_tasks * 100) if total_tasks else 0
    )
    in_progress_percentage = (
        round(in_progress_count / total_tasks * 100)
        if total_tasks else 0
    )
    done_percentage = (
        100 - todo_percentage - in_progress_percentage
        if total_tasks else 0
    )

    def serialize_task(task):
        return {
            "title": task.title,
            "course_title": task.course.title if task.course else "",
            "priority": task.priority,
            "due_date": (
                task.due_date.isoformat() if task.due_date else None
            ),
            "status": task.status,
        }

    def serialize_project(project):
        return {
            "name": project.name,
            "description": project.description,
            "status": project.status,
        }

    return {
        "total_notifications_count": total_notifications_count,
        "projects": [serialize_project(p) for p in projects],
        "upcoming_tasks": [serialize_task(t) for t in upcoming_tasks],
        "due_today_tasks": [serialize_task(t) for t in due_today_tasks],
        "this_week_tasks": [serialize_task(t) for t in this_week_tasks],
        "overdue_tasks": [serialize_task(t) for t in overdue_tasks],
        "upcoming_tasks_count": len(upcoming_tasks),
        "due_today_count": len(due_today_tasks),
        "todo_percentage": todo_percentage,
        "in_progress_percentage": in_progress_percentage,
        "done_percentage": done_percentage,
    }
