import React, { useEffect, useRef } from 'react';
import { renderToString } from 'react-dom/server';
import { MapPin, X, Factory } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './index.css';

const SENSORS = {
    'S1': { lat: -33.8688, lon: 151.2093 },
    'S2': { lat: -33.8689, lon: 151.2094 },
    'S3': { lat: -33.8690, lon: 151.2095 },
    'S4': { lat: -33.8691, lon: 151.2096 }
};

const FACTORIES = [
    { name: 'Apex Chemicals', lat: -33.86914, lon: 151.20960, color: '#ef4444' },
    { name: 'BioSynthetics Inc', lat: -33.86922, lon: 151.20972, color: '#eab308' },
    { name: 'RiverSide Manufacturing', lat: -33.86932, lon: 151.20964, color: '#3b82f6' }
];
const POLYGONS = [
    {
        name: 'RESIDENTIAL SUB-Catchment',
        color: '#f97316', // orange
        coords: [[-33.8687, 151.2095], [-33.8687, 151.2105], [-33.8693, 151.2105], [-33.8693, 151.2095]]
    },
    {
        name: 'INDUSTRIAL SUB-Catchment 1',
        color: '#84cc16', // green
        coords: [[-33.8688, 151.2088], [-33.8688, 151.2096], [-33.8693, 151.2096], [-33.8693, 151.2088]]
    },
    {
        name: 'INDUSTRIAL SUB-Catchment 1a',
        color: '#3b82f6', // blue
        coords: [[-33.8689, 151.2089], [-33.8689, 151.2095], [-33.8691, 151.2095], [-33.8691, 151.2089]]
    },
    {
        name: 'INDUSTRIAL SUB-catchment 2',
        color: '#a855f7', // purple
        coords: [[-33.8685, 151.2090], [-33.8685, 151.2095], [-33.8688, 151.2095], [-33.8688, 151.2090]]
    }
];

