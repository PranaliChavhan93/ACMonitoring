
// import React, { useEffect, useMemo, useState } from "react";

// const API_ROOT =
//   (import.meta.env.VITE_API_BASE_URL ||
//     `http://${window.location.hostname}:8000/api`).replace(/\/$/, "");
// const API_BASE = `${API_ROOT}/v1/filters/locations/`;

// const DEFAULT_COUNTRY = "India";

// export const HIERARCHY_CONFIG = {
//   GEOGRAPHICAL: {
//     label: "Geographical",
//     levels: [
//       {
//         name: "country",
//         label: "Country",
//         field: "country_name",
//         childrenKey: "states",
//       },
//       {
//         name: "state",
//         label: "State",
//         field: "state_name",
//         childrenKey: "districts",
//       },
//       {
//         name: "district",
//         label: "District",
//         field: "district_name",
//         childrenKey: "talukas",
//       },
//       {
//         name: "taluka",
//         label: "Taluka",
//         field: "taluka_name",
//         childrenKey: "branches",
//       },
//       {
//         name: "branch",
//         label: "Branch",
//         field: "branch_name",
//         childrenKey: "devices",
//       },
//       {
//         name: "device",
//         label: "Available Devices",
//         field: "device_name",
//         childrenKey: null,
//       },
//     ],
//   },

//   ZONAL: {
//     label: "Zonal",
//     levels: [
//       {
//         name: "country",
//         label: "Country",
//         field: "country_name",
//         childrenKey: "zones",
//       },
//       {
//         name: "zone",
//         label: "Zone",
//         field: "zone_name",
//         childrenKey: "circles",
//       },
//       {
//         name: "circle",
//         label: "Circle",
//         field: "circle_name",
//         childrenKey: "regions",
//       },
//       {
//         name: "region",
//         label: "Region",
//         field: "region_name",
//         childrenKey: "divisions",
//       },
//       {
//         name: "division",
//         label: "Division",
//         field: "division_name",
//         childrenKey: "branches",
//       },
//       {
//         name: "branch",
//         label: "Branch",
//         field: "branch_name",
//         childrenKey: "devices",
//       },
//       {
//         name: "device",
//         label: "Available Devices",
//         field: "device_name",
//         childrenKey: null,
//       },
//     ],
//   },
// };


// const getDeviceId = (device) => {
//   if (typeof device === "string") return device.trim();

//   // Match Trends: telemetry rows are keyed by AC ID, not the 3TP UUID.
//   return (
//     device?.ac_id ||
//     device?.device_id ||
//     device?.id ||
//     device?.tpt_device_id ||
//     device?.thingsboard_device_id ||
//     device?.thingsboard_id ||
//     device?.device_uuid ||
//     device?.uuid ||
//     ""
//   );
// };

// const getDeviceName = (device) => {
//   if (typeof device === "string") return device;

//   return (
//     device?.device_name ||
//     device?.name ||
//     device?.ac_id ||
//     device?.label ||
//     getDeviceId(device) ||
//     "Unnamed device"
//   );
// };

// const getDevicesFromBranch = (branch) => {
//   if (!branch) return [];

//   // Prefer direct branch AC assignments. Older trees may keep ACs nested
//   // beneath site nodes, so read site.devices as a compatibility fallback.
//   const candidates = [
//     ...(Array.isArray(branch.devices) ? branch.devices : []),
//     ...(Array.isArray(branch.sites)
//       ? branch.sites.flatMap((site) =>
//           Array.isArray(site?.devices)
//             ? site.devices
//             : (site?.ac_id || site?.device_id)
//               ? [site]
//               : []
//         )
//       : []),
//   ];
//   const seen = new Set();

//   return candidates.filter((device) => {
//     const id = getDeviceId(device);
//     if (!id || seen.has(String(id))) return false;
//     seen.add(String(id));
//     return true;
//   });
// };



// const getAuthToken = () => {
//   const keys = [
//     "access_token",
//     "accessToken",
//     "token",
//     "authToken",
//     "jwt",
//     "id_token",
//   ];

//   for (const storage of [localStorage, sessionStorage]) {
//     for (const key of keys) {
//       const value = storage.getItem(key);
//       if (value) return value;
//     }
//   }

//   return null;
// };

// const getAllowedHierarchies = (allowedHierarchies) => {
//   if (!Array.isArray(allowedHierarchies)) {
//     return Object.keys(HIERARCHY_CONFIG);
//   }

//   const valid = allowedHierarchies.filter(
//     (key) => HIERARCHY_CONFIG[key]
//   );

//   return valid.length
//     ? valid
//     : Object.keys(HIERARCHY_CONFIG);
// };

// const pickHierarchy = (preferred, allowedKeys) => {
//   if (preferred && allowedKeys.includes(preferred)) {
//     return preferred;
//   }

//   return allowedKeys[0];
// };

// const buildSelection = (
//   value,
//   hierarchy,
//   lockedValues = {}
// ) => {
//   const levels = HIERARCHY_CONFIG[hierarchy]?.levels || [];

//   return Object.fromEntries(
//     levels.map((level) => [
//       level.name,
//       String(
//         lockedValues?.[level.name] ??
//         value?.[level.name] ??
//         (level.name === "country" ? DEFAULT_COUNTRY : "")
//       ).trim(),
//     ])
//   );
// };

