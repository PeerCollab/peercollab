
"""create project members table

Revision ID: 2fe832aad73f
Revises: e89a2013fe3d
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2fe832aad73f'
down_revision: Union[str, Sequence[str], None] = 'e89a2013fe3d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create project_members table."""

    op.create_table(
        'project_members',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('role', sa.String(length=50), nullable=False),
        sa.Column(
            'joined_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('CURRENT_TIMESTAMP'),
            nullable=False
        ),
        sa.Column(
            'updated_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('CURRENT_TIMESTAMP'),
            nullable=False
        ),
        sa.ForeignKeyConstraint(
            ['project_id'],
            ['projects.id'],
            ondelete='CASCADE'
        ),
        sa.ForeignKeyConstraint(
            ['user_id'],
            ['users.id'],
            ondelete='CASCADE'
        ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint(
            'project_id',
            'user_id',
            name='uq_project_member'
        )
    )

    op.create_index(
        'ix_project_members_id',
        'project_members',
        ['id'],
        unique=False
    )

    op.create_index(
        'ix_project_members_project_id',
        'project_members',
        ['project_id'],
        unique=False
    )

    op.create_index(
        'ix_project_members_user_id',
        'project_members',
        ['user_id'],
        unique=False
    )


def downgrade() -> None:
    """Remove project_members table."""

    op.drop_index(
        'ix_project_members_user_id',
        table_name='project_members'
    )
    op.drop_index(
        'ix_project_members_project_id',
        table_name='project_members'
    )
    op.drop_index(
        'ix_project_members_id',
        table_name='project_members'
    )
    op.drop_table('project_members')
