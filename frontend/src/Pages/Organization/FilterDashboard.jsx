
// // // // // import React, { useEffect, useMemo, useState } from "react";

// // // // // const API_BASE = "http://localhost:8000/api/v1/filters/locations/";

// // // // // const HIERARCHY_CONFIG = {
// // // // //   GEOGRAPHICAL: {
// // // // //     label: "Geographical",
// // // // //     levels: [
// // // // //       { name: "state",    label: "State",    field: "state_name",    childrenKey: "districts" },
// // // // //       { name: "district", label: "District", field: "district_name", childrenKey: "talukas"   },
// // // // //       { name: "taluka",   label: "Taluka",   field: "taluka_name",   childrenKey: "cities"    },
// // // // //       { name: "city",     label: "City",     field: "city_name",     childrenKey: "branches"  },
// // // // //       { name: "branch",   label: "Branch",   field: "branch_name",   childrenKey: "floors"    },
// // // // //       { name: "floor",    label: "Floor",    field: "floor_name",    childrenKey: null        },
// // // // //     ],
// // // // //   },
// // // // //   ZONAL: {
// // // // //     label: "Zonal",
// // // // //     levels: [
// // // // //       { name: "zone",     label: "Zone",     field: "zone_name",     childrenKey: "circles"   },
// // // // //       { name: "circle",   label: "Circle",   field: "circle_name",   childrenKey: "regions"   },
// // // // //       { name: "region",   label: "Region",   field: "region_name",   childrenKey: "divisions" },
// // // // //       { name: "division", label: "Division", field: "division_name", childrenKey: "branches"  },
// // // // //       { name: "branch",   label: "Branch",   field: "branch_name",   childrenKey: "floors"    },
// // // // //       { name: "floor",    label: "Floor",    field: "floor_name",    childrenKey: null        },
// // // // //     ],
// // // // //   },
// // // // // };

// // // // // const FilterDashboard = ({ onFilterChange, onReset }) => {
// // // // //   const [hierarchy, setHierarchy] = useState("GEOGRAPHICAL");
// // // // //   const [tree, setTree]           = useState([]);
// // // // //   const [loading, setLoading]     = useState(false);
// // // // //   const [error, setError]         = useState("");
// // // // //   const [selected, setSelected]   = useState({});

// // // // //   useEffect(() => {
// // // // //     let cancelled = false;

// // // // //     setLoading(true);
// // // // //     setError("");
// // // // //     setTree([]);
// // // // //     setSelected({});

// // // // //     (async () => {
// // // // //       try {
// // // // //         const url =
// // // // //           `${API_BASE}?hierarchy=${encodeURIComponent(hierarchy)}` +
// // // // //           `&t=${Date.now()}`;

// // // // //         const res = await fetch(url, { cache: "no-store" });
// // // // //         if (!res.ok) throw new Error(`HTTP ${res.status}`);

// // // // //         const result = await res.json();
// // // // //         if (cancelled) return;

// // // // //         const data = Array.isArray(result?.data) ? result.data : [];
// // // // //         setTree(data);
// // // // //       } catch (err) {
// // // // //         if (cancelled) return;
// // // // //         console.error("LOCATIONS API ERROR:", err);
// // // // //         setError(err.message || "Unable to fetch filter locations.");
// // // // //         setTree([]);
// // // // //       } finally {
// // // // //         if (!cancelled) setLoading(false);
// // // // //       }
// // // // //     })();

// // // // //     return () => {
// // // // //       cancelled = true;
// // // // //     };
// // // // //   }, [hierarchy]);

// // // // //   const levels = HIERARCHY_CONFIG[hierarchy].levels;

// // // // //   const optionsByLevel = useMemo(() => {
// // // // //     const result = {};
// // // // //     let current = tree;

// // // // //     for (let i = 0; i < levels.length; i++) {
// // // // //       const level = levels[i];

// // // // //       const seen   = new Set();
// // // // //       const values = [];
// // // // //       for (const item of current || []) {
// // // // //         const v = item[level.field];
// // // // //         if (v && !seen.has(v)) {
// // // // //           seen.add(v);
// // // // //           values.push(v);
// // // // //         }
// // // // //       }
// // // // //       result[level.name] = values;

// // // // //       const picked = selected[level.name];

// // // // //       if (!picked || !level.childrenKey) {
// // // // //         for (let j = i + 1; j < levels.length; j++) {
// // // // //           result[levels[j].name] = [];
// // // // //         }
// // // // //         break;
// // // // //       }

// // // // //       const matched = (current || []).find(
// // // // //         (item) => item[level.field] === picked
// // // // //       );
// // // // //       current = (matched && matched[level.childrenKey]) || [];
// // // // //     }

// // // // //     return result;
// // // // //   }, [tree, levels, selected]);

// // // // //   useEffect(() => {
// // // // //     if (typeof onFilterChange === "function") {
// // // // //       onFilterChange({ hierarchy, ...selected });
// // // // //     }
// // // // //   }, [hierarchy, selected, onFilterChange]);

// // // // //   const handleChange = (levelName, value) => {
// // // // //     const idx = levels.findIndex((l) => l.name === levelName);

// // // // //     setSelected((prev) => {
// // // // //       const next = { ...prev, [levelName]: value };
// // // // //       for (let i = idx + 1; i < levels.length; i++) {
// // // // //         next[levels[i].name] = "";
// // // // //       }
// // // // //       return next;
// // // // //     });
// // // // //   };

// // // // //   const handleReset = () => {
// // // // //     setSelected({});
// // // // //     if (typeof onReset === "function") onReset();
// // // // //   };

// // // // //   return (
// // // // //     <div
// // // // //       className="filter-dashboard"
// // // // //       style={{
// // // // //         display: "flex",
// // // // //         alignItems: "center",
// // // // //         gap: "10px",
// // // // //         padding: "12px 15px",
// // // // //         background: "#ffffff",
// // // // //         border: "1px solid #e1e8f0",
// // // // //         borderRadius: "8px",
// // // // //         flexWrap: "wrap",
// // // // //       }}
// // // // //     >
// // // // //       <div
// // // // //         style={{
// // // // //           display: "flex",
// // // // //           border: "1px solid #d1d5db",
// // // // //           borderRadius: "6px",
// // // // //           overflow: "hidden",
// // // // //           height: "35px",
// // // // //         }}
// // // // //       >
// // // // //         {Object.entries(HIERARCHY_CONFIG).map(([key, cfg]) => {
// // // // //           const active = hierarchy === key;
// // // // //           return (
// // // // //             <button
// // // // //               key={key}
// // // // //               type="button"
// // // // //               onClick={() => setHierarchy(key)}
// // // // //               style={{
// // // // //                 padding: "0 14px",
// // // // //                 border: "none",
// // // // //                 background: active ? "#2563eb" : "#ffffff",
// // // // //                 color: active ? "#ffffff" : "#374151",
// // // // //                 cursor: "pointer",
// // // // //                 fontSize: "12px",
// // // // //                 fontWeight: active ? 600 : 500,
// // // // //               }}
// // // // //             >
// // // // //               {cfg.label}
// // // // //             </button>
// // // // //           );
// // // // //         })}
// // // // //       </div>