// const FilterDashboard = ({
//   initialValue = null,
//   restoreVersion = 0,
//   allowedHierarchies,
//   lockedValues = {},
//   filters = {},
//   onFilterChange,
//   onReset,
// }) => {
//   const allowedKeys = useMemo(
//     () => getAllowedHierarchies(allowedHierarchies),
//     [allowedHierarchies]
//   );

//   const allowedSignature = allowedKeys.join("|");
//   const [filtersReady, setFiltersReady] = useState(false);
//   const initialHierarchy = pickHierarchy(
//     initialValue?.hierarchy,
//     allowedKeys
//   );

//   const [hierarchy, setHierarchy] =
//     useState(initialHierarchy);

//   const [tree, setTree] = useState([]);

//   const [selected, setSelected] = useState(() =>
//     buildSelection(
//       initialValue,
//       initialHierarchy,
//       lockedValues
//     )
//   );

//   const [loading, setLoading] = useState(false);

//   const [error, setError] = useState("");

//   const levels =
//     HIERARCHY_CONFIG[hierarchy]?.levels || [];

//   const showHierarchyToggle = allowedKeys.length > 1;

//   /*
//    * Keep hierarchy and selected values synchronized
//    * when customer/admin account or saved filters change.
//    */
//   useEffect(() => {
//     const nextHierarchy = pickHierarchy(
//       initialValue?.hierarchy,
//       allowedKeys
//     );

//     const nextSelection = buildSelection(
//       initialValue,
//       nextHierarchy,
//       lockedValues
//     );

//     setHierarchy((previous) =>
//       previous === nextHierarchy ? previous : nextHierarchy
//     );

//     setSelected((previous) =>
//       JSON.stringify(previous) === JSON.stringify(nextSelection)
//         ? previous
//         : nextSelection
//     );
//   }, [
//     restoreVersion,
//     allowedSignature,
//     JSON.stringify(lockedValues),
//   ]);

//   /*
//    * Fetch locations for the selected hierarchy.
//    */
//   useEffect(() => {
//     let cancelled = false;

//     const fetchLocations = async () => {
//       setLoading(true);
//       setError("");
//       setTree([]);

//       try {
//         const token = getAuthToken();

//         const headers = {
//           Accept: "application/json",
//         };

//         if (token) {
//           headers.Authorization = token.startsWith(
//             "Token "
//           )
//             ? token
//             : `Token ${token}`;
//         }

//         const url =
//           `${API_BASE}?hierarchy=${encodeURIComponent(
//             hierarchy
//           )}&t=${Date.now()}`;

//         const response = await fetch(url, {
//           method: "GET",
//           headers,
//           // credentials: "include",
//           cache: "no-store",
//         });

//         if (!response.ok) {
//           throw new Error(`HTTP ${response.status}`);
//         }

//         const result = await response.json();

//         console.log(
//           "[FilterDashboard] Location API status:",
//           response.status
//         );

//         console.log(
//           "[FilterDashboard] FULL LOCATION RESPONSE:",
//           JSON.stringify(result, null, 2)
//         );

//         // Declare locations BEFORE using it.
//         const locations = Array.isArray(result?.data)
//           ? result.data
//           : [];

//         console.log(
//           "[FilterDashboard] FULL LOCATION TREE:",
//           JSON.stringify(locations, null, 2)
//         );

//         setTree(locations);
//         if (!cancelled) {
//           const locations = Array.isArray(result?.data)
//             ? result.data
//             : [];

//           setTree(locations);

//           setSelected((previous) => {
//             const countryLevel = HIERARCHY_CONFIG[
//               hierarchy
//             ]?.levels.find((level) => level.name === "country");

//             if (!countryLevel) return previous;

//             const indiaExists = locations.some(
//               (item) =>
//                 String(item?.[countryLevel.field] || "")
//                   .trim()
//                   .toLowerCase() === "india"
//             );

//             if (!indiaExists) return previous;

//             return {
//               ...previous,
//               country:
//                 previous.country || DEFAULT_COUNTRY,
//             };
//           });
//         }
//       } catch (err) {
//         if (cancelled) return;

//         console.error("LOCATIONS API ERROR:", err);

//         setTree([]);
//         setError(
//           err?.message ||
//             "Unable to fetch filter locations."
//         );
//       } finally {
//         if (!cancelled) {
//           setLoading(false);
//         }
//       }
//     };

//     fetchLocations();

//     return () => {
//       cancelled = true;
//     };
//   }, [hierarchy]);

//   /*
//    * Restrict the tree according to the customer's/admin's
//    * locked hierarchy.
//    */
//   const filteredTree = useMemo(() => {
//     if (!Array.isArray(tree) || tree.length === 0) return [];

//     // A lock such as an admin's state or zone belongs to a nested node,
//     // not the root country node. Prune recursively so matching ancestors
//     // remain visible and only the permitted subtree is retained.
//     const activeLocks = levels
//       .map((level) => ({
//         field: level.field,
//         value: lockedValues?.[level.name],
//       }))
//       .filter(
//         ({ value }) =>
//           value !== undefined &&
//           value !== null &&
//           String(value).trim() !== ""
//       );

//     if (activeLocks.length === 0) return tree;

