
// // // import React, { useState, useEffect } from "react";
// // // import { useNavigate, useLocation } from "react-router-dom";
// // // import {
// // //   Eye,
// // //   EyeOff,
// // //   Loader2,
// // //   Lock,
// // //   Mail,
// // //   UserCog,
// // // } from "lucide-react";

// // // import { useAuth } from "./AuthContext";
// // // import { ROLES, ROLE_LABELS, ROLE_DASHBOARD } from "./MenuConfig";

// // // import "./login.css";

// // // export default function Login() {
// // //   const navigate = useNavigate();
// // //   const location = useLocation();
// // //   const { login, isAuthenticated, user } = useAuth();

// // //   const [form, setForm] = useState({
// // //     email: "",
// // //     password: "",
// // //     role: ROLES.ORG_SUPER_ADMIN,
// // //   });
// // //   const [showPwd, setShowPwd] = useState(false);
// // //   const [error, setError] = useState("");
// // //   const [loading, setLoading] = useState(false);

// // //   useEffect(() => {
// // //     if (isAuthenticated && user) {
// // //       navigate(ROLE_DASHBOARD[user.role] || "/", { replace: true });
// // //     }
// // //   }, [isAuthenticated, user, navigate]);

// // //   const update = (key) => (e) => {
// // //     setForm((f) => ({ ...f, [key]: e.target.value }));
// // //     setError("");
// // //   };

// // //   const handleSubmit = async (e) => {
// // //     e.preventDefault();
// // //     setError("");

// // //     if (!form.role) return setError("Please select a role.");
// // //     if (!form.email.trim()) return setError("Please enter your email.");
// // //     if (!form.password) return setError("Please enter your password.");

// // //     setLoading(true);

// // //     try {
// // //       const res = await fetch("http://localhost:8000/api/auth/login/", {
// // //         method: "POST",
// // //         headers: { "Content-Type": "application/json" },
// // //         body: JSON.stringify({
// // //           email: form.email.trim(),
// // //           password: form.password,
// // //           role: form.role,
// // //         }),
// // //       });

// // //       const data = await res.json();

// // //       if (!res.ok) {
// // //         const msg =
// // //           data.detail ||
// // //           data.non_field_errors?.[0] ||
// // //           Object.values(data).flat()[0] ||
// // //           "Login failed.";
// // //         throw new Error(msg);
// // //       }

// // //       // Store token
// // //       localStorage.setItem("token", data.token);

// // //       login({
// // //         id: data.user.id,
// // //         name: data.user.name,
// // //         email: data.user.email,
// // //         role: data.user.role,
// // //         scopeId: data.user.scope_id,
// // //         scopeName: data.user.scope_name,
// // //         loginAt: new Date().toISOString(),
// // //       });

// // //       const redirectTo =
// // //         data.redirect ||
// // //         location.state?.from?.pathname ||
// // //         ROLE_DASHBOARD[data.user.role] ||
// // //         "/";

// // //       navigate(redirectTo, { replace: true });
// // //     } catch (err) {
// // //       setError(err.message || "Login failed. Please try again.");
// // //       setLoading(false);
// // //     }
// // //   };

// // //   return (
// // //     <div className="login-page">
// // //       <div className="login-card">

// // //         <main className="login-form-wrap">
// // //           <header className="login-head">
// // //             <h2>Sign in</h2>
// // //             <p>Select your role and continue to your dashboard</p>
// // //           </header>

// // //           {error && (
// // //             <div className="login-error" role="alert">
// // //               {error}
// // //             </div>
// // //           )}

// // //           <form onSubmit={handleSubmit} noValidate>
// // //             {/* ROLE */}
// // //             <div className="field">
// // //               <label htmlFor="role">Login as</label>
// // //               <div className="input-wrap">
// // //                 <UserCog size={17} className="input-icon" />
// // //                 <select id="role" value={form.role} onChange={update("role")}>
// // //                   {Object.entries(ROLE_LABELS).map(([key, label]) => (
// // //                     <option key={key} value={key}>
// // //                       {label}
// // //                     </option>
// // //                   ))}
// // //                 </select>
// // //               </div>
// // //             </div>

