import {createPortal} from "react-dom";
import React, {useEffect, useState} from "react";
import Pose, { PoseType } from "@/components/pose/pose";
import api from "@/api";
import {toast, ToastContainer} from "react-toastify";

type PropsType = {
    isModalOpen: Boolean
    onCloseModal: () => void
}

const ResetPasswordRequestModal = (props: PropsType) => {
    const hostServer = process.env.NEXT_PUBLIC_HOST_SERVER;

    const {isModalOpen, onCloseModal} = props
    const [login, setLogin] = useState("")
    const [error, setError] = useState('');

    const handleSend = async () => {
        try {
            const response = await api.get(`${hostServer}/api/auth/reset_password_request?login=${login}`);
            const data = response.data;

            if (response.status != 200) {
                setError(data.message || 'Ошибка в логине');
            }
            else{
                setError("")
                toast.success("Сообщение о восстановлении пароля отправлено на почту.", { position: "bottom-right" });
            }
        } catch (error) {
            setError('Что-то пошло не так');
        }
    }

    return createPortal(
        <>
            <ToastContainer position="bottom-right" autoClose={3000} />
            <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
                <div className="bg-white px-5 pb-10 pt-5 rounded-lg shadow-lg relative w-3/3 lg:w-1/3 overflow-y-auto max-h-[80vh]">
                    <div className="flex flex-col justify-center">
                        <button onClick={onCloseModal}
                                className="text-center bg-red-600 text-white font-bold m-auto rounded-xl py-2 px-4 mr-2 mb-2">
                            ✕
                        </button>

                        <div className="text-3xl text-center text-black font-bold mb-4">
                            Восстановление пароля
                        </div>
                        <p className="text-center">Сообщние о восстановлении пароля буде отправлено на вашу почту</p>

                        <div className="mt-5 flex flex-col justify-center gap-3">
                            <input value={login} onChange={(event) => {setLogin(event.target.value)}} type="text" placeholder={"Введите логин или почту"} className="w-full lg:w-1/2 m-auto border-b-2 border-black bg-light outline-0 text-center p-2"/>
                            <button
                                onClick={handleSend}
                                className="transition hover:scale-105 px-2 w-1/3 py-2 bg-black text-white rounded-md m-auto"
                            >
                                Отправить
                            </button>
                            {error && <div className="text-red-500 text-sm mb-4">{error}</div>}
                        </div>
                    </div>
                </div>
            </div>
        </>
        , document.body);
};

export default ResetPasswordRequestModal;