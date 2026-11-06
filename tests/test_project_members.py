from app.models.project import Project
from app.models.project_member import ProjectMember
from app.models.user import User


def test_project_owner_can_view_members(client, db_session, test_user):
    # Create a project owned by the test user
    project = Project(
        name="Test Project",
        description="Project for testing",
        type="Group",
        status="Ongoing",
        owner_id=test_user.id,
    )
    db_session.add(project)
    db_session.commit()
    db_session.refresh(project)

    # Create another user
    member = User(
        full_name="Second User",
        email="second@example.com",
        password_hash="test-password",
    )
    db_session.add(member)
    db_session.commit()
    db_session.refresh(member)

    # Add the second user as a project member
    membership = ProjectMember(
        project_id=project.id,
        user_id=member.id,
        role="Developer",
    )
    db_session.add(membership)
    db_session.commit()

    # Request the project members
    response = client.get(
        f"/api/projects/{project.id}/members"
    )

    assert response.status_code == 200

    members = response.json()

    assert len(members) == 1
    assert members[0]["user_id"] == member.id
    assert members[0]["full_name"] == "Second User"
    assert members[0]["role"] == "Developer"


def test_non_member_cannot_view_project_members(
    client, db_session, test_user
):
    # Create a project owned by another user
    owner = User(
        full_name="Project Owner",
        email="owner@example.com",
        password_hash="test-password",
    )
    db_session.add(owner)
    db_session.commit()
    db_session.refresh(owner)

    project = Project(
        name="Private Project",
        description="Private test project",
        type="Group",
        status="Ongoing",
        owner_id=owner.id,
    )
    db_session.add(project)
    db_session.commit()
    db_session.refresh(project)

    # The current test user is not a member
    response = client.get(
        f"/api/projects/{project.id}/members"
    )

    assert response.status_code == 403


def test_member_can_update_own_role(client, db_session, test_user):
    project = Project(
        name="Role Test Project",
        description="Testing role updates",
        type="Group",
        status="Ongoing",
        owner_id=test_user.id,
    )
    db_session.add(project)
    db_session.commit()
    db_session.refresh(project)

    membership = ProjectMember(
        project_id=project.id,
        user_id=test_user.id,
        role="Developer",
    )
    db_session.add(membership)
    db_session.commit()

    response = client.put(
        f"/api/projects/{project.id}/members/me/role",
        params={"new_role": "Designer"},
    )

    assert response.status_code == 200
    assert response.json()["role"] == "Designer"

    db_session.refresh(membership)
    assert membership.role == "Designer"


def test_member_cannot_select_invalid_role(
    client, db_session, test_user
):
    project = Project(
        name="Invalid Role Test",
        description="Testing invalid roles",
        type="Group",
        status="Ongoing",
        owner_id=test_user.id,
    )
    db_session.add(project)
    db_session.commit()
    db_session.refresh(project)

    membership = ProjectMember(
        project_id=project.id,
        user_id=test_user.id,
        role="Developer",
    )
    db_session.add(membership)
    db_session.commit()

    response = client.put(
        f"/api/projects/{project.id}/members/me/role",
        params={"new_role": "Pilot"},
    )

    assert response.status_code == 400
def test_project_owner_can_remove_member(client, db_session, test_user):
    project = Project(
        name="Remove Member Test",
        description="Testing member removal",
        type="Group",
        status="Ongoing",
        owner_id=test_user.id,
    )
    db_session.add(project)
    db_session.commit()
    db_session.refresh(project)

    member = User(
        full_name="Member To Remove",
        email="remove@example.com",
        password_hash="test-password",
    )
    db_session.add(member)
    db_session.commit()
    db_session.refresh(member)

    membership = ProjectMember(
        project_id=project.id,
        user_id=member.id,
        role="Developer",
    )
    db_session.add(membership)
    db_session.commit()

    response = client.delete(
        f"/api/projects/{project.id}/members/{member.id}"
    )

    assert response.status_code == 200

    remaining = db_session.query(ProjectMember).filter_by(
        project_id=project.id,
        user_id=member.id,
    ).first()

    assert remaining is None


