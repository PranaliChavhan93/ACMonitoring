// // // // import React, { useEffect, useState } from "react";
// // // // import "./Locations.css";

// // // // const API_URL = "http://localhost:8000/api/v1/filters/locations/";

// // // // const EMPTY_FORM = {
// // // //     zone_id: "",
// // // //     zone_name: "",
// // // //     zone_code: "",

// // // //     state_id: "",
// // // //     state_name: "",
// // // //     state_code: "",

// // // //     circle_id: "",
// // // //     circle_name: "",
// // // //     circle_code: "",

// // // //     city_id: "",
// // // //     city_name: "",

// // // //     branch_id: "",
// // // //     branch_name: "",

// // // //     floor_id: "",
// // // //     floor_name: "",

// // // //     room_id: "",
// // // //     room_name: "",
// // // // };

// // // // const Locations = () => {
// // // //     const [locations, setLocations] = useState([]);
// // // //     const [loading, setLoading] = useState(true);
// // // //     const [error, setError] = useState("");
// // // //     const [expanded, setExpanded] = useState({});

// // // //     const [showModal, setShowModal] = useState(false);
// // // //     const [locationType, setLocationType] = useState("zone");
// // // //     const [saving, setSaving] = useState(false);
// // // //     const [saveError, setSaveError] = useState("");
// // // //     const [formData, setFormData] = useState(EMPTY_FORM);

// // // //     const fetchLocations = async () => {
// // // //         try {
// // // //             setLoading(true);
// // // //             setError("");

// // // //             const response = await fetch(API_URL);

// // // //             if (!response.ok) {
// // // //                 throw new Error(`HTTP Error ${response.status}`);
// // // //             }

// // // //             const result = await response.json();

// // // //             console.log("LOCATIONS API RESPONSE:", result);

// // // //             if (result.success !== true) {
// // // //                 throw new Error("Location API returned success=false");
// // // //             }

// // // //             setLocations(Array.isArray(result.data) ? result.data : []);
// // // //         } catch (err) {
// // // //             console.error("Location API Error:", err);
// // // //             setError(err.message || "Unable to load locations");
// // // //         } finally {
// // // //             setLoading(false);
// // // //         }
// // // //     };

// // // //     useEffect(() => {
// // // //         fetchLocations();
// // // //     }, []);

// // // //     const toggleNode = (id) =>
// // // //         setExpanded((previous) => ({ ...previous, [id]: !previous[id] }));

// // // //     const getStateCount = (zone) => zone.states?.length || 0;
// // // //     const getCircleCount = (state) => state.circles?.length || 0;
// // // //     const getCityCount = (circle) => circle.cities?.length || 0;
// // // //     const getBranchCount = (city) => city.branches?.length || 0;
// // // //     const getFloorCount = (branch) => branch.floors?.length || 0;
// // // //     const getRoomCount = (floor) => floor.rooms?.length || 0;
// // // //     const getACCount = (room) => room.ac_devices?.length || 0;

// // // //     const getTotalACs = () => {
// // // //         let total = 0;

// // // //         locations.forEach((zone) => {
// // // //             zone.states?.forEach((state) => {
// // // //                 state.circles?.forEach((circle) => {
// // // //                     circle.cities?.forEach((city) => {
// // // //                         city.branches?.forEach((branch) => {
// // // //                             branch.floors?.forEach((floor) => {
// // // //                                 floor.rooms?.forEach((room) => {
// // // //                                     total += room.ac_devices?.length || 0;
// // // //                                 });
// // // //                             });
// // // //                         });
// // // //                     });
// // // //                 });
// // // //             });
// // // //         });

// // // //         return total;
// // // //     };

// // // //     const getTotalStates = () =>
// // // //         locations.reduce(
// // // //             (total, zone) => total + (zone.states?.length || 0),
// // // //             0
// // // //         );

// // // //     const getTotalCircles = () => {
// // // //         let total = 0;

// // // //         locations.forEach((zone) => {
// // // //             zone.states?.forEach((state) => {
// // // //                 total += state.circles?.length || 0;
// // // //             });
// // // //         });

// // // //         return total;
// // // //     };

// // // //     const resetForm = () => {
// // // //         setFormData(EMPTY_FORM);
// // // //         setLocationType("zone");
// // // //         setSaveError("");
// // // //     };

// // // //     const openAddLocation = () => {
// // // //         resetForm();
// // // //         setShowModal(true);
// // // //     };

// // // //     const closeAddLocation = () => {
// // // //         if (saving) return;
// // // //         setShowModal(false);
// // // //         resetForm();
// // // //     };

// // // //     const getStatesByZone = () => {
// // // //         const zone = locations.find((z) => z.zone_id === formData.zone_id);
// // // //         return zone?.states || [];
// // // //     };

// // // //     const getCirclesByState = () => {
// // // //         for (const zone of locations) {
// // // //             const state = zone.states?.find(
// // // //                 (s) => s.state_id === formData.state_id
// // // //             );
// // // //             if (state) return state.circles || [];
// // // //         }
// // // //         return [];
// // // //     };

// // // //     const getCitiesByCircle = () => {
// // // //         for (const zone of locations) {
// // // //             for (const state of zone.states || []) {
// // // //                 const circle = state.circles?.find(
// // // //                     (c) => c.circle_id === formData.circle_id
// // // //                 );
// // // //                 if (circle) return circle.cities || [];
// // // //             }
// // // //         }
// // // //         return [];
// // // //     };

// // // //     // const getBranchesByCity = () => {
// // // //     //     for (const zone of locations) {
// // // //     //         for (const state of zone.states || []) {
// // // //     //             for (const circle of state.circles || []) {
// // // //     //                 const city = circle.cities?.find(
// // // //     //                     (c) => c.city_id === formData.city_id
// // // //     //                 );
// // // //     //                 if (city) return city.branches || [];
// // // //     //             }
// // // //     //         }
// // // //     //     }
// // // //     //     return [];
// // // //     // };

// // // //     // const getFloorsByBranch = () => {
// // // //     //     for (const zone of locations) {
// // // //     //         for (const state of zone.states || []) {
// // // //     //             for (const circle of state.circles || []) {
// // // //     //                 for (const city of circle.cities || []) {
// // // //     //                     const branch = city.branches?.find(
// // // //     //                         (b) => b.branch_id === formData.branch_id
// // // //     //                     );
// // // //     //                     if (branch) return branch.floors || [];
// // // //     //                 }
// // // //     //             }
// // // //     //         }
// // // //     //     }
// // // //     //     return [];
// // // //     // };

// // // //     const allBranches = () =>
// // // //         locations
// // // //             .flatMap((z) => z.states || [])
// // // //             .flatMap((s) => s.circles || [])
// // // //             .flatMap((c) => c.cities || [])
// // // //             .flatMap((c) => c.branches || []);

// // // //     const allFloors = () =>
// // // //         allBranches().flatMap((b) => b.floors || []);

// // // //     if (loading) {
// // // //         return (
// // // //             <div className="locations-page">
// // // //                 <div className="locations-loading">
// // // //                     <div className="loading-spinner"></div>
// // // //                     <p>Loading Sites...</p>
// // // //                 </div>
// // // //             </div>
// // // //         );
// // // //     }

// // // //     if (error) {
// // // //         return (
// // // //             <div className="locations-page">
// // // //                 <div className="locations-header">
// // // //                     <div>
// // // //                         <h1>Sites</h1>
// // // //                         <p>Sites hierarchy</p>
// // // //                     </div>

// // // //                     <button className="refresh-btn" onClick={fetchLocations}>
// // // //                         ↻ Refresh
// // // //                     </button>
// // // //                 </div>

// // // //                 <div className="location-error">
// // // //                     <h3>Failed to load locations</h3>
// // // //                     <p>{error}</p>
// // // //                     <button onClick={fetchLocations}>Try Again</button>
// // // //                 </div>
// // // //             </div>
// // // //         );
// // // //     }

// // // //     return (
// // // //         <div className="locations-page">
// // // //             <div className="locations-header">
// // // //                 <div>
// // // //                     <h1>Sites</h1>
// // // //                     <p>Manage and view your complete site hierarchy</p>
// // // //                 </div>

// // // //                 <div className="header-actions">
// // // //                     <button className="refresh-btn" onClick={fetchLocations}>
// // // //                         ↻ Refresh
// // // //                     </button>

// // // //                     <button
// // // //                         className="add-location-btn"
// // // //                         onClick={openAddLocation}
// // // //                     >
// // // //                         <span>+</span>
// // // //                         Add Location
// // // //                     </button>
// // // //                 </div>
// // // //             </div>

// // // //             <div className="location-summary">
// // // //                 <div className="summary-card">
// // // //                     <div className="summary-icon zone-icon">Z</div>
// // // //                     <div>
// // // //                         <span>Zones</span>
// // // //                         <strong>{locations.length}</strong>
// // // //                     </div>
// // // //                 </div>

// // // //                 <div className="summary-card">
// // // //                     <div className="summary-icon state-icon">S</div>
// // // //                     <div>
// // // //                         <span>States</span>
// // // //                         <strong>{getTotalStates()}</strong>
// // // //                     </div>
// // // //                 </div>

// // // //                 <div className="summary-card">
// // // //                     <div className="summary-icon circle-icon">C</div>
// // // //                     <div>
// // // //                         <span>Circles</span>
// // // //                         <strong>{getTotalCircles()}</strong>
// // // //                     </div>
// // // //                 </div>

// // // //                 <div className="summary-card">
// // // //                     <div className="summary-icon ac-icon">AC</div>
// // // //                     <div>
// // // //                         <span>AC Units</span>
// // // //                         <strong>{getTotalACs()}</strong>
// // // //                     </div>
// // // //                 </div>
// // // //             </div>

// // // //             {locations.length === 0 ? (
// // // //                 <div className="empty-location">
// // // //                     <h3>No locations found</h3>
// // // //                     <p>The API returned an empty location list.</p>
// // // //                 </div>
// // // //             ) : (
// // // //                 <div className="location-tree">
// // // //                     {locations.map((zone, zoneIndex) => {
// // // //                         const zoneKey = `zone-${zone.zone_id || zoneIndex}`;
// // // //                         const zoneExpanded = expanded[zoneKey];

// // // //                         return (
// // // //                             <div className="tree-zone" key={zoneKey}>
// // // //                                 {/* ZONE */}

// // // //                                 <div
// // // //                                     className="tree-row zone-row"
// // // //                                     onClick={() => toggleNode(zoneKey)}
// // // //                                 >
// // // //                                     <button className="expand-btn">
// // // //                                         {zoneExpanded ? "−" : "+"}
// // // //                                     </button>

// // // //                                     <div className="location-symbol zone-symbol">
// // // //                                         Z
// // // //                                     </div>

// // // //                                     <div className="location-info">
// // // //                                         <strong>{zone.zone_name}</strong>
// // // //                                         <span>{zone.zone_id}</span>
// // // //                                     </div>

// // // //                                     <div className="location-count">
// // // //                                         {getStateCount(zone)} States
// // // //                                     </div>
// // // //                                 </div>

// // // //                                 {/* STATES */}

// // // //                                 {zoneExpanded && (
// // // //                                     <div className="tree-children">
// // // //                                         {zone.states?.map((state, stateIndex) => {
// // // //                                             const stateKey = `state-${state.state_id || stateIndex}`;
// // // //                                             const stateExpanded = expanded[stateKey];

// // // //                                             return (
// // // //                                                 <div key={stateKey}>
// // // //                                                     {/* STATE */}

// // // //                                                     <div
// // // //                                                         className="tree-row state-row"
// // // //                                                         onClick={() => toggleNode(stateKey)}
// // // //                                                     >
// // // //                                                         <button className="expand-btn">
// // // //                                                             {stateExpanded ? "−" : "+"}
// // // //                                                         </button>

// // // //                                                         <div className="location-symbol state-symbol">
// // // //                                                             S
// // // //                                                         </div>

// // // //                                                         <div className="location-info">
// // // //                                                             <strong>{state.state_name}</strong>
// // // //                                                             <span>{state.state_id}</span>
// // // //                                                         </div>

// // // //                                                         <div className="location-count">
// // // //                                                             {getCircleCount(state)} Circles
// // // //                                                         </div>
// // // //                                                     </div>

// // // //                                                     {/* CIRCLES */}

// // // //                                                     {stateExpanded && (
// // // //                                                         <div className="nested-level">
// // // //                                                             {state.circles?.map((circle, circleIndex) => {
// // // //                                                                 const circleKey = `circle-${circle.circle_id || circleIndex}`;
// // // //                                                                 const circleExpanded = expanded[circleKey];

// // // //                                                                 return (
// // // //                                                                     <div key={circleKey}>
// // // //                                                                         {/* CIRCLE */}

// // // //                                                                         <div
// // // //                                                                             className="tree-row circle-row"
// // // //                                                                             onClick={() => toggleNode(circleKey)}
// // // //                                                                         >
// // // //                                                                             <button className="expand-btn">
// // // //                                                                                 {circleExpanded ? "−" : "+"}
// // // //                                                                             </button>

// // // //                                                                             <div className="location-symbol circle-symbol">
// // // //                                                                                 C
// // // //                                                                             </div>

// // // //                                                                             <div className="location-info">
// // // //                                                                                 <strong>{circle.circle_name}</strong>
// // // //                                                                                 <span>{circle.circle_id}</span>
// // // //                                                                             </div>

// // // //                                                                             <div className="location-count">
// // // //                                                                                 {getCityCount(circle)} Cities
// // // //                                                                             </div>
// // // //                                                                         </div>

// // // //                                                                         {/* CITIES */}

// // // //                                                                         {circleExpanded && (
// // // //                                                                             <div className="nested-level">
// // // //                                                                                 {circle.cities?.map((city, cityIndex) => {
// // // //                                                                                     const cityKey = `city-${city.city_id || cityIndex}`;
// // // //                                                                                     const cityExpanded = expanded[cityKey];

// // // //                                                                                     return (
// // // //                                                                                         <div key={cityKey}>
// // // //                                                                                             {/* CITY */}

// // // //                                                                                             <div
// // // //                                                                                                 className="tree-row city-row"
// // // //                                                                                                 onClick={() => toggleNode(cityKey)}
// // // //                                                                                             >
// // // //                                                                                                 <button className="expand-btn">
// // // //                                                                                                     {cityExpanded ? "−" : "+"}
// // // //                                                                                                 </button>

// // // //                                                                                                 <div className="location-symbol city-symbol">
// // // //                                                                                                     C
// // // //                                                                                                 </div>

// // // //                                                                                                 <div className="location-info">
// // // //                                                                                                     <strong>{city.city_name}</strong>
// // // //                                                                                                     <span>{city.city_id}</span>
// // // //                                                                                                 </div>

// // // //                                                                                                 <div className="location-count">
// // // //                                                                                                     {getBranchCount(city)} Branches
// // // //                                                                                                 </div>
// // // //                                                                                             </div>

// // // //                                                                                             {/* BRANCHES */}

// // // //                                                                                             {cityExpanded && (
// // // //                                                                                                 <div className="nested-level">
// // // //                                                                                                     {city.branches?.map((branch, branchIndex) => {
// // // //                                                                                                         const branchKey = `branch-${branch.branch_id || branchIndex}`;
// // // //                                                                                                         const branchExpanded = expanded[branchKey];

// // // //                                                                                                         return (
// // // //                                                                                                             <div key={branchKey}>
// // // //                                                                                                                 {/* BRANCH */}

// // // //                                                                                                                 <div
// // // //                                                                                                                     className="tree-row branch-row"
// // // //                                                                                                                     onClick={() => toggleNode(branchKey)}
// // // //                                                                                                                 >
// // // //                                                                                                                     <button className="expand-btn">
// // // //                                                                                                                         {branchExpanded ? "−" : "+"}
// // // //                                                                                                                     </button>

// // // //                                                                                                                     <div className="location-symbol branch-symbol">
// // // //                                                                                                                         B
// // // //                                                                                                                     </div>

// // // //                                                                                                                     <div className="location-info">
// // // //                                                                                                                         <strong>{branch.branch_name}</strong>
// // // //                                                                                                                         <span>{branch.branch_id}</span>
// // // //                                                                                                                     </div>

// // // //                                                                                                                     <div className="location-count">
// // // //                                                                                                                         {getFloorCount(branch)} Floors
// // // //                                                                                                                     </div>
// // // //                                                                                                                 </div>

// // // //                                                                                                                 {/* FLOORS */}

// // // //                                                                                                                 {branchExpanded && (
// // // //                                                                                                                     <div className="nested-level">
// // // //                                                                                                                         {branch.floors?.map((floor, floorIndex) => {
// // // //                                                                                                                             const floorKey = `floor-${floor.floor_id || floorIndex}`;
// // // //                                                                                                                             const floorExpanded = expanded[floorKey];

// // // //                                                                                                                             return (
// // // //                                                                                                                                 <div key={floorKey}>
// // // //                                                                                                                                     {/* FLOOR */}

// // // //                                                                                                                                     <div
// // // //                                                                                                                                         className="tree-row floor-row"
// // // //                                                                                                                                         onClick={() => toggleNode(floorKey)}
// // // //                                                                                                                                     >
// // // //                                                                                                                                         <button className="expand-btn">
// // // //                                                                                                                                             {floorExpanded ? "−" : "+"}
// // // //                                                                                                                                         </button>

// // // //                                                                                                                                         <div className="location-symbol floor-symbol">
// // // //                                                                                                                                             F
// // // //                                                                                                                                         </div>

// // // //                                                                                                                                         <div className="location-info">
// // // //                                                                                                                                             <strong>{floor.floor_name}</strong>
// // // //                                                                                                                                             <span>{floor.floor_id}</span>
// // // //                                                                                                                                         </div>

// // // //                                                                                                                                         <div className="location-count">
// // // //                                                                                                                                             {getRoomCount(floor)} Rooms
// // // //                                                                                                                                         </div>
// // // //                                                                                                                                     </div>

// // // //                                                                                                                                     {/* ROOMS */}

// // // //                                                                                                                                     {floorExpanded && (
// // // //                                                                                                                                         <div className="nested-level">
// // // //                                                                                                                                             {floor.rooms?.map((room, roomIndex) => {
// // // //                                                                                                                                                 const roomKey = `room-${room.room_id || roomIndex}`;
// // // //                                                                                                                                                 const roomExpanded = expanded[roomKey];

// // // //                                                                                                                                                 return (
// // // //                                                                                                                                                     <div key={roomKey}>
// // // //                                                                                                                                                         {/* ROOM */}

// // // //                                                                                                                                                         <div
// // // //                                                                                                                                                             className="tree-row room-row"
// // // //                                                                                                                                                             onClick={() => toggleNode(roomKey)}
// // // //                                                                                                                                                         >
// // // //                                                                                                                                                             <button className="expand-btn">
// // // //                                                                                                                                                                 {roomExpanded ? "−" : "+"}
// // // //                                                                                                                                                             </button>

// // // //                                                                                                                                                             <div className="location-symbol room-symbol">
// // // //                                                                                                                                                                 R
// // // //                                                                                                                                                             </div>

// // // //                                                                                                                                                             <div className="location-info">
// // // //                                                                                                                                                                 <strong>{room.room_name}</strong>
// // // //                                                                                                                                                                 <span>{room.room_id}</span>
// // // //                                                                                                                                                             </div>

// // // //                                                                                                                                                             <div className="location-count">
// // // //                                                                                                                                                                 {getACCount(room)} ACs
// // // //                                                                                                                                                             </div>
// // // //                                                                                                                                                         </div>

// // // //                                                                                                                                                         {/* AC DEVICES */}

// // // //                                                                                                                                                         {roomExpanded && (
// // // //                                                                                                                                                             <div className="ac-list">
// // // //                                                                                                                                                                 {room.ac_devices?.map((ac, acIndex) => (
// // // //                                                                                                                                                                     <div
// // // //                                                                                                                                                                         className="ac-item"
// // // //                                                                                                                                                                         key={ac.ac_id || acIndex}
// // // //                                                                                                                                                                     >
// // // //                                                                                                                                                                         <div className="ac-dot"></div>

// // // //                                                                                                                                                                         <div className="ac-info">
// // // //                                                                                                                                                                             <strong>{ac.ac_id}</strong>
// // // //                                                                                                                                                                             <span>{ac.device_name}</span>
// // // //                                                                                                                                                                         </div>

// // // //                                                                                                                                                                         <span
// // // //                                                                                                                                                                             className={
// // // //                                                                                                                                                                                 ac.status === "ON"
// // // //                                                                                                                                                                                     ? "ac-status on"
// // // //                                                                                                                                                                                     : "ac-status off"
// // // //                                                                                                                                                                             }
// // // //                                                                                                                                                                         >
// // // //                                                                                                                                                                             {ac.status}
// // // //                                                                                                                                                                         </span>
// // // //                                                                                                                                                                     </div>
// // // //                                                                                                                                                                 ))}
// // // //                                                                                                                                                             </div>
// // // //                                                                                                                                                         )}
// // // //                                                                                                                                                     </div>
// // // //                                                                                                                                                 );
// // // //                                                                                                                                             })}
// // // //                                                                                                                                         </div>
// // // //                                                                                                                                     )}
// // // //                                                                                                                                 </div>
// // // //                                                                                                                             );
// // // //                                                                                                                         })}
// // // //                                                                                                                     </div>
// // // //                                                                                                                 )}
// // // //                                                                                                             </div>
// // // //                                                                                                         );
// // // //                                                                                                     })}
// // // //                                                                                                 </div>
// // // //                                                                                             )}
// // // //                                                                                         </div>
// // // //                                                                                     );
// // // //                                                                                 })}
// // // //                                                                             </div>
// // // //                                                                         )}
// // // //                                                                     </div>
// // // //                                                                 );
// // // //                                                             })}
// // // //                                                         </div>
// // // //                                                     )}
// // // //                                                 </div>
// // // //                                             );
// // // //                                         })}
// // // //                                     </div>
// // // //                                 )}
// // // //                             </div>
// // // //                         );
// // // //                     })}
// // // //                 </div>
// // // //             )}

// // // //             {showModal && (
// // // //                 <div className="modal-overlay" onClick={closeAddLocation}>
// // // //                     <div
// // // //                         className="location-modal"
// // // //                         onClick={(event) => event.stopPropagation()}
// // // //                     >
// // // //                         {/* MODAL HEADER */}

// // // //                         <div className="modal-header">
// // // //                             <div>
// // // //                                 <h2>
// // // //                                     Add{" "}
// // // //                                     {locationType.charAt(0).toUpperCase() +
// // // //                                         locationType.slice(1)}
// // // //                                 </h2>

// // // //                                 <p>Add a new location to the hierarchy</p>
// // // //                             </div>

// // // //                             <button
// // // //                                 className="close-btn"
// // // //                                 onClick={closeAddLocation}
// // // //                                 disabled={saving}
// // // //                             >
// // // //                                 ×
// // // //                             </button>
// // // //                         </div>

// // // //                         {/* FORM */}

// // // //                         <form
// // // //                             onSubmit={(event) => {
// // // //                                 event.preventDefault();
// // // //                                 console.log("Location to create:", formData);
// // // //                                 // POST API will be connected here.
// // // //                             }}
// // // //                         >
// // // //                             <div className="form-group">
// // // //                                 <label>Location Type</label>

// // // //                                 <select
// // // //                                     value={locationType}
// // // //                                     onChange={(event) => {
// // // //                                         setLocationType(event.target.value);
// // // //                                         setSaveError("");
// // // //                                     }}
// // // //                                 >
// // // //                                     <option value="zone">Zone</option>
// // // //                                     <option value="state">State</option>
// // // //                                     <option value="circle">Circle</option>
// // // //                                     <option value="city">City</option>
// // // //                                     <option value="branch">Branch</option>
// // // //                                     <option value="floor">Floor</option>
// // // //                                     <option value="room">Room</option>
// // // //                                 </select>
// // // //                             </div>

// // // //                             {locationType === "zone" && (
// // // //                                 <>
// // // //                                     <div className="form-group">
// // // //                                         <label>Zone Code</label>
// // // //                                         <input
// // // //                                             type="text"
// // // //                                             placeholder="Example: ZN-W"
// // // //                                             value={formData.zone_code}
// // // //                                             onChange={(e) =>
// // // //                                                 setFormData({
// // // //                                                     ...formData,
// // // //                                                     zone_code: e.target.value,
// // // //                                                 })
// // // //                                             }
// // // //                                             required
// // // //                                         />
// // // //                                     </div>

// // // //                                     <div className="form-group">
// // // //                                         <label>Zone Name</label>
// // // //                                         <input
// // // //                                             type="text"
// // // //                                             placeholder="Example: Western"
// // // //                                             value={formData.zone_name}
// // // //                                             onChange={(e) =>
// // // //                                                 setFormData({
// // // //                                                     ...formData,
// // // //                                                     zone_name: e.target.value,
// // // //                                                 })
// // // //                                             }
// // // //                                             required
// // // //                                         />
// // // //                                     </div>
// // // //                                 </>
// // // //                             )}

// // // //                             {locationType === "state" && (
// // // //                                 <>
// // // //                                     <div className="form-group">
// // // //                                         <label>Zone</label>
// // // //                                         <select
// // // //                                             value={formData.zone_id}
// // // //                                             onChange={(e) =>
// // // //                                                 setFormData({
// // // //                                                     ...formData,
// // // //                                                     zone_id: e.target.value,
// // // //                                                     state_id: "",
// // // //                                                     circle_id: "",
// // // //                                                     city_id: "",
// // // //                                                     branch_id: "",
// // // //                                                     floor_id: "",
// // // //                                                 })
// // // //                                             }
// // // //                                             required
// // // //                                         >
// // // //                                             <option value="">Select Zone</option>
// // // //                                             {locations.map((zone) => (
// // // //                                                 <option
// // // //                                                     key={zone.zone_id}
// // // //                                                     value={zone.zone_id}
// // // //                                                 >
// // // //                                                     {zone.zone_name}
// // // //                                                 </option>
// // // //                                             ))}
// // // //                                         </select>
// // // //                                     </div>

// // // //                                     <div className="form-group">
// // // //                                         <label>State Code</label>
// // // //                                         <input
// // // //                                             type="text"
// // // //                                             placeholder="Example: MH"
// // // //                                             value={formData.state_code}
// // // //                                             onChange={(e) =>
// // // //                                                 setFormData({
// // // //                                                     ...formData,
// // // //                                                     state_code: e.target.value,
// // // //                                                 })
// // // //                                             }
// // // //                                             required
// // // //                                         />
// // // //                                     </div>

// // // //                                     <div className="form-group">
// // // //                                         <label>State Name</label>
// // // //                                         <input
// // // //                                             type="text"
// // // //                                             placeholder="Example: Maharashtra"
// // // //                                             value={formData.state_name}
// // // //                                             onChange={(e) =>
// // // //                                                 setFormData({
// // // //                                                     ...formData,
// // // //                                                     state_name: e.target.value,
// // // //                                                 })
// // // //                                             }
// // // //                                             required
// // // //                                         />
// // // //                                     </div>
// // // //                                 </>
// // // //                             )}

// // // //                             {/* CIRCLE FORM */}

// // // //                             {locationType === "circle" && (
// // // //                                 <>
// // // //                                     <div className="form-group">
// // // //                                         <label>Zone</label>
// // // //                                         <select
// // // //                                             value={formData.zone_id}
// // // //                                             onChange={(e) =>
// // // //                                                 setFormData({
// // // //                                                     ...formData,
// // // //                                                     zone_id: e.target.value,
// // // //                                                     state_id: "",
// // // //                                                     circle_id: "",
// // // //                                                 })
// // // //                                             }
// // // //                                             required
// // // //                                         >
// // // //                                             <option value="">Select Zone</option>
// // // //                                             {locations.map((zone) => (
// // // //                                                 <option
// // // //                                                     key={zone.zone_id}
// // // //                                                     value={zone.zone_id}
// // // //                                                 >
// // // //                                                     {zone.zone_name}
// // // //                                                 </option>
// // // //                                             ))}
// // // //                                         </select>
// // // //                                     </div>

// // // //                                     <div className="form-group">
// // // //                                         <label>State</label>
// // // //                                         <select
// // // //                                             value={formData.state_id}
// // // //                                             onChange={(e) =>
// // // //                                                 setFormData({
// // // //                                                     ...formData,
// // // //                                                     state_id: e.target.value,
// // // //                                                     circle_id: "",
// // // //                                                 })
// // // //                                             }
// // // //                                             disabled={!formData.zone_id}
// // // //                                             required
// // // //                                         >
// // // //                                             <option value="">Select State</option>
// // // //                                             {getStatesByZone().map((state) => (
// // // //                                                 <option
// // // //                                                     key={state.state_id}
// // // //                                                     value={state.state_id}
// // // //                                                 >
// // // //                                                     {state.state_name}
// // // //                                                 </option>
// // // //                                             ))}
// // // //                                         </select>
// // // //                                     </div>

// // // //                                     <div className="form-group">
// // // //                                         <label>Circle Code</label>
// // // //                                         <input
// // // //                                             type="text"
// // // //                                             placeholder="Example: MH-C01"
// // // //                                             value={formData.circle_code}
// // // //                                             onChange={(e) =>
// // // //                                                 setFormData({
// // // //                                                     ...formData,
// // // //                                                     circle_code: e.target.value,
// // // //                                                 })
// // // //                                             }
// // // //                                             required
// // // //                                         />
// // // //                                     </div>

// // // //                                     <div className="form-group">
// // // //                                         <label>Circle Name</label>
// // // //                                         <input
// // // //                                             type="text"
// // // //                                             placeholder="Example: Pune Circle"
// // // //                                             value={formData.circle_name}
// // // //                                             onChange={(e) =>
// // // //                                                 setFormData({
// // // //                                                     ...formData,
// // // //                                                     circle_name: e.target.value,
// // // //                                                 })
// // // //                                             }
// // // //                                             required
// // // //                                         />
// // // //                                     </div>
// // // //                                 </>
// // // //                             )}

// // // //                             {/* CITY FORM */}

// // // //                             {locationType === "city" && (
// // // //                                 <>
// // // //                                     <div className="form-group">
// // // //                                         <label>Zone</label>
// // // //                                         <select
// // // //                                             value={formData.zone_id}
// // // //                                             onChange={(e) =>
// // // //                                                 setFormData({
// // // //                                                     ...formData,
// // // //                                                     zone_id: e.target.value,
// // // //                                                     state_id: "",
// // // //                                                     circle_id: "",
// // // //                                                 })
// // // //                                             }
// // // //                                             required
// // // //                                         >
// // // //                                             <option value="">Select Zone</option>
// // // //                                             {locations.map((zone) => (
// // // //                                                 <option
// // // //                                                     key={zone.zone_id}
// // // //                                                     value={zone.zone_id}
// // // //                                                 >
// // // //                                                     {zone.zone_name}
// // // //                                                 </option>
// // // //                                             ))}
// // // //                                         </select>
// // // //                                     </div>

// // // //                                     <div className="form-group">
// // // //                                         <label>State</label>
// // // //                                         <select
// // // //                                             value={formData.state_id}
// // // //                                             onChange={(e) =>
// // // //                                                 setFormData({
// // // //                                                     ...formData,
// // // //                                                     state_id: e.target.value,
// // // //                                                     circle_id: "",
// // // //                                                 })
// // // //                                             }
// // // //                                             disabled={!formData.zone_id}
// // // //                                             required
// // // //                                         >
// // // //                                             <option value="">Select State</option>
// // // //                                             {getStatesByZone().map((state) => (
// // // //                                                 <option
// // // //                                                     key={state.state_id}
// // // //                                                     value={state.state_id}
// // // //                                                 >
// // // //                                                     {state.state_name}
// // // //                                                 </option>
// // // //                                             ))}
// // // //                                         </select>
// // // //                                     </div>

// // // //                                     <div className="form-group">
// // // //                                         <label>Circle</label>
// // // //                                         <select
// // // //                                             value={formData.circle_id}
// // // //                                             onChange={(e) =>
// // // //                                                 setFormData({
// // // //                                                     ...formData,
// // // //                                                     circle_id: e.target.value,
// // // //                                                 })
// // // //                                             }
// // // //                                             disabled={!formData.state_id}
// // // //                                             required
// // // //                                         >
// // // //                                             <option value="">Select Circle</option>
// // // //                                             {getCirclesByState().map((circle) => (
// // // //                                                 <option
// // // //                                                     key={circle.circle_id}
// // // //                                                     value={circle.circle_id}
// // // //                                                 >
// // // //                                                     {circle.circle_name}
// // // //                                                 </option>
// // // //                                             ))}
// // // //                                         </select>
// // // //                                     </div>

// // // //                                     <div className="form-group">
// // // //                                         <label>City Name</label>
// // // //                                         <input
// // // //                                             type="text"
// // // //                                             placeholder="Example: Pune"
// // // //                                             value={formData.city_name}
// // // //                                             onChange={(e) =>
// // // //                                                 setFormData({
// // // //                                                     ...formData,
// // // //                                                     city_name: e.target.value,
// // // //                                                 })
// // // //                                             }
// // // //                                             required
// // // //                                         />
// // // //                                     </div>
// // // //                                 </>
// // // //                             )}

// // // //                             {/* BRANCH FORM */}

// // // //                             {locationType === "branch" && (
// // // //                                 <>
// // // //                                     <div className="form-group">
// // // //                                         <label>Zone</label>
// // // //                                         <select
// // // //                                             value={formData.zone_id}
// // // //                                             onChange={(e) =>
// // // //                                                 setFormData({
// // // //                                                     ...formData,
// // // //                                                     zone_id: e.target.value,
// // // //                                                     state_id: "",
// // // //                                                     circle_id: "",
// // // //                                                     city_id: "",
// // // //                                                 })
// // // //                                             }
// // // //                                             required
// // // //                                         >
// // // //                                             <option value="">Select Zone</option>
// // // //                                             {locations.map((zone) => (
// // // //                                                 <option
// // // //                                                     key={zone.zone_id}
// // // //                                                     value={zone.zone_id}
// // // //                                                 >
// // // //                                                     {zone.zone_name}
// // // //                                                 </option>
// // // //                                             ))}
// // // //                                         </select>
// // // //                                     </div>

// // // //                                     <div className="form-group">
// // // //                                         <label>State</label>
// // // //                                         <select
// // // //                                             value={formData.state_id}
// // // //                                             onChange={(e) =>
// // // //                                                 setFormData({
// // // //                                                     ...formData,
// // // //                                                     state_id: e.target.value,
// // // //                                                     circle_id: "",
// // // //                                                     city_id: "",
// // // //                                                 })
// // // //                                             }
// // // //                                             disabled={!formData.zone_id}
// // // //                                             required
// // // //                                         >
// // // //                                             <option value="">Select State</option>
// // // //                                             {getStatesByZone().map((state) => (
// // // //                                                 <option
// // // //                                                     key={state.state_id}
// // // //                                                     value={state.state_id}
// // // //                                                 >
// // // //                                                     {state.state_name}
// // // //                                                 </option>
// // // //                                             ))}
// // // //                                         </select>
// // // //                                     </div>

