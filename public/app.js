// ══════════════════════════════════════
//  ATMOS — Firebase Dashboard (app.js)
// ══════════════════════════════════════

import { initializeApp }  from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// ── Firebase config ──────────────────────────────────────
const firebaseConfig = {
    apiKey:      "AIzaSyCoumP_vQfqXhgPyXZyaJm6P9lUKr57MNw",
    databaseURL: "https://atmos-10f2c-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId:   "atmos-10f2c",
};

const app = initializeApp(firebaseConfig);
const db  = getDatabase(app);

const rainSound = new Audio('rainStart.mp3');
rainSound.preload = 'auto';
rainSound.volume = 0.65;
rainSound.loop = true;


// ── Theme toggle ─────────────────────────────────────────
const html      = document.documentElement;
const themeBtn  = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');
let isDark = true;

themeBtn.addEventListener('click', () => {
    isDark = !isDark;
    html.setAttribute('data-theme', isDark ? 'dark' : 'light');
    themeIcon.textContent = isDark ? '🌙' : '☀️';
    updateChartTheme();
});

// ── Clock ────────────────────────────────────────────────
setInterval(() => {
    document.getElementById('clock').textContent =
        new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}, 1000);

// ── Rain canvas ──────────────────────────────────────────
const rainCanvas = document.getElementById('rainCanvas');
const rx = rainCanvas.getContext('2d');
let rainActive = false;
let drops = [];

function resizeRain() {
    rainCanvas.width  = window.innerWidth;
    rainCanvas.height = window.innerHeight;
}
resizeRain();
window.addEventListener('resize', resizeRain);

function makeDrop() {
    return {
        x: Math.random() * rainCanvas.width,
        y: Math.random() * rainCanvas.height * -1,
        len: Math.random() * 20 + 10,
        speed: Math.random() * 5 + 8,
        opacity: Math.random() * .5 + .2
    };
}

function animateRain() {
    if (!rainActive) return;
    rx.clearRect(0, 0, rainCanvas.width, rainCanvas.height);
    while (drops.length < 160) drops.push(makeDrop());
    drops.forEach(d => {
        rx.beginPath();
        rx.globalAlpha = d.opacity;
        rx.lineWidth   = 1.2;
        rx.moveTo(d.x, d.y);
        rx.lineTo(d.x - 1, d.y + d.len);
        rx.strokeStyle = isDark ? `rgba(140,200,255,${d.opacity})` : `rgba(80,140,220,${d.opacity})`;
        rx.stroke();
        d.y += d.speed;
        if (d.y > rainCanvas.height) { d.y = -d.len; d.x = Math.random() * rainCanvas.width; }
    });
    requestAnimationFrame(animateRain);
}

function startRain() {
    if (rainActive) return;
    rainActive = true;
    drops = [];
    rainCanvas.classList.add('on');
    rainSound.currentTime = 0;
    rainSound.play().catch(err => console.warn('Rain audio could not start:', err));
    animateRain();
}

function stopRain() {
    rainActive = false;
    rainCanvas.classList.remove('on');
    rx.clearRect(0, 0, rainCanvas.width, rainCanvas.height);
    drops = [];
    rainSound.pause();
    rainSound.currentTime = 0;
}

// ── Arc helper (circumference = 2π×25 ≈ 157) ────────────
const C = 2 * Math.PI * 25;

function setArc(id, pct, color) {
    const el = document.getElementById(id);
    if (!el) return;
    const clamped = Math.min(Math.max(pct, 0), 1);
    el.style.strokeDashoffset = (C * (1 - clamped)).toFixed(2);
    if (color) el.style.stroke = color;
}

// ── Air quality segment highlight ───────────────────────
const AQ_THRESHOLDS = [150, 300, 500, 700, 900, 1024];

function highlightSegment(raw) {
    let active = AQ_THRESHOLDS.length - 1;
    for (let i = 0; i < AQ_THRESHOLDS.length; i++) {
        if (raw < AQ_THRESHOLDS[i]) { active = i; break; }
    }
    for (let i = 0; i < 6; i++) {
        const s = document.getElementById('seg' + i);
        s.classList.toggle('active', i === active);
    }
}

// ── Chart history ────────────────────────────────────────
const MAX_PTS = 20;
const history = { t: [], h: [], a: [], p: [], labels: [] };

function pushHistory(data) {
    const label = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    history.t.push(parseFloat(data.temp));
    history.h.push(parseFloat(data.hum));
    history.a.push(data.airRaw);
    history.p.push(data.ppm);
    history.labels.push(label);
    ['t','h','a','p','labels'].forEach(k => {
        if (history[k].length > MAX_PTS) history[k].shift();
    });
}

// ── Chart factory ────────────────────────────────────────
function gridColor()  { return isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.07)'; }
function tickColor()  { return isDark ? '#5a6480' : '#8892aa'; }

function makeChart(canvasId, color, yMin, yMax) {
    return new Chart(document.getElementById(canvasId), {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                data: [], borderColor: color,
                backgroundColor: color + '22',
                borderWidth: 2, pointRadius: 2,
                tension: .4, fill: true
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            animation: { duration: 300 },
            plugins: { legend: { display: false } },
            scales: {
                x: {
                    ticks:  { color: tickColor(), font: { size: 9 }, maxTicksLimit: 5, maxRotation: 0 },
                    grid:   { color: gridColor() },
                    border: { display: false }
                },
                y: {
                    min: yMin, max: yMax,
                    ticks:  { color: tickColor(), font: { size: 9 }, maxTicksLimit: 5 },
                    grid:   { color: gridColor() },
                    border: { display: false }
                }
            }
        }
    });
}

