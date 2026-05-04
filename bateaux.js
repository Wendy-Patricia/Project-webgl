// bateaux.js
"use strict";

import * as THREE from 'three';

function createBoat(x, y, z, scale) {
    const boat = new THREE.Group();

    const hullShape = new THREE.Shape();
    hullShape.moveTo(-1.4, -0.2);
    hullShape.lineTo(1.4, -0.2);
    hullShape.lineTo(0.9, -0.6);
    hullShape.lineTo(-0.9, -0.6);
    hullShape.lineTo(-1.4, -0.2);

    const hull = new THREE.Mesh(
        new THREE.ExtrudeGeometry(hullShape, { depth: 0.5, bevelEnabled: false }),
        new THREE.MeshPhongMaterial({ color: 0x8B4513 })
    );
    hull.position.z = -0.25;
    boat.add(hull);

    const mast = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 2.2, 0.1),
        new THREE.MeshPhongMaterial({ color: 0x8B4513 })
    );
    mast.position.set(0.1, 0.8, 0);
    boat.add(mast);

    const sailShape = new THREE.Shape();
    sailShape.moveTo(0.1, 1.9);
    sailShape.lineTo(-0.9, 0.6);
    sailShape.lineTo(0.1, 0.2);

    const sail = new THREE.Mesh(
        new THREE.ExtrudeGeometry(sailShape, { depth: 0.08, bevelEnabled: false }),
        new THREE.MeshPhongMaterial({ color: 0xffffff, opacity: 0.9, transparent: true })
    );
    sail.position.z = -0.1;
    boat.add(sail);

    boat.scale.set(scale, scale, scale);
    boat.position.set(x, y, z);
    boat.rotation.y = 0;

    return boat;
}

//Fonction qui reçoit la scène et ajoute les bateaux à la scène
export function addBoats(scene) {
    scene.add(createBoat(-90, 50, 800, 100));
    scene.add(createBoat(305, 50, 956, 100));
    scene.add(createBoat(60, 50, 30, 100));
}
