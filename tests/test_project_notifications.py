import os

os.environ.setdefault("DATABASE_URL", "sqlite://")

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.models import (  # noqa: F401
    chat,
    course,
    course_note,
    course_task,
    notification,
    project,
    project_member,
    project_task,
    task_comment,
    user,
)
from app.models.notification import Notification
from app.models.project import Project
from app.models.project_member import ProjectMember
from app.models.user import User
from app.routers.project_notifications import (
    get_project_unread_count,
    list_project_notifications,
    mark_all_project_notifications_read,
    mark_project_notification_read,
)
from app.routers.project_tasks import (
    create_comment,
    create_task,
    move_task,
    update_task,
)
from app.schemas.project_tasks import (
    ProjectTaskCreate,
    ProjectTaskMove,
    ProjectTaskUpdate,
    TaskCommentCreate,
    TaskStatus,
)


@pytest.fixture
def notification_context():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def enable_foreign_keys(connection, _):
        cursor = connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(engine)

    with Session(engine) as db:
        owner = User(
            full_name="Owner",
            email="owner@example.com",
            password_hash="hash",
        )
        member = User(
            full_name="Member",
            email="member@example.com",
            password_hash="hash",
        )
        outsider = User(
            full_name="Outsider",
            email="outsider@example.com",
            password_hash="hash",
        )
        db.add_all([owner, member, outsider])
        db.flush()

        project = Project(
            name="Group project",
            type="Group",
            status="Ongoing",
            owner_id=owner.id,
        )
        db.add(project)
        db.flush()
        db.add(ProjectMember(project_id=project.id, user_id=member.id, role="Member"))
        db.commit()
        yield db, owner, member, outsider, project

    Base.metadata.drop_all(engine)
    engine.dispose()


def test_assigning_project_task_creates_assignee_notification(notification_context):
    db, owner, member, _, project = notification_context

    task = create_task(
        project.id,
        ProjectTaskCreate(title="Write docs", assignee_id=member.id),
        db,
        owner,
    )

    notification = db.query(Notification).filter_by(user_id=member.id).one()
    assert task.title == "Write docs"
    assert notification.project_id == project.id
    assert notification.type == "task_assigned"
    assert notification.is_read is False
    assert "Write docs" in notification.message


def test_task_status_and_comments_notify_relevant_project_members(notification_context):
    db, owner, member, _, project = notification_context
    task = create_task(
        project.id,
        ProjectTaskCreate(title="Write docs", assignee_id=member.id),
        db,
        owner,
    )

    update_task(
        project.id,
        task.id,
        ProjectTaskUpdate(status=TaskStatus.done),
        db,
        owner,
    )
    create_comment(
        project.id,
        task.id,
        TaskCommentCreate(content="I finished the draft."),
        db,
        member,
    )

    notifications = (
        db.query(Notification)
        .filter_by(project_id=project.id)
        .order_by(Notification.id)
        .all()
    )
    assert [(item.user_id, item.type) for item in notifications] == [
        (member.id, "task_assigned"),
        (member.id, "task_status_changed"),
        (owner.id, "task_commented"),
    ]


def test_drag_and_drop_task_move_creates_notification(notification_context):
    db, owner, member, _, project = notification_context
    task = create_task(
        project.id,
        ProjectTaskCreate(title="Write docs", assignee_id=member.id),
        db,
        owner,
    )

    move_task(
        project.id,
        task.id,
        ProjectTaskMove(status=TaskStatus.doing, position=0),
        db,
        owner,
    )

    notifications = (
        db.query(Notification)
        .filter_by(user_id=member.id, project_id=project.id)
        .order_by(Notification.id)
        .all()
    )
    assert [item.type for item in notifications] == [
        "task_assigned",
        "task_status_changed",
    ]
    assert "Doing" in notifications[-1].message


def test_project_notifications_are_private_and_can_be_marked_read(notification_context):
    db, owner, member, outsider, project = notification_context
    first = Notification(
        user_id=member.id,
        project_id=project.id,
        type="task_assigned",
        message="Task assigned",
        is_read=False,
    )
    second = Notification(
        user_id=owner.id,
        project_id=project.id,
        type="task_commented",
        message="New comment",
        is_read=False,
    )
    db.add_all([first, second])
    db.commit()

    result = list_project_notifications(project.id, db, member)
    assert result["unread_count"] == 1
    assert get_project_unread_count(project.id, db, member)["unread_count"] == 1
    assert [item["id"] for item in result["notifications"]] == [first.id]

    with pytest.raises(HTTPException) as other_users_notification:
        mark_project_notification_read(project.id, second.id, db, member)
    assert other_users_notification.value.status_code == 404

    marked = mark_project_notification_read(project.id, first.id, db, member)
    assert marked.is_read is True
    assert list_project_notifications(project.id, db, member)["unread_count"] == 0

    with pytest.raises(HTTPException) as forbidden:
        list_project_notifications(project.id, db, outsider)
    assert forbidden.value.status_code == 403


def test_mark_all_reads_only_current_users_project_notifications(notification_context):
    db, owner, member, _, project = notification_context
    own = Notification(
        user_id=member.id,
        project_id=project.id,
        type="task_assigned",
        message="Task assigned",
        is_read=False,
    )
    other_user = Notification(
        user_id=owner.id,
        project_id=project.id,
        type="task_commented",
        message="New comment",
        is_read=False,
    )
    db.add_all([own, other_user])
    db.commit()

    mark_all_project_notifications_read(project.id, db, member)

    assert db.get(Notification, own.id).is_read is True
    assert db.get(Notification, other_user.id).is_read is False


def test_project_notifications_are_deleted_with_the_project(notification_context):
    db, owner, member, _, project = notification_context
    notification = Notification(
        user_id=member.id,
        project_id=project.id,
        type="task_assigned",
        message="Task assigned",
        is_read=False,
    )
    db.add(notification)
    db.commit()
    notification_id = notification.id

    db.delete(project)
    db.commit()

    assert db.get(Notification, notification_id) is None


def test_project_notification_message_is_limited_to_column_length(notification_context):
    from app.services.notifications import add_project_notification

    db, owner, member, _, project = notification_context
    add_project_notification(
        db,
        project_id=project.id,
        user_id=member.id,
        actor_id=owner.id,
        type="task_status_changed",
        message="x" * 300,
    )
    db.flush()

    notification = db.query(Notification).filter_by(user_id=member.id).one()
    assert len(notification.message) == 255


def test_project_notification_list_is_limited_to_latest_100(notification_context):
    db, _, member, _, project = notification_context
    db.add_all(
        [
            Notification(
                user_id=member.id,
                project_id=project.id,
                type="task_assigned",
                message=f"Notification {index}",
                is_read=False,
            )
            for index in range(105)
        ]
    )
    db.commit()

    result = list_project_notifications(project.id, db, member)

    assert len(result["notifications"]) == 100
    assert result["unread_count"] == 105
