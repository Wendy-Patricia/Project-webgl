"use strict";

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Water }         from 'https://threejs.org/examples/jsm/objects/Water.js';
import { Sky }           from 'three/addons/objects/Sky.js';

// ─── Globais ────────────────────────────────────────────────
let camera, renderer, cameraControls, clock, water, sun;
let scene = new THREE.Scene();
clock = new THREE.Clock();

// Névoa — dois sistemas sobrepostos (perto + longe)
let fogNear, fogFar;
let fogMatNear, fogMatFar;

// Densidade global (0 → 1), ligada ao slider
let fogDensity = 0.55;

// Fog exponencial nativo do Three.js (afeta objetos distantes)
let sceneFog;
// ────────────────────────────────────────────────────────────


// ============================================================
//  SLIDER UI
// ============================================================
function createSlider() {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = `
        position: fixed;
        bottom: 28px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        align-items: center;
        gap: 12px;
        background: rgba(0,0,0,0.45);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        border: 1px solid rgba(255,200,140,0.25);
        border-radius: 999px;
        padding: 10px 22px;
        z-index: 100;
        font-family: 'Segoe UI', sans-serif;
        color: #ffd5a8;
        font-size: 13px;
        letter-spacing: 0.06em;
        user-select: none;
    `;

    const icon = document.createElement('span');
    icon.textContent = '🌫';
    icon.style.fontSize = '16px';

    const label = document.createElement('span');
    label.textContent = 'NÉVOA';

    const slider = document.createElement('input');
    slider.type  = 'range';
    slider.min   = '0';
    slider.max   = '100';
    slider.value = String(Math.round(fogDensity * 100));
    slider.style.cssText = `
        -webkit-appearance: none;
        appearance: none;
        width: 180px;
        height: 4px;
        background: linear-gradient(to right, #ff8844, #ff884460);
        border-radius: 4px;
        outline: none;
        cursor: pointer;
        accent-color: #ff8844;
    `;

    const valLabel = document.createElement('span');
    valLabel.textContent = slider.value + '%';
    valLabel.style.cssText = 'min-width:36px; text-align:right;';

    slider.addEventListener('input', () => {
        fogDensity = parseInt(slider.value) / 100;
        valLabel.textContent = slider.value + '%';
        applyFogDensity();
    });

    wrapper.append(icon, label, slider, valLabel);
    document.body.appendChild(wrapper);
}


// ============================================================
//  Propaga a densidade a todos os sistemas de névoa
// ============================================================
function applyFogDensity() {
    if (sceneFog)   sceneFog.density            = 0.00002 + fogDensity * 0.00028;
    if (fogMatNear) fogMatNear.uniforms.uDensity.value = fogDensity;
    if (fogMatFar)  fogMatFar.uniforms.uDensity.value  = fogDensity;
}


// ============================================================
//  SUN + SKY
// ============================================================
function createSun() {
    const sky = new Sky();
    sky.scale.setScalar(450000);
    scene.add(sky);

    const sunVec = new THREE.Vector3();
    const ec = { turbidity:10, rayleigh:3, mieCoefficient:0.005, mieDirectionalG:0.7, elevation:2, azimuth:0 };

    const u = sky.material.uniforms;
    u['turbidity'].value       = ec.turbidity;
    u['rayleigh'].value        = ec.rayleigh;
    u['mieCoefficient'].value  = ec.mieCoefficient;
    u['mieDirectionalG'].value = ec.mieDirectionalG;

    sunVec.setFromSphericalCoords(1,
        THREE.MathUtils.degToRad(90 - ec.elevation),
        THREE.MathUtils.degToRad(ec.azimuth)
    );
    u['sunPosition'].value.copy(sunVec);

    if (water) water.material.uniforms['sunDirection'].value.copy(sunVec).normalize();

    sun = new THREE.DirectionalLight(0xff4400, 2);
    sun.position.copy(sunVec).multiplyScalar(1000);
    scene.add(sun);
}


// ============================================================
//  WATER
// ============================================================
function buildWater() {
    water = new Water(new THREE.PlaneGeometry(10000, 10000), {
        textureWidth: 512, textureHeight: 512,
        waterNormals: new THREE.TextureLoader().load(
            'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/waternormals.jpg',
            t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
        ),
        sunDirection: new THREE.Vector3(),
        sunColor: 0xff8844, waterColor: 0x001e0f,
        distortionScale: 3.7, fog: true,
    });
    water.rotation.x = -Math.PI / 2;
    scene.add(water);
    return water;
}


