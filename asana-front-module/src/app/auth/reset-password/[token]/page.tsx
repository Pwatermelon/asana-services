'use client';

import React, {Suspense, use, useEffect, useState} from "react";
import {useRouter} from "next/navigation";
import Pose from "@/components/pose/pose";
import Link from "next/link";
import Cookie from "js-cookie";
import api from "@/api";
import ReviewModal from "@/components/modal-review";
import {ResultPredictionType} from "@/app/profile/result-prediction/[id]/page";
import {toast} from "react-toastify";


const ResetPassword = ({ params }: { params: { token: string } }) => {
    // @ts-ignore
    const { token } = use(params);
    const hostServer = process.env.NEXT_PUBLIC_HOST_SERVER;

    const [password, setPassword] = useState("")
    const [passwordRepeat, setPasswordRepeat] = useState("")


    const handleSend = async () => {
        if (password != "" && passwordRepeat != "" && password === passwordRepeat){
            const response = await api.patch(`${hostServer}/api/auth/reset_password`, { password, token });
            const data = response.data;

            if (response.status == 200) {
                toast.success("Пароль успешно изменен, вы будете перенаправлены на страницу авторизации.", { position: "bottom-right" });
                setTimeout(() => {
                    window.location.href = "/profile"
                }, 2000)
            }
        }
        else{
            toast.error("Проверьте корректность пароля. Возможно они не совпадают", { position: "bottom-right" })
        }
    }

    return (
        <>
            <div className="min-h-screen bg-[#F2F2F2] flex items-center justify-center">
                <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
                    <h1 className="text-2xl font-bold text-center text-black mb-4">Введите новый пароль</h1>
                    <div className="mb-4">
                        <label htmlFor="login" className="block text-sm font-medium text-[#333]">Пароль</label>
                        <input
                            type="password"
                            id="password"
                            className="mt-1 p-2 w-full border border-black rounded-md"
                            required
                            value={password}
                            onChange={(event) => {setPassword(event.target.value)}}
                        />
                    </div>
                    <div className="mb-4">
                        <label htmlFor="password" className="block text-sm font-medium text-[#333]">Повторите пароль</label>
                        <input
                            type="password"
                            id="password_repeat"
                            className="mt-1 p-2 w-full border border-black rounded-md"
                            required
                            value={passwordRepeat}
                            onChange={(event) => {setPasswordRepeat(event.target.value)}}
                        />
                    </div>

                    <div className="flex justify-center">
                        <button
                            onClick={handleSend}
                            className="px-2 w-1/3 py-2 bg-black text-white rounded-md"
                        >
                            Сменить
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

const ResetPasswordWithSuspense = (props: any) => {return <Suspense fallback={""}><ResetPassword {...props}/></Suspense>}
export default ResetPasswordWithSuspense;
