import os

os.environ.setdefault("DATABASE_URL", "sqlite://")

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.models import (
    chat,
    course,
    course_note,
    course_task,
    project,
    project_member,
    project_task,
    task_comment,
    user,
)  # noqa: F401
from app.models.project import Project
from app.models.project_member import ProjectMember
from app.models.user import User
from app.routers.projects import (
    create_project,
    get_my_projects,
    get_project_for_member,
    join_project,
)
from app.schemas.projects import ProjectCreate, ProjectJoin


@pytest.fixture
def project_context():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
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
            invite_code="AB12CD34",
        )
        db.add(project)
        db.commit()
        yield db, owner, member, outsider, project

    Base.metadata.drop_all(engine)
    engine.dispose()


def test_create_project_adds_owner_as_member(project_context):
    db, owner, _, _, _ = project_context

    created = create_project(
        ProjectCreate(
            name="New project",
            description="A project created by the owner",
            type="Group",
            deadline=None,
        ),
        db,
        owner,
    )

    membership = (
        db.query(ProjectMember)
        .filter_by(project_id=created.id, user_id=owner.id)
        .one()
    )
    assert membership.role == "Owner"


def test_join_project_adds_membership_and_lists_project(project_context):
    db, owner, member, _, project = project_context

    joined_project = join_project(ProjectJoin(invite_code="ab12cd34"), db, member)

    assert joined_project.id == project.id
    membership = (
        db.query(ProjectMember)
        .filter_by(project_id=project.id, user_id=member.id)
        .one()
    )
    assert membership.role == "Member"

    member_projects = get_my_projects(db, member)
    assert len(member_projects) == 1
    assert member_projects[0]["id"] == project.id
    assert member_projects[0]["is_owner"] is False
    assert get_my_projects(db, owner)[0]["is_owner"] is True
    assert get_project_for_member(project.id, db, member).id == project.id


def test_join_project_rejects_invalid_and_duplicate_codes(project_context):
    db, _, member, _, _ = project_context

    with pytest.raises(HTTPException) as invalid_code:
        join_project(ProjectJoin(invite_code="ZZ99YY88"), db, member)
    assert invalid_code.value.status_code == 404

    join_project(ProjectJoin(invite_code="AB12CD34"), db, member)
    with pytest.raises(HTTPException) as duplicate_join:
        join_project(ProjectJoin(invite_code="AB12CD34"), db, member)
    assert duplicate_join.value.status_code == 409


def test_nonmember_cannot_read_project(project_context):
    db, _, _, outsider, project = project_context

    with pytest.raises(HTTPException) as forbidden:
        get_project_for_member(project.id, db, outsider)
    assert forbidden.value.status_code == 403
