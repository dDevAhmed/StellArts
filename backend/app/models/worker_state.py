from sqlalchemy import Column, String

from app.db.base import Base


class WorkerState(Base):
    __tablename__ = "worker_state"

    key = Column(String(255), primary_key=True)
    value = Column(String, nullable=True)
