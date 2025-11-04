'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {toast, ToastContainer} from "react-toastify";
import axios from "axios";
import api from "@/api";

const Registration = () => {
    const [login, setLogin] = useState('');
    const [password, setPassword] = useState('');
    const [mail, setMail] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');

    const router = useRouter();
    const hostServer = process.env.NEXT_PUBLIC_HOST_SERVER;

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setError('Пароли не совпадают');
            return;
        }
        try {
            const response = await api.post(`/api/auth/registration`, { login, mail, password })

            const data = response.data;

            if (response.status == 200) {
                toast.success("Регистрация прошла успешно, подтверждение регистрации отправлено на почту.", { position: "bottom-right" });
                setTimeout(() => {
                    router.push('/auth/login');
                }, 5000)
            }
        } catch (error) {
            // @ts-ignore
            setError(error.response.data.detail || 'Что-то пошло не так');
        }
    };

    return (
        <>
            <ToastContainer position="bottom-right" autoClose={3000} />
            <div className="min-h-screen bg-[#F2F2F2] flex items-center justify-center">
                <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
                    <h1 className="text-2xl font-bold text-center text-black mb-4">Регистрация</h1>
                    <div>
                        <div className="mb-4">
                            <label htmlFor="login" className="block text-sm font-medium text-[#333]">Логин</label>
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
                            <label htmlFor="mail" className="block text-sm font-medium text-[#333]">Почта</label>
                            <input
                                type="email"
                                id="mail"
                                value={mail}
                                onChange={(e) => setMail(e.target.value)}
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
                        <div className="mb-4">
                            <label htmlFor="confirmPassword" className="block text-sm font-medium text-[#333]">Подтвердите пароль</label>
                            <input
                                type="password"
                                id="confirmPassword"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="mt-1 p-2 w-full border border-gray-300 rounded-md"
                                required
                            />
                        </div>
                        {error && <div className="text-red-500 text-sm mb-4">{error}</div>}
                        <div className="flex justify-center">
                            <button
                                className="transition hover:scale-105 px-4 py-2 w-2/3 bg-black text-white rounded-md"
                                onClick={handleRegister}
                            >
                                Зарегистрироваться
                            </button>
                        </div>
                    </div>
                    <p className="text-center mt-4">
                        Уже есть аккаунт?{' '}
                        <a href="/auth/login" className="transition hover:scale-[102%] inline-block black underline">Войти</a>
                    </p>
                </div>
            </div>
        </>
    );
};

export default Registration;
