import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';

// Страницы
import Login from './pages/Login';
import Register from './pages/Register';
import ConfirmRegistration from './pages/ConfirmRegistration';
import ResetPassword from './pages/ResetPassword';
import ResetPasswordConfirm from './pages/ResetPasswordConfirm';
import AsanasList from './pages/AsanasList';
import AsanaDetail from './pages/AsanaDetail';
import AddAsana from './pages/AddAsana';
import SourcesList from './pages/SourcesList';
import SourceAsanas from './pages/SourceAsanas';
import AddSource from './pages/AddSource';
import AboutProject from './pages/AboutProject';
import ExpertInstructions from './pages/ExpertInstructions';
import Settings from './pages/Settings';

// Защищенные маршруты
import PrivateRoute from './components/PrivateRoute';
import ExpertRoute from './components/ExpertRoute';
import AdminRoute from './components/AdminRoute';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="app">
          <Navbar />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<Navigate to="/asanas" replace />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/confirm-registration" element={<ConfirmRegistration />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/reset-password-confirm" element={<ResetPasswordConfirm />} />
              
              <Route path="/asanas" element={<AsanasList />} />
              <Route path="/asana/:id-page" element={<AsanaDetail />} />
              
              <Route
                path="/asana/add"
                element={
                  <ExpertRoute>
                    <AddAsana />
                  </ExpertRoute>
                }
              />
              
              <Route path="/sources" element={<SourcesList />} />
              <Route path="/sources/:id/asanas" element={<SourceAsanas />} />
              
              <Route
                path="/sources/add"
                element={
                  <ExpertRoute>
                    <AddSource />
                  </ExpertRoute>
                }
              />
              
              <Route path="/about" element={<AboutProject />} />
              <Route
                path="/expert-instructions"
                element={
                  <ExpertRoute>
                    <ExpertInstructions />
                  </ExpertRoute>
                }
              />
              
              <Route
                path="/settings"
                element={
                  <AdminRoute>
                    <Settings />
                  </AdminRoute>
                }
              />
            </Routes>
          </main>
          <Footer />
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

