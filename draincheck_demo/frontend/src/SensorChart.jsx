import React, { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';

export default function SensorChart({ sensorId, data, level, irState, isPulsing }) {
    const canvasRef = useRef(null);
    const chartRef = useRef(null);

    useEffect(() => {
        if (!chartRef.current && canvasRef.current) {
            chartRef.current = new Chart(canvasRef.current, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [
                        {
                            label: 'Turbidity (V)',
                            borderColor: '#bb86fc',
                            backgroundColor: 'rgba(187, 134, 252, 0.2)',
                            data: [],
                            yAxisID: 'yTurbidity',
                            fill: true,
                            tension: 0.3,
                            borderWidth: 2,
                            pointRadius: 1
                        },
                        {
                            label: 'TDS (ppm)',
                            borderColor: '#f2c94c',
                            data: [],
                            yAxisID: 'yTDS',
                            tension: 0.3,
                            borderWidth: 2,
                            pointRadius: 1
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: false,
                    plugins: { 
                        legend: { 
                            display: true, 
                            labels: { color: '#e0e0e0' } 
                        }
                    },
                    scales: {
                        x: { 
                            display: true,
                            ticks: { maxTicksLimit: 10, color: '#aaa' },
                            grid: { color: '#333' }
                        },
                        yTurbidity: {
                            type: 'linear',
                            display: true,
                            position: 'left',
                            reverse: true,
                            min: 0,
                            max: 5,
                            grid: { color: '#333' },
                            ticks: { color: '#bb86fc' },
                            title: { display: true, text: 'Turbidity (V)', color: '#bb86fc' }
                        },
                        yTDS: {
                            type: 'linear',
                            display: true,
                            position: 'right',
                            grid: { drawOnChartArea: false },
                            ticks: { color: '#f2c94c' },
                            title: { display: true, text: 'TDS (ppm)', color: '#f2c94c' }
                        }
                    }
                }
            });
        }
    }, []);

    useEffect(() => {
        if (chartRef.current) {
            const chart = chartRef.current;
            chart.data.labels = data.map(d => d.timeLabel);
            chart.data.datasets[0].data = data.map(d => d.turbidity);
            chart.data.datasets[1].data = data.map(d => d.tds);
            chart.update();
        }
    }, [data]);

    const handleDownloadCSV = () => {
        if (!data || data.length === 0) return;
        const headers = ["Time", "Turbidity (V)", "TDS (ppm)"];
        const csvRows = [
            headers.join(','),
            ...data.map(d => [
                `"${d.timeLabel}"`,
                d.turbidity,
                d.tds
            ].join(','))
        ];
        const csvData = csvRows.join('\n');
        const blob = new Blob([csvData], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('hidden', '');
        a.setAttribute('href', url);
        a.setAttribute('download', `draincheck_sensor_${sensorId}_data.csv`);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    return (
        <div className="chart-card" id={`card-${sensorId.toLowerCase()}`} style={{ border: '1px solid #333', background: 'rgba(30,30,30,0.6)', backdropFilter: 'blur(10px)' }}>
            <div className="chart-header" style={{ background: 'rgba(0,0,0,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0 }}>Sensor {sensorId.replace('S', '')} Data Stream</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <button 
                        onClick={handleDownloadCSV} 
                        style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #555', backgroundColor: '#333', color: 'white', cursor: 'pointer', fontSize: '12px' }}
                    >
                        Export CSV
                    </button>
                    <span className="water-level" style={{ color: '#03dac6' }}>Level: {level ? `${Math.round(level)} mm` : '-- mm'}</span>
                </div>
            </div>
            <div className="chart-body">
                <canvas ref={canvasRef}></canvas>
            </div>
            <div 
                className={`ir-strip ${irState === 0 ? 'broken' : ''}`}
                style={{ opacity: isPulsing ? 0.5 : 1, transition: 'opacity 0.15s', height: '6px', fontSize: 0 }}
                title={irState === 0 ? 'Beam Broken' : 'Beam Intact'}
            >
            </div>
        </div>
    );
}
