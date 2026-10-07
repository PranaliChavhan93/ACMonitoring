const API_BASE_URL = "http://localhost:8000/api";


// ============================================================
// TOKEN
// ============================================================

export const getAppToken = () => {
  return (
    localStorage.getItem("token") ||
    ""
  );
};


// ============================================================
// 3TP TOKEN
// ============================================================

export const getTpToken = () => {
  return (
    localStorage.getItem("tp_token") ||
    ""
  );
};


// ============================================================
// DJANGO API HEADERS
// ============================================================

export const authHeaders = () => {
  const token = getAppToken();

  return {
    "Content-Type": "application/json",
    Accept: "application/json",

    ...(token
      ? {
          Authorization: `Token ${token}`,
        }
      : {}),
  };
};


// ============================================================
// 3TP PROXY HEADERS
// ============================================================

export const tpAuthHeaders = () => {
  const token = getTpToken();

  return {
    "Content-Type": "application/json",
    Accept: "application/json",

    ...(token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : {}),
  };
};


// ============================================================
// CENTRAL API FETCH
// ============================================================

export const apiFetch = async (
  endpoint,
  options = {}
) => {

  const token = getAppToken();

  const url = endpoint.startsWith("http")
    ? endpoint
    : `${API_BASE_URL}${endpoint}`;

  const headers = {
    ...(options.headers || {}),
  };


  // ----------------------------------------------------------
  // Content-Type
  // ----------------------------------------------------------

  if (
    options.body &&
    !(options.body instanceof FormData)
  ) {
    headers["Content-Type"] =
      "application/json";
  }

  headers["Accept"] =
    "application/json";


  // ----------------------------------------------------------
  // AUTOMATIC DJANGO TOKEN
  // ----------------------------------------------------------

  if (token) {
    headers["Authorization"] =
      `Token ${token}`;
  }


  // ----------------------------------------------------------
  // REQUEST
  // ----------------------------------------------------------

  const response = await fetch(
    url,
    {
      ...options,
      headers,
    }
  );


  // ----------------------------------------------------------
  // 401
  // ----------------------------------------------------------

  if (response.status === 401) {
    console.warn(
      "Django API returned 401 - authentication token is missing or invalid."
    );
  }


  return response;
};


// ============================================================
// GET
// ============================================================

export const apiGet = (
  endpoint,
  options = {}
) => {

  return apiFetch(
    endpoint,
    {
      ...options,
      method: "GET",
    }
  );
};


// ============================================================
// POST
// ============================================================

export const apiPost = (
  endpoint,
  data,
  options = {}
) => {

  return apiFetch(
    endpoint,
    {
      ...options,
      method: "POST",
      body: JSON.stringify(data),
    }
  );
};


// ============================================================
// PUT
// ============================================================

export const apiPut = (
  endpoint,
  data,
  options = {}
) => {

  return apiFetch(
    endpoint,
    {
      ...options,
      method: "PUT",
      body: JSON.stringify(data),
    }
  );
};


// ============================================================
// PATCH
// ============================================================

export const apiPatch = (
  endpoint,
  data,
  options = {}
) => {

  return apiFetch(
    endpoint,
    {
      ...options,
      method: "PATCH",
      body: JSON.stringify(data),
    }
  );
};


// ============================================================
// DELETE
// ============================================================

export const apiDelete = (
  endpoint,
  options = {}
) => {

  return apiFetch(
    endpoint,
    {
      ...options,
      method: "DELETE",
    }
  );
};


// ============================================================
// LOGOUT / CLEAR LOCAL AUTH
// ============================================================

export const clearTokens = () => {

  localStorage.removeItem("token");

  localStorage.removeItem(
    "tp_token"
  );

  localStorage.removeItem(
    "tp_refresh_token"
  );
};


export { API_BASE_URL };