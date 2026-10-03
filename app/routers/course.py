from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import HTMLResponse, Response
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.course import Course
from app.models.user import User
from app.schemas.course import CourseResponse, CourseCreate, CourseUpdate
from app.utils.dependencies import get_current_user
from sqlalchemy.exc import IntegrityError
from sqlalchemy import select

router = APIRouter(prefix="/courses", tags=["Courses"])
BASE_DIR = Path(__file__).resolve().parent.parent.parent
templates = Jinja2Templates(directory=BASE_DIR / "templates")

@router.get("", response_class=HTMLResponse, include_in_schema=False)
def courses_page(request: Request) -> Response:
    """Render the course list page."""

    return templates.TemplateResponse(
        request=request,
        name="courses/index.html",
        context={"active_page": "courses", "page_title": "Courses"},
    )


@router.get("/new", response_class=HTMLResponse, include_in_schema=False)
def new_course_page(request: Request) -> Response:
    """Render the course creation form."""

    return templates.TemplateResponse(
        request=request,
        name="courses/form.html",
        context={"active_page": "courses", "form_mode": "create", "page_title": "Create course"},
    )


@router.get("/{course_id}/edit", response_class=HTMLResponse, include_in_schema=False)
def edit_course_page(request: Request, course_id: int) -> Response:
    """Render the course edit form for the selected course."""

    return templates.TemplateResponse(
        request=request,
        name="courses/form.html",
        context={"active_page": "courses", "course_id": course_id, "form_mode": "edit", "page_title": "Edit course"},
    )


@router.get("/{course_id}/page", response_class=HTMLResponse, include_in_schema=False)
def course_detail_page(request: Request, course_id: int) -> Response:
    """Render the detail page for a selected course."""

    return templates.TemplateResponse(
        request=request,
        name="courses/detail.html",
        context={"active_page": "courses", "course_id": course_id},
    )


def get_course_or_404(
    course_id: int, 
    db : Session
) -> Course:
    """Fetch a course or raise a 404 when it does not exist."""

    course = db.execute(select(Course).where(Course.id == course_id)).scalar_one_or_none()
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found")
    else:
        return course    


@router.post("/", response_model=CourseResponse, status_code=status.HTTP_201_CREATED)
def create_course(
    data: CourseCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Course:
    """Create a course owned by the authenticated user."""

    course = Course(**data.model_dump(), owner_id=current_user.id)
    db.add(course)
    try:
        db.commit()
        db.refresh(course)
    except IntegrityError:
        # Roll back before returning so the session can be reused safely.
        db.rollback()
        raise HTTPException(status_code=409, detail="You already have a course with this title")
    
    return course


@router.get("/", response_model=list[CourseResponse])
def list_courses(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> list[Course]:
    """Return the user's courses with the newest courses first."""

    my_courses = db.execute(select(Course).where(Course.owner_id == current_user.id).order_by(Course.created_at.desc())).scalars().all()
    
    return my_courses  


@router.get("/{course_id}", response_model=CourseResponse)
def get_course(
    course_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Course:    
    """Return one course after verifying that the user owns it."""

    course = get_course_or_404(course_id, db)
    if course.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view this course")
    
    return course


@router.patch("/{course_id}", response_model=CourseResponse)
def update_course(
    course_id: int,
    update_data: CourseUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Course:      
    """Apply supplied course fields and return the updated course."""

    course = get_course_or_404(course_id, db)
    if course.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to update this course")
    
    data = update_data.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(course, key, value)

    try:
        db.commit()
        db.refresh(course)
    except IntegrityError:
        # A duplicate title leaves the transaction unusable until rolled back.
        db.rollback()
        raise HTTPException(status_code=409, detail="You already have a course with this title")
    
    return course    


@router.delete("/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_course(
    course_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> None:      
    """Delete a course after verifying ownership."""

    course = get_course_or_404(course_id, db)
    if course.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this course")
    
    db.delete(course)
    db.commit()