// // // //                                     <div className="form-group">
// // // //                                         <label>Circle</label>
// // // //                                         <select
// // // //                                             value={formData.circle_id}
// // // //                                             onChange={(e) =>
// // // //                                                 setFormData({
// // // //                                                     ...formData,
// // // //                                                     circle_id: e.target.value,
// // // //                                                     city_id: "",
// // // //                                                 })
// // // //                                             }
// // // //                                             disabled={!formData.state_id}
// // // //                                             required
// // // //                                         >
// // // //                                             <option value="">Select Circle</option>
// // // //                                             {getCirclesByState().map((circle) => (
// // // //                                                 <option
// // // //                                                     key={circle.circle_id}
// // // //                                                     value={circle.circle_id}
// // // //                                                 >
// // // //                                                     {circle.circle_name}
// // // //                                                 </option>
// // // //                                             ))}
// // // //                                         </select>
// // // //                                     </div>

// // // //                                     <div className="form-group">
// // // //                                         <label>City</label>
// // // //                                         <select
// // // //                                             value={formData.city_id}
// // // //                                             onChange={(e) =>
// // // //                                                 setFormData({
// // // //                                                     ...formData,
// // // //                                                     city_id: e.target.value,
// // // //                                                 })
// // // //                                             }
// // // //                                             disabled={!formData.circle_id}
// // // //                                             required
// // // //                                         >
// // // //                                             <option value="">Select City</option>
// // // //                                             {getCitiesByCircle().map((city) => (
// // // //                                                 <option
// // // //                                                     key={city.city_id}
// // // //                                                     value={city.city_id}
// // // //                                                 >
// // // //                                                     {city.city_name}
// // // //                                                 </option>
// // // //                                             ))}
// // // //                                         </select>
// // // //                                     </div>

// // // //                                     <div className="form-group">
// // // //                                         <label>Branch Code</label>
// // // //                                         <input
// // // //                                             type="text"
// // // //                                             placeholder="Example: MH-PUN-B05"
// // // //                                             value={formData.branch_id}
// // // //                                             onChange={(e) =>
// // // //                                                 setFormData({
// // // //                                                     ...formData,
// // // //                                                     branch_id: e.target.value,
// // // //                                                 })
// // // //                                             }
// // // //                                             required
// // // //                                         />
// // // //                                     </div>

// // // //                                     <div className="form-group">
// // // //                                         <label>Branch Name</label>
// // // //                                         <input
// // // //                                             type="text"
// // // //                                             placeholder="Example: Pune Branch 05"
// // // //                                             value={formData.branch_name}
// // // //                                             onChange={(e) =>
// // // //                                                 setFormData({
// // // //                                                     ...formData,
// // // //                                                     branch_name: e.target.value,
// // // //                                                 })
// // // //                                             }
// // // //                                             required
// // // //                                         />
// // // //                                     </div>
// // // //                                 </>
// // // //                             )}

// // // //                             {/* FLOOR FORM */}

// // // //                             {locationType === "floor" && (
// // // //                                 <>
// // // //                                     <div className="form-group">
// // // //                                         <label>Branch</label>
// // // //                                         <select
// // // //                                             value={formData.branch_id}
// // // //                                             onChange={(event) =>
// // // //                                                 setFormData({
// // // //                                                     ...formData,
// // // //                                                     branch_id: event.target.value,
// // // //                                                 })
// // // //                                             }
// // // //                                             required
// // // //                                         >
// // // //                                             <option value="">Select Branch</option>
// // // //                                             {allBranches().map((branch) => (
// // // //                                                 <option
// // // //                                                     key={branch.branch_id}
// // // //                                                     value={branch.branch_id}
// // // //                                                 >
// // // //                                                     {branch.branch_name}
// // // //                                                 </option>
// // // //                                             ))}
// // // //                                         </select>
// // // //                                     </div>

// // // //                                     <div className="form-group">
// // // //                                         <label>Floor Name</label>
// // // //                                         <input
// // // //                                             type="text"
// // // //                                             placeholder="Example: Floor-05"
// // // //                                             value={formData.floor_name}
// // // //                                             onChange={(event) =>
// // // //                                                 setFormData({
// // // //                                                     ...formData,
// // // //                                                     floor_name: event.target.value,
// // // //                                                 })
// // // //                                             }
// // // //                                             required
// // // //                                         />
// // // //                                     </div>
// // // //                                 </>
// // // //                             )}

// // // //                             {/* ROOM FORM */}

// // // //                             {locationType === "room" && (
// // // //                                 <>
// // // //                                     <div className="form-group">
// // // //                                         <label>Floor</label>
// // // //                                         <select
// // // //                                             value={formData.floor_id}
// // // //                                             onChange={(event) =>
// // // //                                                 setFormData({
// // // //                                                     ...formData,
// // // //                                                     floor_id: event.target.value,
// // // //                                                 })
// // // //                                             }
// // // //                                             required
// // // //                                         >
// // // //                                             <option value="">Select Floor</option>
// // // //                                             {allFloors().map((floor) => (
// // // //                                                 <option
// // // //                                                     key={floor.floor_id}
// // // //                                                     value={floor.floor_id}
// // // //                                                 >
// // // //                                                     {floor.floor_name}
// // // //                                                 </option>
// // // //                                             ))}
// // // //                                         </select>
// // // //                                     </div>

// // // //                                     <div className="form-group">
// // // //                                         <label>Room Name</label>
// // // //                                         <input
// // // //                                             type="text"
// // // //                                             placeholder="Example: Room-05"
// // // //                                             value={formData.room_name}
// // // //                                             onChange={(event) =>
// // // //                                                 setFormData({
// // // //                                                     ...formData,
// // // //                                                     room_name: event.target.value,
// // // //                                                 })
// // // //                                             }
// // // //                                             required
// // // //                                         />
// // // //                                     </div>
// // // //                                 </>
// // // //                             )}

// // // //                             {/* ERROR */}

// // // //                             {saveError && (
// // // //                                 <div className="location-error">{saveError}</div>
// // // //                             )}

// // // //                             {/* ACTIONS */}

// // // //                             <div className="modal-actions">
// // // //                                 <button
// // // //                                     type="button"
// // // //                                     className="cancel-btn"
// // // //                                     onClick={closeAddLocation}
// // // //                                     disabled={saving}
// // // //                                 >
// // // //                                     Cancel
// // // //                                 </button>

// // // //                                 <button
// // // //                                     type="submit"
// // // //                                     className="save-btn"
// // // //                                     disabled={saving}
// // // //                                 >
// // // //                                     {saving ? "Saving..." : "Add Location"}
// // // //                                 </button>
// // // //                             </div>
// // // //                         </form>
// // // //                     </div>
// // // //                 </div>
// // // //             )}
// // // //         </div>
// // // //     );
// // // // };

// // // // export default Locations;



// // // import React, { useEffect, useMemo, useState } from "react";
// // // import "./Locations.css";

// // // const API_URL = "http://localhost:8000/api/v1/filters/locations/";

// // // const EMPTY_FORM = {
// // //     zone_id: "",
// // //     zone_name: "",
// // //     zone_code: "",

// // //     state_id: "",
// // //     state_name: "",
// // //     state_code: "",

// // //     district_id: "",
// // //     district_name: "",
// // //     district_code: "",

// // //     taluka_id: "",
// // //     taluka_name: "",
// // //     taluka_code: "",

// // //     circle_id: "",
// // //     circle_name: "",
// // //     circle_code: "",

// // //     region_id: "",
// // //     region_name: "",
// // //     region_code: "",

// // //     division_id: "",
// // //     division_name: "",
// // //     division_code: "",

// // //     city_id: "",
// // //     city_name: "",
// // //     city_code: "",

// // //     branch_id: "",
// // //     branch_name: "",
// // //     branch_code: "",

// // //     floor_id: "",
// // //     floor_name: "",

// // //     room_id: "",
// // //     room_name: "",
// // // };

// // // const Locations = () => {
// // //     const [locations, setLocations] = useState({
// // //         GEOGRAPHICAL: [],
// // //         ZONAL: [],
// // //     });

// // //     const [hierarchyType, setHierarchyType] = useState("GEOGRAPHICAL");

// // //     const [loading, setLoading] = useState(true);
// // //     const [error, setError] = useState("");
// // //     const [expanded, setExpanded] = useState({});

// // //     const [showModal, setShowModal] = useState(false);
// // //     const [locationType, setLocationType] = useState("");
// // //     const [saving, setSaving] = useState(false);
// // //     const [saveError, setSaveError] = useState("");
// // //     const [formData, setFormData] = useState(EMPTY_FORM);

// // //     const currentLocations =
// // //         locations[hierarchyType] || [];

// // //     const fetchLocations = async () => {
// // //         try {
// // //             setLoading(true);
// // //             setError("");

// // //             const response = await fetch(API_URL, {
// // //                 method: "GET",
// // //                 cache: "no-store",
// // //             });

// // //             if (!response.ok) {
// // //                 throw new Error(`HTTP Error ${response.status}`);
// // //             }

// // //             const result = await response.json();

// // //             console.log("LOCATIONS API RESPONSE:", result);

// // //             if (result.success !== true) {
// // //                 throw new Error(
// // //                     "Location API returned success=false"
// // //                 );
// // //             }

// // //             /*
// // //             * Actual API response:
// // //             *
// // //             * {
// // //             *   success: true,
// // //             *
// // //             *   geographical: {
// // //             *      hierarchy_type: "GEOGRAPHICAL",
// // //             *      data: [...]
// // //             *   },
// // //             *
// // //             *   zonal: {
// // //             *      hierarchy_type: "ZONAL",
// // //             *      data: [...]
// // //             *   }
// // //             * }
// // //             */

// // //             setLocations({
// // //                 GEOGRAPHICAL:
// // //                     Array.isArray(result.geographical?.data)
// // //                         ? result.geographical.data
// // //                         : [],

// // //                 ZONAL:
// // //                     Array.isArray(result.zonal?.data)
// // //                         ? result.zonal.data
// // //                         : [],
// // //             });

// // //         } catch (err) {
// // //             console.error(
// // //                 "Location API Error:",
// // //                 err
// // //             );

// // //             setError(
// // //                 err.message ||
// // //                 "Unable to load locations"
// // //             );

// // //         } finally {
// // //             setLoading(false);
// // //         }
// // //     };

// // //     useEffect(() => {
// // //         fetchLocations();
// // //     }, []);

// // //     const changeHierarchy = (type) => {
// // //         setHierarchyType(type);
// // //         setExpanded({});
// // //         setShowModal(false);
// // //         setSaveError("");
// // //     };

// // //     const toggleNode = (id) => {
// // //         setExpanded((previous) => ({
// // //             ...previous,
// // //             [id]: !previous[id],
// // //         }));
// // //     };

// // //     const getStateCount = (item) =>
// // //         item.states?.length || 0;

// // //     const getDistrictCount = (state) =>
// // //         state.districts?.length || 0;

// // //     const getTalukaCount = (district) =>
// // //         district.talukas?.length || 0;

// // //     const getCityCount = (item) =>
// // //         item.cities?.length || 0;

// // //     const getBranchCount = (item) =>
// // //         item.branches?.length || 0;

// // //     const getCircleCount = (zone) =>
// // //         zone.circles?.length || 0;

// // //     const getRegionCount = (circle) =>
// // //         circle.regions?.length || 0;

// // //     const getDivisionCount = (region) =>
// // //         region.divisions?.length || 0;

// // //     const getFloorCount = (branch) =>
// // //         branch.floors?.length || 0;

// // //     const getDirectACCount = (branch) =>
// // //         branch.ac_devices?.length || 0;

// // //     const getRoomCount = (floor) =>
// // //         floor.rooms?.length || 0;

// // //     const getACCount = (room) =>
// // //         room.ac_devices?.length || 0;

// // //     const getTotalACs = () => {
// // //         let total = 0;

// // //         if (hierarchyType === "GEOGRAPHICAL") {
// // //             currentLocations.forEach((state) => {
// // //                 state.districts?.forEach((district) => {
// // //                     district.talukas?.forEach((taluka) => {
// // //                         taluka.cities?.forEach((city) => {
// // //                             city.branches?.forEach((branch) => {
// // //                                 total +=
// // //                                     branch.ac_devices?.length || 0;

// // //                                 branch.floors?.forEach((floor) => {
// // //                                     floor.rooms?.forEach((room) => {
// // //                                         total +=
// // //                                             room.ac_devices?.length || 0;
// // //                                     });
// // //                                 });
// // //                             });
// // //                         });
// // //                     });
// // //                 });
// // //             });
// // //         } else {
// // //             currentLocations.forEach((zone) => {
// // //                 zone.circles?.forEach((circle) => {
// // //                     circle.regions?.forEach((region) => {
// // //                         region.divisions?.forEach((division) => {
// // //                             division.branches?.forEach((branch) => {
// // //                                 total +=
// // //                                     branch.ac_devices?.length || 0;

// // //                                 branch.floors?.forEach((floor) => {
// // //                                     floor.rooms?.forEach((room) => {
// // //                                         total +=
// // //                                             room.ac_devices?.length || 0;
// // //                                     });
// // //                                 });
// // //                             });
// // //                         });
// // //                     });
// // //                 });
// // //             });
// // //         }

// // //         return total;
// // //     };

// // //     const getTotalStates = () => {
// // //         if (hierarchyType === "GEOGRAPHICAL") {
// // //             return currentLocations.length;
// // //         }

// // //         return currentLocations.reduce(
// // //             (total, zone) =>
// // //                 total + (zone.states?.length || 0),
// // //             0
// // //         );
// // //     };

// // //     const getTotalDistricts = () => {
// // //         if (hierarchyType !== "GEOGRAPHICAL") {
// // //             return 0;
// // //         }

// // //         return currentLocations.reduce(
// // //             (total, state) =>
// // //                 total +
// // //                 (state.districts?.length || 0),
// // //             0
// // //         );
// // //     };

// // //     const getTotalZones = () => {
// // //         if (hierarchyType === "ZONAL") {
// // //             return currentLocations.length;
// // //         }

// // //         return 0;
// // //     };

// // //     const getTotalCircles = () => {
// // //         if (hierarchyType !== "ZONAL") {
// // //             return 0;
// // //         }

// // //         return currentLocations.reduce(
// // //             (total, zone) =>
// // //                 total +
// // //                 (zone.circles?.length || 0),
// // //             0
// // //         );
// // //     };

// // //     const getTotalBranches = () => {
// // //         let total = 0;

// // //         if (hierarchyType === "GEOGRAPHICAL") {
// // //             currentLocations.forEach((state) => {
// // //                 state.districts?.forEach((district) => {
// // //                     district.talukas?.forEach((taluka) => {
// // //                         taluka.cities?.forEach((city) => {
// // //                             total +=
// // //                                 city.branches?.length || 0;
// // //                         });
// // //                     });
// // //                 });
// // //             });
// // //         } else {
// // //             currentLocations.forEach((zone) => {
// // //                 zone.circles?.forEach((circle) => {
// // //                     circle.regions?.forEach((region) => {
// // //                         region.divisions?.forEach((division) => {
// // //                             total +=
// // //                                 division.branches?.length || 0;
// // //                         });
// // //                     });
// // //                 });
// // //             });
// // //         }

// // //         return total;
// // //     };

// // //     /* =========================================================
// // //        FORM HELPERS
// // //     ========================================================= */

// // //     const resetForm = () => {
// // //         setFormData(EMPTY_FORM);
// // //         setLocationType("");
// // //         setSaveError("");
// // //     };

// // //     const openAddLocation = () => {
// // //         resetForm();

// // //         /*
// // //          * Default location according to hierarchy.
// // //          */
// // //         if (hierarchyType === "GEOGRAPHICAL") {
// // //             setLocationType("state");
// // //         } else {
// // //             setLocationType("zone");
// // //         }

// // //         setShowModal(true);
// // //     };

// // //     const closeAddLocation = () => {
// // //         if (saving) return;

// // //         setShowModal(false);
// // //         resetForm();
// // //     };

// // //     const handleFieldChange = (
// // //         field,
// // //         value
// // //     ) => {
// // //         setFormData((previous) => ({
// // //             ...previous,
// // //             [field]: value,
// // //         }));
// // //     };

// // //     /* =========================================================
// // //        GEOGRAPHICAL LOOKUPS
// // //     ========================================================= */

// // //     const getDistrictsByState = () => {
// // //         const state = currentLocations.find(
// // //             (item) =>
// // //                 item.state_id ===
// // //                 formData.state_id
// // //         );

// // //         return state?.districts || [];
// // //     };

// // //     const getTalukasByDistrict = () => {
// // //         for (const state of currentLocations) {
// // //             const district =
// // //                 state.districts?.find(
// // //                     (item) =>
// // //                         item.district_id ===
// // //                         formData.district_id
// // //                 );

// // //             if (district) {
// // //                 return district.talukas || [];
// // //             }
// // //         }

// // //         return [];
// // //     };

// // //     const getCitiesByTaluka = () => {
// // //         for (const state of currentLocations) {
// // //             for (const district of state.districts || []) {
// // //                 const taluka =
// // //                     district.talukas?.find(
// // //                         (item) =>
// // //                             item.taluka_id ===
// // //                             formData.taluka_id
// // //                     );

// // //                 if (taluka) {
// // //                     return taluka.cities || [];
// // //                 }
// // //             }
// // //         }

// // //         return [];
// // //     };

// // //     /* =========================================================
// // //        ZONAL LOOKUPS
// // //     ========================================================= */

// // //     const getStatesByZone = () => {
// // //         const zone = currentLocations.find(
// // //             (item) =>
// // //                 item.zone_id ===
// // //                 formData.zone_id
// // //         );

// // //         return zone?.states || [];
// // //     };

// // //     const getCirclesByZone = () => {
// // //         const zone = currentLocations.find(
// // //             (item) =>
// // //                 item.zone_id ===
// // //                 formData.zone_id
// // //         );

// // //         return zone?.circles || [];
// // //     };

// // //     const getRegionsByCircle = () => {
// // //         for (const zone of currentLocations) {
// // //             const circle =
// // //                 zone.circles?.find(
// // //                     (item) =>
// // //                         item.circle_id ===
// // //                         formData.circle_id
// // //                 );

// // //             if (circle) {
// // //                 return circle.regions || [];
// // //             }
// // //         }

// // //         return [];
// // //     };

// // //     const getDivisionsByRegion = () => {
// // //         for (const zone of currentLocations) {
// // //             for (const circle of zone.circles || []) {
// // //                 const region =
// // //                     circle.regions?.find(
// // //                         (item) =>
// // //                             item.region_id ===
// // //                             formData.region_id
// // //                     );

// // //                 if (region) {
// // //                     return region.divisions || [];
// // //                 }
// // //             }
// // //         }

// // //         return [];
// // //     };

// // //     /* =========================================================
// // //        ALL BRANCHES
// // //     ========================================================= */

// // //     const allBranches = () => {
// // //         if (hierarchyType === "GEOGRAPHICAL") {
// // //             return currentLocations
// // //                 .flatMap(
// // //                     (state) =>
// // //                         state.districts || []
// // //                 )
// // //                 .flatMap(
// // //                     (district) =>
// // //                         district.talukas || []
// // //                 )
// // //                 .flatMap(
// // //                     (taluka) =>
// // //                         taluka.cities || []
// // //                 )
// // //                 .flatMap(
// // //                     (city) =>
// // //                         city.branches || []
// // //                 );
// // //         }

// // //         return currentLocations
// // //             .flatMap(
// // //                 (zone) =>
// // //                     zone.circles || []
// // //             )
// // //             .flatMap(
// // //                 (circle) =>
// // //                     circle.regions || []
// // //             )
// // //             .flatMap(
// // //                 (region) =>
// // //                     region.divisions || []
// // //             )
// // //             .flatMap(
// // //                 (division) =>
// // //                     division.branches || []
// // //             );
// // //     };

// // //     const allFloors = () =>
// // //         allBranches().flatMap(
// // //             (branch) =>
// // //                 branch.floors || []
// // //         );

// // //     /* =========================================================
// // //        LOCATION TYPE OPTIONS
// // //     ========================================================= */

// // //     const locationTypeOptions =
// // //         hierarchyType === "GEOGRAPHICAL"
// // //             ? [
// // //                   {
// // //                       value: "state",
// // //                       label: "State",
// // //                   },
// // //                   {
// // //                       value: "district",
// // //                       label: "District",
// // //                   },
// // //                   {
// // //                       value: "taluka",
// // //                       label: "Taluka",
// // //                   },
// // //                   {
// // //                       value: "city",
// // //                       label: "City",
// // //                   },
// // //                   {
// // //                       value: "branch",
// // //                       label: "Branch",
// // //                   },
// // //                   {
// // //                       value: "floor",
// // //                       label: "Floor",
// // //                   },
// // //                   {
// // //                       value: "room",
// // //                       label: "Room",
// // //                   },
// // //               ]
// // //             : [
// // //                   {
// // //                       value: "zone",
// // //                       label: "Zone",
// // //                   },
// // //                   {
// // //                       value: "circle",
// // //                       label: "Circle",
// // //                   },
// // //                   {
// // //                       value: "region",
// // //                       label: "Region",
// // //                   },
// // //                   {
// // //                       value: "division",
// // //                       label: "Division",
// // //                   },
// // //                   {
// // //                       value: "branch",
// // //                       label: "Branch",
// // //                   },
// // //                   {
// // //                       value: "floor",
// // //                       label: "Floor",
// // //                   },
// // //                   {
// // //                       value: "room",
// // //                       label: "Room",
// // //                   },
// // //               ];

// // //     /* =========================================================
// // //        LOADING
// // //     ========================================================= */

// // //     if (loading) {
// // //         return (
// // //             <div className="locations-page">
// // //                 <div className="locations-loading">
// // //                     <div className="loading-spinner"></div>
// // //                     <p>Loading Sites...</p>
// // //                 </div>
// // //             </div>
// // //         );
// // //     }

// // //     /* =========================================================
// // //        ERROR
// // //     ========================================================= */

// // //     if (error) {
// // //         return (
// // //             <div className="locations-page">
// // //                 <div className="locations-header">
// // //                     <div>
// // //                         <h1>Sites</h1>
// // //                         <p>Sites hierarchy</p>
// // //                     </div>

// // //                     <button
// // //                         className="refresh-btn"
// // //                         onClick={fetchLocations}
// // //                     >
// // //                         ↻ Refresh
// // //                     </button>
// // //                 </div>

// // //                 <div className="location-error">
// // //                     <h3>
// // //                         Failed to load locations
// // //                     </h3>

// // //                     <p>{error}</p>

// // //                     <button
// // //                         onClick={fetchLocations}
// // //                     >
// // //                         Try Again
// // //                     </button>
// // //                 </div>
// // //             </div>
// // //         );
// // //     }

// // //     /* =========================================================
// // //        RENDER
// // //     ========================================================= */

// // //     return (
// // //         <div className="locations-page">

// // //             {/* =================================================
// // //                 HEADER
// // //             ================================================= */}

// // //             <div className="locations-header">
// // //                 <div>
// // //                     <h1>Sites</h1>

// // //                     <p>
// // //                         Manage and view your
// // //                         complete site hierarchy
// // //                     </p>
// // //                 </div>

// // //                 <div className="header-actions">
// // //                     <button
// // //                         className="refresh-btn"
// // //                         onClick={fetchLocations}
// // //                     >
// // //                         ↻ Refresh
// // //                     </button>

// // //                     <button
// // //                         className="add-location-btn"
// // //                         onClick={
// // //                             openAddLocation
// // //                         }
// // //                     >
// // //                         <span>+</span>
// // //                         Add Location
// // //                     </button>
// // //                 </div>
// // //             </div>

// // //             {/* =================================================
// // //                 HIERARCHY SWITCH
// // //             ================================================= */}

// // //             <div
// // //                 className="hierarchy-switch"
// // //                 style={{
// // //                     display: "flex",
// // //                     gap: "10px",
// // //                     marginBottom: "20px",
// // //                 }}
// // //             >
// // //                 <button
// // //                     type="button"
// // //                     onClick={() =>
// // //                         changeHierarchy(
// // //                             "GEOGRAPHICAL"
// // //                         )
// // //                     }
// // //                     className={
// // //                         hierarchyType ===
// // //                         "GEOGRAPHICAL"
// // //                             ? "hierarchy-tab active"
// // //                             : "hierarchy-tab"
// // //                     }
// // //                 >
// // //                     Geographical
// // //                 </button>

// // //                 <button
// // //                     type="button"
// // //                     onClick={() =>
// // //                         changeHierarchy(
// // //                             "ZONAL"
// // //                         )
// // //                     }
// // //                     className={
// // //                         hierarchyType ===
// // //                         "ZONAL"
// // //                             ? "hierarchy-tab active"
// // //                             : "hierarchy-tab"
// // //                     }
// // //                 >
// // //                     Zonal
// // //                 </button>
// // //             </div>

// // //             {/* =================================================
// // //                 CURRENT HIERARCHY INFORMATION
// // //             ================================================= */}

// // //             <div
// // //                 className="hierarchy-description"
// // //                 style={{
// // //                     marginBottom: "20px",
// // //                 }}
// // //             >
// // //                 <strong>
// // //                     {hierarchyType ===
// // //                     "GEOGRAPHICAL"
// // //                         ? "Geographical Hierarchy"
// // //                         : "Zonal Hierarchy"}
// // //                 </strong>

// // //                 <span>
// // //                     {hierarchyType ===
// // //                     "GEOGRAPHICAL"
// // //                         ? "India → State → District → Taluka → City → Branch"
// // //                         : "India → Zone → Circle → Region → Division → Branch"}
// // //                 </span>
// // //             </div>

// // //             {/* =================================================
// // //                 SUMMARY
// // //             ================================================= */}

// // //             <div className="location-summary">

// // //                 <div className="summary-card">
// // //                     <div className="summary-icon zone-icon">
// // //                         {hierarchyType ===
// // //                         "GEOGRAPHICAL"
// // //                             ? "S"
// // //                             : "Z"}
// // //                     </div>

// // //                     <div>
// // //                         <span>
// // //                             {hierarchyType ===
// // //                             "GEOGRAPHICAL"
// // //                                 ? "States"
// // //                                 : "Zones"}
// // //                         </span>

// // //                         <strong>
// // //                             {hierarchyType ===
// // //                             "GEOGRAPHICAL"
// // //                                 ? getTotalStates()
// // //                                 : getTotalZones()}
// // //                         </strong>
// // //                     </div>
// // //                 </div>

// // //                 <div className="summary-card">
// // //                     <div className="summary-icon state-icon">
// // //                         {hierarchyType ===
// // //                         "GEOGRAPHICAL"
// // //                             ? "D"
// // //                             : "C"}
// // //                     </div>

// // //                     <div>
// // //                         <span>
// // //                             {hierarchyType ===
// // //                             "GEOGRAPHICAL"
// // //                                 ? "Districts"
// // //                                 : "Circles"}
// // //                         </span>

// // //                         <strong>
// // //                             {hierarchyType ===
// // //                             "GEOGRAPHICAL"
// // //                                 ? getTotalDistricts()
// // //                                 : getTotalCircles()}
// // //                         </strong>
// // //                     </div>
// // //                 </div>

// // //                 <div className="summary-card">
// // //                     <div className="summary-icon circle-icon">
// // //                         B
// // //                     </div>

// // //                     <div>
// // //                         <span>
// // //                             Branches
// // //                         </span>

// // //                         <strong>
// // //                             {getTotalBranches()}
// // //                         </strong>
// // //                     </div>
// // //                 </div>

// // //                 <div className="summary-card">
// // //                     <div className="summary-icon ac-icon">
// // //                         AC
// // //                     </div>

// // //                     <div>
// // //                         <span>
// // //                             AC Units
// // //                         </span>

// // //                         <strong>
// // //                             {getTotalACs()}
// // //                         </strong>
// // //                     </div>
// // //                 </div>

// // //             </div>

// // //             {/* =================================================
// // //                 EMPTY
// // //             ================================================= */}

// // //             {currentLocations.length === 0 ? (
// // //                 <div className="empty-location">
// // //                     <h3>
// // //                         No{" "}
// // //                         {hierarchyType ===
// // //                         "GEOGRAPHICAL"
// // //                             ? "geographical"
// // //                             : "zonal"}{" "}
// // //                         locations found
// // //                     </h3>

// // //                     <p>
// // //                         No locations are
// // //                         currently available
// // //                         for this hierarchy.
// // //                     </p>
// // //                 </div>
// // //             ) : (
// // //                 <>
// // //                     {/* =================================================
// // //                         GEOGRAPHICAL TREE
// // //                     ================================================= */}

// // //                     {hierarchyType ===
// // //                         "GEOGRAPHICAL" && (
// // //                         <div className="location-tree">

// // //                             {currentLocations.map(
// // //                                 (
// // //                                     state,
// // //                                     stateIndex
// // //                                 ) => {
// // //                                     const stateKey =
// // //                                         `geo-state-${
// // //                                             state.state_id ||
// // //                                             stateIndex
// // //                                         }`;

// // //                                     const stateExpanded =
// // //                                         expanded[
// // //                                             stateKey
// // //                                         ];

// // //                                     return (
// // //                                         <div
// // //                                             className="tree-zone"
// // //                                             key={
// // //                                                 stateKey
// // //                                             }
// // //                                         >

// // //                                             {/* STATE */}

// // //                                             <div
// // //                                                 className="tree-row zone-row"
// // //                                                 onClick={() =>
// // //                                                     toggleNode(
// // //                                                         stateKey
// // //                                                     )
// // //                                                 }
// // //                                             >
// // //                                                 <button className="expand-btn">
// // //                                                     {stateExpanded
// // //                                                         ? "−"
// // //                                                         : "+"}
// // //                                                 </button>

// // //                                                 <div className="location-symbol zone-symbol">
// // //                                                     S
// // //                                                 </div>

// // //                                                 <div className="location-info">
// // //                                                     <strong>
// // //                                                         {
// // //                                                             state.state_name
// // //                                                         }
// // //                                                     </strong>

// // //                                                     <span>
// // //                                                         {
// // //                                                             state.state_id
// // //                                                         }
// // //                                                     </span>
// // //                                                 </div>

// // //                                                 <div className="location-count">
// // //                                                     {
// // //                                                         getDistrictCount(
// // //                                                             state
// // //                                                         )
// // //                                                     }{" "}
// // //                                                     Districts
// // //                                                 </div>
// // //                                             </div>

// // //                                             {/* DISTRICTS */}

// // //                                             {stateExpanded && (
// // //                                                 <div className="tree-children">

// // //                                                     {state.districts?.map(
// // //                                                         (
// // //                                                             district,
// // //                                                             districtIndex
// // //                                                         ) => {
// // //                                                             const districtKey =
// // //                                                                 `geo-district-${
// // //                                                                     district.district_id ||
// // //                                                                     districtIndex
// // //                                                                 }`;

// // //                                                             const districtExpanded =
// // //                                                                 expanded[
// // //                                                                     districtKey
// // //                                                                 ];

// // //                                                             return (
// // //                                                                 <div
// // //                                                                     key={
// // //                                                                         districtKey
// // //                                                                     }
// // //                                                                 >

// // //                                                                     <div
// // //                                                                         className="tree-row state-row"
// // //                                                                         onClick={() =>
// // //                                                                             toggleNode(
// // //                                                                                 districtKey
// // //                                                                             )
// // //                                                                         }
// // //                                                                     >
// // //                                                                         <button className="expand-btn">
// // //                                                                             {districtExpanded
// // //                                                                                 ? "−"
// // //                                                                                 : "+"}
// // //                                                                         </button>

// // //                                                                         <div className="location-symbol state-symbol">
// // //                                                                             D
// // //                                                                         </div>

// // //                                                                         <div className="location-info">
// // //                                                                             <strong>
// // //                                                                                 {
// // //                                                                                     district.district_name
// // //                                                                                 }
// // //                                                                             </strong>

// // //                                                                             <span>
// // //                                                                                 {
// // //                                                                                     district.district_id
// // //                                                                                 }
// // //                                                                             </span>
// // //                                                                         </div>

// // //                                                                         <div className="location-count">
// // //                                                                             {
// // //                                                                                 getTalukaCount(
// // //                                                                                     district
// // //                                                                                 )
// // //                                                                             }{" "}
// // //                                                                             Talukas
// // //                                                                         </div>
// // //                                                                     </div>

// // //                                                                     {/* TALUKAS */}

// // //                                                                     {districtExpanded && (
// // //                                                                         <div className="nested-level">

// // //                                                                             {district.talukas?.map(
// // //                                                                                 (
// // //                                                                                     taluka,
// // //                                                                                     talukaIndex
// // //                                                                                 ) => {
// // //                                                                                     const talukaKey =
// // //                                                                                         `geo-taluka-${
// // //                                                                                             taluka.taluka_id ||
// // //                                                                                             talukaIndex
// // //                                                                                         }`;

// // //                                                                                     const talukaExpanded =
// // //                                                                                         expanded[
// // //                                                                                             talukaKey
// // //                                                                                         ];

// // //                                                                                     return (
// // //                                                                                         <div
// // //                                                                                             key={
// // //                                                                                                 talukaKey
// // //                                                                                             }
// // //                                                                                         >

// // //                                                                                             <div
// // //                                                                                                 className="tree-row circle-row"
// // //                                                                                                 onClick={() =>
// // //                                                                                                     toggleNode(
// // //                                                                                                         talukaKey
// // //                                                                                                     )
// // //                                                                                                 }
// // //                                                                                             >
// // //                                                                                                 <button className="expand-btn">
// // //                                                                                                     {talukaExpanded
// // //                                                                                                         ? "−"
// // //                                                                                                         : "+"}
// // //                                                                                                 </button>

// // //                                                                                                 <div className="location-symbol circle-symbol">
// // //                                                                                                     T
// // //                                                                                                 </div>

// // //                                                                                                 <div className="location-info">
// // //                                                                                                     <strong>
// // //                                                                                                         {
// // //                                                                                                             taluka.taluka_name
// // //                                                                                                         }
// // //                                                                                                     </strong>

// // //                                                                                                     <span>
// // //                                                                                                         {
// // //                                                                                                             taluka.taluka_id
// // //                                                                                                         }
// // //                                                                                                     </span>
// // //                                                                                                 </div>

