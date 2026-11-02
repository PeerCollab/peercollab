from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.utils.dependencies import get_current_user_ws  
from app.models.user import User
from app.models.project import Project  
from app.models.project_member import ProjectMember  
from app.services.chat_service import get_last_messages, save_message
from app.services.connection_manager import manager

router = APIRouter()

MAX_MESSAGE_LENGTH = 2000  # reject messages longer than this


@router.websocket("/ws/projects/{project_id}")  
async def project_chat(
    websocket: WebSocket,
    project_id: int,
    user: User = Depends(get_current_user_ws),  # CHECK 1: valid token and real user (closes with 1008 if not)
    db: Session = Depends(get_db),  
):
    project = db.execute(
        select(Project).where(Project.id == project_id)
    ).scalars().first()  # CHECK 2: does the project exist?
    if project is None:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    membership = db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id, 
            ProjectMember.user_id == user.id,  
        )
    ).scalars().first()  # CHECK 3: is the user a member?
    if membership is None:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await manager.connect(project_id, websocket)  # accept the socket and add it to the project's room
    history = get_last_messages(db, project_id, 100)  
    await websocket.send_json(  
        {
            "type": "history",
            "messages": [m.model_dump(mode="json") for m in history],  # mode="json" makes datetime a string
        }
    )

    try:
        while True:  # keep listening until the user disconnects
            data = (await websocket.receive_text()).strip()
            if not data or len(data) > MAX_MESSAGE_LENGTH:
                continue

            message = save_message(db, project_id, user, data)
            await manager.broadcast(  # send to everyone in this project, including the sender
                project_id,
                {"type": "message", "message": message.model_dump(mode="json")},
            )
    except WebSocketDisconnect:  # tab closed or connection lost
        manager.disconnect(project_id, websocket)