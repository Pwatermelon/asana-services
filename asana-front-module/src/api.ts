import axios from "axios";


const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_HOST_SERVER,
    withCredentials: true
})

api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem("access_token"); // Получаем токен из localStorage
        if (token) {
            config.headers["Authorization"] = `Bearer ${token}`; // Добавляем токен в заголовки
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export default api