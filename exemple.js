"use strict"; // good practice - see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Strict_mode
////////////////////////////////////////////////////////////////////////////////
// Fixing Incorrect JavaScript exercise
////////////////////////////////////////////////////////////////////////////////
// Your task is to find the syntax errors in this Javacript
// until it shows the the Gold Cube!
// WebGL is not supported in Internet Explorer
// There are 3 syntax errors in this code
////////////////////////////////////////////////////////////////////////////////
/*global THREE, Coordinates, $, document, window*/
import * as THREE from 'three';

import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {dat} from './../lib/dat.gui.min.js';

var camera, renderer;
var windowScale;
window.scene = new THREE.Scene();
import {Coordinates} from './../lib/Coordinates.js';

var cameraControls;
var clock = new THREE.Clock();

function drawSphere() {

	const geometry = new THREE.SphereGeometry( 15, 32, 16 ); 
	const material = new THREE.MeshBasicMaterial( { color: 0xffff00 } ); 
	const sphere = new THREE.Mesh( geometry, material );
	window.scene.add( sphere) ;

}

function init() {
	var canvasWidth = 846;
	var canvasHeight = 494;
	var canvasRatio = canvasWidth / canvasHeight;
	// LIGHTS
	 window.scene.add( new THREE.AmbientLight( 0x222222 ) );

	// RENDERER

	renderer = new THREE.WebGLRenderer( { antialias: true } );
	renderer.gammaInput = true;
	renderer.gammaOutput = true;
	renderer.setSize(canvasWidth, canvasHeight);
	renderer.setClearColor( 0xFFFFFF, 1 );



	// CAMERA
	camera = new THREE.PerspectiveCamera( 45, canvasRatio, 1, 4000 );
	camera.position.set( -200, 200, -150 );
	// CONTROLS
	cameraControls = new OrbitControls( camera, renderer.domElement );
	cameraControls.target.set(0,0,0);

	// draw the coordinate grid

	
	Coordinates.drawGrid({size:1000,scale:0.01});
	Coordinates.drawGrid({size:1000,scale:0.01, orientation:"y"});
	Coordinates.drawGrid({size:1000,scale:0.01, orientation:"z"});
}

function animate() {
	requestAnimationFrame(animate);
	render();
}

function render() {
	var delta = clock.getDelta();
	cameraControls.update(delta);
	renderer.render( window.scene, camera);
}

// Ajout du rendu à la page web
function addToDOM() {
	var container = document.getElementById("webGL");
	container.appendChild( renderer.domElement );
}


init();
drawSphere();
animate();
addToDOM()