// // // // //       {levels.map((level, index) => {
// // // // //         const parentLevel = index > 0 ? levels[index - 1] : null;
// // // // //         const disabled =
// // // // //           index === 0 ? loading : !selected[parentLevel.name];

// // // // //         const options = optionsByLevel[level.name] || [];
// // // // //         const placeholder =
// // // // //           loading && index === 0
// // // // //             ? "Loading..."
// // // // //             : `Select ${level.label}`;

// // // // //         return (
// // // // //           <select
// // // // //             key={level.name}
// // // // //             value={selected[level.name] || ""}
// // // // //             onChange={(e) => handleChange(level.name, e.target.value)}
// // // // //             disabled={disabled}
// // // // //             className="filter-dropdown"
// // // // //           >
// // // // //             <option value="">{placeholder}</option>
// // // // //             {options.map((opt) => (
// // // // //               <option key={opt} value={opt}>
// // // // //                 {opt}
// // // // //               </option>
// // // // //             ))}
// // // // //           </select>
// // // // //         );
// // // // //       })}

// // // // //       <button
// // // // //         type="button"
// // // // //         onClick={handleReset}
// // // // //         style={{
// // // // //           height: "35px",
// // // // //           padding: "0 14px",
// // // // //           border: "1px solid #d1d5db",
// // // // //           borderRadius: "5px",
// // // // //           background: "#ffffff",
// // // // //           cursor: "pointer",
// // // // //           fontSize: "12px",
// // // // //         }}
// // // // //       >
// // // // //         Reset
// // // // //       </button>

// // // // //       {error && (
// // // // //         <span style={{ color: "#c0392b", fontSize: "12px" }}>{error}</span>
// // // // //       )}
// // // // //     </div>
// // // // //   );
// // // // // };

// // // // // export default FilterDashboard;



// // // // import React, { useEffect, useMemo, useState } from "react";

// // // // const API_BASE = "http://192.168.1.12:8000/api/v1/filters/locations/";

// // // // const HIERARCHY_CONFIG = {
// // // //   GEOGRAPHICAL: {
// // // //     label: "Geographical",
// // // //     levels: [
// // // //       { name: "state",    label: "State",    field: "state_name",    childrenKey: "districts" },
// // // //       { name: "district", label: "District", field: "district_name", childrenKey: "talukas"   },
// // // //       { name: "taluka",   label: "Taluka",   field: "taluka_name",   childrenKey: "cities"    },
// // // //       { name: "city",     label: "City",     field: "city_name",     childrenKey: "branches"  },
// // // //       { name: "branch",   label: "Branch",   field: "branch_name",   childrenKey: "floors"    },
// // // //       { name: "floor",    label: "Floor",    field: "floor_name",    childrenKey: null        },
// // // //     ],
// // // //   },
// // // //   ZONAL: {
// // // //     label: "Zonal",
// // // //     levels: [
// // // //       { name: "zone",     label: "Zone",     field: "zone_name",     childrenKey: "circles"   },
// // // //       { name: "circle",   label: "Circle",   field: "circle_name",   childrenKey: "regions"   },
// // // //       { name: "region",   label: "Region",   field: "region_name",   childrenKey: "divisions" },
// // // //       { name: "division", label: "Division", field: "division_name", childrenKey: "branches"  },
// // // //       { name: "branch",   label: "Branch",   field: "branch_name",   childrenKey: "floors"    },
// // // //       { name: "floor",    label: "Floor",    field: "floor_name",    childrenKey: null        },
// // // //     ],
// // // //   },
// // // // };

// // // // const getAuthToken = () => {
// // // //   const keys = ["access_token", "accessToken", "token", "authToken", "jwt", "id_token"];
// // // //   for (const storage of [localStorage, sessionStorage]) {
// // // //     for (const k of keys) {
// // // //       const v = storage.getItem(k);
// // // //       if (v) return v;
// // // //     }
// // // //   }
// // // //   return null;
// // // // };

// // // // const FilterDashboard = ({ onFilterChange, onReset }) => {
// // // //   const [hierarchy, setHierarchy] = useState("GEOGRAPHICAL");
// // // //   const [tree, setTree]           = useState([]);
// // // //   const [loading, setLoading]     = useState(false);
// // // //   const [error, setError]         = useState("");
// // // //   const [selected, setSelected]   = useState({});

// // // //   useEffect(() => {
// // // //     let cancelled = false;

// // // //     setLoading(true);
// // // //     setError("");
// // // //     setTree([]);
// // // //     setSelected({});

// // // //     (async () => {
// // // //       try {
// // // //         const token = getAuthToken();
// // // //         const headers = { Accept: "application/json" };
// // // //         if (token) {
// // // //           headers.Authorization = token.startsWith("Token ") ? token : `Token ${token}`;
// // // //         }

// // // //         const url =
// // // //           `${API_BASE}?hierarchy=${encodeURIComponent(hierarchy)}` +
// // // //           `&t=${Date.now()}`;

// // // //         console.log("[FilterDashboard] GET", url, "hasToken:", Boolean(token));

// // // //         const res = await fetch(url, {
// // // //           method: "GET",
// // // //           cache: "no-store",
// // // //           credentials: "include",
// // // //           headers,
// // // //         });

// // // //         if (res.status === 401 || res.status === 403) {
// // // //           throw new Error("Session expired. Please sign in again.");
// // // //         }
// // // //         if (!res.ok) throw new Error(`HTTP ${res.status}`);

// // // //         const result = await res.json();
// // // //         if (cancelled) return;

// // // //         const data = Array.isArray(result?.data) ? result.data : [];
// // // //         setTree(data);
// // // //       } catch (err) {
// // // //         if (cancelled) return;
// // // //         console.error("LOCATIONS API ERROR:", err);
// // // //         setError(err.message || "Unable to fetch filter locations.");
// // // //         setTree([]);
// // // //       } finally {
// // // //         if (!cancelled) setLoading(false);
// // // //       }
// // // //     })();

// // // //     return () => {
// // // //       cancelled = true;
// // // //     };
// // // //   }, [hierarchy]);

