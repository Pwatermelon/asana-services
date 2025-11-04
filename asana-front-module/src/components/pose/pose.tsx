'use client'

import React, {useState} from "react";
import PoseModal from "@/components/pose/modal-pose";
import {list} from "postcss";
import {number} from "prop-types";

export type ImagePoseType = {
    id: number
    id_pose: number
    image: string
}

export type PoseType = {
    id: Number
    title_sanskrit: string
    title_transliteration: string
    title_russian: string
    title_russian_interpretation: string
    images: [ImagePoseType]
}

type PropsType = {
    poseData: PoseType;
    clickable: boolean;
    updateList: () => void;
}

const Pose = (props: PropsType) => {
    const { poseData, clickable, updateList} = props
    const [isModalOpen, setIsModalOpen] = useState(false);

    return (
        <>
            {isModalOpen && <PoseModal isModalOpen={isModalOpen} onClose={() => {setIsModalOpen(false); updateList()}} poseDataSource={poseData}/>}
            <div
                 className="transition hover:scale-[102%] hover:shadow-2xl bg-gray-100 p-4 w-full h-full rounded-xl flex flex-col justify-between"
                 onClick={() => {setIsModalOpen(true)}}
            >
                <div className="text-xl text-bla underlineck mb-4 text-center">
                    {poseData.title_russian}
                </div>
                <div className="flex flex-row justify-center">
                    {
                        poseData.images.length > 0 ?
                            (
                                <img
                                    src={poseData.images[0].image}
                                    alt="Image"
                                    style={{width: "80%", objectFit: "cover"}}
                                    className="rounded-xl"
                                />
                            ) :
                            (
                                <div className="flex flex-col items-center justify-center">
                                    <div className="text-center">Изображения нет</div>
                                </div>
                            )
                    }
                </div>
                <div className="underline text-center mt-4">
                    Посмотреть подробнее
                </div>
            </div>
        </>
    )
}

export default Pose