// --- Configuration ---
const CAMERA_IP = '10.176.12.35';
const USER = 'root';
const PASS = 'Axis%40125Apass'; // URL encoded password
const BASE_URL = `http://${USER}:${PASS}@${CAMERA_IP}/axis-cgi/media.cgi`;
const PARAM_URL = `http://${USER}:${PASS}@${CAMERA_IP}/axis-cgi/param.cgi`;

// --- Three.js Globals ---
let scene, camera, renderer, composer;
let particles, starGeo;
const velocities = [];
const accelerations = [];

// --- Video Player Logic ---

function changeStream(overlayType, btnElement) {
    const player = document.getElementById('main-player');
    const source = document.getElementById('video-source');
    const statusText = document.getElementById('stream-status');

    // Update Button States
    document.querySelectorAll('.controls-container .control-btn').forEach(btn => btn.classList.remove('active'));
    if (btnElement) btnElement.classList.add('active');

    // Construct URL
    const url = `${BASE_URL}?videocodec=av1&container=mp4&videolayers=1&overlays=${overlayType}`;

    console.log(`Switching stream to: ${url}`);

    // Update Source
    source.src = url;
    player.load();
    player.play().catch(e => console.log("Autoplay prevented:", e));

    // Update Status
    statusText.textContent = `Stream Active: Overlays = ${overlayType.toUpperCase()}`;
}

// --- Recording Logic ---

let mediaRecorder;
let recordedChunks = [];
let isRecording = false;
let recordStartTime;
let recordTimerInterval;

function toggleRecording() {
    if (isRecording) {
        stopRecording();
    } else {
        startRecording();
    }
}

function startRecording() {
    const player = document.getElementById('main-player');

    // Check if stream is active
    if (player.readyState === 0) {
        alert("No video stream to record!");
        return;
    }

    try {
        // Capture stream from video element
        // Note: This requires the video to be CORS-enabled or same-origin
        const stream = player.captureStream();

        mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9' });

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = saveRecording;

        mediaRecorder.start();
        isRecording = true;

        // UI Updates
        document.getElementById('btn-record').classList.add('recording');
        document.getElementById('record-text').textContent = "Stop Recording";
        document.getElementById('recording-timer').classList.remove('hidden');

        // Start Timer
        recordStartTime = Date.now();
        recordTimerInterval = setInterval(updateTimer, 1000);

        console.log("Recording started...");

    } catch (e) {
        console.error("Recording failed:", e);
        alert("Could not start recording. Browser security may prevent capturing cross-origin video streams.");
    }
}

function stopRecording() {
    mediaRecorder.stop();
    isRecording = false;

    // UI Updates
    document.getElementById('btn-record').classList.remove('recording');
    document.getElementById('record-text').textContent = "Start Recording";
    document.getElementById('recording-timer').classList.add('hidden');

    clearInterval(recordTimerInterval);
    document.getElementById('recording-timer').textContent = "00:00";

    console.log("Recording stopped.");
}

function saveRecording() {
    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    recordedChunks = [];

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    document.body.appendChild(a);
    a.style.display = 'none';
    a.href = url;
    a.download = `av1_capture_${Date.now()}.webm`;
    a.click();

    window.URL.revokeObjectURL(url);
    console.log("Recording saved.");
}

function updateTimer() {
    const diff = Math.floor((Date.now() - recordStartTime) / 1000);
    const mins = Math.floor(diff / 60).toString().padStart(2, '0');
    const secs = (diff % 60).toString().padStart(2, '0');
    document.getElementById('recording-timer').textContent = `${mins}:${secs}`;
}

// --- Custom Overlay Logic ---

function updateOverlayText() {
    const text = document.getElementById('custom-text').value;
    if (!text) return;

    // VAPIX Command to update overlay text
    // Assuming Image.I0.Text.Text is the correct parameter for the first text overlay
    const url = `${PARAM_URL}?action=update&Image.I0.Text.Text=${encodeURIComponent(text)}`;

    console.log(`Updating overlay text: ${text}`);

    // Use no-cors to fire and forget (browser won't let us read response anyway)
    fetch(url, { mode: 'no-cors' })
        .then(() => {
            console.log("Overlay update command sent.");
            // Show feedback
            const btn = document.querySelector('.action-btn');
            const originalText = btn.textContent;
            btn.textContent = "Sent! ✓";
            setTimeout(() => btn.textContent = originalText, 2000);
        })
        .catch(e => {
            console.error("Failed to update overlay:", e);
            alert("Failed to send command to camera.");
        });
}


// Initialize default stream
window.addEventListener('DOMContentLoaded', () => {
    // Start with 'off' (Base Layer Only)
    const defaultBtn = document.querySelector('.controls-container .control-btn.active');
    if (defaultBtn) changeStream('off', defaultBtn);

    // Hide loader after a brief delay
    setTimeout(() => {
        document.getElementById('loader').style.opacity = '0';
        setTimeout(() => {
            document.getElementById('loader').style.display = 'none';
        }, 500);
    }, 1500);
});


// --- Three.js Background Animation ---

function initThreeJS() {
    const container = document.getElementById('canvas-container');

    // Scene Setup
    scene = new THREE.Scene();
    // Add some fog for depth
    scene.fog = new THREE.FogExp2(0x050510, 0.002);

    // Camera
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 1000);
    camera.position.z = 1;
    camera.rotation.x = Math.PI / 2;

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // Particles - Using BufferGeometry for r128+ compatibility
    const particleCount = 6000;
    starGeo = new THREE.BufferGeometry();

    const positions = new Float32Array(particleCount * 3);

    // Clear arrays before populating
    velocities.length = 0;
    accelerations.length = 0;

    for (let i = 0; i < particleCount; i++) {
        positions[i * 3] = Math.random() * 600 - 300;     // x
        positions[i * 3 + 1] = Math.random() * 600 - 300;   // y
        positions[i * 3 + 2] = Math.random() * 600 - 300;   // z

        velocities.push(0);
        accelerations.push(0.02);
    }

    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    let sprite = new THREE.TextureLoader().load('https://threejs.org/examples/textures/sprites/disc.png');

    let starMaterial = new THREE.PointsMaterial({
        color: 0x00f2ff,
        size: 0.7,
        map: sprite,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending
    });

    particles = new THREE.Points(starGeo, starMaterial);
    scene.add(particles);

    // Post Processing (Bloom)
    const renderScene = new THREE.RenderPass(scene, camera);

    const bloomPass = new THREE.UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        1.5, 0.4, 0.85
    );
    bloomPass.threshold = 0;
    bloomPass.strength = 1.5; // Intensity of glow
    bloomPass.radius = 0;

    composer = new THREE.EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);

    // Animation Loop
    animate();

    // Handle Resize
    window.addEventListener('resize', onWindowResize, false);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    const positions = starGeo.attributes.position.array;

    for (let i = 0; i < 6000; i++) {
        velocities[i] += accelerations[i];

        // Update Y position (falling effect)
        positions[i * 3 + 1] -= velocities[i];

        // Reset if it falls below -200
        if (positions[i * 3 + 1] < -200) {
            positions[i * 3 + 1] = 200;
            velocities[i] = 0;
        }
    }

    starGeo.attributes.position.needsUpdate = true;
    particles.rotation.y += 0.002;

    composer.render();
    requestAnimationFrame(animate);
}

initThreeJS();