// // // //   const levels = HIERARCHY_CONFIG[hierarchy].levels;

// // // //   const optionsByLevel = useMemo(() => {
// // // //     const result = {};
// // // //     let current = tree;

// // // //     for (let i = 0; i < levels.length; i++) {
// // // //       const level = levels[i];

// // // //       const seen   = new Set();
// // // //       const values = [];
// // // //       for (const item of current || []) {
// // // //         const v = item[level.field];
// // // //         if (v && !seen.has(v)) {
// // // //           seen.add(v);
// // // //           values.push(v);
// // // //         }
// // // //       }
// // // //       result[level.name] = values;

// // // //       const picked = selected[level.name];

// // // //       if (!picked || !level.childrenKey) {
// // // //         for (let j = i + 1; j < levels.length; j++) {
// // // //           result[levels[j].name] = [];
// // // //         }
// // // //         break;
// // // //       }

// // // //       const matched = (current || []).find((item) => item[level.field] === picked);
// // // //       current = (matched && matched[level.childrenKey]) || [];
// // // //     }

// // // //     return result;
// // // //   }, [tree, levels, selected]);

// // // //   useEffect(() => {
// // // //     if (typeof onFilterChange === "function") {
// // // //       onFilterChange({ hierarchy, ...selected });
// // // //     }
// // // //   }, [hierarchy, selected, onFilterChange]);

// // // //   const handleChange = (levelName, value) => {
// // // //     const idx = levels.findIndex((l) => l.name === levelName);

// // // //     setSelected((prev) => {
// // // //       const next = { ...prev, [levelName]: value };
// // // //       for (let i = idx + 1; i < levels.length; i++) {
// // // //         next[levels[i].name] = "";
// // // //       }
// // // //       return next;
// // // //     });
// // // //   };

// // // //   const handleReset = () => {
// // // //     setSelected({});
// // // //     if (typeof onReset === "function") onReset();
// // // //   };

// // // //   return (
// // // //     <div
// // // //       className="filter-dashboard"
// // // //       style={{
// // // //         display: "flex",
// // // //         alignItems: "center",
// // // //         gap: "10px",
// // // //         padding: "12px 15px",
// // // //         background: "#ffffff",
// // // //         border: "1px solid #e1e8f0",
// // // //         borderRadius: "8px",
// // // //         flexWrap: "wrap",
// // // //       }}
// // // //     >
// // // //       <div
// // // //         style={{
// // // //           display: "flex",
// // // //           border: "1px solid #d1d5db",
// // // //           borderRadius: "6px",
// // // //           overflow: "hidden",
// // // //           height: "35px",
// // // //         }}
// // // //       >
// // // //         {Object.entries(HIERARCHY_CONFIG).map(([key, cfg]) => {
// // // //           const active = hierarchy === key;
// // // //           return (
// // // //             <button
// // // //               key={key}
// // // //               type="button"
// // // //               onClick={() => setHierarchy(key)}
// // // //               style={{
// // // //                 padding: "0 14px",
// // // //                 border: "none",
// // // //                 background: active ? "#2563eb" : "#ffffff",
// // // //                 color: active ? "#ffffff" : "#374151",
// // // //                 cursor: "pointer",
// // // //                 fontSize: "12px",
// // // //                 fontWeight: active ? 600 : 500,
// // // //               }}
// // // //             >
// // // //               {cfg.label}
// // // //             </button>
// // // //           );
// // // //         })}
// // // //       </div>

// // // //       {levels.map((level, index) => {
// // // //         const parentLevel = index > 0 ? levels[index - 1] : null;
// // // //         const disabled = index === 0 ? loading : !selected[parentLevel.name];
// // // //         const options = optionsByLevel[level.name] || [];
// // // //         const placeholder = loading && index === 0 ? "Loading..." : `Select ${level.label}`;

// // // //         return (
// // // //           <select
// // // //             key={level.name}
// // // //             value={selected[level.name] || ""}
// // // //             onChange={(e) => handleChange(level.name, e.target.value)}
// // // //             disabled={disabled}
// // // //             className="filter-dropdown"
// // // //           >
// // // //             <option value="">{placeholder}</option>
// // // //             {options.map((opt) => (
// // // //               <option key={opt} value={opt}>
// // // //                 {opt}
// // // //               </option>
// // // //             ))}
// // // //           </select>
// // // //         );
// // // //       })}

// // // //       <button
// // // //         type="button"
// // // //         onClick={handleReset}
// // // //         style={{
// // // //           height: "35px",
// // // //           padding: "0 14px",
// // // //           border: "1px solid #d1d5db",
// // // //           borderRadius: "5px",
// // // //           background: "#ffffff",
// // // //           cursor: "pointer",
// // // //           fontSize: "12px",
// // // //         }}
// // // //       >
// // // //         Reset
// // // //       </button>

// // // //       {error && (
// // // //         <span style={{ color: "#c0392b", fontSize: "12px" }}>{error}</span>
// // // //       )}
// // // //     </div>
// // // //   );
// // // // };

// // // // export default FilterDashboard;


// // // import React, { useEffect, useMemo, useState } from "react";

// // // const API_BASE = "http://192.168.1.12:8000/api/v1/filters/locations/";

// // // export const HIERARCHY_CONFIG = {
// // //   GEOGRAPHICAL: {
// // //     label: "Geographical",
// // //     levels: [
// // //       { name: "state", label: "State", field: "state_name", childrenKey: "districts" },
// // //       { name: "district", label: "District", field: "district_name", childrenKey: "talukas" },
// // //       { name: "taluka", label: "Taluka", field: "taluka_name", childrenKey: "cities" },
// // //       { name: "city", label: "City", field: "city_name", childrenKey: "branches" },
// // //       { name: "branch", label: "Branch", field: "branch_name", childrenKey: "floors" },
// // //       { name: "floor", label: "Floor", field: "floor_name", childrenKey: null },
// // //     ],
// // //   },
// // //   ZONAL: {
// // //     label: "Zonal",
// // //     levels: [
// // //       { name: "zone", label: "Zone", field: "zone_name", childrenKey: "circles" },
// // //       { name: "circle", label: "Circle", field: "circle_name", childrenKey: "regions" },
// // //       { name: "region", label: "Region", field: "region_name", childrenKey: "divisions" },
// // //       { name: "division", label: "Division", field: "division_name", childrenKey: "branches" },
// // //       { name: "branch", label: "Branch", field: "branch_name", childrenKey: "floors" },
// // //       { name: "floor", label: "Floor", field: "floor_name", childrenKey: null },
// // //     ],
// // //   },
// // // };

