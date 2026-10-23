import secrets
import string
from pathlib import Path
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.project import Project
from app.models.user import User
# "error"
from app.schemas.projects import ProjectCreate, ProjectOut, ProjectUpdate
from app.utils.dependencies import get_current_user

router = APIRouter(tags=["Projects"])
BASE_DIR = Path(__file__).resolve().parent.parent.parent
templates = Jinja2Templates(directory=BASE_DIR / "templates")


def generate_invite_code(db: Session) -> str:
    alphabet = string.ascii_uppercase + string.digits
    while True:
        code = "".join(secrets.choice(alphabet) for _ in range(8))
        if not db.query(Project).filter(Project.invite_code == code).first():
            return code


def get_owned_project(project_id: int, db: Session, user: User) -> Project:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not allowed")
    return project


# ---------- PAGES (HTML) ----------
@router.get("/projects", response_class=HTMLResponse)
def projects_page(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="project/projects.html",
        context={
            "active_page": "projects",
            "page_title": "Projects",
            "solid": "btn btn-primary",
            "field": "form-input",
        },
    )


@router.get("/projects/new", response_class=HTMLResponse)
def create_project_page(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="project/create_project.html",
        context={"active_page": "projects", "page_title": "Create Project"},
    )


@router.get("/projects/{project_id:int}/edit", response_class=HTMLResponse)
def edit_project_page(request: Request, project_id: int):
    return templates.TemplateResponse(
        request=request,
        name="project/settings.html",
        context={
            "active_page": "projects",
            "page_title": "Project settings",
            "project_id": project_id,
        },
    )


@router.get("/projects/{project_id:int}", response_class=HTMLResponse)
def project_workspace_page(request: Request, project_id: int, tab: str = "overview"):
    page_by_tab = {
        "overview": "project/overview.html",
        "kanban": "project/kanban.html",
        "chat": "project/chat.html",
        "files": "project/files.html",
        "members": "project/members.html",
    }
    page = page_by_tab.get(tab)
    if page is None:
        raise HTTPException(status_code=404, detail="Project section not found")

    return templates.TemplateResponse(
        request=request,
        name=page,
        context={
            "active_page": "projects",
            "active_tab": tab,
            "page_title": "Project workspace",
            "project_id": project_id,
        },
    )


# ---------- API (JSON) ----------
@router.post("/api/projects", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(
    project_in: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = Project(
        name=project_in.name,
        description=project_in.description,
        type=project_in.type,
        status="Ongoing",
        deadline=project_in.deadline,
        owner_id=current_user.id,
        invite_code=generate_invite_code(
            db) if project_in.type == "Group" else None,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.get("/api/projects", response_model=List[ProjectOut])
def get_my_projects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(Project)
        .filter(Project.owner_id == current_user.id)
        .order_by(Project.created_at.desc())
        .all()
    )


@router.get("/api/projects/{project_id}", response_model=ProjectOut)
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_owned_project(project_id, db, current_user)


@router.patch("/api/projects/{project_id}", response_model=ProjectOut)
def update_project(
    project_id: int,
    project_in: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = get_owned_project(project_id, db, current_user)
    data = project_in.model_dump(exclude_unset=True)
    for key, value in data.items():
        if value is None and key in ("name", "status", "type"):
            continue
        setattr(project, key, value)

    # Keep the invite code in step with the project type
    if project.type == "Group" and not project.invite_code:
        project.invite_code = generate_invite_code(db)
    if project.type == "Solo":
        project.invite_code = None

    db.commit()
    db.refresh(project)
    return project


@router.delete("/api/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = get_owned_project(project_id, db, current_user)
    db.delete(project)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