// ============================================================
//  CLOUDS
// ============================================================
let clouds = [];
function createClouds() {
    const mat = new THREE.SpriteMaterial({
        map: new THREE.TextureLoader().load('textures/nuage.png'),
        transparent: true, opacity: 0.6, color: 0xffccaa, depthWrite: false
    });
    for (let i = 0; i < 50; i++) {
        const g = new THREE.Group();
        for (let j = 0; j < 3 + Math.floor(Math.random() * 5); j++) {
            const s = new THREE.Sprite(mat);
            s.position.set((Math.random()-.5)*200,(Math.random()-.5)*100,(Math.random()-.5)*200);
            s.scale.set(300*(1+Math.random()*2), 200*(.5+Math.random()), 1);
            g.add(s);
        }
        g.position.set((Math.random()-.5)*8000, 1000+Math.random()*500, (Math.random()-.5)*8000);
        clouds.push(g);
        scene.add(g);
    }
}


// ============================================================
//  NÉVOA VOLUMÉTRICA — shader realista, duas camadas
//
//  NEAR: partículas grandes perto da câmera → sensação de
//        estar DENTRO da névoa
//  FAR : partículas menores no campo médio e horizonte →
//        profundidade atmosférica
// ============================================================

const fogVert = /* glsl */`
    attribute float aSize;
    attribute float aBaseAlpha;
    attribute float aPhase;

    varying float vAlpha;
    varying float vDepth;

    uniform float uTime;
    uniform float uDensity;

    void main() {
        vec3 pos = position;

        // Turbulência orgânica lenta — cada partícula com fase única
        pos.x += sin(uTime * 0.030 + aPhase)          * 32.0;
        pos.z += cos(uTime * 0.024 + aPhase * 1.37)   * 32.0;
        pos.y += sin(uTime * 0.017 + aPhase * 0.71)   *  7.0;

        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = aSize * (600.0 / -mv.z);
        gl_Position  = projectionMatrix * mv;

        float dist = length(mv.xyz);

        // Fade-in perto da câmera (evita pop-in abrupto)
        float nearFade = smoothstep(60.0, 220.0, dist);
        // Fade-out no horizonte
        float farFade  = 1.0 - smoothstep(1600.0, 3000.0, dist);

        vAlpha = aBaseAlpha * uDensity * nearFade * farFade;
        vDepth = clamp(dist / 2500.0, 0.0, 1.0);
    }
`;

const fogFrag = /* glsl */`
    uniform vec3  uColorWarm;
    uniform vec3  uColorCool;

    varying float vAlpha;
    varying float vDepth;

    // Hash 2D rápido para ruído de grain
    float hash21(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    void main() {
        vec2  uv = gl_PointCoord - 0.5;
        float d  = length(uv);
        if (d > 0.5) discard;

        // Forma: gaussiana multiplicada por smoothstep quintico
        float gauss  = exp(-d * d * 9.0);
        float smooth5 = 1.0 - smoothstep(0.0, 0.5, d);
        float shape  = gauss * smooth5;

        // Micro-grain para quebrar a uniformidade sintética
        float grain = hash21(gl_FragCoord.xy * 0.3) * 0.10 - 0.05;

        float alpha = clamp((shape + grain) * vAlpha, 0.0, 0.82);
        if (alpha < 0.003) discard;

        // Cor: laranja perto do sol → azul nas bordas / profundidade
        float mix_t = vDepth * 0.65 + (1.0 - shape) * 0.35;
        vec3  col   = mix(uColorWarm, uColorCool, clamp(mix_t, 0.0, 1.0));

        gl_FragColor = vec4(col, alpha);
    }
`;


