"use strict";

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Water }         from 'https://threejs.org/examples/jsm/objects/Water.js';
import { Sky }           from 'three/addons/objects/Sky.js';
import { Reflector }     from 'three/addons/objects/Reflector.js';
import { addBoats, boatMaterials, boatObjects, buoyMesh } from './bateaux.js';  //importation depuis bateaux.js

// ─── Globais ────────────────────────────────────────────────
let camera, renderer, cameraControls, clock, water, sun, mirror;
let skyEnvMap = null;   // THREE.Texture PMREM du Sky — injectée dans la bouée
let scene = new THREE.Scene();
clock = new THREE.Clock();

// Névoa — dois sistemas sobrepostos (perto + longe)
let fogNear, fogFar;
let fogMatNear, fogMatFar;

// Densidade global (0 → 1), ligada ao slider
let fogDensity = 0.55;

// Fog exponencial nativo do Three.js (afeta objetos distantes)
let sceneFog;

// ── Drag & drop bateaux ─────────────────────────────────────
const raycaster   = new THREE.Raycaster();
const mouse       = new THREE.Vector2();
const dragPlane   = new THREE.Plane(new THREE.Vector3(0, 1, 0), -50); // plano Y=50
const dragPoint   = new THREE.Vector3();
let   dragBoat    = null;   // boatObjects entry en cours de drag
let   dragOffset  = new THREE.Vector3();
// ────────────────────────────────────────────────────────────