//     const pruneNode = (node) => {
//       if (Array.isArray(node)) {
//         return node.map(pruneNode).filter((item) => item !== null);
//       }

//       if (!node || typeof node !== "object") return node;

//       for (const { field, value } of activeLocks) {
//         if (
//           Object.prototype.hasOwnProperty.call(node, field) &&
//           String(node[field] ?? "").trim() !== String(value).trim()
//         ) {
//           return null;
//         }
//       }

//       const result = {};
//       for (const [key, value] of Object.entries(node)) {
//         if (Array.isArray(value)) {
//           result[key] = value.map(pruneNode).filter((item) => item !== null);
//         } else if (value && typeof value === "object") {
//           const pruned = pruneNode(value);
//           result[key] = pruned === null ? {} : pruned;
//         } else {
//           result[key] = value;
//         }
//       }
//       return result;
//     };

//     return tree.map(pruneNode).filter((item) => item !== null);
//   }, [tree, levels, JSON.stringify(lockedValues)]);

//   /*
//    * Build dropdown options based on the selected
//    * parent hierarchy.
//    */
  
//   const optionsByLevel = useMemo(() => {
//     const result = {};
//     let current = filteredTree;

//     // Build the normal nested hierarchy first.
//     levels.forEach((level, index) => {
//       const values = [];
//       const seen = new Set();

//       (current || []).forEach((item) => {
//         const value = item?.[level.field];

//         if (
//           value !== undefined &&
//           value !== null &&
//           String(value).trim() !== "" &&
//           !seen.has(String(value))
//         ) {
//           seen.add(String(value));
//           values.push(String(value));
//         }
//       });

//       result[level.name] = values;

//       const selectedValue = selected[level.name];

//       if (!selectedValue || !level.childrenKey) {
//         for (let i = index + 1; i < levels.length; i++) {
//           result[levels[i].name] = [];
//         }
//         return;
//       }

//       const match = (current || []).find(
//         (item) =>
//           String(item?.[level.field] || "") ===
//           String(selectedValue)
//       );

//       current = match?.[level.childrenKey] || [];
//     });

//     // Special handling for branches created directly
//     // under a Taluka in the geographical hierarchy.
    
//     if (hierarchy === "GEOGRAPHICAL") {
//       let nodes = filteredTree;

//       const parentLevels = [
//         { name: "country", field: "country_name", key: "states" },
//         { name: "state", field: "state_name", key: "districts" },
//         { name: "district", field: "district_name", key: "talukas" },
//       ];

//       for (const parent of parentLevels) {
//         const match = (nodes || []).find(
//           (item) =>
//             String(item?.[parent.field] || "") ===
//             String(selected[parent.name] || "")
//         );

//         nodes = match?.[parent.key] || [];
//       }

//       const talukaNode = (nodes || []).find(
//         (item) =>
//           String(item?.taluka_name || "") ===
//           String(selected.taluka || "")
//       );

//       if (talukaNode) {
//         const cities = Array.isArray(talukaNode.cities)
//           ? talukaNode.cities
//           : [];

//         const directBranches = Array.isArray(talukaNode.branches)
//           ? talukaNode.branches
//           : [];

//         const selectedCity = cities.find(
//           (city) =>
//             String(city?.city_name || "") ===
//             String(selected.city || "")
//         );

//         const cityBranches = Array.isArray(selectedCity?.branches)
//           ? selectedCity.branches
//           : [];

//         const branches = [
//           ...directBranches,
//           ...cityBranches,
//         ];

//         const uniqueBranches = [];
//         const seen = new Set();

//         branches.forEach((branch) => {
//           const name = String(branch?.branch_name || "").trim();

//           if (name && !seen.has(name)) {
//             seen.add(name);
//             uniqueBranches.push(branch);
//           }
//         });

//         result.branch = uniqueBranches.map(
//           (branch) => String(branch.branch_name)
//         );

//         const selectedBranch = uniqueBranches.find(
//           (branch) =>
//             String(branch?.branch_name || "") ===
//             String(selected.branch || "")
//         );

//         const devices = getDevicesFromBranch(selectedBranch);

//         result.device = devices.map((device) => ({
//           value: getDeviceId(device),
//           label: getDeviceName(device),
//           ac_id: device?.ac_id || (typeof device === "string" ? device : ""),
//         }));
//       }
//     } else {
//       // Zonal hierarchy: locate the selected branch and its devices.
//       const branchIndex = levels.findIndex(
//         (level) => level.name === "branch"
//       );

//       let nodes = filteredTree;
//       let selectedBranch = null;

//       for (let i = 0; i <= branchIndex; i++) {
//         const level = levels[i];

//         const match = (nodes || []).find(
//           (item) =>
//             String(item?.[level.field] || "") ===
//             String(selected[level.name] || "")
//         );

//         if (!match) {
//           selectedBranch = null;
//           break;
//         }

//         if (level.name === "branch") {
//           selectedBranch = match;
//           break;
//         }

//         nodes = match?.[level.childrenKey] || [];
//       }

//       const devices = getDevicesFromBranch(selectedBranch);

//       result.device = devices.map((device) => ({
//         value: getDeviceId(device),
//         label: getDeviceName(device),
//         ac_id: device?.ac_id || (typeof device === "string" ? device : ""),
//       }));
//     }


//     return result;
//   }, [filteredTree, levels, selected, hierarchy]);

