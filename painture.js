"use strict";

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Water } from 'https://threejs.org/examples/jsm/objects/Water.js';

let camera, renderer, cameraControls, clock, sky, water;
let scene = new THREE.Scene();
clock = new THREE.Clock();

function buildWater() {
    const waterGeometry = new THREE.PlaneGeometry(10000, 10000);

    const textureLoader = new THREE.TextureLoader();
    const waterNormals = textureLoader.load(
        'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/waternormals.jpg'
    );
    waterNormals.wrapS = waterNormals.wrapT = THREE.RepeatWrapping;

    water = new Water(waterGeometry, {
        textureWidth: 512,
        textureHeight: 512,
        waterNormals: waterNormals,
        alpha: 1.0,
        sunDirection: new THREE.Vector3(1, 1, 1).normalize(),
        sunColor: 0xffffff,
        waterColor: 0x001e0f, 
        distortionScale: 3.7,
        fog: scene.fog !== undefined
    });

    water.rotation.x = -Math.PI / 2;
    water.position.y = 0;
    scene.add(water);

    return water;
}



function fillScene() {
    scene.add(new THREE.AmbientLight(0x444444));

    let light1 = new THREE.DirectionalLight(0xffffff, 1.2);
    light1.position.set(-1300, 700, 1240);
    scene.add(light1);

    // Céu - Usando uma esfera completa para evitar vãos no horizonte
    const loader = new THREE.TextureLoader();
    loader.load('textures/sunset.jpg', function (texture) {
        const geometry = new THREE.SphereGeometry(5000, 64, 32);
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            side: THREE.BackSide
        });

        sky = new THREE.Mesh(geometry, material);
        scene.add(sky);
    });

    buildWater();
}

function init() {
    const container = document.getElementById('webGL');
    const canvasWidth = container.clientWidth || 846;
    const canvasHeight = container.clientHeight || 494;

    camera = new THREE.PerspectiveCamera(45, canvasWidth / canvasHeight, 1, 20000);
    // Posicionando a câmera um pouco acima da água
    camera.position.set(-222, 50, 1000);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(canvasWidth, canvasHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    cameraControls = new OrbitControls(camera, renderer.domElement);
    cameraControls.target.set(0, -160, 0);

    cameraControls.enablePan = false;

    // NÃO deixa rodar tudo (evita ver a junção)
    cameraControls.minAzimuthAngle = -Math.PI / 2;
    cameraControls.maxAzimuthAngle = Math.PI / 20000;

    // NÃO deixa olhar demais para cima/baixo
    cameraControls.minPolarAngle = Math.PI / 4;
    cameraControls.maxPolarAngle = Math.PI / 1.8;


    // Limites de zoom
    cameraControls.minDistance = 100;
    cameraControls.maxDistance = 5000;

    cameraControls.update();
}

function addToDOM() {
    const container = document.getElementById('webGL');
    container.appendChild(renderer.domElement);
}

function animate() {
    requestAnimationFrame(animate);
    render();
}

function render() {
    const delta = clock.getDelta();
    const time = clock.getElapsedTime();

    // Animação do movimento da água
    if (water) {
        water.material.uniforms['time'].value += 1.0 / 60.0;
    }

    cameraControls.update();
    renderer.render(scene, camera);
}

// Inicialização
try {
    init();
    fillScene();
    addToDOM();
    animate();
} catch (e) {
    console.error(e);
}