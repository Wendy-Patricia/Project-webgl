"use strict";

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Water } from 'https://threejs.org/examples/jsm/objects/Water.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { addBoats, boatMaterials, boatObjects, buoyMesh } from './bateaux.js';

// ─── Globais ────────────────────────────────────────────────
let camera, renderer, cameraControls, clock, water, sun, mirror;
let skyEnvMap = null;
let scene = new THREE.Scene();
clock = new THREE.Clock();

let fogNear, fogFar;
let fogMatNear, fogMatFar;
let fogDensity = 0.55;
let sceneFog;

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -50);
const dragPoint = new THREE.Vector3();
let dragBoat = null;
let dragOffset = new THREE.Vector3();

function createControlPanel() {
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
overflow: visible;
`;

  const panel = document.createElement('div');
  panel.style.cssText = PANEL_CSS;

  function makeSection(icon, label, buildFn) {
    const section = document.createElement('div');
    section.style.cssText = 'border-bottom: 1px solid rgba(255,200,140,0.10);';

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
    headerLeft.innerHTML = `${icon}${label}`;
    headerLeft.style.cssText = 'font-size:11px; letter-spacing:0.1em; opacity:0.75;';

    const arrow = document.createElement('span');
    arrow.textContent = '▲';
    arrow.style.cssText = 'font-size:9px; opacity:0.5; transition: transform 0.3s ease;';

    header.append(headerLeft, arrow);

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
      body.style.opacity = open ? '1' : '0';
      body.style.padding = open ? '4px 18px 14px' : '0 18px';
      arrow.style.transform = open ? 'rotate(0deg)' : 'rotate(180deg)';
    });

    section.append(header, body);
    return section;
  }

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
    slider.type = 'range';
    slider.min = String(min);
    slider.max = String(max);
    slider.value = String(value);
    slider.style.cssText = SLIDER_BASE +
`width:${width || 150}px;
background: linear-gradient(to right, #ff8844 ${pct0}%, #ff884440 ${pct0}%);`;

    const valEl = document.createElement('span');
    valEl.textContent = Math.round(value) + (unit || '');
    valEl.style.cssText = 'min-width:38px; text-align:right; font-size:11px; font-variant-numeric:tabular-nums;';

    slider.addEventListener('input', () => {
      const v = parseFloat(slider.value);
      const pct = (v - min) / (max - min) * 100;
      slider.style.background =
`linear-gradient(to right, #ff8844 ${pct}%, #ff884440 ${pct}%)`;
      valEl.textContent = Math.round(v) + (unit || '');
      onChange(v);
    });

    row.append(lbl, slider, valEl);
    return { row, slider, valEl };
  }

  panel.appendChild(makeSection('🌫️', 'BROUILLARD — Densité de la brume', (body) => {
    const { row } = makeSliderRow({
      icon: '', label: 'Densité',
      min: 0, max: 100, value: Math.round(fogDensity * 100),
      width: 150, unit: '%',
      onChange: (v) => { fogDensity = v / 100; applyFogDensity(); }
    });
    body.appendChild(row);
  }));

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

  panel.appendChild(makeSection('🧭', 'POSITION — Réinitialiser les bateaux', (body) => {
    boatObjects.forEach(({ boat, label, initX, initY, initZ }, idx) => {
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

function applyFogDensity() {
  if (sceneFog) sceneFog.density = 0.00002 + fogDensity * 0.00028;
  if (fogMatNear) fogMatNear.uniforms.uDensity.value = fogDensity;
  if (fogMatFar) fogMatFar.uniforms.uDensity.value = fogDensity;
}

function createSun() {
  const sky = new Sky();
  sky.scale.setScalar(450000);
  scene.add(sky);

  const sunVec = new THREE.Vector3();
  const ec = { turbidity:10, rayleigh:3, mieCoefficient:0.005, mieDirectionalG:0.7, elevation:2, azimuth:0 };

  const u = sky.material.uniforms;
  u['turbidity'].value = ec.turbidity;
  u['rayleigh'].value = ec.rayleigh;
  u['mieCoefficient'].value = ec.mieCoefficient;
  u['mieDirectionalG'].value = ec.mieDirectionalG;

  sunVec.setFromSphericalCoords(
    1,
    THREE.MathUtils.degToRad(90 - ec.elevation),
    THREE.MathUtils.degToRad(ec.azimuth)
  );
  u['sunPosition'].value.copy(sunVec);

  if (water) water.material.uniforms['sunDirection'].value.copy(sunVec).normalize();

  renderer.compile(scene, camera);
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  skyEnvMap = pmrem.fromScene(sky).texture;
  pmrem.dispose();

  sun = new THREE.DirectionalLight(0xff4400, 2);
  sun.position.copy(sunVec).multiplyScalar(1000);
  sun.castShadow = true;
  sun.shadow.mapSize.width = 2048;
  sun.shadow.mapSize.height = 2048;
  sun.shadow.camera.near = 100;
  sun.shadow.camera.far = 3000;
  sun.shadow.camera.left = -800;
  sun.shadow.camera.right = 800;
  sun.shadow.camera.top = 800;
  sun.shadow.camera.bottom = -800;

  scene.add(sun);
}

function buildWater() {
  water = new Water(new THREE.PlaneGeometry(10000, 10000), {
    textureWidth: 512,
    textureHeight: 512,
    waterNormals: new THREE.TextureLoader().load(
      'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/waternormals.jpg',
      t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
    ),
    sunDirection: new THREE.Vector3(),
    sunColor: 0xff8844,
    waterColor: 0x001e0f,
    distortionScale: 3.7,
    fog: true,
  });
  water.rotation.x = -Math.PI / 2;
  water.receiveShadow = true;
  scene.add(water);
  return water;
}

function buildMirror() {
  const geo = new THREE.PlaneGeometry(10000, 10000);

  mirror = new Reflector(geo, {
    textureWidth: window.innerWidth * window.devicePixelRatio,
    textureHeight: window.innerHeight * window.devicePixelRatio,
    color: 0x223344,
    clipBias: 0.003,
  });

  mirror.rotation.x = -Math.PI / 2;
  mirror.position.y = -0.5;
  mirror.material.transparent = true;

  mirror.material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uOpacity = { value: 0.45 };
    shader.uniforms.uDistort = { value: 0.012 };
    mirror._reflectorUniforms = shader.uniforms;

    shader.fragmentShader = `
uniform float uTime;
uniform float uOpacity;
uniform float uDistort;
` + shader.fragmentShader;

    shader.fragmentShader = shader.fragmentShader.replace(
      'vec4 base = texture2D( tDiffuse, coord );',
      `
vec2 distortedCoord = coord;
distortedCoord.x += sin(coord.y * 40.0 + uTime * 1.2) * uDistort;
distortedCoord.y += cos(coord.x * 35.0 + uTime * 0.9) * uDistort * 0.6;
vec4 base = texture2D( tDiffuse, distortedCoord );
`
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      'gl_FragColor = base;',
      `
float fresnel = 1.0 - abs(dot(normalize(vWorldPosition - cameraPosition), vec3(0.0, 1.0, 0.0)));
fresnel = clamp(fresnel, 0.0, 1.0);
float alpha = uOpacity + fresnel * 0.3;
gl_FragColor = vec4(base.rgb, clamp(alpha, 0.0, 0.85));
`
    );

    shader.vertexShader = `
varying vec3 vWorldPosition;
` + shader.vertexShader;

    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      `
#include <project_vertex>
vWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
`
    );
  };

  scene.add(mirror);
  return mirror;
}

let clouds = [];
function createClouds() {
  const mat = new THREE.SpriteMaterial({
    map: new THREE.TextureLoader().load('textures/nuage.png'),
    transparent: true,
    opacity: 0.6,
    color: 0xffccaa,
    depthWrite: false
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
    g.userData.initY = cy;
    g.userData.phase = Math.random() * Math.PI * 2;
    g.userData.speedX = 25 + Math.random() * 35;
    g.userData.speedZ = (Math.random() - 0.5) * 20;
    clouds.push(g);
    scene.add(g);
  }
}

const fogVert = `
attribute float aSize;
attribute float aBaseAlpha;
attribute float aPhase;

varying float vAlpha;
varying float vDepth;

uniform float uTime;
uniform float uDensity;

void main() {
  vec3 pos = position;
  pos.x += sin(uTime * 0.030 + aPhase) * 32.0;
  pos.z += cos(uTime * 0.024 + aPhase * 1.37) * 32.0;
  pos.y += sin(uTime * 0.017 + aPhase * 0.71) * 7.0;

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_PointSize = aSize * (600.0 / -mv.z);
  gl_Position = projectionMatrix * mv;

  float dist = length(mv.xyz);
  float nearFade = smoothstep(60.0, 220.0, dist);
  float farFade = 1.0 - smoothstep(1600.0, 3000.0, dist);

  vAlpha = aBaseAlpha * uDensity * nearFade * farFade;
  vDepth = clamp(dist / 2500.0, 0.0, 1.0);
}
`;

const fogFrag = `
uniform vec3 uColorWarm;
uniform vec3 uColorCool;

varying float vAlpha;
varying float vDepth;

float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  if (d > 0.5) discard;

  float gauss = exp(-d * d * 9.0);
  float smooth5 = 1.0 - smoothstep(0.0, 0.5, d);
  float shape = gauss * smooth5;

  float grain = hash21(gl_FragCoord.xy * 0.3) * 0.10 - 0.05;
  float alpha = clamp((shape + grain) * vAlpha, 0.0, 0.82);
  if (alpha < 0.003) discard;

  float mix_t = vDepth * 0.65 + (1.0 - shape) * 0.35;
  vec3 col = mix(uColorWarm, uColorCool, clamp(mix_t, 0.0, 1.0));

  gl_FragColor = vec4(col, alpha);
}
`;

function makeFogSystem({ count, spread, yMin, yMax, baseSize, baseAlpha }) {
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const baseAlphas = new Float32Array(count);
  const phases = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = (0.12 + Math.pow(Math.random(), 0.55) * 0.88) * spread;
    positions[i*3] = Math.cos(angle) * r;
    positions[i*3+2] = Math.sin(angle) * r;
    const t = Math.pow(Math.random(), 1.9);
    positions[i*3+1] = yMin + t * (yMax - yMin);
    const heightNorm = 1.0 - (positions[i*3+1] - yMin) / (yMax - yMin);
    sizes[i] = baseSize * (0.45 + Math.random() * 1.55);
    baseAlphas[i] = baseAlpha * (0.35 + heightNorm * 0.65) * (0.5 + Math.random() * 0.5);
    phases[i] = Math.random() * Math.PI * 2;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute('aBaseAlpha', new THREE.BufferAttribute(baseAlphas, 1));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uDensity: { value: fogDensity },
      uColorWarm: { value: new THREE.Color(0xffb07a) },
      uColorCool: { value: new THREE.Color(0x8ab4c8) },
    },
    vertexShader: fogVert,
    fragmentShader: fogFrag,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });

  const pts = new THREE.Points(geo, mat);
  scene.add(pts);
  return { pts, mat };
}

function createVolumetricFog() {
  const near = makeFogSystem({ count:3500, spread:1800, yMin:-15, yMax:130, baseSize:380, baseAlpha:0.38 });
  fogNear = near.pts;
  fogMatNear = near.mat;

  const far = makeFogSystem({ count:4500, spread:4200, yMin:-30, yMax:200, baseSize:240, baseAlpha:0.22 });
  fogFar = far.pts;
  fogMatFar = far.mat;
}

function fillScene() {
  sceneFog = new THREE.FogExp2(0x9e6035, 0.00002 + fogDensity * 0.00028);
  scene.fog = sceneFog;

  scene.add(new THREE.AmbientLight(0x221100, 0.5));
  buildWater();
  buildMirror();
  createSun();

  if (skyEnvMap) scene.environment = skyEnvMap;

  addBoats(scene, skyEnvMap);
  createClouds();
  createVolumetricFog();
}

function init() {
  const container = document.getElementById('webGL');
  const W = container.clientWidth || 846;
  const H = container.clientHeight || 494;

  camera = new THREE.PerspectiveCamera(55, W / H, 50, 12000);
  camera.position.set(0, 220, 1400);

  renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
  renderer.setSize(W, H);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  cameraControls = new OrbitControls(camera, renderer.domElement);
  cameraControls.enableDamping = true;
  cameraControls.dampingFactor = 0.05;
  cameraControls.target.set(0, 60, -1200);
  cameraControls.minAzimuthAngle = -Infinity;
  cameraControls.maxAzimuthAngle = Infinity;
  cameraControls.minPolarAngle = Math.PI / 8;
  cameraControls.maxPolarAngle = Math.PI / 2.2;
  cameraControls.minDistance = 250;
  cameraControls.maxDistance = 2200;
  cameraControls.enablePan = false;

  cameraControls.addEventListener('change', () => {
    camera.position.y = Math.max(camera.position.y, 20);
    cameraControls.target.y = Math.max(cameraControls.target.y, 10);
  });

  cameraControls.update();
}

function addToDOM() {
  document.getElementById('webGL').appendChild(renderer.domElement);
  initDrag();
}

function initDrag() {
  const canvas = renderer.domElement;

  function toNDC(e) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function pickBoat() {
    raycaster.setFromCamera(mouse, camera);
    const meshes = [];
    boatObjects.forEach(entry => {
      entry.boat.traverse(obj => { if (obj.isMesh) meshes.push(obj); });
    });
    const hits = raycaster.intersectObjects(meshes, false);
    if (!hits.length) return null;
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
    cameraControls.enabled = false;
    canvas.style.cursor = 'grabbing';

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

  canvas.addEventListener('mouseup', stopDrag);
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
  const time = clock.getElapsedTime();

  if (water) water.material.uniforms['time'].value += 1.0 / 60.0;
  if (fogMatNear) fogMatNear.uniforms.uTime.value = time;
  if (fogMatFar) fogMatFar.uniforms.uTime.value = time;
  if (mirror && mirror._reflectorUniforms) mirror._reflectorUniforms.uTime.value = time;

  const BOUND = 4500;
  clouds.forEach(g => {
    const { initY, phase, speedX, speedZ } = g.userData;
    g.position.x += speedX * delta;
    g.position.z += speedZ * delta;
    g.position.y = initY + Math.sin(time * 0.15 + phase) * 80;
    if (g.position.x > BOUND) g.position.x = -BOUND;
    if (g.position.x < -BOUND) g.position.x = BOUND;
    if (g.position.z > BOUND) g.position.z = -BOUND;
    if (g.position.z < -BOUND) g.position.z = BOUND;
  });

  boatObjects.forEach(({ boat, initY, wavePhase }, idx) => {
    if (!boat) return;
    const p = wavePhase ?? idx * 2.1;
    const base = initY ?? 50;
    boat.position.y = base + Math.sin(time * 0.8 + p) * 3.5;
    boat.rotation.z = Math.sin(time * 0.6 + p * 1.3) * 0.025;
    boat.rotation.x = Math.sin(time * 0.5 + p * 0.7) * 0.015;
  });

  if (buoyMesh) {
    const baseY = -40 * 3;
    buoyMesh.position.y = baseY + Math.sin(time * 0.55 + 2.3) * 12;
    buoyMesh.rotation.z = Math.sin(time * 0.38 + 1.1) * 0.03;
    buoyMesh.rotation.x = Math.sin(time * 0.30 + 0.7) * 0.02;

    if (buoyMesh.userData.lanternMat) {
      const cycle = time % 3.0;
      const pulse = cycle < 0.5 ? Math.sin((cycle / 0.5) * Math.PI) : 0;
      buoyMesh.userData.lanternMat.emissiveIntensity = 0.3 + pulse * 2.5;
    }
  }

  cameraControls.update();
  renderer.render(scene, camera);
}

function createDragHint() {
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
  text.innerHTML = 'Cliquez & glissez un bateau pour le déplacer';
  text.style.cssText = 'line-height:1.4; opacity:0.85;';

  hint.append(icon, text);
  document.body.appendChild(hint);

  if (!document.getElementById('hintKeyframes')) {
    const style = document.createElement('style');
    style.id = 'hintKeyframes';
    style.textContent = `
@keyframes hintBob {
from { transform: translateY(0px); }
to { transform: translateY(-3px); }
}
`;
    document.head.appendChild(style);
  }

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