//   useEffect(() => {
//     if (loading || !tree.length) return;

//     setSelected((previous) => {
//       const next = { ...previous };
//       let changed = false;

//       for (const level of levels) {
//         const currentValue = String(
//           next[level.name] || ""
//         ).trim();

//         const options = optionsByLevel[level.name] || [];

//         if (!currentValue) continue;

//         const matchedOption = options.find((option) => {
//           const optionValue =
//             typeof option === "object" && option !== null
//               ? option.value
//               : option;

//           return (
//             String(optionValue ?? "").trim().toLowerCase() ===
//             currentValue.toLowerCase()
//           );
//         });

//         if (matchedOption) {
//           const matchedValue =
//             typeof matchedOption === "object" &&
//             matchedOption !== null
//               ? matchedOption.value
//               : matchedOption;

//           if (String(matchedValue) !== currentValue) {
//             next[level.name] = String(matchedValue);
//             changed = true;
//           }
//         } else {
//           next[level.name] = "";
//           changed = true;
//         }
//       }

//       return changed ? next : previous;
//     });
//   }, [loading, tree, levels, optionsByLevel]);

//   useEffect(() => {
//     const deviceId = selected.device || "";
//     const selectedDevice = (optionsByLevel.device || []).find(
//       (option) => String(option?.value || "") === String(deviceId)
//     );
//     const acId = selectedDevice?.ac_id || "";

//     const nextFilters = {
//       hierarchy,
//       ...selected,
//       device: deviceId,
//       device_id: deviceId,
//       selectedDeviceId: deviceId,
//       ac_id: acId,
//       selectedAcId: acId,
//     };

//     onFilterChange?.(nextFilters);
//   }, [hierarchy, selected, optionsByLevel.device, onFilterChange]);
  
//   const changeHierarchy = (nextHierarchy) => {
//     if (!allowedKeys.includes(nextHierarchy)) {
//       return;
//     }

//     setHierarchy(nextHierarchy);

//     setSelected(
//       buildSelection(
//         null,
//         nextHierarchy,
//         lockedValues
//       )
//     );

//     setError("");
//   };

//   const changeLevel = (levelName, value) => {
//     if (lockedValues?.[levelName]) {
//       return;
//     }

//     const index = levels.findIndex(
//       (level) => level.name === levelName
//     );

//     if (index === -1) return;

//     setSelected((previous) => {
//       const next = {
//         ...previous,
//         [levelName]: value,
//       };

//       for (
//         let i = index + 1;
//         i < levels.length;
//         i++
//       ) {
//         const child = levels[i];

//         next[child.name] =
//           lockedValues?.[child.name] || "";
//       }

//       return next;
//     });
//   };

//   const reset = () => {
//     setSelected(
//       buildSelection(
//         null,
//         hierarchy,
//         lockedValues
//       )
//     );

//     setError("");
//     onReset?.();
//   };

//   return (
//     <div
//       className="filter-dashboard"
//       style={{
//         display: "flex",
//         alignItems: "center",
//         gap: "10px",
//         padding: "12px 15px",
//         background: "#ffffff",
//         border: "1px solid #e1e8f0",
//         borderRadius: "8px",
//         flexWrap: "wrap",
//       }}
//     >
//       {/* Hierarchy Toggle */}
//       {showHierarchyToggle && (
//         <div
//           style={{
//             display: "flex",
//             border: "1px solid #d1d5db",
//             borderRadius: "6px",
//             overflow: "hidden",
//             height: "35px",
//           }}
//         >
//           {allowedKeys.map((key) => {
//             const active = hierarchy === key;

//             return (
//               <button
//                 key={key}
//                 type="button"
//                 onClick={() => changeHierarchy(key)}
//                 style={{
//                   padding: "0 14px",
//                   border: "none",
//                   background: active
//                     ? "#2563eb"
//                     : "#ffffff",
//                   color: active
//                     ? "#ffffff"
//                     : "#374151",
//                   cursor: "pointer",
//                   fontSize: "12px",
//                   fontWeight: active ? 600 : 500,
//                 }}
//               >
//                 {HIERARCHY_CONFIG[key].label}
//               </button>
//             );
//           })}
//         </div>
//       )}

//       {/* Hierarchy Dropdowns */}
//       {levels.map((level, index) => {
//         const locked = lockedValues?.[level.name];
//         const parent = index > 0 ? levels[index - 1] : null;
//         const isDevice = level.name === "device";

//         const disabled =
//           Boolean(locked) ||
//           loading ||
//           (isDevice
//             ? !selected.branch
//             : index > 0 && !selected[parent.name]);

//         const options = isDevice
//           ? optionsByLevel.device || []
//           : (optionsByLevel[level.name] || []).map((value) => ({
//               value: String(value),
//               label: String(value),
//             }));

//         const deviceCount = (optionsByLevel.device || []).length;

//         return (
//           <select
//             key={level.name}
//             value={selected[level.name] || ""}
//             disabled={disabled}
//             className="filter-dropdown"
//             onChange={(event) =>
//               changeLevel(level.name, event.target.value)
//             }
//           >
//             {/* 1. "All" is now the first option and the default */}
//             <option value="">
//               {loading ? "Loading..." : "All"}
//             </option>

