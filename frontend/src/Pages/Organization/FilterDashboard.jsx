
import React, { useEffect, useMemo, useState } from "react";

const API_BASE =
  "http://192.168.1.14:8000/api/v1/filters/locations/";

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