// // //                                                                                                 <div className="location-count">
// // //                                                                                                     {
// // //                                                                                                         getCityCount(
// // //                                                                                                             taluka
// // //                                                                                                         )
// // //                                                                                                     }{" "}
// // //                                                                                                     Cities
// // //                                                                                                 </div>
// // //                                                                                             </div>

// // //                                                                                             {/* CITIES */}

// // //                                                                                             {talukaExpanded && (
// // //                                                                                                 <div className="nested-level">

// // //                                                                                                     {taluka.cities?.map(
// // //                                                                                                         (
// // //                                                                                                             city,
// // //                                                                                                             cityIndex
// // //                                                                                                         ) => {
// // //                                                                                                             const cityKey =
// // //                                                                                                                 `geo-city-${
// // //                                                                                                                     city.city_id ||
// // //                                                                                                                     cityIndex
// // //                                                                                                                 }`;

// // //                                                                                                             const cityExpanded =
// // //                                                                                                                 expanded[
// // //                                                                                                                     cityKey
// // //                                                                                                                 ];

// // //                                                                                                             return (
// // //                                                                                                                 <div
// // //                                                                                                                     key={
// // //                                                                                                                         cityKey
// // //                                                                                                                     }
// // //                                                                                                                 >

// // //                                                                                                                     <div
// // //                                                                                                                         className="tree-row city-row"
// // //                                                                                                                         onClick={() =>
// // //                                                                                                                             toggleNode(
// // //                                                                                                                                 cityKey
// // //                                                                                                                             )
// // //                                                                                                                         }
// // //                                                                                                                     >
// // //                                                                                                                         <button className="expand-btn">
// // //                                                                                                                             {cityExpanded
// // //                                                                                                                                 ? "−"
// // //                                                                                                                                 : "+"}
// // //                                                                                                                         </button>

// // //                                                                                                                         <div className="location-symbol city-symbol">
// // //                                                                                                                             C
// // //                                                                                                                         </div>

// // //                                                                                                                         <div className="location-info">
// // //                                                                                                                             <strong>
// // //                                                                                                                                 {
// // //                                                                                                                                     city.city_name
// // //                                                                                                                                 }
// // //                                                                                                                             </strong>

// // //                                                                                                                             <span>
// // //                                                                                                                                 {
// // //                                                                                                                                     city.city_id
// // //                                                                                                                                 }
// // //                                                                                                                             </span>
// // //                                                                                                                         </div>

// // //                                                                                                                         <div className="location-count">
// // //                                                                                                                             {
// // //                                                                                                                                 getBranchCount(
// // //                                                                                                                                     city
// // //                                                                                                                                 )
// // //                                                                                                                             }{" "}
// // //                                                                                                                             Branches
// // //                                                                                                                         </div>
// // //                                                                                                                     </div>

// // //                                                                                                                     {/* BRANCHES */}

// // //                                                                                                                     {cityExpanded && (
// // //                                                                                                                         <div className="nested-level">

// // //                                                                                                                             {city.branches?.map(
// // //                                                                                                                                 (
// // //                                                                                                                                     branch,
// // //                                                                                                                                     branchIndex
// // //                                                                                                                                 ) => (
// // //                                                                                                                                     <BranchTree
// // //                                                                                                                                         key={
// // //                                                                                                                                             branch.branch_id ||
// // //                                                                                                                                             branchIndex
// // //                                                                                                                                         }
// // //                                                                                                                                         branch={
// // //                                                                                                                                             branch
// // //                                                                                                                                         }
// // //                                                                                                                                         expanded={
// // //                                                                                                                                             expanded
// // //                                                                                                                                         }
// // //                                                                                                                                         toggleNode={
// // //                                                                                                                                             toggleNode
// // //                                                                                                                                         }
// // //                                                                                                                                     />
// // //                                                                                                                                 )
// // //                                                                                                                             )}

// // //                                                                                                                         </div>
// // //                                                                                                                     )}

// // //                                                                                                                 </div>
// // //                                                                                                             );
// // //                                                                                                         }
// // //                                                                                                     )}

// // //                                                                                                 </div>
// // //                                                                                             )}

// // //                                                                                         </div>
// // //                                                                                     );
// // //                                                                                 }
// // //                                                                             )}

// // //                                                                         </div>
// // //                                                                     )}

// // //                                                                 </div>
// // //                                                             );
// // //                                                         }
// // //                                                     )}

// // //                                                 </div>
// // //                                             )}

// // //                                         </div>
// // //                                     );
// // //                                 }
// // //                             )}

// // //                         </div>
// // //                     )}

// // //                     {/* =================================================
// // //                         ZONAL TREE
// // //                     ================================================= */}

// // //                     {hierarchyType ===
// // //                         "ZONAL" && (
// // //                         <div className="location-tree">

// // //                             {currentLocations.map(
// // //                                 (
// // //                                     zone,
// // //                                     zoneIndex
// // //                                 ) => {
// // //                                     const zoneKey =
// // //                                         `zonal-zone-${
// // //                                             zone.zone_id ||
// // //                                             zoneIndex
// // //                                         }`;

// // //                                     const zoneExpanded =
// // //                                         expanded[
// // //                                             zoneKey
// // //                                         ];

// // //                                     return (
// // //                                         <div
// // //                                             className="tree-zone"
// // //                                             key={
// // //                                                 zoneKey
// // //                                             }
// // //                                         >

// // //                                             {/* ZONE */}

// // //                                             <div
// // //                                                 className="tree-row zone-row"
// // //                                                 onClick={() =>
// // //                                                     toggleNode(
// // //                                                         zoneKey
// // //                                                     )
// // //                                                 }
// // //                                             >
// // //                                                 <button className="expand-btn">
// // //                                                     {zoneExpanded
// // //                                                         ? "−"
// // //                                                         : "+"}
// // //                                                 </button>

// // //                                                 <div className="location-symbol zone-symbol">
// // //                                                     Z
// // //                                                 </div>

// // //                                                 <div className="location-info">
// // //                                                     <strong>
// // //                                                         {
// // //                                                             zone.zone_name
// // //                                                         }
// // //                                                     </strong>

// // //                                                     <span>
// // //                                                         {
// // //                                                             zone.zone_id
// // //                                                         }
// // //                                                     </span>
// // //                                                 </div>

// // //                                                 <div className="location-count">
// // //                                                     {
// // //                                                         getCircleCount(
// // //                                                             zone
// // //                                                         )
// // //                                                     }{" "}
// // //                                                     Circles
// // //                                                 </div>
// // //                                             </div>

// // //                                             {/* CIRCLES */}

// // //                                             {zoneExpanded && (
// // //                                                 <div className="tree-children">

// // //                                                     {zone.circles?.map(
// // //                                                         (
// // //                                                             circle,
// // //                                                             circleIndex
// // //                                                         ) => {
// // //                                                             const circleKey =
// // //                                                                 `zonal-circle-${
// // //                                                                     circle.circle_id ||
// // //                                                                     circleIndex
// // //                                                                 }`;

// // //                                                             const circleExpanded =
// // //                                                                 expanded[
// // //                                                                     circleKey
// // //                                                                 ];

// // //                                                             return (
// // //                                                                 <div
// // //                                                                     key={
// // //                                                                         circleKey
// // //                                                                     }
// // //                                                                 >

// // //                                                                     <div
// // //                                                                         className="tree-row state-row"
// // //                                                                         onClick={() =>
// // //                                                                             toggleNode(
// // //                                                                                 circleKey
// // //                                                                             )
// // //                                                                         }
// // //                                                                     >
// // //                                                                         <button className="expand-btn">
// // //                                                                             {circleExpanded
// // //                                                                                 ? "−"
// // //                                                                                 : "+"}
// // //                                                                         </button>

// // //                                                                         <div className="location-symbol state-symbol">
// // //                                                                             C
// // //                                                                         </div>

// // //                                                                         <div className="location-info">
// // //                                                                             <strong>
// // //                                                                                 {
// // //                                                                                     circle.circle_name
// // //                                                                                 }
// // //                                                                             </strong>

// // //                                                                             <span>
// // //                                                                                 {
// // //                                                                                     circle.circle_id
// // //                                                                                 }
// // //                                                                             </span>
// // //                                                                         </div>

// // //                                                                         <div className="location-count">
// // //                                                                             {
// // //                                                                                 getRegionCount(
// // //                                                                                     circle
// // //                                                                                 )
// // //                                                                             }{" "}
// // //                                                                             Regions
// // //                                                                         </div>
// // //                                                                     </div>

// // //                                                                     {/* REGIONS */}

// // //                                                                     {circleExpanded && (
// // //                                                                         <div className="nested-level">

// // //                                                                             {circle.regions?.map(
// // //                                                                                 (
// // //                                                                                     region,
// // //                                                                                     regionIndex
// // //                                                                                 ) => {
// // //                                                                                     const regionKey =
// // //                                                                                         `zonal-region-${
// // //                                                                                             region.region_id ||
// // //                                                                                             regionIndex
// // //                                                                                         }`;

// // //                                                                                     const regionExpanded =
// // //                                                                                         expanded[
// // //                                                                                             regionKey
// // //                                                                                         ];

// // //                                                                                     return (
// // //                                                                                         <div
// // //                                                                                             key={
// // //                                                                                                 regionKey
// // //                                                                                             }
// // //                                                                                         >

// // //                                                                                             <div
// // //                                                                                                 className="tree-row circle-row"
// // //                                                                                                 onClick={() =>
// // //                                                                                                     toggleNode(
// // //                                                                                                         regionKey
// // //                                                                                                     )
// // //                                                                                                 }
// // //                                                                                             >
// // //                                                                                                 <button className="expand-btn">
// // //                                                                                                     {regionExpanded
// // //                                                                                                         ? "−"
// // //                                                                                                         : "+"}
// // //                                                                                                 </button>

// // //                                                                                                 <div className="location-symbol circle-symbol">
// // //                                                                                                     R
// // //                                                                                                 </div>

// // //                                                                                                 <div className="location-info">
// // //                                                                                                     <strong>
// // //                                                                                                         {
// // //                                                                                                             region.region_name
// // //                                                                                                         }
// // //                                                                                                     </strong>

// // //                                                                                                     <span>
// // //                                                                                                         {
// // //                                                                                                             region.region_id
// // //                                                                                                         }
// // //                                                                                                     </span>
// // //                                                                                                 </div>

// // //                                                                                                 <div className="location-count">
// // //                                                                                                     {
// // //                                                                                                         getDivisionCount(
// // //                                                                                                             region
// // //                                                                                                         )
// // //                                                                                                     }{" "}
// // //                                                                                                     Divisions
// // //                                                                                                 </div>
// // //                                                                                             </div>

// // //                                                                                             {/* DIVISIONS */}

// // //                                                                                             {regionExpanded && (
// // //                                                                                                 <div className="nested-level">

// // //                                                                                                     {region.divisions?.map(
// // //                                                                                                         (
// // //                                                                                                             division,
// // //                                                                                                             divisionIndex
// // //                                                                                                         ) => {
// // //                                                                                                             const divisionKey =
// // //                                                                                                                 `zonal-division-${
// // //                                                                                                                     division.division_id ||
// // //                                                                                                                     divisionIndex
// // //                                                                                                                 }`;

// // //                                                                                                             const divisionExpanded =
// // //                                                                                                                 expanded[
// // //                                                                                                                     divisionKey
// // //                                                                                                                 ];

// // //                                                                                                             return (
// // //                                                                                                                 <div
// // //                                                                                                                     key={
// // //                                                                                                                         divisionKey
// // //                                                                                                                     }
// // //                                                                                                                 >

// // //                                                                                                                     <div
// // //                                                                                                                         className="tree-row city-row"
// // //                                                                                                                         onClick={() =>
// // //                                                                                                                             toggleNode(
// // //                                                                                                                                 divisionKey
// // //                                                                                                                             )
// // //                                                                                                                         }
// // //                                                                                                                     >
// // //                                                                                                                         <button className="expand-btn">
// // //                                                                                                                             {divisionExpanded
// // //                                                                                                                                 ? "−"
// // //                                                                                                                                 : "+"}
// // //                                                                                                                         </button>

// // //                                                                                                                         <div className="location-symbol city-symbol">
// // //                                                                                                                             D
// // //                                                                                                                         </div>

// // //                                                                                                                         <div className="location-info">
// // //                                                                                                                             <strong>
// // //                                                                                                                                 {
// // //                                                                                                                                     division.division_name
// // //                                                                                                                                 }
// // //                                                                                                                             </strong>

// // //                                                                                                                             <span>
// // //                                                                                                                                 {
// // //                                                                                                                                     division.division_id
// // //                                                                                                                                 }
// // //                                                                                                                             </span>
// // //                                                                                                                         </div>

// // //                                                                                                                         <div className="location-count">
// // //                                                                                                                             {
// // //                                                                                                                                 getBranchCount(
// // //                                                                                                                                     division
// // //                                                                                                                                 )
// // //                                                                                                                             }{" "}
// // //                                                                                                                             Branches
// // //                                                                                                                         </div>
// // //                                                                                                                     </div>

// // //                                                                                                                     {/* BRANCHES */}

// // //                                                                                                                     {divisionExpanded && (
// // //                                                                                                                         <div className="nested-level">

// // //                                                                                                                             {division.branches?.map(
// // //                                                                                                                                 (
// // //                                                                                                                                     branch,
// // //                                                                                                                                     branchIndex
// // //                                                                                                                                 ) => (
// // //                                                                                                                                     <BranchTree
// // //                                                                                                                                         key={
// // //                                                                                                                                             branch.branch_id ||
// // //                                                                                                                                             branchIndex
// // //                                                                                                                                         }
// // //                                                                                                                                         branch={
// // //                                                                                                                                             branch
// // //                                                                                                                                         }
// // //                                                                                                                                         expanded={
// // //                                                                                                                                             expanded
// // //                                                                                                                                         }
// // //                                                                                                                                         toggleNode={
// // //                                                                                                                                             toggleNode
// // //                                                                                                                                         }
// // //                                                                                                                                     />
// // //                                                                                                                                 )
// // //                                                                                                                             )}

// // //                                                                                                                         </div>
// // //                                                                                                                     )}

// // //                                                                                                                 </div>
// // //                                                                                                             );
// // //                                                                                                         }
// // //                                                                                                     )}

// // //                                                                                                 </div>
// // //                                                                                             )}

// // //                                                                                         </div>
// // //                                                                                     );
// // //                                                                                 }
// // //                                                                             )}

// // //                                                                         </div>
// // //                                                                     )}

// // //                                                                 </div>
// // //                                                             );
// // //                                                         }
// // //                                                     )}

// // //                                                 </div>
// // //                                             )}

// // //                                         </div>
// // //                                     );
// // //                                 }
// // //                             )}

// // //                         </div>
// // //                     )}
// // //                 </>
// // //             )}

// // //             {/* =================================================
// // //                 ADD LOCATION MODAL
// // //             ================================================= */}

// // //             {showModal && (
// // //                 <div
// // //                     className="modal-overlay"
// // //                     onClick={closeAddLocation}
// // //                 >
// // //                     <div
// // //                         className="location-modal"
// // //                         onClick={(event) =>
// // //                             event.stopPropagation()
// // //                         }
// // //                     >

// // //                         {/* MODAL HEADER */}

// // //                         <div className="modal-header">
// // //                             <div>
// // //                                 <h2>
// // //                                     Add{" "}
// // //                                     {
// // //                                         locationTypeOptions.find(
// // //                                             (item) =>
// // //                                                 item.value ===
// // //                                                 locationType
// // //                                         )?.label
// // //                                     }
// // //                                 </h2>

// // //                                 <p>
// // //                                     Add a new location to the{" "}
// // //                                     {hierarchyType ===
// // //                                     "GEOGRAPHICAL"
// // //                                         ? "geographical"
// // //                                         : "zonal"}{" "}
// // //                                     hierarchy.
// // //                                 </p>
// // //                             </div>

// // //                             <button
// // //                                 className="close-btn"
// // //                                 onClick={
// // //                                     closeAddLocation
// // //                                 }
// // //                                 disabled={saving}
// // //                             >
// // //                                 ×
// // //                             </button>
// // //                         </div>

// // //                         {/* FORM */}

// // //                         <form
// // //                             onSubmit={(event) => {
// // //                                 event.preventDefault();

// // //                                 console.log(
// // //                                     "Location to create:",
// // //                                     {
// // //                                         hierarchyType,
// // //                                         locationType,
// // //                                         formData,
// // //                                     }
// // //                                 );

// // //                                 /*
// // //                                  * Connect POST API here.
// // //                                  */
// // //                             }}
// // //                         >

// // //                             {/* LOCATION TYPE */}

// // //                             <div className="form-group">
// // //                                 <label>
// // //                                     Location Type
// // //                                 </label>

// // //                                 <select
// // //                                     value={
// // //                                         locationType
// // //                                     }
// // //                                     onChange={(event) => {
// // //                                         setLocationType(
// // //                                             event.target.value
// // //                                         );
// // //                                         setSaveError("");
// // //                                         setFormData(
// // //                                             EMPTY_FORM
// // //                                         );
// // //                                     }}
// // //                                 >
// // //                                     {locationTypeOptions.map(
// // //                                         (option) => (
// // //                                             <option
// // //                                                 key={
// // //                                                     option.value
// // //                                                 }
// // //                                                 value={
// // //                                                     option.value
// // //                                                 }
// // //                                             >
// // //                                                 {
// // //                                                     option.label
// // //                                                 }
// // //                                             </option>
// // //                                         )
// // //                                     )}
// // //                                 </select>
// // //                             </div>

// // //                             {/* =================================================
// // //                                 GEOGRAPHICAL FORM
// // //                             ================================================= */}

// // //                             {hierarchyType ===
// // //                                 "GEOGRAPHICAL" && (
// // //                                 <>
// // //                                     {/* STATE */}

// // //                                     {locationType ===
// // //                                         "state" && (
// // //                                         <>
// // //                                             <div className="form-group">
// // //                                                 <label>
// // //                                                     State Code
// // //                                                 </label>

// // //                                                 <input
// // //                                                     type="text"
// // //                                                     placeholder="Example: MH"
// // //                                                     value={
// // //                                                         formData.state_code
// // //                                                     }
// // //                                                     onChange={(e) =>
// // //                                                         handleFieldChange(
// // //                                                             "state_code",
// // //                                                             e.target.value
// // //                                                         )
// // //                                                     }
// // //                                                     required
// // //                                                 />
// // //                                             </div>

// // //                                             <div className="form-group">
// // //                                                 <label>
// // //                                                     State Name
// // //                                                 </label>

// // //                                                 <input
// // //                                                     type="text"
// // //                                                     placeholder="Example: Maharashtra"
// // //                                                     value={
// // //                                                         formData.state_name
// // //                                                     }
// // //                                                     onChange={(e) =>
// // //                                                         handleFieldChange(
// // //                                                             "state_name",
// // //                                                             e.target.value
// // //                                                         )
// // //                                                     }
// // //                                                     required
// // //                                                 />
// // //                                             </div>
// // //                                         </>
// // //                                     )}

// // //                                     {/* DISTRICT */}

// // //                                     {locationType ===
// // //                                         "district" && (
// // //                                         <>
// // //                                             <div className="form-group">
// // //                                                 <label>
// // //                                                     State
// // //                                                 </label>

// // //                                                 <select
// // //                                                     value={
// // //                                                         formData.state_id
// // //                                                     }
// // //                                                     onChange={(e) =>
// // //                                                         setFormData(
// // //                                                             {
// // //                                                                 ...formData,
// // //                                                                 state_id:
// // //                                                                     e.target
// // //                                                                         .value,
// // //                                                                 district_id:
// // //                                                                     "",
// // //                                                                 taluka_id:
// // //                                                                     "",
// // //                                                                 city_id:
// // //                                                                     "",
// // //                                                             }
// // //                                                         )
// // //                                                     }
// // //                                                     required
// // //                                                 >
// // //                                                     <option value="">
// // //                                                         Select State
// // //                                                     </option>

// // //                                                     {currentLocations.map(
// // //                                                         (
// // //                                                             state
// // //                                                         ) => (
// // //                                                             <option
// // //                                                                 key={
// // //                                                                     state.state_id
// // //                                                                 }
// // //                                                                 value={
// // //                                                                     state.state_id
// // //                                                                 }
// // //                                                             >
// // //                                                                 {
// // //                                                                     state.state_name
// // //                                                                 }
// // //                                                             </option>
// // //                                                         )
// // //                                                     )}
// // //                                                 </select>
// // //                                             </div>

// // //                                             <LocationTextField
// // //                                                 label="District Code"
// // //                                                 placeholder="Example: MH-PUN"
// // //                                                 value={
// // //                                                     formData.district_code
// // //                                                 }
// // //                                                 onChange={(value) =>
// // //                                                     handleFieldChange(
// // //                                                         "district_code",
// // //                                                         value
// // //                                                     )
// // //                                                 }
// // //                                             />

// // //                                             <LocationTextField
// // //                                                 label="District Name"
// // //                                                 placeholder="Example: Pune"
// // //                                                 value={
// // //                                                     formData.district_name
// // //                                                 }
// // //                                                 onChange={(value) =>
// // //                                                     handleFieldChange(
// // //                                                         "district_name",
// // //                                                         value
// // //                                                     )
// // //                                                 }
// // //                                             />
// // //                                         </>
// // //                                     )}

// // //                                     {/* TALUKA */}

// // //                                     {locationType ===
// // //                                         "taluka" && (
// // //                                         <>
// // //                                             <SelectField
// // //                                                 label="State"
// // //                                                 value={
// // //                                                     formData.state_id
// // //                                                 }
// // //                                                 onChange={(value) =>
// // //                                                     setFormData(
// // //                                                         {
// // //                                                             ...formData,
// // //                                                             state_id:
// // //                                                                 value,
// // //                                                             district_id:
// // //                                                                 "",
// // //                                                             taluka_id:
// // //                                                                 "",
// // //                                                         }
// // //                                                     )
// // //                                                 }
// // //                                                 options={currentLocations}
// // //                                                 valueKey="state_id"
// // //                                                 labelKey="state_name"
// // //                                             />

// // //                                             <SelectField
// // //                                                 label="District"
// // //                                                 value={
// // //                                                     formData.district_id
// // //                                                 }
// // //                                                 onChange={(value) =>
// // //                                                     setFormData(
// // //                                                         {
// // //                                                             ...formData,
// // //                                                             district_id:
// // //                                                                 value,
// // //                                                             taluka_id:
// // //                                                                 "",
// // //                                                         }
// // //                                                     )
// // //                                                 }
// // //                                                 options={getDistrictsByState()}
// // //                                                 valueKey="district_id"
// // //                                                 labelKey="district_name"
// // //                                                 disabled={
// // //                                                     !formData.state_id
// // //                                                 }
// // //                                             />

// // //                                             <LocationTextField
// // //                                                 label="Taluka Code"
// // //                                                 placeholder="Example: HAV"
// // //                                                 value={
// // //                                                     formData.taluka_code
// // //                                                 }
// // //                                                 onChange={(value) =>
// // //                                                     handleFieldChange(
// // //                                                         "taluka_code",
// // //                                                         value
// // //                                                     )
// // //                                                 }
// // //                                             />

// // //                                             <LocationTextField
// // //                                                 label="Taluka Name"
// // //                                                 placeholder="Example: Haveli"
// // //                                                 value={
// // //                                                     formData.taluka_name
// // //                                                 }
// // //                                                 onChange={(value) =>
// // //                                                     handleFieldChange(
// // //                                                         "taluka_name",
// // //                                                         value
// // //                                                     )
// // //                                                 }
// // //                                             />
// // //                                         </>
// // //                                     )}

// // //                                     {/* CITY */}

// // //                                     {locationType ===
// // //                                         "city" && (
// // //                                         <>
// // //                                             <SelectField
// // //                                                 label="State"
// // //                                                 value={
// // //                                                     formData.state_id
// // //                                                 }
// // //                                                 onChange={(value) =>
// // //                                                     setFormData(
// // //                                                         {
// // //                                                             ...formData,
// // //                                                             state_id:
// // //                                                                 value,
// // //                                                             district_id:
// // //                                                                 "",
// // //                                                             taluka_id:
// // //                                                                 "",
// // //                                                             city_id:
// // //                                                                 "",
// // //                                                         }
// // //                                                     )
// // //                                                 }
// // //                                                 options={currentLocations}
// // //                                                 valueKey="state_id"
// // //                                                 labelKey="state_name"
// // //                                             />

// // //                                             <SelectField
// // //                                                 label="District"
// // //                                                 value={
// // //                                                     formData.district_id
// // //                                                 }
// // //                                                 onChange={(value) =>
// // //                                                     setFormData(
// // //                                                         {
// // //                                                             ...formData,
// // //                                                             district_id:
// // //                                                                 value,
// // //                                                             taluka_id:
// // //                                                                 "",
// // //                                                             city_id:
// // //                                                                 "",
// // //                                                         }
// // //                                                     )
// // //                                                 }
// // //                                                 options={getDistrictsByState()}
// // //                                                 valueKey="district_id"
// // //                                                 labelKey="district_name"
// // //                                                 disabled={
// // //                                                     !formData.state_id
// // //                                                 }
// // //                                             />

// // //                                             <SelectField
// // //                                                 label="Taluka"
// // //                                                 value={
// // //                                                     formData.taluka_id
// // //                                                 }
// // //                                                 onChange={(value) =>
// // //                                                     setFormData(
// // //                                                         {
// // //                                                             ...formData,
// // //                                                             taluka_id:
// // //                                                                 value,
// // //                                                             city_id:
// // //                                                                 "",
// // //                                                         }
// // //                                                     )
// // //                                                 }
// // //                                                 options={getTalukasByDistrict()}
// // //                                                 valueKey="taluka_id"
// // //                                                 labelKey="taluka_name"
// // //                                                 disabled={
// // //                                                     !formData.district_id
// // //                                                 }
// // //                                             />

// // //                                             <LocationTextField
// // //                                                 label="City Name"
// // //                                                 placeholder="Example: Pune"
// // //                                                 value={
// // //                                                     formData.city_name
// // //                                                 }
// // //                                                 onChange={(value) =>
// // //                                                     handleFieldChange(
// // //                                                         "city_name",
// // //                                                         value
// // //                                                     )
// // //                                                 }
// // //                                             />
// // //                                         </>
// // //                                     )}

// // //                                     {/* BRANCH */}

// // //                                     {locationType ===
// // //                                         "branch" && (
// // //                                         <>
// // //                                             <SelectField
// // //                                                 label="State"
// // //                                                 value={
// // //                                                     formData.state_id
// // //                                                 }
// // //                                                 onChange={(value) =>
// // //                                                     setFormData(
// // //                                                         {
// // //                                                             ...formData,
// // //                                                             state_id:
// // //                                                                 value,
// // //                                                             district_id:
// // //                                                                 "",
// // //                                                             taluka_id:
// // //                                                                 "",
// // //                                                             city_id:
// // //                                                                 "",
// // //                                                         }
// // //                                                     )
// // //                                                 }
// // //                                                 options={currentLocations}
// // //                                                 valueKey="state_id"
// // //                                                 labelKey="state_name"
// // //                                             />

// // //                                             <SelectField
// // //                                                 label="District"
// // //                                                 value={
// // //                                                     formData.district_id
// // //                                                 }
// // //                                                 onChange={(value) =>
// // //                                                     setFormData(
// // //                                                         {
// // //                                                             ...formData,
// // //                                                             district_id:
// // //                                                                 value,
// // //                                                             taluka_id:
// // //                                                                 "",
// // //                                                             city_id:
// // //                                                                 "",
// // //                                                         }
// // //                                                     )
// // //                                                 }
// // //                                                 options={getDistrictsByState()}
// // //                                                 valueKey="district_id"
// // //                                                 labelKey="district_name"
// // //                                                 disabled={
// // //                                                     !formData.state_id
// // //                                                 }
// // //                                             />

// // //                                             <SelectField
// // //                                                 label="Taluka"
// // //                                                 value={
// // //                                                     formData.taluka_id
// // //                                                 }
// // //                                                 onChange={(value) =>
// // //                                                     setFormData(
// // //                                                         {
// // //                                                             ...formData,
// // //                                                             taluka_id:
// // //                                                                 value,
// // //                                                             city_id:
// // //                                                                 "",
// // //                                                         }
// // //                                                     )
// // //                                                 }
// // //                                                 options={getTalukasByDistrict()}
// // //                                                 valueKey="taluka_id"
// // //                                                 labelKey="taluka_name"
// // //                                                 disabled={
// // //                                                     !formData.district_id
// // //                                                 }
// // //                                             />

// // //                                             <SelectField
// // //                                                 label="City"
// // //                                                 value={
// // //                                                     formData.city_id
// // //                                                 }
// // //                                                 onChange={(value) =>
// // //                                                     handleFieldChange(
// // //                                                         "city_id",
// // //                                                         value
// // //                                                     )
// // //                                                 }
// // //                                                 options={getCitiesByTaluka()}
// // //                                                 valueKey="city_id"
// // //                                                 labelKey="city_name"
// // //                                                 disabled={
// // //                                                     !formData.taluka_id
// // //                                                 }
// // //                                             />

// // //                                             <LocationTextField
// // //                                                 label="Branch Code"
// // //                                                 placeholder="Example: PUN-B01"
// // //                                                 value={
// // //                                                     formData.branch_code
// // //                                                 }
// // //                                                 onChange={(value) =>
// // //                                                     handleFieldChange(
// // //                                                         "branch_code",
// // //                                                         value
// // //                                                     )
// // //                                                 }
// // //                                             />

// // //                                             <LocationTextField
// // //                                                 label="Branch Name"
// // //                                                 placeholder="Example: Pune Branch 01"
// // //                                                 value={
// // //                                                     formData.branch_name
// // //                                                 }
// // //                                                 onChange={(value) =>
// // //                                                     handleFieldChange(
// // //                                                         "branch_name",
// // //                                                         value
// // //                                                     )
// // //                                                 }
// // //                                             />
// // //                                         </>
// // //                                     )}

// // //                                     {/* FLOOR */}

// // //                                     {locationType ===
// // //                                         "floor" && (
// // //                                         <>
// // //                                             <div className="form-group">
// // //                                                 <label>
// // //                                                     Branch
// // //                                                 </label>

// // //                                                 <select
// // //                                                     value={
// // //                                                         formData.branch_id
// // //                                                     }
// // //                                                     onChange={(event) =>
// // //                                                         handleFieldChange(
// // //                                                             "branch_id",
// // //                                                             event
// // //                                                                 .target
// // //                                                                 .value
// // //                                                         )
// // //                                                     }
// // //                                                     required
// // //                                                 >
// // //                                                     <option value="">
// // //                                                         Select Branch
// // //                                                     </option>

// // //                                                     {allBranches().map(
// // //                                                         (
// // //                                                             branch
// // //                                                         ) => (
// // //                                                             <option
// // //                                                                 key={
// // //                                                                     branch.branch_id
// // //                                                                 }
// // //                                                                 value={
// // //                                                                     branch.branch_id
// // //                                                                 }
// // //                                                             >
// // //                                                                 {
// // //                                                                     branch.branch_name
// // //                                                                 }
// // //                                                             </option>
// // //                                                         )
// // //                                                     )}
// // //                                                 </select>
// // //                                             </div>

// // //                                             <LocationTextField
// // //                                                 label="Floor Name"
// // //                                                 placeholder="Example: Floor-01"
// // //                                                 value={
// // //                                                     formData.floor_name
// // //                                                 }
// // //                                                 onChange={(value) =>
// // //                                                     handleFieldChange(
// // //                                                         "floor_name",
// // //                                                         value
// // //                                                     )
// // //                                                 }
// // //                                             />
// // //                                         </>
// // //                                     )}

// // //                                     {/* ROOM */}

// // //                                     {locationType ===
// // //                                         "room" && (
// // //                                         <>
// // //                                             <div className="form-group">
// // //                                                 <label>
// // //                                                     Floor
// // //                                                 </label>

// // //                                                 <select
// // //                                                     value={
// // //                                                         formData.floor_id
// // //                                                     }
// // //                                                     onChange={(event) =>
// // //                                                         handleFieldChange(
// // //                                                             "floor_id",
// // //                                                             event
// // //                                                                 .target
// // //                                                                 .value
// // //                                                         )
// // //                                                     }
// // //                                                     required
// // //                                                 >
// // //                                                     <option value="">
// // //                                                         Select Floor
// // //                                                     </option>

// // //                                                     {allFloors().map(
// // //                                                         (
// // //                                                             floor
// // //                                                         ) => (
// // //                                                             <option
// // //                                                                 key={
// // //                                                                     floor.floor_id
// // //                                                                 }
// // //                                                                 value={
// // //                                                                     floor.floor_id
// // //                                                                 }
// // //                                                             >
// // //                                                                 {
// // //                                                                     floor.floor_name
// // //                                                                 }
// // //                                                             </option>
// // //                                                         )
// // //                                                     )}
// // //                                                 </select>
// // //                                             </div>

// // //                                             <LocationTextField
// // //                                                 label="Room Name"
// // //                                                 placeholder="Example: Room-01"
// // //                                                 value={
// // //                                                     formData.room_name
// // //                                                 }
// // //                                                 onChange={(value) =>
// // //                                                     handleFieldChange(
// // //                                                         "room_name",
// // //                                                         value
// // //                                                     )
// // //                                                 }
// // //                                             />
// // //                                         </>
// // //                                     )}
// // //                                 </>
// // //                             )}

// // //                             {/* =================================================
// // //                                 ZONAL FORM
// // //                             ================================================= */}

// // //                             {hierarchyType ===
// // //                                 "ZONAL" && (
// // //                                 <>
// // //                                     {/* ZONE */}

// // //                                     {locationType ===
// // //                                         "zone" && (
// // //                                         <>
// // //                                             <LocationTextField
// // //                                                 label="Zone Code"
// // //                                                 placeholder="Example: WEST"
// // //                                                 value={
// // //                                                     formData.zone_code
// // //                                                 }
// // //                                                 onChange={(value) =>
// // //                                                     handleFieldChange(
// // //                                                         "zone_code",
// // //                                                         value
// // //                                                     )
// // //                                                 }
// // //                                             />

// // //                                             <LocationTextField
// // //                                                 label="Zone Name"
// // //                                                 placeholder="Example: West Zone"
// // //                                                 value={
// // //                                                     formData.zone_name
// // //                                                 }
// // //                                                 onChange={(value) =>
// // //                                                     handleFieldChange(
// // //                                                         "zone_name",
// // //                                                         value
// // //                                                     )
// // //                                                 }
// // //                                             />
// // //                                         </>
// // //                                     )}

// // //                                     {/* CIRCLE */}