//             {/* 2. "Select..." is now the second option (disabled) */}
//             {!loading && (
//               <option value="" disabled>
//                 {isDevice
//                   ? `Available ACs (${deviceCount})`
//                   : `Select ${level.label}`}
//               </option>
//             )}

//             {/* 3. The actual data options */}
//             {options.map((option) => (
//               <option
//                 key={option.value}
//                 value={option.value}
//               >
//                 {option.label}
//               </option>
//             ))}
//           </select>
//         );
//       })}

//       {/* Reset Button */}
//       <button
//         type="button"
//         onClick={reset}
//         style={{
//           height: "35px",
//           padding: "0 14px",
//           border: "1px solid #d1d5db",
//           borderRadius: "5px",
//           background: "#ffffff",
//           cursor: "pointer",
//           fontSize: "12px",
//         }}
//       >
//         Reset
//       </button>

//       {/* Error */}
//       {error && (
//         <span
//           style={{
//             color: "#c0392b",
//             fontSize: "12px",
//           }}
//         >
//           {error}
//         </span>
//       )}
//     </div>
//   );
// };

// export default FilterDashboard;



import React, { useEffect, useMemo, useState } from "react";

const API_ROOT =
  (import.meta.env.VITE_API_BASE_URL ||
    `http://${window.location.hostname}:8000/api`).replace(/\/$/, "");
const API_BASE = `${API_ROOT}/v1/filters/locations/`;

const DEFAULT_COUNTRY = "India";

export const HIERARCHY_CONFIG = {
  GEOGRAPHICAL: {
    label: "Geographical",
    levels: [
      {
        name: "country",
        label: "Country",
        field: "country_name",
        childrenKey: "states",
      },
      {
        name: "state",
        label: "State",
        field: "state_name",
        childrenKey: "districts",
      },
      {
        name: "district",
        label: "District",
        field: "district_name",
        childrenKey: "talukas",
      },
      {
        name: "taluka",
        label: "Taluka",
        field: "taluka_name",
        childrenKey: "branches",
      },
      {
        name: "branch",
        label: "Branch",
        field: "branch_name",
        childrenKey: "devices",
      },
      {
        name: "device",
        label: "Available Devices",
        field: "device_name",
        childrenKey: null,
      },
    ],
  },

  ZONAL: {
    label: "Zonal",
    levels: [
      {
        name: "country",
        label: "Country",
        field: "country_name",
        childrenKey: "zones",
      },
      {
        name: "zone",
        label: "Zone",
        field: "zone_name",
        childrenKey: "circles",
      },
      {
        name: "circle",
        label: "Circle",
        field: "circle_name",
        childrenKey: "regions",
      },
      {
        name: "region",
        label: "Region",
        field: "region_name",
        childrenKey: "divisions",
      },
      {
        name: "division",
        label: "Division",
        field: "division_name",
        childrenKey: "branches",
      },
      {
        name: "branch",
        label: "Branch",
        field: "branch_name",
        childrenKey: "devices",
      },
      {
        name: "device",
        label: "Available Devices",
        field: "device_name",
        childrenKey: null,
      },
    ],
  },
};


const getDeviceId = (device) => {
  if (typeof device === "string") return device.trim();

  // Match Trends: telemetry rows are keyed by AC ID, not the 3TP UUID.
  return (
    device?.ac_id ||
    device?.device_id ||
    device?.id ||
    device?.tpt_device_id ||
    device?.thingsboard_device_id ||
    device?.thingsboard_id ||
    device?.device_uuid ||
    device?.uuid ||
    ""
  );
};

const getDeviceName = (device) => {
  if (typeof device === "string") return device;

  return (
    device?.device_name ||
    device?.name ||
    device?.ac_id ||
    device?.label ||
    getDeviceId(device) ||
    "Unnamed device"
  );
};

const getDevicesFromBranch = (branch) => {
  if (!branch) return [];

  // Prefer direct branch AC assignments. Older trees may keep ACs nested
  // beneath site nodes, so read site.devices as a compatibility fallback.
  const candidates = [
    ...(Array.isArray(branch.devices) ? branch.devices : []),
    ...(Array.isArray(branch.sites)
      ? branch.sites.flatMap((site) =>
          Array.isArray(site?.devices)
            ? site.devices
            : (site?.ac_id || site?.device_id)
              ? [site]
              : []
        )
      : []),
  ];
  const seen = new Set();

  return candidates.filter((device) => {
    const id = getDeviceId(device);
    if (!id || seen.has(String(id))) return false;
    seen.add(String(id));
    return true;
  });
};



const getAuthToken = () => {
  const keys = [
    "access_token",
    "accessToken",
    "token",
    "authToken",
    "jwt",
    "id_token",
  ];

  for (const storage of [localStorage, sessionStorage]) {
    for (const key of keys) {
      const value = storage.getItem(key);
      if (value) return value;
    }
  }

  return null;
};

const getAllowedHierarchies = (allowedHierarchies) => {
  if (!Array.isArray(allowedHierarchies)) {
    return Object.keys(HIERARCHY_CONFIG);
  }

  const valid = allowedHierarchies.filter(
    (key) => HIERARCHY_CONFIG[key]
  );

  return valid.length
    ? valid
    : Object.keys(HIERARCHY_CONFIG);
};