// // //             <div className="field">
// // //               <label htmlFor="email">Email / User ID</label>
// // //               <div className="input-wrap">
// // //                 <Mail size={17} className="input-icon" />
// // //                 <input
// // //                   id="email"
// // //                   type="email"
// // //                   autoComplete="username"
// // //                   placeholder="you@company.com"
// // //                   value={form.email}
// // //                   onChange={update("email")}
// // //                 />
// // //               </div>
// // //             </div>

// // //             {/* PASSWORD */}
// // //             <div className="field">
// // //               <label htmlFor="password">Password</label>
// // //               <div className="input-wrap">
// // //                 <Lock size={17} className="input-icon" />
// // //                 <input
// // //                   id="password"
// // //                   type={showPwd ? "text" : "password"}
// // //                   autoComplete="current-password"
// // //                   placeholder="••••••••"
// // //                   value={form.password}
// // //                   onChange={update("password")}
// // //                 />
// // //                 <button
// // //                   type="button"
// // //                   className="pwd-toggle"
// // //                   onClick={() => setShowPwd((s) => !s)}
// // //                   aria-label={showPwd ? "Hide password" : "Show password"}
// // //                 >
// // //                   {showPwd ? <EyeOff size={17} /> : <Eye size={17} />}
// // //                 </button>
// // //               </div>
// // //             </div>

// // //             <button className="login-btn" type="submit" disabled={loading}>
// // //               {loading ? (
// // //                 <>
// // //                   <Loader2 size={18} className="spin" /> Signing in…
// // //                 </>
// // //               ) : (
// // //                 "Sign in"
// // //               )}
// // //             </button>
// // //           </form>
// // //         </main>
// // //       </div>
// // //     </div>
// // //   );
// // // }



// // import React, { useState, useEffect } from "react";
// // import { useNavigate, useLocation } from "react-router-dom";
// // import {
// //   Eye,
// //   EyeOff,
// //   Loader2,
// //   Lock,
// //   Mail,
// //   UserCog,
// // } from "lucide-react";

// // import { useAuth } from "./AuthContext";
// // import { ROLES, ROLE_LABELS, ROLE_DASHBOARD } from "./MenuConfig";

// // import "./login.css";

// // export default function Login() {
// //   const navigate = useNavigate();
// //   const location = useLocation();
// //   const { login, isAuthenticated, user } = useAuth();

// //   const [form, setForm] = useState({
// //     email: "",
// //     password: "",
// //     role: ROLES.ORG_SUPER_ADMIN,
// //   });
// //   const [showPwd, setShowPwd] = useState(false);
// //   const [error, setError] = useState("");
// //   const [loading, setLoading] = useState(false);

// //   useEffect(() => {
// //     if (isAuthenticated && user) {
// //       navigate(ROLE_DASHBOARD[user.role] || "/", { replace: true });
// //     }
// //   }, [isAuthenticated, user, navigate]);

// //   const update = (key) => (e) => {
// //     setForm((f) => ({ ...f, [key]: e.target.value }));
// //     setError("");
// //   };

// //   const handleSubmit = async (e) => {
// //     e.preventDefault();
// //     setError("");

// //     if (!form.role) return setError("Please select a role.");
// //     if (!form.email.trim()) return setError("Please enter your email.");
// //     if (!form.password) return setError("Please enter your password.");

// //     setLoading(true);

// //     try {
// //       const res = await fetch("http://localhost:8000/api/auth/login/", {
// //       // const res = await fetch("http://localhost:8000/login/", {
// //         method: "POST",
// //         headers: { "Content-Type": "application/json" },
// //         body: JSON.stringify({
// //           email: form.email.trim(),
// //           password: form.password,
// //           role: form.role,
// //         }),
// //       });

// //       const data = await res.json();

// //       if (!res.ok) {
// //         const msg =
// //           data.detail ||
// //           data.non_field_errors?.[0] ||
// //           Object.values(data).flat()[0] ||
// //           "Login failed.";
// //         throw new Error(msg);
// //       }

// //       // Store token
// //       localStorage.setItem("token", data.token);

