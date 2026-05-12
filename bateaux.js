"use strict";

import * as THREE from 'three';

const _loader = new THREE.TextureLoader();

// Texture de couleur (bois) 
const colorTex = _loader.load('textures/texture.jpg', t => {
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
});

//  Normal map — relief des planches de bois
const normalTex = _loader.load('textures/textureMap.png', t => {
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
});

// Specular map — contrôle le brillant pixel par pixel 
const specularTex = _loader.load('textures/textureMap.png', t => {
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
});

function createBoat(x, y, z, scale) {
  const boat = new THREE.Group();

  const hullShape = new THREE.Shape();
  hullShape.moveTo(-1.4, -0.2);
  hullShape.lineTo( 1.4, -0.2);
  hullShape.lineTo( 0.9, -0.6);
  hullShape.lineTo(-0.9, -0.6);
  hullShape.lineTo(-1.4, -0.2);

  // COQUE — bois verni
  const hullMat = new THREE.MeshPhongMaterial({
    color: 0x8B4513,
    map: colorTex,
    normalMap: normalTex,
    normalScale: new THREE.Vector2(1.0, 1.0),
    specularMap: specularTex,
    specular: 0x552211,
    shininess: 40,
    transparent: true,
    opacity: 1.0,
  });

  // MÂT — bois plus sombre et brillant
  const mastMat = new THREE.MeshPhongMaterial({
    color: 0x8B4513,
    normalMap: normalTex,
    normalScale: new THREE.Vector2(0.6, 0.6),
    specularMap: specularTex,
    specular: 0x664422,
    shininess: 100,
    transparent: true,
    opacity: 1.0,
  });

  // VOILE — tissu blanc
  const sailMat = new THREE.MeshPhongMaterial({
    color: 0xffffff,
    normalMap: normalTex,
    normalScale: new THREE.Vector2(0.25, 0.25),
    specular: 0x888888,
    shininess: 30,
    transparent: true,
    opacity: 0.9,
  });

  const hull = new THREE.Mesh(
    new THREE.ExtrudeGeometry(hullShape, { depth: 0.5, bevelEnabled: false }),
    hullMat
  );
  hull.position.z = -0.25;
  hull.castShadow = true;
  hull.receiveShadow = true;
  hull.renderOrder = 1;
  boat.add(hull);

  const mast = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 2.2, 0.1),
    mastMat
  );
  mast.position.set(0.1, 0.8, 0);
  mast.castShadow = true;
  mast.receiveShadow = true;
  boat.add(mast);

  const sailShape = new THREE.Shape();
  sailShape.moveTo( 0.1, 1.9);
  sailShape.lineTo(-0.9, 0.6);
  sailShape.lineTo( 0.1, 0.2);

  const sail = new THREE.Mesh(
    new THREE.ExtrudeGeometry(sailShape, { depth: 0.08, bevelEnabled: false }),
    sailMat
  );
  sail.position.z = -0.1;
  sail.castShadow = true;
  sail.receiveShadow = true;
  boat.add(sail);

  boat.scale.set(scale, scale, scale);
  boat.position.set(x, y, z);
  boat.rotation.y = Math.PI;

  return { boat, hullMat, mastMat, sailMat };
}

export let boatMaterials = [];
export let boatObjects = [];
export let buoyMesh = null;