def test_non_owner_cannot_remove_member(client, db_session, test_user):
    owner = User(
        full_name="Actual Owner",
        email="actualowner@example.com",
        password_hash="test-password",
    )
    db_session.add(owner)
    db_session.commit()
    db_session.refresh(owner)

    project = Project(
        name="Protected Project",
        description="Testing owner permissions",
        type="Group",
        status="Ongoing",
        owner_id=owner.id,
    )
    db_session.add(project)
    db_session.commit()
    db_session.refresh(project)

    member = User(
        full_name="Another Member",
        email="another@example.com",
        password_hash="test-password",
    )
    db_session.add(member)
    db_session.commit()
    db_session.refresh(member)

    db_session.add_all([
        ProjectMember(
            project_id=project.id,
            user_id=test_user.id,
            role="Developer",
        ),
        ProjectMember(
            project_id=project.id,
            user_id=member.id,
            role="Developer",
        ),
    ])
    db_session.commit()

    response = client.delete(
        f"/api/projects/{project.id}/members/{member.id}"
    )

    assert response.status_code == 403

def test_project_owner_can_transfer_ownership(
    client, db_session, test_user
):
    # Create a project owned by the test user
    project = Project(
        name="Ownership Transfer Test",
        description="Testing ownership transfer",
        type="Group",
        status="Ongoing",
        owner_id=test_user.id,
    )
    db_session.add(project)
    db_session.commit()
    db_session.refresh(project)

    # Create an existing project member
    new_owner = User(
        full_name="New Project Owner",
        email="newowner@example.com",
        password_hash="test-password",
    )
    db_session.add(new_owner)
    db_session.commit()
    db_session.refresh(new_owner)

    membership = ProjectMember(
        project_id=project.id,
        user_id=new_owner.id,
        role="Designer",
    )
    db_session.add(membership)
    db_session.commit()

    # Transfer ownership to the existing member
    response = client.put(
        f"/api/projects/{project.id}/transfer-ownership/{new_owner.id}"
    )

    assert response.status_code == 200
    assert response.json()["new_owner_id"] == new_owner.id

    # Confirm that the new owner is now the project owner
    db_session.refresh(project)
    assert project.owner_id == new_owner.id

    # Confirm that the previous owner remains a member
    previous_owner_membership = db_session.query(
        ProjectMember
    ).filter_by(
        project_id=project.id,
        user_id=test_user.id,
    ).first()

    assert previous_owner_membership is not None
    assert previous_owner_membership.role == "Developer"

    # Confirm that the new owner remains a project member
    assert membership is not None
    assert membership.role == "Designer"


def test_non_owner_cannot_transfer_ownership(
    client, db_session, test_user
):
    # Create another user who owns the project
    owner = User(
        full_name="Actual Project Owner",
        email="transferowner@example.com",
        password_hash="test-password",
    )
    db_session.add(owner)
    db_session.commit()
    db_session.refresh(owner)

    # Create a project owned by that user
    project = Project(
        name="Protected Transfer Project",
        description="Testing transfer permissions",
        type="Group",
        status="Ongoing",
        owner_id=owner.id,
    )
    db_session.add(project)
    db_session.commit()
    db_session.refresh(project)

    # Add the current test user as a project member
    # Also add another member as the proposed new owner
    new_owner = User(
        full_name="Another Member",
        email="anothertransfer@example.com",
        password_hash="test-password",
    )
    db_session.add(new_owner)
    db_session.commit()
    db_session.refresh(new_owner)

    db_session.add_all([
        ProjectMember(
            project_id=project.id,
            user_id=test_user.id,
            role="Developer",
        ),
        ProjectMember(
            project_id=project.id,
            user_id=new_owner.id,
            role="Designer",
        ),
    ])
    db_session.commit()

    # A normal member tries to transfer ownership
    response = client.put(
        f"/api/projects/{project.id}/transfer-ownership/{new_owner.id}"
    )

    assert response.status_code == 403

    # Confirm that the original owner is unchanged
    db_session.refresh(project)
    assert project.owner_id == owner.id

def test_owner_cannot_transfer_to_non_member(
    client, db_session, test_user
):
    project = Project(
        name="Non Member Transfer Test",
        description="Testing transfer to non-member",
        type="Group",
        status="Ongoing",
        owner_id=test_user.id,
    )
    db_session.add(project)
    db_session.commit()
    db_session.refresh(project)

    non_member = User(
        full_name="Non Member",
        email="nonmember@example.com",
        password_hash="test-password",
    )
    db_session.add(non_member)
    db_session.commit()
    db_session.refresh(non_member)

    response = client.put(
        f"/api/projects/{project.id}/transfer-ownership/{non_member.id}"
    )

    assert response.status_code == 404
    assert response.json()["detail"] == (
        "The new owner must already be a project member"
    )

    db_session.refresh(project)
    assert project.owner_id == test_user.id