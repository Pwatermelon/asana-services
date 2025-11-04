import math

from pydantic import BaseModel

from src.database.models import YogaPose, YogaPoseImages


class YogaPoseImageOutDto(BaseModel):
    id: int
    id_pose: int
    image: str

    @staticmethod
    def from_yoga_pose_image(yoga_pose_image: YogaPoseImages) -> "YogaPoseImageOutDto":
        return YogaPoseImageOutDto(
            id = yoga_pose_image.id,
            id_pose = yoga_pose_image.id_pose,
            image = yoga_pose_image.image
        )


class YogaPoseOutDto(BaseModel):
    id: int
    title_sanskrit: str
    title_transliteration: str
    title_russian: str
    title_russian_interpretation: str

    images: list[YogaPoseImageOutDto]

    @staticmethod
    def from_yoga_pose(yoga_pose: YogaPose) -> "YogaPoseOutDto":
        return YogaPoseOutDto(
            id=yoga_pose.id,
            title_sanskrit=yoga_pose.title_sanskrit,
            title_transliteration=yoga_pose.title_transliteration,
            title_russian=yoga_pose.title_russian,
            title_russian_interpretation=yoga_pose.title_russian_interpretation,
            images=[YogaPoseImageOutDto.from_yoga_pose_image(item) for item in yoga_pose.images]
        )


class PaginationYogaPoseOutDto(BaseModel):
    page: int
    all_pages: int
    yoga_poses: list[YogaPoseOutDto]

    @staticmethod
    def from_data(yoga_poses: list[YogaPose], count_pose: int, count: int, page: int):
        return PaginationYogaPoseOutDto(
            page=page,
            all_pages=math.ceil(count_pose / count),
            yoga_poses=[YogaPoseOutDto.from_yoga_pose(yoga_pose) for yoga_pose in yoga_poses]
        )


class YogaPosePutDto(BaseModel):
    title_sanskrit: str
    title_transliteration: str
    title_russian: str
    title_russian_interpretation: str


class YogaPosePatchImagesDto(BaseModel):
    images: list[str]