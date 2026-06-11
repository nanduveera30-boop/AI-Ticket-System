"""add missing columns

Revision ID: 0002
Revises: 0001
Create Date: 2026-03-29
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _col_exists(table: str, column: str) -> bool:
    """Check if a column already exists (safe to re-run)."""
    from sqlalchemy import inspect, text
    conn = op.get_bind()
    insp = inspect(conn)
    cols = [c["name"] for c in insp.get_columns(table)]
    return column in cols


def upgrade() -> None:
    # ── tickets ──────────────────────────────────────────────────────────────
    if not _col_exists("tickets", "category"):
        op.add_column("tickets", sa.Column("category", sa.String(50), nullable=True))
    if not _col_exists("tickets", "status"):
        op.add_column("tickets", sa.Column("status", sa.String(20), nullable=False, server_default="open"))
    if not _col_exists("tickets", "customer_id"):
        op.add_column("tickets", sa.Column("customer_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True))
    if not _col_exists("tickets", "assigned_to"):
        op.add_column("tickets", sa.Column("assigned_to", sa.Integer(), sa.ForeignKey("users.id"), nullable=True))
    if not _col_exists("tickets", "attachment_url"):
        op.add_column("tickets", sa.Column("attachment_url", sa.String(500), nullable=True))
    if not _col_exists("tickets", "updated_at"):
        op.add_column("tickets", sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()))

    # ── users ─────────────────────────────────────────────────────────────────
    if not _col_exists("users", "full_name"):
        op.add_column("users", sa.Column("full_name", sa.String(200), nullable=True))
    # role default was 'agent' in migration 0001 — update server_default to 'customer'
    # (existing rows keep their value, only affects new rows without explicit role)

    # ── predictions ───────────────────────────────────────────────────────────
    if not _col_exists("predictions", "ticket_category"):
        op.add_column("predictions", sa.Column("ticket_category", sa.String(50), nullable=True))
    if not _col_exists("predictions", "financial_category"):
        op.add_column("predictions", sa.Column("financial_category", sa.String(100), nullable=True))
    if not _col_exists("predictions", "ai_explanation"):
        op.add_column("predictions", sa.Column("ai_explanation", sa.Text(), nullable=True))
    if not _col_exists("predictions", "apology_message"):
        op.add_column("predictions", sa.Column("apology_message", sa.Text(), nullable=True))

    # ── chat_messages (new table) ─────────────────────────────────────────────
    from sqlalchemy import inspect
    conn = op.get_bind()
    insp = inspect(conn)
    existing_tables = insp.get_table_names()

    if "chat_messages" not in existing_tables:
        op.create_table(
            "chat_messages",
            sa.Column("id", sa.Integer(), primary_key=True, index=True),
            sa.Column("ticket_id", sa.Integer(), sa.ForeignKey("tickets.id"), nullable=False),
            sa.Column("sender_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("sender_role", sa.String(20), nullable=False, server_default="customer"),
            sa.Column("message", sa.Text(), nullable=False),
            sa.Column("is_ai", sa.Boolean(), server_default="false"),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        )
        op.create_index("ix_chat_messages_ticket_id", "chat_messages", ["ticket_id"])

    # ── faqs (new table) ──────────────────────────────────────────────────────
    if "faqs" not in existing_tables:
        op.create_table(
            "faqs",
            sa.Column("id", sa.Integer(), primary_key=True, index=True),
            sa.Column("question", sa.String(500), nullable=False),
            sa.Column("answer", sa.Text(), nullable=False),
            sa.Column("category", sa.String(100), nullable=True),
            sa.Column("is_active", sa.Boolean(), server_default="true"),
            sa.Column("view_count", sa.Integer(), server_default="0"),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        )


def downgrade() -> None:
    # Drop new tables
    op.drop_table("faqs")
    op.drop_table("chat_messages")

    # Remove added columns from predictions
    op.drop_column("predictions", "apology_message")
    op.drop_column("predictions", "ai_explanation")
    op.drop_column("predictions", "financial_category")
    op.drop_column("predictions", "ticket_category")

    # Remove added columns from users
    op.drop_column("users", "full_name")

    # Remove added columns from tickets
    op.drop_column("tickets", "updated_at")
    op.drop_column("tickets", "attachment_url")
    op.drop_column("tickets", "assigned_to")
    op.drop_column("tickets", "customer_id")
    op.drop_column("tickets", "status")
    op.drop_column("tickets", "category")
