import * as THREE from 'three';
import { OrbitControls } from 'https://threejs.org/examples/jsm/controls/OrbitControls.js';
import { Water } from 'https://threejs.org/examples/jsm/objects/Water.js';

function SceneManager(canvas) {

    const scene = buildScene();
    const renderer = buildRenderer(canvas);
    const camera = buildCamera();
    
    // Déclarer les variables
    let water;
    let orbitCon;
    
    // Initialiser
    water = buildWater();
    orbitCon = setOrbitControls();

    function buildScene() {
        const scene = new THREE.Scene();
       // scene.background = new THREE.Color(0xFF0000); // Rouge
        return scene;
    }

    function buildRenderer(canvas) {
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 0.5;
        canvas.appendChild(renderer.domElement);
        return renderer;
    }

    function buildCamera() {
        const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 1, 20000);
        camera.position.set(30, 30, 100);
        return camera;
    }

    function buildWater() {
        const waterGeometry = new THREE.PlaneGeometry(10000, 10000);
        
        const textureLoader = new THREE.TextureLoader();
        const waterNormals = textureLoader.load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/waternormals.jpg');
        waterNormals.wrapS = waterNormals.wrapT = THREE.RepeatWrapping;
        
        const water = new Water(
          waterGeometry,
          {
            textureWidth: 512,
            textureHeight: 512,
            waterNormals: waterNormals,
            alpha: 1.0,
            sunDirection: new THREE.Vector3(1, 1, 1).normalize(), // Direction du soleil
            sunColor: 0xffffff,
            waterColor: 0x808080,
            distortionScale: 3.7,
            fog: scene.fog !== undefined
          }
        );
        water.rotation.x = -Math.PI / 2;
        water.position.y = 0;
        scene.add(water);
        
        return water;
    }

    function setOrbitControls() {
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.maxPolarAngle = Math.PI * 0.495;
        controls.target.set(0, 0, 0);
        controls.minDistance = 40.0;
        controls.maxDistance = 200.0;
        controls.update();
        return controls;
    }

    this.update = function() {
        // Animer l'eau
        if (water && water.material.uniforms['time']) {
            water.material.uniforms['time'].value += 1.0 / 60.0;
        }
        
        renderer.render(scene, camera);
    }

    function onWindowResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
    window.addEventListener('resize', onWindowResize);
}

const canvas = document.getElementById("webGL");
if (canvas) {
    const sceneManager = new SceneManager(canvas);

    function animate() {
        requestAnimationFrame(animate);
        sceneManager.update();
    }
    animate();
} else {
    console.error("Canvas element not found!");
}