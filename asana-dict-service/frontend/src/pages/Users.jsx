import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { usersAPI } from '../api/users';
import '../styles/Users.css';

const Users = () => {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    login: '',
    mail: '',
    password: '',
    is_admin: false,
    permission_study: false,
  });

  useEffect(() => {
    if (isAdmin) {
      loadUsers();
    }
  }, [isAdmin]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await usersAPI.getAllUsers();
      setUsers(data);
      setError(null);
    } catch (err) {
      setError('Ошибка при загрузке пользователей');
      console.error('Error loading users:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = () => {
    setFormData({
      login: '',
      mail: '',
      password: '',
      is_admin: false,
      permission_study: false,
    });
    setEditingUser(null);
    setShowAddModal(true);
  };

  const handleEditUser = (user) => {
    setFormData({
      login: user.login,
      mail: user.mail,
      password: '',
      is_admin: user.is_admin,
      permission_study: user.permission_study,
    });
    setEditingUser(user);
    setShowAddModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingUser) {
        // Обновление пользователя
        const updateData = {};
        if (formData.is_admin !== editingUser.is_admin) {
          updateData.is_admin = formData.is_admin;
        }
        if (formData.permission_study !== editingUser.permission_study) {
          updateData.permission_study = formData.permission_study;
        }
        await usersAPI.updateUser(editingUser.id, updateData);
      } else {
        // Создание нового пользователя
        await usersAPI.createUser(formData);
      }
      setShowAddModal(false);
      loadUsers();
    } catch (err) {
      setError(err.response?.data?.detail || 'Ошибка при сохранении пользователя');
      console.error('Error saving user:', err);
    }
  };

  const handleDeleteUser = async (userId, userLogin) => {
    if (!window.confirm(`Вы уверены, что хотите удалить пользователя "${userLogin}"?`)) {
      return;
    }
    try {
      await usersAPI.deleteUser(userId);
      loadUsers();
    } catch (err) {
      setError(err.response?.data?.detail || 'Ошибка при удалении пользователя');
      console.error('Error deleting user:', err);
    }
  };

  if (!isAdmin) {
    return (
      <div className="container">
        <div className="error-message">Доступ запрещен. Требуется роль администратора.</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container">
        <div className="loading">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="users-page">
        <div className="users-header">
          <h1>Управление пользователями</h1>
          <button className="btn-primary" onClick={handleAddUser}>
            Добавить пользователя
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="users-table-container">
          <table className="users-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Логин</th>
                <th>Email</th>
                <th>Администратор</th>
                <th>Эксперт</th>
                <th>Верифицирован</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.id}</td>
                  <td>{user.login}</td>
                  <td>{user.mail}</td>
                  <td>{user.is_admin ? 'Да' : 'Нет'}</td>
                  <td>{user.permission_study ? 'Да' : 'Нет'}</td>
                  <td>{user.is_verify ? 'Да' : 'Нет'}</td>
                  <td>
                    <button
                      className="btn-edit"
                      onClick={() => handleEditUser(user)}
                    >
                      Изменить
                    </button>
                    <button
                      className="btn-delete"
                      onClick={() => handleDeleteUser(user.id, user.login)}
                    >
                      Удалить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {showAddModal && (
          <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h2>{editingUser ? 'Изменить пользователя' : 'Добавить пользователя'}</h2>
              <form onSubmit={handleSubmit}>
                {!editingUser && (
                  <>
                    <div className="form-group">
                      <label>Логин:</label>
                      <input
                        type="text"
                        value={formData.login}
                        onChange={(e) => setFormData({ ...formData, login: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Email:</label>
                      <input
                        type="email"
                        value={formData.mail}
                        onChange={(e) => setFormData({ ...formData, mail: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Пароль:</label>
                      <input
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        required
                      />
                    </div>
                  </>
                )}
                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.is_admin}
                      onChange={(e) => setFormData({ ...formData, is_admin: e.target.checked })}
                    />
                    Администратор
                  </label>
                </div>
                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.permission_study}
                      onChange={(e) => setFormData({ ...formData, permission_study: e.target.checked })}
                    />
                    Эксперт
                  </label>
                </div>
                <div className="form-actions">
                  <button type="submit" className="btn-primary">
                    {editingUser ? 'Сохранить' : 'Создать'}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setShowAddModal(false)}
                  >
                    Отмена
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Users;