const pickHierarchy = (preferred, allowedKeys) => {
  if (preferred && allowedKeys.includes(preferred)) {
    return preferred;
  }

  return allowedKeys[0];
};

const buildSelection = (
  value,
  hierarchy,
  lockedValues = {}
) => {
  const levels = HIERARCHY_CONFIG[hierarchy]?.levels || [];

  return Object.fromEntries(
    levels.map((level) => [
      level.name,
      String(
        lockedValues?.[level.name] ??
        value?.[level.name] ??
        (level.name === "country" ? DEFAULT_COUNTRY : "")
      ).trim(),
    ])
  );
};

const FilterDashboard = ({
  initialValue = null,
  restoreVersion = 0,
  allowedHierarchies,
  lockedValues = {},
  filters = {},
  onFilterChange,
  onReset,
  actions,
}) => {
  const allowedKeys = useMemo(
    () => getAllowedHierarchies(allowedHierarchies),
    [allowedHierarchies]
  );

  const allowedSignature = allowedKeys.join("|");
  const [filtersReady, setFiltersReady] = useState(false);
  const initialHierarchy = pickHierarchy(
    initialValue?.hierarchy,
    allowedKeys
  );

  const [hierarchy, setHierarchy] =
    useState(initialHierarchy);

  const [tree, setTree] = useState([]);

  const [selected, setSelected] = useState(() =>
    buildSelection(
      initialValue,
      initialHierarchy,
      lockedValues
    )
  );

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  const levels =
    HIERARCHY_CONFIG[hierarchy]?.levels || [];

  const showHierarchyToggle = allowedKeys.length > 1;

  /*
   * Keep hierarchy and selected values synchronized
   * when customer/admin account or saved filters change.
   */
  useEffect(() => {
    const nextHierarchy = pickHierarchy(
      initialValue?.hierarchy,
      allowedKeys
    );

    const nextSelection = buildSelection(
      initialValue,
      nextHierarchy,
      lockedValues
    );

    setHierarchy((previous) =>
      previous === nextHierarchy ? previous : nextHierarchy
    );

    setSelected((previous) =>
      JSON.stringify(previous) === JSON.stringify(nextSelection)
        ? previous
        : nextSelection
    );
  }, [
    restoreVersion,
    allowedSignature,
    JSON.stringify(lockedValues),
  ]);

  /*
   * Fetch locations for the selected hierarchy.
   */
  useEffect(() => {
    let cancelled = false;

    const fetchLocations = async () => {
      setLoading(true);
      setError("");
      setTree([]);

      try {
        const token = getAuthToken();

        const headers = {
          Accept: "application/json",
        };

        if (token) {
          headers.Authorization = token.startsWith(
            "Token "
          )
            ? token
            : `Token ${token}`;
        }

        const url =
          `${API_BASE}?hierarchy=${encodeURIComponent(
            hierarchy
          )}&t=${Date.now()}`;

        const response = await fetch(url, {
          method: "GET",
          headers,
          // credentials: "include",
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();

        console.log(
          "[FilterDashboard] Location API status:",
          response.status
        );

        console.log(
          "[FilterDashboard] FULL LOCATION RESPONSE:",
          JSON.stringify(result, null, 2)
        );

        // Declare locations BEFORE using it.
        const locations = Array.isArray(result?.data)
          ? result.data
          : [];

        console.log(
          "[FilterDashboard] FULL LOCATION TREE:",
          JSON.stringify(locations, null, 2)
        );

        setTree(locations);
        if (!cancelled) {
          const locations = Array.isArray(result?.data)
            ? result.data
            : [];

          setTree(locations);

          setSelected((previous) => {
            const countryLevel = HIERARCHY_CONFIG[
              hierarchy
            ]?.levels.find((level) => level.name === "country");

            if (!countryLevel) return previous;

            const indiaExists = locations.some(
              (item) =>
                String(item?.[countryLevel.field] || "")
                  .trim()
                  .toLowerCase() === "india"
            );

            if (!indiaExists) return previous;

            return {
              ...previous,
              country:
                previous.country || DEFAULT_COUNTRY,
            };
          });
        }
      } catch (err) {
        if (cancelled) return;

        console.error("LOCATIONS API ERROR:", err);

        setTree([]);
        setError(
          err?.message ||
            "Unable to fetch filter locations."
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchLocations();

    return () => {
      cancelled = true;
    };
  }, [hierarchy]);

  /*
   * Restrict the tree according to the customer's/admin's
   * locked hierarchy.
   */
  const filteredTree = useMemo(() => {
    if (!Array.isArray(tree) || tree.length === 0) return [];

    // A lock such as an admin's state or zone belongs to a nested node,
    // not the root country node. Prune recursively so matching ancestors
    // remain visible and only the permitted subtree is retained.
    const activeLocks = levels
      .map((level) => ({
        field: level.field,
        value: lockedValues?.[level.name],
      }))
      .filter(
        ({ value }) =>
          value !== undefined &&
          value !== null &&
          String(value).trim() !== ""
      );

    if (activeLocks.length === 0) return tree;

    const pruneNode = (node) => {
      if (Array.isArray(node)) {
        return node.map(pruneNode).filter((item) => item !== null);
      }

      if (!node || typeof node !== "object") return node;

      for (const { field, value } of activeLocks) {
        if (
          Object.prototype.hasOwnProperty.call(node, field) &&
          String(node[field] ?? "").trim() !== String(value).trim()
        ) {
          return null;
        }
      }

      const result = {};
      for (const [key, value] of Object.entries(node)) {
        if (Array.isArray(value)) {
          result[key] = value.map(pruneNode).filter((item) => item !== null);
        } else if (value && typeof value === "object") {
          const pruned = pruneNode(value);
          result[key] = pruned === null ? {} : pruned;
        } else {
          result[key] = value;
        }
      }
      return result;
    };

    return tree.map(pruneNode).filter((item) => item !== null);
  }, [tree, levels, JSON.stringify(lockedValues)]);

  /*
   * Build dropdown options based on the selected
   * parent hierarchy.
   */
  
  const optionsByLevel = useMemo(() => {
    const result = {};
    let current = filteredTree;

    // Build the normal nested hierarchy first.
    levels.forEach((level, index) => {
      const values = [];
      const seen = new Set();

      (current || []).forEach((item) => {
        const value = item?.[level.field];

        if (
          value !== undefined &&
          value !== null &&
          String(value).trim() !== "" &&
          !seen.has(String(value))
        ) {
          seen.add(String(value));
          values.push(String(value));
        }
      });

      result[level.name] = values;

      const selectedValue = selected[level.name];

      if (!selectedValue || !level.childrenKey) {
        for (let i = index + 1; i < levels.length; i++) {
          result[levels[i].name] = [];
        }
        return;
      }

      const match = (current || []).find(
        (item) =>
          String(item?.[level.field] || "") ===
          String(selectedValue)
      );

      current = match?.[level.childrenKey] || [];
    });

    // Special handling for branches created directly
    // under a Taluka in the geographical hierarchy.
    
    if (hierarchy === "GEOGRAPHICAL") {
      let nodes = filteredTree;

      const parentLevels = [
        { name: "country", field: "country_name", key: "states" },
        { name: "state", field: "state_name", key: "districts" },
        { name: "district", field: "district_name", key: "talukas" },
      ];

      for (const parent of parentLevels) {
        const match = (nodes || []).find(
          (item) =>
            String(item?.[parent.field] || "") ===
            String(selected[parent.name] || "")
        );

        nodes = match?.[parent.key] || [];
      }

      const talukaNode = (nodes || []).find(
        (item) =>
          String(item?.taluka_name || "") ===
          String(selected.taluka || "")
      );

      if (talukaNode) {
        const cities = Array.isArray(talukaNode.cities)
          ? talukaNode.cities
          : [];

        const directBranches = Array.isArray(talukaNode.branches)
          ? talukaNode.branches
          : [];

        const selectedCity = cities.find(
          (city) =>
            String(city?.city_name || "") ===
            String(selected.city || "")
        );

        const cityBranches = Array.isArray(selectedCity?.branches)
          ? selectedCity.branches
          : [];

        const branches = [
          ...directBranches,
          ...cityBranches,
        ];

        const uniqueBranches = [];
        const seen = new Set();

        branches.forEach((branch) => {
          const name = String(branch?.branch_name || "").trim();

          if (name && !seen.has(name)) {
            seen.add(name);
            uniqueBranches.push(branch);
          }
        });

        result.branch = uniqueBranches.map(
          (branch) => String(branch.branch_name)
        );

        const selectedBranch = uniqueBranches.find(
          (branch) =>
            String(branch?.branch_name || "") ===
            String(selected.branch || "")
        );

        const devices = getDevicesFromBranch(selectedBranch);

        result.device = devices.map((device) => ({
          value: getDeviceId(device),
          label: getDeviceName(device),
          ac_id: device?.ac_id || (typeof device === "string" ? device : ""),
        }));
      }
    } else {
      // Zonal hierarchy: locate the selected branch and its devices.
      const branchIndex = levels.findIndex(
        (level) => level.name === "branch"
      );

      let nodes = filteredTree;
      let selectedBranch = null;

      for (let i = 0; i <= branchIndex; i++) {
        const level = levels[i];

        const match = (nodes || []).find(
          (item) =>
            String(item?.[level.field] || "") ===
            String(selected[level.name] || "")
        );

        if (!match) {
          selectedBranch = null;
          break;
        }

        if (level.name === "branch") {
          selectedBranch = match;
          break;
        }

        nodes = match?.[level.childrenKey] || [];
      }

      const devices = getDevicesFromBranch(selectedBranch);

      result.device = devices.map((device) => ({
        value: getDeviceId(device),
        label: getDeviceName(device),
        ac_id: device?.ac_id || (typeof device === "string" ? device : ""),
      }));
    }


    return result;
  }, [filteredTree, levels, selected, hierarchy]);

  useEffect(() => {
    if (loading || !tree.length) return;

    setSelected((previous) => {
      const next = { ...previous };
      let changed = false;

      for (const level of levels) {
        const currentValue = String(
          next[level.name] || ""
        ).trim();

        const options = optionsByLevel[level.name] || [];

        if (!currentValue) continue;

        const matchedOption = options.find((option) => {
          const optionValue =
            typeof option === "object" && option !== null
              ? option.value
              : option;

          return (
            String(optionValue ?? "").trim().toLowerCase() ===
            currentValue.toLowerCase()
          );
        });

        if (matchedOption) {
          const matchedValue =
            typeof matchedOption === "object" &&
            matchedOption !== null
              ? matchedOption.value
              : matchedOption;

          if (String(matchedValue) !== currentValue) {
            next[level.name] = String(matchedValue);
            changed = true;
          }
        } else {
          next[level.name] = "";
          changed = true;
        }
      }

      return changed ? next : previous;
    });
  }, [loading, tree, levels, optionsByLevel]);

  useEffect(() => {
    const deviceId = selected.device || "";
    const selectedDevice = (optionsByLevel.device || []).find(
      (option) => String(option?.value || "") === String(deviceId)
    );
    const acId = selectedDevice?.ac_id || "";

    const nextFilters = {
      hierarchy,
      ...selected,
      device: deviceId,
      device_id: deviceId,
      selectedDeviceId: deviceId,
      ac_id: acId,
      selectedAcId: acId,
    };

    onFilterChange?.(nextFilters);
  }, [hierarchy, selected, optionsByLevel.device, onFilterChange]);
  
  const changeHierarchy = (nextHierarchy) => {
    if (!allowedKeys.includes(nextHierarchy)) {
      return;
    }

    setHierarchy(nextHierarchy);

    setSelected(
      buildSelection(
        null,
        nextHierarchy,
        lockedValues
      )
    );

    setError("");
  };

  const changeLevel = (levelName, value) => {
    if (lockedValues?.[levelName]) {
      return;
    }

    const index = levels.findIndex(
      (level) => level.name === levelName
    );

    if (index === -1) return;

    setSelected((previous) => {
      const next = {
        ...previous,
        [levelName]: value,
      };

      for (
        let i = index + 1;
        i < levels.length;
        i++
      ) {
        const child = levels[i];

        next[child.name] =
          lockedValues?.[child.name] || "";
      }

      return next;
    });
  };

  const reset = () => {
    setSelected(
      buildSelection(
        null,
        hierarchy,
        lockedValues
      )
    );

    setError("");
    onReset?.();
  };

  return (
    <div
      className="filter-dashboard"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "12px 15px",
        background: "#ffffff",
        border: "1px solid #e1e8f0",
        borderRadius: "8px",
        flexWrap: "wrap",
      }}
    >
      {/* Hierarchy Toggle */}
      {showHierarchyToggle && (
        <div
          style={{
            display: "flex",
            border: "1px solid #d1d5db",
            borderRadius: "6px",
            overflow: "hidden",
            height: "35px",
          }}
        >
          {allowedKeys.map((key) => {
            const active = hierarchy === key;

            return (
              <button
                key={key}
                type="button"
                onClick={() => changeHierarchy(key)}
                style={{
                  padding: "0 14px",
                  border: "none",
                  background: active
                    ? "#2563eb"
                    : "#ffffff",
                  color: active
                    ? "#ffffff"
                    : "#374151",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: active ? 600 : 500,
                }}
              >
                {HIERARCHY_CONFIG[key].label}
              </button>
            );
          })}
        </div>
      )}

      {/* Dashboard Action Buttons - LEFT SIDE */}
      {/* {actions && (
          <div className="filter-dashboard-actions">
              {actions}
          </div>
      )} */}

      {/* Hierarchy Dropdowns */}
      {levels.map((level, index) => {
        const locked = lockedValues?.[level.name];
        const parent = index > 0 ? levels[index - 1] : null;
        const isDevice = level.name === "device";

        const disabled =
          Boolean(locked) ||
          loading ||
          (isDevice
            ? !selected.branch
            : index > 0 && !selected[parent.name]);

        const options = isDevice
          ? optionsByLevel.device || []
          : (optionsByLevel[level.name] || []).map((value) => ({
              value: String(value),
              label: String(value),
            }));

        const deviceCount = (optionsByLevel.device || []).length;

        return (
          <select
            key={level.name}
            value={selected[level.name] || ""}
            disabled={disabled}
            className="filter-dropdown"
            onChange={(event) =>
              changeLevel(level.name, event.target.value)
            }
          >
            {/* 1. "All" is now the first option and the default */}
            <option value="">
              {loading ? "Loading..." : "All"}
            </option>

            {/* 2. "Select..." is now the second option (disabled) */}
            {!loading && (
              <option value="" disabled>
                {isDevice
                  ? `Available ACs (${deviceCount})`
                  : `Select ${level.label}`}
              </option>
            )}

            {/* 3. The actual data options */}
            {options.map((option) => (
              <option
                key={option.value}
                value={option.value}
              >
                {option.label}
              </option>
            ))}
          </select>
        );
      })}

      {/* Reset Button */}
      <button
        type="button"
        onClick={reset}
        style={{
          height: "35px",
          padding: "0 14px",
          border: "1px solid #d1d5db",
          borderRadius: "5px",
          background: "#ffffff",
          cursor: "pointer",
          fontSize: "12px",
        }}
      >
        Reset
      </button>

      {/* Dashboard Action Buttons */}
      {actions && (
        <div className="filter-dashboard-actions">
          {actions}
        </div>
      )}

      {/* Error */}
      {error && (
        <span
          style={{
            color: "#c0392b",
            fontSize: "12px",
          }}
        >
          {error}
        </span>
      )}
    </div>
  );
};

export default FilterDashboard;