import React from 'react';

export default function EventHistory({ events, timeFilter, setTimeFilter }) {
    const handleDownloadCSV = () => {
        if (events.length === 0) return;
        const headers = ["Time", "First Sensor", "Source Location", "Signature", "Confidence"];
        const csvRows = [
            headers.join(','),
            ...events.map(ev => [
                `"${ev.time}"`,
                `"${ev.firstSensor}"`,
                `"${ev.source}"`,
                `"${ev.signature}"`,
                `"${ev.conf}"`
            ].join(','))
        ];
        
        const csvData = csvRows.join('\n');
        const blob = new Blob([csvData], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('hidden', '');
        a.setAttribute('href', url);
        a.setAttribute('download', `draincheck_events_${new Date().toISOString().slice(0,10)}.csv`);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    return (
        <div className="history-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3>Event History</h3>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <select 
                        value={timeFilter} 
                        onChange={(e) => setTimeFilter(e.target.value)} 
                        style={{ padding: '6px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#222', color: 'white' }}
                    >
                        <option value="">Live (Last 10)</option>
                        <option value="1">Last 1 Hour</option>
                        <option value="24">Last 24 Hours</option>
                        <option value="168">Last 7 Days</option>
                        <option value="8760">All Time</option>
                    </select>
                    <button 
                        onClick={handleDownloadCSV} 
                        disabled={events.length === 0}
                        style={{ 
                            padding: '6px 12px', 
                            borderRadius: '4px', 
                            border: 'none', 
                            backgroundColor: events.length === 0 ? '#555' : '#f97316', 
                            color: 'white', 
                            cursor: events.length === 0 ? 'not-allowed' : 'pointer', 
                            fontWeight: 'bold' 
                        }}
                    >
                        Download CSV
                    </button>
                </div>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Time</th>
                        <th>First Sensor</th>
                        <th>Source Location</th>
                        <th>Signature</th>
                        <th>Confidence</th>
                    </tr>
                </thead>
                <tbody>
                    {events.length === 0 ? (
                        <tr>
                            <td colSpan="5" style={{ textAlign: 'center', padding: '24px', color: '#888', fontStyle: 'italic' }}>
                                No contamination events detected yet. Waiting for sensor triggers...
                            </td>
                        </tr>
                    ) : (
                        events.map((ev, idx) => (
                            <tr key={idx}>
                                <td>{ev.time}</td>
                                <td>{ev.firstSensor}</td>
                                <td>{ev.source}</td>
                                <td>{ev.signature}</td>
                                <td>{ev.conf}</td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}
