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
                            label: 'EC (µS/cm)',
                            borderColor: '#03dac6',
                            data: [],
                            yAxisID: 'yEC',
                            tension: 0.3,
                            borderWidth: 2,
                            pointRadius: 1
                        },
                        {
                            label: 'TDS (ppm)',
                            borderColor: '#f2c94c',
                            data: [],
                            yAxisID: 'yEC',
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
                        yEC: {
                            type: 'linear',
                            display: true,
                            position: 'right',
                            grid: { drawOnChartArea: false },
                            ticks: { color: '#03dac6' },
                            title: { display: true, text: 'Conductivity', color: '#03dac6' }
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
            chart.data.datasets[1].data = data.map(d => d.ec);
            chart.data.datasets[2].data = data.map(d => d.tds);
            chart.update();
        }
    }, [data]);

    return (
        <div className="chart-card" id={`card-${sensorId.toLowerCase()}`} style={{ border: '1px solid #333', background: 'rgba(30,30,30,0.6)', backdropFilter: 'blur(10px)' }}>
            <div className="chart-header" style={{ background: 'rgba(0,0,0,0.2)' }}>
                <h2>Sensor {sensorId.replace('S', '')} Data Stream</h2>
                <span className="water-level" style={{ color: '#03dac6' }}>Level: {level ? `${Math.round(level)} mm` : '-- mm'}</span>
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
