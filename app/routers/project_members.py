from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.project import Project
from app.models.project_member import ProjectMember
from app.models.user import User
from app.utils.dependencies import get_current_user


router = APIRouter(tags=["Project Members"])


@router.get("/api/projects/{project_id}/members")
def get_project_members(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Check whether the project exists
    project = db.query(Project).filter(
        Project.id == project_id
    ).first()

    if not project:
        raise HTTPException(
            status_code=404,
            detail="Project not found",
        )

    # Check whether the current user is the owner
    is_owner = project.owner_id == current_user.id

    # Check whether the current user is a project member
    membership = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == current_user.id,
    ).first()

    if not is_owner and not membership:
        raise HTTPException(
            status_code=403,
            detail="You are not a member of this project",
        )

    # Retrieve the project owner
    owner = db.query(User).filter(
        User.id == project.owner_id
    ).first()

    # Retrieve all project members except the owner
    members = (
        db.query(ProjectMember, User)
        .join(User, ProjectMember.user_id == User.id)
        .filter(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id != project.owner_id,
        )
        .all()
    )

    return {
        "current_user_id": current_user.id,
        "project_type": project.type,
        "invite_code": project.invite_code if is_owner else None,
        "owner": {
            "user_id": owner.id,
            "full_name": owner.full_name,
            "email": owner.email,
            "role": "Owner",
            "is_owner": True,
            "joined_at": None,
        },
        "members": [
            {
                "user_id": member.user_id,
                "full_name": user.full_name,
                "email": user.email,
                "role": member.role,
                "is_owner": False,
                "joined_at": member.joined_at,
            }
            for member, user in members
        ],
    }

@router.put("/api/projects/{project_id}/members/me/role")
def update_my_project_role(
    project_id: int,
    new_role: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Check whether the project exists
    project = db.query(Project).filter(
        Project.id == project_id
    ).first()

    if not project:
        raise HTTPException(
            status_code=404,
            detail="Project not found",
        )

    # Check whether the current user is a project member
    membership = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == current_user.id,
    ).first()

    if not membership:
        raise HTTPException(
            status_code=403,
            detail="Only project members can update their roles",
        )

    # Allowed project roles
    allowed_roles = [
        "Developer",
        "Designer",
        "Researcher",
        "Tester",
        "Project Manager",
        "Other",
    ]

    if new_role not in allowed_roles:
        raise HTTPException(
            status_code=400,
            detail="Invalid role. Please select an allowed project role.",
        )

    # Update the member's role
    membership.role = new_role
    db.commit()
    db.refresh(membership)

    return {
        "message": "Your project role was updated successfully",
        "user_id": current_user.id,
        "project_id": project_id,
        "role": membership.role,
    }

@router.put("/api/projects/{project_id}/members/{member_user_id}/role")
def update_member_role(
    project_id: int,
    member_user_id: int,
    new_role: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Find the project
    project = db.query(Project).filter(
        Project.id == project_id
    ).first()

    if not project:
        raise HTTPException(
            status_code=404,
            detail="Project not found",
        )

    # Only the Group Leader can change another member's role
    if project.owner_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="Only the Group Leader can change other members' roles",
        )

    if project.type != "Group":
        raise HTTPException(
            status_code=400,
            detail="This action is only available for Group projects",
        )

    allowed_roles = [
        "Developer",
        "Designer",
        "Researcher",
        "Tester",
        "Project Manager",
        "Other",
    ]

    if new_role not in allowed_roles:
        raise HTTPException(
            status_code=400,
            detail="Invalid project role",
        )

    # Find the target member
    membership = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == member_user_id,
    ).first()

    if not membership:
        raise HTTPException(
            status_code=404,
            detail="Project member not found",
        )

    membership.role = new_role

    db.commit()
    db.refresh(membership)

    return {
        "message": "Member role updated successfully",
        "user_id": member_user_id,
        "project_id": project_id,
        "role": membership.role,
    }

@router.delete("/api/projects/{project_id}/members/{member_user_id}")
def remove_project_member(
    project_id: int,
    member_user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Check whether the project exists
    project = db.query(Project).filter(
        Project.id == project_id
    ).first()

    if not project:
        raise HTTPException(
            status_code=404,
            detail="Project not found",
        )

    # Only the project owner can remove members
    if project.owner_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="Only the project owner can remove members",
        )

    # Prevent the owner from removing themselves
    if member_user_id == current_user.id:
        raise HTTPException(
            status_code=400,
            detail="The project owner cannot remove themselves",
        )

    # Find the selected project member
    membership = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == member_user_id,
    ).first()

    if not membership:
        raise HTTPException(
            status_code=404,
            detail="Project member not found",
        )

    # Remove the membership record
    db.delete(membership)
    db.commit()

    return {
        "message": "Project member removed successfully",
        "project_id": project_id,
        "removed_user_id": member_user_id,
    }