// // // const getAuthToken = () => {
// // //   const keys = ["access_token", "accessToken", "token", "authToken", "jwt", "id_token"];
// // //   for (const storage of [localStorage, sessionStorage]) {
// // //     for (const key of keys) {
// // //       const value = storage.getItem(key);
// // //       if (value) return value;
// // //     }
// // //   }
// // //   return null;
// // // };

// // // const normalizeSelected = (value = {}, hierarchy = "GEOGRAPHICAL") => {
// // //   const levels = HIERARCHY_CONFIG[hierarchy]?.levels || [];
// // //   const next = {};

// // //   levels.forEach((level) => {
// // //     next[level.name] = value?.[level.name] || "";
// // //   });

// // //   return next;
// // // };

// // // const FilterDashboard = ({
// // //   initialValue = null,
// // //   restoreVersion = 0,
// // //   onFilterChange,
// // //   onReset,
// // // }) => {
// // //   const [hierarchy, setHierarchy] = useState(
// // //     initialValue?.hierarchy || "GEOGRAPHICAL"
// // //   );
// // //   const [tree, setTree] = useState([]);
// // //   const [loading, setLoading] = useState(false);
// // //   const [error, setError] = useState("");
// // //   const [selected, setSelected] = useState({});
// // //   const [lastRestoreVersion, setLastRestoreVersion] = useState(-1);

// // //   const levels = HIERARCHY_CONFIG[hierarchy].levels;

// // //   useEffect(() => {
// // //     if (restoreVersion === lastRestoreVersion) return;

// // //     setLastRestoreVersion(restoreVersion);

// // //     const nextHierarchy = initialValue?.hierarchy || "GEOGRAPHICAL";
// // //     setHierarchy(nextHierarchy);
// // //     setSelected(normalizeSelected(initialValue, nextHierarchy));
// // //   }, [restoreVersion, initialValue, lastRestoreVersion]);

// // //   useEffect(() => {
// // //     let cancelled = false;

// // //     setLoading(true);
// // //     setError("");
// // //     setTree([]);

// // //     (async () => {
// // //       try {
// // //         const token = getAuthToken();
// // //         const headers = { Accept: "application/json" };

// // //         if (token) {
// // //           headers.Authorization = token.startsWith("Token ")
// // //             ? token
// // //             : `Token ${token}`;
// // //         }

// // //         const url =
// // //           `${API_BASE}?hierarchy=${encodeURIComponent(hierarchy)}` +
// // //           `&t=${Date.now()}`;

// // //         const response = await fetch(url, {
// // //           method: "GET",
// // //           cache: "no-store",
// // //           credentials: "include",
// // //           headers,
// // //         });

// // //         if (response.status === 401 || response.status === 403) {
// // //           throw new Error("Session expired. Please sign in again.");
// // //         }

// // //         if (!response.ok) {
// // //           throw new Error(`HTTP ${response.status}`);
// // //         }

// // //         const result = await response.json();
// // //         if (cancelled) return;

// // //         setTree(Array.isArray(result?.data) ? result.data : []);
// // //       } catch (err) {
// // //         if (cancelled) return;
// // //         console.error("LOCATIONS API ERROR:", err);
// // //         setError(err.message || "Unable to fetch filter locations.");
// // //         setTree([]);
// // //       } finally {
// // //         if (!cancelled) setLoading(false);
// // //       }
// // //     })();

// // //     return () => {
// // //       cancelled = true;
// // //     };
// // //   }, [hierarchy]);

// // //   const optionsByLevel = useMemo(() => {
// // //     const result = {};
// // //     let current = tree;

// // //     for (let i = 0; i < levels.length; i += 1) {
// // //       const level = levels[i];
// // //       const seen = new Set();
// // //       const values = [];

// // //       for (const item of current || []) {
// // //         const value = item[level.field];
// // //         if (value && !seen.has(value)) {
// // //           seen.add(value);
// // //           values.push(value);
// // //         }
// // //       }

// // //       result[level.name] = values;

// // //       const picked = selected[level.name];

// // //       if (!picked || !level.childrenKey) {
// // //         for (let j = i + 1; j < levels.length; j += 1) {
// // //           result[levels[j].name] = [];
// // //         }
// // //         break;
// // //       }

// // //       const matched = (current || []).find(
// // //         (item) => item[level.field] === picked
// // //       );

// // //       current = (matched && matched[level.childrenKey]) || [];
// // //     }

// // //     return result;
// // //   }, [tree, levels, selected]);

// // //   useEffect(() => {
// // //     if (typeof onFilterChange !== "function") return;

// // //     onFilterChange({
// // //       hierarchy,
// // //       ...selected,
// // //     });
// // //   }, [hierarchy, selected, onFilterChange]);

// // //   const handleHierarchyChange = (nextHierarchy) => {
// // //     setHierarchy(nextHierarchy);
// // //     setSelected({});
// // //   };

// // //   const handleChange = (levelName, value) => {
// // //     const index = levels.findIndex((level) => level.name === levelName);

// // //     setSelected((previous) => {
// // //       const next = { ...previous, [levelName]: value };

// // //       for (let i = index + 1; i < levels.length; i += 1) {
// // //         next[levels[i].name] = "";
// // //       }

// // //       return next;
// // //     });
// // //   };

// // //   const handleReset = () => {
// // //     setSelected({});

// // //     if (typeof onReset === "function") {
// // //       onReset();
// // //     }
// // //   };

// // //   return (
// // //     <div
// // //       className="filter-dashboard"
// // //       style={{
// // //         display: "flex",
// // //         alignItems: "center",
// // //         gap: "10px",
// // //         padding: "12px 15px",
// // //         background: "#ffffff",
// // //         border: "1px solid #e1e8f0",
// // //         borderRadius: "8px",
// // //         flexWrap: "wrap",
// // //       }}
// // //     >
// // //       <div
// // //         style={{
// // //           display: "flex",
// // //           border: "1px solid #d1d5db",
// // //           borderRadius: "6px",
// // //           overflow: "hidden",
// // //           height: "35px",
// // //         }}
// // //       >
// // //         {Object.entries(HIERARCHY_CONFIG).map(([key, config]) => {
// // //           const active = hierarchy === key;

// // //           return (
// // //             <button
// // //               key={key}
// // //               type="button"
// // //               onClick={() => handleHierarchyChange(key)}
// // //               style={{
// // //                 padding: "0 14px",
// // //                 border: "none",
// // //                 background: active ? "#2563eb" : "#ffffff",
// // //                 color: active ? "#ffffff" : "#374151",
// // //                 cursor: "pointer",
// // //                 fontSize: "12px",
// // //                 fontWeight: active ? 600 : 500,
// // //               }}
// // //             >
// // //               {config.label}
// // //             </button>
// // //           );
// // //         })}
// // //       </div>