// //       // Keep the complete server-side scope in AuthContext.
// //       // The dashboard uses these fields to build role-aware filters.
// //       login({
// //         ...data.user,
// //         id: data.user.id,
// //         name: data.user.name,
// //         email: data.user.email,
// //         role: data.user.role,
// //         scopeId: data.user.scope_id,
// //         scopeName: data.user.scope_name,
// //         customerHierarchyType: data.user.customer_hierarchy_type,
// //         customer_hierarchy_type: data.user.customer_hierarchy_type,
// //         stateId: data.user.state,
// //         stateName: data.user.state_name,
// //         zoneId: data.user.zone,
// //         zoneName: data.user.zone_name,
// //         loginAt: new Date().toISOString(),
// //       });

// //       const redirectTo =
// //         data.redirect ||
// //         location.state?.from?.pathname ||
// //         ROLE_DASHBOARD[data.user.role] ||
// //         "/";

// //       navigate(redirectTo, { replace: true });
// //     } catch (err) {
// //       setError(err.message || "Login failed. Please try again.");
// //       setLoading(false);
// //     }
// //   };

// //   return (
// //     <div className="login-page">
// //       <div className="login-card">

// //         <main className="login-form-wrap">
// //           <header className="login-head">
// //             <h2>Sign in</h2>
// //             <p>Select your role and continue to your dashboard</p>
// //           </header>

// //           {error && (
// //             <div className="login-error" role="alert">
// //               {error}
// //             </div>
// //           )}

// //           <form onSubmit={handleSubmit} noValidate>
// //             {/* ROLE */}
// //             <div className="field">
// //               <label htmlFor="role">Login as</label>
// //               <div className="input-wrap">
// //                 <UserCog size={17} className="input-icon" />
// //                 <select id="role" value={form.role} onChange={update("role")}>
// //                   {Object.entries(ROLE_LABELS).map(([key, label]) => (
// //                     <option key={key} value={key}>
// //                       {label}
// //                     </option>
// //                   ))}
// //                 </select>
// //               </div>
// //             </div>

// //             <div className="field">
// //               <label htmlFor="email">Email / User ID</label>
// //               <div className="input-wrap">
// //                 <Mail size={17} className="input-icon" />
// //                 <input
// //                   id="email"
// //                   type="email"
// //                   autoComplete="username"
// //                   placeholder="you@company.com"
// //                   value={form.email}
// //                   onChange={update("email")}
// //                 />
// //               </div>
// //             </div>

// //             {/* PASSWORD */}
// //             <div className="field">
// //               <label htmlFor="password">Password</label>
// //               <div className="input-wrap">
// //                 <Lock size={17} className="input-icon" />
// //                 <input
// //                   id="password"
// //                   type={showPwd ? "text" : "password"}
// //                   autoComplete="current-password"
// //                   placeholder="••••••••"
// //                   value={form.password}
// //                   onChange={update("password")}
// //                 />
// //                 <button
// //                   type="button"
// //                   className="pwd-toggle"
// //                   onClick={() => setShowPwd((s) => !s)}
// //                   aria-label={showPwd ? "Hide password" : "Show password"}
// //                 >
// //                   {showPwd ? <EyeOff size={17} /> : <Eye size={17} />}
// //                 </button>
// //               </div>
// //             </div>

// //             <button className="login-btn" type="submit" disabled={loading}>
// //               {loading ? (
// //                 <>
// //                   <Loader2 size={18} className="spin" /> Signing in…
// //                 </>
// //               ) : (
// //                 "Sign in"
// //               )}
// //             </button>
// //           </form>
// //         </main>
// //       </div>
// //     </div>
// //   );
// // }



// import React, { useState, useEffect } from "react";
// import { useNavigate, useLocation } from "react-router-dom";
// import {
//   Eye,
//   EyeOff,
//   Loader2,
//   Lock,
//   Mail,
//   UserCog,
// } from "lucide-react";

// import { useAuth } from "./AuthContext";
// import { ROLES, ROLE_LABELS, ROLE_DASHBOARD } from "./MenuConfig";

// import "./login.css";

// const API_BASE_URL = "http://localhost:8000/api";

// export default function Login() {
//   const navigate = useNavigate();
//   const location = useLocation();
//   const { login, isAuthenticated, user } = useAuth();

//   const [form, setForm] = useState({
//     email: "",
//     password: "",
//     role: ROLES.ORG_SUPER_ADMIN,
//   });

