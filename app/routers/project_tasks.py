from enum import Enum
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models.project import Project
from app.models.project_member import ProjectMember
from app.models.project_task import ProjectTask
from app.models.task_comment import TaskComment
from app.models.user import User
from app.services.notifications import add_project_notification
from app.schemas.project_tasks import (
    AssigneeOut,
    ProjectTaskCreate,
    ProjectTaskMove,
    ProjectTaskOut,
    ProjectTaskUpdate,
    TaskCommentCreate,
    TaskCommentOut,
)
from app.utils.dependencies import get_current_user

router = APIRouter(prefix="/api/projects/{project_id}", tags=["Project Tasks"])

DbSession = Annotated[Session, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]


def get_project_for_member(project_id: int, db: Session, user: User) -> Project:
    """Return the project if the user owns it or is a member, otherwise raise."""
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.owner_id == user.id:
        return project
    membership = db.execute(
        select(ProjectMember.id).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user.id,
        )
    ).first()
    if membership is None:
        raise HTTPException(status_code=403, detail="Not allowed")
    return project


def get_task_in_project(db: Session, project_id: int, task_id: int) -> ProjectTask:
    task = db.execute(
        select(ProjectTask).where(
            ProjectTask.id == task_id, ProjectTask.project_id == project_id
        )
    ).scalars().first()
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


def check_assignee(db: Session, project: Project, assignee_id: Optional[int]) -> None:
    """An assignee must be the project owner or a member of the project."""
    if assignee_id is None or assignee_id == project.owner_id:
        return
    membership = db.execute(
        select(ProjectMember.id).where(
            ProjectMember.project_id == project.id,
            ProjectMember.user_id == assignee_id,
        )
    ).first()
    if membership is None:
        raise HTTPException(
            status_code=400, detail="Assignee must be a member of this project"
        )


def next_position(db: Session, project_id: int, column: str) -> int:
    """Position that puts a task at the bottom of a column."""
    last = db.execute(
        select(func.max(ProjectTask.position)).where(
            ProjectTask.project_id == project_id, ProjectTask.status == column
        )
    ).scalar()
    return 0 if last is None else last + 1


def column_tasks(
    db: Session, project_id: int, column: str, exclude_id: int
) -> list[ProjectTask]:
    return list(
        db.execute(
            select(ProjectTask)
            .where(
                ProjectTask.project_id == project_id,
                ProjectTask.status == column,
                ProjectTask.id != exclude_id,
            )
            .order_by(ProjectTask.position, ProjectTask.id)
        )
        .scalars()
        .all()
    )


def renumber(tasks: list[ProjectTask]) -> None:
    for index, task in enumerate(tasks):
        task.position = index


def plain(value):
    return value.value if isinstance(value, Enum) else value


@router.get("/tasks", response_model=list[ProjectTaskOut])
def list_tasks(
    project_id: int,
    db: DbSession,
    current_user: CurrentUser,
    assignee_id: Optional[int] = None,
):
    get_project_for_member(project_id, db, current_user)
    stmt = (
        select(ProjectTask)
        .where(ProjectTask.project_id == project_id)
        .options(selectinload(ProjectTask.assignee), selectinload(ProjectTask.comments))
        .order_by(ProjectTask.position, ProjectTask.id)
    )
    if assignee_id is not None:
        stmt = stmt.where(ProjectTask.assignee_id == assignee_id)
    return db.execute(stmt).scalars().all()


@router.post(
    "/tasks", response_model=ProjectTaskOut, status_code=status.HTTP_201_CREATED
)
def create_task(
    project_id: int,
    task_in: ProjectTaskCreate,
    db: DbSession,
    current_user: CurrentUser,
):
    project = get_project_for_member(project_id, db, current_user)
    title = task_in.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Title is required")
    check_assignee(db, project, task_in.assignee_id)

    task = ProjectTask(
        project_id=project_id,
        title=title,
        description=task_in.description,
        priority=task_in.priority.value,
        status="To Do",
        position=next_position(db, project_id, "To Do"),
        due_date=task_in.due_date,
        assignee_id=task_in.assignee_id,
        created_by_id=current_user.id,
    )
    db.add(task)
    add_project_notification(
        db,
        project_id=project_id,
        user_id=task.assignee_id,
        actor_id=current_user.id,
        type="task_assigned",
        message=f'You were assigned to "{task.title}" in {project.name}.',
    )
    db.commit()
    db.refresh(task)
    return task