// // //       {levels.map((level, index) => {
// // //         const parentLevel = index > 0 ? levels[index - 1] : null;
// // //         const disabled =
// // //           index === 0 ? loading : !selected[parentLevel.name];
// // //         const options = optionsByLevel[level.name] || [];
// // //         const placeholder =
// // //           loading && index === 0
// // //             ? "Loading..."
// // //             : `Select ${level.label}`;

// // //         return (
// // //           <select
// // //             key={level.name}
// // //             value={selected[level.name] || ""}
// // //             onChange={(event) =>
// // //               handleChange(level.name, event.target.value)
// // //             }
// // //             disabled={disabled}
// // //             className="filter-dropdown"
// // //           >
// // //             <option value="">{placeholder}</option>
// // //             {options.map((option) => (
// // //               <option key={option} value={option}>
// // //                 {option}
// // //               </option>
// // //             ))}
// // //           </select>
// // //         );
// // //       })}

// // //       <button
// // //         type="button"
// // //         onClick={handleReset}
// // //         style={{
// // //           height: "35px",
// // //           padding: "0 14px",
// // //           border: "1px solid #d1d5db",
// // //           borderRadius: "5px",
// // //           background: "#ffffff",
// // //           cursor: "pointer",
// // //           fontSize: "12px",
// // //         }}
// // //       >
// // //         Reset
// // //       </button>

// // //       {error && (
// // //         <span style={{ color: "#c0392b", fontSize: "12px" }}>
// // //           {error}
// // //         </span>
// // //       )}
// // //     </div>
// // //   );
// // // };

// // // export default FilterDashboard;



// // import React, { useEffect, useMemo, useState } from "react";

// // const API_BASE = "http://192.168.1.12:8000/api/v1/filters/locations/";

// // export const HIERARCHY_CONFIG = {
// //   GEOGRAPHICAL: {
// //     label: "Geographical",
// //     levels: [
// //       { name: "state", label: "State", field: "state_name", childrenKey: "districts" },
// //       { name: "district", label: "District", field: "district_name", childrenKey: "talukas" },
// //       { name: "taluka", label: "Taluka", field: "taluka_name", childrenKey: "cities" },
// //       { name: "city", label: "City", field: "city_name", childrenKey: "branches" },
// //       { name: "branch", label: "Branch", field: "branch_name", childrenKey: "floors" },
// //       { name: "floor", label: "Floor", field: "floor_name", childrenKey: null },
// //     ],
// //   },
// //   ZONAL: {
// //     label: "Zonal",
// //     levels: [
// //       { name: "zone", label: "Zone", field: "zone_name", childrenKey: "circles" },
// //       { name: "circle", label: "Circle", field: "circle_name", childrenKey: "regions" },
// //       { name: "region", label: "Region", field: "region_name", childrenKey: "divisions" },
// //       { name: "division", label: "Division", field: "division_name", childrenKey: "branches" },
// //       { name: "branch", label: "Branch", field: "branch_name", childrenKey: "floors" },
// //       { name: "floor", label: "Floor", field: "floor_name", childrenKey: null },
// //     ],
// //   },
// // };

// // const ALL_HIERARCHY_KEYS = Object.keys(HIERARCHY_CONFIG);

// // const getAuthToken = () => {
// //   const keys = ["access_token", "accessToken", "token", "authToken", "jwt", "id_token"];
// //   for (const storage of [localStorage, sessionStorage]) {
// //     for (const key of keys) {
// //       const value = storage.getItem(key);
// //       if (value) return value;
// //     }
// //   }
// //   return null;
// // };

// // const pickHierarchy = (preferred, allowedKeys) =>
// //   preferred && allowedKeys.includes(preferred) ? preferred : allowedKeys[0];

// // const buildSelection = (value, hierarchy, lockedValues) => {
// //   const levels = HIERARCHY_CONFIG[hierarchy]?.levels || [];
// //   const next = {};

// //   levels.forEach((level) => {
// //     next[level.name] = lockedValues?.[level.name] || value?.[level.name] || "";
// //   });

// //   return next;
// // };

// // const FilterDashboard = ({
// //   initialValue = null,
// //   restoreVersion = 0,
// //   allowedHierarchies,
// //   lockedValues,
// //   onFilterChange,
// //   onReset,
// // }) => {
// //   const allowedKeySignature = useMemo(() => {
// //     const requested = Array.isArray(allowedHierarchies)
// //       ? allowedHierarchies.filter((key) => HIERARCHY_CONFIG[key])
// //       : [];

// //     return (requested.length ? requested : ALL_HIERARCHY_KEYS).join("|");
// //   }, [allowedHierarchies]);

// //   const allowedKeys = useMemo(
// //     () => allowedKeySignature.split("|"),
// //     [allowedKeySignature]
// //   );

// //   const [hierarchy, setHierarchy] = useState(() =>
// //     pickHierarchy(initialValue?.hierarchy, allowedKeys)
// //   );
// //   const [tree, setTree] = useState([]);
// //   const [loading, setLoading] = useState(false);
// //   const [error, setError] = useState("");
// //   const [selected, setSelected] = useState(() =>
// //     buildSelection(
// //       initialValue,
// //       pickHierarchy(initialValue?.hierarchy, allowedKeys),
// //       lockedValues
// //     )
// //   );
// //   const [lastRestoreVersion, setLastRestoreVersion] = useState(-1);

// //   const levels = HIERARCHY_CONFIG[hierarchy].levels;
// //   const showHierarchyToggle = allowedKeys.length > 1;

// //   // If the allowed list changes (or a customer switches account), keep hierarchy valid
// //   useEffect(() => {
// //     if (allowedKeys.includes(hierarchy)) return;

// //     const nextHierarchy = pickHierarchy(initialValue?.hierarchy, allowedKeys);
// //     setHierarchy(nextHierarchy);
// //     setSelected(buildSelection(initialValue, nextHierarchy, lockedValues));
// //   }, [allowedKeys, hierarchy, initialValue, lockedValues]);

// //   // Restore from saved filter
// //   useEffect(() => {
// //     if (restoreVersion === lastRestoreVersion) return;
// //     setLastRestoreVersion(restoreVersion);

// //     const nextHierarchy = pickHierarchy(initialValue?.hierarchy, allowedKeys);
// //     setHierarchy(nextHierarchy);
// //     setSelected(buildSelection(initialValue, nextHierarchy, lockedValues));
// //   }, [
// //     restoreVersion,
// //     initialValue,
// //     allowedKeys,
// //     lockedValues,
// //     lastRestoreVersion,
// //   ]);