//   const [showPwd, setShowPwd] = useState(false);
//   const [error, setError] = useState("");
//   const [loading, setLoading] = useState(false);

//   useEffect(() => {
//     if (isAuthenticated && user) {
//       navigate(ROLE_DASHBOARD[user.role] || "/", {
//         replace: true,
//       });
//     }
//   }, [isAuthenticated, user, navigate]);

//   const update = (key) => (e) => {
//     setForm((prev) => ({
//       ...prev,
//       [key]: e.target.value,
//     }));

//     setError("");
//   };

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     setError("");

//     if (!form.role) {
//       setError("Please select a role.");
//       return;
//     }

//     if (!form.email.trim()) {
//       setError("Please enter your email.");
//       return;
//     }

//     if (!form.password) {
//       setError("Please enter your password.");
//       return;
//     }

//     setLoading(true);

//     try {
//       const response = await fetch(
//         `${API_BASE_URL}/auth/login/`,
//         {
//           method: "POST",
//           headers: {
//             "Content-Type": "application/json",
//             Accept: "application/json",
//           },
//           body: JSON.stringify({
//             email: form.email.trim(),
//             password: form.password,
//             role: form.role,
//           }),
//         }
//       );

//       let data;

//       try {
//         data = await response.json();
//       } catch {
//         throw new Error(
//           `Server returned HTTP ${response.status} without valid JSON.`
//         );
//       }

//       // console.log("LOGIN STATUS:", response.status);
//       // console.log("LOGIN RESPONSE:", data);

//       if (!response.ok) {
//         const msg =
//           data?.detail ||
//           data?.message ||
//           data?.non_field_errors?.[0] ||
//           (data && Object.values(data).flat()?.[0]) ||
//           `Login failed with HTTP ${response.status}.`;

//         throw new Error(msg);
//       }

//       if (!data?.user) {
//         throw new Error("Login succeeded but user information was not returned.");
//       }

//       /*
//        * Store token only when the backend actually returns one.
//        */
//       if (data.token) {
//         localStorage.setItem("token", data.token);
//       }

//       login({
//         ...data.user,

//         id: data.user.id,
//         name: data.user.name,
//         email: data.user.email,
//         role: data.user.role,

//         scopeId: data.user.scope_id,
//         scopeName: data.user.scope_name,

//         customerHierarchyType:
//           data.user.customer_hierarchy_type,

//         customer_hierarchy_type:
//           data.user.customer_hierarchy_type,

//         stateId: data.user.state,
//         stateName: data.user.state_name,

//         zoneId: data.user.zone,
//         zoneName: data.user.zone_name,

//         loginAt: new Date().toISOString(),
//       });

//       const redirectTo =
//         data.redirect ||
//         location.state?.from?.pathname ||
//         ROLE_DASHBOARD[data.user.role] ||
//         "/";

//       navigate(redirectTo, {
//         replace: true,
//       });
//     } catch (err) {
//       console.error("LOGIN ERROR:", err);

//       setError(
//         err?.message ||
//           "Login failed. Please check your credentials and try again."
//       );
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="login-page">
//       <div className="login-card">
//         <main className="login-form-wrap">
//           <header className="login-head">
//             <h2>Sign in</h2>
//             <p>
//               Select your role and continue to your dashboard
//             </p>
//           </header>

//           {error && (
//             <div className="login-error" role="alert">
//               {error}
//             </div>
//           )}

//           <form onSubmit={handleSubmit} noValidate>
//             {/* ROLE */}
//             <div className="field">
//               <label htmlFor="role">
//                 Login as
//               </label>

//               <div className="input-wrap">
//                 <UserCog
//                   size={17}
//                   className="input-icon"
//                 />

//                 <select
//                   id="role"
//                   value={form.role}
//                   onChange={update("role")}
//                   disabled={loading}
//                 >
//                   {Object.entries(ROLE_LABELS).map(
//                     ([key, label]) => (
//                       <option
//                         key={key}
//                         value={key}
//                       >
//                         {label}
//                       </option>
//                     )
//                   )}
//                 </select>
//               </div>
//             </div>

//             {/* EMAIL */}
//             <div className="field">
//               <label htmlFor="email">
//                 Email / User ID
//               </label>

//               <div className="input-wrap">
//                 <Mail
//                   size={17}
//                   className="input-icon"
//                 />