// ============================================================
//  PAINEL DE CONTROLO ÚNICO — névoa + transparence + positions
// ============================================================
function createControlPanel() {

    // ── Styles partagés ─────────────────────────────────────
    const SLIDER_BASE = `
        -webkit-appearance: none;
        appearance: none;
        height: 4px;
        border-radius: 4px;
        outline: none;
        cursor: pointer;
        accent-color: #ff8844;
    `;

    const PANEL_CSS = `
        position: fixed;
        top: 28px;
        right: 28px;
        display: flex;
        flex-direction: column;
        gap: 0;
        background: rgba(0,0,0,0.50);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border: 1px solid rgba(255,200,140,0.22);
        border-radius: 18px;
        padding: 0;
        z-index: 100;
        font-family: 'Segoe UI', sans-serif;
        color: #ffd5a8;
        font-size: 12px;
        letter-spacing: 0.06em;
        user-select: none;
        min-width: 270px;
        overflow: hidden;
    `;

    const panel = document.createElement('div');
    panel.style.cssText = PANEL_CSS;

    // ── Helper: crée une section collapsable ────────────────
    function makeSection(icon, label, buildFn) {
        const section = document.createElement('div');
        section.style.cssText = 'border-bottom: 1px solid rgba(255,200,140,0.10);';

        // Header
        const header = document.createElement('div');
        header.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 11px 18px;
            cursor: pointer;
            gap: 10px;
            transition: background 0.15s;
        `;
        header.addEventListener('mouseenter', () => header.style.background = 'rgba(255,136,68,0.08)');
        header.addEventListener('mouseleave', () => header.style.background = 'transparent');

        const headerLeft = document.createElement('span');
        headerLeft.innerHTML = `<span style="margin-right:8px">${icon}</span>${label}`;
        headerLeft.style.cssText = 'font-size:11px; letter-spacing:0.1em; opacity:0.75;';

        const arrow = document.createElement('span');
        arrow.textContent = '▲';
        arrow.style.cssText = 'font-size:9px; opacity:0.5; transition: transform 0.3s ease;';

        header.append(headerLeft, arrow);

        // Body
        const body = document.createElement('div');
        body.style.cssText = `
            padding: 4px 18px 14px;
            display: flex;
            flex-direction: column;
            gap: 10px;
            overflow: hidden;
            max-height: 0px;
            opacity: 0;
            transition: max-height 0.35s ease, opacity 0.25s ease, padding 0.3s ease;
        `;

        buildFn(body);

        let open = false;
        body.style.padding = '0 18px';
        arrow.style.transform = 'rotate(180deg)';
        header.addEventListener('click', () => {
            open = !open;
            body.style.maxHeight = open ? '500px' : '0px';
            body.style.opacity   = open ? '1'     : '0';
            body.style.padding   = open ? '4px 18px 14px' : '0 18px';
            arrow.style.transform = open ? 'rotate(0deg)' : 'rotate(180deg)';
        });

        section.append(header, body);
        return section;
    }

    // ── Helper: ligne de slider générique ───────────────────
    function makeSliderRow({ icon, label, min, max, value, width, unit, onChange }) {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex; align-items:center; gap:8px;';

        const lbl = document.createElement('span');
        lbl.innerHTML = (icon ? icon + ' ' : '') + label;
        lbl.style.cssText = 'min-width:68px; font-size:11px; opacity:0.85;';

        const pct0 = unit === '%'
            ? value
            : (value - min) / (max - min) * 100;

        const slider = document.createElement('input');
        slider.type  = 'range';
        slider.min   = String(min);
        slider.max   = String(max);
        slider.value = String(value);
        slider.style.cssText = SLIDER_BASE +
            `width:${width || 150}px;
             background: linear-gradient(to right, #ff8844 ${pct0}%, #ff884440 ${pct0}%);`;

        const valEl = document.createElement('span');
        valEl.textContent = Math.round(value) + (unit || '');
        valEl.style.cssText = 'min-width:38px; text-align:right; font-size:11px; font-variant-numeric:tabular-nums;';

        slider.addEventListener('input', () => {
            const v   = parseFloat(slider.value);
            const pct = (v - min) / (max - min) * 100;
            slider.style.background =
                `linear-gradient(to right, #ff8844 ${pct}%, #ff884440 ${pct}%)`;
            valEl.textContent = Math.round(v) + (unit || '');
            onChange(v);
        });

        row.append(lbl, slider, valEl);
        return { row, slider, valEl };
    }

    // ── Section 1 : Névoa ────────────────────────────────────
    panel.appendChild(makeSection('🌫️', 'BROUILLARD — Densité de la brume', (body) => {
        makeSliderRow({
            icon: '', label: 'Densité',
            min: 0, max: 100, value: Math.round(fogDensity * 100),
            width: 150, unit: '%',
            onChange: (v) => {
                fogDensity = v / 100;
                applyFogDensity();
            }
        }).row;
        // on ajoute directement à body
        const { row } = makeSliderRow({
            icon: '', label: 'Densité',
            min: 0, max: 100, value: Math.round(fogDensity * 100),
            width: 150, unit: '%',
            onChange: (v) => { fogDensity = v / 100; applyFogDensity(); }
        });
        body.appendChild(row);
    }));

    // ── Section 2 : Transparence ─────────────────────────────
    panel.appendChild(makeSection('🪟', 'TRANSPARENCE — Opacité des bateaux', (body) => {
        const { row: rowHull } = makeSliderRow({
            icon: '🪵', label: 'Coque',
            min: 0, max: 100, value: 100,
            width: 130, unit: '%',
            onChange: (v) => {
                boatMaterials.forEach(({ hullMat, mastMat }) => {
                    hullMat.opacity = v / 100;
                    mastMat.opacity = v / 100;
                });
            }
        });
        const { row: rowSail } = makeSliderRow({
            icon: '🏳', label: 'Voile',
            min: 0, max: 100, value: 90,
            width: 130, unit: '%',
            onChange: (v) => {
                boatMaterials.forEach(({ sailMat }) => {
                    sailMat.opacity = v / 100;
                });
            }
        });
        body.append(rowHull, rowSail);
    }));

    // ── Section 3 : Reset position des bateaux ───────────────
    panel.appendChild(makeSection('🧭', 'POSITION — Réinitialiser les bateaux', (body) => {

        boatObjects.forEach(({ boat, label, initX, initZ }, idx) => {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex; align-items:center; justify-content:space-between; gap:10px;';

            const boatLabel = document.createElement('span');
            boatLabel.textContent = '⛵ ' + label;
            boatLabel.style.cssText = 'font-size:11px; opacity:0.75;';

            const resetBtn = document.createElement('button');
            resetBtn.textContent = '↺ Reset';
            resetBtn.style.cssText = `
                background: rgba(255,136,68,0.12);
                border: 1px solid rgba(255,136,68,0.35);
                border-radius: 999px;
                color: #ffd5a8;
                font-size: 10px;
                padding: 3px 11px;
                cursor: pointer;
                letter-spacing: 0.05em;
            `;
            resetBtn.addEventListener('mouseenter', () => resetBtn.style.background = 'rgba(255,136,68,0.30)');
            resetBtn.addEventListener('mouseleave', () => resetBtn.style.background = 'rgba(255,136,68,0.12)');
            resetBtn.addEventListener('click', () => {
                boat.position.x = initX;
                boat.position.y = initY ?? 50;
                boat.position.z = initZ;
                boat.rotation.x = 0;
                boat.rotation.z = 0;
            });

            row.append(boatLabel, resetBtn);
            body.appendChild(row);

            if (idx < boatObjects.length - 1) {
                const sep = document.createElement('div');
                sep.style.cssText = 'height:1px; background:rgba(255,200,140,0.10); margin:2px 0;';
                body.appendChild(sep);
            }
        });
    }));

    document.body.appendChild(panel);
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

    // ── PMREM — envMap fidèle au Sky pour les matériaux PBR ────
    // Approche canonique Three.js : on compile le Sky dans un
    // PMREMGenerator pour obtenir une texture HDR du coucher de soleil.
    // Cette texture sera injectée dans envMap de la bouée métallique.
    const pmrem = new THREE.PMREMGenerator(renderer);
    skyEnvMap = pmrem.fromScene(sky).texture;
    pmrem.dispose();
    // ────────────────────────────────────────────────────────────

    sun = new THREE.DirectionalLight(0xff4400, 2);
    sun.position.copy(sunVec).multiplyScalar(1000);

    // ── Ombres portées ──────────────────────────────────────
    sun.castShadow = true;
    sun.shadow.mapSize.width  = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near   = 100;
    sun.shadow.camera.far    = 3000;
    sun.shadow.camera.left   = -800;
    sun.shadow.camera.right  =  800;
    sun.shadow.camera.top    =  800;
    sun.shadow.camera.bottom = -800;
    // ────────────────────────────────────────────────────────

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
    water.receiveShadow = true; // ── Ombres portées ──
    scene.add(water);
    return water;
}


// ============================================================
//  EFFET MIROIR — réflexion de la scène dans l'eau
//
//  Un Reflector Three.js est placé au niveau Y=0 (surface de
//  l'eau). Il rend la scène depuis une caméra virtuelle
//  symétrique par rapport au plan horizontal, puis projette
//  ce rendu dans un shader custom qui :
//    • mélange la réflexion avec la couleur sombre de l'eau
//    • distord les UV avec les normales d'ondulation du Water
//    • applique un fondu sur les bords (fresnel simplifié)
// ============================================================
function buildMirror() {
    const geo = new THREE.PlaneGeometry(10000, 10000);

    mirror = new Reflector(geo, {
        textureWidth:  window.innerWidth  * window.devicePixelRatio,
        textureHeight: window.innerHeight * window.devicePixelRatio,
        color: 0x223344,          // teinte bleu-nuit de l'eau
        clipBias: 0.003,
    });

    // Même rotation que le Water (plan horizontal)
    mirror.rotation.x = -Math.PI / 2;
    // Légèrement sous la surface pour éviter le z-fighting
    mirror.position.y = -0.5;

    // Shader custom : distorsion ondulante + transparence + fresnel
    mirror.material.transparent = true;

    // On injecte des uniforms supplémentaires dans le shader du Reflector
    mirror.material.onBeforeCompile = (shader) => {
        shader.uniforms.uTime      = { value: 0 };
        shader.uniforms.uOpacity   = { value: 0.45 };
        shader.uniforms.uDistort   = { value: 0.012 };

        // Stocke la référence pour l'animation
        mirror._reflectorUniforms = shader.uniforms;

        // Ajoute les uniforms en tête du fragment shader
        shader.fragmentShader = /* glsl */`
            uniform float uTime;
            uniform float uOpacity;
            uniform float uDistort;
        ` + shader.fragmentShader;

        // Remplace le calcul de l'UV de réflexion pour y ajouter
        // une distorsion sinusoïdale qui simule l'ondulation de l'eau
        shader.fragmentShader = shader.fragmentShader.replace(
            'vec4 base = texture2D( tDiffuse, coord );',
            /* glsl */`
            // Distorsion ondulante de l'UV de réflexion
            vec2 distortedCoord = coord;
            distortedCoord.x += sin(coord.y * 40.0 + uTime * 1.2) * uDistort;
            distortedCoord.y += cos(coord.x * 35.0 + uTime * 0.9) * uDistort * 0.6;
            vec4 base = texture2D( tDiffuse, distortedCoord );
            `
        );

        // Applique l'opacité et un léger fresnel (bords plus opaques)
        shader.fragmentShader = shader.fragmentShader.replace(
            'gl_FragColor = base;',
            /* glsl */`
            // Fresnel simplifié : les bords (vus tangentiellement) réfléchissent plus
            float fresnel = 1.0 - abs(dot(normalize(vWorldPosition - cameraPosition),
                                          vec3(0.0, 1.0, 0.0)));
            fresnel = clamp(fresnel, 0.0, 1.0);
            float alpha = uOpacity + fresnel * 0.3;
            gl_FragColor = vec4(base.rgb, clamp(alpha, 0.0, 0.85));
            `
        );

        // Le Reflector n'expose pas vWorldPosition par défaut — on l'ajoute
        shader.vertexShader = /* glsl */`
            varying vec3 vWorldPosition;
        ` + shader.vertexShader;

        shader.vertexShader = shader.vertexShader.replace(
            '#include <project_vertex>',
            /* glsl */`
            #include <project_vertex>
            vWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
            `
        );
    };

    scene.add(mirror);
    return mirror;
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
        const cx = (Math.random()-.5)*8000;
        const cz = (Math.random()-.5)*8000;
        const cy = 1000 + Math.random() * 500;
        g.position.set(cx, cy, cz);

        // Métadonnées pour l'animation
        g.userData.initY  = cy;
        g.userData.phase  = Math.random() * Math.PI * 2;
        // Vitesse en unités/seconde — vent dominant vers +X, légère composante Z
        g.userData.speedX = 25 + Math.random() * 35;    // 25–60 u/s
        g.userData.speedZ = (Math.random() - 0.5) * 20; // ±10 u/s latéral

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
    buildMirror();
    createSun();
    
    addBoats(scene, skyEnvMap);
        

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
    camera.position.set(-400, 300, 1800);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(window.devicePixelRatio);

    // ── Ombres portées ──────────────────────────────────────
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
    // ────────────────────────────────────────────────────────

    cameraControls = new OrbitControls(camera, renderer.domElement);
    cameraControls.enableDamping  = true;
    cameraControls.dampingFactor  = 0.05;
    cameraControls.target.set(0, 50, 0);
    cameraControls.minAzimuthAngle = -Infinity;
    cameraControls.maxAzimuthAngle =  Infinity;
    // minPolarAngle : vue du dessus (0 = zénith, on limite à ~20°)
    cameraControls.minPolarAngle   = Math.PI / 9;
    // maxPolarAngle : ne jamais dépasser l'horizon (< 90°)
    // Math.PI / 2 = 90° exactement, on recule légèrement à ~80°
    cameraControls.maxPolarAngle   = Math.PI / 2.25;
    cameraControls.minDistance     = 200;
    cameraControls.maxDistance     = 2500;
    cameraControls.enablePan       = false;

    // Garde-fou supplémentaire : empêche la caméra de passer
    // sous la surface de l'eau (Y ≤ 10) quelle que soit
    // la manipulation (pinch, scroll rapide, etc.)
    cameraControls.addEventListener('change', () => {
        if (camera.position.y < 10) {
            camera.position.y = 10;
        }
        // Le target ne doit pas non plus s'enfoncer sous l'eau
        if (cameraControls.target.y < 5) {
            cameraControls.target.y = 5;
        }
    });

    cameraControls.update();
}

function addToDOM() {
    document.getElementById('webGL').appendChild(renderer.domElement);
    initDrag();
}

// ============================================================
//  DRAG & DROP — déplacer les bateaux à la souris
// ============================================================
function initDrag() {
    const canvas = renderer.domElement;

    // Convertit les coordonnées souris en NDC [-1, 1]
    function toNDC(e) {
        const rect = canvas.getBoundingClientRect();
        mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
        mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
    }

    // Retourne le boatObjects entry sous la souris, ou null
    function pickBoat() {
        raycaster.setFromCamera(mouse, camera);
        const meshes = [];
        boatObjects.forEach(entry => {
            entry.boat.traverse(obj => { if (obj.isMesh) meshes.push(obj); });
        });
        const hits = raycaster.intersectObjects(meshes, false);
        if (!hits.length) return null;
        // Remonte au Group parent pour trouver l'entry
        const hitObj = hits[0].object;
        return boatObjects.find(entry => {
            let found = false;
            entry.boat.traverse(o => { if (o === hitObj) found = true; });
            return found;
        }) || null;
    }

    canvas.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        toNDC(e);
        const entry = pickBoat();
        if (!entry) return;

        dragBoat = entry;
        cameraControls.enabled = false; // désactive orbit pendant le drag
        canvas.style.cursor = 'grabbing';

        // Calcule l'offset entre le centre du bateau et le point d'intersection
        raycaster.setFromCamera(mouse, camera);
        raycaster.ray.intersectPlane(dragPlane, dragPoint);
        dragOffset.set(
            dragBoat.boat.position.x - dragPoint.x,
            0,
            dragBoat.boat.position.z - dragPoint.z
        );
    });

    canvas.addEventListener('mousemove', (e) => {
        toNDC(e);

        if (!dragBoat) {
            // Curseur pointer si on survole un bateau
            canvas.style.cursor = pickBoat() ? 'grab' : 'default';
            return;
        }

        raycaster.setFromCamera(mouse, camera);
        if (!raycaster.ray.intersectPlane(dragPlane, dragPoint)) return;

        const newX = dragPoint.x + dragOffset.x;
        const newZ = dragPoint.z + dragOffset.z;

        dragBoat.boat.position.x = newX;
        dragBoat.boat.position.z = newZ;
    });

    canvas.addEventListener('mouseup',    stopDrag);
    canvas.addEventListener('mouseleave', stopDrag);

    function stopDrag() {
        if (!dragBoat) return;
        dragBoat = null;
        cameraControls.enabled = true;
        canvas.style.cursor = 'default';
    }
}

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    const time  = clock.getElapsedTime();

    if (water)       water.material.uniforms['time'].value += 1.0 / 60.0;
    if (fogMatNear)  fogMatNear.uniforms.uTime.value = time;
    if (fogMatFar)   fogMatFar.uniforms.uTime.value  = time;
    if (mirror && mirror._reflectorUniforms) {
        mirror._reflectorUniforms.uTime.value = time;
    }

    // ── Animation des nuages ────────────────────────────────
    const BOUND = 4500;
    clouds.forEach(g => {
        const { initY, phase, speedX, speedZ } = g.userData;

        // Dérive en unités/seconde × delta
        g.position.x += speedX * delta;
        g.position.z += speedZ * delta;

        // Balancement vertical visible (±80 unités à y≈1000)
        g.position.y = initY + Math.sin(time * 0.15 + phase) * 80;

        // Wrap-around
        if (g.position.x >  BOUND) g.position.x = -BOUND;
        if (g.position.x < -BOUND) g.position.x =  BOUND;
        if (g.position.z >  BOUND) g.position.z = -BOUND;
        if (g.position.z < -BOUND) g.position.z =  BOUND;
    });
    // ────────────────────────────────────────────────────────

    // ── Balouço dos barcos sobre as ondas ────────────────────
    // Cada barco tem fase única → movimentos dessincronizados
    boatObjects.forEach(({ boat, initY, wavePhase }, idx) => {
        if (!boat) return;
        const p = wavePhase ?? idx * 2.1;   // fallback se não inicializado
        const base = initY ?? 50;

        // Heave: subida/descida vertical suave
        boat.position.y = base + Math.sin(time * 0.8 + p) * 3.5;

        // Roll: inclinação lateral (axe Z)
        boat.rotation.z = Math.sin(time * 0.6 + p * 1.3) * 0.025;

        // Pitch: inclinação frente/trás (axe X) — plus subtil
        boat.rotation.x = Math.sin(time * 0.5 + p * 0.7) * 0.015;
    });
    // ────────────────────────────────────────────────────────

    // ── Flottement + pulsação da lanterna da boia ───────────────
    if (buoyMesh) {
        const baseY = -40 * 3;
        buoyMesh.position.y = baseY + Math.sin(time * 0.55 + 2.3) * 12;
        buoyMesh.rotation.z = Math.sin(time * 0.38 + 1.1) * 0.03;
        buoyMesh.rotation.x = Math.sin(time * 0.30 + 0.7) * 0.02;

        // Lanterna pisca em ciclos de 3s (0.5s ON, 2.5s OFF)
        if (buoyMesh.userData.lanternMat) {
            const cycle  = time % 3.0;
            const pulse  = cycle < 0.5
                ? Math.sin((cycle / 0.5) * Math.PI)   // fade in/out suave
                : 0;
            buoyMesh.userData.lanternMat.emissiveIntensity = 0.3 + pulse * 2.5;
        }
    }
    // ────────────────────────────────────────────────────────────

    cameraControls.update();
    renderer.render(scene, camera);
}