// //   // Fetch locations for the active hierarchy
// //   useEffect(() => {
// //     let cancelled = false;

// //     setLoading(true);
// //     setError("");
// //     setTree([]);

// //     (async () => {
// //       try {
// //         const token = getAuthToken();
// //         const headers = { Accept: "application/json" };

// //         if (token) {
// //           headers.Authorization = token.startsWith("Token ")
// //             ? token
// //             : `Token ${token}`;
// //         }

// //         const url =
// //           `${API_BASE}?hierarchy=${encodeURIComponent(hierarchy)}` +
// //           `&t=${Date.now()}`;

// //         const response = await fetch(url, {
// //           method: "GET",
// //           cache: "no-store",
// //           credentials: "include",
// //           headers,
// //         });

// //         if (response.status === 401 || response.status === 403) {
// //           throw new Error("Session expired. Please sign in again.");
// //         }

// //         if (!response.ok) {
// //           throw new Error(`HTTP ${response.status}`);
// //         }

// //         const result = await response.json();
// //         if (cancelled) return;

// //         setTree(Array.isArray(result?.data) ? result.data : []);
// //       } catch (err) {
// //         if (cancelled) return;
// //         console.error("LOCATIONS API ERROR:", err);
// //         setError(err.message || "Unable to fetch filter locations.");
// //         setTree([]);
// //       } finally {
// //         if (!cancelled) setLoading(false);
// //       }
// //     })();

// //     return () => {
// //       cancelled = true;
// //     };
// //   }, [hierarchy]);

// //   const optionsByLevel = useMemo(() => {
// //     const result = {};
// //     let current = tree;

// //     for (let i = 0; i < levels.length; i += 1) {
// //       const level = levels[i];
// //       const seen = new Set();
// //       const values = [];

// //       for (const item of current || []) {
// //         const value = item[level.field];
// //         if (value && !seen.has(value)) {
// //           seen.add(value);
// //           values.push(value);
// //         }
// //       }

// //       result[level.name] = values;

// //       const picked = selected[level.name];

// //       if (!picked || !level.childrenKey) {
// //         for (let j = i + 1; j < levels.length; j += 1) {
// //           result[levels[j].name] = [];
// //         }
// //         break;
// //       }

// //       const matched = (current || []).find(
// //         (item) => item[level.field] === picked
// //       );

// //       current = (matched && matched[level.childrenKey]) || [];
// //     }

// //     return result;
// //   }, [tree, levels, selected]);

// //   useEffect(() => {
// //     if (typeof onFilterChange !== "function") return;

// //     onFilterChange({
// //       hierarchy,
// //       ...selected,
// //     });
// //   }, [hierarchy, selected, onFilterChange]);

// //   const handleHierarchyChange = (nextHierarchy) => {
// //     if (!allowedKeys.includes(nextHierarchy)) return;

// //     setHierarchy(nextHierarchy);
// //     setSelected(buildSelection(null, nextHierarchy, lockedValues));
// //   };

// //   const handleChange = (levelName, value) => {
// //     const index = levels.findIndex((level) => level.name === levelName);

// //     setSelected((previous) => {
// //       const next = { ...previous, [levelName]: value };

// //       for (let i = index + 1; i < levels.length; i += 1) {
// //         // Never wipe a locked value
// //         next[levels[i].name] = lockedValues?.[levels[i].name] || "";
// //       }

// //       return next;
// //     });
// //   };

// //   const handleReset = () => {
// //     setSelected(buildSelection(null, hierarchy, lockedValues));

// //     if (typeof onReset === "function") {
// //       onReset();
// //     }
// //   };

// //   return (
// //     <div
// //       className="filter-dashboard"
// //       style={{
// //         display: "flex",
// //         alignItems: "center",
// //         gap: "10px",
// //         padding: "12px 15px",
// //         background: "#ffffff",
// //         border: "1px solid #e1e8f0",
// //         borderRadius: "8px",
// //         flexWrap: "wrap",
// //       }}
// //     >
// //       {showHierarchyToggle && (
// //         <div
// //           style={{
// //             display: "flex",
// //             border: "1px solid #d1d5db",
// //             borderRadius: "6px",
// //             overflow: "hidden",
// //             height: "35px",
// //           }}
// //         >
// //           {allowedKeys.map((key) => {
// //             const active = hierarchy === key;

// //             return (
// //               <button
// //                 key={key}
// //                 type="button"
// //                 onClick={() => handleHierarchyChange(key)}
// //                 style={{
// //                   padding: "0 14px",
// //                   border: "none",
// //                   background: active ? "#2563eb" : "#ffffff",
// //                   color: active ? "#ffffff" : "#374151",
// //                   cursor: "pointer",
// //                   fontSize: "12px",
// //                   fontWeight: active ? 600 : 500,
// //                 }}
// //               >
// //                 {HIERARCHY_CONFIG[key].label}
// //               </button>
// //             );
// //           })}
// //         </div>
// //       )}

// //       {levels.map((level, index) => {
// //         const lockedValue = lockedValues?.[level.name];

// //         // Locked level (e.g. customer's own branch) -> show but don't allow change
// //         if (lockedValue) {
// //           return (
// //             <select
// //               key={level.name}
// //               value={lockedValue}
// //               disabled
// //               className="filter-dropdown"
// //               title={`${level.label} is fixed for your account`}
// //             >
// //               <option value={lockedValue}>{lockedValue}</option>
// //             </select>
// //           );
// //         }

// //         const parentLevel = index > 0 ? levels[index - 1] : null;
// //         const disabled =
// //           index === 0 ? loading : !selected[parentLevel.name];
// //         const options = optionsByLevel[level.name] || [];
// //         const placeholder =
// //           loading && index === 0
// //             ? "Loading..."
// //             : `Select ${level.label}`;

// //         return (
// //           <select
// //             key={level.name}
// //             value={selected[level.name] || ""}
// //             onChange={(event) => handleChange(level.name, event.target.value)}
// //             disabled={disabled}
// //             className="filter-dropdown"
// //           >
// //             <option value="">{placeholder}</option>
// //             {options.map((option) => (
// //               <option key={option} value={option}>
// //                 {option}
// //               </option>
// //             ))}
// //           </select>
// //         );
// //       })}

// //       <button
// //         type="button"
// //         onClick={handleReset}
// //         style={{
// //           height: "35px",
// //           padding: "0 14px",
// //           border: "1px solid #d1d5db",
// //           borderRadius: "5px",
// //           background: "#ffffff",
// //           cursor: "pointer",
// //           fontSize: "12px",
// //         }}
// //       >
// //         Reset
// //       </button>