//                 <input
//                   id="email"
//                   type="email"
//                   autoComplete="username"
//                   placeholder="you@company.com"
//                   value={form.email}
//                   onChange={update("email")}
//                   disabled={loading}
//                 />
//               </div>
//             </div>

//             {/* PASSWORD */}
//             <div className="field">
//               <label htmlFor="password">
//                 Password
//               </label>

//               <div className="input-wrap">
//                 <Lock
//                   size={17}
//                   className="input-icon"
//                 />

//                 <input
//                   id="password"
//                   type={showPwd ? "text" : "password"}
//                   autoComplete="current-password"
//                   placeholder="••••••••"
//                   value={form.password}
//                   onChange={update("password")}
//                   disabled={loading}
//                 />

//                 <button
//                   type="button"
//                   className="pwd-toggle"
//                   onClick={() =>
//                     setShowPwd((prev) => !prev)
//                   }
//                   aria-label={
//                     showPwd
//                       ? "Hide password"
//                       : "Show password"
//                   }
//                   disabled={loading}
//                 >
//                   {showPwd ? (
//                     <EyeOff size={17} />
//                   ) : (
//                     <Eye size={17} />
//                   )}
//                 </button>
//               </div>
//             </div>

//             {/* LOGIN BUTTON */}
//             <button
//               className="login-btn"
//               type="submit"
//               disabled={loading}
//             >
//               {loading ? (
//                 <>
//                   <Loader2
//                     size={18}
//                     className="spin"
//                   />
//                   Signing in…
//                 </>
//               ) : (
//                 "Sign in"
//               )}
//             </button>
//           </form>
//         </main>
//       </div>
//     </div>
//   );
// }


import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  UserCog,
} from "lucide-react";

import { useAuth } from "./AuthContext";
import { ROLES, ROLE_LABELS, ROLE_DASHBOARD } from "./MenuConfig";

import "./login.css";

const API_BASE_URL = "http://localhost:8000/api";

/* =========================================================
   TOKEN STORAGE HELPERS
   ---------------------------------------------------------
   - token            → Django DRF token   (app session, permanent)
   - tp_token         → 3TP JWT            (short-lived, for proxy calls)
   - tp_refresh_token → 3TP refresh token  (silently renews tp_token)
========================================================= */

export const storeTokens = ({
  token,
  tp_token,
  tp_refresh_token,
  refreshToken,
}) => {
  if (token) {
    localStorage.setItem("token", token);
  }
  if (tp_token) {
    localStorage.setItem("tp_token", tp_token);
  }
  // Accept either key shape — different backends name it differently
  const refresh = tp_refresh_token || refreshToken;
  if (refresh) {
    localStorage.setItem("tp_refresh_token", refresh);
  }
};

export const clearTokens = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("tp_token");
  localStorage.removeItem("tp_refresh_token");
};

export const getAppToken = () =>
  localStorage.getItem("token") || "";

export const getTpToken = () =>
  localStorage.getItem("tp_token") || "";

/* =========================================================
   AUTH HEADERS
   ---------------------------------------------------------
   - authHeaders()   → for *your* Django API (uses DRF token)
   - tpAuthHeaders() → for 3TP-proxied endpoints (uses 3TP JWT)
========================================================= */

export const authHeaders = () => {
  const t = getAppToken();
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(t ? { Authorization: `Token ${t}` } : {}),
  };
};

export const tpAuthHeaders = () => {
  const t = getTpToken();
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
  };
};

/* =========================================================
   SILENT 3TP REFRESH
   ---------------------------------------------------------
   Call this whenever a 3TP-proxied endpoint returns 401.
   On success the new tokens are written to localStorage and
   the caller can retry the original request once.
========================================================= */

