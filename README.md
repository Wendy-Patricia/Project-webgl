# Scène Maritime - Coucher de soleil sur l'Atlantique

Projet de modélisation 3D en **WebGL / Three.js** représentant une scène maritime interactive inspirée d'une aquarelle de voiliers au coucher de soleil.

> Réalisé dans le cadre du module **Modélisation 3D** - IUT Saint-Dié · 2025-2026

---

## Auteures

* **Eunice Ligeiro**
* **Wendy Mechisso**
* **Aingo Razakanirina**

---

## Aperçu

La scène met en avant trois voiliers naviguant sur une mer réfléchissante, sous un ciel dynamique généré par shader et baigné dans une lumière orangée de fin de journée. Le rendu est entièrement interactif : caméra orbitale, bateaux déplaçables, brouillard et transparence ajustables en temps réel.

Le projet s'inspire d'une aquarelle représentant trois voiliers voguant vers un coucher de soleil flamboyant (voir `img.png`), avec pour objectif de retranscrire cette atmosphère lumineuse et contemplative en rendu 3D temps réel.

---

## Fonctionnalités

| Catégorie                     | Détail                                                                 |
| ----------------------------- | ---------------------------------------------------------------------- |
| **Géométrie**                 | Soleil procédural via shader `Sky`                                     |
| **Éclairage**                 | `DirectionalLight` alignée sur le vecteur solaire                      |
| **Ombres portées**            | `PCFSoftShadowMap` (2048×2048) - ombres des coques et mâts sur l'eau   |
| **Caméra**                    | Vue plongeante + `OrbitControls` (angle polaire limité 20°–80°)        |
| **Couleur & Transparence**    | Matériaux `MeshPhongMaterial` avec opacité dynamique (coques / voiles) |
| **Texture classique**         | Surface d'eau animée (`Water`, distorsion 3.7)                         |
| **Texture avec transparence** | Sprites de nuages en PNG transparent                                   |
| **Effet miroir**              | `Reflector` + shader GLSL personnalisé (distorsion UV, fresnel)        |
| **Normal & Specular maps**    | Relief du bois et contrôle du                                          |