@router.put("/api/projects/{project_id}/transfer-ownership/{new_owner_id}")
def transfer_project_ownership(
    project_id: int,
    new_owner_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Check whether the project exists
    project = db.query(Project).filter(
        Project.id == project_id
    ).first()

    if not project:
        raise HTTPException(
            status_code=404,
            detail="Project not found",
        )

    # Only the current owner can transfer ownership
    if project.owner_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="Only the project owner can transfer ownership",
        )

    # Prevent transferring ownership to yourself
    if new_owner_id == current_user.id:
        raise HTTPException(
            status_code=400,
            detail="You are already the project owner",
        )

    # Check whether the new owner is an existing project member
    new_owner_membership = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == new_owner_id,
    ).first()

    if not new_owner_membership:
        raise HTTPException(
            status_code=404,
            detail="The new owner must already be a project member",
        )

    # Keep the previous owner as a project member
    previous_owner_membership = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == current_user.id,
    ).first()

    if previous_owner_membership:
        previous_owner_membership.role = "Developer"
    else:
        previous_owner_membership = ProjectMember(
            project_id=project_id,
            user_id=current_user.id,
            role="Developer",
        )
        db.add(previous_owner_membership)

    # Transfer ownership
    project.owner_id = new_owner_id

    db.commit()
    db.refresh(project)

    return {
        "message": "Project ownership transferred successfully",
        "project_id": project_id,
        "previous_owner_id": current_user.id,
        "new_owner_id": new_owner_id,
        "previous_owner_role": "Developer",
    }


@router.post("/api/projects/{project_id}/members", status_code=201)
def add_project_member(
    project_id: int,
    email: str = Body(..., embed=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Find the project
    project = db.query(Project).filter(
        Project.id == project_id
    ).first()

    if not project:
        raise HTTPException(
            status_code=404,
            detail="Project not found",
        )

    # Only Group projects can have multiple members
    if project.type != "Group":
        raise HTTPException(
            status_code=400,
            detail="Members can only be added to Group projects",
        )

    # Only the Group Leader can add members
    if project.owner_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="Only the Group Leader can add members",
        )

    # Find the registered user by email
    member_user = db.query(User).filter(
        func.lower(User.email) == email.strip().lower()
    ).first()

    if not member_user:
        raise HTTPException(
            status_code=404,
            detail="No registered user found with this email",
        )

    # Prevent adding the Group Leader as a member
    if member_user.id == project.owner_id:
        raise HTTPException(
            status_code=400,
            detail="This user is already the Group Leader",
        )

    # Check whether the user is already a member
    existing_membership = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == member_user.id,
    ).first()

    if existing_membership:
        raise HTTPException(
            status_code=400,
            detail="This user is already a project member",
        )

    # Add the new member with the default role
    new_membership = ProjectMember(
        project_id=project_id,
        user_id=member_user.id,
        role="Developer",
    )

    db.add(new_membership)
    db.commit()
    db.refresh(new_membership)

    return {
        "message": "Member added successfully",
        "user_id": member_user.id,
        "full_name": member_user.full_name,
        "email": member_user.email,
        "role": new_membership.role,
    }


@router.post("/api/projects/join")
def join_project_by_code(
    invite_code: str = Body(..., embed=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Find the project using its invitation code
    project = db.query(Project).filter(
        Project.invite_code == invite_code.strip().upper()
    ).first()

    if not project or project.type != "Group":
        raise HTTPException(
            status_code=404,
            detail="Invalid group invitation code",
        )

    # The Group Leader is already part of the project
    if project.owner_id == current_user.id:
        raise HTTPException(
            status_code=400,
            detail="You are already the Group Leader",
        )

    # Check whether the user is already a member
    existing_membership = db.query(ProjectMember).filter(
        ProjectMember.project_id == project.id,
        ProjectMember.user_id == current_user.id,
    ).first()

    if existing_membership:
        raise HTTPException(
            status_code=400,
            detail="You are already a member of this project",
        )

    # Add the user with the default role
    new_membership = ProjectMember(
        project_id=project.id,
        user_id=current_user.id,
        role="Developer",
    )

    db.add(new_membership)
    db.commit()
    db.refresh(new_membership)

    return {
        "message": "You joined the project successfully",
        "project_id": project.id,
        "project_name": project.name,
        "role": new_membership.role,
    }
