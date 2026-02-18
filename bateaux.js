"use strict";

/*global THREE, Coordinates, $, document*/
import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { dat } from './lib/dat.gui.min.js';
import { Coordinates } from './lib/Coordinates.js';

var camera, renderer;
var windowScale;
window.scene = new THREE.Scene();

//  FONCTION AUXILIAIRE : crée un triangle 2D
function makeTriangleMesh(p1, p2, p3, color) {
    const geometry = new THREE.BufferGeometry();
    const vertices = new Float32Array([
        p1.x, p1.y, 0,
        p2.x, p2.y, 0,
        p3.x, p3.y, 0
    ]);
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    const material = new THREE.MeshBasicMaterial({
        color: color,
        side: THREE.DoubleSide
    });
    return new THREE.Mesh(geometry, material);
}

// BARQUE AVEC DEUX MÂTS SÉPARÉS 
function createBoat(positionX, positionY, scale) {
    const boat = new THREE.Group();
    const hullColor = 0x000000;    // coque
    const sailColor = 0x000000;    // voiles

    // Coque
    const hullPoints = [
        new THREE.Vector2(-1.4, -0.2),
        new THREE.Vector2( 1.4, -0.2),
        new THREE.Vector2( 0.9, -0.6),
        new THREE.Vector2(-0.9, -0.6)
    ];

    boat.add(makeTriangleMesh(hullPoints[0], hullPoints[1], hullPoints[2], hullColor));
    boat.add(makeTriangleMesh(hullPoints[0], hullPoints[2], hullPoints[3], hullColor));
    boat.add(makeTriangleMesh(new THREE.Vector2(-1.4, -0.2), new THREE.Vector2( 0.0, -0.2), new THREE.Vector2(-0.9, -0.6), hullColor));
    boat.add(makeTriangleMesh(new THREE.Vector2( 0.0, -0.2), new THREE.Vector2( 1.4, -0.2), new THREE.Vector2( 0.9, -0.6), hullColor));

    //  MÂT 1 (GAUCHE)
    const mast1X = 0.10;
    const mast1Top = 1.9;
    const mast1Bottom = -0.30;
    const mastWidth = 0.03;

    boat.add(makeTriangleMesh(
        new THREE.Vector2(mast1X-mastWidth, mast1Bottom),
        new THREE.Vector2(mast1X+mastWidth, mast1Bottom),
        new THREE.Vector2(mast1X-mastWidth, mast1Top),
        hullColor
    ));
    boat.add(makeTriangleMesh(
        new THREE.Vector2(mast1X+mastWidth, mast1Bottom),
        new THREE.Vector2(mast1X+mastWidth, mast1Top),
        new THREE.Vector2(mast1X-mastWidth, mast1Top),
        hullColor
    ));

    //  VOILE 1 (attachée au mât gauche) 
    boat.add(makeTriangleMesh(
        new THREE.Vector2(mast1X, mast1Top),
        new THREE.Vector2(mast1X-1.0, 0.6),
        new THREE.Vector2(mast1X, 0.2),
        sailColor
    ));


    // Position et échelle finale
    boat.scale.set(scale, scale, 1);
    boat.position.set(positionX, positionY, 0);
    return boat;
}

// INITIALISATION 
function init() {
    var canvasWidth = 1100;
    var canvasHeight = 494;
    var canvasRatio = canvasWidth / canvasHeight;

    windowScale = 8;
    var windowWidth = windowScale * canvasRatio;
    var windowHeight = windowScale;

    camera = new THREE.OrthographicCamera(
        windowWidth / -2, windowWidth / 2,
        windowHeight / 2, windowHeight / -2,
        0, 40
    );

    var focus = new THREE.Vector3(0, 0, 0);
    camera.position.set(focus.x, focus.y, 10);
    camera.lookAt(focus);

    renderer = new THREE.WebGLRenderer({
        antialias: true,
        preserveDrawingBuffer: true
    });
    renderer.setSize(canvasWidth, canvasHeight);
    renderer.setClearColor(0xFFFFFF, 1.0);
}

//  DOM ET RENDU 
function addToDOM() {
    var container = document.getElementById('webGL');
    var canvas = container.getElementsByTagName('canvas');
    if (canvas.length > 0) {
        container.removeChild(canvas[0]);
    }
    container.appendChild(renderer.domElement);
}

function render() {
    renderer.render(window.scene, camera);
}

//  PRINCIPAL 
try {
    init();

    // Trois bateaux chacun avec 
    const boat1 = createBoat(-4.0, -1.5, 1.5);
    const boat2 = createBoat(0.5, -1.5, 1.7);
    const boat3 = createBoat( 5.5, -1.5, 1.8);

    window.scene.add(boat1);
    window.scene.add(boat2);
    window.scene.add(boat3);

    addToDOM();
    render();
} catch (e) {
    var errorReport = "Votre programme a rencontré une erreur irrécupérable, impossible d'afficher sur le canvas. Erreur :<br/><br/>";
    var container = document.getElementById('container');
    if (container) {
        container.innerHTML = errorReport + e;
    }
}
