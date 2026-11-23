"""cascade project deletion to notifications

Revision ID: f3c1a7d92b44
Revises: ca61053cbe81
Create Date: 2026-11-24

"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import inspect


revision: str = "f3c1a7d92b44"
down_revision: Union[str, Sequence[str], None] = "ca61053cbe81"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


CONSTRAINT_NAME = "fk_notifications_project_id_projects"
NAMING_CONVENTION = {
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s"
}


def replace_project_foreign_key(ondelete: str | None) -> None:
    bind = op.get_bind()
    foreign_key = next(
        (
            constraint
            for constraint in inspect(bind).get_foreign_keys("notifications")
            if constraint["constrained_columns"] == ["project_id"]
            and constraint["referred_table"] == "projects"
        ),
        None,
    )
    if foreign_key is None:
        raise RuntimeError("Could not find notifications.project_id foreign key")
    if (foreign_key.get("options") or {}).get("ondelete", "").upper() == (
        ondelete or ""
    ).upper():
        return

    if bind.dialect.name == "sqlite":
        with op.batch_alter_table(
            "notifications", naming_convention=NAMING_CONVENTION
        ) as batch_op:
            batch_op.drop_constraint(
                foreign_key["name"] or CONSTRAINT_NAME,
                type_="foreignkey",
            )
            batch_op.create_foreign_key(
                CONSTRAINT_NAME,
                "projects",
                ["project_id"],
                ["id"],
                ondelete=ondelete,
            )
        return

    op.drop_constraint(
        foreign_key["name"],
        "notifications",
        type_="foreignkey",
    )
    op.create_foreign_key(
        CONSTRAINT_NAME,
        "notifications",
        "projects",
        ["project_id"],
        ["id"],
        ondelete=ondelete,
    )


def upgrade() -> None:
    replace_project_foreign_key("CASCADE")


def downgrade() -> None:
    replace_project_foreign_key(None)
