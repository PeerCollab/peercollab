from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.course import Course
from app.models.user import User
from app.models.course_task import Task
from app.schemas.course_task import TaskResponse, TaskCreate, TaskUpdate
from app.utils.dependencies import get_current_user, get_owned_course
from sqlalchemy import select

router = APIRouter(prefix="/courses/{course_id}/tasks", tags=["Course Tasks"])

@router.post("/", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
def create_task(
    data: TaskCreate,
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Task:
    """Create a task within a course owned by the current user."""
    
    get_owned_course(course_id, current_user, db)
    
    task = Task(**data.model_dump(), course_id = course_id)

    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.get("/", response_model=list[TaskResponse], status_code=status.HTTP_200_OK)
def get_tasks(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> list[Task]:  
    """Return a course's tasks with the newest tasks first."""
    
    get_owned_course(course_id, current_user, db)
    tasks = db.execute(select(Task).where(Task.course_id == course_id).order_by(Task.created_at.desc())).scalars().all()
    return tasks


@router.get("/{task_id}",  response_model=TaskResponse, status_code=status.HTTP_200_OK)
def get_task(
    course_id: int,
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Task:
    """Return one task after confirming the course and task relationship."""
    
    get_owned_course(course_id, current_user, db)
    task = db.execute(select(Task).where(Task.course_id == course_id, Task.id == task_id)).scalars().first()
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return task


@router.patch("/{task_id}", response_model=TaskResponse)
def update_task(
    update_data: TaskUpdate,
    task_id: int,
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Task:   
    """Update the submitted task fields and return the saved task."""
    
    get_owned_course(course_id, current_user, db)
    task = db.execute(select(Task).where(Task.course_id == course_id, Task.id == task_id)).scalars().first()
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    data = update_data.model_dump(exclude_unset = True)
    for key, value in data.items():
        setattr(task, key, value)

    db.commit()
    db.refresh(task)
    return task


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    task_id: int,
    course_id: int,
    current_user: User= Depends(get_current_user),
    db: Session = Depends(get_db)
) -> None:
    """Delete a task after confirming course ownership."""
    
    get_owned_course(course_id, current_user, db)
    task = db.execute(select(Task).where(Task.id == task_id, Task.course_id == course_id)).scalars().first()

    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    db.delete(task)
    db.commit()    




