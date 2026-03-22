"use strict";

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Water } from 'https://threejs.org/examples/jsm/objects/Water.js';
import { Sky } from 'three/addons/objects/Sky.js';


let camera, renderer, cameraControls, clock, sky, water, sun;
let scene = new THREE.Scene();
clock = new THREE.Clock();


function createSun() {
    // 1. Configurar o Sky (Céu Atmosférico)
    const sky = new Sky();
    sky.scale.setScalar(450000);
    scene.add(sky);

    const sunVec = new THREE.Vector3();

    const effectController = {
        turbidity: 10,
        rayleigh: 3,
        mieCoefficient: 0.005,
        mieDirectionalG: 0.7,
        elevation: 2,
        azimuth: 0,
    };

    const uniforms = sky.material.uniforms;
    uniforms['turbidity'].value = effectController.turbidity;
    uniforms['rayleigh'].value = effectController.rayleigh;
    uniforms['mieCoefficient'].value = effectController.mieCoefficient;
    uniforms['mieDirectionalG'].value = effectController.mieDirectionalG;

    const phi = THREE.MathUtils.degToRad(90 - effectController.elevation);
    const theta = THREE.MathUtils.degToRad(effectController.azimuth);

    sunVec.setFromSphericalCoords(1, phi, theta);
    uniforms['sunPosition'].value.copy(sunVec);

    // 2. Sincronizar com a Água
    if (water) {
        water.material.uniforms['sunDirection'].value.copy(sunVec).normalize();
    }

    // 3. Criar a luz e atribuir à variável global 'sun' para evitar o erro de undefined
    const sunLight = new THREE.DirectionalLight(0xff4400, 2);
    sunLight.position.copy(sunVec).multiplyScalar(1000);
    scene.add(sunLight);

    // IMPORTANTE: Define a variável global sun
    sun = sunLight;
}

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
        waterNormals: new THREE.TextureLoader().load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/waternormals.jpg', (texture) => {
            texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        }),
        sunDirection: new THREE.Vector3(),
        sunColor: 0xff8844,      // Cor do brilho do sol na água
        waterColor: 0x001e0f,    // Cor da profundidade
        distortionScale: 3.7,
        fog: scene.fog !== undefined
    });

    water.rotation.x = -Math.PI / 2;
    water.position.y = 0;
    scene.add(water);

    return water;
}

let clouds = [];

function createClouds() {
    const loader = new THREE.TextureLoader();
    const texture = loader.load('textures/nuage.png');

    // 1. Usamos SpriteMaterial em vez de MeshLambertMaterial
    // Sprites não respondem a luzes da mesma forma (Lambert/Phong), 
    // então usamos a cor e emissive no material se necessário.
    const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: 0.6,
        color: 0xffccaa, // Dá o tom alaranjado do pôr do sol diretamente
        depthWrite: false
    });

    const cloudGroups = 50;

    for (let i = 0; i < cloudGroups; i++) {
        const group = new THREE.Group();
        const parts = 3 + Math.floor(Math.random() * 5);

        for (let j = 0; j < parts; j++) {
            // 2. Criamos o Sprite
            const cloudSprite = new THREE.Sprite(material);

            // Posição relativa dentro do grupo
            cloudSprite.position.x = (Math.random() - 0.5) * 200;
            cloudSprite.position.y = (Math.random() - 0.5) * 100;
            cloudSprite.position.z = (Math.random() - 0.5) * 200;

            // 3. Escala (Sprites usam a escala para definir o tamanho no mundo)
            const scaleX = 300 * (1 + Math.random() * 2);
            const scaleY = 200 * (0.5 + Math.random() * 1);
            cloudSprite.scale.set(scaleX, scaleY, 1);

            group.add(cloudSprite);
        }

        group.position.set(
            (Math.random() - 0.5) * 8000,
            1000 + Math.random() * 500,
            (Math.random() - 0.5) * 8000
        );

        clouds.push(group);
        scene.add(group);
    }
}

/**
 function fillScene() {
    scene.add(new THREE.AmbientLight(0x221100, 0.5));

    createSun();

    
    let light1 = new THREE.DirectionalLight(0xff9966, 1.5);
    light1.position.copy(sun.position);
    scene.add(light1);

    // Céu - Usando uma esfera completa para evitar vãos no horizonte
    const loader = new THREE.TextureLoader();
    loader.load('textures/sunset_5.png', function (texture) {
        const geometry = new THREE.SphereGeometry(5000, 64, 32);
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            side: THREE.BackSide
        });

        sky = new THREE.Mesh(geometry, material);
        scene.add(sky);
    });

    buildWater();
    createClouds();
}
 */

function fillScene() {
    scene.add(new THREE.AmbientLight(0x221100, 0.5));

    // 1. Primeiro a água
    buildWater();

    // 2. Depois o sol (que agora vai atualizar a água corretamente)
    createSun();

    // 3. Remova o loader.load('textures/sunset_5.png', ...) daqui!
    // O Sky dinâmico já faz o papel do céu.

    createClouds();
}

/**
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
 */

function init() {
    const container = document.getElementById('webGL');
    const canvasWidth = container.clientWidth || 846;
    const canvasHeight = container.clientHeight || 494;

    camera = new THREE.PerspectiveCamera(45, canvasWidth / canvasHeight, 1, 20000);
    // Posicionando a câmera numa altura de observador humano ou barco
    camera.position.set(-222, 100, 1000);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(canvasWidth, canvasHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    cameraControls = new OrbitControls(camera, renderer.domElement);

    // --- CONFIGURAÇÕES DE REALISMO ---

    // 1. Suavização (Damping) - Dá peso ao movimento
    cameraControls.enableDamping = true;
    cameraControls.dampingFactor = 0.05;

    // 2. Limitar o Alvo (Target)
    // Mantém o olhar sempre próximo ao horizonte
    cameraControls.target.set(0, 50, 0);

    // cameraControls.minAzimuthAngle = -Math.PI / 2;
    // cameraControls.maxAzimuthAngle = Math.PI / 20000;

    // Dentro de init()
    cameraControls.minAzimuthAngle = -Infinity; // Ou um valor mais aberto como -Math.PI
    cameraControls.maxAzimuthAngle = Infinity;  // Ou Math.PI

    // 3. Limites Verticais (Polar Angle)
    // Math.PI / 2 é o horizonte exato. 
    // 1.1 impede de olhar muito para baixo. 1.9 impede de olhar o topo "vazio".
    cameraControls.minPolarAngle = Math.PI / 2.5; // Olhar um pouco para cima
    cameraControls.maxPolarAngle = Math.PI / 1.9; // Não deixa mergulhar na água

    // 4. Limites de Zoom
    // Evita que o mundo pareça pequeno ou que o utilizador se perca
    cameraControls.minDistance = 200;
    cameraControls.maxDistance = 2500;

    // 5. Impedir Pan (Movimentação lateral com botão direito)
    // Isso mantém o utilizador "preso" ao centro da cena
    cameraControls.enablePan = false;

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

    // --- ANIMAÇÃO DAS NUVENS ---
    clouds.forEach(group => {
        // 1. Movimento horizontal
        group.position.x += 0.2;

        // Loop infinito
        if (group.position.x > 5000) {
            group.position.x = -5000;
        }
    });

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