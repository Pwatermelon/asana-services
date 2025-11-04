'use client';

import {useEffect, useState} from "react";
import {useRouter} from "next/navigation";
import Pose from "@/components/pose/pose";
import Link from "next/link";
import Cookie from "js-cookie";
import api from "@/api";
import {Skeleton} from "@/components/skeleton";

const Profile = () => {
    const [history, setHistory] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [page, setPage] = useState<number>(1);
    const [totalPages, setTotalPages] = useState<number>(1);

    const [onlyUserPredictions, setOnlyUserPredictions] = useState(true);
    const [isAdmin, setIsAdmin] = useState(null);

    const router = useRouter();

    const fetchPredictionHistory = async (page: number) => {
        try {
            setIsLoading(true)
            const res = await api.get(`/api/result_prediction?page=${page}&count=4&only_user_predictions=${onlyUserPredictions}`);
            const res_user = await api.get(`/api/users/me`);

            if (res.status === 200) {
                const data = await res.data;
                const data_user = await res_user.data
                setTimeout(() => {
                    setHistory(data.result_predictions);
                    setTotalPages(data.all_pages);
                    setIsAdmin(data_user.is_admin)
                    setIsLoading(false)
                }, 500)
            } else {
                console.error('Ошибка загрузки истории');
            }
        } catch (error) {
            console.error('Ошибка при загрузке истории:', error);
        }
    };

    const renderPredictionHistory = () => {
        return history.map((prediction: any) => {
            let is_right_answer = "Не заполнено";

            if (prediction.is_right === true) {
                is_right_answer = "Да"
            } else if (prediction.is_right === false) {
                is_right_answer = "Нет"
            }

            return (
                <div key={prediction.id} className="hover:shadow-2xl transition hover:scale-[102%] bg-[#F9F9F9] p-4 mb-4 rounded-md shadow-md flex flex-col justify-between">
                    <div className="">
                        <div className="flex flex-row justify-between ">
                            <div className="text-xl font-semibold text-[#9305F2]">Предсказание {prediction.id}</div>
                            <Link className="transition hover:scale-105 underline text-[#9305F2] text-sm cursor-pointer"
                                  href={`/profile/result-prediction/${prediction.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                            >
                                Открыть полностью
                            </Link>
                        </div>
                        <p><strong>Дата:</strong> {new Date(prediction.created_at).toLocaleDateString()}</p>
                        <p><strong>Пользователь:</strong> {prediction.user !== null ?prediction.user.login : "Незарегистрированный пользователь"}</p>
                        <div className="mt-4 mb-4 w-2/3 m-auto">
                            <img
                                src={prediction.image}
                                alt={`Предсказание ${prediction.id}`}
                                className="w-full h-auto object-cover rounded-md"
                            />
                        </div>
                    </div>

                    <div className="text-center"><strong>Результат предсказания:</strong></div>

                    <div className="flex flex-row gap-3 flex-wrap mt-3 justify-center">
                        <Pose poseData={prediction.answer[0]} clickable={true} updateList={() => {}}/>
                    </div>
                </div>
            );
        });
    }

    const handlePageChange = (newPage: number) => {
        setPage(newPage);
        fetchPredictionHistory(newPage);
    };

    useEffect(() => {
        fetchPredictionHistory(page);
    }, [page, onlyUserPredictions]);

    const handleSelectOnlyUserPrediction = (event: any) => {
        setOnlyUserPredictions(event.target.value == "true");
        setPage(1)
    }

    return (
        <>
            <div className="bg-gray-100">
                <div className="min-h-screen w-11/12 m-auto flex flex-row gap-5 p-4">
                    <div className="m-auto w-full lg:w-3/5 bg-white p-8 rounded-lg shadow-lg">
                        <h1 className="m-auto text-2xl font-bold text-center text-black mb-4">История предсказаний</h1>

                        {isAdmin && (
                            <div className="flex flex-row justify-center lg:justify-start gap-4 my-4">
                                <select className="block bg-gray-100 p-2" onChange={handleSelectOnlyUserPrediction} defaultValue={`${onlyUserPredictions}`}>
                                    <option value={"true"}>Мои предсказания</option>
                                    <option value={"false"}>Предсказания всех пользователей</option>
                                </select>
                            </div>
                        )}

                        <div className="flex justify-between mb-6 gap-2">
                            <button
                                onClick={() => handlePageChange(page - 1)}
                                disabled={page <= 1}
                                className="transition hover:scale-105 px-4 py-2 bg-[#C763F2] text-white rounded-md hover:bg-[#9305F2] disabled:bg-gray-300"
                            >
                                Предыдущая страница
                            </button>
                            <button
                                onClick={() => handlePageChange(page + 1)}
                                disabled={page >= totalPages}
                                className="transition hover:scale-105 px-4 py-2 bg-[#C763F2] text-white rounded-md hover:bg-[#9305F2] disabled:bg-gray-300"
                            >
                                Следующая страница
                            </button>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 justify-center">
                            {
                                !isLoading
                                    ? renderPredictionHistory()
                                    : (
                                        [...Array(6 )].map((_, i) => (
                                            <Skeleton key={i}  className="m-auto w-[90%] lg:w-[100%] h-[700px] p-4 flex flex-col items-center">
                                                <Skeleton className="w-[80%] h-[20%] bg-gray-200"/>
                                                <Skeleton className="w-[80%] h-[70%] bg-gray-200 mt-10"/>
                                            </Skeleton>
                                        ))
                                    )
                            }
                        </div>

                        {totalPages == 0 && (
                            <div className="text-xl text-center">
                                На вашем аккаунте пока нет предсказаний
                            </div>
                        )}

                        {totalPages >= 4 && (
                            <div className="flex justify-between mt-6 gap-2">
                                <button
                                    onClick={() => handlePageChange(page - 1)}
                                    disabled={page <= 1}
                                    className="transition hover:scale-105 px-4 py-2 bg-[#C763F2] text-white rounded-md hover:bg-[#9305F2] disabled:bg-gray-300"
                                >
                                    Предыдущая страница
                                </button>
                                <button
                                    onClick={() => handlePageChange(page + 1)}
                                    disabled={page >= totalPages}
                                    className="transition hover:scale-105 px-4 py-2 bg-[#C763F2] text-white rounded-md hover:bg-[#9305F2] disabled:bg-gray-300"
                                >
                                    Следующая страница
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default Profile;
