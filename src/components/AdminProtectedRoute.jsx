// src/components/AdminProtectedRoute.js
import { useContext } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import Loader from './Loading/Loading';

const AdminProtectedRoute = () => {
  const { isAdmin, loading } = useContext(AuthContext);

  if (loading) {
    return <div className="flex flex-col mx-auto justify-center items-center h-screen"
    ><Loader/>
    </div>;
  }

  return isAdmin ? <Outlet /> : <Navigate to="/" replace />;
};

export default AdminProtectedRoute;
