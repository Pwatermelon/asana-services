'use client';

import React, {Suspense, use, useEffect, useState} from 'react';
import {useRouter} from "next/navigation";
import Cookie from "js-cookie";
import axios from "axios";
import api from "@/api";
import ResetPasswordRequestModal from "@/components/modal-reset-password-request";
import {toast, ToastContainer} from "react-toastify";

const Login = ({ params }: { params: { token: string } }) => {
    // @ts-ignore
    const { token } = use(params);
    const [login, setLogin] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const router = useRouter();
    const hostServer = process.env.NEXT_PUBLIC_HOST_SERVER;

    const verifyToken = async () => {
        try {
            const response = await api.get(`/api/auth/verify/${token}`);
            if (response.status === 200) {
                toast.success("Аккаунт успешно подтвержден")
            }
        }
        catch (error) {
            toast.error("Ошибка при подтверждении аккаунта")
        }
    }

    useEffect(() => {
        verifyToken()
    }, []);

    const handleLogin = async (event: any) => {
        event.preventDefault();

        try {
            const response = await api.post(`/api/auth`, { login, password });

            const data = response.data;

            if (response.status == 200) {
                localStorage.setItem("access_token", data.access_token)
                window.location.href = "/detect-pose"
            } else {
                setError(data.detail || 'Ошибка авторизации');
            }
        } catch (error) {
            // @ts-ignore
            setError(error.response.data.detail || 'Ошибка авторизации');
        }
    };

    const [isModalOpen, setIsModalOpen] = useState(false)

    return (
        <>
            <ToastContainer position="bottom-right" autoClose={3000} />
            {isModalOpen && <ResetPasswordRequestModal isModalOpen={isModalOpen} onCloseModal={() => {setIsModalOpen(false)}}/>}
            <div className="min-h-screen bg-[#F2F2F2] flex items-center justify-center">
                <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
                    <h1 className="text-2xl font-bold text-center text-black mb-4">Авторизация</h1>
                    <div>
                        <div className="mb-4">
                            <label htmlFor="login" className="block text-sm font-medium text-[#333]">Логин или почта</label>
                            <input
                                type="text"
                                id="login"
                                value={login}
                                onChange={(e) => setLogin(e.target.value)}
                                className="mt-1 p-2 w-full border border-black rounded-md"
                                required
                            />
                        </div>
                        <div className="mb-4">
                            <label htmlFor="password" className="block text-sm font-medium text-[#333]">Пароль</label>
                            <input
                                type="password"
                                id="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="mt-1 p-2 w-full border border-black rounded-md"
                                required
                            />
                        </div>
                        {error && <div className="text-red-500 text-sm mb-4">{error}</div>}
                        <div className="flex justify-center">
                            <button
                                onClick={handleLogin}
                                className="transition hover:scale-105 px-2 w-1/3 py-2 bg-black text-white rounded-md"
                            >
                                Войти
                            </button>
                        </div>
                    </div>
                    <p className="text-center mt-4">
                        Нет аккаунта?{' '}
                        <a href="/auth/registration" className="transition hover:scale-[102%] inline-block text-black underline">Зарегистрироваться</a>
                    </p>
                    <p className="text-center mt-4">
                        Забыли пароль?{' '}
                        <span onClick={() => {setIsModalOpen(true)}} className="transition hover:scale-[102%] inline-block text-black underline cursor-pointer">Восстановить пароль</span>
                    </p>
                </div>
            </div>
        </>
    );
};

const LoginWithSuspense = (props: any) => {return <Suspense fallback={""}><Login {...props}/></Suspense>}
export default LoginWithSuspense;