function createBeacon(scene, envMap) {
  const group = new THREE.Group();
  const S = 3;

  const metalMat = new THREE.MeshStandardMaterial({
    color: 0x999999,
    metalness: 1.0,
    roughness: 0.12,
    envMap: envMap,
    envMapIntensity: 1.0,
  });

  const metalMatteMat = new THREE.MeshStandardMaterial({
    color: 0x666666,
    metalness: 0.8,
    roughness: 0.5,
    envMap: envMap,
    envMapIntensity: 0.5,
  });

  const redMat = new THREE.MeshStandardMaterial({
    color: 0xdd1100,
    metalness: 0.4,
    roughness: 0.45,
    envMap: envMap,
    envMapIntensity: 0.6,
  });

  const whiteMat = new THREE.MeshStandardMaterial({
    color: 0xeeeecc,
    metalness: 0.2,
    roughness: 0.55,
  });
  
  //Matériau de la lanterne avec émission pour simuler la lumière
  const lanternMat = new THREE.MeshStandardMaterial({
    color: 0xffdd44,
    emissive: 0xff9900,
    emissiveIntensity: 2.0,
    metalness: 0.0,
    roughness: 0.05,
    transparent: true,
    opacity: 0.9,
  });
  group.userData.lanternMat = lanternMat;

  const floatBody = new THREE.Mesh(
    new THREE.CylinderGeometry(38*S, 34*S, 80*S, 32),
    redMat
  );
  floatBody.castShadow = floatBody.receiveShadow = true;
  group.add(floatBody);

  const floatTop = new THREE.Mesh(
    new THREE.SphereGeometry(38*S, 32, 16, 0, Math.PI*2, 0, Math.PI/2),
    redMat
  );
  floatTop.position.y = 40*S;
  floatTop.castShadow = true;
  group.add(floatTop);

  const floatBottom = new THREE.Mesh(
    new THREE.SphereGeometry(34*S, 32, 16, 0, Math.PI*2, Math.PI/2, Math.PI/2),
    redMat
  );
  floatBottom.position.y = -40*S;
  group.add(floatBottom);

  [-20*S, 5*S, 28*S].forEach(yPos => {
    const stripe = new THREE.Mesh(
      new THREE.CylinderGeometry(39.5*S, 39.5*S, 8*S, 32),
      whiteMat
    );
    stripe.position.y = yPos;
    group.add(stripe);
  });

  const bumper = new THREE.Mesh(
    new THREE.TorusGeometry(42*S, 5*S, 12, 48),
    metalMatteMat
  );
  bumper.rotation.x = Math.PI / 2;
  bumper.position.y = 0;
  bumper.castShadow = true;
  group.add(bumper);

  const platform = new THREE.Mesh(
    new THREE.CylinderGeometry(32*S, 35*S, 8*S, 32),
    metalMat
  );
  platform.position.y = 52*S;
  platform.castShadow = true;
  group.add(platform);

  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2*S, 1.2*S, 14*S, 6),
      metalMatteMat
    );
    post.position.set(
      Math.cos(angle) * 28*S,
      60*S,
      Math.sin(angle) * 28*S
    );
    group.add(post);
  }

  const railRing = new THREE.Mesh(
    new THREE.TorusGeometry(28*S, 1.8*S, 8, 48),
    metalMatteMat
  );
  railRing.rotation.x = Math.PI / 2;
  railRing.position.y = 68*S;
  group.add(railRing);

  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(3*S, 4*S, 180*S, 14),
    metalMat
  );
  mast.position.y = 56*S + 90*S;
  mast.castShadow = true;
  group.add(mast);

  const cross1 = new THREE.Mesh(
    new THREE.BoxGeometry(120*S, 5*S, 5*S),
    metalMatteMat
  );
  cross1.position.y = 130*S;
  group.add(cross1);

  const cross2 = new THREE.Mesh(
    new THREE.BoxGeometry(80*S, 4*S, 4*S),
    metalMatteMat
  );
  cross2.position.y = 180*S;
  group.add(cross2);

  [[-1, 130*S, 55*S, 0.55], [1, 130*S, 55*S, -0.55],
   [-1, 180*S, 35*S, 0.5], [1, 180*S, 35*S, -0.5]].forEach(([side, cy, cx, rz]) => {
    const brace = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2*S, 1.2*S, 50*S, 6),
      metalMatteMat
    );
    brace.position.set(side * cx * 0.5, cy - 14*S, 0);
    brace.rotation.z = rz;
    group.add(brace);
  });

  const lanternBase = new THREE.Mesh(
    new THREE.CylinderGeometry(13*S, 13*S, 14*S, 16),
    metalMat
  );
  lanternBase.position.y = 242*S;
  group.add(lanternBase);

  const lanternGlass = new THREE.Mesh(
    new THREE.CylinderGeometry(10*S, 10*S, 22*S, 8),
    lanternMat
  );
  lanternGlass.position.y = 260*S;
  group.add(lanternGlass);

  const lanternRing = new THREE.Mesh(
    new THREE.TorusGeometry(11*S, 2*S, 8, 8),
    metalMat
  );
  lanternRing.rotation.x = Math.PI / 2;
  lanternRing.position.y = 260*S;
  group.add(lanternRing);

  const cap = new THREE.Mesh(
    new THREE.ConeGeometry(13*S, 18*S, 8),
    metalMat
  );
  cap.position.y = 280*S;
  group.add(cap);

  const tip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.8*S, 0.8*S, 24*S, 6),
    metalMat
  );
  tip.position.y = 297*S;
  group.add(tip);

  group.position.set(-800, -40*S, -400);
  scene.add(group);
  return group;
}

export function addBoats(scene, envMap) {
  boatMaterials = [];
  boatObjects = [];

  //Positions des bateaux (x, y, z), échelle et label
  const defs = [
    { x: -120, y: 50, z: -200, scale: 100, label: 'Bateau 1' },
    { x:  300, y: 50, z:  200, scale: 100, label: 'Bateau 2' },
    { x:  300, y: 50, z: -500, scale: 100, label: 'Bateau 3' },
  ];
   
  // Création des bateaux à partir des définitions
  defs.forEach(({ x, y, z, scale, label }, idx) => {
    const b = createBoat(x, y, z, scale);
    scene.add(b.boat);
    boatMaterials.push({ hullMat: b.hullMat, mastMat: b.mastMat, sailMat: b.sailMat });
    boatObjects.push({
      boat: b.boat,
      label,
      initX: x,
      initY: y,
      initZ: z,
      wavePhase: idx * 2.1 + Math.random() * 1.5,
    });
  });

  buoyMesh = createBeacon(scene, envMap);
}