// //       {error && (
// //         <span style={{ color: "#c0392b", fontSize: "12px" }}>{error}</span>
// //       )}
// //     </div>
// //   );
// // };

// // export default FilterDashboard;


// import React, { useEffect, useMemo, useState } from "react";

// const API_BASE =
//   "http://192.168.1.12:8000/api/v1/filters/locations/";

// export const HIERARCHY_CONFIG = {
//   GEOGRAPHICAL: {
//     label: "Geographical",
//     levels: [
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
//         childrenKey: "cities",
//       },
//       {
//         name: "city",
//         label: "City",
//         field: "city_name",
//         childrenKey: "branches",
//       },
//       {
//         name: "branch",
//         label: "Branch",
//         field: "branch_name",
//         childrenKey: "floors",
//       },
//       {
//         name: "floor",
//         label: "Floor",
//         field: "floor_name",
//         childrenKey: null,
//       },
//     ],
//   },

//   ZONAL: {
//     label: "Zonal",
//     levels: [
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
//         childrenKey: "floors",
//       },
//       {
//         name: "floor",
//         label: "Floor",
//         field: "floor_name",
//         childrenKey: null,
//       },
//     ],
//   },
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
//   const levels =
//     HIERARCHY_CONFIG[hierarchy]?.levels || [];

//   return Object.fromEntries(
//     levels.map((level) => [
//       level.name,
//       lockedValues[level.name] ||
//         value?.[level.name] ||
//         "",
//     ])
//   );
// };

// const FilterDashboard = ({
//   initialValue = null,
//   restoreVersion = 0,
//   allowedHierarchies,
//   lockedValues = {},
//   onFilterChange,
//   onReset,
// }) => {
//   const allowedKeys = useMemo(
//     () => getAllowedHierarchies(allowedHierarchies),
//     [allowedHierarchies]
//   );

//   const allowedSignature = allowedKeys.join("|");

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
//       previous === nextHierarchy
//         ? previous
//         : nextHierarchy
//     );

//     setSelected((previous) =>
//       JSON.stringify(previous) ===
//       JSON.stringify(nextSelection)
//         ? previous
//         : nextSelection
//     );
//   }, [
//     restoreVersion,
//     allowedSignature,
//     JSON.stringify(initialValue),
//     JSON.stringify(lockedValues),
//   ]);

//   /*
//    * Fetch locations for selected hierarchy.
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
//           headers.Authorization =
//             token.startsWith("Token ")
//               ? token
//               : `Token ${token}`;
//         }

//         const url =
//           `${API_BASE}?hierarchy=${encodeURIComponent(
//             hierarchy
//           )}&t=${Date.now()}`;

//         const response = await fetch(url, {
//           method: "GET",
//           headers,
//           credentials: "include",
//           cache: "no-store",
//         });

//         if (
//           response.status === 401 ||
//           response.status === 403
//         ) {
//           throw new Error(
//             "Session expired. Please sign in again."
//           );
//         }

//         if (!response.ok) {
//           throw new Error(
//             `HTTP ${response.status}`
//           );
//         }

//         const result = await response.json();

//         if (!cancelled) {
//           setTree(
//             Array.isArray(result?.data)
//               ? result.data
//               : []
//           );
//         }
//       } catch (err) {
//         if (cancelled) return;

//         console.error(
//           "LOCATIONS API ERROR:",
//           err
//         );

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
//    * Restrict the tree according to customer's/admin's
//    * locked hierarchy.
//    */
//   const filteredTree = useMemo(() => {
//     if (!tree.length) return [];

//     const lockedLevel = levels.find(
//       (level) => lockedValues?.[level.name]
//     );

//     if (!lockedLevel) return tree;

//     const lockedValue =
//       lockedValues[lockedLevel.name];

//     return tree.filter(
//       (item) =>
//         String(item?.[lockedLevel.field] || "") ===
//         String(lockedValue || "")
//     );
//   }, [
//     tree,
//     levels,
//     JSON.stringify(lockedValues),
//   ]);

//   /*
//    * Build dropdown options based on selected
//    * parent hierarchy.
//    */
//   const optionsByLevel = useMemo(() => {
//     const result = {};
//     let current = filteredTree;

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

//       const selectedValue =
//         selected[level.name];

//       if (
//         !selectedValue ||
//         !level.childrenKey
//       ) {
//         for (
//           let i = index + 1;
//           i < levels.length;
//           i++
//         ) {
//           result[levels[i].name] = [];
//         }

//         return;
//       }

//       const match = (current || []).find(
//         (item) =>
//           String(item?.[level.field] || "") ===
//           String(selectedValue)
//       );

//       current =
//         match?.[level.childrenKey] || [];
//     });

//     return result;
//   }, [
//     filteredTree,
//     levels,
//     selected,
//   ]);

//   /*
//    * Send current filter to parent component.
//    */
//   useEffect(() => {
//     onFilterChange?.({
//       hierarchy,
//       ...selected,
//     });
//   }, [
//     hierarchy,
//     selected,
//     onFilterChange,
//   ]);

//   /*
//    * Change hierarchy.
//    */
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

//   /*
//    * Change State/District/Taluka/City/etc.
//    */
//   const changeLevel = (
//     levelName,
//     value
//   ) => {
//     if (lockedValues?.[levelName]) {
//       return;
//     }

//     const index = levels.findIndex(
//       (level) =>
//         level.name === levelName
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

//   /*
//    * Reset filters but preserve locked values.
//    */
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
//       <div
//         style={{
//           display: "flex",
//           border: "1px solid #d1d5db",
//           borderRadius: "6px",
//           overflow: "hidden",
//           height: "35px",
//         }}
//       >
//         {Object.entries(HIERARCHY_CONFIG).map(([key, config]) => {
//           const active = hierarchy === key;

//           return (
//             <button
//               key={key}
//               type="button"
//               onClick={() => handleHierarchyChange(key)}
//               style={{
//                 padding: "0 14px",
//                 border: "none",
//                 background: active ? "#2563eb" : "#ffffff",
//                 color: active ? "#ffffff" : "#374151",
//                 cursor: "pointer",
//                 fontSize: "12px",
//                 fontWeight: active ? 600 : 500,
//               }}
//             >
//               {config.label}
//             </button>
//           );
//         })}
//       </div>

//     {/* <div className="filter-dashboard"> */}

//       {/* Hierarchy Toggle */}

