import React, { useEffect, useState, useRef } from 'react';
import CatchmentMap from './CatchmentMap';
import SensorChart from './SensorChart';
import EventHistory from './EventHistory';
import { CloudRain, Sun, Activity } from 'lucide-react';
import './index.css';

function App() {
    const [sensorData, setSensorData] = useState({ S1: [], S2: [], S3: [], S4: [] });
    const [sensorStates, setSensorStates] = useState({ 
        S1: { level: 0, ir: 1 }, 
        S2: { level: 0, ir: 1 }, 
        S3: { level: 0, ir: 1 },
        S4: { level: 0, ir: 1 } 
    });
    const [events, setEvents] = useState([]);
    const [pulsedSensors, setPulsedSensors] = useState([]);
    const [sourceLocation, setSourceLocation] = useState(null);
    const [alert, setAlert] = useState(null);
    const maxDataPoints = 120;

    const pulseTimeouts = useRef({});

    const [timeFilter, setTimeFilter] = useState(''); // '' means live, otherwise hours
    
    // Bulk Export State
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportSelection, setExportSelection] = useState({ S1: true, S2: true, S3: true, S4: true });

    // Simulation State
    const [isSimulating, setIsSimulating] = useState(false);
    const [weather, setWeather] = useState({ rain: 0, loading: true });

    const toggleSimulation = () => {
        fetch('/api/simulate', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ active: !isSimulating }) 
        })
        .then(res => res.json())
        .then(data => {
            setIsSimulating(data.simulation_active);
        });
    };

    const handleBulkExport = () => {
        const headers = ["Time", "Sensor ID", "Turbidity (V)", "EC (µS/cm)", "TDS (ppm)"];
        let csvRows = [headers.join(',')];
        
        ['S1', 'S2', 'S3', 'S4'].forEach(sid => {
            if (exportSelection[sid]) {
                const data = sensorData[sid];
                if (data && data.length > 0) {
                    data.forEach(d => {
                        csvRows.push([
                            `"${d.timeLabel}"`,
                            `"${sid}"`,
                            d.turbidity,
                            d.ec,
                            d.tds
                        ].join(','));
                    });
                }
            }
        });

        if (csvRows.length === 1) {
            alert("No data available for the selected sensors.");
            return;
        }

        const csvData = csvRows.join('\n');
        const blob = new Blob([csvData], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('hidden', '');
        a.setAttribute('href', url);
        a.setAttribute('download', `draincheck_bulk_telemetry_${new Date().toISOString().slice(0,10)}.csv`);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setShowExportModal(false);
    };

    const fetchEvents = (filter) => {
        const url = filter ? `/api/events?hours=${filter}` : '/api/events';
        fetch(url)
            .then(res => res.json())
            .then(data => {
                const pastEvents = [...data].reverse().map(ev => ({
                    time: new Date(ev.started_at * 1000).toLocaleString(),
                    firstSensor: ev.first_sensor,
                    source: ev.source_description,
                    signature: ev.pollutant_signature.join(', '),
                    conf: ev.confidence
                }));
                setEvents(pastEvents);
            });
    };

    useEffect(() => {
        fetchEvents(timeFilter);
        let interval;
        if (timeFilter) {
            interval = setInterval(() => fetchEvents(timeFilter), 10000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [timeFilter]);

    useEffect(() => {
        // Connect SSE
        const evtSource = new EventSource('/api/stream');
        evtSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            if (data.type === 'reading') {
                const sid = data.sensor_id;
                const timeLabel = new Date(data.t * 1000).toLocaleTimeString();
                
                setSensorData(prev => {
                    const newArr = [...prev[sid], {
                        timeLabel,
                        turbidity: data.turbidity_voltage,
                        ec: data.ec_us_cm,
                        tds: data.tds_ppm
                    }];
                    if (newArr.length > maxDataPoints) newArr.shift();
                    return { ...prev, [sid]: newArr };
                });

                setSensorStates(prev => ({
                    ...prev,
                    [sid]: { level: data.water_level_mm, ir: data.ir_beam_state }
                }));
            }
            else if (data.type === 'event_start') {
                setAlert({ type: 'yellow', text: `Event detected at ${data.first_sensor} - analyzing source...` });
                triggerPulse(data.first_sensor);
            }
            else if (data.type === 'sensor_triggered') {
                triggerPulse(data.sensor_id);
            }
            else if (data.type === 'event_resolved') {
                const timeStr = new Date(data.beam_trigger_times[data.first_sensor] * 1000).toLocaleTimeString();
                const sigStr = data.pollutant_signature.join(', ');
                // Safe from XSS due to React auto-escaping
                setAlert({
                    type: 'red',
                    text: `Contamination event detected at ${timeStr}. Source: ${data.source_description}. Signature: ${sigStr}. Confidence: ${data.confidence.toUpperCase()}`
                });
                setEvents(prev => {
                    const newArr = [{
                        time: new Date(data.beam_trigger_times[data.first_sensor] * 1000).toLocaleString(),
                        firstSensor: data.first_sensor,
                        source: data.source_description,
                        signature: sigStr,
                        conf: data.confidence
                    }, ...prev];
                    return timeFilter ? newArr : newArr.slice(0, 10);
                });
                
                setSourceLocation({ sensorId: data.first_sensor });
            }
            else if (data.type === 'simulation_state') {
                setIsSimulating(data.active);
            }
            else if (data.type === 'clear_data') {
                setSensorData({ S1: [], S2: [], S3: [], S4: [] });
                setEvents([]);
                setAlert(null);
                setSourceLocation(null);
                setPulsedSensors([]);
            }
            else if (data.type === 'flood_alert') {
                if (data.alert_subtype === 'dry_flood') {
                    setAlert({
                        type: 'red',
                        text: `CRITICAL DRY-WEATHER ANOMALY: Volume spike of ${data.spike}mm at Sensor ${data.sensor_id.replace('S','')}. Rainfall is ${data.rain}mm. High probability of illegal dumping!`
                    });
                } else {
                    setAlert({
                        type: 'yellow',
                        text: `Weather-Correlated Flood: Volume spike of ${data.spike}mm at Sensor ${data.sensor_id.replace('S','')}. Local rainfall is ${data.rain}mm.`
                    });
                }
                triggerPulse(data.sensor_id);
            }
        };

        return () => evtSource.close();
    }, []);

    useEffect(() => {
        const fetchWeather = async () => {
            try {
                const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=-33.8688&longitude=151.2093&current=precipitation');
                const data = await res.json();
                if (data && data.current) {
                    setWeather({ rain: data.current.precipitation, loading: false });
                }
            } catch(e) {
                console.error("Failed to fetch weather", e);
            }
        };
        fetchWeather();
        const interval = setInterval(fetchWeather, 300000);
        return () => clearInterval(interval);
    }, []);

    const triggerPulse = (sid) => {
        setPulsedSensors(prev => [...new Set([...prev, sid])]);
        if (pulseTimeouts.current[sid]) clearTimeout(pulseTimeouts.current[sid]);
        pulseTimeouts.current[sid] = setTimeout(() => {
            setPulsedSensors(prev => prev.filter(id => id !== sid));
        }, 3000);
    };

    const handleReset = () => {
        fetch('/api/reset_baseline', { method: 'POST' })
            .then(() => {
                setAlert(null);
                setSourceLocation(null);
            });
    };

    const handleClearData = () => {
        if (window.confirm("Are you sure you want to clear all data and events?")) {
            fetch('/api/clear', { method: 'POST' });
        }
    };

    return (
        <>
            <div className="header">
                <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
                    <Activity style={{ marginRight: '12px' }} color="#3b82f6" />
                    DrainCheck Dashboard
                    
                    {!weather.loading && (
                        <div style={{ marginLeft: '24px', padding: '4px 12px', background: '#1e293b', borderRadius: '16px', fontSize: '0.9rem', fontWeight: 'normal', color: '#cbd5e1', display: 'flex', alignItems: 'center' }}>
                            {weather.rain > 0 ? (
                                <><CloudRain size={16} style={{ marginRight: '6px' }} color="#60a5fa" /> {weather.rain}mm rain</>
                            ) : (
                                <><Sun size={16} style={{ marginRight: '6px' }} color="#fbbf24" /> Dry</>
                            )}
                            <span style={{ marginLeft: '6px', color: '#64748b' }}>(Sydney)</span>
                        </div>
                    )}
                </h1>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button 
                        style={{ padding: '8px 16px', borderRadius: '4px', border: 'none', backgroundColor: isSimulating ? '#ef4444' : '#10b981', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}
                        onClick={toggleSimulation}
                    >
                        {isSimulating ? "Stop Simulation" : "Start Simulation"}
                    </button>
                    <button 
                        style={{ padding: '8px 16px', borderRadius: '4px', border: '1px solid #555', backgroundColor: '#333', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}
                        onClick={() => setShowExportModal(true)}
                    >
                        Export Telemetry
                    </button>
                    <button 
                        id="reset-btn" 
                        style={{ padding: '8px 16px', borderRadius: '4px', border: '1px solid #555', backgroundColor: '#333', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}
                        onClick={handleReset}
                    >
                        Reset Baseline
                    </button>
                    <button 
                        style={{ padding: '8px 16px', borderRadius: '4px', border: '1px solid #555', backgroundColor: '#333', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}
                        onClick={handleClearData}
                    >
                        Clear Data
                    </button>
                </div>
            </div>

            {showExportModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
                    <div style={{ backgroundColor: '#1e1e1e', padding: '24px', borderRadius: '8px', border: '1px solid #333', width: '300px' }}>
                        <h3 style={{ margin: '0 0 16px 0', color: '#fff' }}>Export Telemetry</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                            {['S1', 'S2', 'S3', 'S4'].map(sid => (
                                <label key={sid} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ccc', cursor: 'pointer' }}>
                                    <input 
                                        type="checkbox" 
                                        checked={exportSelection[sid]}
                                        onChange={(e) => setExportSelection(prev => ({ ...prev, [sid]: e.target.checked }))}
                                    />
                                    Sensor {sid.replace('S', '')}
                                </label>
                            ))}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                            <button 
                                onClick={() => setShowExportModal(false)}
                                style={{ padding: '8px 16px', borderRadius: '4px', border: '1px solid #555', backgroundColor: 'transparent', color: '#ccc', cursor: 'pointer' }}
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleBulkExport}
                                style={{ padding: '8px 16px', borderRadius: '4px', border: 'none', backgroundColor: '#bb86fc', color: '#000', cursor: 'pointer', fontWeight: 'bold' }}
                            >
                                Download
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div id="alert-banner" className={`alert-banner ${alert ? alert.type : 'hidden'}`}>
                {alert?.text}
            </div>

            <div className="main-content">
                <CatchmentMap pulsedSensors={pulsedSensors} sourceLocation={sourceLocation} />

                <div className="charts-container">
                    {['S1', 'S2', 'S3', 'S4'].map(sid => (
                        <SensorChart 
                            key={sid}
                            sensorId={sid}
                            data={sensorData[sid]}
                            level={sensorStates[sid].level}
                            irState={sensorStates[sid].ir}
                            isPulsing={pulsedSensors.includes(sid)}
                        />
                    ))}
                </div>
            </div>

            <EventHistory 
                events={events} 
                timeFilter={timeFilter} 
                setTimeFilter={setTimeFilter} 
            />
        </>
    );
}

export default App;
