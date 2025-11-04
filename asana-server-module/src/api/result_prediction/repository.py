import datetime
from operator import and_
from typing import Tuple

from sqlalchemy import select, desc, func, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, joinedload

from src.api.network.schemas import PredictIn
from src.api.result_prediction.schemas import ResultPredictionPutDto
from src.api.user.schemas import UserOutDto
from src.database.models import ResultPrediction


class ResultPredictionRepository:
    async def create_result_prediction(
            self,
            image: str,
            id_poses: str,
            id_user: int,
            session: AsyncSession
    ) -> ResultPrediction:
        new_result_prediction = ResultPrediction(
            id_user=id_user,
            image=image,
            answer=id_poses,
            created_at=datetime.datetime.now()
        )
        session.add(new_result_prediction)
        await session.commit()
        await session.flush()
        return new_result_prediction

    async def get_result_predictions(
            self,
            page: int,
            count: int,
            session: AsyncSession,
            only_user_predictions: bool,
            id_user: int | None
    ) -> Tuple[list[ResultPrediction], int]:
        if only_user_predictions:
            result_predictions = (await session.execute(
                select(ResultPrediction, func.count().over().label("count")).options(selectinload(ResultPrediction.user))
                .where(ResultPrediction.id_user == id_user)
                .order_by(desc(ResultPrediction.created_at))
                .offset((page - 1) * count).limit(count)
            )).scalars().all()
            count_predictions = (await session.execute(
                select(func.count(ResultPrediction.id))
                .where(ResultPrediction.id_user == id_user)
            )).scalar()

            return list(result_predictions), count_predictions
        else:
            result_predictions = (await session.execute(
                select(ResultPrediction).options(joinedload(ResultPrediction.user, innerjoin=False))
                .order_by(desc(ResultPrediction.created_at))
                .offset((page - 1) * count).limit(count)
            )).scalars().all()
            count_predictions = (await session.execute(
                select(func.count(ResultPrediction.id))
            )).scalar()

            return list(result_predictions), count_predictions

    async def get_result_prediction_by_id(self, id_result_prediction: int, session: AsyncSession) -> ResultPrediction:
        result_prediction = (await session.execute(
            select(ResultPrediction).options(selectinload(ResultPrediction.user)).where(ResultPrediction.id == id_result_prediction)
        )).scalar_one_or_none()

        return result_prediction

    async def get_result_prediction_by_date(self,  begin_date: datetime, end_date: datetime, session: AsyncSession) -> list[ResultPrediction]:
        result_predictions = (await session.execute(
            select(ResultPrediction)
            .where(and_(ResultPrediction.created_at >= begin_date, ResultPrediction.created_at <= end_date))
        )).scalars().all()
        return list(result_predictions)

    async def put_result_prediction(self, id_result_prediction: int, result_prediction_data: ResultPredictionPutDto, session: AsyncSession):
        await session.execute(
            update(ResultPrediction).where(ResultPrediction.id == id_result_prediction).values(
                is_right_top1=result_prediction_data.is_right_top1,
                is_right_top5=result_prediction_data.is_right_top5,
                right_answer_system=result_prediction_data.right_answer_system,
                right_answer_sanskrit=result_prediction_data.right_answer_sanskrit,
                right_transliteration=result_prediction_data.right_transliteration,
                right_answer_russian=result_prediction_data.right_answer_russian,
                right_answer_russian_interpretation=result_prediction_data.right_answer_russian_interpretation,
            )
        )
        await session.commit()
        return await self.get_result_prediction_by_id(id_result_prediction, session)