//       {allowedKeys.length > 1 && (
//         <div className="filter-dashboard"
//           style={{
//             display: "flex",
//             alignItems: "center",
//             gap: "10px",
//             padding: "12px 15px",
//             background: "#ffffff",
//             border: "1px solid #e1e8f0",
//             borderRadius: "8px",
//             flexWrap: "wrap",
//       }}>
//         <div style={{
//           display: "flex",
//           border: "1px solid #d1d5db",
//           borderRadius: "6px",
//           overflow: "hidden",
//           height: "35px",
//         }}>
//           {allowedKeys.map((key) => (
//             <button
//               key={key}
//               type="button"
//               className={
//                 hierarchy === key
//                   ? "active"
//                   : ""
//               }
//               onClick={() =>
//                 changeHierarchy(key)
//               }
              
//             >
//               {HIERARCHY_CONFIG[key].label}
//             </button>
//           ))}
//         </div>
          
//         </div>
//       )}

//       {/* Hierarchy Dropdowns */}

//       {levels.map((level, index) => {
//         const locked =
//           lockedValues?.[level.name];

//         const parent =
//           index > 0
//             ? levels[index - 1]
//             : null;

//         const disabled =
//           Boolean(locked) ||
//           (
//             index === 0
//               ? loading
//               : !selected[parent.name]
//           );

//         const options = locked
//           ? [locked]
//           : optionsByLevel[
//               level.name
//             ] || [];

//         return (
//           <select
//             key={level.name}
//             value={
//               selected[level.name] || ""
//             }
//             disabled={disabled}
//             className="filter-dropdown"
//             title={
//               locked
//                 ? `${level.label} is fixed for your account`
//                 : ""
//             }
//             onChange={(event) =>
//               changeLevel(
//                 level.name,
//                 event.target.value
//               )
//             }
//           >
//             <option value="">
//               {loading && index === 0
//                 ? "Loading..."
//                 : `Select ${level.label}`}
//             </option>

//             {options.map((option) => (
//               <option
//                 key={option}
//                 value={option}
//               >
//                 {option}
//               </option>
//             ))}
//           </select>
//         );
//       })}

//       {/* Reset Button */}

//       <button
//         type="button"
//         className="filter-reset-button"
//         onClick={reset}
//       >
//         Reset
//       </button>

//       {/* Error */}

//       {error && (
//         <span className="filter-error">
//           {error}
//         </span>
//       )}
//     </div>
//   );
// };

// export default FilterDashboard;


import React, { useEffect, useMemo, useState } from "react";

const API_BASE =
  "http://192.168.1.12:8000/api/v1/filters/locations/";

export const HIERARCHY_CONFIG = {
  GEOGRAPHICAL: {
    label: "Geographical",
    levels: [
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
        childrenKey: "cities",
      },
      {
        name: "city",
        label: "City",
        field: "city_name",
        childrenKey: "branches",
      },
      {
        name: "branch",
        label: "Branch",
        field: "branch_name",
        childrenKey: "floors",
      },
      {
        name: "floor",
        label: "Floor",
        field: "floor_name",
        childrenKey: null,
      },
    ],
  },

  ZONAL: {
    label: "Zonal",
    levels: [
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
        childrenKey: "floors",
      },
      {
        name: "floor",
        label: "Floor",
        field: "floor_name",
        childrenKey: null,
      },
    ],
  },
};

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------
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
  const levels =
    HIERARCHY_CONFIG[hierarchy]?.levels || [];

  return Object.fromEntries(
    levels.map((level) => [
      level.name,
      lockedValues[level.name] ||
        value?.[level.name] ||
        "",
    ])
  );
};

// ---------------------------------------------------------------
// Component
// ---------------------------------------------------------------
const FilterDashboard = ({
  initialValue = null,
  restoreVersion = 0,
  allowedHierarchies,
  lockedValues = {},
  onFilterChange,
  onReset,
}) => {
  const allowedKeys = useMemo(
    () => getAllowedHierarchies(allowedHierarchies),
    [allowedHierarchies]
  );

  const allowedSignature = allowedKeys.join("|");

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
      previous === nextHierarchy
        ? previous
        : nextHierarchy
    );

    setSelected((previous) =>
      JSON.stringify(previous) ===
      JSON.stringify(nextSelection)
        ? previous
        : nextSelection
    );
  }, [
    restoreVersion,
    allowedSignature,
    JSON.stringify(initialValue),
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

        // if (
        //   response.status === 401 ||
        //   response.status === 403
        // ) 
        // {
        //   throw new Error(
        //     "Session expired. Please sign in again."
        //   );
        // }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();

        if (!cancelled) {
          setTree(
            Array.isArray(result?.data)
              ? result.data
              : []
          );
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
    if (!tree.length) return [];

    const lockedLevel = levels.find(
      (level) => lockedValues?.[level.name]
    );

    if (!lockedLevel) return tree;

    const lockedValue = lockedValues[lockedLevel.name];

    return tree.filter(
      (item) =>
        String(item?.[lockedLevel.field] || "") ===
        String(lockedValue || "")
    );
  }, [
    tree,
    levels,
    JSON.stringify(lockedValues),
  ]);

  /*
   * Build dropdown options based on the selected
   * parent hierarchy.
   */
  const optionsByLevel = useMemo(() => {
    const result = {};
    let current = filteredTree;

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
        for (
          let i = index + 1;
          i < levels.length;
          i++
        ) {
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

    return result;
  }, [filteredTree, levels, selected]);

  /*
   * Send the current filter to the parent component.
   */
  useEffect(() => {
    onFilterChange?.({
      hierarchy,
      ...selected,
    });
  }, [hierarchy, selected, onFilterChange]);

  /*
   * Change the active hierarchy.
   */
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

  /*
   * Change State/District/Taluka/City/etc.
   */
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

  /*
   * Reset filters but preserve locked values.
   */
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

      {/* Hierarchy Dropdowns */}
      {levels.map((level, index) => {
        const locked = lockedValues?.[level.name];

        const parent =
          index > 0 ? levels[index - 1] : null;

        const disabled =
          Boolean(locked) ||
          (index === 0
            ? loading
            : !selected[parent.name]);

        const options = locked
          ? [locked]
          : optionsByLevel[level.name] || [];

        const placeholder =
          loading && index === 0
            ? "Loading..."
            : `Select ${level.label}`;

        return (
          <select
            key={level.name}
            value={selected[level.name] || ""}
            disabled={disabled}
            className="filter-dropdown"
            title={
              locked
                ? `${level.label} is fixed for your account`
                : ""
            }
            onChange={(event) =>
              changeLevel(
                level.name,
                event.target.value
              )
            }
          >
            <option value="">{placeholder}</option>

            {options.map((option) => (
              <option key={option} value={option}>
                {option}
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