// // //                                     {locationType ===
// // //                                         "circle" && (
// // //                                         <>
// // //                                             <SelectField
// // //                                                 label="Zone"
// // //                                                 value={
// // //                                                     formData.zone_id
// // //                                                 }
// // //                                                 onChange={(value) =>
// // //                                                     setFormData(
// // //                                                         {
// // //                                                             ...formData,
// // //                                                             zone_id:
// // //                                                                 value,
// // //                                                             circle_id:
// // //                                                                 "",
// // //                                                             region_id:
// // //                                                                 "",
// // //                                                             division_id:
// // //                                                                 "",
// // //                                                         }
// // //                                                     )
// // //                                                 }
// // //                                                 options={currentLocations}
// // //                                                 valueKey="zone_id"
// // //                                                 labelKey="zone_name"
// // //                                             />

// // //                                             <LocationTextField
// // //                                                 label="Circle Code"
// // //                                                 placeholder="Example: MH-C01"
// // //                                                 value={
// // //                                                     formData.circle_code
// // //                                                 }
// // //                                                 onChange={(value) =>
// // //                                                     handleFieldChange(
// // //                                                         "circle_code",
// // //                                                         value
// // //                                                     )
// // //                                                 }
// // //                                             />

// // //                                             <LocationTextField
// // //                                                 label="Circle Name"
// // //                                                 placeholder="Example: Maharashtra Circle"
// // //                                                 value={
// // //                                                     formData.circle_name
// // //                                                 }
// // //                                                 onChange={(value) =>
// // //                                                     handleFieldChange(
// // //                                                         "circle_name",
// // //                                                         value
// // //                                                     )
// // //                                                 }
// // //                                             />
// // //                                         </>
// // //                                     )}

// // //                                     {/* REGION */}

// // //                                     {locationType ===
// // //                                         "region" && (
// // //                                         <>
// // //                                             <SelectField
// // //                                                 label="Zone"
// // //                                                 value={
// // //                                                     formData.zone_id
// // //                                                 }
// // //                                                 onChange={(value) =>
// // //                                                     setFormData(
// // //                                                         {
// // //                                                             ...formData,
// // //                                                             zone_id:
// // //                                                                 value,
// // //                                                             circle_id:
// // //                                                                 "",
// // //                                                             region_id:
// // //                                                                 "",
// // //                                                         }
// // //                                                     )
// // //                                                 }
// // //                                                 options={currentLocations}
// // //                                                 valueKey="zone_id"
// // //                                                 labelKey="zone_name"
// // //                                             />

// // //                                             <SelectField
// // //                                                 label="Circle"
// // //                                                 value={
// // //                                                     formData.circle_id
// // //                                                 }
// // //                                                 onChange={(value) =>
// // //                                                     setFormData(
// // //                                                         {
// // //                                                             ...formData,
// // //                                                             circle_id:
// // //                                                                 value,
// // //                                                             region_id:
// // //                                                                 "",
// // //                                                         }
// // //                                                     )
// // //                                                 }
// // //                                                 options={getCirclesByZone()}
// // //                                                 valueKey="circle_id"
// // //                                                 labelKey="circle_name"
// // //                                                 disabled={
// // //                                                     !formData.zone_id
// // //                                                 }
// // //                                             />

// // //                                             <LocationTextField
// // //                                                 label="Region Code"
// // //                                                 placeholder="Example: PUN-R01"
// // //                                                 value={
// // //                                                     formData.region_code
// // //                                                 }
// // //                                                 onChange={(value) =>
// // //                                                     handleFieldChange(
// // //                                                         "region_code",
// // //                                                         value
// // //                                                     )
// // //                                                 }
// // //                                             />

// // //                                             <LocationTextField
// // //                                                 label="Region Name"
// // //                                                 placeholder="Example: Pune Region"
// // //                                                 value={
// // //                                                     formData.region_name
// // //                                                 }
// // //                                                 onChange={(value) =>
// // //                                                     handleFieldChange(
// // //                                                         "region_name",
// // //                                                         value
// // //                                                     )
// // //                                                 }
// // //                                             />
// // //                                         </>
// // //                                     )}

// // //                                     {/* DIVISION */}

// // //                                     {locationType ===
// // //                                         "division" && (
// // //                                         <>
// // //                                             <SelectField
// // //                                                 label="Zone"
// // //                                                 value={
// // //                                                     formData.zone_id
// // //                                                 }
// // //                                                 onChange={(value) =>
// // //                                                     setFormData(
// // //                                                         {
// // //                                                             ...formData,
// // //                                                             zone_id:
// // //                                                                 value,
// // //                                                             circle_id:
// // //                                                                 "",
// // //                                                             region_id:
// // //                                                                 "",
// // //                                                             division_id:
// // //                                                                 "",
// // //                                                         }
// // //                                                     )
// // //                                                 }
// // //                                                 options={currentLocations}
// // //                                                 valueKey="zone_id"
// // //                                                 labelKey="zone_name"
// // //                                             />

// // //                                             <SelectField
// // //                                                 label="Circle"
// // //                                                 value={
// // //                                                     formData.circle_id
// // //                                                 }
// // //                                                 onChange={(value) =>
// // //                                                     setFormData(
// // //                                                         {
// // //                                                             ...formData,
// // //                                                             circle_id:
// // //                                                                 value,
// // //                                                             region_id:
// // //                                                                 "",
// // //                                                             division_id:
// // //                                                                 "",
// // //                                                         }
// // //                                                     )
// // //                                                 }
// // //                                                 options={getCirclesByZone()}
// // //                                                 valueKey="circle_id"
// // //                                                 labelKey="circle_name"
// // //                                                 disabled={
// // //                                                     !formData.zone_id
// // //                                                 }
// // //                                             />

// // //                                             <SelectField
// // //                                                 label="Region"
// // //                                                 value={
// // //                                                     formData.region_id
// // //                                                 }
// // //                                                 onChange={(value) =>
// // //                                                     handleFieldChange(
// // //                                                         "region_id",
// // //                                                         value
// // //                                                     )
// // //                                                 }
// // //                                                 options={getRegionsByCircle()}
// // //                                                 valueKey="region_id"
// // //                                                 labelKey="region_name"
// // //                                                 disabled={
// // //                                                     !formData.circle_id
// // //                                                 }
// // //                                             />

// // //                                             <LocationTextField
// // //                                                 label="Division Code"
// // //                                                 placeholder="Example: PUN-D01"
// // //                                                 value={
// // //                                                     formData.division_code
// // //                                                 }
// // //                                                 onChange={(value) =>
// // //                                                     handleFieldChange(
// // //                                                         "division_code",
// // //                                                         value
// // //                                                     )
// // //                                                 }
// // //                                             />

// // //                                             <LocationTextField
// // //                                                 label="Division Name"
// // //                                                 placeholder="Example: Pune Division"
// // //                                                 value={
// // //                                                     formData.division_name
// // //                                                 }
// // //                                                 onChange={(value) =>
// // //                                                     handleFieldChange(
// // //                                                         "division_name",
// // //                                                         value
// // //                                                     )
// // //                                                 }
// // //                                             />
// // //                                         </>
// // //                                     )}

// // //                                     {/* BRANCH */}

// // //                                     {locationType ===
// // //                                         "branch" && (
// // //                                         <>
// // //                                             <SelectField
// // //                                                 label="Zone"
// // //                                                 value={
// // //                                                     formData.zone_id
// // //                                                 }
// // //                                                 onChange={(value) =>
// // //                                                     setFormData(
// // //                                                         {
// // //                                                             ...formData,
// // //                                                             zone_id:
// // //                                                                 value,
// // //                                                             circle_id:
// // //                                                                 "",
// // //                                                             region_id:
// // //                                                                 "",
// // //                                                             division_id:
// // //                                                                 "",
// // //                                                         }
// // //                                                     )
// // //                                                 }
// // //                                                 options={currentLocations}
// // //                                                 valueKey="zone_id"
// // //                                                 labelKey="zone_name"
// // //                                             />

// // //                                             <SelectField
// // //                                                 label="Circle"
// // //                                                 value={
// // //                                                     formData.circle_id
// // //                                                 }
// // //                                                 onChange={(value) =>
// // //                                                     setFormData(
// // //                                                         {
// // //                                                             ...formData,
// // //                                                             circle_id:
// // //                                                                 value,
// // //                                                             region_id:
// // //                                                                 "",
// // //                                                             division_id:
// // //                                                                 "",
// // //                                                         }
// // //                                                     )
// // //                                                 }
// // //                                                 options={getCirclesByZone()}
// // //                                                 valueKey="circle_id"
// // //                                                 labelKey="circle_name"
// // //                                                 disabled={
// // //                                                     !formData.zone_id
// // //                                                 }
// // //                                             />

// // //                                             <SelectField
// // //                                                 label="Region"
// // //                                                 value={
// // //                                                     formData.region_id
// // //                                                 }
// // //                                                 onChange={(value) =>
// // //                                                     setFormData(
// // //                                                         {
// // //                                                             ...formData,
// // //                                                             region_id:
// // //                                                                 value,
// // //                                                             division_id:
// // //                                                                 "",
// // //                                                         }
// // //                                                     )
// // //                                                 }
// // //                                                 options={getRegionsByCircle()}
// // //                                                 valueKey="region_id"
// // //                                                 labelKey="region_name"
// // //                                                 disabled={
// // //                                                     !formData.circle_id
// // //                                                 }
// // //                                             />

// // //                                             <SelectField
// // //                                                 label="Division"
// // //                                                 value={
// // //                                                     formData.division_id
// // //                                                 }
// // //                                                 onChange={(value) =>
// // //                                                     handleFieldChange(
// // //                                                         "division_id",
// // //                                                         value
// // //                                                     )
// // //                                                 }
// // //                                                 options={getDivisionsByRegion()}
// // //                                                 valueKey="division_id"
// // //                                                 labelKey="division_name"
// // //                                                 disabled={
// // //                                                     !formData.region_id
// // //                                                 }
// // //                                             />

// // //                                             <LocationTextField
// // //                                                 label="Branch Code"
// // //                                                 placeholder="Example: PUN-B01"
// // //                                                 value={
// // //                                                     formData.branch_code
// // //                                                 }
// // //                                                 onChange={(value) =>
// // //                                                     handleFieldChange(
// // //                                                         "branch_code",
// // //                                                         value
// // //                                                     )
// // //                                                 }
// // //                                             />

// // //                                             <LocationTextField
// // //                                                 label="Branch Name"
// // //                                                 placeholder="Example: Pune Branch 01"
// // //                                                 value={
// // //                                                     formData.branch_name
// // //                                                 }
// // //                                                 onChange={(value) =>
// // //                                                     handleFieldChange(
// // //                                                         "branch_name",
// // //                                                         value
// // //                                                     )
// // //                                                 }
// // //                                             />
// // //                                         </>
// // //                                     )}

// // //                                     {/* FLOOR */}

// // //                                     {locationType ===
// // //                                         "floor" && (
// // //                                         <>
// // //                                             <div className="form-group">
// // //                                                 <label>
// // //                                                     Branch
// // //                                                 </label>

// // //                                                 <select
// // //                                                     value={
// // //                                                         formData.branch_id
// // //                                                     }
// // //                                                     onChange={(event) =>
// // //                                                         handleFieldChange(
// // //                                                             "branch_id",
// // //                                                             event
// // //                                                                 .target
// // //                                                                 .value
// // //                                                         )
// // //                                                     }
// // //                                                     required
// // //                                                 >
// // //                                                     <option value="">
// // //                                                         Select Branch
// // //                                                     </option>

// // //                                                     {allBranches().map(
// // //                                                         (
// // //                                                             branch
// // //                                                         ) => (
// // //                                                             <option
// // //                                                                 key={
// // //                                                                     branch.branch_id
// // //                                                                 }
// // //                                                                 value={
// // //                                                                     branch.branch_id
// // //                                                                 }
// // //                                                             >
// // //                                                                 {
// // //                                                                     branch.branch_name
// // //                                                                 }
// // //                                                             </option>
// // //                                                         )
// // //                                                     )}
// // //                                                 </select>
// // //                                             </div>

// // //                                             <LocationTextField
// // //                                                 label="Floor Name"
// // //                                                 placeholder="Example: Floor-01"
// // //                                                 value={
// // //                                                     formData.floor_name
// // //                                                 }
// // //                                                 onChange={(value) =>
// // //                                                     handleFieldChange(
// // //                                                         "floor_name",
// // //                                                         value
// // //                                                     )
// // //                                                 }
// // //                                             />
// // //                                         </>
// // //                                     )}

// // //                                     {/* ROOM */}

// // //                                     {locationType ===
// // //                                         "room" && (
// // //                                         <>
// // //                                             <div className="form-group">
// // //                                                 <label>
// // //                                                     Floor
// // //                                                 </label>

// // //                                                 <select
// // //                                                     value={
// // //                                                         formData.floor_id
// // //                                                     }
// // //                                                     onChange={(event) =>
// // //                                                         handleFieldChange(
// // //                                                             "floor_id",
// // //                                                             event
// // //                                                                 .target
// // //                                                                 .value
// // //                                                         )
// // //                                                     }
// // //                                                     required
// // //                                                 >
// // //                                                     <option value="">
// // //                                                         Select Floor
// // //                                                     </option>

// // //                                                     {allFloors().map(
// // //                                                         (
// // //                                                             floor
// // //                                                         ) => (
// // //                                                             <option
// // //                                                                 key={
// // //                                                                     floor.floor_id
// // //                                                                 }
// // //                                                                 value={
// // //                                                                     floor.floor_id
// // //                                                                 }
// // //                                                             >
// // //                                                                 {
// // //                                                                     floor.floor_name
// // //                                                                 }
// // //                                                             </option>
// // //                                                         )
// // //                                                     )}
// // //                                                 </select>
// // //                                             </div>

// // //                                             <LocationTextField
// // //                                                 label="Room Name"
// // //                                                 placeholder="Example: Room-01"
// // //                                                 value={
// // //                                                     formData.room_name
// // //                                                 }
// // //                                                 onChange={(value) =>
// // //                                                     handleFieldChange(
// // //                                                         "room_name",
// // //                                                         value
// // //                                                     )
// // //                                                 }
// // //                                             />
// // //                                         </>
// // //                                     )}
// // //                                 </>
// // //                             )}

// // //                             {/* ERROR */}

// // //                             {saveError && (
// // //                                 <div className="location-error">
// // //                                     {saveError}
// // //                                 </div>
// // //                             )}

// // //                             {/* ACTIONS */}

// // //                             <div className="modal-actions">
// // //                                 <button
// // //                                     type="button"
// // //                                     className="cancel-btn"
// // //                                     onClick={
// // //                                         closeAddLocation
// // //                                     }
// // //                                     disabled={
// // //                                         saving
// // //                                     }
// // //                                 >
// // //                                     Cancel
// // //                                 </button>

// // //                                 <button
// // //                                     type="submit"
// // //                                     className="save-btn"
// // //                                     disabled={
// // //                                         saving
// // //                                     }
// // //                                 >
// // //                                     {saving
// // //                                         ? "Saving..."
// // //                                         : "Add Location"}
// // //                                 </button>
// // //                             </div>
// // //                         </form>
// // //                     </div>
// // //                 </div>
// // //             )}
// // //         </div>
// // //     );
// // // };

// // // /* =========================================================
// // //    REUSABLE FORM COMPONENTS
// // // ========================================================= */

// // // const LocationTextField = ({
// // //     label,
// // //     placeholder,
// // //     value,
// // //     onChange,
// // // }) => (
// // //     <div className="form-group">
// // //         <label>{label}</label>

// // //         <input
// // //             type="text"
// // //             placeholder={placeholder}
// // //             value={value}
// // //             onChange={(event) =>
// // //                 onChange(event.target.value)
// // //             }
// // //             required
// // //         />
// // //     </div>
// // // );

// // // const SelectField = ({
// // //     label,
// // //     value,
// // //     onChange,
// // //     options = [],
// // //     valueKey,
// // //     labelKey,
// // //     disabled = false,
// // // }) => (
// // //     <div className="form-group">
// // //         <label>{label}</label>

// // //         <select
// // //             value={value}
// // //             onChange={(event) =>
// // //                 onChange(event.target.value)
// // //             }
// // //             disabled={disabled}
// // //             required
// // //         >
// // //             <option value="">
// // //                 Select {label}
// // //             </option>

// // //             {options.map((item, index) => (
// // //                 <option
// // //                     key={
// // //                         item[valueKey] ||
// // //                         index
// // //                     }
// // //                     value={
// // //                         item[valueKey]
// // //                     }
// // //                 >
// // //                     {item[labelKey]}
// // //                 </option>
// // //             ))}
// // //         </select>
// // //     </div>
// // // );

// // // /* =========================================================
// // //    BRANCH TREE
// // // ========================================================= */

// // // const BranchTree = ({
// // //     branch,
// // //     expanded,
// // //     toggleNode,
// // // }) => {
// // //     const branchKey =
// // //         `branch-${branch.branch_id}`;

// // //     const branchExpanded =
// // //         expanded[branchKey];

// // //     const floorCount =
// // //         branch.floors?.length || 0;

// // //     const directACCount =
// // //         branch.ac_devices?.length || 0;

// // //     return (
// // //         <div>

// // //             {/* BRANCH */}

// // //             <div
// // //                 className="tree-row branch-row"
// // //                 onClick={() =>
// // //                     toggleNode(branchKey)
// // //                 }
// // //             >
// // //                 <button className="expand-btn">
// // //                     {branchExpanded
// // //                         ? "−"
// // //                         : "+"}
// // //                 </button>

// // //                 <div className="location-symbol branch-symbol">
// // //                     B
// // //                 </div>

// // //                 <div className="location-info">
// // //                     <strong>
// // //                         {
// // //                             branch.branch_name
// // //                         }
// // //                     </strong>

// // //                     <span>
// // //                         {
// // //                             branch.branch_id
// // //                         }
// // //                     </span>
// // //                 </div>

// // //                 <div className="location-count">
// // //                     {floorCount} Floors
// // //                     {directACCount > 0 &&
// // //                         ` • ${directACCount} Direct ACs`}
// // //                 </div>
// // //             </div>

// // //             {/* BRANCH CONTENT */}

// // //             {branchExpanded && (
// // //                 <div className="nested-level">

// // //                     {/* DIRECT ACs */}

// // //                     {branch.ac_devices
// // //                         ?.length > 0 && (
// // //                         <div className="ac-list">
// // //                             {branch.ac_devices.map(
// // //                                 (
// // //                                     ac,
// // //                                     index
// // //                                 ) => (
// // //                                     <div
// // //                                         className="ac-item"
// // //                                         key={
// // //                                             ac.ac_id ||
// // //                                             index
// // //                                         }
// // //                                     >
// // //                                         <div className="ac-dot"></div>

// // //                                         <div className="ac-info">
// // //                                             <strong>
// // //                                                 {
// // //                                                     ac.ac_id
// // //                                                 }
// // //                                             </strong>

// // //                                             <span>
// // //                                                 {
// // //                                                     ac.device_name
// // //                                                 }
// // //                                             </span>
// // //                                         </div>

// // //                                         <span
// // //                                             className={
// // //                                                 ac.status ===
// // //                                                 "ON"
// // //                                                     ? "ac-status on"
// // //                                                     : "ac-status off"
// // //                                             }
// // //                                         >
// // //                                             {
// // //                                                 ac.status
// // //                                             }
// // //                                         </span>
// // //                                     </div>
// // //                                 )
// // //                             )}
// // //                         </div>
// // //                     )}

// // //                     {/* FLOORS */}

// // //                     {branch.floors?.map(
// // //                         (
// // //                             floor,
// // //                             floorIndex
// // //                         ) => {
// // //                             const floorKey =
// // //                                 `floor-${floor.floor_id || floorIndex}`;

// // //                             const floorExpanded =
// // //                                 expanded[
// // //                                     floorKey
// // //                                 ];

// // //                             return (
// // //                                 <div
// // //                                     key={
// // //                                         floorKey
// // //                                     }
// // //                                 >
// // //                                     <div
// // //                                         className="tree-row floor-row"
// // //                                         onClick={() =>
// // //                                             toggleNode(
// // //                                                 floorKey
// // //                                             )
// // //                                         }
// // //                                     >
// // //                                         <button className="expand-btn">
// // //                                             {floorExpanded
// // //                                                 ? "−"
// // //                                                 : "+"}
// // //                                         </button>

// // //                                         <div className="location-symbol floor-symbol">
// // //                                             F
// // //                                         </div>

// // //                                         <div className="location-info">
// // //                                             <strong>
// // //                                                 {
// // //                                                     floor.floor_name
// // //                                                 }
// // //                                             </strong>

// // //                                             <span>
// // //                                                 {
// // //                                                     floor.floor_id
// // //                                                 }
// // //                                             </span>
// // //                                         </div>

// // //                                         <div className="location-count">
// // //                                             {
// // //                                                 floor.rooms
// // //                                                     ?.length ||
// // //                                                 0
// // //                                             }{" "}
// // //                                             Rooms
// // //                                         </div>
// // //                                     </div>

// // //                                     {/* ROOMS */}

// // //                                     {floorExpanded && (
// // //                                         <div className="nested-level">
// // //                                             {floor.rooms?.map(
// // //                                                 (
// // //                                                     room,
// // //                                                     roomIndex
// // //                                                 ) => {
// // //                                                     const roomKey =
// // //                                                         `room-${room.room_id || roomIndex}`;

// // //                                                     const roomExpanded =
// // //                                                         expanded[
// // //                                                             roomKey
// // //                                                         ];

// // //                                                     return (
// // //                                                         <div
// // //                                                             key={
// // //                                                                 roomKey
// // //                                                             }
// // //                                                         >
// // //                                                             <div
// // //                                                                 className="tree-row room-row"
// // //                                                                 onClick={() =>
// // //                                                                     toggleNode(
// // //                                                                         roomKey
// // //                                                                     )
// // //                                                                 }
// // //                                                             >
// // //                                                                 <button className="expand-btn">
// // //                                                                     {roomExpanded
// // //                                                                         ? "−"
// // //                                                                         : "+"}
// // //                                                                 </button>

// // //                                                                 <div className="location-symbol room-symbol">
// // //                                                                     R
// // //                                                                 </div>

// // //                                                                 <div className="location-info">
// // //                                                                     <strong>
// // //                                                                         {
// // //                                                                             room.room_name
// // //                                                                         }
// // //                                                                     </strong>

// // //                                                                     <span>
// // //                                                                         {
// // //                                                                             room.room_id
// // //                                                                         }
// // //                                                                     </span>
// // //                                                                 </div>

// // //                                                                 <div className="location-count">
// // //                                                                     {
// // //                                                                         room
// // //                                                                             .ac_devices
// // //                                                                             ?.length ||
// // //                                                                         0
// // //                                                                     }{" "}
// // //                                                                     ACs
// // //                                                                 </div>
// // //                                                             </div>

// // //                                                             {/* ACs */}

// // //                                                             {roomExpanded &&
// // //                                                                 room.ac_devices
// // //                                                                     ?.length >
// // //                                                                     0 && (
// // //                                                                     <div className="ac-list">
// // //                                                                         {room.ac_devices.map(
// // //                                                                             (
// // //                                                                                 ac,
// // //                                                                                 acIndex
// // //                                                                             ) => (
// // //                                                                                 <div
// // //                                                                                     className="ac-item"
// // //                                                                                     key={
// // //                                                                                         ac.ac_id ||
// // //                                                                                         acIndex
// // //                                                                                     }
// // //                                                                                 >
// // //                                                                                     <div className="ac-dot"></div>

// // //                                                                                     <div className="ac-info">
// // //                                                                                         <strong>
// // //                                                                                             {
// // //                                                                                                 ac.ac_id
// // //                                                                                             }
// // //                                                                                         </strong>

// // //                                                                                         <span>
// // //                                                                                             {
// // //                                                                                                 ac.device_name
// // //                                                                                             }
// // //                                                                                         </span>
// // //                                                                                     </div>

// // //                                                                                     <span
// // //                                                                                         className={
// // //                                                                                             ac.status ===
// // //                                                                                             "ON"
// // //                                                                                                 ? "ac-status on"
// // //                                                                                                 : "ac-status off"
// // //                                                                                         }
// // //                                                                                     >
// // //                                                                                         {
// // //                                                                                             ac.status
// // //                                                                                         }
// // //                                                                                     </span>
// // //                                                                                 </div>
// // //                                                                             )
// // //                                                                         )}
// // //                                                                     </div>
// // //                                                                 )}
// // //                                                         </div>
// // //                                                     );
// // //                                                 }
// // //                                             )}
// // //                                         </div>
// // //                                     )}
// // //                                 </div>
// // //                             );
// // //                         })}
// // //                 </div>
// // //             )}
// // //         </div>
// // //     );
// // // };

// // // export default Locations;


// // import React, { useContext, useEffect, useMemo, useState } from "react";
// // import "./Locations.css";
// // import { useAuth } from "../Layout/AuthContext";
// // import SiteOwnerModal, { SiteActionsContext, authHeaders } from "./SiteOwnerModal";

// // const API_URL = "http://localhost:8000/api/v1/filters/locations/";

// // const EMPTY_FORM = {
// //     zone_id: "", zone_name: "", zone_code: "",
// //     state_id: "", state_name: "", state_code: "",
// //     district_id: "", district_name: "", district_code: "",
// //     taluka_id: "", taluka_name: "", taluka_code: "",
// //     circle_id: "", circle_name: "", circle_code: "",
// //     region_id: "", region_name: "", region_code: "",
// //     division_id: "", division_name: "", division_code: "",
// //     city_id: "", city_name: "", city_code: "",
// //     branch_id: "", branch_name: "", branch_code: "",
// //     floor_id: "", floor_name: "",
// //     room_id: "", room_name: "",
// // };

// // const count = (arr) => arr?.length || 0;

// // const Locations = () => {
// //     const { user } = useAuth();
// //     const canAssign = user?.role === "ORG_SUPER_ADMIN" || user?.role === "CUSTOMER";
// //     const [assignTarget, setAssignTarget] = useState(null);

// //     const [locations, setLocations] = useState({ GEOGRAPHICAL: [], ZONAL: [] });
// //     const [hierarchyType, setHierarchyType] = useState("GEOGRAPHICAL");
// //     const [loading, setLoading] = useState(true);
// //     const [error, setError] = useState("");
// //     const [expanded, setExpanded] = useState({});

// //     const [showModal, setShowModal] = useState(false);
// //     const [locationType, setLocationType] = useState("");
// //     const [saving, setSaving] = useState(false);
// //     const [saveError, setSaveError] = useState("");
// //     const [formData, setFormData] = useState(EMPTY_FORM);

// //     // --- Quick branch search ---
// //     const [branchSearch, setBranchSearch] = useState("");
// //     const [showBranchResults, setShowBranchResults] = useState(false);

// //     const currentLocations = locations[hierarchyType] || [];
// //     const isGeo = hierarchyType === "GEOGRAPHICAL";

// //     const fetchLocations = async () => {
// //         try {
// //             setLoading(true);
// //             setError("");

// //             const response = await fetch(API_URL, {
// //                 method: "GET",
// //                 headers: authHeaders(),
// //                 cache: "no-store",
// //             });

// //             if (!response.ok) throw new Error(`HTTP Error ${response.status}`);

// //             const result = await response.json();
// //             console.log("LOCATIONS API RESPONSE:", result);

// //             if (result.success !== true) throw new Error("Location API returned success=false");

// //             setLocations({
// //                 GEOGRAPHICAL: Array.isArray(result.geographical?.data) ? result.geographical.data : [],
// //                 ZONAL: Array.isArray(result.zonal?.data) ? result.zonal.data : [],
// //             });
// //         } catch (err) {
// //             console.error("Location API Error:", err);
// //             setError(err.message || "Unable to load locations");
// //         } finally {
// //             setLoading(false);
// //         }
// //     };

// //     useEffect(() => { fetchLocations(); }, []);

// //     const changeHierarchy = (type) => {
// //         setHierarchyType(type);
// //         setExpanded({});
// //         setShowModal(false);
// //         setSaveError("");
// //     };

// //     const toggleNode = (id) =>
// //         setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));


// //     const getDistrictCount = (state) => count(state.districts);
// //     const getTalukaCount = (district) => count(district.talukas);
// //     const getCityCount = (item) => count(item.cities);
// //     const getBranchCount = (item) => count(item.branches);
// //     const getCircleCount = (zone) => count(zone.circles);
// //     const getRegionCount = (circle) => count(circle.regions);
// //     const getDivisionCount = (region) => count(region.divisions);
// //     const getFloorCount = (branch) => count(branch.floors);
// //     const getRoomCount = (floor) => count(floor.rooms);
// //     const getACCount = (room) => count(room.ac_devices);

// //     const getTotalACs = () => {
// //         let total = 0;

// //         const walkBranches = (branch) => {
// //             total += count(branch.ac_devices);
// //             (branch.floors || []).forEach((floor) =>
// //                 (floor.rooms || []).forEach((room) => { total += count(room.ac_devices); })
// //             );
// //         };

// //         if (isGeo) {
// //             currentLocations.forEach((state) =>
// //                 (state.districts || []).forEach((district) =>
// //                     (district.talukas || []).forEach((taluka) =>
// //                         (taluka.cities || []).forEach((city) =>
// //                             (city.branches || []).forEach(walkBranches)
// //                         )
// //                     )
// //                 )
// //             );
// //         } else {
// //             currentLocations.forEach((zone) =>
// //                 (zone.circles || []).forEach((circle) =>
// //                     (circle.regions || []).forEach((region) =>
// //                         (region.divisions || []).forEach((division) =>
// //                             (division.branches || []).forEach(walkBranches)
// //                         )
// //                     )
// //                 )
// //             );
// //         }

// //         return total;
// //     };

// //     const getTotalStates = () =>
// //         isGeo ? currentLocations.length
// //               : currentLocations.reduce((t, z) => t + count(z.states), 0);

// //     const getTotalDistricts = () =>
// //         isGeo ? currentLocations.reduce((t, s) => t + count(s.districts), 0) : 0;

// //     const getTotalZones = () => (isGeo ? 0 : currentLocations.length);

// //     const getTotalCircles = () =>
// //         isGeo ? 0 : currentLocations.reduce((t, z) => t + count(z.circles), 0);

// //     const getTotalBranches = () => {
// //         let total = 0;
// //         if (isGeo) {
// //             currentLocations.forEach((state) =>
// //                 (state.districts || []).forEach((d) =>
// //                     (d.talukas || []).forEach((t) =>
// //                         (t.cities || []).forEach((c) => { total += count(c.branches); })
// //                     )
// //                 )
// //             );
// //         } else {
// //             currentLocations.forEach((zone) =>
// //                 (zone.circles || []).forEach((c) =>
// //                     (c.regions || []).forEach((r) =>
// //                         (r.divisions || []).forEach((d) => { total += count(d.branches); })
// //                     )
// //                 )
// //             );
// //         }
// //         return total;
// //     };

// //     /* =========================================================
// //        FLAT HELPERS
// //     ========================================================= */

// //     const allBranches = () => {
// //         if (isGeo) {
// //             return currentLocations
// //                 .flatMap((s) => s.districts || [])
// //                 .flatMap((d) => d.talukas || [])
// //                 .flatMap((t) => t.cities || [])
// //                 .flatMap((c) => c.branches || []);
// //         }
// //         return currentLocations
// //             .flatMap((z) => z.circles || [])
// //             .flatMap((c) => c.regions || [])
// //             .flatMap((r) => r.divisions || [])
// //             .flatMap((d) => d.branches || []);
// //     };

// //     const allFloors = () => allBranches().flatMap((b) => b.floors || []);

// //     // Flat list of branches WITH their parent path — used by the search bar.
// //     const branchIndex = useMemo(() => {
// //         const list = [];
// //         if (isGeo) {
// //             currentLocations.forEach((state) =>
// //                 (state.districts || []).forEach((district) =>
// //                     (district.talukas || []).forEach((taluka) =>
// //                         (taluka.cities || []).forEach((city) =>
// //                             (city.branches || []).forEach((branch) =>
// //                                 list.push({
// //                                     branch,
// //                                     path: [state.state_name, district.district_name, taluka.taluka_name, city.city_name]
// //                                         .filter(Boolean).join(" › "),
// //                                 })
// //                             )
// //                         )
// //                     )
// //                 )
// //             );
// //         } else {
// //             currentLocations.forEach((zone) =>
// //                 (zone.circles || []).forEach((circle) =>
// //                     (circle.regions || []).forEach((region) =>
// //                         (region.divisions || []).forEach((division) =>
// //                             (division.branches || []).forEach((branch) =>
// //                                 list.push({
// //                                     branch,
// //                                     path: [zone.zone_name, circle.circle_name, region.region_name, division.division_name]
// //                                         .filter(Boolean).join(" › "),
// //                                 })
// //                             )
// //                         )
// //                     )
// //                 )
// //             );
// //         }
// //         return list;
// //     }, [currentLocations, isGeo]);

// //     const filteredBranches = useMemo(() => {
// //         const q = branchSearch.trim().toLowerCase();
// //         if (!q) return [];
// //         return branchIndex
// //             .filter(({ branch, path }) =>
// //                 [branch.branch_name, branch.branch_code, branch.branch_id, path]
// //                     .filter(Boolean)
// //                     .some((value) => String(value).toLowerCase().includes(q))
// //             )
// //             .slice(0, 8);
// //     }, [branchSearch, branchIndex]);

// //     /* =========================================================
// //        FORM HELPERS
// //     ========================================================= */

// //     const resetForm = () => {
// //         setFormData(EMPTY_FORM);
// //         setLocationType("");
// //         setSaveError("");
// //         setBranchSearch("");
// //         setShowBranchResults(false);
// //     };

// //     const openAddLocation = () => {
// //         resetForm();
// //         setLocationType(isGeo ? "state" : "zone");
// //         setShowModal(true);
// //     };

// //     const closeAddLocation = () => {
// //         if (saving) return;
// //         setShowModal(false);
// //         resetForm();
// //     };

// //     const handleFieldChange = (field, value) =>
// //         setFormData((prev) => ({ ...prev, [field]: value }));

// //     // Click a branch result → fill the branch and jump to a type that uses it.
// //     const selectBranchFromSearch = (branch) => {
// //         const nextType = ["floor", "room"].includes(locationType) ? locationType : "floor";
// //         setLocationType(nextType);
// //         setFormData((prev) => ({
// //             ...prev,
// //             branch_id: branch.branch_id,
// //             branch_name: branch.branch_name,
// //             branch_code: branch.branch_code || "",
// //         }));
// //         setBranchSearch("");
// //         setShowBranchResults(false);
// //     };

