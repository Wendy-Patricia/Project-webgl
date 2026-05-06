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

    // ── Matériaux exposés pour le contrôle de transparence ──
    const hullMat = new THREE.MeshPhongMaterial({
        color: 0x8B4513,
        transparent: true,
        opacity: 1.0
    });
    const mastMat = new THREE.MeshPhongMaterial({
        color: 0x8B4513,
        transparent: true,
        opacity: 1.0
    });
    const sailMat = new THREE.MeshPhongMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.9
    });
    // ────────────────────────────────────────────────────────

    const hull = new THREE.Mesh(
        new THREE.ExtrudeGeometry(hullShape, { depth: 0.5, bevelEnabled: false }),
        hullMat
    );
    hull.position.z = -0.25;
    hull.castShadow    = true;
    hull.receiveShadow = true;
    boat.add(hull);

    const mast = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 2.2, 0.1),
        mastMat
    );
    mast.position.set(0.1, 0.8, 0);
    mast.castShadow    = true;
    mast.receiveShadow = true;
    boat.add(mast);

    const sailShape = new THREE.Shape();
    sailShape.moveTo(0.1, 1.9);
    sailShape.lineTo(-0.9, 0.6);
    sailShape.lineTo(0.1, 0.2);

    const sail = new THREE.Mesh(
        new THREE.ExtrudeGeometry(sailShape, { depth: 0.08, bevelEnabled: false }),
        sailMat
    );
    sail.position.z = -0.1;
    sail.castShadow    = true;
    sail.receiveShadow = true;
    boat.add(sail);

    boat.scale.set(scale, scale, scale);
    boat.position.set(x, y, z);
    boat.rotation.y = 0;

    // Retourne le groupe ET les matériaux pour contrôle externe
    return { boat, hullMat, mastMat, sailMat };
}

// Tableau global des matériaux de tous les bateaux,
// accessible depuis painture.js pour les sliders de transparence
export let boatMaterials = [];

// Tableau global des objets bateaux (groupe + position initiale),
// accessible depuis painture.js pour les sliders de position
export let boatObjects = [];

// Fonction qui reçoit la scène et ajoute les bateaux à la scène
export function addBoats(scene) {
    boatMaterials = [];
    boatObjects   = [];

    // Définition des bateaux : x, y, z, scale, label
    const defs = [
        { x: -90, y: 50, z: 800, scale: 100, label: 'Bateau 1' },
        { x: 305, y: 50, z: 956, scale: 100, label: 'Bateau 2' },
        { x:  60, y: 50, z:  30, scale: 100, label: 'Bateau 3' },
    ];

    defs.forEach(({ x, y, z, scale, label }, idx) => {
        const b = createBoat(x, y, z, scale);
        scene.add(b.boat);

        boatMaterials.push({ hullMat: b.hullMat, mastMat: b.mastMat, sailMat: b.sailMat });

        // initY : position verticale de référence pour le balouço
        // wavePhase : déphasage unique par bateau (mouvement dessynchronisé)
        boatObjects.push({
            boat:      b.boat,
            label,
            initX:     x,
            initY:     y,
            initZ:     z,
            wavePhase: idx * 2.1 + Math.random() * 1.5,
        });
    });
}