import React from 'react';

export default function EventHistory({ events }) {
    return (
        <div className="history-container">
            <h3>Event History</h3>
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
                    {events.map((ev, idx) => (
                        <tr key={idx}>
                            <td>{ev.time}</td>
                            <td>{ev.firstSensor}</td>
                            <td>{ev.source}</td>
                            <td>{ev.signature}</td>
                            <td>{ev.conf}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
