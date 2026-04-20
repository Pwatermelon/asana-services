import { Navigate } from 'react-router-dom';

/**
 * Старый маршрут /users ведёт в админ-панель.
 */
const Users = () => <Navigate to="/admin" replace />;

export default Users;