// //     /* =========================================================
// //        LOOKUPS
// //     ========================================================= */

// //     const getDistrictsByState = () =>
// //         currentLocations.find((s) => s.state_id === formData.state_id)?.districts || [];

// //     const getTalukasByDistrict = () => {
// //         for (const state of currentLocations) {
// //             const district = state.districts?.find((d) => d.district_id === formData.district_id);
// //             if (district) return district.talukas || [];
// //         }
// //         return [];
// //     };

// //     const getCitiesByTaluka = () => {
// //         for (const state of currentLocations) {
// //             for (const district of state.districts || []) {
// //                 const taluka = district.talukas?.find((t) => t.taluka_id === formData.taluka_id);
// //                 if (taluka) return taluka.cities || [];
// //             }
// //         }
// //         return [];
// //     };

// //     const getStatesByZone = () =>
// //         currentLocations.find((z) => z.zone_id === formData.zone_id)?.states || [];

// //     const getCirclesByZone = () =>
// //         currentLocations.find((z) => z.zone_id === formData.zone_id)?.circles || [];

// //     const getRegionsByCircle = () => {
// //         for (const zone of currentLocations) {
// //             const circle = zone.circles?.find((c) => c.circle_id === formData.circle_id);
// //             if (circle) return circle.regions || [];
// //         }
// //         return [];
// //     };

// //     const getDivisionsByRegion = () => {
// //         for (const zone of currentLocations) {
// //             for (const circle of zone.circles || []) {
// //                 const region = circle.regions?.find((r) => r.region_id === formData.region_id);
// //                 if (region) return region.divisions || [];
// //             }
// //         }
// //         return [];
// //     };

// //     /* =========================================================
// //        LOCATION TYPE OPTIONS
// //     ========================================================= */

// //     const locationTypeOptions = isGeo
// //         ? [
// //               { value: "state", label: "State" },
// //               { value: "district", label: "District" },
// //               { value: "taluka", label: "Taluka" },
// //               { value: "city", label: "City" },
// //               { value: "branch", label: "Branch" },
// //               { value: "floor", label: "Floor" },
// //               { value: "room", label: "Room" },
// //           ]
// //         : [
// //               { value: "zone", label: "Zone" },
// //               { value: "circle", label: "Circle" },
// //               { value: "region", label: "Region" },
// //               { value: "division", label: "Division" },
// //               { value: "branch", label: "Branch" },
// //               { value: "floor", label: "Floor" },
// //               { value: "room", label: "Room" },
// //           ];

// //     /* =========================================================
// //        LOADING / ERROR
// //     ========================================================= */

// //     if (loading) {
// //         return (
// //             <div className="locations-page">
// //                 <div className="locations-loading">
// //                     <div className="loading-spinner"></div>
// //                     <p>Loading Sites...</p>
// //                 </div>
// //             </div>
// //         );
// //     }

// //     if (error) {
// //         return (
// //             <div className="locations-page">
// //                 <div className="locations-header">
// //                     <div>
// //                         <h1>Sites</h1>
// //                         <p>Sites hierarchy</p>
// //                     </div>
// //                     <button className="refresh-btn" onClick={fetchLocations}>↻ Refresh</button>
// //                 </div>
// //                 <div className="location-error">
// //                     <h3>Failed to load locations</h3>
// //                     <p>{error}</p>
// //                     <button onClick={fetchLocations}>Try Again</button>
// //                 </div>
// //             </div>
// //         );
// //     }

// //     /* =========================================================
// //        RENDER
// //     ========================================================= */

// //     return (
// //         <SiteActionsContext.Provider
// //             value={{
// //                 canAssign,
// //                 openAssign: (branch) => setAssignTarget({ branch, hierarchyType }),
// //             }}
// //         >
// //             <div className="locations-page">
// //                 {assignTarget && (
// //                     <SiteOwnerModal
// //                         branch={assignTarget.branch}
// //                         hierarchyType={assignTarget.hierarchyType}
// //                         role={user?.role}
// //                         onClose={() => setAssignTarget(null)}
// //                         onSaved={fetchLocations}
// //                     />
// //                 )}

// //                 {/* HEADER */}
// //                 <div className="locations-header">
// //                     <div>
// //                         <h1>Sites</h1>
// //                         <p>Manage and view your complete site hierarchy</p>
// //                     </div>
// //                     <div className="header-actions">
// //                         <button className="refresh-btn" onClick={fetchLocations}>↻ Refresh</button>
// //                         {canAssign && (
// //                             <button className="add-location-btn" onClick={openAddLocation}>
// //                                 <span>+</span> Add Location
// //                             </button>
// //                         )}
// //                     </div>
// //                 </div>

// //                 {/* HIERARCHY SWITCH */}
// //                 <div className="hierarchy-switch" style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
// //                     <button
// //                         type="button"
// //                         onClick={() => changeHierarchy("GEOGRAPHICAL")}
// //                         className={hierarchyType === "GEOGRAPHICAL" ? "hierarchy-tab active" : "hierarchy-tab"}
// //                     >
// //                         Geographical
// //                     </button>
// //                     <button
// //                         type="button"
// //                         onClick={() => changeHierarchy("ZONAL")}
// //                         className={hierarchyType === "ZONAL" ? "hierarchy-tab active" : "hierarchy-tab"}
// //                     >
// //                         Zonal
// //                     </button>
// //                 </div>

// //                 {/* DESCRIPTION */}
// //                 <div className="hierarchy-description" style={{ marginBottom: "20px" }}>
// //                     <strong>{isGeo ? "Geographical Hierarchy" : "Zonal Hierarchy"}</strong>
// //                     <span>
// //                         {isGeo
// //                             ? "India → State → District → Taluka → City → Branch"
// //                             : "India → Zone → Circle → Region → Division → Branch"}
// //                     </span>
// //                 </div>

// //                 {/* SUMMARY */}
// //                 <div className="location-summary">
// //                     <div className="summary-card">
// //                         <div className="summary-icon zone-icon">{isGeo ? "S" : "Z"}</div>
// //                         <div>
// //                             <span>{isGeo ? "States" : "Zones"}</span>
// //                             <strong>{isGeo ? getTotalStates() : getTotalZones()}</strong>
// //                         </div>
// //                     </div>
// //                     <div className="summary-card">
// //                         <div className="summary-icon state-icon">{isGeo ? "D" : "C"}</div>
// //                         <div>
// //                             <span>{isGeo ? "Districts" : "Circles"}</span>
// //                             <strong>{isGeo ? getTotalDistricts() : getTotalCircles()}</strong>
// //                         </div>
// //                     </div>
// //                     <div className="summary-card">
// //                         <div className="summary-icon circle-icon">B</div>
// //                         <div>
// //                             <span>Branches</span>
// //                             <strong>{getTotalBranches()}</strong>
// //                         </div>
// //                     </div>
// //                     <div className="summary-card">
// //                         <div className="summary-icon ac-icon">AC</div>
// //                         <div>
// //                             <span>AC Units</span>
// //                             <strong>{getTotalACs()}</strong>
// //                         </div>
// //                     </div>
// //                 </div>

// //                 {/* EMPTY / TREES */}
// //                 {currentLocations.length === 0 ? (
// //                     <div className="empty-location">
// //                         <h3>No {isGeo ? "geographical" : "zonal"} locations found</h3>
// //                         <p>No locations are currently available for this hierarchy.</p>
// //                     </div>
// //                 ) : (
// //                     <>
// //                         {/* GEOGRAPHICAL TREE */}
// //                         {isGeo && (
// //                             <div className="location-tree">
// //                                 {currentLocations.map((state, stateIndex) => {
// //                                     const stateKey = `geo-state-${state.state_id || stateIndex}`;
// //                                     const stateExpanded = expanded[stateKey];

// //                                     return (
// //                                         <div className="tree-zone" key={stateKey}>
// //                                             <div className="tree-row zone-row" onClick={() => toggleNode(stateKey)}>
// //                                                 <button className="expand-btn">{stateExpanded ? "−" : "+"}</button>
// //                                                 <div className="location-symbol zone-symbol">S</div>
// //                                                 <div className="location-info">
// //                                                     <strong>{state.state_name}</strong>
// //                                                     <span>{state.state_id}</span>
// //                                                 </div>
// //                                                 <div className="location-count">{getDistrictCount(state)} Districts</div>
// //                                             </div>

// //                                             {stateExpanded && (
// //                                                 <div className="tree-children">
// //                                                     {state.districts?.map((district, districtIndex) => {
// //                                                         const districtKey = `geo-district-${district.district_id || districtIndex}`;
// //                                                         const districtExpanded = expanded[districtKey];

// //                                                         return (
// //                                                             <div key={districtKey}>
// //                                                                 <div className="tree-row state-row" onClick={() => toggleNode(districtKey)}>
// //                                                                     <button className="expand-btn">{districtExpanded ? "−" : "+"}</button>
// //                                                                     <div className="location-symbol state-symbol">D</div>
// //                                                                     <div className="location-info">
// //                                                                         <strong>{district.district_name}</strong>
// //                                                                         <span>{district.district_id}</span>
// //                                                                     </div>
// //                                                                     <div className="location-count">{getTalukaCount(district)} Talukas</div>
// //                                                                 </div>

// //                                                                 {districtExpanded && (
// //                                                                     <div className="nested-level">
// //                                                                         {district.talukas?.map((taluka, talukaIndex) => {
// //                                                                             const talukaKey = `geo-taluka-${taluka.taluka_id || talukaIndex}`;
// //                                                                             const talukaExpanded = expanded[talukaKey];

// //                                                                             return (
// //                                                                                 <div key={talukaKey}>
// //                                                                                     <div className="tree-row circle-row" onClick={() => toggleNode(talukaKey)}>
// //                                                                                         <button className="expand-btn">{talukaExpanded ? "−" : "+"}</button>
// //                                                                                         <div className="location-symbol circle-symbol">T</div>
// //                                                                                         <div className="location-info">
// //                                                                                             <strong>{taluka.taluka_name}</strong>
// //                                                                                             <span>{taluka.taluka_id}</span>
// //                                                                                         </div>
// //                                                                                         <div className="location-count">{getCityCount(taluka)} Cities</div>
// //                                                                                     </div>

// //                                                                                     {talukaExpanded && (
// //                                                                                         <div className="nested-level">
// //                                                                                             {taluka.cities?.map((city, cityIndex) => {
// //                                                                                                 const cityKey = `geo-city-${city.city_id || cityIndex}`;
// //                                                                                                 const cityExpanded = expanded[cityKey];

// //                                                                                                 return (
// //                                                                                                     <div key={cityKey}>
// //                                                                                                         <div className="tree-row city-row" onClick={() => toggleNode(cityKey)}>
// //                                                                                                             <button className="expand-btn">{cityExpanded ? "−" : "+"}</button>
// //                                                                                                             <div className="location-symbol city-symbol">C</div>
// //                                                                                                             <div className="location-info">
// //                                                                                                                 <strong>{city.city_name}</strong>
// //                                                                                                                 <span>{city.city_id}</span>
// //                                                                                                             </div>
// //                                                                                                             <div className="location-count">{getBranchCount(city)} Branches</div>
// //                                                                                                         </div>

// //                                                                                                         {cityExpanded && (
// //                                                                                                             <div className="nested-level">
// //                                                                                                                 {city.branches?.map((branch, branchIndex) => (
// //                                                                                                                     <BranchTree
// //                                                                                                                         key={branch.branch_id || branchIndex}
// //                                                                                                                         branch={branch}
// //                                                                                                                         expanded={expanded}
// //                                                                                                                         toggleNode={toggleNode}
// //                                                                                                                     />
// //                                                                                                                 ))}
// //                                                                                                             </div>
// //                                                                                                         )}
// //                                                                                                     </div>
// //                                                                                                 );
// //                                                                                             })}
// //                                                                                         </div>
// //                                                                                     )}
// //                                                                                 </div>
// //                                                                             );
// //                                                                         })}
// //                                                                     </div>
// //                                                                 )}
// //                                                             </div>
// //                                                         );
// //                                                     })}
// //                                                 </div>
// //                                             )}
// //                                         </div>
// //                                     );
// //                                 })}
// //                             </div>
// //                         )}

// //                         {/* ZONAL TREE */}
// //                         {!isGeo && (
// //                             <div className="location-tree">
// //                                 {currentLocations.map((zone, zoneIndex) => {
// //                                     const zoneKey = `zonal-zone-${zone.zone_id || zoneIndex}`;
// //                                     const zoneExpanded = expanded[zoneKey];

// //                                     return (
// //                                         <div className="tree-zone" key={zoneKey}>
// //                                             <div className="tree-row zone-row" onClick={() => toggleNode(zoneKey)}>
// //                                                 <button className="expand-btn">{zoneExpanded ? "−" : "+"}</button>
// //                                                 <div className="location-symbol zone-symbol">Z</div>
// //                                                 <div className="location-info">
// //                                                     <strong>{zone.zone_name}</strong>
// //                                                     <span>{zone.zone_id}</span>
// //                                                 </div>
// //                                                 <div className="location-count">{getCircleCount(zone)} Circles</div>
// //                                             </div>

// //                                             {zoneExpanded && (
// //                                                 <div className="tree-children">
// //                                                     {zone.circles?.map((circle, circleIndex) => {
// //                                                         const circleKey = `zonal-circle-${circle.circle_id || circleIndex}`;
// //                                                         const circleExpanded = expanded[circleKey];

// //                                                         return (
// //                                                             <div key={circleKey}>
// //                                                                 <div className="tree-row state-row" onClick={() => toggleNode(circleKey)}>
// //                                                                     <button className="expand-btn">{circleExpanded ? "−" : "+"}</button>
// //                                                                     <div className="location-symbol state-symbol">C</div>
// //                                                                     <div className="location-info">
// //                                                                         <strong>{circle.circle_name}</strong>
// //                                                                         <span>{circle.circle_id}</span>
// //                                                                     </div>
// //                                                                     <div className="location-count">{getRegionCount(circle)} Regions</div>
// //                                                                 </div>

// //                                                                 {circleExpanded && (
// //                                                                     <div className="nested-level">
// //                                                                         {circle.regions?.map((region, regionIndex) => {
// //                                                                             const regionKey = `zonal-region-${region.region_id || regionIndex}`;
// //                                                                             const regionExpanded = expanded[regionKey];

// //                                                                             return (
// //                                                                                 <div key={regionKey}>
// //                                                                                     <div className="tree-row circle-row" onClick={() => toggleNode(regionKey)}>
// //                                                                                         <button className="expand-btn">{regionExpanded ? "−" : "+"}</button>
// //                                                                                         <div className="location-symbol circle-symbol">R</div>
// //                                                                                         <div className="location-info">
// //                                                                                             <strong>{region.region_name}</strong>
// //                                                                                             <span>{region.region_id}</span>
// //                                                                                         </div>
// //                                                                                         <div className="location-count">{getDivisionCount(region)} Divisions</div>
// //                                                                                     </div>

// //                                                                                     {regionExpanded && (
// //                                                                                         <div className="nested-level">
// //                                                                                             {region.divisions?.map((division, divisionIndex) => {
// //                                                                                                 const divisionKey = `zonal-division-${division.division_id || divisionIndex}`;
// //                                                                                                 const divisionExpanded = expanded[divisionKey];

// //                                                                                                 return (
// //                                                                                                     <div key={divisionKey}>
// //                                                                                                         <div className="tree-row city-row" onClick={() => toggleNode(divisionKey)}>
// //                                                                                                             <button className="expand-btn">{divisionExpanded ? "−" : "+"}</button>
// //                                                                                                             <div className="location-symbol city-symbol">D</div>
// //                                                                                                             <div className="location-info">
// //                                                                                                                 <strong>{division.division_name}</strong>
// //                                                                                                                 <span>{division.division_id}</span>
// //                                                                                                             </div>
// //                                                                                                             <div className="location-count">{getBranchCount(division)} Branches</div>
// //                                                                                                         </div>

// //                                                                                                         {divisionExpanded && (
// //                                                                                                             <div className="nested-level">
// //                                                                                                                 {division.branches?.map((branch, branchIndex) => (
// //                                                                                                                     <BranchTree
// //                                                                                                                         key={branch.branch_id || branchIndex}
// //                                                                                                                         branch={branch}
// //                                                                                                                         expanded={expanded}
// //                                                                                                                         toggleNode={toggleNode}
// //                                                                                                                     />
// //                                                                                                                 ))}
// //                                                                                                             </div>
// //                                                                                                         )}
// //                                                                                                     </div>
// //                                                                                                 );
// //                                                                                             })}
// //                                                                                         </div>
// //                                                                                     )}
// //                                                                                 </div>
// //                                                                             );
// //                                                                         })}
// //                                                                     </div>
// //                                                                 )}
// //                                                             </div>
// //                                                         );
// //                                                     })}
// //                                                 </div>
// //                                             )}
// //                                         </div>
// //                                     );
// //                                 })}
// //                             </div>
// //                         )}
// //                     </>
// //                 )}

// //                 {/* ADD LOCATION MODAL */}
// //                 {showModal && (
// //                     <div className="modal-overlay" onClick={closeAddLocation}>
// //                         <div className="location-modal" onClick={(e) => e.stopPropagation()}>
// //                             <div className="modal-header">
// //                                 <div>
// //                                     <h2>
// //                                         Add {locationTypeOptions.find((o) => o.value === locationType)?.label}
// //                                     </h2>
// //                                     <p>Add a new location to the {isGeo ? "geographical" : "zonal"} hierarchy.</p>
// //                                 </div>
// //                                 <button className="close-btn" onClick={closeAddLocation} disabled={saving}>×</button>
// //                             </div>

// //                             <form
// //                                 onSubmit={(e) => {
// //                                     e.preventDefault();
// //                                     console.log("Location to create:", { hierarchyType, locationType, formData });
// //                                     /* Connect POST API here. */
// //                                 }}
// //                             >
// //                                 {/* QUICK BRANCH SEARCH */}
// //                                 <div className="form-group">
// //                                     <label>Quick Branch Search</label>
// //                                     <div
// //                                         className="branch-search-wrapper"
// //                                         style={{ position: "relative" }}
// //                                         onBlur={(e) => {
// //                                             if (!e.currentTarget.contains(e.relatedTarget)) {
// //                                                 setShowBranchResults(false);
// //                                             }
// //                                         }}
// //                                     >
// //                                         <input
// //                                             type="text"
// //                                             placeholder="Type branch name, code or ID…"
// //                                             value={branchSearch}
// //                                             onChange={(e) => {
// //                                                 setBranchSearch(e.target.value);
// //                                                 setShowBranchResults(true);
// //                                             }}
// //                                             onFocus={() => setShowBranchResults(true)}
// //                                             autoComplete="off"
// //                                         />

// //                                         {showBranchResults && branchSearch.trim() && (
// //                                             <div
// //                                                 className="branch-search-results"
// //                                                 style={{
// //                                                     position: "absolute",
// //                                                     top: "calc(100% + 4px)",
// //                                                     left: 0,
// //                                                     right: 0,
// //                                                     zIndex: 20,
// //                                                     background: "#fff",
// //                                                     border: "1px solid #d1d5db",
// //                                                     borderRadius: 6,
// //                                                     boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
// //                                                     maxHeight: 260,
// //                                                     overflowY: "auto",
// //                                                 }}
// //                                             >
// //                                                 {filteredBranches.length === 0 ? (
// //                                                     <div style={{ padding: "10px 12px", fontSize: 13, color: "#6b7280" }}>
// //                                                         No branches match "{branchSearch}".
// //                                                     </div>
// //                                                 ) : (
// //                                                     filteredBranches.map(({ branch, path }) => (
// //                                                         <button
// //                                                             type="button"
// //                                                             key={branch.branch_id}
// //                                                             onClick={() => selectBranchFromSearch(branch)}
// //                                                             style={{
// //                                                                 display: "block",
// //                                                                 width: "100%",
// //                                                                 textAlign: "left",
// //                                                                 padding: "8px 12px",
// //                                                                 background: "transparent",
// //                                                                 border: "none",
// //                                                                 borderBottom: "1px solid #f1f5f9",
// //                                                                 cursor: "pointer",
// //                                                             }}
// //                                                         >
// //                                                             <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
// //                                                                 <strong style={{ fontSize: 13 }}>{branch.branch_name}</strong>
// //                                                                 <span style={{ fontSize: 11, color: "#6b7280" }}>
// //                                                                     {branch.branch_code || branch.branch_id}
// //                                                                 </span>
// //                                                             </div>
// //                                                             {path && (
// //                                                                 <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
// //                                                                     {path}
// //                                                                 </div>
// //                                                             )}
// //                                                         </button>
// //                                                     ))
// //                                                 )}
// //                                             </div>
// //                                         )}
// //                                     </div>
// //                                     <small style={{ display: "block", marginTop: 4, fontSize: 11, color: "#6b7280" }}>
// //                                         Pick a branch to jump straight to adding a floor.
// //                                     </small>
// //                                 </div>

// //                                 {/* LOCATION TYPE */}
// //                                 <div className="form-group">
// //                                     <label>Location Type</label>
// //                                     <select
// //                                         value={locationType}
// //                                         onChange={(e) => {
// //                                             setLocationType(e.target.value);
// //                                             setSaveError("");
// //                                             setFormData(EMPTY_FORM);
// //                                         }}
// //                                     >
// //                                         {locationTypeOptions.map((option) => (
// //                                             <option key={option.value} value={option.value}>{option.label}</option>
// //                                         ))}
// //                                     </select>
// //                                 </div>

// //                                 {/* GEOGRAPHICAL FORM */}
// //                                 {isGeo && (
// //                                     <>
// //                                         {locationType === "state" && (
// //                                             <>
// //                                                 <div className="form-group">
// //                                                     <label>State Code</label>
// //                                                     <input
// //                                                         type="text"
// //                                                         placeholder="Example: MH"
// //                                                         value={formData.state_code}
// //                                                         onChange={(e) => handleFieldChange("state_code", e.target.value)}
// //                                                         required
// //                                                     />
// //                                                 </div>
// //                                                 <div className="form-group">
// //                                                     <label>State Name</label>
// //                                                     <input
// //                                                         type="text"
// //                                                         placeholder="Example: Maharashtra"
// //                                                         value={formData.state_name}
// //                                                         onChange={(e) => handleFieldChange("state_name", e.target.value)}
// //                                                         required
// //                                                     />
// //                                                 </div>
// //                                             </>
// //                                         )}

// //                                         {locationType === "district" && (
// //                                             <>
// //                                                 <div className="form-group">
// //                                                     <label>State</label>
// //                                                     <select
// //                                                         value={formData.state_id}
// //                                                         onChange={(e) =>
// //                                                             setFormData({
// //                                                                 ...formData,
// //                                                                 state_id: e.target.value,
// //                                                                 district_id: "",
// //                                                                 taluka_id: "",
// //                                                                 city_id: "",
// //                                                             })
// //                                                         }
// //                                                         required
// //                                                     >
// //                                                         <option value="">Select State</option>
// //                                                         {currentLocations.map((state) => (
// //                                                             <option key={state.state_id} value={state.state_id}>
// //                                                                 {state.state_name}
// //                                                             </option>
// //                                                         ))}
// //                                                     </select>
// //                                                 </div>
// //                                                 <LocationTextField
// //                                                     label="District Code"
// //                                                     placeholder="Example: MH-PUN"
// //                                                     value={formData.district_code}
// //                                                     onChange={(v) => handleFieldChange("district_code", v)}
// //                                                 />
// //                                                 <LocationTextField
// //                                                     label="District Name"
// //                                                     placeholder="Example: Pune"
// //                                                     value={formData.district_name}
// //                                                     onChange={(v) => handleFieldChange("district_name", v)}
// //                                                 />
// //                                             </>
// //                                         )}

// //                                         {locationType === "taluka" && (
// //                                             <>
// //                                                 <SelectField
// //                                                     label="State"
// //                                                     value={formData.state_id}
// //                                                     onChange={(v) => setFormData({ ...formData, state_id: v, district_id: "", taluka_id: "" })}
// //                                                     options={currentLocations}
// //                                                     valueKey="state_id"
// //                                                     labelKey="state_name"
// //                                                 />
// //                                                 <SelectField
// //                                                     label="District"
// //                                                     value={formData.district_id}
// //                                                     onChange={(v) => setFormData({ ...formData, district_id: v, taluka_id: "" })}
// //                                                     options={getDistrictsByState()}
// //                                                     valueKey="district_id"
// //                                                     labelKey="district_name"
// //                                                     disabled={!formData.state_id}
// //                                                 />
// //                                                 <LocationTextField
// //                                                     label="Taluka Code"
// //                                                     placeholder="Example: HAV"
// //                                                     value={formData.taluka_code}
// //                                                     onChange={(v) => handleFieldChange("taluka_code", v)}
// //                                                 />
// //                                                 <LocationTextField
// //                                                     label="Taluka Name"
// //                                                     placeholder="Example: Haveli"
// //                                                     value={formData.taluka_name}
// //                                                     onChange={(v) => handleFieldChange("taluka_name", v)}
// //                                                 />
// //                                             </>
// //                                         )}

// //                                         {locationType === "city" && (
// //                                             <>
// //                                                 <SelectField
// //                                                     label="State"
// //                                                     value={formData.state_id}
// //                                                     onChange={(v) => setFormData({ ...formData, state_id: v, district_id: "", taluka_id: "", city_id: "" })}
// //                                                     options={currentLocations}
// //                                                     valueKey="state_id"
// //                                                     labelKey="state_name"
// //                                                 />
// //                                                 <SelectField
// //                                                     label="District"
// //                                                     value={formData.district_id}
// //                                                     onChange={(v) => setFormData({ ...formData, district_id: v, taluka_id: "", city_id: "" })}
// //                                                     options={getDistrictsByState()}
// //                                                     valueKey="district_id"
// //                                                     labelKey="district_name"
// //                                                     disabled={!formData.state_id}
// //                                                 />
// //                                                 <SelectField
// //                                                     label="Taluka"
// //                                                     value={formData.taluka_id}
// //                                                     onChange={(v) => setFormData({ ...formData, taluka_id: v, city_id: "" })}
// //                                                     options={getTalukasByDistrict()}
// //                                                     valueKey="taluka_id"
// //                                                     labelKey="taluka_name"
// //                                                     disabled={!formData.district_id}
// //                                                 />
// //                                                 <LocationTextField
// //                                                     label="City Name"
// //                                                     placeholder="Example: Pune"
// //                                                     value={formData.city_name}
// //                                                     onChange={(v) => handleFieldChange("city_name", v)}
// //                                                 />
// //                                             </>
// //                                         )}

// //                                         {locationType === "branch" && (
// //                                             <>
// //                                                 <SelectField
// //                                                     label="State"
// //                                                     value={formData.state_id}
// //                                                     onChange={(v) => setFormData({ ...formData, state_id: v, district_id: "", taluka_id: "", city_id: "" })}
// //                                                     options={currentLocations}
// //                                                     valueKey="state_id"
// //                                                     labelKey="state_name"
// //                                                 />
// //                                                 <SelectField
// //                                                     label="District"
// //                                                     value={formData.district_id}
// //                                                     onChange={(v) => setFormData({ ...formData, district_id: v, taluka_id: "", city_id: "" })}
// //                                                     options={getDistrictsByState()}
// //                                                     valueKey="district_id"
// //                                                     labelKey="district_name"
// //                                                     disabled={!formData.state_id}
// //                                                 />
// //                                                 <SelectField
// //                                                     label="Taluka"
// //                                                     value={formData.taluka_id}
// //                                                     onChange={(v) => setFormData({ ...formData, taluka_id: v, city_id: "" })}
// //                                                     options={getTalukasByDistrict()}
// //                                                     valueKey="taluka_id"
// //                                                     labelKey="taluka_name"
// //                                                     disabled={!formData.district_id}
// //                                                 />
// //                                                 <SelectField
// //                                                     label="City"
// //                                                     value={formData.city_id}
// //                                                     onChange={(v) => handleFieldChange("city_id", v)}
// //                                                     options={getCitiesByTaluka()}
// //                                                     valueKey="city_id"
// //                                                     labelKey="city_name"
// //                                                     disabled={!formData.taluka_id}
// //                                                 />
// //                                                 <LocationTextField
// //                                                     label="Branch Code"
// //                                                     placeholder="Example: PUN-B01"
// //                                                     value={formData.branch_code}
// //                                                     onChange={(v) => handleFieldChange("branch_code", v)}
// //                                                 />
// //                                                 <LocationTextField
// //                                                     label="Branch Name"
// //                                                     placeholder="Example: Pune Branch 01"
// //                                                     value={formData.branch_name}
// //                                                     onChange={(v) => handleFieldChange("branch_name", v)}
// //                                                 />
// //                                             </>
// //                                         )}

// //                                         {locationType === "floor" && (
// //                                             <>
// //                                                 <div className="form-group">
// //                                                     <label>Branch</label>
// //                                                     <select
// //                                                         value={formData.branch_id}
// //                                                         onChange={(e) => handleFieldChange("branch_id", e.target.value)}
// //                                                         required
// //                                                     >
// //                                                         <option value="">Select Branch</option>
// //                                                         {allBranches().map((branch) => (
// //                                                             <option key={branch.branch_id} value={branch.branch_id}>
// //                                                                 {branch.branch_name}
// //                                                             </option>
// //                                                         ))}
// //                                                     </select>
// //                                                 </div>
// //                                                 <LocationTextField
// //                                                     label="Floor Name"
// //                                                     placeholder="Example: Floor-01"
// //                                                     value={formData.floor_name}
// //                                                     onChange={(v) => handleFieldChange("floor_name", v)}
// //                                                 />
// //                                             </>
// //                                         )}

// //                                         {locationType === "room" && (
// //                                             <>
// //                                                 <div className="form-group">
// //                                                     <label>Floor</label>
// //                                                     <select
// //                                                         value={formData.floor_id}
// //                                                         onChange={(e) => handleFieldChange("floor_id", e.target.value)}
// //                                                         required
// //                                                     >
// //                                                         <option value="">Select Floor</option>
// //                                                         {allFloors().map((floor) => (
// //                                                             <option key={floor.floor_id} value={floor.floor_id}>
// //                                                                 {floor.floor_name}
// //                                                             </option>
// //                                                         ))}
// //                                                     </select>
// //                                                 </div>
// //                                                 <LocationTextField
// //                                                     label="Room Name"
// //                                                     placeholder="Example: Room-01"
// //                                                     value={formData.room_name}
// //                                                     onChange={(v) => handleFieldChange("room_name", v)}
// //                                                 />
// //                                             </>
// //                                         )}
// //                                     </>
// //                                 )}

// //                                 {/* ZONAL FORM */}
// //                                 {!isGeo && (
// //                                     <>
// //                                         {locationType === "zone" && (
// //                                             <>
// //                                                 <LocationTextField
// //                                                     label="Zone Code"
// //                                                     placeholder="Example: WEST"
// //                                                     value={formData.zone_code}
// //                                                     onChange={(v) => handleFieldChange("zone_code", v)}
// //                                                 />
// //                                                 <LocationTextField
// //                                                     label="Zone Name"
// //                                                     placeholder="Example: West Zone"
// //                                                     value={formData.zone_name}
// //                                                     onChange={(v) => handleFieldChange("zone_name", v)}
// //                                                 />
// //                                             </>
// //                                         )}

// //                                         {locationType === "circle" && (
// //                                             <>
// //                                                 <SelectField
// //                                                     label="Zone"
// //                                                     value={formData.zone_id}
// //                                                     onChange={(v) => setFormData({ ...formData, zone_id: v, circle_id: "", region_id: "", division_id: "" })}
// //                                                     options={currentLocations}
// //                                                     valueKey="zone_id"
// //                                                     labelKey="zone_name"
// //                                                 />
// //                                                 <LocationTextField
// //                                                     label="Circle Code"
// //                                                     placeholder="Example: MH-C01"
// //                                                     value={formData.circle_code}
// //                                                     onChange={(v) => handleFieldChange("circle_code", v)}
// //                                                 />
// //                                                 <LocationTextField
// //                                                     label="Circle Name"
// //                                                     placeholder="Example: Maharashtra Circle"
// //                                                     value={formData.circle_name}
// //                                                     onChange={(v) => handleFieldChange("circle_name", v)}
// //                                                 />
// //                                             </>
// //                                         )}

// //                                         {locationType === "region" && (
// //                                             <>
// //                                                 <SelectField
// //                                                     label="Zone"
// //                                                     value={formData.zone_id}
// //                                                     onChange={(v) => setFormData({ ...formData, zone_id: v, circle_id: "", region_id: "" })}
// //                                                     options={currentLocations}
// //                                                     valueKey="zone_id"
// //                                                     labelKey="zone_name"
// //                                                 />
// //                                                 <SelectField
// //                                                     label="Circle"
// //                                                     value={formData.circle_id}
// //                                                     onChange={(v) => setFormData({ ...formData, circle_id: v, region_id: "" })}
// //                                                     options={getCirclesByZone()}
// //                                                     valueKey="circle_id"
// //                                                     labelKey="circle_name"
// //                                                     disabled={!formData.zone_id}
// //                                                 />
// //                                                 <LocationTextField
// //                                                     label="Region Code"
// //                                                     placeholder="Example: PUN-R01"
// //                                                     value={formData.region_code}
// //                                                     onChange={(v) => handleFieldChange("region_code", v)}
// //                                                 />
// //                                                 <LocationTextField
// //                                                     label="Region Name"
// //                                                     placeholder="Example: Pune Region"
// //                                                     value={formData.region_name}
// //                                                     onChange={(v) => handleFieldChange("region_name", v)}
// //                                                 />
// //                                             </>
// //                                         )}

// //                                         {locationType === "division" && (
// //                                             <>
// //                                                 <SelectField
// //                                                     label="Zone"
// //                                                     value={formData.zone_id}
// //                                                     onChange={(v) => setFormData({ ...formData, zone_id: v, circle_id: "", region_id: "", division_id: "" })}
// //                                                     options={currentLocations}
// //                                                     valueKey="zone_id"
// //                                                     labelKey="zone_name"
// //                                                 />
// //                                                 <SelectField
// //                                                     label="Circle"
// //                                                     value={formData.circle_id}
// //                                                     onChange={(v) => setFormData({ ...formData, circle_id: v, region_id: "", division_id: "" })}
// //                                                     options={getCirclesByZone()}
// //                                                     valueKey="circle_id"
// //                                                     labelKey="circle_name"
// //                                                     disabled={!formData.zone_id}
// //                                                 />
// //                                                 <SelectField
// //                                                     label="Region"
// //                                                     value={formData.region_id}
// //                                                     onChange={(v) => handleFieldChange("region_id", v)}
// //                                                     options={getRegionsByCircle()}
// //                                                     valueKey="region_id"
// //                                                     labelKey="region_name"
// //                                                     disabled={!formData.circle_id}
// //                                                 />
// //                                                 <LocationTextField
// //                                                     label="Division Code"
// //                                                     placeholder="Example: PUN-D01"
// //                                                     value={formData.division_code}
// //                                                     onChange={(v) => handleFieldChange("division_code", v)}
// //                                                 />
// //                                                 <LocationTextField
// //                                                     label="Division Name"
// //                                                     placeholder="Example: Pune Division"
// //                                                     value={formData.division_name}
// //                                                     onChange={(v) => handleFieldChange("division_name", v)}
// //                                                 />
// //                                             </>
// //                                         )}