function makeFogSystem({ count, spread, yMin, yMax, baseSize, baseAlpha }) {
    const positions  = new Float32Array(count * 3);
    const sizes      = new Float32Array(count);
    const baseAlphas = new Float32Array(count);
    const phases     = new Float32Array(count);

    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        // Anel intermédio mais denso (0.12 … 1.0) × spread
        const r = (0.12 + Math.pow(Math.random(), 0.55) * 0.88) * spread;

        positions[i*3]   = Math.cos(angle) * r;
        positions[i*3+2] = Math.sin(angle) * r;

        // Bias exponencial para baixo → névoa rasante sobre a água
        const t = Math.pow(Math.random(), 1.9);
        positions[i*3+1] = yMin + t * (yMax - yMin);

        const heightNorm = 1.0 - (positions[i*3+1] - yMin) / (yMax - yMin);
        sizes[i]      = baseSize * (0.45 + Math.random() * 1.55);
        baseAlphas[i] = baseAlpha * (0.35 + heightNorm * 0.65) * (0.5 + Math.random() * 0.5);
        phases[i]     = Math.random() * Math.PI * 2;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position',   new THREE.BufferAttribute(positions,  3));
    geo.setAttribute('aSize',      new THREE.BufferAttribute(sizes,      1));
    geo.setAttribute('aBaseAlpha', new THREE.BufferAttribute(baseAlphas, 1));
    geo.setAttribute('aPhase',     new THREE.BufferAttribute(phases,     1));

    const mat = new THREE.ShaderMaterial({
        uniforms: {
            uTime:      { value: 0 },
            uDensity:   { value: fogDensity },
            uColorWarm: { value: new THREE.Color(0xffb07a) },
            uColorCool: { value: new THREE.Color(0x8ab4c8) },
        },
        vertexShader:   fogVert,
        fragmentShader: fogFrag,
        transparent:    true,
        depthWrite:     false,
        blending:       THREE.NormalBlending,
    });

    const pts = new THREE.Points(geo, mat);
    scene.add(pts);
    return { pts, mat };
}


function createVolumetricFog() {
    // Camada PERTO — grande, espessa, cria imersão imediata
    const near = makeFogSystem({ count:3500, spread:1800, yMin:-15, yMax:130, baseSize:380, baseAlpha:0.38 });
    fogNear    = near.pts;
    fogMatNear = near.mat;

    // Camada LONGE — cobre o horizonte com bruma atmosférica
    const far = makeFogSystem({ count:4500, spread:4200, yMin:-30, yMax:200, baseSize:240, baseAlpha:0.22 });
    fogFar    = far.pts;
    fogMatFar = far.mat;
}


// ============================================================
//  FILL SCENE
// ============================================================
function fillScene() {
    sceneFog  = new THREE.FogExp2(0x9e6035, 0.00002 + fogDensity * 0.00028);
    scene.fog = sceneFog;

    scene.add(new THREE.AmbientLight(0x221100, 0.5));
    buildWater();
    createSun();
    createClouds();
    createVolumetricFog();
}


// ============================================================
//  INIT
// ============================================================
function init() {
    const container = document.getElementById('webGL');
    const W = container.clientWidth  || 846;
    const H = container.clientHeight || 494;

    camera = new THREE.PerspectiveCamera(45, W / H, 1, 20000);
    camera.position.set(-222, 100, 1000);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(window.devicePixelRatio);

    cameraControls = new OrbitControls(camera, renderer.domElement);
    cameraControls.enableDamping  = true;
    cameraControls.dampingFactor  = 0.05;
    cameraControls.target.set(0, 50, 0);
    cameraControls.minAzimuthAngle = -Infinity;
    cameraControls.maxAzimuthAngle =  Infinity;
    cameraControls.minPolarAngle   = Math.PI / 2.5;
    cameraControls.maxPolarAngle   = Math.PI / 1.9;
    cameraControls.minDistance     = 200;
    cameraControls.maxDistance     = 2500;
    cameraControls.enablePan       = false;
    cameraControls.update();
}

function addToDOM() {
    document.getElementById('webGL').appendChild(renderer.domElement);
}

function animate() {
    requestAnimationFrame(animate);
    const time = clock.getElapsedTime();

    if (water)       water.material.uniforms['time'].value += 1.0 / 60.0;
    if (fogMatNear)  fogMatNear.uniforms.uTime.value = time;
    if (fogMatFar)   fogMatFar.uniforms.uTime.value  = time;

    clouds.forEach(g => {
        g.position.x += 0.2;
        if (g.position.x > 5000) g.position.x = -5000;
    });

    cameraControls.update();
    renderer.render(scene, camera);
}


// ============================================================
try {
    init();
    fillScene();
    addToDOM();
    createSlider();
    animate();
} catch (e) {
    console.error(e);
}