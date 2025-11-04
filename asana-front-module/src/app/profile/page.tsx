'use client';

import {useEffect, useState} from "react";
import {useRouter} from "next/navigation";
import Pose from "@/components/pose/pose";
import Link from "next/link";
import Cookie from "js-cookie";
import api from "@/api";
import ResetPasswordRequestModal from "@/components/modal-reset-password-request";
import {Skeleton} from "@/components/skeleton";

const Profile = () => {
    const [userData, setUserData] = useState<any>(null);
    const [page, setPage] = useState<number>(1);
    const hostServer = process.env.NEXT_PUBLIC_HOST_SERVER;

    const [isStudyingAllowed, setIsStudyingAllowed] = useState<boolean>(false);
    const [isChanged, setIsChanged] = useState(false)

    const router = useRouter();

    const fetchUserData = async () => {
        try {
            const res = await api.get(`/api/users/me`);

            if (res.status === 200) {
                const data = res.data;

                setTimeout(() => {
                    setUserData(data);
                    setIsStudyingAllowed(data.permission_study);
                }, 500)
            } else {
                router.push('/auth/login');
            }
        } catch (error) {
            router.push('/auth/login');
        }
    };

    useEffect(() => {
        fetchUserData();
    }, [page]);


    const savePermissionChange = async () => {
        try {
            const res = await api.patch(`/api/users/me/permission_study?permission=${isStudyingAllowed}`);
            setIsChanged(false)
        } catch (error) {
            console.error('Ошибка при обновлении разрешения:', error);
        }
    };

    const handleLogout = () => {
        localStorage.clear()

        window.location.href = "/auth/login"; // Перенаправляем на страницу логина
    };

    return (
        <>
            <div className="bg-gray-100">
                <div className="min-h-screen w-11/12 m-auto flex flex-col gap-5 p-4">
                    {
                        userData !== null
                        ? (
                            <div className="m-auto w-full lg:w-4/5 bg-white p-8 rounded-lg shadow-lg">
                                <div className="flex flex-row justify-end">
                                    <div className="transition hover:scale-105 text-red-600 underline cursor-pointer" onClick={handleLogout}>
                                        Выйти
                                    </div>
                                </div>
                                <h1 className="m-auto text-2xl font-bold text-center text-black mb-4">Личный кабинет</h1>

                                <div className="mb-4">
                                    <div className="flex flex-col gap-4">
                                        <div className="flex flex-col justify-center">
                                            <div className="text-2xl text-black text-center lg:text-left">Логин</div>
                                            <div className="text-xl underline text-center lg:text-left">{userData.login}</div>
                                        </div>
                                        <div className="flex flex-col justify-center">
                                            <div className="text-2xl text-black text-center lg:text-left">Роль</div>
                                            <div className="text-xl underline text-center lg:text-left">{userData.is_admin ? 'Администратор' : 'Пользователь'}</div>
                                        </div>
                                        <div className="flex flex-col justify-center">
                                            <div className="text-lg lg:text-2xl text-black">Разрешение на просмотр статистики</div>

                                            <div className="w-full lg:w-1/6">
                                                <select
                                                    className="w-full outline-0  p-2 border-black border-2"
                                                    defaultValue={isStudyingAllowed ? "1" : "0"}
                                                    onChange={(event) => {setIsStudyingAllowed(event.target.value === "1"); setIsChanged(true)}}
                                                >
                                                    <option value="1">Разрешено</option>
                                                    <option value="0">Запрещено</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col w-full gap-2">
                                    <div className="flex flex-row gap-2 w-full lg:w-1/5">
                                        <button
                                            className={`transition hover:scale-105 mt-2 p-1 w-full bg-primary text-white rounded-md ${!isChanged ? 'opacity-50' : ''}`}
                                            disabled={!isChanged}
                                            onClick={savePermissionChange}
                                        >
                                            Сохранить
                                        </button>
                                    </div>

                                    <Link
                                        className={`transition hover:scale-105 block text-center mt-2 w-full lg:w-1/5 p-1 bg-black text-white rounded-md`}
                                        onClick={savePermissionChange}
                                        href="/profile/history-prediction"
                                    >
                                        История предсказаний
                                    </Link>

                                    {
                                        userData.is_admin && (
                                            <div className="mt-10">
                                                <h1 className="m-auto text-2xl font-bold text-center text-black mb-4">Администрирование</h1>
                                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                                    <Link href={"/"} className="w-full text-center block bg-gray-400 text-white rounded-md py-2 px-4 transition">Просмотр заявок на предоставление прав администратора (В разработке)</Link>
                                                    <Link href={"/profile/rept"} className="w-full text-center  block bg-black text-white rounded-md py-2 px-4 transition hover:scale-[102%]">Генерация отчетов о результатах предсказаний</Link>
                                                    <Link href={"/"} className="w-full text-center  block bg-gray-400 text-white rounded-md py-2 px-4 transition">Редактирование данных пользователей (В разработке)</Link>
                                                </div>
                                            </div>
                                        )
                                    }
                                </div>
                            </div>
                        )
                        : (
                            <Skeleton className="m-auto w-full h-[450px] lg:w-4/5 p-8 rounded-lg shadow-lg bg-white">
                                <Skeleton className="m-auto w-[40%] h-[50px] bg-gray-100"/>

                                <div className="flex flex-col gap-4 mt-20">
                                    <Skeleton className="w-[40%] h-[50px] bg-gray-100"/>
                                    <Skeleton className="w-[40%] h-[50px] bg-gray-100"/>
                                    <Skeleton className="w-[40%] h-[50px] bg-gray-100"/>
                                </div>
                            </Skeleton>
                        )
                    }
                </div>
            </div>
        </>
    );
};

export default Profile;