// //                                         {locationType === "branch" && (
// //                                             <>
// //                                                 <SelectField
// //                                                     label="Zone"
// //                                                     value={formData.zone_id}
// //                                                     onChange={(v) => setFormData({ ...formData, zone_id: v, circle_id: "", region_id: "", division_id: "" })}
// //                                                     options={currentLocations}
// //                                                     valueKey="zone_id"
// //                                                     labelKey="zone_name"
// //                                                 />
// //                                                 <SelectField
// //                                                     label="Circle"
// //                                                     value={formData.circle_id}
// //                                                     onChange={(v) => setFormData({ ...formData, circle_id: v, region_id: "", division_id: "" })}
// //                                                     options={getCirclesByZone()}
// //                                                     valueKey="circle_id"
// //                                                     labelKey="circle_name"
// //                                                     disabled={!formData.zone_id}
// //                                                 />
// //                                                 <SelectField
// //                                                     label="Region"
// //                                                     value={formData.region_id}
// //                                                     onChange={(v) => setFormData({ ...formData, region_id: v, division_id: "" })}
// //                                                     options={getRegionsByCircle()}
// //                                                     valueKey="region_id"
// //                                                     labelKey="region_name"
// //                                                     disabled={!formData.circle_id}
// //                                                 />
// //                                                 <SelectField
// //                                                     label="Division"
// //                                                     value={formData.division_id}
// //                                                     onChange={(v) => handleFieldChange("division_id", v)}
// //                                                     options={getDivisionsByRegion()}
// //                                                     valueKey="division_id"
// //                                                     labelKey="division_name"
// //                                                     disabled={!formData.region_id}
// //                                                 />
// //                                                 <LocationTextField
// //                                                     label="Branch Code"
// //                                                     placeholder="Example: PUN-B01"
// //                                                     value={formData.branch_code}
// //                                                     onChange={(v) => handleFieldChange("branch_code", v)}
// //                                                 />
// //                                                 <LocationTextField
// //                                                     label="Branch Name"
// //                                                     placeholder="Example: Pune Branch 01"
// //                                                     value={formData.branch_name}
// //                                                     onChange={(v) => handleFieldChange("branch_name", v)}
// //                                                 />
// //                                             </>
// //                                         )}

// //                                         {locationType === "floor" && (
// //                                             <>
// //                                                 <div className="form-group">
// //                                                     <label>Branch</label>
// //                                                     <select
// //                                                         value={formData.branch_id}
// //                                                         onChange={(e) => handleFieldChange("branch_id", e.target.value)}
// //                                                         required
// //                                                     >
// //                                                         <option value="">Select Branch</option>
// //                                                         {allBranches().map((branch) => (
// //                                                             <option key={branch.branch_id} value={branch.branch_id}>
// //                                                                 {branch.branch_name}
// //                                                             </option>
// //                                                         ))}
// //                                                     </select>
// //                                                 </div>
// //                                                 <LocationTextField
// //                                                     label="Floor Name"
// //                                                     placeholder="Example: Floor-01"
// //                                                     value={formData.floor_name}
// //                                                     onChange={(v) => handleFieldChange("floor_name", v)}
// //                                                 />
// //                                             </>
// //                                         )}

// //                                         {locationType === "room" && (
// //                                             <>
// //                                                 <div className="form-group">
// //                                                     <label>Floor</label>
// //                                                     <select
// //                                                         value={formData.floor_id}
// //                                                         onChange={(e) => handleFieldChange("floor_id", e.target.value)}
// //                                                         required
// //                                                     >
// //                                                         <option value="">Select Floor</option>
// //                                                         {allFloors().map((floor) => (
// //                                                             <option key={floor.floor_id} value={floor.floor_id}>
// //                                                                 {floor.floor_name}
// //                                                             </option>
// //                                                         ))}
// //                                                     </select>
// //                                                 </div>
// //                                                 <LocationTextField
// //                                                     label="Room Name"
// //                                                     placeholder="Example: Room-01"
// //                                                     value={formData.room_name}
// //                                                     onChange={(v) => handleFieldChange("room_name", v)}
// //                                                 />
// //                                             </>
// //                                         )}
// //                                     </>
// //                                 )}

// //                                 {saveError && <div className="location-error">{saveError}</div>}

// //                                 <div className="modal-actions">
// //                                     <button
// //                                         type="button"
// //                                         className="cancel-btn"
// //                                         onClick={closeAddLocation}
// //                                         disabled={saving}
// //                                     >
// //                                         Cancel
// //                                     </button>
// //                                     <button type="submit" className="save-btn" disabled={saving}>
// //                                         {saving ? "Saving..." : "Add Location"}
// //                                     </button>
// //                                 </div>
// //                             </form>
// //                         </div>
// //                     </div>
// //                 )}
// //             </div>
// //         </SiteActionsContext.Provider>
// //     );
// // };

// // const LocationTextField = ({ label, placeholder, value, onChange }) => (
// //     <div className="form-group">
// //         <label>{label}</label>
// //         <input
// //             type="text"
// //             placeholder={placeholder}
// //             value={value}
// //             onChange={(e) => onChange(e.target.value)}
// //             required
// //         />
// //     </div>
// // );

// // const SelectField = ({
// //     label,
// //     value,
// //     onChange,
// //     options = [],
// //     valueKey,
// //     labelKey,
// //     disabled = false,
// // }) => (
// //     <div className="form-group">
// //         <label>{label}</label>
// //         <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} required>
// //             <option value="">Select {label}</option>
// //             {options.map((item, index) => (
// //                 <option key={item[valueKey] || index} value={item[valueKey]}>
// //                     {item[labelKey]}
// //                 </option>
// //             ))}
// //         </select>
// //     </div>
// // );

// // /* =========================================================
// //    BRANCH TREE
// // ========================================================= */

// // const BranchTree = ({ branch, expanded, toggleNode }) => {
// //     const branchKey = `branch-${branch.branch_id}`;
// //     const branchExpanded = expanded[branchKey];
// //     const { canAssign, openAssign } = useContext(SiteActionsContext);

// //     const floorCount = branch.floors?.length || 0;

// //     // ACs placed straight under the branch: new `sites` list + legacy `ac_devices`
// //     const directACs = [...(branch.sites || []), ...(branch.ac_devices || [])];
// //     const directACCount = directACs.length;

// //     const customerLabel = branch.customer?.company;
// //     const adminLabel = (branch.admins || []).map((a) => a.name).join(", ");

// //     return (
// //         <div>
// //             {/* BRANCH ROW */}
// //             <div className="tree-row branch-row" onClick={() => toggleNode(branchKey)}>
// //                 <button className="expand-btn">{branchExpanded ? "−" : "+"}</button>
// //                 <div className="location-symbol branch-symbol">B</div>
// //                 <div className="location-info">
// //                     <strong>{branch.branch_name}</strong>
// //                     <span>{branch.branch_id}</span>
// //                     <span style={{ display: "block", fontSize: 12, marginTop: 2 }}>
// //                         {customerLabel ? (
// //                             <>
// //                                 <b>{customerLabel}</b>
// //                                 {adminLabel ? ` · Admin: ${adminLabel}` : " · no admin assigned"}
// //                             </>
// //                         ) : (
// //                             <em style={{ color: "#b45309" }}>Not assigned to a customer</em>
// //                         )}
// //                     </span>
// //                 </div>
// //                 <div className="location-count">
// //                     {floorCount} Floors
// //                     {directACCount > 0 && ` • ${directACCount} Direct ACs`}
// //                 </div>
// //                 {canAssign && (
// //                     <button
// //                         type="button"
// //                         className="refresh-btn"
// //                         style={{ marginLeft: 12, whiteSpace: "nowrap" }}
// //                         onClick={(e) => { e.stopPropagation(); openAssign(branch); }}
// //                     >
// //                         {customerLabel ? "Edit owners" : "Assign"}
// //                     </button>
// //                 )}
// //             </div>

// //             {/* BRANCH CONTENT */}
// //             {branchExpanded && (
// //                 <div className="nested-level">
// //                     {/* DIRECT ACs */}
// //                     {directACs.length > 0 && (
// //                         <div className="ac-list">
// //                             {directACs.map((ac, index) => (
// //                                 <div className="ac-item" key={ac.ac_id || ac.site_id || index}>
// //                                     <div className="ac-dot"></div>
// //                                     <div className="ac-info">
// //                                         <strong>{ac.ac_id || ac.site_id}</strong>
// //                                         <span>{ac.device_name}</span>
// //                                     </div>
// //                                     <span className={ac.status === "ON" ? "ac-status on" : "ac-status off"}>
// //                                         {ac.status}
// //                                     </span>
// //                                 </div>
// //                             ))}
// //                         </div>
// //                     )}

// //                     {/* FLOORS */}
// //                     {branch.floors?.map((floor, floorIndex) => {
// //                         const floorKey = `floor-${floor.floor_id || floorIndex}`;
// //                         const floorExpanded = expanded[floorKey];

// //                         return (
// //                             <div key={floorKey}>
// //                                 <div className="tree-row floor-row" onClick={() => toggleNode(floorKey)}>
// //                                     <button className="expand-btn">{floorExpanded ? "−" : "+"}</button>
// //                                     <div className="location-symbol floor-symbol">F</div>
// //                                     <div className="location-info">
// //                                         <strong>{floor.floor_name}</strong>
// //                                         <span>{floor.floor_id}</span>
// //                                     </div>
// //                                     <div className="location-count">
// //                                         {(floor.rooms?.length || 0) > 0
// //                                             ? `${floor.rooms.length} Rooms`
// //                                             : `${floor.sites?.length || 0} ACs`}
// //                                     </div>
// //                                 </div>

// //                                 {floorExpanded && (
// //                                     <div className="nested-level">
// //                                         {floor.sites?.length > 0 && (
// //                                             <div className="ac-list">
// //                                                 {floor.sites.map((ac, acIndex) => (
// //                                                     <div className="ac-item" key={ac.site_id || ac.ac_id || acIndex}>
// //                                                         <div className="ac-dot"></div>
// //                                                         <div className="ac-info">
// //                                                             <strong>{ac.site_id || ac.ac_id}</strong>
// //                                                             <span>{ac.device_name}</span>
// //                                                         </div>
// //                                                         <span className={ac.status === "ON" ? "ac-status on" : "ac-status off"}>
// //                                                             {ac.status}
// //                                                         </span>
// //                                                     </div>
// //                                                 ))}
// //                                             </div>
// //                                         )}

// //                                         {floor.rooms?.map((room, roomIndex) => {
// //                                             const roomKey = `room-${room.room_id || roomIndex}`;
// //                                             const roomExpanded = expanded[roomKey];

// //                                             return (
// //                                                 <div key={roomKey}>
// //                                                     <div className="tree-row room-row" onClick={() => toggleNode(roomKey)}>
// //                                                         <button className="expand-btn">{roomExpanded ? "−" : "+"}</button>
// //                                                         <div className="location-symbol room-symbol">R</div>
// //                                                         <div className="location-info">
// //                                                             <strong>{room.room_name}</strong>
// //                                                             <span>{room.room_id}</span>
// //                                                         </div>
// //                                                         <div className="location-count">
// //                                                             {room.ac_devices?.length || 0} ACs
// //                                                         </div>
// //                                                     </div>

// //                                                     {roomExpanded && room.ac_devices?.length > 0 && (
// //                                                         <div className="ac-list">
// //                                                             {room.ac_devices.map((ac, acIndex) => (
// //                                                                 <div className="ac-item" key={ac.ac_id || acIndex}>
// //                                                                     <div className="ac-dot"></div>
// //                                                                     <div className="ac-info">
// //                                                                         <strong>{ac.ac_id}</strong>
// //                                                                         <span>{ac.device_name}</span>
// //                                                                     </div>
// //                                                                     <span className={ac.status === "ON" ? "ac-status on" : "ac-status off"}>
// //                                                                         {ac.status}
// //                                                                     </span>
// //                                                                 </div>
// //                                                             ))}
// //                                                         </div>
// //                                                     )}
// //                                                 </div>
// //                                             );
// //                                         })}
// //                                     </div>
// //                                 )}
// //                             </div>
// //                         );
// //                     })}
// //                 </div>
// //             )}
// //         </div>
// //     );
// // };

// // export default Locations;



// import React, { useEffect, useMemo, useState } from "react";
// import "./Locations.css";

// const API_BASE = "http://localhost:8000/api";

// const getToken = () =>
//     localStorage.getItem("token") ||
//     localStorage.getItem("authToken") ||
//     localStorage.getItem("access_token") ||
//     localStorage.getItem("accessToken");

// const getStoredUser = () => {
//     try {
//         const raw =
//         localStorage.getItem("rbac_auth_user") ||
//         localStorage.getItem("user") ||
//         localStorage.getItem("currentUser");

//         return raw ? JSON.parse(raw) : {};
//     } catch {
//         return {};
//     }
// };

// const authHeaders = () => {
//     const token = getToken();

//     return {
//         "Content-Type": "application/json",
//         ...(token ? { Authorization: `Token ${token}` } : {}),
//     };
// };

// const normalize = (value) =>
//     String(value ?? "")
//         .trim()
//         .toLowerCase();

// const getId = (obj) =>
//     obj?.id ??
//     obj?.pk ??
//     obj?.uuid ??
//     obj?.value ??
//     obj?.customer_id ??
//     obj?.state_id ??
//     obj?.zone_id ??
//     null;

// const getName = (obj, fallback = "Unnamed") =>
//     obj?.name ??
//     obj?.title ??
//     obj?.label ??
//     obj?.state_name ??
//     obj?.zone_name ??
//     obj?.city_name ??
//     obj?.branch_name ??
//     obj?.floor_name ??
//     obj?.site_name ??
//     fallback;

// const getResults = (data) => {
//     if (Array.isArray(data)) return data;
//     if (Array.isArray(data?.results)) return data.results;
//     if (Array.isArray(data?.data)) return data.data;
//     if (Array.isArray(data?.sites)) return data.sites;
//     return [];
// };

// const fetchJSON = async (url) => {
//     const response = await fetch(url, {
//         headers: authHeaders(),
//     });

//     if (!response.ok) {
//         throw new Error(`${response.status}: ${response.statusText}`);
//     }

//     return response.json();
// };

// const normalizeSite = (site) => ({
//     ...site,
//     id: getId(site),
//     name: getName(site, `Site ${getId(site) || ""}`),

//     customerId: site.customer_id ?? site.customer?.id ?? site.customer ?? null,
//     customerName: site.customer_name ?? site.customer?.name ?? "",

//     hierarchyType:
//         site.hierarchy_type ??
//         site.customer_hierarchy_type ??
//         site.hierarchy ??
//         "",

//     stateId: site.state_id ?? site.state?.id ?? site.city?.state_id ?? null,
//     stateName: site.state_name ?? site.state?.name ?? "",

//     districtId: site.district_id ?? site.district?.id ?? null,
//     districtName: site.district_name ?? site.district?.name ?? "",

//     talukaId: site.taluka_id ?? site.taluka?.id ?? null,
//     talukaName: site.taluka_name ?? site.taluka?.name ?? "",

//     cityId: site.city_id ?? site.city?.id ?? null,
//     cityName: site.city_name ?? site.city?.name ?? "",

//     zoneId: site.zone_id ?? site.zone?.id ?? null,
//     zoneName: site.zone_name ?? site.zone?.name ?? "",

//     circleId: site.circle_id ?? site.circle?.id ?? null,
//     circleName: site.circle_name ?? site.circle?.name ?? "",

//     regionId: site.region_id ?? site.region?.id ?? null,
//     regionName: site.region_name ?? site.region?.name ?? "",

//     divisionId: site.division_id ?? site.division?.id ?? null,
//     divisionName: site.division_name ?? site.division?.name ?? "",

//     branchId: site.branch_id ?? site.branch?.id ?? null,
//     branchName: site.branch_name ?? site.branch?.name ?? "",

//     floorId: site.floor_id ?? site.floor?.id ?? null,
//     floorName: site.floor_name ?? site.floor?.name ?? "",

//     adminId: site.admin_id ?? site.admin?.id ?? null,
//     adminName: site.admin_name ?? site.admin?.name ?? "",

//     acs: site.acs ?? site.devices ?? site.ac_devices ?? [],
// });

// const normalizeAC = (ac) => ({
//     ...ac,
//     id: getId(ac),
//     name:
//         ac.ac_id ??
//         ac.device_name ??
//         ac.name ??
//         `AC ${getId(ac) || ""}`,
//     status: String(ac.status ?? ac.state ?? "OFF").toUpperCase(),
// });

// const matchesUserScope = (site, user) => {
//     const role = normalize(user?.role || user?.user_type);
//     if (
//         role.includes("super") ||
//         role.includes("organization") ||
//         role === "org_admin"
//     ) {
//         return true;
//     }

//     if (role === "customer") {
//         const userCustomerId =
//             user?.customer_id ??
//             user?.customer?.id ??
//             user?.customer ??
//             user?.scope_id ??
//             null;

//         const userCustomerName =
//             user?.customer_name ??
//             user?.customer?.name ??
//             user?.scope_name ??
//             "";

//         const customerIdMatches =
//             userCustomerId != null &&
//             site.customerId != null &&
//             String(userCustomerId) === String(site.customerId);

//         const customerNameMatches =
//             normalize(userCustomerName) &&
//             normalize(site.customerName) &&
//             normalize(userCustomerName) === normalize(site.customerName);

//         return customerIdMatches || customerNameMatches;
//     }

//     if (role === "admin" || role === "branch_admin") {
//         const assignedHierarchy =
//             user?.hierarchy_type ??
//             user?.customer_hierarchy_type ??
//             user?.hierarchy ??
//             "";

//         const stateId = user?.state_id ?? user?.state?.id ?? user?.scope_id ?? null;

//         const stateName = user?.state_name ?? user?.state?.name ?? user?.scope_name ?? "";

//         const zoneId = user?.zone_id ?? user?.zone?.id ?? user?.scope_id ?? null;

//         const zoneName = user?.zone_name ?? user?.zone?.name ?? user?.scope_name ?? "";

//         if (normalize(assignedHierarchy) === "geographical") {
//         if (
//             stateId != null &&
//             site.stateId != null &&
//             String(stateId) === String(site.stateId)
//         ) {
//             return true;
//         }

//         if (
//             normalize(stateName) &&
//             normalize(stateName) === normalize(site.stateName)
//         ) {
//             return true;
//         }

//         return false;
//         }

//         if (normalize(assignedHierarchy) === "zonal") {
//         if (
//             zoneId != null &&
//             site.zoneId != null &&
//             String(zoneId) === String(site.zoneId)
//         ) {
//             return true;
//         }

//         if (
//             normalize(zoneName) &&
//             normalize(zoneName) === normalize(site.zoneName)
//         ) {
//             return true;
//         }

//         return false;
//         }

//         if (
//             stateId != null &&
//             site.stateId != null &&
//             String(stateId) === String(site.stateId)
//         ) {
//         return true;
//         }

//         if (
//             zoneId != null &&
//             site.zoneId != null &&
//             String(zoneId) === String(site.zoneId)
//         ) {
//         return true;
//         }

//         return false;
//     }

//     return true;
// };

// const buildGeographicalTree = (sites) => {
//     const states = {};

//     sites.forEach((site) => {
//         const stateKey = site.stateId ?? (normalize(site.stateName) || "unknown-state");
//         if (!states[stateKey]) {
//         states[stateKey] = {
//             id: stateKey,
//             name: site.stateName || "Unknown State",
//             districts: {},
//             sites: [],
//         };
//         }

//         const state = states[stateKey];

//         const districtKey =
//         site.districtId ?? (normalize(site.districtName) || "unknown-district");

//         if (!state.districts[districtKey]) {
//         state.districts[districtKey] = {
//             id: districtKey,
//             name: site.districtName || "Unknown District",
//             talukas: {},
//             sites: [],
//         };
//         }

//         const district = state.districts[districtKey];

//         const talukaKey =
//         site.talukaId ?? (normalize(site.talukaName) || "unknown-taluka");

//         if (!district.talukas[talukaKey]) {
//         district.talukas[talukaKey] = {
//             id: talukaKey,
//             name: site.talukaName || "Unknown Taluka",
//             cities: {},
//             sites: [],
//         };
//         }

//         const taluka = district.talukas[talukaKey];

//         const cityKey = site.cityId ?? (normalize(site.cityName) || "unknown-city");

//         if (!taluka.cities[cityKey]) {
//         taluka.cities[cityKey] = {
//             id: cityKey,
//             name: site.cityName || "Unknown City",
//             branches: {},
//             sites: [],
//         };
//         }

//         const city = taluka.cities[cityKey];

//         const branchKey = site.branchId ?? (normalize(site.branchName) || "unknown-branch");

//         if (!city.branches[branchKey]) {
//         city.branches[branchKey] = {
//             id: branchKey,
//             name: site.branchName || "Unknown Branch",
//             floors: {},
//             sites: [],
//         };
//         }

//         const branch = city.branches[branchKey];

//         const floorKey = site.floorId ?? (normalize(site.floorName) || "unknown-floor");

//         if (!branch.floors[floorKey]) {
//         branch.floors[floorKey] = {
//             id: floorKey,
//             name: site.floorName || "Unknown Floor",
//             sites: [],
//         };
//         }

//         branch.floors[floorKey].sites.push(site);
//         branch.sites.push(site);
//         city.sites.push(site);
//         taluka.sites.push(site);
//         district.sites.push(site);
//         state.sites.push(site);
//     });

//     return Object.values(states);
// };

// const buildZonalTree = (sites) => {
//     const zones = {};

//     sites.forEach((site) => {
//         const zoneKey = site.zoneId ?? (normalize(site.zoneName) || "unknown-zone");

//         if (!zones[zoneKey]) {
//         zones[zoneKey] = {
//             id: zoneKey,
//             name: site.zoneName || "Unknown Zone",
//             circles: {},
//             sites: [],
//         };
//         }

//         const zone = zones[zoneKey];

//         const circleKey =
//         site.circleId ?? (normalize(site.circleName) || "unknown-circle");

//         if (!zone.circles[circleKey]) {
//         zone.circles[circleKey] = {
//             id: circleKey,
//             name: site.circleName || "Unknown Circle",
//             regions: {},
//             sites: [],
//         };
//         }

//         const circle = zone.circles[circleKey];

//         const regionKey = site.regionId ?? (normalize(site.regionName) || "unknown-region");
        
//         if (!circle.regions[regionKey]) {
//         circle.regions[regionKey] = {
//             id: regionKey,
//             name: site.regionName || "Unknown Region",
//             divisions: {},
//             sites: [],
//         };
//         }

//         const region = circle.regions[regionKey];

//         const divisionKey = site.divisionId ?? (normalize(site.divisionName) || "unknown-division");

//         if (!region.divisions[divisionKey]) {
//         region.divisions[divisionKey] = {
//             id: divisionKey,
//             name: site.divisionName || "Unknown Division",
//             branches: {},
//             sites: [],
//         };
//         }

//         const division = region.divisions[divisionKey];

//         const branchKey =
//         site.branchId ?? (normalize(site.branchName) || "unknown-branch");

//         if (!division.branches[branchKey]) {
//         division.branches[branchKey] = {
//             id: branchKey,
//             name: site.branchName || "Unknown Branch",
//             floors: {},
//             sites: [],
//         };
//         }

//         const branch = division.branches[branchKey];

//         const floorKey =
//         site.floorId ?? (normalize(site.floorName) || "unknown-floor");

//         if (!branch.floors[floorKey]) {
//         branch.floors[floorKey] = {
//             id: floorKey,
//             name: site.floorName || "Unknown Floor",
//             sites: [],
//         };
//         }

//         branch.floors[floorKey].sites.push(site);
//         branch.sites.push(site);
//         division.sites.push(site);
//         region.sites.push(site);
//         circle.sites.push(site);
//         zone.sites.push(site);
//     });

//     return Object.values(zones);
// };

// const ExpandButton = ({ open, onClick }) => (
//     <button
//         type="button"
//         className="expand-btn"
//         onClick={(e) => {
//         e.stopPropagation();
//         onClick();
//         }}
//     >
//         {open ? "−" : "+"}
//     </button>
// );

// const SiteNode = ({ site, expanded, onToggle }) => {
//     const acs = (site.acs || []).map(normalizeAC);

//     return (
//         <div>
//             <div
//                 className="tree-row room-row"
//                 onClick={() => onToggle(`site-${site.id}`)}
//             >
//                 <ExpandButton
//                 open={expanded}
//                 onClick={() => onToggle(`site-${site.id}`)}
//                 />

//                 <div className="location-symbol room-symbol">SITE</div>

//                 <div className="location-info">
//                 <strong>{site.name}</strong>
//                 <span>
//                     {site.branchName || "Site"}{" "}
//                     {site.floorName ? `• ${site.floorName}` : ""}
//                 </span>
//                 </div>

//                 <div className="location-count">
//                 {acs.length} AC{acs.length !== 1 ? "s" : ""}
//                 </div>
//             </div>

//             {expanded && acs.length > 0 && (
//                 <div className="ac-list">
//                 {acs.map((ac) => (
//                     <div className="ac-item" key={ac.id || ac.name}>
//                     <div className="ac-dot" />

//                     <div className="ac-info">
//                         <strong>{ac.name}</strong>
//                         <span>{site.name}</span>
//                     </div>

//                     <div
//                         className={`ac-status ${ac.status === "ON" ? "on" : "off"}`}
//                     >
//                         {ac.status}
//                     </div>
//                     </div>
//                 ))}
//                 </div>
//             )}

//             {expanded && acs.length === 0 && (
//                 <div className="ac-list">
//                 <div className="ac-item">
//                     <div className="ac-info">
//                     <span>No registered ACs</span>
//                     </div>
//                 </div>
//                 </div>
//             )}
//         </div>
//     );
// };

// const GeographicalTree = ({ tree, expanded, toggle }) => (
//     <div className="location-tree">
//         {tree.map((state) => (
//         <div className="tree-zone" key={`state-${state.id}`}>
//             <div
//             className="tree-row zone-row"
//             onClick={() => toggle(`state-${state.id}`)}
//             >
//             <ExpandButton
//                 open={expanded.has(`state-${state.id}`)}
//                 onClick={() => toggle(`state-${state.id}`)}
//             />

//             <div className="location-symbol state-symbol">STATE</div>

//             <div className="location-info">
//                 <strong>{state.name}</strong>
//                 <span>Geographical hierarchy</span>
//             </div>

//             <div className="location-count">{state.sites.length} Sites</div>
//             </div>

//             {expanded.has(`state-${state.id}`) && (
//             <div className="tree-children">
//                 {Object.values(state.districts).map((district) => (
//                 <div key={`district-${district.id}`}>
//                     <div
//                     className="tree-row state-row"
//                     onClick={() =>
//                         toggle(`district-${state.id}-${district.id}`)
//                     }
//                     >
//                     <ExpandButton
//                         open={expanded.has(
//                         `district-${state.id}-${district.id}`
//                         )}
//                         onClick={() =>
//                         toggle(`district-${state.id}-${district.id}`)
//                         }
//                     />

//                     <div className="location-symbol state-symbol">DIST</div>

//                     <div className="location-info">
//                         <strong>{district.name}</strong>
//                         <span>{state.name}</span>
//                     </div>

//                     <div className="location-count">
//                         {district.sites.length}
//                     </div>
//                     </div>

//                     {expanded.has(
//                     `district-${state.id}-${district.id}`
//                     ) && (
//                     <div className="nested-level">
//                         {Object.values(district.talukas).map((taluka) => (
//                         <div key={`taluka-${taluka.id}`}>
//                             <div
//                             className="tree-row circle-row"
//                             onClick={() =>
//                                 toggle(
//                                 `taluka-${district.id}-${taluka.id}`
//                                 )
//                             }
//                             >
//                             <ExpandButton
//                                 open={expanded.has(
//                                 `taluka-${district.id}-${taluka.id}`
//                                 )}
//                                 onClick={() =>
//                                 toggle(
//                                     `taluka-${district.id}-${taluka.id}`
//                                 )
//                                 }
//                             />

//                             <div className="location-symbol circle-symbol">
//                                 TAL
//                             </div>

//                             <div className="location-info">
//                                 <strong>{taluka.name}</strong>
//                                 <span>{district.name}</span>
//                             </div>

//                             <div className="location-count">
//                                 {taluka.sites.length}
//                             </div>
//                             </div>

//                             {expanded.has(
//                             `taluka-${district.id}-${taluka.id}`
//                             ) && (
//                             <div className="nested-level">
//                                 {Object.values(taluka.cities).map((city) => (
//                                 <div key={`city-${city.id}`}>
//                                     <div
//                                     className="tree-row city-row"
//                                     onClick={() =>
//                                         toggle(
//                                         `city-${taluka.id}-${city.id}`
//                                         )
//                                     }
//                                     >
//                                     <ExpandButton
//                                         open={expanded.has(
//                                         `city-${taluka.id}-${city.id}`
//                                         )}
//                                         onClick={() =>
//                                         toggle(
//                                             `city-${taluka.id}-${city.id}`
//                                         )
//                                         }
//                                     />

//                                     <div className="location-symbol city-symbol">
//                                         CITY
//                                     </div>

//                                     <div className="location-info">
//                                         <strong>{city.name}</strong>
//                                         <span>{taluka.name}</span>
//                                     </div>

//                                     <div className="location-count">
//                                         {city.sites.length}
//                                     </div>
//                                     </div>

//                                     {expanded.has(
//                                     `city-${taluka.id}-${city.id}`
//                                     ) && (
//                                     <div className="nested-level">
//                                         {Object.values(
//                                         city.branches
//                                         ).map((branch) => (
//                                         <div
//                                             key={`branch-${branch.id}`}
//                                         >
//                                             <div
//                                             className="tree-row branch-row"
//                                             onClick={() =>
//                                                 toggle(
//                                                 `branch-${city.id}-${branch.id}`
//                                                 )
//                                             }
//                                             >
//                                             <ExpandButton
//                                                 open={expanded.has(
//                                                 `branch-${city.id}-${branch.id}`
//                                                 )}
//                                                 onClick={() =>
//                                                 toggle(
//                                                     `branch-${city.id}-${branch.id}`
//                                                 )
//                                                 }
//                                             />

//                                             <div className="location-symbol branch-symbol">
//                                                 BR
//                                             </div>

//                                             <div className="location-info">
//                                                 <strong>
//                                                 {branch.name}
//                                                 </strong>
//                                                 <span>{city.name}</span>
//                                             </div>

//                                             <div className="location-count">
//                                                 {branch.sites.length}
//                                             </div>
//                                             </div>

//                                             {expanded.has(
//                                             `branch-${city.id}-${branch.id}`
//                                             ) && (
//                                             <div className="nested-level">
//                                                 {Object.values(
//                                                 branch.floors
//                                                 ).map((floor) => (
//                                                 <div
//                                                     key={`floor-${floor.id}`}
//                                                 >
//                                                     <div
//                                                     className="tree-row floor-row"
//                                                     onClick={() =>
//                                                         toggle(
//                                                         `floor-${branch.id}-${floor.id}`
//                                                         )
//                                                     }
//                                                     >
//                                                     <ExpandButton
//                                                         open={expanded.has(
//                                                         `floor-${branch.id}-${floor.id}`
//                                                         )}
//                                                         onClick={() =>
//                                                         toggle(
//                                                             `floor-${branch.id}-${floor.id}`
//                                                         )
//                                                         }
//                                                     />

//                                                     <div className="location-symbol floor-symbol">
//                                                         FL
//                                                     </div>

//                                                     <div className="location-info">
//                                                         <strong>
//                                                         {floor.name}
//                                                         </strong>
//                                                         <span>
//                                                         {branch.name}
//                                                         </span>
//                                                     </div>

//                                                     <div className="location-count">
//                                                         {floor.sites.length}
//                                                     </div>
//                                                     </div>

//                                                     {expanded.has(
//                                                     `floor-${branch.id}-${floor.id}`
//                                                     ) && (
//                                                     <div className="nested-level">
//                                                         {floor.sites.map(
//                                                         (site) => (
//                                                             <SiteNode
//                                                             key={site.id}
//                                                             site={site}
//                                                             expanded={expanded.has(
//                                                                 `site-${site.id}`
//                                                             )}
//                                                             onToggle={toggle}
//                                                             />
//                                                         )
//                                                         )}
//                                                     </div>
//                                                     )}
//                                                 </div>
//                                                 ))}
//                                             </div>
//                                             )}
//                                         </div>
//                                         ))}
//                                     </div>
//                                     )}
//                                 </div>
//                                 ))}
//                             </div>
//                             )}
//                         </div>
//                         ))}
//                     </div>
//                     )}
//                 </div>
//                 ))}
//             </div>
//             )}
//         </div>
//         ))}
//     </div>
// );

// const ZonalTree = ({ tree, expanded, toggle }) => (
//     <div className="location-tree">
//         {tree.map((zone) => (
//         <div className="tree-zone" key={`zone-${zone.id}`}>
//             <div
//             className="tree-row zone-row"
//             onClick={() => toggle(`zone-${zone.id}`)}
//             >
//             <ExpandButton
//                 open={expanded.has(`zone-${zone.id}`)}
//                 onClick={() => toggle(`zone-${zone.id}`)}
//             />

//             <div className="location-symbol zone-symbol">ZONE</div>

//             <div className="location-info">
//                 <strong>{zone.name}</strong>
//                 <span>Zonal hierarchy</span>
//             </div>

//             <div className="location-count">{zone.sites.length} Sites</div>
//             </div>

//             {expanded.has(`zone-${zone.id}`) && (
//             <div className="tree-children">
//                 {Object.values(zone.circles).map((circle) => (
//                 <div key={`circle-${circle.id}`}>
//                     <div
//                     className="tree-row state-row"
//                     onClick={() => toggle(`circle-${zone.id}-${circle.id}`)}
//                     >
//                     <ExpandButton
//                         open={expanded.has(`circle-${zone.id}-${circle.id}`)}
//                         onClick={() => toggle(`circle-${zone.id}-${circle.id}`)}
//                     />

