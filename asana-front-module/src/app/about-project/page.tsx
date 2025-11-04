import React from "react";
import api from "@/api";
import YogaPoseList from "@/components/list-poses";

export default function AboutProject() {
    return (
        <div className="min-h-screen flex flex-col w-10/12 m-auto">
            <div className="mt-20 flex flex-col justify-center items-center">
                <div className="text-2xl lg:text-4xl underline font-bold">
                    О проекте
                </div>
                <div className="mt-6 lg:text-xl">
                    Перед Вами первая версия некоммерческого проекта, направленного на распознавание асан йоги
                    по загружаемой пользователями фотографией.
                    Проект выполнен на базе <b>Саратовского государственного технического университета имени Гагарина Ю.А.</b> <br/><br/>

                    В данный момент приложение способно распознавать 82 асаны. О каждой асане предоставляется
                    следующая информация: название на санскрите, транслитерация, название на русском, перевод
                    названия. Мы попытались исправить многочисленные ошибки, встречающихся в переводах
                    названия асан в русскоязычном (и не только) интернете, а также указать все названия асан на
                    русском языке, используя единый стандарт написания имен. <br/><br/>

                    При распознавании Вы также увидите случайную фотографию с распознанной асаной из
                    обучающей выборки, что позволить Вам оценить качество распознавания.<br/><br/>

                    Если вы зарегистрируетесь на сайте, вы сможете оценить качество распознавания загруженной
                    фотографии, что в дальнейшем позволит его улучшить, а также просматривать историю своих
                    предсказаний и предсказаний других пользователей, если они дали на это разрешение. Чем
                    больше фотографий Вы загрузите и больше отзывов оставите, тем точнее будут распознаваться
                    фотографии. <br/><br/>

                    <div className="mb-4">
                        <b>Об авторах</b>
                        <li>
                            Руководитель проекта: - <b>Шульга Татьяна Эриковна</b> (г. Саратов), доктор физ.-мат. наук, профессор, инструктор йоги, йога
                            терапевт (<a className="underline px-1 text-secondary inline-block hover:scale-105 transition" href={"http://yogasaratov.ru"}>yogasaratov.ru</a>, <a className="underline px-1 text-secondary inline-block hover:scale-105 transition" href={"https://vk.com/tatianashulgayoga"}>tatianashulgayoga</a>)
                        </li>
                    </div>
                    <div className="mb-4">
                        <b>Эксперты: </b>
                        <li>
                            <b>Бабкин Сергей Александрович</b> (г. Москва), инструктор йоги и традиционных японских
                            боевых искусств, йогатерапевт и физический терапевт, практики и исследователь
                            традиционных систем медитации (индуистская и буддийская тантра). (<a className="underline px-1 text-secondary inline-block hover:scale-105 transition" href={"https://heiho.ru/"}>heiho.ru</a>, <a className="underline px-1 text-secondary inline-block hover:scale-105 transition" href={"https://vk.com/sergey_babkin9"}>sergey_babkin9</a>)
                        </li>
                        <li>
                            <b>Шульга Игорь Иванович</b> (г. Саратов), кандидат исторических наук, инструктор йоги,
                            igorshulga@yandex.ru
                        </li>
                    </div>
                    <div className="mb-4">
                        <b>Техническая реализация: </b>
                        <li>
                            <b>Климов Денис</b>, студент СГТУ имени Гагарина Ю.А., tyferly2003@gmail.com
                        </li>
                    </div>
                </div>
            </div>
        </div>
    )
}