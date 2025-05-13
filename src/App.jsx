import React, { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import LandingPage from "./LandingPage";
import Login from "./Login";
import Signup from "./Signup";
import Dashboard from "./Dashboard";
import User from "./User";
import Layout from "./Layout";
import MyApplication from "./MyApplication";
import Reports from "./Reports";
import ApplicationList from "./ApplicationList";
import ApplicationTracking from "./ApplicationTracking";
import Settings from "./Components/Settings";
import ApplicationCatalog from "./ApplicationCatalog";
import ErrorPage from "./Components/ErrorPage";
import RoleProtectedRoute from "./Components/RoleProtectedRoute";
import NotFound from "./NotFound";
import AccessDenied from "./Components/AccessDenied";
import ForgotPassword from "./ForgotPassword";
import Update from "./Update";
import Maps from "./Pages/Maps";

function RecoveryRedirector() {
  const navigate = useNavigate();
  useEffect(() => {
    if (window.location.hash.includes("type=recovery")) {
      navigate("/update" + window.location.hash, { replace: true });
    }
  }, [navigate]);
  return null;
}

function App() {
  return (
    <Router>
      <RecoveryRedirector />
      <Routes>
        {/* Public routes without layout */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/update" element={<Update />} />

        {/* Protected routes with layout */}
        <Route path="/" element={<Layout />}>
          <Route path="Dashboard" element={
            <RoleProtectedRoute 
              element={<Dashboard />} 
              allowedRoles={[1,2,3,4]} 
            />
          } />
          <Route path="Maps" element={
            <RoleProtectedRoute 
              element={<Maps />} 
              allowedRoles={[1,4]} 
            />
          } />
          <Route path="ApplicationCatalog" element={
            <RoleProtectedRoute 
              element={<ApplicationCatalog />} 
              allowedRoles={[1,2,3,4]} 
            />
          } />
          <Route path="MyApplication" element={
            <RoleProtectedRoute 
              element={<MyApplication />} 
              allowedRoles={[1,3,4]} 
            />
          } />
          {/* Admin/Manager only routes */}
          <Route path="User" element={
            <RoleProtectedRoute 
              element={<User />} 
              allowedRoles={[1]} 
              errorMessage="Only Admin and Manager roles can access user management"
            />
          } />
          <Route path="ApplicationList" element={
            <RoleProtectedRoute 
              element={<ApplicationList />} 
              allowedRoles={[1, 2]} 
              errorMessage="Only Admin and Manager roles can access the application list"
            />
          } />
          <Route path="Reports" element={
            <RoleProtectedRoute 
              element={<Reports />} 
              allowedRoles={[1, 2]} 
              errorMessage="Only Admin and Manager roles can access reports"
            />
          } />
          <Route path="Settings" element={
            <RoleProtectedRoute 
              element={<Settings />} 
              allowedRoles={[1,2,3,4]} 
            />
          } />
          <Route path="application/:id" element={
            <RoleProtectedRoute 
              element={<ApplicationTracking />} 
              allowedRoles={[1,2,3,4]} 
            />
          } />
          <Route path="Tracking/:id" element={
            <RoleProtectedRoute>
              <ApplicationTracking />
            </RoleProtectedRoute>
          } />
          {/* Error pages */}
          <Route path="forbidden" element={<AccessDenied requiredRoles={[1, 2]} />} />
          <Route path="not-found" element={<ErrorPage statusCode={404} />} />
          {/* Redirect to not-found if no route matches within layout */}
          <Route path="*" element={<Navigate to="/not-found" replace />} />
        </Route>

        {/* Catch-all route outside the layout */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}

export default App;
