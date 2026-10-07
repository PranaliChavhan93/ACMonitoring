import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./Pages/Layout/AuthContext";
import { ROLES, ROLE_DASHBOARD } from "./Pages/Layout/MenuConfig";
import ProtectedRoute from "./Pages/Layout/ProtectedRoute";

import Layout from "./Pages/Layout/Layout";

import Login from "./Pages/Layout/Login";

import Org_Dashboard from "./Pages/Organization/Org_Dashboard";
import Customer_Creation from "./Pages/Organization/CustomerCreation";
import Admin_Creation from "./Pages/Organization/AdminCreation";

import Cust_Dashboard from "./Pages/Customer/Cust_Dashboard";
import Admin_Dashboard from "./Pages/Admin/Admin_Dashbaord";
import Eng_Dashboard from "./Pages/Engineer/Eng_Dashboard";
import EngCreation from "./Pages/Organization/EngCreation";
import Locations from "./Pages/Organization/Locations";
import ACCreation from "./Pages/Organization/ACCreation";
import Treands from "./Second_Person/Forntend/Treands";

import AIAnalysisPage from "./Second_Person/Forntend/AIAnalysisPage";

function RootRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={ROLE_DASHBOARD[user.role] || "/login"} replace />;
}

function Page({ roles, children }) {
  return (
    <ProtectedRoute allowedRoles={roles}>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<Login />} />

          <Route
            path="/org/dashboard"
            element={
              <Page roles={[ROLES.ORG_SUPER_ADMIN]}>
                <Org_Dashboard />
              </Page>
            }
          />

          <Route
            path="/org/customers"
            element={
              <Page roles={[ROLES.ORG_SUPER_ADMIN]}>
                <Customer_Creation />
              </Page>
            }
          />

          <Route
            path="/org/admins"
            element={
              <Page roles={[ROLES.ORG_SUPER_ADMIN]}>
                <Admin_Creation />
              </Page>
            }
          />

          <Route
            path="/org/engineers"
            element={
              <Page roles={[ROLES.ORG_SUPER_ADMIN]}>
                <EngCreation />
              </Page>
            }
          />

          <Route
            path="/org/locations"
            element={
              // <Page roles={[ROLES.ENGINEER]}>
              <Page roles={[ROLES.ORG_SUPER_ADMIN]}>
                <Locations />
              </Page>
            }
          />

          <Route
            path="/org/device"
            element={
              <Page>
                <ACCreation />
              </Page>
            }
          />

          <Route
            path="/org/dashboard/trends"
            element={
              <Page>
                <Treands />
              </Page>
            }
          />

          <Route
            path="/customer/dashboard"
            element={
              <Page roles={[ROLES.CUSTOMER]}>
                <Cust_Dashboard />
              </Page>
            }
          />

          <Route path="/locations"
            element={
              <Page roles={[ROLES.CUSTOMER]}>
                <Locations />
              </Page>
            }
          />

          <Route path="/device"
            element={
              <Page roles={[ROLES.CUSTOMER]}>
                <ACCreation />
              </Page>
            }
          />

          <Route path="/org/dashboard/ai-analysis"
            element={
              <Page>
                <AIAnalysisPage />
              </Page>
            }
          />

          <Route path="/admins"
            element={
              <Page roles={[ROLES.CUSTOMER]}>
                <Admin_Creation />
              </Page>
            }
          />

          <Route path="/engineers"
            element={
              <Page roles={[ROLES.CUSTOMER]}>
                <EngCreation />
              </Page>
            }
          />

          <Route path="/reports"
            element={
              <Page roles={[ROLES.CUSTOMER]}>
                null
              </Page>
            }
          />

          <Route path="/settings"
            element={
              <Page roles={[ROLES.CUSTOMER]}>
                null
              </Page>
            }
          />

          <Route
            path="/admin/dashboard"
            element={
              <Page
                roles={[
                  // ROLES.ZONAL_ADMIN,
                  // ROLES.CIRCLE_ADMIN,
                  ROLES.BR_ADMIN,
                ]}
              >
                <Admin_Dashboard />
              </Page>
            }
          />

          <Route
            path="/admin/sites"
            element={
              <Page roles={[ROLES.BR_ADMIN]}>
                <Locations />
              </Page>
            }
          />

          <Route
            path="/admin/device"
            element={
              <Page roles={[ROLES.BR_ADMIN]}>
                <ACCreation />
              </Page>
            }
          />

          <Route
            path="/engineer/sites"
            element={
              <Page roles={[ROLES.ENGINEER]}>
                <Locations />
              </Page>
            }
          />

          <Route
            path="/engineer/dashboard"
            element={
              <Page roles={[ROLES.ENGINEER]}>
                <Eng_Dashboard />
              </Page>
            }
          />

          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}