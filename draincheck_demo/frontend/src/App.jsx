import React, { useEffect, useState, useRef } from 'react';
import CatchmentMap from './CatchmentMap';
import SensorChart from './SensorChart';
import EventHistory from './EventHistory';
import './index.css';

function App() {
    const [sensorData, setSensorData] = useState({ S1: [], S2: [], S3: [] });
    const [sensorStates, setSensorStates] = useState({ 
        S1: { level: 0, ir: 1 }, 
        S2: { level: 0, ir: 1 }, 
        S3: { level: 0, ir: 1 } 
    });
    const [events, setEvents] = useState([]);
    const [pulsedSensors, setPulsedSensors] = useState([]);
    const [sourceLocation, setSourceLocation] = useState(null);
    const [alert, setAlert] = useState(null);
    const maxDataPoints = 120;

    const pulseTimeouts = useRef({});

    useEffect(() => {
        // Fetch past events
        fetch('/api/events')
            .then(res => res.json())
            .then(data => {
                const pastEvents = [...data].reverse().map(ev => ({
                    time: new Date(ev.started_at * 1000).toLocaleTimeString(),
                    firstSensor: ev.first_sensor,
                    source: ev.source_description,
                    signature: ev.pollutant_signature.join(', '),
                    conf: ev.confidence
                }));
                setEvents(pastEvents);
            });

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
                setEvents(prev => [{
                    time: timeStr,
                    firstSensor: data.first_sensor,
                    source: data.source_description,
                    signature: sigStr,
                    conf: data.confidence
                }, ...prev].slice(0, 10));
                
                setSourceLocation({ sensorId: data.first_sensor });
            }
        };

        return () => evtSource.close();
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

    return (
        <>
            <div className="header">
                <h1>DrainCheck - Live Catchment Monitor</h1>
                <button id="reset-btn" onClick={handleReset}>Reset Baseline</button>
            </div>

            <div id="alert-banner" className={`alert-banner ${alert ? alert.type : 'hidden'}`}>
                {alert?.text}
            </div>

            <div className="main-content">
                <CatchmentMap pulsedSensors={pulsedSensors} sourceLocation={sourceLocation} />

                <div className="charts-container">
                    {['S1', 'S2', 'S3'].map(sid => (
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

            <EventHistory events={events} />
        </>
    );
}

export default App;
