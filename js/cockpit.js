/**
 * Stellar Voyage — Full Walkable Starship Interior & Cockpit Bridge
 * Includes:
 * 1. Forward Flight Bridge (z = -1.6 to +1.0): Pilot seat (0,0,0), panoramic windows,
 *    3 MFD displays, animated throttle & flight stick, overhead switches.
 * 2. Midship Habitation & Science Deck (z = +1.0 to +5.8): Illuminated structural ribs,
 *    panoramic side observation windows, rotating 3D Planetary Hologram Table,
 *    Cryo-Stasis Pod, and Red Sealed "FIRE LOCKER" bulkhead.
 * 3. Aft Engineering & Hyperdrive Core + Airlock Ramp (z = +5.8 to +9.6):
 *    Spinning Quantum Hyperdrive Reactor Core & Aft Boarding Airlock Door.
 */

import * as THREE from "three";
import { Textures } from "./textures.js?v=8";
import Audio from "./audio.js?v=8";
import { sharedGLTFLoader } from "./ship.js?v=8";

export const buildCockpit = () => {
  const cockpit = new THREE.Group();
  cockpit.name = "cockpit";

  const metal = new THREE.MeshPhysicalMaterial({
    map: Textures.three.metalColor,
    normalMap: Textures.three.metalNormal,
    roughnessMap: Textures.three.metalRough,
    color: 0xcbd5e1,
    roughness: 0.36,
    metalness: 0.84,
    clearcoat: 0.45
  });

  const metalDark = new THREE.MeshPhysicalMaterial({
    map: Textures.three.metalColor,
    normalMap: Textures.three.metalNormal,
    roughnessMap: Textures.three.metalRough,
    color: 0x162032,
    roughness: 0.42,
    metalness: 0.88,
    clearcoat: 0.35
  });

  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x38bdf8,
    metalness: 0.1,
    roughness: 0.05,
    transparent: true,
    opacity: 0.12,
    depthWrite: false
  });

  const redPaint = new THREE.MeshPhysicalMaterial({
    map: Textures.three.redColor,
    normalMap: Textures.three.redNormal,
    roughnessMap: Textures.three.redRough,
    roughness: 0.38,
    metalness: 0.35,
    clearcoat: 0.7
  });

  const panelLit = new THREE.MeshStandardMaterial({
    color: 0x0b1322,
    emissive: 0x081426,
    emissiveIntensity: 0.75,
    roughness: 0.32,
    metalness: 0.65
  });

  const seatMat = new THREE.MeshStandardMaterial({
    color: 0x1e2530,
    metalness: 0.35,
    roughness: 0.58
  });

  const cyanGlow = new THREE.MeshBasicMaterial({ color: 0x22d3ee });
  const violetGlow = new THREE.MeshBasicMaterial({ color: 0x818cf8 });
  const emeraldGlow = new THREE.MeshBasicMaterial({ color: 0x10b981 });

  // ---------- Interior Lighting ----------
  const dashLight = new THREE.PointLight(0x22d3ee, 1.5, 7);
  dashLight.position.set(0, -0.1, -0.95);
  cockpit.add(dashLight);

  const floodLight = new THREE.PointLight(0xe2e8f0, 1.3, 12);
  floodLight.position.set(0, 1.05, 1.2);
  cockpit.add(floodLight);

  const holoLight = new THREE.PointLight(0x38bdf8, 1.6, 8);
  holoLight.position.set(0, 0.3, 3.2);
  cockpit.add(holoLight);

  const reactorLight = new THREE.PointLight(0x818cf8, 2.2, 10);
  reactorLight.position.set(0, 0.4, 7.2);
  cockpit.add(reactorLight);

  cockpit.__floodLight = floodLight;
  cockpit.__reactorLight = reactorLight;

  // ---------- Continuous Walkable Deck Floor & Ceiling (z = -1.6 to +9.6) ----------
  const deckFloor = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.14, 11.4), metalDark);
  deckFloor.position.set(0, -1.15, 4.0);
  cockpit.add(deckFloor);

  // Illuminated floor walkway guide strips
  for (const sx of [-0.65, 0.65]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 10.2), cyanGlow);
    strip.position.set(sx, -1.07, 4.1);
    cockpit.add(strip);
  }

  const grid = new THREE.GridHelper(11.0, 28, 0x22d3ee, 0x1e293b);
  grid.position.set(0, -1.075, 4.0);
  cockpit.add(grid);

  // Ceiling deck (starts behind front canopy at z = -0.7 to +9.6)
  const deckCeiling = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.16, 10.4), metalDark);
  deckCeiling.position.set(0, 1.42, 4.5);
  cockpit.add(deckCeiling);

  // Structural Sci-Fi Rib Arches along the corridor
  for (let z = 0.6; z <= 8.6; z += 1.6) {
    for (const sx of [-1.95, 1.95]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.24, 2.55, 0.28), metal);
      pillar.position.set(sx, 0.12, z);
      cockpit.add(pillar);

      const lightBar = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 2.1, 0.08),
        z > 5.5 ? violetGlow : cyanGlow
      );
      lightBar.position.set(sx + (sx < 0 ? 0.13 : -0.13), 0.12, z);
      cockpit.add(lightBar);
    }
    const crossBeam = new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.2, 0.28), metalDark);
    crossBeam.position.set(0, 1.3, z);
    cockpit.add(crossBeam);
  }

  // Side walls with panoramic space observation windows
  for (const sx of [-2.05, 2.05]) {
    // Lower wainscoting wall
    const lowerWall = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.95, 11.2), metal);
    lowerWall.position.set(sx, -0.68, 4.0);
    cockpit.add(lowerWall);

    // Upper header wall
    const upperWall = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.55, 10.4), metalDark);
    upperWall.position.set(sx, 1.15, 4.4);
    cockpit.add(upperWall);

    // Solid rear engineering walls (z = 5.4 to 9.6)
    const engWall = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.4, 4.2), metalDark);
    engWall.position.set(sx, 0.2, 7.5);
    cockpit.add(engWall);

    // Observation window glass (z = 0.6 to 5.4)
    const obsGlass = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.1, 4.8), glass);
    obsGlass.position.set(sx, 0.32, 3.0);
    cockpit.add(obsGlass);
  }

  // =========================================================================
  // SECTION 1: FORWARD FLIGHT BRIDGE (z = -1.6 to +0.8)
  // =========================================================================
  const strutGeo = new THREE.CylinderGeometry(0.045, 0.045, 1.9, 10);
  for (const sx of [-1.3, 1.3]) {
    const fStrut = new THREE.Mesh(strutGeo, metalDark);
    fStrut.position.set(sx, 0.25, -1.28);
    fStrut.rotation.x = 0.42;
    fStrut.rotation.z = sx > 0 ? 0.18 : -0.18;
    cockpit.add(fStrut);
  }

  const topArch = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.12, 0.24), metalDark);
  topArch.position.set(0, 1.04, -0.95);
  cockpit.add(topArch);

  const frontGlass = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.5), glass);
  frontGlass.position.set(0, 0.25, -1.45);
  cockpit.add(frontGlass);

  // Dashboard & MFD Holographic Displays
  const dashCowling = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.16, 0.68), metalDark);
  dashCowling.position.set(0, -0.36, -1.18);
  dashCowling.rotation.x = 0.12;
  cockpit.add(dashCowling);

  const dashBody = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.65, 0.58), panelLit);
  dashBody.position.set(0, -0.68, -1.18);
  dashBody.rotation.x = -0.28;
  cockpit.add(dashBody);

  const makeScreen = (x, col, accentCol) => {
    const g = new THREE.Group();
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.44, 0.04), metalDark);
    const scr = new THREE.Mesh(
      new THREE.PlaneGeometry(0.64, 0.38),
      new THREE.MeshBasicMaterial({ color: col })
    );
    scr.position.z = 0.025;
    const bar = new THREE.Mesh(
      new THREE.PlaneGeometry(0.54, 0.045),
      new THREE.MeshBasicMaterial({ color: accentCol })
    );
    bar.position.set(0, 0.11, 0.03);
    g.add(bezel, scr, bar);
    g.position.set(x, -0.58, -0.91);
    g.rotation.x = -0.28;
    cockpit.add(g);
    return scr;
  };

  makeScreen(-0.8, 0x082f49, 0x22d3ee);
  const centerScreen = makeScreen(0, 0x0f172a, 0x38bdf8);
  makeScreen(0.8, 0x082f49, 0x818cf8);
  cockpit.__centerScreen = centerScreen;

  // Center Console, Throttle & Flight Stick
  const consoleBox = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.45, 1.1), metalDark);
  consoleBox.position.set(0, -0.92, -0.55);
  cockpit.add(consoleBox);

  const throttle = new THREE.Group();
  const tShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.28, 10), metal);
  const tGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.18, 12), redPaint);
  tGrip.rotation.z = Math.PI / 2;
  tGrip.position.y = 0.14;
  throttle.add(tShaft, tGrip);
  throttle.position.set(-0.34, -0.64, -0.55);
  throttle.rotation.x = -0.25;
  cockpit.__throttle = throttle;
  cockpit.add(throttle);

  const stick = new THREE.Group();
  const sShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.035, 0.32, 10), metalDark);
  const sTop = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 10), redPaint);
  sTop.position.y = 0.16;
  stick.add(sShaft, sTop);
  stick.position.set(0.34, -0.64, -0.55);
  cockpit.__stick = stick;
  cockpit.add(stick);

  // Overhead Switch Panel (FLOOD / GEAR / SHADE / COMS / AUX)
  const ohPanel = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.26, 0.35), panelLit);
  ohPanel.position.set(0, 0.92, -0.88);
  ohPanel.rotation.x = 0.45;
  cockpit.add(ohPanel);

  cockpit.__switches = [];
  const ohLabels = ["FLOOD", "GEAR", "SHADE", "COMS", "AUX"];
  ohLabels.forEach((label, i) => {
    const sw = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.06), metalDark);
    const toggle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.14, 8),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.2 })
    );
    toggle.rotation.x = Math.PI / 3;
    toggle.position.z = 0.04;
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 8), cyanGlow.clone());
    led.position.set(0, 0.05, 0.04);
    sw.add(base, toggle, led);
    sw.position.set(-0.76 + i * 0.38, 0.9, -0.72);
    sw.rotation.x = 0.45;
    sw.userData = {
      label,
      on: true,
      toggle: () => {
        sw.userData.on = !sw.userData.on;
        led.material.color.setHex(sw.userData.on ? 0x22d3ee : 0x451a03);
        toggle.rotation.x = sw.userData.on ? Math.PI / 3 : -Math.PI / 3;
        if (label === "FLOOD") {
          floodLight.intensity = sw.userData.on ? 1.3 : 0.2;
        }
        Audio.sfx.switch();
      }
    };
    cockpit.add(sw);
    cockpit.__switches.push(sw);
  });

  // Pilot Seat (offset slightly so aisle behind it is clear to walk through)
  const seat = new THREE.Group();
  const seatBack = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.95, 0.14), seatMat);
  seatBack.position.set(0, -0.32, 0.42);
  const seatCush = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.16, 0.68), seatMat);
  seatCush.position.set(0, -0.78, 0.08);
  seat.add(seatBack, seatCush);
  cockpit.add(seat);

  // =========================================================================
  // SECTION 2: MIDSHIP SCIENCE & HABITATION BAY (z = +1.0 to +5.8)
  // =========================================================================
  // Center Holographic Astrogation Table (z = +3.2)
  const holoTable = new THREE.Group();
  holoTable.position.set(0, -0.68, 3.2);
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.68, 0.85, 20), metalDark);
  const emitterRing = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.04, 12, 32), cyanGlow);
  emitterRing.rotation.x = Math.PI / 2;
  emitterRing.position.y = 0.44;
  holoTable.add(pedestal, emitterRing);

  // Floating 3D Hologram of Planet & Rings
  const holoGroup = new THREE.Group();
  holoGroup.position.y = 0.95;
  const holoPlanet = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 20, 16),
    new THREE.MeshBasicMaterial({ color: 0x22d3ee, wireframe: true, transparent: true, opacity: 0.75 })
  );
  const holoRing = new THREE.Mesh(
    new THREE.RingGeometry(0.45, 0.58, 32),
    new THREE.MeshBasicMaterial({ color: 0x818cf8, side: THREE.DoubleSide, transparent: true, opacity: 0.65 })
  );
  holoRing.rotation.x = Math.PI / 2.6;
  holoGroup.add(holoPlanet, holoRing);

  // Load miniature holographic 3D Spaceship (.glb) orbiting the Holo-Table planet
  sharedGLTFLoader.load(
    "./assets/models/shuttle_orbiter.glb",
    (gltf) => {
      const miniShip = gltf.scene.clone(true);
      const holoShipMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        wireframe: true,
        transparent: true,
        opacity: 0.85
      });
      miniShip.traverse((c) => {
        if (c.isMesh) c.material = holoShipMat;
      });
      miniShip.scale.setScalar(0.14);
      miniShip.position.set(0.52, 0.18, 0);
      holoGroup.add(miniShip);
    },
    undefined,
    () => {}
  );

  holoTable.add(holoGroup);
  cockpit.add(holoTable);
  cockpit.__holoGroup = holoGroup;

  // Starboard Wall: Red Sealed "FIRE LOCKER" Bulkhead (x = -1.78, z = +2.6)
  const locker = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.85, 0.98), metalDark);
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.68, 0.82), redPaint);
  const wheel = new THREE.Mesh(
    new THREE.TorusGeometry(0.16, 0.028, 10, 20),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.88, roughness: 0.2 })
  );
  wheel.rotation.y = Math.PI / 2;
  wheel.position.set(0.14, 0.05, 0);
  locker.add(frame, door, wheel);
  locker.position.set(-1.88, -0.12, 2.6);
  cockpit.__locker = locker;
  cockpit.add(locker);

  // Port Wall Forward: Cryo-Stasis Medical Pod (x = +1.75, z = +2.15)
  const cryoPod = new THREE.Group();
  const cryoBase = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.9, 0.95), metalDark);
  const cryoGlass = new THREE.Mesh(
    new THREE.CylinderGeometry(0.26, 0.26, 1.55, 16),
    new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.35 })
  );
  cryoGlass.position.set(-0.18, 0.05, 0);
  cryoPod.add(cryoBase, cryoGlass);
  cryoPod.position.set(1.75, -0.1, 2.15);
  cockpit.add(cryoPod);

  // =========================================================================
  // CAPTAIN'S QUARTERS SLEEPING BUNK BED (Port Alcove: x = +1.32, z = +4.65)
  // Interactive Bed where the player can lie down & sleep [E]
  // =========================================================================
  const bedGroup = new THREE.Group();
  bedGroup.position.set(1.32, -0.62, 4.65);

  // Heavy Titanium Bunk Frame & Under-bed Storage Drawers
  const bedBase = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.38, 2.08), metalDark);
  bedBase.position.y = -0.18;
  bedGroup.add(bedBase);

  // Illuminated Under-Bed Neon Trim Strip
  const bedNeonStrip = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.03, 2.02), cyanGlow);
  bedNeonStrip.position.set(-0.02, -0.34, 0);
  bedGroup.add(bedNeonStrip);

  // Headboard & Footboard Alcove Bulkheads
  const headboard = new THREE.Mesh(new THREE.BoxGeometry(1.08, 1.15, 0.12), metal);
  headboard.position.set(0, 0.36, -1.02);
  const footboard = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.72, 0.1), metal);
  footboard.position.set(0, 0.15, 1.02);
  bedGroup.add(headboard, footboard);

  // Overhead Bunk Canopy Valance
  const bunkCanopy = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.12, 2.12), metalDark);
  bunkCanopy.position.set(0, 1.28, 0);
  const bunkCanopyGlow = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.025, 1.85), emeraldGlow);
  bunkCanopyGlow.position.set(-0.04, 1.21, 0);
  bedGroup.add(bunkCanopy, bunkCanopyGlow);

  // Quilted Ergonomic Mattress
  const mattressMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.78,
    metalness: 0.05
  });
  const mattress = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.18, 1.92), mattressMat);
  mattress.position.set(-0.02, 0.08, 0);
  bedGroup.add(mattress);

  // Two Plush Memory-Foam Pillows at the Head of the Bed (z = -0.72)
  const pillowMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.65,
    metalness: 0.02
  });
  const pillow1 = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.34), pillowMat);
  pillow1.position.set(-0.22, 0.21, -0.72);
  pillow1.rotation.x = 0.18;
  const pillow2 = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.34), pillowMat);
  pillow2.position.set(0.2, 0.21, -0.72);
  pillow2.rotation.x = 0.18;
  bedGroup.add(pillow1, pillow2);

  // Captain's Thermal Duvet Blanket (Deep Royal Blue with Cyan Piping)
  const blanketMat = new THREE.MeshStandardMaterial({
    color: 0x1d4ed8,
    roughness: 0.72,
    metalness: 0.08
  });
  const blanket = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.19, 1.32), blanketMat);
  blanket.position.set(-0.02, 0.1, 0.28);
  const blanketFold = new THREE.Mesh(
    new THREE.BoxGeometry(1.01, 0.21, 0.18),
    new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.5 })
  );
  blanketFold.position.set(-0.02, 0.11, -0.34);
  bedGroup.add(blanket, blanketFold);

  // Bedside Biometric Sleep Monitor Screen on the Wall
  const bedScreenCanvas = document.createElement("canvas");
  bedScreenCanvas.width = 256;
  bedScreenCanvas.height = 128;
  const bCtx = bedScreenCanvas.getContext("2d");
  bCtx.fillStyle = "#04101f";
  bCtx.fillRect(0, 0, 256, 128);
  bCtx.strokeStyle = "#38bdf8";
  bCtx.lineWidth = 4;
  bCtx.strokeRect(4, 4, 248, 120);
  bCtx.fillStyle = "#34d399";
  bCtx.font = "bold 18px monospace";
  bCtx.fillText("CAPTAIN'S QUARTERS", 18, 34);
  bCtx.fillStyle = "#7dd3fc";
  bCtx.font = "14px monospace";
  bCtx.fillText("CIRCADIAN SLEEP BAY", 18, 60);
  bCtx.fillStyle = "#facc15";
  bCtx.fillText("REST & RESTORE STAMINA", 18, 92);
  bCtx.fillStyle = "#94a3b8";
  bCtx.font = "12px monospace";
  bCtx.fillText("STAMINA 100% // +8H SOLAR", 18, 112);

  const bedScreenTex = new THREE.CanvasTexture(bedScreenCanvas);
  const bedScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.68, 0.34),
    new THREE.MeshBasicMaterial({ map: bedScreenTex })
  );
  bedScreen.rotation.y = -Math.PI / 2;
  bedScreen.position.set(0.48, 0.65, 0.0);
  bedGroup.add(bedScreen);

  // Warm Bedside Reading Light
  const bedLamp = new THREE.PointLight(0xfde68a, 1.35, 4.2);
  bedLamp.position.set(0.1, 0.95, -0.65);
  bedGroup.add(bedLamp);

  cockpit.add(bedGroup);
  cockpit.__bed = bedGroup;

  // Starboard Wall Opposite Bed: Crew Galley & Observation Lounge Bench (x = -1.45, z = +4.65)
  const loungeBench = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.42, 1.55), seatMat);
  loungeBench.position.set(-1.52, -0.68, 4.65);
  cockpit.add(loungeBench);

  // =========================================================================
  // SECTION 3: AFT ENGINEERING, HYPERDRIVE REACTOR & AIRLOCK (z = +5.8 to +9.6)
  // =========================================================================
  const reactorGroup = new THREE.Group();
  reactorGroup.position.set(0, 0.15, 7.2);

  // Bottom & Top containment pylons
  const rBot = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.85, 0.55, 20), metalDark);
  rBot.position.y = -1.0;
  const rTop = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.65, 0.55, 20), metalDark);
  rTop.position.y = 1.0;
  reactorGroup.add(rBot, rTop);

  // Spinning Magnetic Containment Rings + Central Quantum Crystal
  const reactorSpinner = new THREE.Group();
  const coreCrystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.38, 1), cyanGlow);
  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.04, 12, 32), violetGlow);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.74, 0.035, 12, 32), cyanGlow);
  ring2.rotation.x = Math.PI / 2;
  reactorSpinner.add(coreCrystal, ring1, ring2);
  reactorGroup.add(reactorSpinner);
  cockpit.add(reactorGroup);
  cockpit.__reactorSpinner = reactorSpinner;

  // Aft Bulkhead & Airlock Boarding Hatch (z = +9.5)
  const aftWall = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.65, 0.22), metal);
  aftWall.position.set(0, 0.12, 9.55);
  cockpit.add(aftWall);

  const airlockDoor = new THREE.Mesh(new THREE.BoxGeometry(1.55, 2.05, 0.26), metalDark);
  airlockDoor.position.set(0, -0.1, 9.52);
  cockpit.add(airlockDoor);

  const airlockTrim = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.08, 0.3), emeraldGlow);
  airlockTrim.position.set(0, 0.96, 9.5);
  cockpit.add(airlockTrim);

  // Animate internal holograms & hyperdrive reactor every frame
  cockpit.updateInterior = (dt, warpCharge = 0) => {
    if (cockpit.__holoGroup) {
      cockpit.__holoGroup.rotation.y += dt * 0.8;
    }
    if (cockpit.__reactorSpinner) {
      const speedMult = 1 + (warpCharge / 100) * 6;
      cockpit.__reactorSpinner.rotation.y += dt * 1.8 * speedMult;
      cockpit.__reactorSpinner.rotation.x += dt * 1.1 * speedMult;
    }
    if (cockpit.__reactorLight) {
      cockpit.__reactorLight.intensity = 2.0 + (warpCharge / 100) * 4.0 + Math.sin(performance.now() * 0.008) * 0.3;
    }
  };

  cockpit.pilotPos = new THREE.Vector3(0, 0, 0);

  return cockpit;
};
