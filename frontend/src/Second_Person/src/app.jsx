// import { useEffect, useState } from "react";

// import Header from "./compenents/header";
// import SummaryCards from "./compenents/summarycards";
// import ACTable from "./compenents/ACTable";
// import ACCharts from "./compenents/ACCharts";

// const API_URL = "http://192.168.1.8:8000/api/ac-data/";

// function App() {
//     const [acData, setAcData] = useState([]);
//     const [loading, setLoading] = useState(true);
//     const [error, setError] = useState("");

//     const fetchACData = async () => {
//         try {
//             const response = await fetch(API_URL);

//             if (!response.ok) {
//                 throw new Error("Unable to connect to Django API");
//             }

//             const result = await response.json();

//             if (result.status === "success") {
//                 setAcData(result.data);
//                 setError("");
//             } else {
//                 setError(result.message || "API returned an error");
//             }
//         } catch (err) {
//             console.error(err);
//             setError(
//                 "Cannot connect to Django. Make sure Person 1's Django server is running."
//             );
//         } finally {
//             setLoading(false);
//         }
//     };

//     useEffect(() => {
//         fetchACData();

//         const interval = setInterval(() => {
//             fetchACData();
//         }, 2000);

//         return () => clearInterval(interval);
//     }, []);

//     return (
//         <div className="app">
//             <Header />

//             <main className="dashboard-container">

//                 {loading && (
//                     <div className="message">
//                         Loading AC data...
//                     </div>
//                 )}

//                 {error && (
//                     <div className="error">
//                         {error}
//                     </div>
//                 )}

//                 {!loading && !error && (
//                     <>
//                         <SummaryCards data={acData} />

//                         <ACCharts data={acData} />

//                         <ACTable data={acData} />
//                     </>
//                 )}

//             </main>
//         </div>
//     );
// }

// export default App;



// src/App.jsx
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ROLES, ROLE_DASHBOARD } from "./config/MenuConfig";
import { Layout } from "lucide-react";
import ProtectedRoute from "./components/ProtectedRoute";
import Sidebar from "./components/Sidebar";

import Login from "./pages/login";

import Org_Dashboard from "../../Pages/Organization/Org_Dashboard";
import Cust_Dashboard from "../../Pages/Customer/Cust_Dashboard";
import Admin_Dashboard from "../../Pages/Admin/Admin_Dashbaord";
import Eng_Dashboard from "../../Pages/Engineer/Eng_Dashboard";

function DashboardLayout({ children }) {
    return (
        <div style={{ display: "flex", minHeight: "100vh" }}>
        <Sidebar />
        <main style={{ flex: 1, padding: 24 }}>{children}</main>
        </div>
    );
}

function RootRedirect() {
    const { user } = useAuth();
    if (!user) return <Navigate to="/login" replace />;
    return <Navigate to={ROLE_DASHBOARD[user.role] || "/login"} replace />;
}

export default function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Routes>
                <Route path="/" element={<RootRedirect />} />
                <Route path="/login" element={<Login />} />

                {/* 1. ORGANIZATION / SUPER ADMIN */}
                <Route
                    path="/org/dashboard"
                    element={
                    <ProtectedRoute allowedRoles={[ROLES.ORG_SUPER_ADMIN]}>
                        <Layout>
                            <Org_Dashboard />
                        </Layout>
                    </ProtectedRoute>
                    }
                />
            
                {/* 2. CUSTOMER ADMIN */}
                <Route
                    path="/customer/dashboard"
                    element={
                    <ProtectedRoute allowedRoles={[ROLES.CUSTOMER]}>
                        <Layout>
                            <Cust_Dashboard />
                        </Layout>
                    </ProtectedRoute>
                    }
                />

                {/* 3,4,5. ZONAL / CIRCLE / BRANCH ADMIN -> shared admin dashboard */}
                <Route
                    path="/admin/dashboard"
                    element={
                    <ProtectedRoute
                        allowedRoles={[
                        // ROLES.ZONAL_ADMIN,
                        // ROLES.CIRCLE_ADMIN,
                        ROLES.BR_ADMIN,
                        ]}
                    >
                        <Layout>
                            <Admin_Dashboard />
                        </Layout>
                    </ProtectedRoute>
                    }
                />

                {/* 6. ENGINEER */}
                <Route
                    path="/engineer/dashboard"
                    element={
                    <ProtectedRoute allowedRoles={[ROLES.ENGINEER]}>
                        <Layout>
                            <Eng_Dashboard />
                        </Layout>
                    </ProtectedRoute>
                    }
                />

                {/* fallback */}
                <Route path="*" element={<RootRedirect />} />
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    );
}
