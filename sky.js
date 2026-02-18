"use strict"; // good practice - see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Strict_mode 
////////////////////////////////////////////////////////////////////////////////
/*global THREE, window, document, $*/
import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { dat } from './lib/dat.gui.min.js';
import { Coordinates } from './lib/Coordinates.js';

var camera, renderer;
var cameraControls;
var clock = new THREE.Clock();
window.scene = new THREE.Scene();

function fillScene() {

    // LIGHTS
    window.scene.add(new THREE.AmbientLight(0x333333));

    var light = new THREE.DirectionalLight(0xFFFFFF, 0.9);
    light.position.set(-1300, 700, 1240);
    window.scene.add(light);

    light = new THREE.DirectionalLight(0xFFFFFF, 0.7);
    light.position.set(1000, -500, -1200);
    window.scene.add(light);

    // SKY
    const loader = new THREE.TextureLoader();
    loader.load('textures/sunset2.jpg', function (texture) {
        const geometry = new THREE.SphereGeometry(5000, 60, 40); // esfera maior para céu infinito
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            side: THREE.BackSide
        });

        const sky = new THREE.Mesh(geometry, material);
        sky.name = 'sky'; // importante para movimentar com a câmera
        scene.add(sky);
    });
}

function init() {
    var canvasWidth = 846;
    var canvasHeight = 494;

    // CAMERA
    camera = new THREE.PerspectiveCamera(45, canvasWidth / canvasHeight, 100, 20000);
    camera.position.set(-222, 494, 1746);

    // RENDERER
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(canvasWidth, canvasHeight);
    renderer.setClearColor(0x000000, 1.0); // fundo preto, céu cobre tudo
    renderer.gammaInput = true;
    renderer.gammaOutput = true;

    // CONTROLS
    cameraControls = new OrbitControls(camera, renderer.domElement);
    cameraControls.target.set(0, -160, 0);
}

function addToDOM() {
    var container = document.getElementById('webGL');
    var canvas = container.getElementsByTagName('canvas');
    if (canvas.length > 0) {
        container.removeChild(canvas[0]);
    }
    container.appendChild(renderer.domElement);
}

function animate() {
    requestAnimationFrame(animate);
    render();
}

function render() {
    var delta = clock.getDelta();
    cameraControls.update(delta);

    // Mantém o céu sempre centrado na câmera
    const sky = scene.getObjectByName('sky');
    if (sky) {
        sky.position.copy(camera.position);
    }

    renderer.render(scene, camera);
}

try {
    init();
    fillScene();
    addToDOM();
    animate();
} catch (e) {
    var errorReport = "Your program encountered an unrecoverable error, can not draw on canvas. Error was:<br/><br/>";
    $('#webGL').append(errorReport + e);
}
