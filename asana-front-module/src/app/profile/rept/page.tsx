"use client"

import React, {useEffect, useState} from "react";
import api from "@/api";
import YogaPoseList from "@/components/list-poses";
import {toast, ToastContainer} from "react-toastify";
import {useRouter} from "next/navigation";

export default function Rept() {
    const [typeRept, setTypeRept] = useState(0)
    const [beginDate, setBeginDate] = useState("")
    const [endDate, setEndDate] = useState("")

    const hostServer = process.env.NEXT_PUBLIC_HOST_SERVER;

    async function getRept(){
        let urlRept = ""
        if (typeRept == 0){
            urlRept = "general"
        }

        if (beginDate === "" || endDate === ""){
            toast.warning("Введите дату для отчета", { position: "bottom-right" })
            return
        }

        try {
            toast.success("Идет генерация отчета", { position: "bottom-right" })
            const response = await api.get(`/api/rept/${urlRept}?begin_date=${beginDate}&end_date=${endDate}`, {
                responseType: 'blob',
            });

            const blob = new Blob([response.data], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            });

            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;

            link.download = 'report.xlsx';

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            toast.error("Ошибка при генерации отчета", { position: "bottom-right" })
        }
    }

    const router = useRouter();
    const fetchUserData = async () => {
        try {
            const res = await api.get(`/api/users/me`);

            if (res.status === 200) {
                const data = res.data;

                if (data.is_admin === false){
                    router.push('/');
                }
            } else {
                router.push('/');
            }
        } catch (error) {
            router.push('/');
        }
    };

    useEffect(() => {
        fetchUserData();
    }, []);

    return (
        <>
            <ToastContainer position="bottom-right" autoClose={3000} />
            <div className="bg-gray-100">
                <div className="min-h-screen w-11/12 m-auto flex flex-col gap-5 p-4">
                    <div className="m-auto w-full lg:w-4/5 bg-white p-8 rounded-lg shadow-lg">
                        <div className="text-center text-2xl font-bold">Отчеты</div>
                        <div className="mt-5 text-xl">
                            Выберете тип отчета:
                            <select
                                className="text-lg ml-4 border-2 outline-none border-black p-2"
                                defaultValue={0}
                                onChange={(event: any) => {setTypeRept(event.target.value)}}
                            >
                                <option value={0}>
                                    Общий отчет о предсказаниях
                                </option>
                            </select>
                        </div>

                        {
                            typeRept == 0 && (
                                <div className="mt-10">
                                    <div className="text-2xl font-bold">Общий отчет о предсказаниях</div>

                                    <div className="flex flex-col gap-5 mt-5">
                                        <div className="text-lg underline">
                                            <span className="inline-block w-3/12">Выберете начальную дата отчета:</span>
                                            <input type="date" className="p-1 outline-0 border-black border-2" onChange={(event: any) => {setBeginDate(event.target.value)}}/>
                                        </div>
                                        <div className="text-lg underline">
                                            <span className="inline-block w-3/12">Выберете конечную дата отчета:</span>
                                            <input type="date" className="p-1 outline-0 border-black border-2" onChange={(event: any) => {setEndDate(event.target.value)}}/>
                                        </div>

                                        <button className="p-2 bg-black text-white w-1/4 rounded-md mt-2 transition hover:scale-105" onClick={getRept}>Получить отчет</button>
                                    </div>
                                </div>
                            )
                        }
                    </div>
                </div>
            </div>
        </>
    )
}