// ============================================================
//  HINT — indique à l'utilisateur qu'il peut glisser les bateaux
// ============================================================
function createDragHint() {
    // Hint permanent en bas du panneau de contrôle (côté droit)
    const hint = document.createElement('div');
    hint.style.cssText = `
        position: fixed;
        bottom: 28px;
        right: 28px;
        display: flex;
        align-items: center;
        gap: 10px;
        background: rgba(0,0,0,0.50);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        border: 1px solid rgba(255,200,140,0.22);
        border-radius: 999px;
        padding: 9px 18px;
        z-index: 100;
        font-family: 'Segoe UI', sans-serif;
        color: #ffd5a8;
        font-size: 12px;
        letter-spacing: 0.05em;
        pointer-events: none;
        opacity: 1;
        transition: opacity 1.2s ease;
        max-width: 300px;
    `;

    const icon = document.createElement('span');
    icon.textContent = '🖱️';
    icon.style.cssText = `
        font-size: 15px;
        animation: hintBob 1.2s ease-in-out infinite alternate;
        flex-shrink: 0;
    `;

    const text = document.createElement('span');
    text.innerHTML = 'Cliquez &amp; glissez un <strong>bateau</strong> pour le déplacer';
    text.style.cssText = 'line-height:1.4; opacity:0.85;';

    hint.append(icon, text);
    document.body.appendChild(hint);

    if (!document.getElementById('hintKeyframes')) {
        const style = document.createElement('style');
        style.id = 'hintKeyframes';
        style.textContent = `
            @keyframes hintBob {
                from { transform: translateY(0px);  }
                to   { transform: translateY(-3px); }
            }
        `;
        document.head.appendChild(style);
    }

    // Disparaît après 8 secondes OU au premier drag
    setTimeout(() => {
        hint.style.opacity = '0';
        setTimeout(() => hint.remove(), 1200);
    }, 8000);

    const canvas = renderer.domElement;
    function onFirstDrag() {
        hint.style.opacity = '0';
        setTimeout(() => hint.remove(), 1200);
        canvas.removeEventListener('mousedown', onFirstDrag);
    }
    canvas.addEventListener('mousedown', onFirstDrag);
}


// ============================================================
try {
    init();
    fillScene();
    addToDOM();
    createControlPanel();
    createDragHint();
    animate();
} catch (e) {
    console.error(e);
}