"""add performance indexes

Revision ID: 0003
Revises: 0002
Create Date: 2026-03-30
"""
from alembic import op
from typing import Sequence, Union

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    from sqlalchemy import inspect
    conn = op.get_bind()
    insp = inspect(conn)

    existing = {(i["name"]) for i in insp.get_indexes("tickets")}
    if "ix_tickets_customer_id" not in existing:
        op.create_index("ix_tickets_customer_id", "tickets", ["customer_id"])
    if "ix_tickets_status" not in existing:
        op.create_index("ix_tickets_status", "tickets", ["status"])
    if "ix_tickets_priority" not in existing:
        op.create_index("ix_tickets_priority", "tickets", ["priority"])
    if "ix_tickets_created_at" not in existing:
        op.create_index("ix_tickets_created_at", "tickets", ["created_at"])

    existing_cm = {i["name"] for i in insp.get_indexes("chat_messages")}
    if "ix_chat_messages_created_at" not in existing_cm:
        op.create_index("ix_chat_messages_created_at", "chat_messages", ["created_at"])

    existing_pred = {i["name"] for i in insp.get_indexes("predictions")}
    if "ix_predictions_action" not in existing_pred:
        op.create_index("ix_predictions_action", "predictions", ["action"])

    existing_al = {i["name"] for i in insp.get_indexes("audit_logs")}
    if "ix_audit_logs_decision" not in existing_al:
        op.create_index("ix_audit_logs_decision", "audit_logs", ["decision"])


def downgrade() -> None:
    op.drop_index("ix_tickets_customer_id", "tickets")
    op.drop_index("ix_tickets_status", "tickets")
    op.drop_index("ix_tickets_priority", "tickets")
    op.drop_index("ix_tickets_created_at", "tickets")
    op.drop_index("ix_chat_messages_created_at", "chat_messages")
    op.drop_index("ix_predictions_action", "predictions")
    op.drop_index("ix_audit_logs_decision", "audit_logs")