export default function CatchmentMap({ pulsedSensors, sourceLocation }) {
    const mapRef = useRef(null);
    const markersRef = useRef({});
    const sourceMarkerRef = useRef(null);
    const pipesLayerRef = useRef(null);

    useEffect(() => {
        if (!mapRef.current) {
            const map = L.map('map', { zoomControl: false }).setView([-33.8689, 151.2094], 16);
            
            // Satellite Imagery
            L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                maxZoom: 20,
                maxNativeZoom: 18,
                attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
            }).addTo(map);

            // Add Polygons
            POLYGONS.forEach(poly => {
                const polyLayer = L.polygon(poly.coords, {
                    color: poly.color,
                    fillColor: poly.color,
                    fillOpacity: 0.3,
                    weight: 2
                }).addTo(map);
                polyLayer.bindTooltip(poly.name, { sticky: true, className: 'custom-tooltip' });
            });

            // Add Factories
            FACTORIES.forEach(factory => {
                const iconHtml = renderToString(<Factory fill="#ffffff" color={factory.color} size={28} />);
                const factoryIcon = L.divIcon({
                    html: iconHtml,
                    className: 'custom-factory-icon',
                    iconSize: [28, 28],
                    iconAnchor: [14, 14],
                    tooltipAnchor: [0, -14]
                });
                
                const marker = L.marker([factory.lat, factory.lon], { icon: factoryIcon }).addTo(map);
                marker.bindTooltip(`<strong>${factory.name}</strong>`, { direction: 'top', className: 'custom-tooltip' });
            });

            // Add Sensors
            for (const [id, pos] of Object.entries(SENSORS)) {
                const iconHtml = renderToString(<MapPin fill="#ef4444" color="#7f1d1d" size={32} />);
                const pinIcon = L.divIcon({
                    html: iconHtml,
                    className: 'custom-pin-icon',
                    iconSize: [32, 32],
                    iconAnchor: [16, 32],
                    tooltipAnchor: [0, -42]
                });
                
                const marker = L.marker([pos.lat, pos.lon], { icon: pinIcon }).addTo(map);
                marker.bindTooltip(`<strong>Sensor ${id}</strong>`, { direction: 'top', className: 'custom-tooltip' });
                markersRef.current[id] = marker;
            }
            
            // Add zoom control to top right so it doesn't overlap legend
            L.control.zoom({ position: 'topright' }).addTo(map);
            
            mapRef.current = map;

            // Load drainage pipes
            const loadPipes = async () => {
                const bounds = map.getBounds();
                const bbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`;
                const url = `https://services1.arcgis.com/cNVyNtjGVZybOQWZ/arcgis/rest/services/Drainage_pipes/FeatureServer/0/query?geometry=${bbox}&geometryType=esriGeometryEnvelope&inSR=4326&outFields=*&f=geojson`;
                
                try {
                    const res = await fetch(url);
                    const data = await res.json();
                    
                    if (pipesLayerRef.current) {
                        map.removeLayer(pipesLayerRef.current);
                    }
                    
                    pipesLayerRef.current = L.geoJSON(data, {
                        style: {
                            color: '#06b6d4', // Cyan for pipes
                            weight: 2,
                            opacity: 0.8
                        },
                        onEachFeature: (feature, layer) => {
                            const dia = feature.properties?.Pipe_Diameter;
                            const text = dia ? `Pipe Diameter: ${dia}mm` : 'Drainage Pipe';
                            layer.bindTooltip(text, { sticky: true, className: 'custom-tooltip' });
                        }
                    }).addTo(map);
                } catch (e) {
                    console.error("Failed to load pipes", e);
                }
            };

            map.on('moveend', () => {
                if (map.getZoom() >= 15) {
                    loadPipes();
                } else if (pipesLayerRef.current) {
                    map.removeLayer(pipesLayerRef.current);
                    pipesLayerRef.current = null;
                }
            });
            loadPipes(); // initial load

            // Invalidate size to ensure map tiles load in flex container
            setTimeout(() => {
                map.invalidateSize();
            }, 200);
            
            // Handle any dynamic resizing (e.g. window resize) to prevent cut-off map tiles
            const resizeObserver = new ResizeObserver(() => {
                if (mapRef.current) {
                    mapRef.current.invalidateSize();
                }
            });
            const container = document.getElementById('map');
            if (container) {
                resizeObserver.observe(container);
            }
        }
    }, []);

    useEffect(() => {
        // Handle pulsing sensors
        for (const [sid, marker] of Object.entries(markersRef.current)) {
            if (pulsedSensors.includes(sid)) {
                const yellowIcon = renderToString(<MapPin fill="#facc15" color="#ca8a04" size={32} />);
                marker.setIcon(L.divIcon({ html: yellowIcon, className: 'custom-pin-icon', iconSize: [32,32], iconAnchor: [16,32], tooltipAnchor: [0, -42] }));
            } else {
                const redIcon = renderToString(<MapPin fill="#ef4444" color="#7f1d1d" size={32} />);
                marker.setIcon(L.divIcon({ html: redIcon, className: 'custom-pin-icon', iconSize: [32,32], iconAnchor: [16,32], tooltipAnchor: [0, -42] }));
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
                        className: '',
                        html: '<div style="background:red;width:100%;height:100%;border-radius:50%"></div>',
                        iconSize: [24, 24]
                    });
                    sourceMarkerRef.current = L.marker([slat, slon], {icon: redIcon}).addTo(mapRef.current);
                }
            }
        }
    }, [sourceLocation]);

    return (
        <div className="map-container" style={{ position: 'relative', minHeight: '60vh', flex: '0 0 60vh' }}>
            <div id="map" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}></div>
            
            {/* Custom Map Legend overlay matching the user image */}
            <div className="map-legend" style={{
                position: 'absolute',
                top: '10px',
                left: '10px',
                zIndex: 1000,
                background: 'white',
                padding: '10px',
                borderRadius: '0',
                color: '#000',
                fontFamily: 'sans-serif',
                fontWeight: 'bold',
                fontSize: '0.8rem',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#f97316', marginRight: '8px' }}></div>
                    <span style={{ color: '#000' }}>RESIDENTIAL SUB-Catchment</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#84cc16', marginRight: '8px' }}></div>
                    <span style={{ color: '#000' }}>INDUSTRIAL SUB-Catchment 1</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                    <div style={{ marginRight: '8px', display: 'flex' }}><X size={16} strokeWidth={4} color="#3b82f6" /></div>
                    <span style={{ color: '#000' }}>INDUSTRIAL SUB-Catchment 1a</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                    <div style={{ marginRight: '8px', display: 'flex' }}><X size={16} strokeWidth={4} color="#a855f7" /></div>
                    <span style={{ color: '#000' }}>INDUSTRIAL SUB-catchment 2</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ef4444', marginRight: '8px' }}></div>
                    <span style={{ color: '#000' }}>WHOLE CATCHMENT</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                    <div style={{ marginRight: '8px', display: 'flex' }}><Factory size={16} strokeWidth={2} color="#000" /></div>
                    <span style={{ color: '#000' }}>FACTORIES</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{ width: '12px', height: '2px', background: '#06b6d4', marginRight: '8px' }}></div>
                    <span style={{ color: '#000' }}>DRAINAGE PIPES</span>
                </div>
            </div>
        </div>
    );
}
