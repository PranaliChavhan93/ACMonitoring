
import React, { useEffect, useState } from "react";

const API_BASE = "http://192.168.1.14:8000/api";

const token = () =>
  localStorage.getItem("token") ||
  localStorage.getItem("authToken") ||
  localStorage.getItem("access_token") ||
  localStorage.getItem("accessToken") ||
  "";

const headers = () => {
  const value = token();
  return {
    "Content-Type": "application/json",
    ...(value
      ? {
          Authorization: value.startsWith("Bearer ")
            ? value
            : `Bearer ${value}`,
        }
      : {}),
  };
};

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...headers(), ...(options.headers || {}) },
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    const detail =
      result.message ||
      result.detail ||
      Object.entries(result)
        .map(([key, value]) =>
          `${key}: ${Array.isArray(value) ? value.join(", ") : value}`
        )
        .join(" | ") ||
      `HTTP ${response.status}`;

    throw new Error(detail);
  }

  return result;
}

const listOf = (value) =>
  Array.isArray(value)
    ? value
    : Array.isArray(value?.results)
    ? value.results
    : Array.isArray(value?.data)
    ? value.data
    : [];

const label = (item) =>
  item?.company || item?.name || item?.code || String(item?.id ?? "");

function SelectField({ title, value, options, onChange, disabled }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span>{title}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        style={{ padding: 10, minWidth: 0 }}
      >
        <option value="">Select {title}</option>
        {options.map((item) => (
          <option key={item.id} value={item.id}>
            {label(item)}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextField({ title, value, onChange, required = false }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span>{title}</span>
      <input
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        style={{ padding: 10, minWidth: 0 }}
      />
    </label>
  );
}

function HierarchySiteCreation() {
  const [user, setUser] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [hierarchy, setHierarchy] = useState("");

  const [states, setStates] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [talukas, setTalukas] = useState([]);
  const [cities, setCities] = useState([]);

  const [zones, setZones] = useState([]);
  const [circles, setCircles] = useState([]);
  const [regions, setRegions] = useState([]);
  const [divisions, setDivisions] = useState([]);

  const [stateId, setStateId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [talukaId, setTalukaId] = useState("");
  const [cityId, setCityId] = useState("");

  const [zoneId, setZoneId] = useState("");
  const [circleId, setCircleId] = useState("");
  const [regionId, setRegionId] = useState("");
  const [divisionId, setDivisionId] = useState("");

  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState("");
  const [createBranch, setCreateBranch] = useState(false);
  const [branchName, setBranchName] = useState("");
  const [branchCode, setBranchCode] = useState("");

  const [addFloors, setAddFloors] = useState(false);
  const [floorCount, setFloorCount] = useState("1");
  const [floorNames, setFloorNames] = useState(["Floor 1"]);
  const [existingFloors, setExistingFloors] = useState([]);
  const [floorId, setFloorId] = useState("");

  const [siteName, setSiteName] = useState("");
  const [siteCode, setSiteCode] = useState("");
  const [address, setAddress] = useState("");
  const [pincode, setPincode] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const resetLocation = () => {
    setStateId("");
    setDistrictId("");
    setTalukaId("");
    setCityId("");
    setZoneId("");
    setCircleId("");
    setRegionId("");
    setDivisionId("");
    setBranchId("");
    setBranches([]);
    setExistingFloors([]);
    setFloorId("");
  };

  useEffect(() => {
    async function loadInitial() {
      try {
        const meResponse = await api("/auth/me/");
        const me = meResponse.user || meResponse.data || meResponse;

        setUser(me);
        const role = me.role;
        const ownCustomer = me.customer_id ?? me.customer?.id;

        if (role === "CUSTOMER") {
          if (!ownCustomer) {
            throw new Error("Your account is not linked to a customer.");
          }

          setCustomerId(String(ownCustomer));
          const response = await api("/customers/");
          const found = listOf(response).filter(
            (item) => String(item.id) === String(ownCustomer)
          );
          setCustomers(found);
        } else if (role === "ORG_SUPER_ADMIN") {
          setCustomers(listOf(await api("/customers/")));
        } else {
          throw new Error(
            "This page is available only to organization administrators and customers."
          );
        }
      } catch (e) {
        setError(e.message || "Unable to load initial data.");
      }
    }

    loadInitial();
  }, []);

  useEffect(() => {
    if (!customerId) {
      setHierarchy("");
      resetLocation();
      return;
    }

    let cancelled = false;

    async function loadCustomerHierarchy() {
      try {
        const response = await api(`/customers/${customerId}/`);
        if (cancelled) return;

        setHierarchy(response.hierarchy_type || "");
        resetLocation();

        if (response.hierarchy_type === "GEOGRAPHICAL") {
          setStates(
            listOf(await api(`/states/?customer=${customerId}`))
          );
        } else if (response.hierarchy_type === "ZONAL") {
          const allZones = listOf(await api("/zones/"));
          setZones(
            allZones.filter(
              (item) => String(item.customer) === String(customerId)
            )
          );
        } else {
          setError("Configure this customer's hierarchy before continuing.");
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      }
    }

    loadCustomerHierarchy();
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  useEffect(() => {
    setDistricts([]);
    setTalukas([]);
    setCities([]);
    setDistrictId("");
    setTalukaId("");
    setCityId("");

    if (stateId) {
      api(`/districts/?state=${stateId}`)
        .then((r) => setDistricts(listOf(r)))
        .catch((e) => setError(e.message));
    }
  }, [stateId]);

  useEffect(() => {
    setTalukas([]);
    setCities([]);
    setTalukaId("");
    setCityId("");

    if (districtId) {
      api(`/talukas/?district=${districtId}`)
        .then((r) => setTalukas(listOf(r)))
        .catch((e) => setError(e.message));
    }
  }, [districtId]);

  useEffect(() => {
    setCities([]);
    setCityId("");

    if (talukaId) {
      api(`/cities/?taluka=${talukaId}`)
        .then((r) => setCities(listOf(r)))
        .catch((e) => setError(e.message));
    }
  }, [talukaId]);

  useEffect(() => {
    setCircles([]);
    setRegions([]);
    setDivisions([]);
    setCircleId("");
    setRegionId("");
    setDivisionId("");

    if (zoneId) {
      api(`/circles/?zone=${zoneId}`)
        .then((r) => setCircles(listOf(r)))
        .catch((e) => setError(e.message));
    }
  }, [zoneId]);

  useEffect(() => {
    setRegions([]);
    setDivisions([]);
    setRegionId("");
    setDivisionId("");

    if (circleId) {
      api(`/regions/?circle=${circleId}`)
        .then((r) => setRegions(listOf(r)))
        .catch((e) => setError(e.message));
    }
  }, [circleId]);

  useEffect(() => {
    setDivisions([]);
    setDivisionId("");

    if (regionId) {
      api(`/divisions/?region=${regionId}`)
        .then((r) => setDivisions(listOf(r)))
        .catch((e) => setError(e.message));
    }
  }, [regionId]);

  const parentReady =
    hierarchy === "GEOGRAPHICAL"
      ? Boolean(cityId)
      : hierarchy === "ZONAL"
      ? Boolean(divisionId)
      : false;

  useEffect(() => {
    setBranches([]);
    setBranchId("");
    setExistingFloors([]);
    setFloorId("");

    if (!customerId || !parentReady) return;

    const query = new URLSearchParams({ customer: customerId });
    api(`/branches/?${query.toString()}`)
      .then((r) => {
        const parentId = hierarchy === "GEOGRAPHICAL" ? cityId : divisionId;
        const matching = listOf(r).filter((b) =>
          String(
            hierarchy === "GEOGRAPHICAL" ? b.city : b.division
          ) === String(parentId)
        );
        setBranches(matching);
      })
      .catch((e) => setError(e.message));
  }, [customerId, hierarchy, parentReady, cityId, divisionId]);

  useEffect(() => {
    setExistingFloors([]);
    setFloorId("");

    if (!branchId || createBranch) return;

    api(`/floors/?branch=${branchId}`)
      .then((r) => setExistingFloors(listOf(r)))
      .catch((e) => setError(e.message));
  }, [branchId, createBranch]);

  useEffect(() => {
    const count = Number(floorCount);
    setFloorNames((old) =>
      Array.from({ length: count }, (_, i) => old[i] || `Floor ${i + 1}`)
    );
  }, [floorCount]);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!parentReady) {
      setError("Complete the location hierarchy first.");
      return;
    }

    if (createBranch && (!branchName.trim() || !branchCode.trim())) {
      setError("Enter the new branch name and code.");
      return;
    }

    const payload = {
      customer_id: customerId,
      create_branch: createBranch,
      branch_id: createBranch ? null : branchId,
      branch_name: branchName.trim(),
      branch_code: branchCode.trim().toUpperCase(),

      state_id: stateId || null,
      district_id: districtId || null,
      taluka_id: talukaId || null,
      city_id: cityId || null,

      zone_id: zoneId || null,
      circle_id: circleId || null,
      region_id: regionId || null,
      division_id: divisionId || null,

      site_name: siteName.trim(),
      site_code: siteCode.trim().toUpperCase(),
      address: address.trim(),
      pincode: pincode.trim(),

      floor_names: addFloors ? floorNames : [],
      floor_id: createBranch ? null : floorId || null,
    };

    if (!createBranch && !branchId) {
      setError("Select a branch or choose Create new branch.");
      return;
    }

    try {
      setLoading(true);
      const result = await api("/hierarchy-site/create/", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setMessage(
        `${result.message} 3TP status: ${
          result.data?.tpt_sync_status || "PENDING"
        }.`
      );

      setBranchName("");
      setBranchCode("");
      setSiteName("");
      setSiteCode("");
      setAddress("");
      setPincode("");
      setAddFloors(false);
      setFloorCount("1");
      setFloorNames(["Floor 1"]);
      setFloorId("");

      if (createBranch) {
        setCreateBranch(false);
        setBranchId("");
      }
    } catch (e) {
      setError(e.message || "Unable to save hierarchy and site.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: 24 }}>
      <h1>Hierarchy & Site Creation</h1>
      <p>
        Select the customer location, configure its branch and site,
        and optionally add floors. This page does not create AC devices.
      </p>

      {error && (
        <div role="alert" style={{ color: "#b42318", margin: "12px 0" }}>
          {error}
        </div>
      )}
      {message && (
        <div role="status" style={{ margin: "12px 0" }}>
          {message}
        </div>
      )}

      <form onSubmit={submit} style={{ display: "grid", gap: 24 }}>
        <section>
          <h2>1. Customer</h2>
          {user?.role === "CUSTOMER" ? (
            <p>
              Customer:{" "}
              {label(customers.find((c) => String(c.id) === String(customerId)))}
            </p>
          ) : (
            <SelectField
              title="Customer"
              value={customerId}
              options={customers}
              onChange={(value) => {
                setCustomerId(value);
                setError("");
              }}
            />
          )}
          <p>
            Hierarchy: <strong>{hierarchy || "Not configured"}</strong>
          </p>
        </section>

        {hierarchy === "GEOGRAPHICAL" && (
          <section>
            <h2>2. Geographical location</h2>
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))" }}>
              <SelectField title="State" value={stateId} options={states} onChange={setStateId} />
              <SelectField title="District" value={districtId} options={districts} onChange={setDistrictId} disabled={!stateId} />
              <SelectField title="Taluka" value={talukaId} options={talukas} onChange={setTalukaId} disabled={!districtId} />
              <SelectField title="City" value={cityId} options={cities} onChange={setCityId} disabled={!talukaId} />
            </div>
          </section>
        )}

        {hierarchy === "ZONAL" && (
          <section>
            <h2>2. Zonal location</h2>
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))" }}>
              <SelectField title="Zone" value={zoneId} options={zones} onChange={setZoneId} />
              <SelectField title="Circle" value={circleId} options={circles} onChange={setCircleId} disabled={!zoneId} />
              <SelectField title="Region" value={regionId} options={regions} onChange={setRegionId} disabled={!circleId} />
              <SelectField title="Division" value={divisionId} options={divisions} onChange={setDivisionId} disabled={!regionId} />
            </div>
          </section>
        )}

        {parentReady && (
          <>
            <section>
              <h2>3. Branch</h2>
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={createBranch}
                  onChange={(event) => {
                    setCreateBranch(event.target.checked);
                    setBranchId("");
                  }}
                />
                Create a new branch
              </label>

              {!createBranch ? (
                <div style={{ marginTop: 12 }}>
                  <SelectField title="Branch" value={branchId} options={branches} onChange={setBranchId} />
                </div>
              ) : (
                <div style={{ display: "grid", gap: 12, marginTop: 12, gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))" }}>
                  <TextField title="Branch name" value={branchName} onChange={setBranchName} required />
                  <TextField title="Branch code" value={branchCode} onChange={setBranchCode} required />
                </div>
              )}
            </section>

            <section>
              <h2>4. Site details</h2>
              <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))" }}>
                <TextField title="Site name" value={siteName} onChange={setSiteName} required />
                <TextField title="Site code" value={siteCode} onChange={setSiteCode} required />
                <TextField title="Pincode" value={pincode} onChange={setPincode} />
              </div>
              <label style={{ display: "grid", gap: 6, marginTop: 12 }}>
                <span>Address</span>
                <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={3} />
              </label>
            </section>

            <section>
              <h2>5. Floors (optional)</h2>
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="checkbox" checked={addFloors} onChange={(e) => setAddFloors(e.target.checked)} />
                Add floors to this branch
              </label>

              {addFloors && (
                <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                  <label style={{ display: "grid", gap: 6, maxWidth: 220 }}>
                    <span>Number of floors</span>
                    <select value={floorCount} onChange={(e) => setFloorCount(e.target.value)}>
                      {Array.from({ length: 10 }, (_, i) => (
                        <option key={i + 1} value={i + 1}>{i + 1}</option>
                      ))}
                    </select>
                  </label>
                  {floorNames.map((name, index) => (
                    <TextField
                      key={index}
                      title={`Floor ${index + 1} name`}
                      value={name}
                      onChange={(value) =>
                        setFloorNames((old) =>
                          old.map((item, i) => (i === index ? value : item))
                        )
                      }
                      required
                    />
                  ))}
                </div>
              )}

              {!createBranch && branchId && existingFloors.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <SelectField
                    title="Optional site floor"
                    value={floorId}
                    options={existingFloors}
                    onChange={setFloorId}
                  />
                </div>
              )}
            </section>

            <button type="submit" disabled={loading} style={{ padding: 12 }}>
              {loading ? "Saving..." : "Create branch/site"}
            </button>
          </>
        )}
      </form>
    </main>
  );
}

export default HierarchySiteCreation;