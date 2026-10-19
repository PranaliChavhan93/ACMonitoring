
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { LogOut, X, ChevronDown } from "lucide-react";
import { useAuth } from "./AuthContext";
import { getMenusForRole } from "./MenuConfig";
import "./Sidebar.css";

const isPathActive = (pathname, path) => {
  if (!path) return false;
  return pathname === path || pathname.startsWith(`${path}/`);
};

const hasActiveChild = (item, pathname) => {
  if (!item?.children?.length) return false;

  return item.children.some(
    (child) =>
      isPathActive(pathname, child.path) || hasActiveChild(child, pathname)
  );
};

function Sidebar({ collapsed, mobileOpen, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [openGroups, setOpenGroups] = useState({});

  const menu = useMemo(() => getMenusForRole(user?.role), [user?.role]);

  useEffect(() => {
    const activeGroups = {};

    const collectActiveGroups = (items) => {
      items.forEach((item) => {
        if (item.children?.length && hasActiveChild(item, pathname)) {
          activeGroups[item.label] = true;
          collectActiveGroups(item.children);
        }
      });
    };

    collectActiveGroups(menu);

    if (Object.keys(activeGroups).length) {
      setOpenGroups((prev) => ({ ...prev, ...activeGroups }));
    }
  }, [menu, pathname]);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const handleNavigate = (path) => {
    if (!path) return;

    navigate(path);
    onClose?.();
  };

  const toggleGroup = (label) => {
    setOpenGroups((prev) => ({
      ...prev,
      [label]: !prev[label],
    }));
  };

  const renderItems = (items, level = 0) =>
    items.map((item) => {
      const Icon = item.icon;
      const hasChildren =
        Array.isArray(item.children) && item.children.length > 0;

      const isActive =
        isPathActive(pathname, item.path) || hasActiveChild(item, pathname);

      const isOpen = !!openGroups[item.label];

      if (hasChildren) {
        return (
          <div key={item.label} className="nav-group">
            <button
              type="button"
              className={`nav-item ${isActive ? "active" : ""}`}
              onClick={() => toggleGroup(item.label)}
              title={collapsed ? item.label : undefined}
              style={{ paddingLeft: `${12 + level * 14}px` }}
            >
              <span className="nav-icon">
                {Icon ? <Icon size={18} /> : null}
              </span>

              <span className="nav-label">{item.label}</span>

              <span className={`nav-chevron ${isOpen ? "open" : ""}`}>
                <ChevronDown size={16} />
              </span>
            </button>

            {isOpen && (
              <div className="nav-children">
                {renderItems(item.children, level + 1)}
              </div>
            )}
          </div>
        );
      }

      return (
        <button
          key={item.path || item.label}
          type="button"
          className={`nav-item ${isActive ? "active" : ""}`}
          onClick={() => handleNavigate(item.path)}
          title={collapsed ? item.label : undefined}
          style={{ paddingLeft: `${12 + level * 14}px` }}
        >
          <span className="nav-icon">
            {Icon ? <Icon size={18} /> : null}
          </span>

          <span className="nav-label">{item.label}</span>
        </button>
      );
    });

  if (!user) return null;

  return (
    <aside
      className={[
        "sidebar",
        collapsed ? "collapsed" : "",
        mobileOpen ? "mobile-open" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >

      <div className="sidebar-brand">
        <div className="project-brand" aria-label="Project name">
          <span className="project-brand__mark">AC</span>
          <span className="project-brand__copy">
            {!collapsed && (
              <>
                <strong>AC Energy Monitoring</strong>
                <small>Live energy intelligence</small>
              </>
            )}
          </span>
        </div>

        <button
          type="button"
          className="sidebar-close"
          onClick={onClose}
          aria-label="Close menu"
        >
          <X size={18} />
        </button>
      </div>

      <nav className="sidebar-nav">{renderItems(menu)}</nav>

      <div className="sidebar-foot">
        <button type="button" className="logout-btn" onClick={handleLogout}>
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;