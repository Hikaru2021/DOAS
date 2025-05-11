import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import '../CSS/Maps.css';
import L from 'leaflet';
import { supabase } from '../library/supabaseClient';
import { FaMapMarkedAlt, FaSearchLocation, FaMapMarkerAlt, FaSearch, FaSearchPlus, FaCheck } from 'react-icons/fa';

// Fix for default marker icons in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Reverse geocoding function
async function fetchAddressFromCoords(lat, lng) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`);
        const data = await response.json();
        return data.display_name || '';
    } catch (e) {
        return '';
    }
}

// Component to handle map view changes
function ChangeView({ center, zoom }) {
    const map = useMap();
    useEffect(() => {
        map.setView(center, zoom);
    }, [center, zoom, map]);
    return null;
}

const Maps = () => {
    // Default center coordinates (Baybay City, Leyte)
    const [center, setCenter] = useState([10.6781, 124.8006]);
    const [zoom, setZoom] = useState(13);
    const [applications, setApplications] = useState([]);
    const [selectedAppId, setSelectedAppId] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [confirmAppId, setConfirmAppId] = useState(null);

    // Move fetchApplications to top-level so it can be called after inspection completion
    const fetchApplications = async () => {
        const { data, error } = await supabase
            .from('user_applications')
            .select('*')
            .eq('status', 9);
        if (!error && data) {
            setApplications(data.filter(app => app.location && app.location.includes(',')));
        }
    };

    useEffect(() => {
        fetchApplications();
    }, []);

    // Filter applications based on search query
    const filteredApplications = applications.filter(app => {
        const searchLower = searchQuery.toLowerCase();
        const fullName = (app.full_name || '').toLowerCase();
        const address = (app.address || '').toLowerCase();
        const referenceNumber = `REF-${String(app.id).padStart(6, '0')}`.toLowerCase();
        
        return fullName.includes(searchLower) || 
               address.includes(searchLower) || 
               referenceNumber.includes(searchLower);
    });

    const handleReset = () => {
        setCenter([10.6781, 124.8006]);
        setZoom(13);
    };

    const handleZoomIn = () => setZoom((z) => Math.min(z + 1, 18));
    const handleZoomOut = () => setZoom((z) => Math.max(z - 1, 5));

    const handleListItemClick = (lat, lng, appId) => {
        setCenter([lat, lng]);
        setZoom(16);
        setSelectedAppId(appId);
    };

    return (
        <div className="maps-container">
            <div className="maps-body">
                <h1 className="maps-title"><FaMapMarkedAlt style={{marginRight: '10px'}}/>Maps</h1>
                <p className="maps-subtitle" style={{ fontSize: '14px', color: 'gray' }}>View and manage locations on the map</p>
                <div className="map-list-row">
                    <div className="map-container">
                        <MapContainer
                            center={center}
                            zoom={zoom}
                            style={{ height: "100%", width: "100%" }}
                        >
                            <ChangeView center={center} zoom={zoom} />
                            <TileLayer
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                            />
                            {/* Markers for applications with status = 9 */}
                            {filteredApplications.map(app => {
                                const [lat, lng] = app.location.split(',').map(Number);
                                if (isNaN(lat) || isNaN(lng)) return null;
                                const referenceNumber = `REF-${String(app.id).padStart(6, '0')}`;
                                return (
                                    <Marker key={app.id} position={[lat, lng]}>
                                        <Popup>
                                            <strong>{app.full_name || 'No Name'}</strong><br />
                                            {referenceNumber}<br />
                                            {app.address || 'No Address'}
                                        </Popup>
                                    </Marker>
                                );
                            })}
                        </MapContainer>
                    </div>
                    <div className="maps-list-panel">
                        <h2 style={{ marginTop: 0 }}><FaSearchPlus style={{marginRight: '8px'}}/>Inspection List</h2>
                        <div className="maps-search-container">
                            <div className="maps-search-input-wrapper">
                                <FaSearch className="maps-search-icon" />
                                <input
                                    type="text"
                                    className="maps-search-input"
                                    placeholder="Search by name, address, or reference number..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="maps-app-list-scroll">
                            {filteredApplications.length === 0 ? (
                                <div style={{ color: '#888' }}>
                                    {applications.length === 0 
                                        ? "No applications with status \"inspecting\"."
                                        : "No applications match your search."}
                                </div>
                            ) : (
                                <ul className="maps-app-list">
                                    {filteredApplications.map(app => {
                                        const [lat, lng] = app.location.split(',').map(Number);
                                        if (isNaN(lat) || isNaN(lng)) return null;
                                        const referenceNumber = `REF-${String(app.id).padStart(6, '0')}`;
                                        return (
                                            <li
                                                className={`maps-app-list-item${selectedAppId === app.id ? ' selected' : ''}`}
                                                key={app.id}
                                                onClick={() => handleListItemClick(lat, lng, app.id)}
                                            >
                                                <div className="maps-app-list-header">
                                                    <FaMapMarkerAlt className="maps-app-list-icon" style={{ color: '#2196F3', marginRight: '8px' }} />
                                                    <span className="maps-applicant-name">{app.full_name || 'No Name'}</span>
                                                </div>
                                                <div className="maps-app-list-ref">Reference #: {referenceNumber}</div>
                                                <div className="maps-app-list-address">{app.address || 'No Address'}</div>
                                                <div className="maps-app-list-coords">({lat.toFixed(5)}, {lng.toFixed(5)})</div>
                                                <button 
                                                    className="maps-check-button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setConfirmAppId(app.id);
                                                    }}
                                                >
                                                    <FaCheck />
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            {/* Confirmation Modal */}
            {confirmAppId && (
                <div className="maps-modal-overlay">
                    <div className="maps-modal-container">
                        <div className="maps-modal-header-row">
                            <h2 className="maps-modal-title">Complete Inspection</h2>
                            <button className="maps-modal-close" onClick={() => setConfirmAppId(null)} aria-label="Close">&times;</button>
                        </div>
                        <div className="maps-modal-body">
                            <p>Are you sure you are done inspecting this application?</p>
                            <div className="maps-modal-warning">
                                This action cannot be undone. The inspection will be marked as complete.
                            </div>
                        </div>
                        <div className="maps-modal-actions">
                            <button
                                className="maps-modal-cancel"
                                onClick={() => setConfirmAppId(null)}
                            >
                                Cancel
                            </button>
                            <button
                                className="maps-modal-confirm maps-modal-danger"
                                onClick={async () => {
                                    const { data, error } = await supabase
                                        .from('user_applications')
                                        .update({ status: 11 })
                                        .eq('id', confirmAppId)
                                        .select();

                                    if (error) {
                                        alert('Failed to update status: ' + error.message);
                                    } else {
                                        const now = new Date();
                                        const formattedDate = now.toLocaleString('en-US', {
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric',
                                            hour: 'numeric',
                                            minute: '2-digit',
                                            hour12: true
                                        });
                                        const remarks = `Inspection completed on ${formattedDate}. Please wait for further updates or instructions.`;
                                        const isoNow = now.toISOString();
                                        await supabase
                                            .from('application_status_history')
                                            .insert([
                                                {
                                                    user_application_id: confirmAppId,
                                                    status_id: 11,
                                                    remarks: remarks,
                                                    changed_at: isoNow
                                                }
                                            ]);
                                        // Refresh the applications list after completion
                                        await fetchApplications();
                                        setConfirmAppId(null);
                                    }
                                }}
                            >
                                Complete Inspection
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Maps; 