@router.patch("/tasks/{task_id}", response_model=ProjectTaskOut)
def update_task(
    project_id: int,
    task_id: int,
    task_in: ProjectTaskUpdate,
    db: DbSession,
    current_user: CurrentUser,
):
    project = get_project_for_member(project_id, db, current_user)
    task = get_task_in_project(db, project_id, task_id)
    data = task_in.model_dump(exclude_unset=True)
    previous_assignee_id = task.assignee_id
    previous_status = task.status

    if "title" in data and data["title"] is not None and not data["title"].strip():
        raise HTTPException(status_code=400, detail="Title is required")
    if "assignee_id" in data:
        check_assignee(db, project, data["assignee_id"])

    new_status = plain(data.pop("status", None))
    for key, value in data.items():
        # title and priority can never be empty; the other fields can be cleared
        if value is None and key in ("title", "priority"):
            continue
        value = plain(value)
        if key == "title":
            value = value.strip()
        setattr(task, key, value)

    if new_status and new_status != task.status:
        task.status = new_status
        task.position = next_position(db, project_id, new_status)

    if task.assignee_id != previous_assignee_id:
        add_project_notification(
            db,
            project_id=project_id,
            user_id=task.assignee_id,
            actor_id=current_user.id,
            type="task_assigned",
            message=f'You were assigned to "{task.title}" in {project.name}.',
        )
    if task.status != previous_status:
        message = (
            f'{current_user.full_name} moved "{task.title}" to '
            f"{task.status} in {project.name}."
        )
        for recipient_id in {task.created_by_id, task.assignee_id}:
            add_project_notification(
                db,
                project_id=project_id,
                user_id=recipient_id,
                actor_id=current_user.id,
                type="task_status_changed",
                message=message,
            )

    db.commit()
    db.refresh(task)
    return task


@router.patch("/tasks/{task_id}/move", response_model=ProjectTaskOut)
def move_task(
    project_id: int,
    task_id: int,
    move_in: ProjectTaskMove,
    db: DbSession,
    current_user: CurrentUser,
):
    project = get_project_for_member(project_id, db, current_user)
    task = get_task_in_project(db, project_id, task_id)

    old_status = task.status
    new_status = move_in.status.value

    destination = column_tasks(db, project_id, new_status, task.id)
    destination.insert(min(move_in.position, len(destination)), task)
    task.status = new_status
    renumber(destination)

    if old_status != new_status:
        renumber(column_tasks(db, project_id, old_status, task.id))
        message = (
            f'{current_user.full_name} moved "{task.title}" to '
            f"{new_status} in {project.name}."
        )
        for recipient_id in {task.created_by_id, task.assignee_id}:
            add_project_notification(
                db,
                project_id=project_id,
                user_id=recipient_id,
                actor_id=current_user.id,
                type="task_status_changed",
                message=message,
            )

    db.commit()
    db.refresh(task)
    return task


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    project_id: int,
    task_id: int,
    db: DbSession,
    current_user: CurrentUser,
):
    project = get_project_for_member(project_id, db, current_user)
    task = get_task_in_project(db, project_id, task_id)

    # only the task creator or the project owner may delete a task
    if task.created_by_id != current_user.id and project.owner_id != current_user.id:
        raise HTTPException(
            status_code=403, detail="Only the task creator or project owner can delete this task"
        )

    db.delete(task)
    db.commit()


@router.get("/tasks/{task_id}/comments", response_model=list[TaskCommentOut])
def list_comments(
    project_id: int,
    task_id: int,
    db: DbSession,
    current_user: CurrentUser,
):
    get_project_for_member(project_id, db, current_user)
    get_task_in_project(db, project_id, task_id)
    return (
        db.execute(
            select(TaskComment)
            .where(TaskComment.task_id == task_id)
            .options(selectinload(TaskComment.user))
            .order_by(TaskComment.created_at, TaskComment.id)
        )
        .scalars()
        .all()
    )


@router.post(
    "/tasks/{task_id}/comments",
    response_model=TaskCommentOut,
    status_code=status.HTTP_201_CREATED,
)
def create_comment(
    project_id: int,
    task_id: int,
    comment_in: TaskCommentCreate,
    db: DbSession,
    current_user: CurrentUser,
):
    project = get_project_for_member(project_id, db, current_user)
    task = get_task_in_project(db, project_id, task_id)

    content = comment_in.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Comment cannot be empty")

    comment = TaskComment(task_id=task.id, user_id=current_user.id, content=content)
    db.add(comment)
    message = (
        f'{current_user.full_name} commented on "{task.title}" '
        f"in {project.name}."
    )
    for recipient_id in {task.created_by_id, task.assignee_id}:
        add_project_notification(
            db,
            project_id=project_id,
            user_id=recipient_id,
            actor_id=current_user.id,
            type="task_commented",
            message=message,
        )
    db.commit()
    db.refresh(comment)
    return comment


# ---------- people who can be assigned ----------
@router.get("/assignees", response_model=list[AssigneeOut])
def list_assignees(project_id: int, db: DbSession, current_user: CurrentUser):
    project = get_project_for_member(project_id, db, current_user)
    member_ids = select(ProjectMember.user_id).where(
        ProjectMember.project_id == project_id
    )
    return (
        db.execute(
            select(User)
            .where(or_(User.id == project.owner_id, User.id.in_(member_ids)))
            .order_by(User.full_name)
        )
        .scalars()
        .all()
    )