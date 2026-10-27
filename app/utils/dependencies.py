from fastapi import Depends, HTTPException, status, Query, WebSocketException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.database import get_db
from app.models.user import User
from app.models.course import Course
from app.utils.security import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception

    user_id = payload.get("sub")
    if user_id is None:
        raise credentials_exception

    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None:
        raise credentials_exception

    return user

def get_owned_course(
    course_id: int,
    current_user: User,
    db: Session
) -> Course:
    """Fetch a course only when it belongs to the authenticated user."""
    
    course = db.execute(select(Course).where(Course.id == course_id, Course.owner_id == current_user.id)).scalars().first()

    if course is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")

    return course

def get_current_user_ws(
    token: str = Query(...),  # token comes from ?token=... instead of the header
    db: Session = Depends(get_db),
) -> User:
    print("WS dependency reached")
    try:
        return get_current_user(token=token, db=db)  # reuse your existing logic as a normal function call
    except HTTPException:  # your function raises 401 for a bad token
        print("WS dependency reached")
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION)  # a WebSocket can't send a 401, so close with 1008