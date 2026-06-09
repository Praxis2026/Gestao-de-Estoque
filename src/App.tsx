import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Materials from './pages/Materials';
import Movements from './pages/Movements';
import Settings from './pages/Settings';
import Categories from './pages/Categories';
import Units from './pages/Units';
import Suppliers from './pages/Suppliers';
import PatientsCourses from './pages/PatientsCourses';
import Profiles from './pages/Profiles';
import Users from './pages/Users';
import Reports from './pages/Reports';
import MaterialsReport from './pages/MaterialsReport';
import InventoryAgeing from './pages/InventoryAgeing';
import Equivalences from './pages/Equivalences';
import CompatibilityReport from './pages/CompatibilityReport';
import ProstheticServices from './pages/ProstheticServices';
import ProstheticReports from './pages/ProstheticReports';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  return <Layout>{children}</Layout>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          
          <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/materiais" element={<PrivateRoute><Materials /></PrivateRoute>} />
          <Route path="/movimentacoes" element={<PrivateRoute><Movements /></PrivateRoute>} />
          <Route path="/proteses" element={<PrivateRoute><ProstheticServices /></PrivateRoute>} />
          <Route path="/configuracoes" element={<PrivateRoute><Settings /></PrivateRoute>} />
          
          <Route path="/categorias" element={<PrivateRoute><Categories /></PrivateRoute>} />
          <Route path="/unidades" element={<PrivateRoute><Units /></PrivateRoute>} />
          <Route path="/fornecedores" element={<PrivateRoute><Suppliers /></PrivateRoute>} />
          <Route path="/pacientes-cursos" element={<PrivateRoute><PatientsCourses /></PrivateRoute>} />
          <Route path="/equivalencias" element={<PrivateRoute><Equivalences /></PrivateRoute>} />
          <Route path="/relatorios" element={<PrivateRoute><Reports /></PrivateRoute>} />
          <Route path="/relatorios/materiais" element={<PrivateRoute><MaterialsReport /></PrivateRoute>} />
          <Route path="/relatorios/ageing" element={<PrivateRoute><InventoryAgeing /></PrivateRoute>} />
          <Route path="/relatorios/proteses" element={<PrivateRoute><ProstheticReports /></PrivateRoute>} />
          <Route path="/relatorios/compatibilidade" element={<PrivateRoute><CompatibilityReport /></PrivateRoute>} />
          <Route path="/perfis" element={<PrivateRoute><Profiles /></PrivateRoute>} />
          <Route path="/usuarios" element={<PrivateRoute><Users /></PrivateRoute>} />

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
