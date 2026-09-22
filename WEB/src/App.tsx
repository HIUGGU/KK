import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Employees from './components/Employees';
import Attendance from './components/Attendance';
import Salary from './components/Salary';
import SalaryChanges from './components/SalaryChanges';
import Advances from './components/Advances';
import Products from './components/Products';
import Clients from './components/Clients';
import ClientRates from './components/ClientRates';
import Orders from './components/Orders';
import Payments from './components/Payments';
import Settlements from './components/Settlements';
import BankAccounts from './components/BankAccounts';
import RawMaterials from './components/RawMaterials';
import Cutting from './components/Cutting';
import ProcessStage from './components/ProcessStage';
import VendorPayments from './components/VendorPayments';
import Vendors from './components/Vendors';
import MaterialMasters from './components/MaterialMasters';
import Layout from './components/Layout';
import { apiClient } from './api/client';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const authenticated = await apiClient.verifyToken();
      setIsAuthenticated(authenticated);
    } catch (error) {
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (success: boolean) => {
    setIsAuthenticated(success);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route
          path="/login"
          element={
            isAuthenticated ? (
              <Navigate to="/" replace />
            ) : (
              <Login onLogin={handleLogin} />
            )
          }
        />
        <Route
          path="/"
          element={
            isAuthenticated ? (
              <Layout>
                <Dashboard />
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/employees"
          element={
            isAuthenticated ? (
              <Layout>
                <Employees />
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/attendance"
          element={
            isAuthenticated ? (
              <Layout>
                <Attendance />
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/salary"
          element={
            isAuthenticated ? (
              <Layout>
                <Salary />
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/salary-changes"
          element={
            isAuthenticated ? (
              <Layout>
                <SalaryChanges />
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/advances"
          element={
            isAuthenticated ? (
              <Layout>
                <Advances />
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/products"
          element={
            isAuthenticated ? (
              <Layout>
                <Products />
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/clients"
          element={
            isAuthenticated ? (
              <Layout>
                <Clients />
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/clients/:clientId/rates"
          element={
            isAuthenticated ? (
              <Layout>
                <ClientRates />
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/orders"
          element={
            isAuthenticated ? (
              <Layout>
                <Orders />
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/payments"
          element={
            isAuthenticated ? (
              <Layout>
                <Payments />
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/settlements"
          element={
            isAuthenticated ? (
              <Layout>
                <Settlements />
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/bank-accounts"
          element={
            isAuthenticated ? (
              <Layout>
                <BankAccounts />
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/raw-materials"
          element={
            isAuthenticated ? (
              <Layout>
                <RawMaterials />
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/cutting"
          element={
            isAuthenticated ? (
              <Layout>
                <Cutting />
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/plasma"
          element={
            isAuthenticated ? (
              <Layout>
                <ProcessStage stage="plasma" />
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/tinker"
          element={
            isAuthenticated ? (
              <Layout>
                <ProcessStage stage="tinker" />
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/buffing"
          element={
            isAuthenticated ? (
              <Layout>
                <ProcessStage stage="buffing" />
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/vendor-payments"
          element={
            isAuthenticated ? (
              <Layout>
                <VendorPayments />
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/vendors"
          element={
            isAuthenticated ? (
              <Layout>
                <Vendors />
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/material-masters"
          element={
            isAuthenticated ? (
              <Layout>
                <MaterialMasters />
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
