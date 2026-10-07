
import { useState } from "react";
import { Menu } from "lucide-react";
import Sidebar from "./Sidebar";
import { useAuth } from "./AuthContext";
import { ROLE_LABELS } from "./MenuConfig";
import "./Layout.css";

function Layout({ children }) {
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const displayName   = user?.scope_name || user?.name || "User";
  const secondaryName = user?.scope_name ? user?.name : null;

  const role = user?.role || "";
  const roleLabel = ROLE_LABELS[role] || role;

  const initials =
    (displayName || "U")
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "U";

  const handleToggle = () => {
    if (window.innerWidth <= 900) setMobileOpen((o) => !o);
    else setCollapsed((c) => !c);
  };

  return (
    <div className={`layout ${collapsed ? "collapsed" : ""}`}>
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />

      <div
        className={`sidebar-backdrop ${mobileOpen ? "show" : ""}`}
        onClick={() => setMobileOpen(false)}
      />

      <div className="main-content">
        <header className="top-navbar">
          <div className="nav-left">
            <button
              className="icon-btn"
              onClick={handleToggle}
              aria-label="Toggle sidebar"
            >
              <Menu size={20} />
            </button>
          </div>

          <div className="profile-section">
            <div className="welcome-text">
              <p>Welcome,</p>
              <h4>{displayName}</h4><h6>{secondaryName}</h6>
              {/* {secondaryName && (
                <span className="profile-sub">{secondaryName}</span>
              )} */}
              {role && <span className="role-badge">{roleLabel}</span>}
            </div>

            <div className="profile-logo" title={secondaryName || displayName}>
              {initials}
            </div>
          </div>
        </header>

        <main className="content">{children}</main>
      </div>
    </div>
  );
}

export default Layout;