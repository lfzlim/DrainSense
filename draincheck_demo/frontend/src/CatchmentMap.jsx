import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const SENSORS = {
    'S1': { lat: -33.8688, lon: 151.2093 },
    'S2': { lat: -33.8689, lon: 151.2094 },
    'S3': { lat: -33.8690, lon: 151.2095 }
};

export default function CatchmentMap({ pulsedSensors, sourceLocation }) {
    const mapRef = useRef(null);
    const markersRef = useRef({});
    const sourceMarkerRef = useRef(null);

    useEffect(() => {
        if (!mapRef.current) {
            const map = L.map('map').setView([-33.8689, 151.2094], 19);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 22,
                attribution: '© OpenStreetMap'
            }).addTo(map);

            for (const [id, pos] of Object.entries(SENSORS)) {
                const marker = L.circleMarker([pos.lat, pos.lon], {
                    radius: 8,
                    color: '#3b82f6',
                    fillColor: '#3b82f6',
                    fillOpacity: 0.8
                }).addTo(map);
                marker.bindTooltip(id, { permanent: true, direction: 'right' });
                markersRef.current[id] = marker;
            }
            mapRef.current = map;
        }
    }, []);

    useEffect(() => {
        // Handle pulsing sensors
        for (const [sid, marker] of Object.entries(markersRef.current)) {
            if (pulsedSensors.includes(sid)) {
                marker.setStyle({ color: '#cf6679', fillColor: '#cf6679' });
            } else {
                marker.setStyle({ color: '#3b82f6', fillColor: '#3b82f6' });
            }
        }
    }, [pulsedSensors]);

    useEffect(() => {
        if (mapRef.current) {
            if (sourceMarkerRef.current) {
                mapRef.current.removeLayer(sourceMarkerRef.current);
                sourceMarkerRef.current = null;
            }
            if (sourceLocation) {
                const fs = SENSORS[sourceLocation.sensorId];
                if (fs) {
                    const slat = fs.lat + 0.00005;
                    const slon = fs.lon - 0.00005;
                    const redIcon = L.divIcon({
                        className: 'pulse-icon',
                        html: '<div style="background:red;width:100%;height:100%;border-radius:50%"></div>',
                        iconSize: [24, 24]
                    });
                    sourceMarkerRef.current = L.marker([slat, slon], {icon: redIcon}).addTo(mapRef.current);
                }
            }
        }
    }, [sourceLocation]);

    return (
        <div className="map-container">
            <div id="map"></div>
        </div>
    );
}
