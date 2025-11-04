'use client';

import React, {useEffect, useState} from "react";
import Pose from "@/components/pose/pose";
import { setCookie } from "cookies-next";
import PermissionModal from "@/components/modal-permission";
import ReviewModal from "@/components/modal-review";
import api from "@/api";
import {toast, ToastContainer} from "react-toastify";

function getCookie(name: string): string | null {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? match[2] : null;
}

const DetectPose: React.FC = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isModalOpenReview, setIsModalOpenReview] = useState(false);

    const [image, setImage] = useState<any | null>(null);
    const [result, setResult] = useState<any | null>(null);
    const [idResultPrediction, setIdResultPrediction] = useState<Number | null>(null);

    const hostServer = process.env.NEXT_PUBLIC_HOST_SERVER;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setImage(reader.result as string);
            };
            reader.readAsDataURL(file);
            setResult(null);
        }
    };

    const handleDetectPose = async () => {
        const cookieStudy = localStorage.getItem("permission_study");
        const cookieToken = localStorage.getItem("access_token");
        console.log(cookieStudy)
        if (cookieStudy == null && cookieToken == null){
            setIsModalOpen(true)
        }
        else{
            console.log(result)
            if (image) {
                const response = await api.post(`/api/network/prediction`, {
                    image: image,
                    permission_study: cookieStudy
                })

                let result = await response.data
                setResult(result.yoga_poses);
                setIdResultPrediction(result.result_prediction_id)

                if (cookieToken == null && cookieStudy == null) {
                    setTimeout(() => {
                        toast.warning("Если вы хотите оставить отзыв о результате распознавания, то вам следует зарегистрироваться", { position: "bottom-right" });
                    }, 1000)
                }
            } else {
                alert("Пожалуйста, загрузите изображение.");
            }
        }
    };

    const handlerSetCookieStudy = (change: string) => {
        localStorage.setItem("permission_study", change)
        setIsModalOpen(false)
    }


    return (
        <>
            <ToastContainer position="bottom-right" autoClose={3000} />
            <PermissionModal isModalOpen={isModalOpen} setCookieStudy={handlerSetCookieStudy}/>
            <ReviewModal poses={result} isModalOpen={isModalOpenReview} result_prediction_id={idResultPrediction} onCloseReviewModal={() => {setIsModalOpenReview(false)}}/>
            <div className="min-h-screen bg-[#F2F2F2] flex items-center justify-center">
                <div className="bg-white p-8 rounded-lg shadow-lg w-full lg:w-5/6 flex flex-col lg:flex-row items-center">
                    {/* Левая часть с загрузкой изображения */}
                    <div className="w-full lg:w-1/2 pl-6 lg:pl-0 lg:pr-6">
                        <h1 className="text-2xl font-bold text-center text-black mb-4">
                            Определить асану
                        </h1>
                        <p className="text-center text-lg text-[#333] mb-6">
                            Загрузите изображение с асаной, чтобы мы могли помочь вам с её определением. <br/> Допустимые форматы - png, jpg, jpeg
                        </p>

                        {image && (
                            <div className="flex justify-center mb-6">
                                <img
                                    src={image}
                                    alt="Предварительный просмотр"
                                    className="max-w-full max-h-64 rounded-lg shadow-md"
                                />
                            </div>
                        )}

                        <div className="flex justify-center mb-6">
                            <input
                                type="file"
                                accept=".jpg,.jpeg,.png"
                                className="p-2 text-black rounded-md"
                                onChange={handleFileChange}
                            />
                        </div>

                        <div className="flex flex-col items-center justify-center  gap-2">
                            <button
                                className="px-4 py-2 bg-black text-white rounded-md w-full lg:w-2/3 transition hover:scale-105"
                                onClick={handleDetectPose}
                            >
                                Начать определение
                            </button>
                            {
                                result && idResultPrediction && (
                                    <button
                                        className="px-4 py-2 bg-red-600 text-white rounded-md w-full lg:w-2/3"
                                        onClick={() => {setIsModalOpenReview(true)}}
                                    >
                                        Оставить отзыв
                                    </button>
                                )
                            }
                        </div>
                    </div>

                    {/* Правая часть с результатом */}
                    <div className="w-full lg:w-1/2 pl-6 mt-10 lg:mt-0 lg:border-l-2 lg:border-[#ddd] flex flex-col justify-center">
                        {result ? (
                            <div className="flex flex-col justify-center items-center gap-5 w-full">
                                <h2 className="text-xl font-bold text-black mb-4 text-center">Результат</h2>
                                <Pose poseData={result[0]} clickable={true} updateList={() => {}}/>
                            </div>
                        ) : (
                            <div className="text-center">
                                <p className="text-lg text-[#333]">Здесь будет отображен результат после обработки изображения.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default DetectPose;


/*
* TODO 0) Сделать регу через почту - сделано на 100%
* TODO 1) Сделать опрос - сделано на 100% - сделать поиск по слову
* TODO 2) Изменить дизайн страницы профиля - 100%
* TODO 3) Добавить возможность изменения отзыва на предсказание из профиля - 100%
* TODO 4) Добавить просмотр асан
* */