const charts = [
    makeChart('chartTemp', '#fb923c',   0,   50),
    makeChart('chartHum',  '#6c8eff',   0,  100),
    makeChart('chartAir',  '#a78bfa',   0, 1023),
    makeChart('chartPpm',  '#34d399', 400, 5000),
];
const chartKeys = ['t', 'h', 'a', 'p'];

function updateChartTheme() {
    charts.forEach(c => {
        c.options.scales.x.ticks.color = tickColor();
        c.options.scales.y.ticks.color = tickColor();
        c.options.scales.x.grid.color  = gridColor();
        c.options.scales.y.grid.color  = gridColor();
        c.update('none');
    });
}

function updateChartData() {
    charts.forEach((c, i) => {
        c.data.labels              = [...history.labels];
        c.data.datasets[0].data   = [...history[chartKeys[i]]];
        c.update('none');
    });
}

// ── Air quality colour mapping ───────────────────────────
function airColor(raw) {
    if (raw < 150) return '#00c896';
    if (raw < 300) return '#7bc800';
    if (raw < 500) return '#f0b800';
    if (raw < 700) return '#f07000';
    if (raw < 900) return '#e03000';
    return '#9000cc';
}

function airLabel(raw) {
    if (raw < 150) return 'Excellent';
    if (raw < 300) return 'Good';
    if (raw < 500) return 'Moderate';
    if (raw < 700) return 'Poor';
    if (raw < 900) return 'Bad';
    return 'Hazardous';
}

// ── Comfort badge helper ─────────────────────────────────
const comfortMap = {
    'Dry':         'badge badge-yellow',
    'Comfortable': 'badge badge-green',
    'Hot & Humid': 'badge badge-orange',
    'Normal':      'badge badge-green',
};

// ── DOM update ───────────────────────────────────────────
function updateUI(data) {

    // Status pill → LIVE
    const pill = document.getElementById('statusPill');
    pill.className = 'status-pill online';
    document.getElementById('statusTxt').textContent = 'LIVE';

    // ─ Temperature ─
    const temp = parseFloat(data.temp);
    document.getElementById('temp').textContent = temp.toFixed(1);
    document.getElementById('feelsLike').textContent = parseFloat(data.feels ?? temp).toFixed(1);
    setArc('arcTemp', temp / 50, '#fb923c');

    // Heat alert when ≥40°C
    const tempCard  = document.getElementById('tempCard');
    const heatOverlay = document.getElementById('heatOverlay');
    const isHot = temp >= 40;
    tempCard.classList.toggle('heat-alert', isHot);
    heatOverlay.classList.toggle('on', isHot);

    // Comfort badge
    const comfort = data.comfort ?? 'Normal';
    const badge   = document.getElementById('comfortBadge');
    badge.textContent = comfort;
    badge.className   = comfortMap[comfort] ?? 'badge badge-green';

    // ─ Humidity ─
    const hum = parseFloat(data.hum);
    document.getElementById('hum').textContent = hum.toFixed(1);
    setArc('arcHum', hum / 100, '#6c8eff');

    // ─ Air Quality / PPM ─
    const ppm    = data.ppm;
    const raw    = data.airRaw ?? data.airraw ?? 0;
    const color  = data.airColor ?? airColor(raw);
    const label  = data.airQuality ?? airLabel(raw);

    document.getElementById('ppm').textContent      = ppm;
    document.getElementById('airRawSmall').textContent = raw;
    setArc('arcPpm', (ppm - 400) / 4600, color);

    // Gas alert badge
    const gasBadge = document.getElementById('gasAlertBadge');
    if (data.gasAlert) {
        gasBadge.textContent = '⚠ Alert';
        gasBadge.className   = 'badge badge-red';
    } else {
        gasBadge.textContent = '✓ Normal';
        gasBadge.className   = 'badge badge-green';
    }

    // ─ AQ Panel ─
    document.getElementById('aqLabel').textContent = label;
    document.getElementById('aqLabel').style.color = color;
    document.getElementById('airRaw').textContent  = raw;
    document.getElementById('aqPpm').textContent   = ppm;
    highlightSegment(raw);

    // ─ Rain ─
    const rainPanel = document.getElementById('rainPanel');
    if (data.rain) {
        document.getElementById('rainTitle').textContent = 'Rain Detected';
        document.getElementById('rainDesc').textContent  = 'Sensor is wet';
        document.getElementById('rainIcon').textContent  = '🌧️';
        rainPanel.style.borderColor = 'rgba(96,165,250,.5)';
        rainPanel.style.boxShadow   = '0 0 0 2px rgba(96,165,250,.25)';
        startRain();
    } else {
        document.getElementById('rainTitle').textContent = 'No Rain';
        document.getElementById('rainDesc').textContent  = 'Clear conditions';
        document.getElementById('rainIcon').textContent  = '☀️';
        rainPanel.style.borderColor = '';
        rainPanel.style.boxShadow   = '';
        stopRain();
    }

    // ─ Charts ─
    pushHistory(data);
    updateChartData();
}

// ── Firebase listener ────────────────────────────────────
const sensorRef = ref(db, 'sensorData');

onValue(sensorRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
        updateUI(data);
    }
}, (error) => {
    // Mark as offline on Firebase error
    const pill = document.getElementById('statusPill');
    pill.className = 'status-pill offline';
    document.getElementById('statusTxt').textContent = 'OFFLINE';
    console.error('Firebase error:', error);
});
