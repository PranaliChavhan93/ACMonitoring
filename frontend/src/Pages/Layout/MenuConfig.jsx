import {
  LayoutDashboard,
  Users,
  FileBarChart,
  Settings,
  UserCog,
  Ticket,
  ClipboardList,
  HardHat,
  Wrench,
  MapPin,
  Bell,
  Radio,
  MapPinned,
  AirVent,
} from "lucide-react";

export const ROLES = {
  ORG_SUPER_ADMIN: "ORG_SUPER_ADMIN",
  CUSTOMER: "CUSTOMER",
  BR_ADMIN: "BR_ADMIN",
  ENGINEER: "ENGINEER",

  // ZONAL_ADMIN: "ZONAL_ADMIN",
  // CIRCLE_ADMIN: "CIRCLE_ADMIN",
};

export const ROLE_LABELS = {
  [ROLES.ORG_SUPER_ADMIN]: "Super Admin",
  [ROLES.CUSTOMER]: "Customer",
  [ROLES.BR_ADMIN]: "Branch Admin",
  [ROLES.ENGINEER]: "Engineer",

  // [ROLES.ZONAL_ADMIN]: "Zonal Admin",
  // [ROLES.CIRCLE_ADMIN]: "Circle Admin",
};

export const ROLE_SCOPE = {
  [ROLES.ORG_SUPER_ADMIN]: null,
  [ROLES.CUSTOMER]: "CUSTOMER",
  [ROLES.BR_ADMIN]: "BRANCH",
  [ROLES.ENGINEER]: "SITE",

  // [ROLES.ZONAL_ADMIN]: "ZONE",
  // [ROLES.CIRCLE_ADMIN]: "CIRCLE",
};

export const ROLE_DASHBOARD = {
  [ROLES.ORG_SUPER_ADMIN]: "/org/dashboard",
  [ROLES.CUSTOMER]: "/customer/dashboard",
  [ROLES.BR_ADMIN]: "/admin/dashboard",
  [ROLES.ENGINEER]: "/engineer/dashboard",

  // [ROLES.ZONAL_ADMIN]: "/admin/dashboard",
  // [ROLES.CIRCLE_ADMIN]: "/admin/dashboard",
};

export const MENU_CONFIG = {
  [ROLES.ORG_SUPER_ADMIN]: [
    { label: "Dashboard", path: "/org/dashboard", icon: LayoutDashboard },
    {
      label: "Master",
      icon: UserCog,
      children: [
        { label: "Customers", path: "/org/customers", icon: Users },
        { label: "Admins", path: "/org/admins", icon: HardHat },
        { label: "Engineers", path: "/org/engineers", icon: Wrench },
      ],
    },
    { label: "Sites", path: "/org/locations", icon: MapPinned },
    { label: "AC's", path: "/org/device", icon: AirVent },
    { label: "Reports", path: "/org/reports", icon: FileBarChart },
    { label: "Settings", path: "/org/settings", icon: Settings },
  ],

  [ROLES.CUSTOMER]: [
    { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
    // {
    //   label: "Master",
    //   icon: UserCog,
    //   children: [
        { label: "Admins", path: "/admins", icon: HardHat },
        { label: "Engineers", path: "/engineers", icon: Wrench },
    //   ],
    // },
    { label: "Sites", path: "/locations", icon: MapPinned },
    { label: "AC's", path: "/device", icon: AirVent },
    { label: "Reports", path: "/reports", icon: FileBarChart },
    { label: "Settings", path: "/settings", icon: Settings },
  ],

  [ROLES.BR_ADMIN]: [
    { label: "Dashboard", path: "/admin/dashboard", icon: LayoutDashboard },
    { label: "Sites", path: "/admin/sites", icon: Radio },
    { label: "AC's", path: "/admin/device", icon: AirVent },
    { label: "Engineers", path: "/admin/engineers", icon: HardHat },
    // { label: "Tickets", path: "/admin/tickets", icon: Ticket },
    { label: "Reports", path: "/admin/reports", icon: FileBarChart },
  ],

  [ROLES.ENGINEER]: [
    { label: "Dashboard", path: "/engineer/dashboard", icon: LayoutDashboard },
    { label: "My Sites", path: "/engineer/sites", icon: MapPin },
    { label: "My Tasks", path: "/engineer/tasks", icon: ClipboardList },
    // { label: "Tickets", path: "/engineer/tickets", icon: Ticket },
    // { label: "Maintenance", path: "/engineer/maintenance", icon: Wrench },
    { label: "Alerts", path: "/engineer/alerts", icon: Bell },
  ],
};

const flattenMenu = (items = []) =>
  items.flatMap((item) => [
    ...(item.path ? [item] : []),
    ...flattenMenu(item.children || []),
  ]);

export const getMenusForRole = (role) => MENU_CONFIG[role] || [];

export const getDashboardPath = (role) => ROLE_DASHBOARD[role] || "/login";

export const canAccessPath = (role, path) =>
  flattenMenu(getMenusForRole(role)).some((m) => m.path === path);

export const getAllowedPaths = (role) =>
  flattenMenu(getMenusForRole(role)).map((m) => m.path);