export async function refreshTpToken() {
  const refresh = localStorage.getItem("tp_refresh_token");
  if (!refresh) return false;

  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
    });

    if (!res.ok) return false;

    const data = await res.json().catch(() => ({}));
    if (data?.token) localStorage.setItem("tp_token", data.token);
    if (data?.refreshToken) localStorage.setItem("tp_refresh_token", data.refreshToken);

    return Boolean(data?.token);
  } catch {
    return false;
  }
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, user } = useAuth();

  const [form, setForm] = useState({
    email: "",
    password: "",
    role: ROLES.ORG_SUPER_ADMIN,
  });

  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user) {
      navigate(ROLE_DASHBOARD[user.role] || "/", {
        replace: true,
      });
    }
  }, [isAuthenticated, user, navigate]);

  const update = (key) => (e) => {
    setForm((prev) => ({
      ...prev,
      [key]: e.target.value,
    }));

    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.role) {
      setError("Please select a role.");
      return;
    }

    if (!form.email.trim()) {
      setError("Please enter your email.");
      return;
    }

    if (!form.password) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          email: form.email.trim(),
          password: form.password,
          role: form.role,
        }),
      });

      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error(
          `Server returned HTTP ${response.status} without valid JSON.`
        );
      }

      if (!response.ok) {
        const msg =
          data?.detail ||
          data?.message ||
          data?.non_field_errors?.[0] ||
          (data && Object.values(data).flat()?.[0]) ||
          `Login failed with HTTP ${response.status}.`;

        throw new Error(msg);
      }

      if (!data?.user) {
        throw new Error("Login succeeded but user information was not returned.");
      }

      /* =====================================================
         1. STORE TOKENS
         -----------------------------------------------------
         The backend now returns:
           { token: <DRF>, tp_token: <3TP JWT>, tp_refresh_token: <3TP refresh> }
         Old backends that only return `token` (a 3TP JWT) still work:
         we just won't have a separate tp_token — the header helpers
         already fall back gracefully.
      ===================================================== */
      storeTokens({
        token: data.token,               // app session (DRF)
        tp_token: data.tp_token,         // 3TP JWT (may be absent on old backends)
        tp_refresh_token:
          data.tp_refresh_token ?? data.refreshToken,
      });

      /* =====================================================
         2. HAND OFF TO AUTH CONTEXT
      ===================================================== */
      login({
        ...data.user,

        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        role: data.user.role,

        scopeId: data.user.scope_id,
        scopeName: data.user.scope_name,

        customerHierarchyType: data.user.customer_hierarchy_type,
        customer_hierarchy_type: data.user.customer_hierarchy_type,

        stateId: data.user.state,
        stateName: data.user.state_name,

        zoneId: data.user.zone,
        zoneName: data.user.zone_name,

        loginAt: new Date().toISOString(),
      });

      const redirectTo =
        data.redirect ||
        location.state?.from?.pathname ||
        ROLE_DASHBOARD[data.user.role] ||
        "/";

      navigate(redirectTo, { replace: true });
    } catch (err) {
      console.error("LOGIN ERROR:", err);

      setError(
        err?.message ||
          "Login failed. Please check your credentials and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <main className="login-form-wrap">
          <header className="login-head">
            <h2>Sign in</h2>
            <p>Select your role and continue to your dashboard</p>
          </header>

          {error && (
            <div className="login-error" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {/* ROLE */}
            <div className="field">
              <label htmlFor="role">Login as</label>

              <div className="input-wrap">
                <UserCog size={17} className="input-icon" />

                <select
                  id="role"
                  value={form.role}
                  onChange={update("role")}
                  disabled={loading}
                >
                  {Object.entries(ROLE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* EMAIL */}
            <div className="field">
              <label htmlFor="email">Email / User ID</label>

              <div className="input-wrap">
                <Mail size={17} className="input-icon" />

                <input
                  id="email"
                  type="email"
                  autoComplete="username"
                  placeholder="you@company.com"
                  value={form.email}
                  onChange={update("email")}
                  disabled={loading}
                />
              </div>
            </div>

            {/* PASSWORD */}
            <div className="field">
              <label htmlFor="password">Password</label>

              <div className="input-wrap">
                <Lock size={17} className="input-icon" />

                <input
                  id="password"
                  type={showPwd ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={update("password")}
                  disabled={loading}
                />

                <button
                  type="button"
                  className="pwd-toggle"
                  onClick={() => setShowPwd((prev) => !prev)}
                  aria-label={showPwd ? "Hide password" : "Show password"}
                  disabled={loading}
                >
                  {showPwd ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <button className="login-btn" type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 size={18} className="spin" />
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </button>
          </form>
        </main>
      </div>
    </div>
  );
}