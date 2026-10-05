from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.course import Course
from app.models.user import User
from app.models.course_note import Note
from app.schemas.course_note import NoteResponse, NoteCreate, NoteUpdate
from app.utils.dependencies import get_current_user, get_owned_course
from sqlalchemy import select

router = APIRouter(prefix="/courses/{course_id}/notes", tags=["Course Notes"])

@router.post("/", response_model=NoteResponse, status_code=status.HTTP_201_CREATED)
def create_note(
    data: NoteCreate,
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Note:
    """Create a note within a course owned by the current user."""
    
    get_owned_course(course_id, current_user, db) 
    note = Note(**data.model_dump(), course_id = course_id)
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


@router.get("/", response_model=list[NoteResponse], status_code=status.HTTP_200_OK)
def get_notes(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> list[Note]:  
    """Return a course's notes with the newest notes first."""
    
    get_owned_course(course_id, current_user, db)
    notes = db.execute(select(Note).where(Note.course_id == course_id).order_by(Note.created_at.desc(), Note.id.desc())).scalars().all()
    return notes


@router.get("/{note_id}",  response_model=NoteResponse, status_code=status.HTTP_200_OK)
def get_note(
    course_id: int,
    note_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Note:
    """Return one note after confirming the course and note relationship."""
    
    get_owned_course(course_id, current_user, db)
    note = db.execute(select(Note).where(Note.course_id == course_id, Note.id == note_id)).scalars().first()
    if note is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
    return note


@router.patch("/{note_id}", response_model=NoteResponse)
def update_note(
    update_data: NoteUpdate,
    note_id: int,
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Note:   
    """Update the submitted note fields and return the saved note."""
    
    get_owned_course(course_id, current_user, db)
    note = db.execute(select(Note).where(Note.course_id == course_id, Note.id == note_id)).scalars().first()
    
    if note is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")

    data = update_data.model_dump(exclude_unset = True)
    for key, value in data.items():
        setattr(note, key, value)

    db.commit()
    db.refresh(note)
    return note


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_note(
    note_id: int,
    course_id: int,
    current_user: User= Depends(get_current_user),
    db: Session = Depends(get_db)
) -> None:
    """Delete a note after confirming course ownership."""
    
    get_owned_course(course_id, current_user, db)
    note = db.execute(select(Note).where(Note.id == note_id, Note.course_id == course_id)).scalars().first()

    if note is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")

    db.delete(note)
    db.commit()    




