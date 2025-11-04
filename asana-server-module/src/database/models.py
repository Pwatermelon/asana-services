from datetime import datetime

from sqlalchemy import String, Boolean, Integer, ForeignKey, Text, BigInteger, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.database.config import Base


class User(Base):
    __tablename__ = "t_users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    login: Mapped[str] = mapped_column(String(256), unique=True)
    mail: Mapped[str] = mapped_column(String(256), unique=True)
    password: Mapped[str] = mapped_column(String(256))
    is_admin: Mapped[bool] = mapped_column(Boolean)
    permission_study: Mapped[bool] = mapped_column(Boolean)

    is_verify: Mapped[bool] = mapped_column(Boolean)


class YogaPose(Base):
    __tablename__ = "t_yoga_poses"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=False)
    title_sanskrit: Mapped[str] = mapped_column(String(256))
    title_transliteration: Mapped[str] = mapped_column(String(256))
    title_russian: Mapped[str] = mapped_column(String(256))
    title_russian_interpretation: Mapped[str] = mapped_column(String(256), nullable=True)

    images: Mapped[list["YogaPoseImages"]] = relationship("YogaPoseImages", lazy="selectin")


class YogaPoseImages(Base):
    __tablename__ = "t_yoga_poses_images"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    id_pose: Mapped[int] = mapped_column(BigInteger(), ForeignKey("t_yoga_poses.id"), nullable=False)
    image: Mapped[str] = mapped_column(Text())


class ResultPrediction(Base):
    __tablename__ = "t_result_predictions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    id_user: Mapped[int] = mapped_column(BigInteger(), ForeignKey("t_users.id"), nullable=True)
    image: Mapped[str] = mapped_column(Text())
    answer: Mapped[str] = mapped_column(String(256))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=False))

    is_right_top1: Mapped[int] = mapped_column(BigInteger(), ForeignKey("t_yoga_poses.id"), nullable=True)
    is_right_top5: Mapped[int] = mapped_column(BigInteger(), ForeignKey("t_yoga_poses.id"), nullable=True)
    right_answer_system: Mapped[int] = mapped_column(BigInteger(), ForeignKey("t_yoga_poses.id"), nullable=True)
    right_answer_sanskrit: Mapped[str] = mapped_column(String(256), nullable=True)
    right_transliteration: Mapped[str] = mapped_column(String(256), nullable=True)
    right_answer_russian: Mapped[str] = mapped_column(String(256), nullable=True)
    right_answer_russian_interpretation: Mapped[str] = mapped_column(String(256), nullable=True)

    user = relationship("User", lazy="selectin")


class Report(Base):
    __tablename__ = "t_reports"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    id_user: Mapped[int] = mapped_column(BigInteger(), ForeignKey("t_users.id"), nullable=True)
    text: Mapped[str] = mapped_column(Text())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), server_default=func.now())


class RequestToAdminStatus(Base):
    __tablename__ = "t_request_to_admin_status"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    id_user: Mapped[int] = mapped_column(BigInteger(), ForeignKey("t_users.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(256), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), server_default=func.now())

    user = relationship("User", lazy="selectin")

