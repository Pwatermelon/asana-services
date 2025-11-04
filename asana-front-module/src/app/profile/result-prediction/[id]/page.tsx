'use client';

import React, {Suspense, useEffect, useState} from "react";
import {useRouter} from "next/navigation";

import Pose, {ImagePoseType} from "@/components/pose/pose";
import {GetServerSideProps} from "next";
import { use } from "react";
import ReviewModal from "@/components/modal-review";
import api from "@/api";
import {Skeleton} from "@/components/skeleton";

export interface ResultPredictionType {
    id: number
    id_user: number
    image: string
    answer: Answer[]
    created_at: string
    is_right_top1: any
    is_right_top5: any
    right_answer_system: number
    right_answer_sanskrit: any
    right_transliteration: any
    right_answer_russian: any
    right_answer_russian_interpretation: any
}

export interface Answer {
    id: number
    title_sanskrit: string
    title_transliteration: string
    title_russian: string
    title_russian_interpretation: string
    images: [ImagePoseType]
}

const ResultPrediction = ({ params }: { params: { id: string } }) => {
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [resultPrediction, setResultPrediction] = useState<null | ResultPredictionType>(null)
    const [loading, setLoading] = useState(true);

    // @ts-ignore
    const { id } = use(params);
    const hostServer = process.env.NEXT_PUBLIC_HOST_SERVER!;

    const fetchData = async (id: number) => {
        try {
            const res = await api.get(`/api/result_prediction/${id}`);

            if (res.status == 200) {
                const data = await res.data;
                setResultPrediction(data)
            }
        } catch (error) {
            console.error('Ошибка при обновлении разрешения:', error);
        }
        finally {
            setTimeout(() => {
                setLoading(false)
            }, 800)
        }
    };

    useEffect(() => {
        fetchData(id);
    }, []);


    const Review = () => {
        if (resultPrediction?.is_right_top1 != null){
            return (
                <div className="lg:text-xl">
                    Нейронная сеть ответила правильно
                </div>
            )
        }
        else if (resultPrediction?.is_right_top5 != null){
            return (
                <div className="lg:text-xl">
                    Нейронная сеть ответила неправильно, но среди перечня пяти наиболее вероятных ответов, есть верный
                </div>
            )
        }
        else if (resultPrediction?.right_answer_system != null){
            return (
                <div className="lg:text-xl">
                    Нейронная сеть ответила неправильно, но верный ответ есть в системе
                </div>
            )
        }
        else{
            return (
                <div className="lg:text-xl">
                    Нейронная сеть ответила неправильно и верного ответа нет в системе, введенные вами данные асаны:
                    <div className="mt-4">
                        <div>Название на Санскрите - <span className="text-secondary">{resultPrediction?.right_answer_sanskrit ? resultPrediction?.right_answer_sanskrit: "Не введено"}</span></div>
                        <div>Транслитерации - <span className="text-secondary">{resultPrediction?.right_transliteration ? resultPrediction?.right_transliteration: "Не введено"}</span></div>
                        <div>Название на Русском - <span className="text-secondary">{resultPrediction?.right_answer_russian ? resultPrediction?.right_answer_russian: "Не введено"}</span></div>
                        <div>Перевод названия - <span className="text-secondary">{resultPrediction?.right_answer_russian_interpretation ? resultPrediction?.right_answer_russian_interpretation: "Не введено"}</span></div>
                    </div>
                </div>
            )
        }
    }

    const reviewEnd = () => {
        setIsModalOpen(false)
        fetchData(id);
    }

    return (
        <>
            <ReviewModal isModalOpen={isModalOpen} result_prediction_id={resultPrediction?.id ? resultPrediction?.id : null} onCloseReviewModal={reviewEnd} poses={resultPrediction?.answer}/>
            <div className="bg-gray-100">
                <div className="min-h-screen w-11/12 lg:w-7/12 m-auto gap-5 p-4 flex flex-col justify-center">
                    {
                        !loading
                            ? (
                                <div className="mt-5 bg-white w-full rounded-md py-5 px-10">
                                    <div className="flex flex-col gap-10">
                                        <div className="text-center text-xl lg:text-3xl text-primary font-bold underline">Предсказание {resultPrediction?.id}</div>
                                        <img
                                            src={resultPrediction?.image.replace("minio", hostServer)}
                                            alt={`Предсказание ${resultPrediction?.id}`}
                                            className="m-auto w-full lg:w-1/2 object-cover rounded-md"
                                        />
                                        <div className="text-left text-xl lg:text-3xl text-primary">Результат:</div>
                                        <div className="flex flex-col gap-10 w-full  m-auto">
                                            <div className="m-auto w-1/2">
                                                {resultPrediction?.answer[0] && <Pose poseData={resultPrediction?.answer[0]} clickable={true} updateList={() => {}}/>}
                                            </div>
                                            <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
                                                {
                                                    resultPrediction?.answer.slice(1,).map((item: any, index: number) => {
                                                        return <Pose key={index} poseData={item} clickable={true} updateList={() => {}}/>
                                                    })
                                                }
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-3">
                                            <div className="text-left text-xl lg:text-3xl text-primary">Отзыв на результат предсказания:</div>
                                            <div className="flex flex-col gap-3">
                                                <Review/>
                                                <button
                                                    className="transition hover:scale-105 w-full lg:w-1/6 ml-0 text-white bg-primary p-2 rounded-md font-bold"
                                                    onClick={() => {setIsModalOpen(true)}}
                                                >
                                                    Изменить отзыв
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                            : (
                                <Skeleton className="py-5 px-10 mt-5 w-[100%] h-[1400px] bg-white flex flex-col items-center gap-5">
                                    <Skeleton className="w-[70%] h-[50px] mb-10 bg-gray-200"/>
                                    <Skeleton className="w-[40%] aspect-square mb-10 bg-gray-200"/>
                                    <Skeleton className="w-[70%] h-[50px] mb-10 bg-gray-200"/>
                                    <Skeleton className="w-[40%] aspect-square mb-10 bg-gray-200"/>
                                </Skeleton>
                            )
                    }
                </div>
            </div>
        </>
    );
};

const ResultPredictionWithSuspense = (props: any) => {return <Suspense fallback={""}><ResultPrediction {...props}/></Suspense>}
export default ResultPredictionWithSuspense;
