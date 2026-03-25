"""
dashboard.py
SafeWalk Autonomous Audio Interface — Loop & Auto-Activation Edition
🛡️ Features: Manual Start, Auto-Activation (Shake/Sound), 5s Silent Cycle
"""

import streamlit as st  # type: ignore
import streamlit.components.v1 as components  # type: ignore
import httpx  # type: ignore
import os
import math
from datetime import datetime
from dotenv import load_dotenv  # type: ignore

load_dotenv()

# ── Config ────────────────────────────────────────────────────────────────────
st.set_page_config(page_title="SafeWalk Autonomous Engine", page_icon="🛡️", layout="centered")
BASE_URL = "http://localhost:8000"

st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@700;800&display=swap');
    html, body, [class*="css"] { font-family: 'Syne', sans-serif; background: #08080f; color: #f0f0f0; }
    .stApp { background: #08080f; }
    .hero-title { font-size: 2.8rem; font-weight: 800; background: linear-gradient(135deg, #ff4e6a, #ff8c42); -webkit-background-clip: text; -webkit-text-fill-color: transparent; text-align: center; }
    .label-mono { font-family: 'Space Mono', monospace; font-size: 0.7rem; color: #ff4e6a; letter-spacing: 0.14em; text-transform: uppercase; margin: 0.5rem 0; }
</style>
""", unsafe_allow_html=True)

# ── Header ────────────────────────────────────────────────────────────────────
st.markdown('<div class="hero-title">🛡️ SafeWalk</div>', unsafe_allow_html=True)
st.markdown('<p style="text-align:center;color:#555;margin-bottom:1rem;">Autonomous Audio Threat Detection Node</p>', unsafe_allow_html=True)

# ── JS COMPONENT: The "Brain" ─────────────────────────────────────────────────

AUTONOMOUS_ENGINE_HTML = f"""
<style>
    body{{ background: #10101a; color: #f0f0f0; font-family: sans-serif; margin:0; padding:20px; text-align:center; border: 1px solid #1c1c2e; border-radius:16px; }}
    .status{{ font-family: monospace; font-size: 0.8rem; margin-bottom: 20px; }}
    .btn-row{{ display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }}
    button{{ 
        padding: 10px 20px; border-radius: 8px; border: none; font-weight: 800; cursor: pointer; transition: 0.2s;
        font-family: 'Syne', sans-serif;
    }}
    .btn-start{{ background: linear-gradient(135deg, #22c55e, #10b981); color: white; }}
    .btn-stop{{ background: linear-gradient(135deg, #ef4444, #dc2626); color: white; }}
    .btn-start:disabled{{ opacity: 0.3; cursor: not-allowed; }}
    .btn-stop:disabled{{ opacity: 0.3; cursor: not-allowed; }}
    .btn-clear{{ background: #1c1c2e; color: #888; border: 1px solid #1c1c2e; }}
    .btn-clear:hover{{ background: #1f1f33; color: #fff; border-color: #333; }}
    #visualizer {{ width: 100%; height: 60px; margin-bottom: 10px; border-radius: 8px; background: rgba(0,0,0,0.2); }}
    .rec-dot {{ width: 8px; height: 8px; background: #ff4e6a; border-radius: 50%; display: inline-block; margin-right: 5px; animation: blink 1s infinite; }}
    @keyframes blink {{ 0% {{ opacity: 1; }} 50% {{ opacity: 0.3; }} 100% {{ opacity: 1; }} }}
</style>

<div class="status" id="status">IDLE — Sensors Active 📡</div>
<canvas id="visualizer"></canvas>
<div class="btn-row">
    <button class="btn-start" id="startBtn" onclick="activate('MANUAL')">🚀 TALK</button>
    <button class="btn-stop" id="stopBtn" onclick="deactivate()" disabled>🛑 STOP</button>
    <button class="btn-clear" onclick="clearConsole()">🧹 CLEAR</button>
</div>

<!-- 🔍 LIVE INTELLIGENCE CONSOLE -->
<div id="intelligence-console" style="margin-top:15px; display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
    
    <!-- 👁️ VISION FRAME -->
    <div id="vision-frame" style="padding:15px; border-radius:12px; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.08); box-shadow: 0 4px 15px rgba(0,0,0,0.5);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <div style="font-weight:bold; color:#888; letter-spacing:1px; font-size:0.65rem;">👁️ VISION SCANNER</div>
            <div id="vision-badge" style="font-size:0.6rem; color:#666; font-weight:800;">OFFLINE</div>
        </div>
        <div id="vision-placeholder" style="height:150px; display:flex; align-items:center; justify-content:center; border:1px dashed #333; border-radius:8px; font-size:0.7rem; color:#444;">WAITING FOR TRIGGER</div>
        <div id="vision-active-content" style="display:none;">
            <div id="vision-result" style="margin-bottom:10px; font-size:0.75rem;">...</div>
            <div style="border-radius:8px; overflow:hidden; border:1px solid rgba(255,255,255,0.1); position:relative; background:#000;">
                <img id="vision-preview" style="width:100%; height:auto; display:block; filter: sepia(30%) brightness(0.8) contrast(1.2);">
                <div style="position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; background: repeating-linear-gradient(0deg, rgba(0,0,0,0.05) 0px, rgba(0,0,0,0) 2px); opacity:0.3;"></div>
            </div>
        </div>
    </div>

    <!-- 📍 LOCATION FRAME -->
    <div id="location-frame" style="padding:15px; border-radius:12px; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.08); box-shadow: 0 4px 15px rgba(0,0,0,0.5);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <div style="font-weight:bold; color:#888; letter-spacing:1px; font-size:0.65rem;">📍 SPATIAL TRACKER</div>
            <div id="gps-status" style="font-size:0.6rem; color:#666; font-weight:800;">OFFLINE</div>
        </div>
        <div id="location-placeholder" style="height:150px; display:flex; align-items:center; justify-content:center; border:1px dashed #333; border-radius:8px; font-size:0.7rem; color:#444;">WAITING FOR TRIGGER</div>
        <div id="location-active-content" style="display:none;">
            <div id="map-frame-container" style="margin-bottom:10px; border-radius:8px; overflow:hidden; border:1px solid #333; height:150px;">
                <iframe id="map-frame" width="100%" height="150" frameborder="0" style="border:0;" allowfullscreen></iframe>
            </div>
            <div id="location-result" style="margin-bottom:5px; font-family:monospace; font-size:0.7rem;">Waiting...</div>
            <div id="location-meta" style="font-size:0.65rem; color:#888;">Speed: 0.0m/s | Stay: 0s</div>
        </div>
    </div>

</div>

<div id="alert-log" style="margin-top:20px; text-align:left;"></div>

<video id="video-feed" autoplay playsinline muted style="display:none;"></video>
<canvas id="vision-canvas" style="display:none;"></canvas>

<script>
const BACKEND_URL = "{BASE_URL}/api/v1/audio/analyse";
let isRunning = false;
let recorder, stream;
let audioCtx, analyser, dataArray;
const statusEl = document.getElementById('status');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const alertLog = document.getElementById('alert-log');
const canvas = document.getElementById('visualizer');
const ctx = canvas.getContext('2d');
let drawVisual;

// Vision Variables
const video = document.getElementById('video-feed');
const visionCanvas = document.getElementById('vision-canvas');
const visionCtx = visionCanvas.getContext('2d');
let visionInterval = null;
let watchId = null;
let gpsHistory = [];
const MAX_GPS_HISTORY = 5;

// ── 1. Activation Sensors ──────────────────────────

// A. Shake Detection
window.addEventListener('devicemotion', (e) => {{
    if (isRunning) return;
    const thresh = 25;
    const a = e.accelerationIncludingGravity;
    if (a && (Math.abs(a.x) > thresh || Math.abs(a.y) > thresh || Math.abs(a.z) > thresh)) {{
        activate("AUTO (Movement)");
    }}
}});

// B. Sound Spike
async function startPassiveMonitoring() {{
    try {{
        stream = await navigator.mediaDevices.getUserMedia({{ audio: true }});
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);
        analyser.fftSize = 256;
        dataArray = new Uint8Array(analyser.frequencyBinCount);
        
        if (audioCtx.state === 'suspended') {{
            await audioCtx.resume();
        }}
        
        // Match canvas size to display
        canvas.width = canvas.clientWidth || 300;
        canvas.height = canvas.clientHeight || 60;
        
        if (!drawVisual) {{
            draw();
        }}
        startAudio();
    }} catch (err) {{
        statusEl.innerText = "Mic Permission Denied";
    }}
}}

function startAudio() {{
    checkSound();
}}

function checkSound() {{
    if (isRunning) return;
    analyser.getByteFrequencyData(dataArray);
    let avg = dataArray.reduce((a,b) => a+b) / dataArray.length;
    if (avg > 80) activate("AUTO (Sound Spike)");
    else requestAnimationFrame(checkSound);
}}

// ── 2. Activation Logic ────────────────────────────

async function activate(mode) {{
    if (isRunning) return;
    isRunning = true;
    startBtn.disabled = true;
    stopBtn.disabled = false;
    
    if (!stream) {{
        await startPassiveMonitoring();
    }}
    
    statusEl.innerText = "● ACTIVE — " + mode;
    statusEl.style.color = "#ff4e6a";
    startLoop();
}}

function deactivate() {{
    isRunning = false;
    startBtn.disabled = false;
    stopBtn.disabled = true;
    
    if (drawVisual) {{
        cancelAnimationFrame(drawVisual);
        drawVisual = null;
    }}
    if (stream) {{
        stream.getTracks().forEach(t => t.stop());
        stream = null;
    }}
    if (visionInterval) clearInterval(visionInterval);
    if (watchId) navigator.geolocation.clearWatch(watchId);
    visionInterval = null;
    watchId = null;
    gpsHistory = [];
    
    // Reset UI Frames
    document.getElementById('vision-placeholder').style.display = "flex";
    document.getElementById('vision-active-content').style.display = "none";
    document.getElementById('location-placeholder').style.display = "flex";
    document.getElementById('location-active-content').style.display = "none";
    document.getElementById('vision-badge').innerText = "OFFLINE";
    document.getElementById('vision-badge').style.color = "#666";
    document.getElementById('gps-status').innerText = "OFFLINE";
    document.getElementById('gps-status').style.color = "#666";
    
    statusEl.innerText = "IDLE — Sensors Active 📡";
    statusEl.style.color = "#f0f0f0";
}}

// ── 3. The 6-Second Loop (1s Standby + 5s Record) ─────────────────────

async function startLoop() {{
    if (!stream) stream = await navigator.mediaDevices.getUserMedia({{ audio: true }});
    
    const cycle = async () => {{
        if (!isRunning) return;
        
        // 🛡️ Warm-up period to avoid audio clipping
        statusEl.innerText = "⏳ STANDBY (1s)...";
        statusEl.style.color = "#ff8c42";
        
        setTimeout(() => {{
            if (!isRunning) return;
            statusEl.innerText = "● RECORDING (Speak Now!)";
            statusEl.style.color = "#ff4e6a";
            
            const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
                             ? 'audio/webm;codecs=opus' : 'audio/webm';
            
            const mr = new MediaRecorder(stream, {{ mimeType: mimeType }});
            let chunks = [];
            mr.ondataavailable = e => {{ if (e.data.size > 0) chunks.push(e.data); }};
            mr.onstop = async () => {{
                statusEl.innerText = "⚡ ANALYSING...";
                statusEl.style.color = "#22c55e";
                if (chunks.length === 0) {{
                    setTimeout(cycle, 100);
                    return;
                }}
                const blob = new Blob(chunks, {{ type: mimeType }});
                const reader = new FileReader();
                reader.onloadend = () => sendToBackend(reader.result.split(',')[1], mimeType);
                reader.readAsDataURL(blob);
                setTimeout(cycle, 50); 
            }};
            
            mr.start();
            setTimeout(() => mr.stop(), 5000); // Record for 5 seconds
        }}, 1000); // 1 second standby
    }};
    
    cycle();
}}

async function sendToBackend(b64, mimeType) {{
    try {{
        const res = await fetch(BACKEND_URL, {{
            method: 'POST',
            headers: {{ 'Content-Type': 'application/json' }},
            body: JSON.stringify({{ 
                audio_b64: b64,
                mime_type: mimeType
            }})
        }});
        const data = await res.json();
        updateUI(data.result, data.sms_triggered, "AUDIO", data.filter);
    }} catch (err) {{
        console.error("❌ Audio Fetch Error:", err);
        const failRes = {{ 
            is_threat: false, 
            confidence: 0.0, 
            transcription: "Network/Server Error", 
            raw_analysis: "The backend server might be offline or crashed. Check the terminal." 
        }};
        updateUI(failRes, false, "AUDIO", null);
    }}
}}

function startVision() {{
    const constraints = {{ 
        video: {{ 
            facingMode: {{ ideal: "environment" }},
            width: {{ ideal: 480 }},
            height: {{ ideal: 320 }}
        }} 
    }};
    
    navigator.mediaDevices.getUserMedia(constraints)
    .then(s => {{
        video.srcObject = s;
        video.onloadedmetadata = () => {{
            video.play();
            document.getElementById('vision-placeholder').style.display = "none";
            document.getElementById('vision-active-content').style.display = "block";
            document.getElementById('vision-badge').innerHTML = '<span class="rec-dot"></span>LIVE';
            document.getElementById('vision-badge').style.color = "#ff4e6a";
            visionInterval = setInterval(captureAndAnalyse, 4000);
        }};
    }})
    .catch(err => {{
        console.error("Camera access denied:", err);
    }});
}}

function startLocation() {{
    const locationPlaceholder = document.getElementById('location-placeholder');
    if (locationPlaceholder.style.display === "none") return; // Already running
    
    locationPlaceholder.style.display = "none";
    document.getElementById('location-active-content').style.display = "block";
    document.getElementById('gps-status').innerText = "🛰️ ACTIVE";
    document.getElementById('gps-status').style.color = "#4caf50";
    
    if (navigator.geolocation) {{
        watchId = navigator.geolocation.watchPosition(updateGPS, handleGPSError, {{
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0
        }});
    }}
}}

async function updateGPS(pos) {{
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    const ts = Date.now();
    
    gpsHistory.push({{ lat, lon, ts }});
    if (gpsHistory.length > MAX_GPS_HISTORY) gpsHistory.shift();
    
    const mapFrame = document.getElementById('map-frame');
    mapFrame.src = `https://maps.google.com/maps?q=${{lat}},${{lon}}&z=18&output=embed`;
    
    const lastSend = window.lastLocationSend || 0;
    if (ts - lastSend > 10000) {{
        window.lastLocationSend = ts;
        performLocationAnalysis(lat, lon);
    }}
}}

function handleGPSError(err) {{
    console.error("GPS Watch Error:", err);
    document.getElementById('gps-status').innerText = "⚠️ OFFLINE";
}}

async function performLocationAnalysis(lat, lon) {{
    try {{
        const resp = await fetch('http://localhost:8000/api/v1/location/analyse', {{
            method: 'POST',
            headers: {{ 'Content-Type': 'application/json' }},
            body: JSON.stringify({{
                history: gpsHistory,
                current_lat: lat,
                current_lon: lon
            }})
        }});
        const data = await resp.json();
        if (data.success) {{
            const res = data.result;
            const color = res.is_threat ? "#ff4e6a" : "#4caf50";
            document.getElementById('location-result').innerHTML = `<span style="color:${{color}}">${{res.raw_analysis}}</span>`;
            document.getElementById('location-meta').innerText = `Speed: ${{res.current_speed.toFixed(1)}}m/s | Stay: ${{res.stationary_duration}}s`;
        }}
    }} catch (err) {{
        console.error("📍 Location API Error:", err);
    }}
}}

async function captureAndAnalyse() {{
    if (video.videoWidth === 0 || video.readyState < 2) return;
    
    visionCanvas.width = video.videoWidth;
    visionCanvas.height = video.videoHeight;
    visionCtx.drawImage(video, 0, 0);
    const b64 = visionCanvas.toDataURL('image/jpeg', 0.6); 
    
    document.getElementById('vision-preview').src = b64;
    
    try {{
        const res = await fetch('{BASE_URL}/api/v1/vision/analyse', {{
            method: 'POST',
            headers: {{ 'Content-Type': 'application/json' }},
            body: JSON.stringify({{ image_b64: b64 }})
        }});
        const data = await res.json();
        updateVisionUI(data.result, data.sms_triggered, data.filter);
    }} catch (err) {{
        console.error("Vision Analysis Failed:", err);
    }}
}}

function updateVisionUI(res, smsTriggered, filter) {{
    const color = res.is_threat ? "#ff4e6a" : "#22c55e";
    const statusDisp = document.getElementById('vision-result');
    statusDisp.innerHTML = `
        <div style="color:${{color}}; font-weight:bold;">${{res.threat_type.toUpperCase()}} (${{(res.confidence*100).toFixed(0)}}%)</div>
        <div style="color:#ccc; font-size:0.7rem; margin-top:2px;">${{res.raw_analysis}}</div>
        <div style="font-size:0.6rem; color:#888; margin-top:4px;">👁️ Persons: ${{res.persons_detected}} | ${{res.proximity}}</div>
    `;
    if (res.is_threat) {{
        updateUI(res, smsTriggered, "VISION", filter);
    }}
}}

function updateUI(res, smsTriggered, source, filter) {{
    const color = res.is_threat ? "#ff4e6a" : "#22c55e";
    const bg = res.is_threat ? "#2d0a11" : "#052e16";
    const alertIcon = res.is_threat ? (source === "VISION" ? "👁️" : "🚨") : "✅";
    const container = document.getElementById('alert-log');
    
    const entry = document.createElement('div');
    entry.style = `background:${{bg}}; border:1px solid ${{color}}; color:${{color}}; padding:0.8rem; border-radius:10px; margin-bottom:10px; font-family:sans-serif;`;
    
    if (source === "AUDIO" && res.is_threat) {{
        if (!visionInterval) {{
            startVision();
        }}
        if (!watchId) {{
            startLocation();
        }}
    }}
    
    let filterBadge = "";
    if (filter) {{
        const fColor = filter.escalate ? "#ff4e6a" : "#22c55e";
        const fIcon = filter.escalate ? "🚨" : "✅";
        const fLabel = filter.escalate ? "ESCALATED" : "DISMISSED";
        filterBadge = `<div style="border:1px solid ${{fColor}}; color:${{fColor}}; font-size:0.6rem; padding:2px 8px; border-radius:4px; margin-bottom:5px; font-weight:800; display:inline-block; letter-spacing:0.05em;">${{fIcon}} FILTER: ${{fLabel}} — ${{(filter.final_confidence*100).toFixed(0)}}% | ${{filter.agents_flagged}}/3 AGENTS</div>`;
    }}
    let smsBadge = smsTriggered ? '<div style="background:#ff4e6a; color:white; font-size:0.6rem; padding:2px 6px; border-radius:4px; margin-bottom:5px; font-weight:800; display:inline-block;">📲 EMERGENCY SMS DISPATCHED</div>' : "";
    
    let mainText = source === "AUDIO" 
        ? `<div style="font-weight:800; font-size:0.9rem;">${{alertIcon}} ${{res.is_threat ? "THREAT" : "SAFE"}} (${{(res.confidence*100).toFixed(0)}}%)</div>
           <div style="color:#e0e0e0; font-size:0.8rem; margin-top:5px; font-style:italic;">"${{res.transcription || "(no speech detected)"}}"</div>
           <div style="color:#888; font-size:0.68rem; margin-top:4px;">${{res.raw_analysis || ""}}</div>`
        : `<div style="font-weight:800; font-size:0.9rem;">${{alertIcon}} VISUAL ${{res.threat_type.toUpperCase()}} (${{(res.confidence*100).toFixed(0)}}%)</div>
           <div style="color:#ccc; font-size:0.75rem; margin-top:5px;">- ${{res.raw_analysis}}</div>`;

    entry.innerHTML = `
        ${{filterBadge}}
        ${{smsBadge}}
        ${{mainText}}
    `;
    
    container.prepend(entry);
    if (container.children.length > 5) container.removeChild(container.lastChild);
}}

function clearConsole() {{
    const alertLog = document.getElementById('alert-log');
    if (alertLog) alertLog.innerHTML = "";
}}

function draw() {{
    drawVisual = requestAnimationFrame(draw);
    if (!analyser) return;
    analyser.getByteFrequencyData(dataArray);
    
    if (canvas.width === 0) {{
        canvas.width = canvas.clientWidth || 300;
        canvas.height = canvas.clientHeight || 60;
    }}
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const barWidth = (canvas.width / dataArray.length) * 2.5;
    let x = 0;
    
    const activeColor = isRunning ? "#ff4e6a" : "#22c55e";
    
    for (let i = 0; i < dataArray.length; i++) {{
        let barHeight = dataArray[i] / 2;
        ctx.fillStyle = activeColor;
        ctx.globalAlpha = 0.5;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
    }}
}}
</script>
"""

st.markdown('<div class="label-mono">System Console</div>', unsafe_allow_html=True)
components.html(AUTONOMOUS_ENGINE_HTML, height=600, scrolling=True)

st.divider()
col1, col2 = st.columns(2)
with col1:
    st.markdown('<div class="label-mono">Quick Help</div>', unsafe_allow_html=True)
    st.caption("1. 📱 Shake phone to Auto-Activate\\n2. 🎙️ Loud noise triggers Agent\\n3. 🚀 Manual Start for immediate walk")
with col2:
    st.markdown('<div class="label-mono">Emergency Alert Logic</div>', unsafe_allow_html=True)
    st.caption("Confidence >= 0.65 flags threat. Logs are saved locally. Fail-safe active at all stages.")

st.divider()
st.caption("🛡️ SafeWalk Autonomous Audio Node • Zero-Latency Loop • Groq Parallel Pipeline")
