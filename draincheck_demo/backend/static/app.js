document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Map
    const map = L.map('map').setView([-33.8689, 151.2094], 19);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 22,
        attribution: '© OpenStreetMap'
    }).addTo(map);

    const sensors = {
        'S1': { lat: -33.8688, lon: 151.2093 },
        'S2': { lat: -33.8689, lon: 151.2094 },
        'S3': { lat: -33.8690, lon: 151.2095 }
    };

    const markers = {};
    for (const [id, pos] of Object.entries(sensors)) {
        markers[id] = L.circleMarker([pos.lat, pos.lon], {
            radius: 8,
            color: '#3b82f6',
            fillColor: '#3b82f6',
            fillOpacity: 0.8
        }).addTo(map);
        markers[id].bindTooltip(id, { permanent: true, direction: 'right' });
    }

    let sourceMarker = null;

    // 2. Initialize Charts
    const charts = {};
    const maxDataPoints = 120;

    function createChart(ctxId) {
        const ctx = document.getElementById(ctxId).getContext('2d');
        return new Chart(ctx, {
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
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: { display: false },
                    yTurbidity: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        reverse: true, // Inverted so lower voltage = higher line
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

    charts['S1'] = createChart('chart-s1');
    charts['S2'] = createChart('chart-s2');
    charts['S3'] = createChart('chart-s3');

    // 3. Connect to SSE
    const evtSource = new EventSource('/api/stream');

    evtSource.onmessage = function(event) {
        const data = JSON.parse(event.data);
        
        if (data.type === 'reading') {
            const sid = data.sensor_id;
            const chart = charts[sid];
            if (!chart) return;

            const timeLabel = new Date(data.t * 1000).toLocaleTimeString();
            chart.data.labels.push(timeLabel);
            chart.data.datasets[0].data.push(data.turbidity_voltage);
            chart.data.datasets[1].data.push(data.ec_us_cm);
            chart.data.datasets[2].data.push(data.tds_ppm);

            if (chart.data.labels.length > maxDataPoints) {
                chart.data.labels.shift();
                chart.data.datasets[0].data.shift();
                chart.data.datasets[1].data.shift();
                chart.data.datasets[2].data.shift();
            }
            chart.update();

            // Update IR strip securely using textContent
            const irStrip = document.getElementById(`ir-${sid.toLowerCase()}`);
            if (data.ir_beam_state === 1) {
                irStrip.textContent = 'Beam Intact';
                irStrip.classList.remove('broken');
            } else {
                irStrip.textContent = 'Beam Broken';
                irStrip.classList.add('broken');
            }

            // Update level securely
            const levelSpan = document.getElementById(`level-${sid.toLowerCase()}`);
            levelSpan.textContent = `${Math.round(data.water_level_mm)} mm`;
        } 
        else if (data.type === 'event_start') {
            const banner = document.getElementById('alert-banner');
            banner.className = 'alert-banner yellow';
            banner.textContent = `Event detected at ${data.first_sensor} — analyzing source...`;
            
            pulseMarker(data.first_sensor);
            flashStrip(data.first_sensor);
        }
        else if (data.type === 'sensor_triggered') {
            pulseMarker(data.sensor_id);
            flashStrip(data.sensor_id);
        }
        else if (data.type === 'event_resolved') {
            const banner = document.getElementById('alert-banner');
            banner.className = 'alert-banner red';
            
            const timeStr = new Date(data.beam_trigger_times[data.first_sensor] * 1000).toLocaleTimeString();
            
            // XSS Prevention: Use standard textContent
            banner.textContent = `Contamination event detected at ${timeStr}. ` +
                                 `Source: ${data.source_description}. ` +
                                 `Signature: ${data.pollutant_signature.join(', ')}. ` +
                                 `Confidence: ${data.confidence.toUpperCase()}`;
                                 
            addHistoryRow(timeStr, data.first_sensor, data.source_description, data.pollutant_signature.join(', '), data.confidence);
            
            if (sourceMarker) {
                map.removeLayer(sourceMarker);
            }
            
            const fs = sensors[data.first_sensor];
            let slat = fs.lat + 0.00005;
            let slon = fs.lon - 0.00005;
            
            const redIcon = L.divIcon({
                className: 'pulse-icon',
                html: '<div style="background:red;width:100%;height:100%;border-radius:50%"></div>',
                iconSize: [24, 24]
            });
            sourceMarker = L.marker([slat, slon], {icon: redIcon}).addTo(map);
        }
    };

    function pulseMarker(sid) {
        if (markers[sid]) {
            markers[sid].setStyle({ color: '#cf6679', fillColor: '#cf6679' });
            setTimeout(() => {
                markers[sid].setStyle({ color: '#3b82f6', fillColor: '#3b82f6' });
            }, 3000);
        }
    }

    function flashStrip(sid) {
        const irStrip = document.getElementById(`ir-${sid.toLowerCase()}`);
        if (irStrip) {
            irStrip.style.opacity = '0.5';
            setTimeout(() => { irStrip.style.opacity = '1'; }, 150);
        }
    }

    function addHistoryRow(time, firstSensor, source, signature, conf) {
        const tbody = document.querySelector('#history-table tbody');
        const tr = document.createElement('tr');
        
        [time, firstSensor, source, signature, conf].forEach(text => {
            const td = document.createElement('td');
            td.textContent = text;
            tr.appendChild(td);
        });
        
        tbody.prepend(tr);
        if (tbody.children.length > 10) {
            tbody.removeChild(tbody.lastChild);
        }
    }

    document.getElementById('reset-btn').addEventListener('click', () => {
        fetch('/api/reset_baseline', { method: 'POST' })
            .then(res => res.json())
            .then(data => {
                const banner = document.getElementById('alert-banner');
                banner.className = 'alert-banner hidden';
                banner.textContent = '';
                if (sourceMarker) {
                    map.removeLayer(sourceMarker);
                    sourceMarker = null;
                }
            });
    });

    fetch('/api/events')
        .then(res => res.json())
        .then(events => {
            events.reverse().forEach(ev => {
                const timeStr = new Date(ev.started_at * 1000).toLocaleTimeString();
                addHistoryRow(timeStr, ev.first_sensor, ev.source_description, ev.pollutant_signature.join(', '), ev.confidence);
            });
        });
});
