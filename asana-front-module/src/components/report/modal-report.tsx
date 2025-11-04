import {createPortal} from "react-dom";
import React, {useState} from "react";

type PropsType = {
    isModalOpen: Boolean
    sendRequest: (text: string | null) => void
}

const ReportModal = (props: PropsType) => {
    const {isModalOpen, sendRequest} = props
    const [text, setText] = useState("")
    if (!isModalOpen) return null

    return createPortal(
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white px-5 pb-10 pt-5 rounded-lg shadow-lg relative w-11/12 lg:w-1/3">
                <div className="flex flex-col justify-center">
                    <button onClick={() => {sendRequest(null)}}
                            className="text-center bg-red-600 text-white font-bold m-auto rounded-xl py-2 px-4 mr-2 mb-2">
                        ✕
                    </button>
                    <div className="text-xl lg:text-3xl text-center text-primary font-bold mb-8">
                        Сообщение об ошибке
                    </div>

                    <textarea
                        onChange={(event) => {setText(event.target.value)} }
                        className="resize-none outline-0 bg-gray-100 p-2" rows={10} placeholder="Введите текст ошибки"
                    >
                    </textarea>

                    <button onClick={() => {sendRequest(text)}} className="transition hover:scale-105 m-auto mt-6 text-center bg-primary text-white font-bold w-2/5 rounded-xl p-2">
                        Отправить
                    </button>
                </div>
            </div>
        </div>
        , document.body);
};

export default ReportModal;