//                     <div className="location-symbol circle-symbol">CIR</div>

//                     <div className="location-info">
//                         <strong>{circle.name}</strong>
//                         <span>{zone.name}</span>
//                     </div>

//                     <div className="location-count">
//                         {circle.sites.length}
//                     </div>
//                     </div>

//                     {expanded.has(`circle-${zone.id}-${circle.id}`) && (
//                     <div className="nested-level">
//                         {Object.values(circle.regions).map((region) => (
//                         <div key={`region-${region.id}`}>
//                             <div
//                             className="tree-row circle-row"
//                             onClick={() =>
//                                 toggle(`region-${circle.id}-${region.id}`)
//                             }
//                             >
//                             <ExpandButton
//                                 open={expanded.has(
//                                 `region-${circle.id}-${region.id}`
//                                 )}
//                                 onClick={() =>
//                                 toggle(`region-${circle.id}-${region.id}`)
//                                 }
//                             />

//                             <div className="location-symbol circle-symbol">
//                                 REG
//                             </div>

//                             <div className="location-info">
//                                 <strong>{region.name}</strong>
//                                 <span>{circle.name}</span>
//                             </div>

//                             <div className="location-count">
//                                 {region.sites.length}
//                             </div>
//                             </div>

//                             {expanded.has(
//                             `region-${circle.id}-${region.id}`
//                             ) && (
//                             <div className="nested-level">
//                                 {Object.values(region.divisions).map(
//                                 (division) => (
//                                     <div key={`division-${division.id}`}>
//                                     <div
//                                         className="tree-row city-row"
//                                         onClick={() =>
//                                         toggle(
//                                             `division-${region.id}-${division.id}`
//                                         )
//                                         }
//                                     >
//                                         <ExpandButton
//                                         open={expanded.has(
//                                             `division-${region.id}-${division.id}`
//                                         )}
//                                         onClick={() =>
//                                             toggle(
//                                             `division-${region.id}-${division.id}`
//                                             )
//                                         }
//                                         />

//                                         <div className="location-symbol city-symbol">
//                                         DIV
//                                         </div>

//                                         <div className="location-info">
//                                         <strong>{division.name}</strong>
//                                         <span>{region.name}</span>
//                                         </div>

//                                         <div className="location-count">
//                                         {division.sites.length}
//                                         </div>
//                                     </div>

//                                     {expanded.has(
//                                         `division-${region.id}-${division.id}`
//                                     ) && (
//                                         <div className="nested-level">
//                                         {Object.values(
//                                             division.branches
//                                         ).map((branch) => (
//                                             <div
//                                             key={`branch-${branch.id}`}
//                                             >
//                                             <div
//                                                 className="tree-row branch-row"
//                                                 onClick={() =>
//                                                 toggle(
//                                                     `zbranch-${division.id}-${branch.id}`
//                                                 )
//                                                 }
//                                             >
//                                                 <ExpandButton
//                                                 open={expanded.has(
//                                                     `zbranch-${division.id}-${branch.id}`
//                                                 )}
//                                                 onClick={() =>
//                                                     toggle(
//                                                     `zbranch-${division.id}-${branch.id}`
//                                                     )
//                                                 }
//                                                 />

//                                                 <div className="location-symbol branch-symbol">
//                                                 BR
//                                                 </div>

//                                                 <div className="location-info">
//                                                 <strong>
//                                                     {branch.name}
//                                                 </strong>
//                                                 <span>
//                                                     {division.name}
//                                                 </span>
//                                                 </div>

//                                                 <div className="location-count">
//                                                 {branch.sites.length}
//                                                 </div>
//                                             </div>

//                                             {expanded.has(
//                                                 `zbranch-${division.id}-${branch.id}`
//                                             ) && (
//                                                 <div className="nested-level">
//                                                 {Object.values(
//                                                     branch.floors
//                                                 ).map((floor) => (
//                                                     <div
//                                                     key={`floor-${floor.id}`}
//                                                     >
//                                                     <div
//                                                         className="tree-row floor-row"
//                                                         onClick={() =>
//                                                         toggle(
//                                                             `zfloor-${branch.id}-${floor.id}`
//                                                         )
//                                                         }
//                                                     >
//                                                         <ExpandButton
//                                                         open={expanded.has(
//                                                             `zfloor-${branch.id}-${floor.id}`
//                                                         )}
//                                                         onClick={() =>
//                                                             toggle(
//                                                             `zfloor-${branch.id}-${floor.id}`
//                                                             )
//                                                         }
//                                                         />

//                                                         <div className="location-symbol floor-symbol">
//                                                         FL
//                                                         </div>

//                                                         <div className="location-info">
//                                                         <strong>
//                                                             {floor.name}
//                                                         </strong>
//                                                         <span>
//                                                             {branch.name}
//                                                         </span>
//                                                         </div>

//                                                         <div className="location-count">
//                                                         {
//                                                             floor.sites
//                                                             .length
//                                                         }
//                                                         </div>
//                                                     </div>

//                                                     {expanded.has(
//                                                         `zfloor-${branch.id}-${floor.id}`
//                                                     ) && (
//                                                         <div className="nested-level">
//                                                         {floor.sites.map(
//                                                             (site) => (
//                                                             <SiteNode
//                                                                 key={
//                                                                 site.id
//                                                                 }
//                                                                 site={site}
//                                                                 expanded={expanded.has(
//                                                                 `site-${site.id}`
//                                                                 )}
//                                                                 onToggle={
//                                                                 toggle
//                                                                 }
//                                                             />
//                                                             )
//                                                         )}
//                                                         </div>
//                                                     )}
//                                                     </div>
//                                                 ))}
//                                                 </div>
//                                             )}
//                                             </div>
//                                         ))}
//                                         </div>
//                                     )}
//                                     </div>
//                                 )
//                                 )}
//                             </div>
//                             )}
//                         </div>
//                         ))}
//                     </div>
//                     )}
//                 </div>
//                 ))}
//             </div>
//             )}
//         </div>
//         ))}
//     </div>
// );

// function Locations() {
//     const [user] = useState(getStoredUser);

//     const [sites, setSites] = useState([]);
//     const [loading, setLoading] = useState(true);
//     const [error, setError] = useState("");

//     const [hierarchy, setHierarchy] = useState("");
//     const [expanded, setExpanded] = useState(new Set());

//     const role = normalize(user?.role || user?.user_type);

//     const userHierarchy = normalize(
//         user?.customer_hierarchy_type ??
//         user?.hierarchy_type ??
//         user?.hierarchy ??
//         ""
//     );

//     const [showAddLocation, setShowAddLocation] = useState(false);
//     const [saving, setSaving] = useState(false);
//     const [saveError, setSaveError] = useState("");

//     const [formData, setFormData] = useState({
//     name: "",
//     hierarchy_type: hierarchy || "geographical",

//     state_id: "",
//     district_id: "",
//     taluka_id: "",
//     city_id: "",

//     zone_id: "",
//     circle_id: "",
//     region_id: "",
//     division_id: "",

//     branch_id: "",
//     floor_id: "",
//     });

//     const openAddLocation = () => {
//         setSaveError("");

//         setFormData({
//             name: "",
//             hierarchy_type: hierarchy || "geographical",

//             state_id: "",
//             district_id: "",
//             taluka_id: "",
//             city_id: "",

//             zone_id: "",
//             circle_id: "",
//             region_id: "",
//             division_id: "",

//             branch_id: "",
//             floor_id: "",
//         });

//         setShowAddLocation(true);
//         };

//         const closeAddLocation = () => {
//             if (saving) 
//                 return;

//         setShowAddLocation(false);
//         setSaveError("");
//     };

//     const isCustomer = role === "customer";

//     const isAdmin = role === "admin" || role === "branch_admin";

//     const isSuperAdmin =
//         role.includes("super") ||
//         role.includes("organization") ||
//         role === "org_admin";

//     useEffect(() => {
//         if (userHierarchy === "geographical") {
//         setHierarchy("geographical");
//         } else if (userHierarchy === "zonal") {
//         setHierarchy("zonal");
//         } else {

//             if (user?.state_id || user?.state || user?.state_name) {
//                 setHierarchy("geographical");
//             } else if (user?.zone_id || user?.zone || user?.zone_name) {
//                 setHierarchy("zonal");
//             } else {
//                 setHierarchy("geographical");
//             }
//         }
//     }, [userHierarchy, user]);

//     const loadSites = async () => {
//         setLoading(true);
//         setError("");

//         try {
//             const data = await fetchJSON(`${API_BASE}/sites/`);

//             const rawSites = getResults(data);

//             const normalizedSites = rawSites
//                 .map(normalizeSite)
//                 .filter((site) => site.id != null);

//             const scopedSites = normalizedSites.filter((site) =>
//                 matchesUserScope(site, user)
//             );

//             setSites(scopedSites);
//         } catch (err) {
//             console.error("Location API error:", err);
//             setError(
//                 err?.message || "Unable to load locations. Please try again."
//             );
//             setSites([]);
//         } finally {
//             setLoading(false);
//         }
//     };

//     useEffect(() => {
//         loadSites();
//     }, []);

//     const geographicalSites = useMemo( () =>
//         sites.filter(
//             (site) =>
//             normalize(site.hierarchyType) === "geographical" ||
//             hierarchy === "geographical"
//         ),[sites, hierarchy]
//     );

//     const zonalSites = useMemo( () =>
//         sites.filter(
//             (site) =>
//             normalize(site.hierarchyType) === "zonal" ||
//             hierarchy === "zonal"
//         ),[sites, hierarchy]
//     );

//     const geographicalTree = useMemo( () => 
//         buildGeographicalTree(geographicalSites),
//         [geographicalSites]
//     );

//     const zonalTree = useMemo( () => 
//         buildZonalTree(zonalSites),
//         [zonalSites]
//     );

//     const toggle = (key) => {
//         setExpanded((previous) => {
//             const next = new Set(previous);
//             if (next.has(key)) {
//                 next.delete(key);
//             } else {
//                 next.add(key);
//             }
//             return next;
//         });
//     };

//     const currentSites = hierarchy === "zonal" ? zonalSites : geographicalSites;

//     const totalACs = currentSites.reduce(
//         (total, site) =>
//         total +
//         (Array.isArray(site.acs)
//             ? site.acs.length
//             : Array.isArray(site.devices)
//             ? site.devices.length
//             : 0),
//         0
//     );

//     const totalStates = new Set(
//         geographicalSites
//         .map((site) => site.stateId || normalize(site.stateName))
//         .filter(Boolean)
//     ).size;

//     const totalZones = new Set(
//         zonalSites
//         .map((site) => site.zoneId || normalize(site.zoneName))
//         .filter(Boolean)
//     ).size;

//     if (loading) {
//         return (
//         <div className="locations-page">
//             <div className="locations-loading">
//             <div className="loading-spinner" />
//             <span>Loading Sites...</span>
//             </div>
//         </div>
//         );
//     }

//     return (
//         <div className="locations-page">
//             <div className="locations-header">
//                 <div>
//                     <h1>Locations</h1>

//                     <p>
//                     {isCustomer
//                         ? "Sites available under your customer hierarchy"
//                         : isAdmin
//                         ? "Sites available under your assigned hierarchy"
//                         : "Manage locations and registered AC sites"}
//                     </p>
//                 </div>

//                 <div className="header-actions">
//                     <button
//                     type="button"
//                     className="refresh-btn"
//                     onClick={loadSites}
//                     >
//                     ↻ Refresh
//                     </button>

//                     {(isCustomer || isAdmin || isSuperAdmin) && (
//                     <button
//                         type="button"
//                         className="add-location-btn"
//                         onClick={openAddLocation}
//                     >
//                         <span>+</span>
//                         Add Location
//                     </button>
//                     )}
//                 </div>
//             </div>

//         {!isCustomer && (
//             <div className="hierarchy-switch">
//             <button
//                 type="button"
//                 className={`hierarchy-tab ${
//                 hierarchy === "geographical" ? "active" : ""
//                 }`}
//                 onClick={() => setHierarchy("geographical")}
//             >
//                 Geographical
//             </button>

//             <button
//                 type="button"
//                 className={`hierarchy-tab ${
//                 hierarchy === "zonal" ? "active" : ""
//                 }`}
//                 onClick={() => setHierarchy("zonal")}
//             >
//                 Zonal
//             </button>
//             </div>
//         )}

//         <div className="hierarchy-description">
//             <strong>
//             {hierarchy === "zonal"
//                 ? "Zonal Site Hierarchy"
//                 : "Geographical Site Hierarchy"}
//             </strong>

//             <span>
//             {hierarchy === "zonal"
//                 ? "Zone → Circle → Region → Division → Branch → Floor → Site"
//                 : "State → District → Taluka → City → Branch → Floor → Site"}
//             </span>
//         </div>

//         <div className="location-summary">
//             <div className="summary-card">
//             <div className="summary-icon zone-icon">
//                 {hierarchy === "zonal" ? "Z" : "S"}
//             </div>

//             <div>
//                 <span>{hierarchy === "zonal" ? "Zones" : "States"}</span>

//                 <strong>
//                 {hierarchy === "zonal" ? totalZones : totalStates}
//                 </strong>
//             </div>
//             </div>

//             <div className="summary-card">
//             <div className="summary-icon state-icon">SITE</div>

//             <div>
//                 <span>Sites</span>
//                 <strong>{currentSites.length}</strong>
//             </div>
//             </div>

//             <div className="summary-card">
//             <div className="summary-icon circle-icon">BR</div>

//             <div>
//                 <span>Branches</span>

//                 <strong>
//                 {
//                     new Set(
//                     currentSites
//                         .map(
//                         (site) =>
//                             site.branchId || normalize(site.branchName)
//                         )
//                         .filter(Boolean)
//                     ).size
//                 }
//                 </strong>
//             </div>
//             </div>

//             <div className="summary-card">
//             <div className="summary-icon ac-icon">AC</div>

//             <div>
//                 <span>Registered ACs</span>
//                 <strong>{totalACs}</strong>
//             </div>
//             </div>
//         </div>

//         <div className="api-status">
//             <div className="status-dot" />

//             <span>
//             Showing registered Sites from your permitted hierarchy
//             </span>

//             <code>
//             {isCustomer
//                 ? `CUSTOMER • ${
//                     user?.customer_name ||
//                     user?.customer?.name ||
//                     user?.scope_name ||
//                     "Current Customer"
//                 }`
//                 : isAdmin
//                 ? `ADMIN • ${
//                     user?.scope_name ||
//                     user?.state_name ||
//                     user?.zone_name ||
//                     "Assigned Scope"
//                 }`
//                 : "SUPER ADMIN"}
//             </code>
//         </div>

//         {error && (
//             <div className="location-error">
//             <h3>Unable to load locations</h3>
//             <p>{error}</p>

//             <button type="button" onClick={loadSites}>
//                 Retry
//             </button>
//             </div>
//         )}

//         {!error && currentSites.length === 0 && (
//             <div className="empty-location">
//             <h3>No sites found</h3>

//             <p>
//                 No registered sites are available under the current user's
//                 hierarchy.
//             </p>
//             </div>
//         )}

//         {!error &&
//             currentSites.length > 0 &&
//             hierarchy === "geographical" && (
//             <GeographicalTree
//                 tree={geographicalTree}
//                 expanded={expanded}
//                 toggle={toggle}
//             />
//             )}

//         {!error && currentSites.length > 0 && hierarchy === "zonal" && (
//             <ZonalTree
//             tree={zonalTree}
//             expanded={expanded}
//             toggle={toggle}
//             />
//         )}
//         </div>
//     );
// };

// export default Locations;


import React, { useEffect, useMemo, useState } from "react";
import "./Locations.css";

const API_BASE = "http://localhost:8000/api";

const EMPTY_FORM = {
    name: "",
    hierarchy_type: "geographical",

    state_id: "", state_name: "", state_code: "",
    district_id: "", district_name: "", district_code: "",
    taluka_id: "", taluka_name: "", taluka_code: "",
    city_id: "", city_name: "",

    zone_id: "", zone_name: "", zone_code: "",
    circle_id: "", circle_name: "", circle_code: "",
    region_id: "", region_name: "", region_code: "",
    division_id: "", division_name: "", division_code: "",

    branch_id: "", branch_name: "", branch_code: "",
    floor_id: "", floor_name: "",

    room_id: "", room_name: "",
};

const GEO_LOCATION_TYPES = [
    { value: "state", label: "State" },
    { value: "district", label: "District" },
    { value: "taluka", label: "Taluka" },
    { value: "city", label: "City" },
    { value: "branch", label: "Branch" },
    { value: "floor", label: "Floor" },
    { value: "room", label: "Room" },
];

const ZONAL_LOCATION_TYPES = [
    { value: "zone", label: "Zone" },
    { value: "circle", label: "Circle" },
    { value: "region", label: "Region" },
    { value: "division", label: "Division" },
    { value: "branch", label: "Branch" },
    { value: "floor", label: "Floor" },
    { value: "room", label: "Room" },
];

// ---------------------------------------------------------------
// Storage / auth helpers
// ---------------------------------------------------------------
const getToken = () =>
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("accessToken");

