import {useEffect, useState} from "react";
import ReportModal from "@/components/report/modal-report";
import {toast, ToastContainer} from "react-toastify";
import Link from "next/link";
import api from "@/api";

export default function ReportIcon() {
    const [open, setOpen] = useState(false);
    const [cookieToken, setCookieToken] = useState<string | null>(null);
    const hostServer = process.env.NEXT_PUBLIC_HOST_SERVER;

    const sendRequest = async (text: string | null) => {
        setOpen(false)

        if (text != null){
            const response = await api.post(`/api/reports`, { text });

            let result = await response.data
            if (response.status === 200) {
                toast.success("Сообщение об ошибке отправлено.", { position: "bottom-right" })
            }
        }
    }

    useEffect(() => {
        if (typeof window !== "undefined") {
            const token = localStorage.getItem("access_token");
            setCookieToken(token);
        }
    }, []);

    return (
        <>
            <ReportModal isModalOpen={open} sendRequest={sendRequest}/>
            <ToastContainer position="bottom-right" autoClose={3000} />
            <div className="fixed bottom-10 right-10 transition hover:scale-105">
                {cookieToken ? (
                        <button
                            onClick={() => setOpen(!open)}
                            className="p-3 bg-purple-600 text-white rounded-xl shadow-lg hover:bg-purple-700 transition flex items-center justify-center font-bold"
                        >
                            Нашли ошибку?
                        </button>
                ):
                    (
                        <Link
                            href="/auth/registration"
                            className="p-3 bg-purple-600 text-white rounded-xl shadow-lg hover:bg-purple-700 transition flex items-center justify-center font-bold"
                        >
                            Хотите зарегистрироваться?
                        </Link>
                    )
                }
            </div>
        </>
    );
}
