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
                            backgroundColor: 'rgba(187, 134, 252, 0.1)',
                            data: [],
                            yAxisID: 'yTurbidity',
                            fill: true,
                            tension: 0.2
                        },
                        {
                            label: 'EC (µS/cm)',
                            borderColor: '#03dac6',
                            data: [],
                            yAxisID: 'yEC',
                            tension: 0.2
                        },
                        {
                            label: 'TDS (ppm)',
                            borderColor: '#f2c94c',
                            data: [],
                            yAxisID: 'yEC',
                            tension: 0.2
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { display: false },
                        yTurbidity: {
                            type: 'linear',
                            display: true,
                            position: 'left',
                            reverse: true,
                            min: 0,
                            max: 5,
                            grid: { color: '#333' }
                        },
                        yEC: {
                            type: 'linear',
                            display: true,
                            position: 'right',
                            grid: { drawOnChartArea: false }
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
        <div className="chart-card" id={`card-${sensorId.toLowerCase()}`}>
            <div className="chart-header">
                <h2>Sensor {sensorId.replace('S', '')}</h2>
                <span className="water-level">{level ? `${Math.round(level)} mm` : '-- mm'}</span>
            </div>
            <div className="chart-body">
                <canvas ref={canvasRef}></canvas>
            </div>
            <div 
                className={`ir-strip ${irState === 0 ? 'broken' : ''}`}
                style={{ opacity: isPulsing ? 0.5 : 1, transition: 'opacity 0.15s' }}
            >
                {irState === 0 ? 'Beam Broken' : 'Beam Intact'}
            </div>
        </div>
    );
}