const getStoredUser = () => {
    try {
        const raw =
            localStorage.getItem("rbac_auth_user") ||
            localStorage.getItem("user") ||
            localStorage.getItem("currentUser");
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
};

const authHeaders = () => {
    const token = getToken();
    return {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Token ${token}` } : {}),
    };
};

// ---------------------------------------------------------------
// Generic value helpers
// ---------------------------------------------------------------
const normalize = (value) =>
    String(value ?? "").trim().toLowerCase();

const getId = (obj) =>
    obj?.id ?? obj?.pk ?? obj?.uuid ?? obj?.value ??
    obj?.customer_id ?? obj?.state_id ?? obj?.zone_id ?? null;

const getName = (obj, fallback = "Unnamed") =>
    obj?.name ?? obj?.title ?? obj?.label ??
    obj?.state_name ?? obj?.zone_name ?? obj?.city_name ??
    obj?.branch_name ?? obj?.floor_name ?? obj?.site_name ?? fallback;

const getResults = (data) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.results)) return data.results;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.sites)) return data.sites;
    return [];
};

const fetchJSON = async (url) => {
    const response = await fetch(url, { headers: authHeaders() });
    if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
    return response.json();
};

// ---------------------------------------------------------------
// Normalizers
// ---------------------------------------------------------------
const normalizeSite = (site) => ({
    ...site,
    id: getId(site),
    name: getName(site, `Site ${getId(site) || ""}`),

    customerId: site.customer_id ?? site.customer?.id ?? site.customer ?? null,
    customerName: site.customer_name ?? site.customer?.name ?? "",

    hierarchyType: site.hierarchy_type ?? site.customer_hierarchy_type ?? site.hierarchy ?? "",

    stateId: site.state_id ?? site.state?.id ?? site.city?.state_id ?? null,
    stateName: site.state_name ?? site.state?.name ?? "",

    districtId: site.district_id ?? site.district?.id ?? null,
    districtName: site.district_name ?? site.district?.name ?? "",

    talukaId: site.taluka_id ?? site.taluka?.id ?? null,
    talukaName: site.taluka_name ?? site.taluka?.name ?? "",

    cityId: site.city_id ?? site.city?.id ?? null,
    cityName: site.city_name ?? site.city?.name ?? "",

    zoneId: site.zone_id ?? site.zone?.id ?? null,
    zoneName: site.zone_name ?? site.zone?.name ?? "",

    circleId: site.circle_id ?? site.circle?.id ?? null,
    circleName: site.circle_name ?? site.circle?.name ?? "",

    regionId: site.region_id ?? site.region?.id ?? null,
    regionName: site.region_name ?? site.region?.name ?? "",

    divisionId: site.division_id ?? site.division?.id ?? null,
    divisionName: site.division_name ?? site.division?.name ?? "",

    branchId: site.branch_id ?? site.branch?.id ?? null,
    branchName: site.branch_name ?? site.branch?.name ?? "",

    floorId: site.floor_id ?? site.floor?.id ?? null,
    floorName: site.floor_name ?? site.floor?.name ?? "",

    adminId: site.admin_id ?? site.admin?.id ?? null,
    adminName: site.admin_name ?? site.admin?.name ?? "",

    acs: site.acs ?? site.devices ?? site.ac_devices ?? [],
});

const normalizeAC = (ac) => ({
    ...ac,
    id: getId(ac),
    name: ac.ac_id ?? ac.device_name ?? ac.name ?? `AC ${getId(ac) || ""}`,
    status: String(ac.status ?? ac.state ?? "OFF").toUpperCase(),
});

// ---------------------------------------------------------------
// Scope matching
// ---------------------------------------------------------------
const matchesUserScope = (site, user) => {
    const role = normalize(user?.role || user?.user_type);

    if (role.includes("super") || role.includes("organization") || role === "org_admin") {
        return true;
    }

    if (role === "customer") {
        const userCustomerId =
            user?.customer_id ?? user?.customer?.id ?? user?.customer ?? user?.scope_id ?? null;
        const userCustomerName =
            user?.customer_name ?? user?.customer?.name ?? user?.scope_name ?? "";

        const customerIdMatches =
            userCustomerId != null &&
            site.customerId != null &&
            String(userCustomerId) === String(site.customerId);

        const customerNameMatches =
            normalize(userCustomerName) &&
            normalize(site.customerName) &&
            normalize(userCustomerName) === normalize(site.customerName);

        return customerIdMatches || customerNameMatches;
    }

    if (role === "admin" || role === "branch_admin") {
        const assignedHierarchy =
            user?.hierarchy_type ?? user?.customer_hierarchy_type ?? user?.hierarchy ?? "";

        const stateId = user?.state_id ?? user?.state?.id ?? user?.scope_id ?? null;
        const stateName = user?.state_name ?? user?.state?.name ?? user?.scope_name ?? "";
        const zoneId = user?.zone_id ?? user?.zone?.id ?? user?.scope_id ?? null;
        const zoneName = user?.zone_name ?? user?.zone?.name ?? user?.scope_name ?? "";

        if (normalize(assignedHierarchy) === "geographical") {
            if (stateId != null && site.stateId != null && String(stateId) === String(site.stateId)) return true;
            if (normalize(stateName) && normalize(stateName) === normalize(site.stateName)) return true;
            return false;
        }

        if (normalize(assignedHierarchy) === "zonal") {
            if (zoneId != null && site.zoneId != null && String(zoneId) === String(site.zoneId)) return true;
            if (normalize(zoneName) && normalize(zoneName) === normalize(site.zoneName)) return true;
            return false;
        }

        if (stateId != null && site.stateId != null && String(stateId) === String(site.stateId)) return true;
        if (zoneId != null && site.zoneId != null && String(zoneId) === String(site.zoneId)) return true;
        return false;
    }

    return true;
};

// ---------------------------------------------------------------
// Tree builders
// ---------------------------------------------------------------
const buildGeographicalTree = (sites) => {
    const states = {};

    sites.forEach((site) => {
        const stateKey = site.stateId ?? (normalize(site.stateName) || "unknown-state");
        if (!states[stateKey]) {
            states[stateKey] = {
                id: stateKey,
                name: site.stateName || "Unknown State",
                districts: {},
                sites: [],
            };
        }
        const state = states[stateKey];

        const districtKey = site.districtId ?? (normalize(site.districtName) || "unknown-district");
        if (!state.districts[districtKey]) {
            state.districts[districtKey] = {
                id: districtKey,
                name: site.districtName || "Unknown District",
                talukas: {},
                sites: [],
            };
        }
        const district = state.districts[districtKey];

        const talukaKey = site.talukaId ?? (normalize(site.talukaName) || "unknown-taluka");
        if (!district.talukas[talukaKey]) {
            district.talukas[talukaKey] = {
                id: talukaKey,
                name: site.talukaName || "Unknown Taluka",
                cities: {},
                sites: [],
            };
        }
        const taluka = district.talukas[talukaKey];

        const cityKey = site.cityId ?? (normalize(site.cityName) || "unknown-city");
        if (!taluka.cities[cityKey]) {
            taluka.cities[cityKey] = {
                id: cityKey,
                name: site.cityName || "Unknown City",
                branches: {},
                sites: [],
            };
        }
        const city = taluka.cities[cityKey];

        const branchKey = site.branchId ?? (normalize(site.branchName) || "unknown-branch");
        if (!city.branches[branchKey]) {
            city.branches[branchKey] = {
                id: branchKey,
                name: site.branchName || "Unknown Branch",
                floors: {},
                sites: [],
            };
        }
        const branch = city.branches[branchKey];

        const floorKey = site.floorId ?? (normalize(site.floorName) || "unknown-floor");
        if (!branch.floors[floorKey]) {
            branch.floors[floorKey] = {
                id: floorKey,
                name: site.floorName || "Unknown Floor",
                sites: [],
            };
        }

        branch.floors[floorKey].sites.push(site);
        branch.sites.push(site);
        city.sites.push(site);
        taluka.sites.push(site);
        district.sites.push(site);
        state.sites.push(site);
    });

    return Object.values(states);
};

const buildZonalTree = (sites) => {
    const zones = {};

    sites.forEach((site) => {
        const zoneKey = site.zoneId ?? (normalize(site.zoneName) || "unknown-zone");
        if (!zones[zoneKey]) {
            zones[zoneKey] = {
                id: zoneKey,
                name: site.zoneName || "Unknown Zone",
                circles: {},
                sites: [],
            };
        }
        const zone = zones[zoneKey];

        const circleKey = site.circleId ?? (normalize(site.circleName) || "unknown-circle");
        if (!zone.circles[circleKey]) {
            zone.circles[circleKey] = {
                id: circleKey,
                name: site.circleName || "Unknown Circle",
                regions: {},
                sites: [],
            };
        }
        const circle = zone.circles[circleKey];

        const regionKey = site.regionId ?? (normalize(site.regionName) || "unknown-region");
        if (!circle.regions[regionKey]) {
            circle.regions[regionKey] = {
                id: regionKey,
                name: site.regionName || "Unknown Region",
                divisions: {},
                sites: [],
            };
        }
        const region = circle.regions[regionKey];

        const divisionKey = site.divisionId ?? (normalize(site.divisionName) || "unknown-division");
        if (!region.divisions[divisionKey]) {
            region.divisions[divisionKey] = {
                id: divisionKey,
                name: site.divisionName || "Unknown Division",
                branches: {},
                sites: [],
            };
        }
        const division = region.divisions[divisionKey];

        const branchKey = site.branchId ?? (normalize(site.branchName) || "unknown-branch");
        if (!division.branches[branchKey]) {
            division.branches[branchKey] = {
                id: branchKey,
                name: site.branchName || "Unknown Branch",
                floors: {},
                sites: [],
            };
        }
        const branch = division.branches[branchKey];

        const floorKey = site.floorId ?? (normalize(site.floorName) || "unknown-floor");
        if (!branch.floors[floorKey]) {
            branch.floors[floorKey] = {
                id: floorKey,
                name: site.floorName || "Unknown Floor",
                sites: [],
            };
        }

        branch.floors[floorKey].sites.push(site);
        branch.sites.push(site);
        division.sites.push(site);
        region.sites.push(site);
        circle.sites.push(site);
        zone.sites.push(site);
    });

    return Object.values(zones);
};

// ---------------------------------------------------------------
// Tree → option helpers (used by Add Location modal)
// ---------------------------------------------------------------
const flatStates = (tree) => tree.map((s) => ({ id: s.id, name: s.name }));

const flatDistricts = (tree, stateId) => {
    const state = tree.find((s) => String(s.id) === String(stateId));
    return state ? Object.values(state.districts).map((d) => ({ id: d.id, name: d.name })) : [];
};

const flatTalukas = (tree, stateId, districtId) => {
    const state = tree.find((s) => String(s.id) === String(stateId));
    if (!state) return [];
    const district = Object.values(state.districts).find((d) => String(d.id) === String(districtId));
    return district ? Object.values(district.talukas).map((t) => ({ id: t.id, name: t.name })) : [];
};

const flatCities = (tree, stateId, districtId, talukaId) => {
    const state = tree.find((s) => String(s.id) === String(stateId));
    if (!state) return [];
    const district = Object.values(state.districts).find((d) => String(d.id) === String(districtId));
    if (!district) return [];
    const taluka = Object.values(district.talukas).find((t) => String(t.id) === String(talukaId));
    return taluka ? Object.values(taluka.cities).map((c) => ({ id: c.id, name: c.name })) : [];
};

const flatGeoBranches = (tree) => {
    const branches = [];
    tree.forEach((state) => {
        Object.values(state.districts).forEach((district) => {
            Object.values(district.talukas).forEach((taluka) => {
                Object.values(taluka.cities).forEach((city) => {
                    Object.values(city.branches).forEach((branch) => {
                        branches.push({
                            ...branch,
                            path: [state.name, district.name, taluka.name, city.name].join(" › "),
                        });
                    });
                });
            });
        });
    });
    return branches;
};

const flatGeoFloors = (tree) => {
    const floors = [];
    flatGeoBranches(tree).forEach((branch) => {
        Object.values(branch.floors || {}).forEach((floor) => {
            floors.push({ ...floor, path: branch.path + " › " + branch.name });
        });
    });
    return floors;
};

const flatZones = (tree) => tree.map((z) => ({ id: z.id, name: z.name }));

const flatCircles = (tree, zoneId) => {
    const zone = tree.find((z) => String(z.id) === String(zoneId));
    return zone ? Object.values(zone.circles).map((c) => ({ id: c.id, name: c.name })) : [];
};

const flatRegions = (tree, zoneId, circleId) => {
    const zone = tree.find((z) => String(z.id) === String(zoneId));
    if (!zone) return [];
    const circle = Object.values(zone.circles).find((c) => String(c.id) === String(circleId));
    return circle ? Object.values(circle.regions).map((r) => ({ id: r.id, name: r.name })) : [];
};

const flatDivisions = (tree, zoneId, circleId, regionId) => {
    const zone = tree.find((z) => String(z.id) === String(zoneId));
    if (!zone) return [];
    const circle = Object.values(zone.circles).find((c) => String(c.id) === String(circleId));
    if (!circle) return [];
    const region = Object.values(circle.regions).find((r) => String(r.id) === String(regionId));
    return region ? Object.values(region.divisions).map((d) => ({ id: d.id, name: d.name })) : [];
};

const flatZonalBranches = (tree) => {
    const branches = [];
    tree.forEach((zone) => {
        Object.values(zone.circles).forEach((circle) => {
            Object.values(circle.regions).forEach((region) => {
                Object.values(region.divisions).forEach((division) => {
                    Object.values(division.branches).forEach((branch) => {
                        branches.push({
                            ...branch,
                            path: [zone.name, circle.name, region.name, division.name].join(" › "),
                        });
                    });
                });
            });
        });
    });
    return branches;
};

const flatZonalFloors = (tree) => {
    const floors = [];
    flatZonalBranches(tree).forEach((branch) => {
        Object.values(branch.floors || {}).forEach((floor) => {
            floors.push({ ...floor, path: branch.path + " › " + branch.name });
        });
    });
    return floors;
};

// ---------------------------------------------------------------
// Reusable form fields
// ---------------------------------------------------------------
const LocationTextField = ({ label, placeholder, value, onChange }) => (
    <div className="form-group">
        <label>{label}</label>
        <input
            type="text"
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
        />
    </div>
);

const SelectField = ({ label, value, onChange, options = [], disabled = false }) => (
    <div className="form-group">
        <label>{label}</label>
        <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
            <option value="">Select {label}</option>
            {options.map((opt, index) => (
                <option key={opt.id ?? index} value={opt.id}>
                    {opt.name}
                </option>
            ))}
        </select>
    </div>
);

// ---------------------------------------------------------------
// Tree UI atoms
// ---------------------------------------------------------------
const ExpandButton = ({ open, onClick }) => (
    <button
        type="button"
        className="expand-btn"
        onClick={(e) => {
            e.stopPropagation();
            onClick();
        }}
    >
        {open ? "−" : "+"}
    </button>
);

const SiteNode = ({ site, expanded, onToggle }) => {
    const acs = (site.acs || []).map(normalizeAC);

    return (
        <div>
            <div className="tree-row room-row" onClick={() => onToggle(`site-${site.id}`)}>
                <ExpandButton open={expanded} onClick={() => onToggle(`site-${site.id}`)} />
                <div className="location-symbol room-symbol">SITE</div>
                <div className="location-info">
                    <strong>{site.name}</strong>
                    <span>
                        {site.branchName || "Site"} {site.floorName ? `• ${site.floorName}` : ""}
                    </span>
                </div>
                <div className="location-count">
                    {acs.length} AC{acs.length !== 1 ? "s" : ""}
                </div>
            </div>

            {expanded && acs.length > 0 && (
                <div className="ac-list">
                    {acs.map((ac) => (
                        <div className="ac-item" key={ac.id || ac.name}>
                            <div className="ac-dot" />
                            <div className="ac-info">
                                <strong>{ac.name}</strong>
                                <span>{site.name}</span>
                            </div>
                            <div className={`ac-status ${ac.status === "ON" ? "on" : "off"}`}>
                                {ac.status}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {expanded && acs.length === 0 && (
                <div className="ac-list">
                    <div className="ac-item">
                        <div className="ac-info">
                            <span>No registered ACs</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ---------------------------------------------------------------
// Tree renderers
// ---------------------------------------------------------------
const GeographicalTree = ({ tree, expanded, toggle }) => (
    <div className="location-tree">
        {tree.map((state) => (
            <div className="tree-zone" key={`state-${state.id}`}>
                <div className="tree-row zone-row" onClick={() => toggle(`state-${state.id}`)}>
                    <ExpandButton open={expanded.has(`state-${state.id}`)} onClick={() => toggle(`state-${state.id}`)} />
                    <div className="location-symbol state-symbol">STATE</div>
                    <div className="location-info">
                        <strong>{state.name}</strong>
                        <span>Geographical hierarchy</span>
                    </div>
                    <div className="location-count">{state.sites.length} Sites</div>
                </div>

                {expanded.has(`state-${state.id}`) && (
                    <div className="tree-children">
                        {Object.values(state.districts).map((district) => (
                            <div key={`district-${district.id}`}>
                                <div
                                    className="tree-row state-row"
                                    onClick={() => toggle(`district-${state.id}-${district.id}`)}
                                >
                                    <ExpandButton
                                        open={expanded.has(`district-${state.id}-${district.id}`)}
                                        onClick={() => toggle(`district-${state.id}-${district.id}`)}
                                    />
                                    <div className="location-symbol state-symbol">DIST</div>
                                    <div className="location-info">
                                        <strong>{district.name}</strong>
                                        <span>{state.name}</span>
                                    </div>
                                    <div className="location-count">{district.sites.length}</div>
                                </div>

                                {expanded.has(`district-${state.id}-${district.id}`) && (
                                    <div className="nested-level">
                                        {Object.values(district.talukas).map((taluka) => (
                                            <div key={`taluka-${taluka.id}`}>
                                                <div
                                                    className="tree-row circle-row"
                                                    onClick={() => toggle(`taluka-${district.id}-${taluka.id}`)}
                                                >
                                                    <ExpandButton
                                                        open={expanded.has(`taluka-${district.id}-${taluka.id}`)}
                                                        onClick={() => toggle(`taluka-${district.id}-${taluka.id}`)}
                                                    />
                                                    <div className="location-symbol circle-symbol">TAL</div>
                                                    <div className="location-info">
                                                        <strong>{taluka.name}</strong>
                                                        <span>{district.name}</span>
                                                    </div>
                                                    <div className="location-count">{taluka.sites.length}</div>
                                                </div>

                                                {expanded.has(`taluka-${district.id}-${taluka.id}`) && (
                                                    <div className="nested-level">
                                                        {Object.values(taluka.cities).map((city) => (
                                                            <div key={`city-${city.id}`}>
                                                                <div
                                                                    className="tree-row city-row"
                                                                    onClick={() => toggle(`city-${taluka.id}-${city.id}`)}
                                                                >
                                                                    <ExpandButton
                                                                        open={expanded.has(`city-${taluka.id}-${city.id}`)}
                                                                        onClick={() => toggle(`city-${taluka.id}-${city.id}`)}
                                                                    />
                                                                    <div className="location-symbol city-symbol">CITY</div>
                                                                    <div className="location-info">
                                                                        <strong>{city.name}</strong>
                                                                        <span>{taluka.name}</span>
                                                                    </div>
                                                                    <div className="location-count">{city.sites.length}</div>
                                                                </div>

                                                                {expanded.has(`city-${taluka.id}-${city.id}`) && (
                                                                    <div className="nested-level">
                                                                        {Object.values(city.branches).map((branch) => (
                                                                            <div key={`branch-${branch.id}`}>
                                                                                <div
                                                                                    className="tree-row branch-row"
                                                                                    onClick={() => toggle(`branch-${city.id}-${branch.id}`)}
                                                                                >
                                                                                    <ExpandButton
                                                                                        open={expanded.has(`branch-${city.id}-${branch.id}`)}
                                                                                        onClick={() => toggle(`branch-${city.id}-${branch.id}`)}
                                                                                    />
                                                                                    <div className="location-symbol branch-symbol">BR</div>
                                                                                    <div className="location-info">
                                                                                        <strong>{branch.name}</strong>
                                                                                        <span>{city.name}</span>
                                                                                    </div>
                                                                                    <div className="location-count">{branch.sites.length}</div>
                                                                                </div>

                                                                                {expanded.has(`branch-${city.id}-${branch.id}`) && (
                                                                                    <div className="nested-level">
                                                                                        {Object.values(branch.floors).map((floor) => (
                                                                                            <div key={`floor-${floor.id}`}>
                                                                                                <div
                                                                                                    className="tree-row floor-row"
                                                                                                    onClick={() => toggle(`floor-${branch.id}-${floor.id}`)}
                                                                                                >
                                                                                                    <ExpandButton
                                                                                                        open={expanded.has(`floor-${branch.id}-${floor.id}`)}
                                                                                                        onClick={() => toggle(`floor-${branch.id}-${floor.id}`)}
                                                                                                    />
                                                                                                    <div className="location-symbol floor-symbol">FL</div>
                                                                                                    <div className="location-info">
                                                                                                        <strong>{floor.name}</strong>
                                                                                                        <span>{branch.name}</span>
                                                                                                    </div>
                                                                                                    <div className="location-count">{floor.sites.length}</div>
                                                                                                </div>

                                                                                                {expanded.has(`floor-${branch.id}-${floor.id}`) && (
                                                                                                    <div className="nested-level">
                                                                                                        {floor.sites.map((site) => (
                                                                                                            <SiteNode
                                                                                                                key={site.id}
                                                                                                                site={site}
                                                                                                                expanded={expanded.has(`site-${site.id}`)}
                                                                                                                onToggle={toggle}
                                                                                                            />
                                                                                                        ))}
                                                                                                    </div>
                                                                                                )}
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        ))}
    </div>
);

const ZonalTree = ({ tree, expanded, toggle }) => (
    <div className="location-tree">
        {tree.map((zone) => (
            <div className="tree-zone" key={`zone-${zone.id}`}>
                <div className="tree-row zone-row" onClick={() => toggle(`zone-${zone.id}`)}>
                    <ExpandButton open={expanded.has(`zone-${zone.id}`)} onClick={() => toggle(`zone-${zone.id}`)} />
                    <div className="location-symbol zone-symbol">ZONE</div>
                    <div className="location-info">
                        <strong>{zone.name}</strong>
                        <span>Zonal hierarchy</span>
                    </div>
                    <div className="location-count">{zone.sites.length} Sites</div>
                </div>

                {expanded.has(`zone-${zone.id}`) && (
                    <div className="tree-children">
                        {Object.values(zone.circles).map((circle) => (
                            <div key={`circle-${circle.id}`}>
                                <div
                                    className="tree-row state-row"
                                    onClick={() => toggle(`circle-${zone.id}-${circle.id}`)}
                                >
                                    <ExpandButton
                                        open={expanded.has(`circle-${zone.id}-${circle.id}`)}
                                        onClick={() => toggle(`circle-${zone.id}-${circle.id}`)}
                                    />
                                    <div className="location-symbol circle-symbol">CIR</div>
                                    <div className="location-info">
                                        <strong>{circle.name}</strong>
                                        <span>{zone.name}</span>
                                    </div>
                                    <div className="location-count">{circle.sites.length}</div>
                                </div>

                                {expanded.has(`circle-${zone.id}-${circle.id}`) && (
                                    <div className="nested-level">
                                        {Object.values(circle.regions).map((region) => (
                                            <div key={`region-${region.id}`}>
                                                <div
                                                    className="tree-row circle-row"
                                                    onClick={() => toggle(`region-${circle.id}-${region.id}`)}
                                                >
                                                    <ExpandButton
                                                        open={expanded.has(`region-${circle.id}-${region.id}`)}
                                                        onClick={() => toggle(`region-${circle.id}-${region.id}`)}
                                                    />
                                                    <div className="location-symbol circle-symbol">REG</div>
                                                    <div className="location-info">
                                                        <strong>{region.name}</strong>
                                                        <span>{circle.name}</span>
                                                    </div>
                                                    <div className="location-count">{region.sites.length}</div>
                                                </div>

                                                {expanded.has(`region-${circle.id}-${region.id}`) && (
                                                    <div className="nested-level">
                                                        {Object.values(region.divisions).map((division) => (
                                                            <div key={`division-${division.id}`}>
                                                                <div
                                                                    className="tree-row city-row"
                                                                    onClick={() => toggle(`division-${region.id}-${division.id}`)}
                                                                >
                                                                    <ExpandButton
                                                                        open={expanded.has(`division-${region.id}-${division.id}`)}
                                                                        onClick={() => toggle(`division-${region.id}-${division.id}`)}
                                                                    />
                                                                    <div className="location-symbol city-symbol">DIV</div>
                                                                    <div className="location-info">
                                                                        <strong>{division.name}</strong>
                                                                        <span>{region.name}</span>
                                                                    </div>
                                                                    <div className="location-count">{division.sites.length}</div>
                                                                </div>

                                                                {expanded.has(`division-${region.id}-${division.id}`) && (
                                                                    <div className="nested-level">
                                                                        {Object.values(division.branches).map((branch) => (
                                                                            <div key={`branch-${branch.id}`}>
                                                                                <div
                                                                                    className="tree-row branch-row"
                                                                                    onClick={() => toggle(`zbranch-${division.id}-${branch.id}`)}
                                                                                >
                                                                                    <ExpandButton
                                                                                        open={expanded.has(`zbranch-${division.id}-${branch.id}`)}
                                                                                        onClick={() => toggle(`zbranch-${division.id}-${branch.id}`)}
                                                                                    />
                                                                                    <div className="location-symbol branch-symbol">BR</div>
                                                                                    <div className="location-info">
                                                                                        <strong>{branch.name}</strong>
                                                                                        <span>{division.name}</span>
                                                                                    </div>
                                                                                    <div className="location-count">{branch.sites.length}</div>
                                                                                </div>

                                                                                {expanded.has(`zbranch-${division.id}-${branch.id}`) && (
                                                                                    <div className="nested-level">
                                                                                        {Object.values(branch.floors).map((floor) => (
                                                                                            <div key={`floor-${floor.id}`}>
                                                                                                <div
                                                                                                    className="tree-row floor-row"
                                                                                                    onClick={() => toggle(`zfloor-${branch.id}-${floor.id}`)}
                                                                                                >
                                                                                                    <ExpandButton
                                                                                                        open={expanded.has(`zfloor-${branch.id}-${floor.id}`)}
                                                                                                        onClick={() => toggle(`zfloor-${branch.id}-${floor.id}`)}
                                                                                                    />
                                                                                                    <div className="location-symbol floor-symbol">FL</div>
                                                                                                    <div className="location-info">
                                                                                                        <strong>{floor.name}</strong>
                                                                                                        <span>{branch.name}</span>
                                                                                                    </div>
                                                                                                    <div className="location-count">{floor.sites.length}</div>
                                                                                                </div>

                                                                                                {expanded.has(`zfloor-${branch.id}-${floor.id}`) && (
                                                                                                    <div className="nested-level">
                                                                                                        {floor.sites.map((site) => (
                                                                                                            <SiteNode
                                                                                                                key={site.id}
                                                                                                                site={site}
                                                                                                                expanded={expanded.has(`site-${site.id}`)}
                                                                                                                onToggle={toggle}
                                                                                                            />
                                                                                                        ))}
                                                                                                    </div>
                                                                                                )}
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        ))}
    </div>
);

// ---------------------------------------------------------------
// Main component
// ---------------------------------------------------------------
function Locations() {
    const [user] = useState(getStoredUser);

    const [sites, setSites] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [hierarchy, setHierarchy] = useState("");
    const [expanded, setExpanded] = useState(new Set());

    const [showAddLocation, setShowAddLocation] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState("");
    const [formData, setFormData] = useState(EMPTY_FORM);

    const role = normalize(user?.role || user?.user_type);

    const userHierarchy = normalize(
        user?.customer_hierarchy_type ??
            user?.hierarchy_type ??
            user?.hierarchy ??
            ""
    );

    const isCustomer = role === "customer";
    const isAdmin = role === "admin" || role === "branch_admin";
    const isSuperAdmin =
        role.includes("super") || role.includes("organization") || role === "org_admin";

    // Resolve default hierarchy
    useEffect(() => {
        if (userHierarchy === "geographical") setHierarchy("geographical");
        else if (userHierarchy === "zonal") setHierarchy("zonal");
        else if (user?.state_id || user?.state || user?.state_name) setHierarchy("geographical");
        else if (user?.zone_id || user?.zone || user?.zone_name) setHierarchy("zonal");
        else setHierarchy("geographical");
    }, [userHierarchy, user]);

    // Load sites
    const loadSites = async () => {
        setLoading(true);
        setError("");

        try {
            const data = await fetchJSON(`${API_BASE}/sites/`);
            const rawSites = getResults(data);
            const normalizedSites = rawSites.map(normalizeSite).filter((site) => site.id != null);
            const scopedSites = normalizedSites.filter((site) => matchesUserScope(site, user));
            setSites(scopedSites);
        } catch (err) {
            console.error("Location API error:", err);
            setError(err?.message || "Unable to load locations. Please try again.");
            setSites([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSites();
    }, []);

    const geographicalSites = useMemo(
        () =>
            sites.filter(
                (site) =>
                    normalize(site.hierarchyType) === "geographical" || hierarchy === "geographical"
            ),
        [sites, hierarchy]
    );

    const zonalSites = useMemo(
        () =>
            sites.filter(
                (site) => normalize(site.hierarchyType) === "zonal" || hierarchy === "zonal"
            ),
        [sites, hierarchy]
    );

    const geographicalTree = useMemo(
        () => buildGeographicalTree(geographicalSites),
        [geographicalSites]
    );

    const zonalTree = useMemo(() => buildZonalTree(zonalSites), [zonalSites]);

    const toggle = (key) => {
        setExpanded((previous) => {
            const next = new Set(previous);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const currentSites = hierarchy === "zonal" ? zonalSites : geographicalSites;
    const isGeo = hierarchy === "geographical";

    const totalACs = currentSites.reduce(
        (total, site) =>
            total +
            (Array.isArray(site.acs) ? site.acs.length : Array.isArray(site.devices) ? site.devices.length : 0),
        0
    );

    const totalStates = new Set(
        geographicalSites.map((site) => site.stateId || normalize(site.stateName)).filter(Boolean)
    ).size;

    const totalZones = new Set(
        zonalSites.map((site) => site.zoneId || normalize(site.zoneName)).filter(Boolean)
    ).size;

    // ---------------------------------------------------------------
    // Add Location modal
    // ---------------------------------------------------------------
    const activeTree = isGeo ? geographicalTree : zonalTree;

    const locationTypeOptions = isGeo ? GEO_LOCATION_TYPES : ZONAL_LOCATION_TYPES;

    const handleFieldChange = (field, value) =>
        setFormData((prev) => ({ ...prev, [field]: value }));

    const openAddLocation = () => {
        setSaveError("");
        setFormData({
            ...EMPTY_FORM,
            hierarchy_type: hierarchy || "geographical",
            location_type: isGeo ? "state" : "zone",
        });
        setShowAddLocation(true);
    };

    const closeAddLocation = () => {
        if (saving) return;
        setShowAddLocation(false);
        setSaveError("");
    };

    const submitAddLocation = (event) => {
        event.preventDefault();

        // Local-only demo: log what would be sent to the API.
        console.log("Location to create:", { hierarchy, formData });
        // TODO: POST to backend and then loadSites();
    };

    if (loading) {
        return (
            <div className="locations-page">
                <div className="locations-loading">
                    <div className="loading-spinner" />
                    <span>Loading Sites...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="locations-page">
            <div className="locations-header">
                <div>
                    <h1>Locations</h1>
                    <p>
                        {isCustomer
                            ? "Sites available under your customer hierarchy"
                            : isAdmin
                            ? "Sites available under your assigned hierarchy"
                            : "Manage locations and registered AC sites"}
                    </p>
                </div>

                <div className="header-actions">
                    <button type="button" className="refresh-btn" onClick={loadSites}>
                        ↻ Refresh
                    </button>

                    {(isCustomer || isAdmin || isSuperAdmin) && (
                        <button
                            type="button"
                            className="add-location-btn"
                            onClick={openAddLocation}
                        >
                            <span>+</span>
                            Add Location
                        </button>
                    )}
                </div>
            </div>

            {!isCustomer && (
                <div className="hierarchy-switch">
                    <button
                        type="button"
                        className={`hierarchy-tab ${hierarchy === "geographical" ? "active" : ""}`}
                        onClick={() => setHierarchy("geographical")}
                    >
                        Geographical
                    </button>
                    <button
                        type="button"
                        className={`hierarchy-tab ${hierarchy === "zonal" ? "active" : ""}`}
                        onClick={() => setHierarchy("zonal")}
                    >
                        Zonal
                    </button>
                </div>
            )}

            <div className="hierarchy-description">
                <strong>
                    {hierarchy === "zonal" ? "Zonal Site Hierarchy" : "Geographical Site Hierarchy"}
                </strong>
                <span>
                    {hierarchy === "zonal"
                        ? "Zone → Circle → Region → Division → Branch → Floor → Site"
                        : "State → District → Taluka → City → Branch → Floor → Site"}
                </span>
            </div>

            <div className="location-summary">
                <div className="summary-card">
                    <div className="summary-icon zone-icon">{hierarchy === "zonal" ? "Z" : "S"}</div>
                    <div>
                        <span>{hierarchy === "zonal" ? "Zones" : "States"}</span>
                        <strong>{hierarchy === "zonal" ? totalZones : totalStates}</strong>
                    </div>
                </div>

                <div className="summary-card">
                    <div className="summary-icon state-icon">SITE</div>
                    <div>
                        <span>Sites</span>
                        <strong>{currentSites.length}</strong>
                    </div>
                </div>

                <div className="summary-card">
                    <div className="summary-icon circle-icon">BR</div>
                    <div>
                        <span>Branches</span>
                        <strong>
                            {
                                new Set(
                                    currentSites
                                        .map((site) => site.branchId || normalize(site.branchName))
                                        .filter(Boolean)
                                ).size
                            }
                        </strong>
                    </div>
                </div>

                <div className="summary-card">
                    <div className="summary-icon ac-icon">AC</div>
                    <div>
                        <span>Registered ACs</span>
                        <strong>{totalACs}</strong>
                    </div>
                </div>
            </div>

            <div className="api-status">
                <div className="status-dot" />
                <span>Showing registered Sites from your permitted hierarchy</span>
                <code>
                    {isCustomer
                        ? `CUSTOMER • ${
                              user?.customer_name ||
                              user?.customer?.name ||
                              user?.scope_name ||
                              "Current Customer"
                          }`
                        : isAdmin
                        ? `ADMIN • ${
                              user?.scope_name ||
                              user?.state_name ||
                              user?.zone_name ||
                              "Assigned Scope"
                          }`
                        : "SUPER ADMIN"}
                </code>
            </div>

            {error && (
                <div className="location-error">
                    <h3>Unable to load locations</h3>
                    <p>{error}</p>
                    <button type="button" onClick={loadSites}>
                        Retry
                    </button>
                </div>
            )}

            {!error && currentSites.length === 0 && (
                <div className="empty-location">
                    <h3>No sites found</h3>
                    <p>No registered sites are available under the current user's hierarchy.</p>
                </div>
            )}

            {!error && currentSites.length > 0 && hierarchy === "geographical" && (
                <GeographicalTree tree={geographicalTree} expanded={expanded} toggle={toggle} />
            )}

            {!error && currentSites.length > 0 && hierarchy === "zonal" && (
                <ZonalTree tree={zonalTree} expanded={expanded} toggle={toggle} />
            )}

            {/* =====================================================
                ADD LOCATION MODAL
            ===================================================== */}
            {showAddLocation && (
                <div className="modal-overlay" onClick={closeAddLocation}>
                    <div className="location-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <div>
                                <h2>
                                    Add{" "}
                                    {locationTypeOptions.find((o) => o.value === formData.location_type)
                                        ?.label || "Location"}
                                </h2>
                                <p>
                                    Add a new location to the{" "}
                                    {isGeo ? "geographical" : "zonal"} hierarchy.
                                </p>
                            </div>
                            <button className="close-btn" onClick={closeAddLocation} disabled={saving}>
                                ×
                            </button>
                        </div>

                        <form onSubmit={submitAddLocation}>
                            {/* LOCATION TYPE */}
                            <div className="form-group">
                                <label>Location Type</label>
                                <select
                                    value={formData.location_type || ""}
                                    onChange={(e) => {
                                        setFormData({
                                            ...EMPTY_FORM,
                                            hierarchy_type: hierarchy,
                                            location_type: e.target.value,
                                        });
                                        setSaveError("");
                                    }}
                                >
                                    {locationTypeOptions.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* ============================
                                GEOGRAPHICAL FORM
                            ============================ */}
                            {isGeo && (
                                <>
                                    {formData.location_type === "state" && (
                                        <>
                                            <LocationTextField
                                                label="State Code"
                                                placeholder="Example: MH"
                                                value={formData.state_code}
                                                onChange={(v) => handleFieldChange("state_code", v)}
                                            />
                                            <LocationTextField
                                                label="State Name"
                                                placeholder="Example: Maharashtra"
                                                value={formData.state_name}
                                                onChange={(v) => handleFieldChange("state_name", v)}
                                            />
                                        </>
                                    )}

                                    {formData.location_type === "district" && (
                                        <>
                                            <SelectField
                                                label="State"
                                                value={formData.state_id}
                                                onChange={(v) =>
                                                    setFormData({
                                                        ...formData,
                                                        state_id: v,
                                                        district_id: "",
                                                        taluka_id: "",
                                                        city_id: "",
                                                    })
                                                }
                                                options={flatStates(geographicalTree)}
                                            />
                                            <LocationTextField
                                                label="District Code"
                                                placeholder="Example: MH-PUN"
                                                value={formData.district_code}
                                                onChange={(v) => handleFieldChange("district_code", v)}
                                            />
                                            <LocationTextField
                                                label="District Name"
                                                placeholder="Example: Pune"
                                                value={formData.district_name}
                                                onChange={(v) => handleFieldChange("district_name", v)}
                                            />
                                        </>
                                    )}

                                    {formData.location_type === "taluka" && (
                                        <>
                                            <SelectField
                                                label="State"
                                                value={formData.state_id}
                                                onChange={(v) =>
                                                    setFormData({
                                                        ...formData,
                                                        state_id: v,
                                                        district_id: "",
                                                        taluka_id: "",
                                                    })
                                                }
                                                options={flatStates(geographicalTree)}
                                            />
                                            <SelectField
                                                label="District"
                                                value={formData.district_id}
                                                onChange={(v) =>
                                                    setFormData({
                                                        ...formData,
                                                        district_id: v,
                                                        taluka_id: "",
                                                    })
                                                }
                                                options={flatDistricts(geographicalTree, formData.state_id)}
                                                disabled={!formData.state_id}
                                            />
                                            <LocationTextField
                                                label="Taluka Code"
                                                placeholder="Example: HAV"
                                                value={formData.taluka_code}
                                                onChange={(v) => handleFieldChange("taluka_code", v)}
                                            />
                                            <LocationTextField
                                                label="Taluka Name"
                                                placeholder="Example: Haveli"
                                                value={formData.taluka_name}
                                                onChange={(v) => handleFieldChange("taluka_name", v)}
                                            />
                                        </>
                                    )}

                                    {formData.location_type === "city" && (
                                        <>
                                            <SelectField
                                                label="State"
                                                value={formData.state_id}
                                                onChange={(v) =>
                                                    setFormData({
                                                        ...formData,
                                                        state_id: v,
                                                        district_id: "",
                                                        taluka_id: "",
                                                        city_id: "",
                                                    })
                                                }
                                                options={flatStates(geographicalTree)}
                                            />
                                            <SelectField
                                                label="District"
                                                value={formData.district_id}
                                                onChange={(v) =>
                                                    setFormData({
                                                        ...formData,
                                                        district_id: v,
                                                        taluka_id: "",
                                                        city_id: "",
                                                    })
                                                }
                                                options={flatDistricts(geographicalTree, formData.state_id)}
                                                disabled={!formData.state_id}
                                            />
                                            <SelectField
                                                label="Taluka"
                                                value={formData.taluka_id}
                                                onChange={(v) =>
                                                    setFormData({
                                                        ...formData,
                                                        taluka_id: v,
                                                        city_id: "",
                                                    })
                                                }
                                                options={flatTalukas(
                                                    geographicalTree,
                                                    formData.state_id,
                                                    formData.district_id
                                                )}
                                                disabled={!formData.district_id}
                                            />
                                            <LocationTextField
                                                label="City Name"
                                                placeholder="Example: Pune"
                                                value={formData.city_name}
                                                onChange={(v) => handleFieldChange("city_name", v)}
                                            />
                                        </>
                                    )}

                                    {formData.location_type === "branch" && (
                                        <>
                                            <SelectField
                                                label="State"
                                                value={formData.state_id}
                                                onChange={(v) =>
                                                    setFormData({
                                                        ...formData,
                                                        state_id: v,
                                                        district_id: "",
                                                        taluka_id: "",
                                                        city_id: "",
                                                    })
                                                }
                                                options={flatStates(geographicalTree)}
                                            />
                                            <SelectField
                                                label="District"
                                                value={formData.district_id}
                                                onChange={(v) =>
                                                    setFormData({
                                                        ...formData,
                                                        district_id: v,
                                                        taluka_id: "",
                                                        city_id: "",
                                                    })
                                                }
                                                options={flatDistricts(geographicalTree, formData.state_id)}
                                                disabled={!formData.state_id}
                                            />
                                            <SelectField
                                                label="Taluka"
                                                value={formData.taluka_id}
                                                onChange={(v) =>
                                                    setFormData({
                                                        ...formData,
                                                        taluka_id: v,
                                                        city_id: "",
                                                    })
                                                }
                                                options={flatTalukas(
                                                    geographicalTree,
                                                    formData.state_id,
                                                    formData.district_id
                                                )}
                                                disabled={!formData.district_id}
                                            />
                                            <SelectField
                                                label="City"
                                                value={formData.city_id}
                                                onChange={(v) => handleFieldChange("city_id", v)}
                                                options={flatCities(
                                                    geographicalTree,
                                                    formData.state_id,
                                                    formData.district_id,
                                                    formData.taluka_id
                                                )}
                                                disabled={!formData.taluka_id}
                                            />
                                            <LocationTextField
                                                label="Branch Code"
                                                placeholder="Example: PUN-B01"
                                                value={formData.branch_code}
                                                onChange={(v) => handleFieldChange("branch_code", v)}
                                            />
                                            <LocationTextField
                                                label="Branch Name"
                                                placeholder="Example: Pune Branch 01"
                                                value={formData.branch_name}
                                                onChange={(v) => handleFieldChange("branch_name", v)}
                                            />
                                        </>
                                    )}

                                    {formData.location_type === "floor" && (
                                        <>
                                            <SelectField
                                                label="Branch"
                                                value={formData.branch_id}
                                                onChange={(v) => handleFieldChange("branch_id", v)}
                                                options={flatGeoBranches(geographicalTree).map((b) => ({
                                                    id: b.id,
                                                    name: `${b.name} — ${b.path}`,
                                                }))}
                                            />
                                            <LocationTextField
                                                label="Floor Name"
                                                placeholder="Example: Floor-01"
                                                value={formData.floor_name}
                                                onChange={(v) => handleFieldChange("floor_name", v)}
                                            />
                                        </>
                                    )}

                                    {formData.location_type === "room" && (
                                        <>
                                            <SelectField
                                                label="Floor"
                                                value={formData.floor_id}
                                                onChange={(v) => handleFieldChange("floor_id", v)}
                                                options={flatGeoFloors(geographicalTree).map((f) => ({
                                                    id: f.id,
                                                    name: `${f.name} — ${f.path}`,
                                                }))}
                                            />
                                            <LocationTextField
                                                label="Room Name"
                                                placeholder="Example: Room-01"
                                                value={formData.room_name}
                                                onChange={(v) => handleFieldChange("room_name", v)}
                                            />
                                        </>
                                    )}
                                </>
                            )}

                            {/* ============================
                                ZONAL FORM
                            ============================ */}
                            {!isGeo && (
                                <>
                                    {formData.location_type === "zone" && (
                                        <>
                                            <LocationTextField
                                                label="Zone Code"
                                                placeholder="Example: WEST"
                                                value={formData.zone_code}
                                                onChange={(v) => handleFieldChange("zone_code", v)}
                                            />
                                            <LocationTextField
                                                label="Zone Name"
                                                placeholder="Example: West Zone"
                                                value={formData.zone_name}
                                                onChange={(v) => handleFieldChange("zone_name", v)}
                                            />
                                        </>
                                    )}

                                    {formData.location_type === "circle" && (
                                        <>
                                            <SelectField
                                                label="Zone"
                                                value={formData.zone_id}
                                                onChange={(v) =>
                                                    setFormData({
                                                        ...formData,
                                                        zone_id: v,
                                                        circle_id: "",
                                                        region_id: "",
                                                        division_id: "",
                                                    })
                                                }
                                                options={flatZones(zonalTree)}
                                            />
                                            <LocationTextField
                                                label="Circle Code"
                                                placeholder="Example: MH-C01"
                                                value={formData.circle_code}
                                                onChange={(v) => handleFieldChange("circle_code", v)}
                                            />
                                            <LocationTextField
                                                label="Circle Name"
                                                placeholder="Example: Maharashtra Circle"
                                                value={formData.circle_name}
                                                onChange={(v) => handleFieldChange("circle_name", v)}
                                            />
                                        </>
                                    )}

                                    {formData.location_type === "region" && (
                                        <>
                                            <SelectField
                                                label="Zone"
                                                value={formData.zone_id}
                                                onChange={(v) =>
                                                    setFormData({
                                                        ...formData,
                                                        zone_id: v,
                                                        circle_id: "",
                                                        region_id: "",
                                                    })
                                                }
                                                options={flatZones(zonalTree)}
                                            />
                                            <SelectField
                                                label="Circle"
                                                value={formData.circle_id}
                                                onChange={(v) =>
                                                    setFormData({
                                                        ...formData,
                                                        circle_id: v,
                                                        region_id: "",
                                                    })
                                                }
                                                options={flatCircles(zonalTree, formData.zone_id)}
                                                disabled={!formData.zone_id}
                                            />
                                            <LocationTextField
                                                label="Region Code"
                                                placeholder="Example: PUN-R01"
                                                value={formData.region_code}
                                                onChange={(v) => handleFieldChange("region_code", v)}
                                            />
                                            <LocationTextField
                                                label="Region Name"
                                                placeholder="Example: Pune Region"
                                                value={formData.region_name}
                                                onChange={(v) => handleFieldChange("region_name", v)}
                                            />
                                        </>
                                    )}

                                    {formData.location_type === "division" && (
                                        <>
                                            <SelectField
                                                label="Zone"
                                                value={formData.zone_id}
                                                onChange={(v) =>
                                                    setFormData({
                                                        ...formData,
                                                        zone_id: v,
                                                        circle_id: "",
                                                        region_id: "",
                                                        division_id: "",
                                                    })
                                                }
                                                options={flatZones(zonalTree)}
                                            />
                                            <SelectField
                                                label="Circle"
                                                value={formData.circle_id}
                                                onChange={(v) =>
                                                    setFormData({
                                                        ...formData,
                                                        circle_id: v,
                                                        region_id: "",
                                                        division_id: "",
                                                    })
                                                }
                                                options={flatCircles(zonalTree, formData.zone_id)}
                                                disabled={!formData.zone_id}
                                            />
                                            <SelectField
                                                label="Region"
                                                value={formData.region_id}
                                                onChange={(v) =>
                                                    setFormData({
                                                        ...formData,
                                                        region_id: v,
                                                        division_id: "",
                                                    })
                                                }
                                                options={flatRegions(
                                                    zonalTree,
                                                    formData.zone_id,
                                                    formData.circle_id
                                                )}
                                                disabled={!formData.circle_id}
                                            />
                                            <LocationTextField
                                                label="Division Code"
                                                placeholder="Example: PUN-D01"
                                                value={formData.division_code}
                                                onChange={(v) => handleFieldChange("division_code", v)}
                                            />
                                            <LocationTextField
                                                label="Division Name"
                                                placeholder="Example: Pune Division"
                                                value={formData.division_name}
                                                onChange={(v) => handleFieldChange("division_name", v)}
                                            />
                                        </>
                                    )}

                                    {formData.location_type === "branch" && (
                                        <>
                                            <SelectField
                                                label="Zone"
                                                value={formData.zone_id}
                                                onChange={(v) =>
                                                    setFormData({
                                                        ...formData,
                                                        zone_id: v,
                                                        circle_id: "",
                                                        region_id: "",
                                                        division_id: "",
                                                    })
                                                }
                                                options={flatZones(zonalTree)}
                                            />
                                            <SelectField
                                                label="Circle"
                                                value={formData.circle_id}
                                                onChange={(v) =>
                                                    setFormData({
                                                        ...formData,
                                                        circle_id: v,
                                                        region_id: "",
                                                        division_id: "",
                                                    })
                                                }
                                                options={flatCircles(zonalTree, formData.zone_id)}
                                                disabled={!formData.zone_id}
                                            />
                                            <SelectField
                                                label="Region"
                                                value={formData.region_id}
                                                onChange={(v) =>
                                                    setFormData({
                                                        ...formData,
                                                        region_id: v,
                                                        division_id: "",
                                                    })
                                                }
                                                options={flatRegions(
                                                    zonalTree,
                                                    formData.zone_id,
                                                    formData.circle_id
                                                )}
                                                disabled={!formData.circle_id}
                                            />
                                            <SelectField
                                                label="Division"
                                                value={formData.division_id}
                                                onChange={(v) => handleFieldChange("division_id", v)}
                                                options={flatDivisions(
                                                    zonalTree,
                                                    formData.zone_id,
                                                    formData.circle_id,
                                                    formData.region_id
                                                )}
                                                disabled={!formData.region_id}
                                            />
                                            <LocationTextField
                                                label="Branch Code"
                                                placeholder="Example: PUN-B01"
                                                value={formData.branch_code}
                                                onChange={(v) => handleFieldChange("branch_code", v)}
                                            />
                                            <LocationTextField
                                                label="Branch Name"
                                                placeholder="Example: Pune Branch 01"
                                                value={formData.branch_name}
                                                onChange={(v) => handleFieldChange("branch_name", v)}
                                            />
                                        </>
                                    )}

                                    {formData.location_type === "floor" && (
                                        <>
                                            <SelectField
                                                label="Branch"
                                                value={formData.branch_id}
                                                onChange={(v) => handleFieldChange("branch_id", v)}
                                                options={flatZonalBranches(zonalTree).map((b) => ({
                                                    id: b.id,
                                                    name: `${b.name} — ${b.path}`,
                                                }))}
                                            />
                                            <LocationTextField
                                                label="Floor Name"
                                                placeholder="Example: Floor-01"
                                                value={formData.floor_name}
                                                onChange={(v) => handleFieldChange("floor_name", v)}
                                            />
                                        </>
                                    )}

                                    {formData.location_type === "room" && (
                                        <>
                                            <SelectField
                                                label="Floor"
                                                value={formData.floor_id}
                                                onChange={(v) => handleFieldChange("floor_id", v)}
                                                options={flatZonalFloors(zonalTree).map((f) => ({
                                                    id: f.id,
                                                    name: `${f.name} — ${f.path}`,
                                                }))}
                                            />
                                            <LocationTextField
                                                label="Room Name"
                                                placeholder="Example: Room-01"
                                                value={formData.room_name}
                                                onChange={(v) => handleFieldChange("room_name", v)}
                                            />
                                        </>
                                    )}
                                </>
                            )}

                            {saveError && <div className="location-error">{saveError}</div>}

                            <div className="modal-actions">
                                <button
                                    type="button"
                                    className="cancel-btn"
                                    onClick={closeAddLocation}
                                    disabled={saving}
                                >
                                    Cancel
                                </button>
                                <button type="submit" className="save-btn" disabled={saving}>
                                    {saving ? "Saving..." : "Add Location"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Locations;