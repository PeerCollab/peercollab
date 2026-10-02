from pathlib import Path
from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

router = APIRouter(tags=["Projects"])
BASE_DIR = Path(__file__).resolve().parent.parent.parent
templates = Jinja2Templates(directory=BASE_DIR / "templates")


@router.get("/projects/new", response_class=HTMLResponse)
def create_project_page(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="create_project.html",
        context={
            "active_page": "projects",
            "page_title": "Create Project",
        },
    )
