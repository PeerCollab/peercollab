from app.routers import (
    auth,
    dashboard,
    course,
    course_note,
    course_task,
    projects,
    chat,
    project_members,
    project_tasks,
)

from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from fastapi import FastAPI, Request
from pathlib import Path

app = FastAPI(debug=True)

BASE_DIR = Path(__file__).resolve().parent.parent

app.include_router(auth.router)
app.include_router(dashboard.router)
app.include_router(course.router)
app.include_router(course_note.router)
app.include_router(course_task.router)
app.include_router(projects.router)
app.include_router(chat.router)
app.include_router(project_members.router)
app.include_router(project_tasks.router)

app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")

templates = Jinja2Templates(directory=BASE_DIR / "templates")


@app.get("/")
def preview(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="base.html",
        context={
            "active_page": "dashboard",
            "page_title": "Dashboard"
        }
    )