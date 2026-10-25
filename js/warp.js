/**
 * Stellar Voyage — Cinematic Cutscenes & Landing/Takeoff Animation Director
 * Includes:
 * 1. WarpCutscene — Multi-angle Quantum Hyperdrive Wormhole Cutscene
 * 2. FlightCutscene — Launch, Planetary Landing (with hydraulic gear, VTOL retro-thrusters,
 *    touchdown shockwave ring, suspension bounce, and boarding ramp), and Takeoff animations.
 */

import * as THREE from "three";
import Audio from "./audio.js";

export class WarpCutscene {
  constructor(scene, camera, ship, cockpit, onComplete, onStageText) {
    this.scene = scene;
    this.camera = camera;
    this.ship = ship;
    this.cockpit = cockpit;
    this.onComplete = onComplete;
    this.onStageText = onStageText || (() => {});
    this.active = true;
    this.time = 0;
    this.duration = 5.0;

    this.starCount = 520;
    this.starBaseZ = new Float32Array(this.starCount);
    this.starXY = new Float32Array(this.starCount * 2);

    this.warpGroup = new THREE.Group();
    this.warpGroup.name = "warpCutsceneGroup";
    this.init();
  }

  init() {
    // 1. Hyperspace Star Streaks
    const lineGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(this.starCount * 6);
    const colors = new Float32Array(this.starCount * 6);

    for (let i = 0; i < this.starCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 4.0 + Math.random() * 58;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      const z = -Math.random() * 340;

      this.starXY[i * 2] = x;
      this.starXY[i * 2 + 1] = y;
      this.starBaseZ[i] = z;

      const idx = i * 6;
      positions[idx] = x;
      positions[idx + 1] = y;
      positions[idx + 2] = z;
      positions[idx + 3] = x;
      positions[idx + 4] = y;
      positions[idx + 5] = z - 6;

      const r = 0.4 + Math.random() * 0.6;
      const g = 0.78 + Math.random() * 0.22;
      const b = 1.0;
      colors[idx] = r; colors[idx + 1] = g; colors[idx + 2] = b;
      colors[idx + 3] = r * 0.25; colors[idx + 4] = g * 0.55; colors[idx + 5] = b;
    }

    lineGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    lineGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    this.lineMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending
    });

    this.starLines = new THREE.LineSegments(lineGeo, this.lineMat);
    this.warpGroup.add(this.starLines);

    // 2. Spiraling Hyperspace Plasma Tunnel Rings
    this.tunnel = new THREE.Group();
    this.ringCount = 22;
    for (let r = 0; r < this.ringCount; r++) {
      const col = r % 3 === 0 ? 0x22d3ee : r % 3 === 1 ? 0x818cf8 : 0xe879f9;
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(11.5, 0.35, 10, 40),
        new THREE.MeshBasicMaterial({
          color: col,
          transparent: true,
          opacity: 0.36,
          blending: THREE.AdditiveBlending
        })
      );
      ring.position.z = -r * 15;
      ring.rotation.z = r * 0.35;
      this.tunnel.add(ring);
    }
    this.warpGroup.add(this.tunnel);

    // 3. Final Arrival Flash Quad
    this.flash = new THREE.Mesh(
      new THREE.PlaneGeometry(180, 180),
      new THREE.MeshBasicMaterial({
        color: 0xe0f2fe,
        transparent: true,
        opacity: 0,
        depthTest: false
      })
    );
    this.flash.position.z = -4.5;
    this.warpGroup.add(this.flash);

    this.scene.add(this.warpGroup);
  }

  start() {
    this.active = true;
    this.time = 0;
    this.warpGroup.visible = true;
    this.flash.material.opacity = 0;
  }

  update(dt) {
    if (!this.active) return false;
    this.time += dt;
    const p = Math.min(1, this.time / this.duration);

    // Multi-shot camera choreography during Warp!
    // Shot 1 (0..0.62): Dynamic external camera sweeping around the Aegis Vanguard flying inside the wormhole!
    // Shot 2 (0.62..1.0): First-person cockpit view rushing into the quantum exit flash!
    if (this.ship && this.cockpit) {
      if (p < 0.62) {
        this.ship.visible = true;
        this.cockpit.visible = false;
        this.onStageText("QUANTUM FOLD ACTIVE // HYPERSPACE CORRIDOR");

        // Gently bank & vibrate the ship inside the wormhole
        this.ship.position.set(
          Math.sin(this.time * 4.5) * 0.35,
          25 + Math.cos(this.time * 3.8) * 0.25,
          120
        );
        this.ship.rotation.set(
          Math.sin(this.time * 2.5) * 0.06,
          0,
          Math.sin(this.time * 1.8) * 0.22
        );
        if (this.ship.__quantumRing) {
          this.ship.__quantumRing.rotation.z += dt * 12;
        }

        // Sweep camera from front-quarter to rear-chase behind the ship
        const sweep = p / 0.62;
        const camX = Math.sin(sweep * Math.PI * 0.85) * 8.5;
        const camY = this.ship.position.y + 2.2 + Math.sin(sweep * Math.PI) * 1.5;
        const camZ = this.ship.position.z + 11.5 - sweep * 3.0;
        this.camera.position.set(camX, camY, camZ);
        this.camera.lookAt(this.ship.position.x, this.ship.position.y, this.ship.position.z - 12);
      } else {
        this.ship.visible = false;
        this.cockpit.visible = true;
        this.onStageText("APPROACHING MASS SHADOW // DROPPING OUT OF WARP");
        this.cockpit.position.set(0, 25, 120);
        this.cockpit.rotation.set(0, 0, 0);
        this.camera.position.set(
          (Math.random() - 0.5) * 0.06,
          25 + (Math.random() - 0.5) * 0.06,
          120
        );
        this.camera.rotation.set(0, 0, 0);
      }
    }

    // Lock warp tunnel along the forward -Z axis around the ship/camera
    this.warpGroup.position.set(0, 25, 125);
    this.warpGroup.rotation.set(0, 0, 0);

    // Stretch & rush star streaks toward +Z
    const speed = 130 + p * 420;
    const streakLen = 4 + Math.sin(p * Math.PI) * 44;
    const posArr = this.starLines.geometry.attributes.position.array;

    for (let i = 0; i < this.starCount; i++) {
      let z = this.starBaseZ[i] + dt * speed;
      if (z > 20) z -= 340;
      this.starBaseZ[i] = z;

      const x = this.starXY[i * 2];
      const y = this.starXY[i * 2 + 1];
      const idx = i * 6;
      posArr[idx] = x;
      posArr[idx + 1] = y;
      posArr[idx + 2] = z;
      posArr[idx + 3] = x;
      posArr[idx + 4] = y;
      posArr[idx + 5] = z - streakLen;
    }
    this.starLines.geometry.attributes.position.needsUpdate = true;

    // Move & spiral tunnel rings toward +Z
    this.tunnel.rotation.z += dt * (2.2 + p * 4.0);
    this.tunnel.children.forEach((ring, i) => {
      ring.position.z += dt * (110 + p * 240);
      if (ring.position.z > 15) {
        ring.position.z -= this.ringCount * 15;
      }
      const distFactor = Math.max(0, 1 - Math.abs(ring.position.z) / 280);
      ring.material.opacity = distFactor * (0.28 + 0.25 * Math.sin(this.time * 9 + i));
    });

    // Dynamic FOV warp & arrival flash
    if (p > 0.8) {
      const f = (p - 0.8) / 0.2;
      this.flash.position.copy(this.camera.position);
      this.flash.quaternion.copy(this.camera.quaternion);
      this.flash.translateZ(-4);
      this.flash.material.opacity = Math.sin(f * Math.PI) * 0.95;
      this.camera.fov = 50 + (1 - f) * 34;
      this.camera.updateProjectionMatrix();
    } else {
      this.camera.fov = 50 + p * 34;
      this.camera.updateProjectionMatrix();
    }

    if (this.time >= this.duration) {
      this.finish();
      return true;
    }
    return false;
  }

  finish() {
    this.active = false;
    this.camera.fov = 50;
    this.camera.updateProjectionMatrix();
    this.dispose();
    if (this.onComplete) this.onComplete();
  }

  dispose() {
    if (this.warpGroup) {
      this.scene.remove(this.warpGroup);
    }
  }
}

/**
 * FlightCutscene — Handles:
 * - "LANDING": Atmospheric descent, hydraulic landing gear deployment, VTOL retro-thrusters,
 *              touchdown shockwave ring, suspension bounce, and boarding ramp deployment.
 * - "TAKEOFF": Boarding ramp retraction, vertical VTOL liftoff, gear retraction, and orbital climb.
 * - "LAUNCH": Cinematic multi-shot intro / orbital ignition sequence.
 */
export class FlightCutscene {
  constructor(type, scene, camera, ship, cockpit, onComplete, onStageText) {
    this.type = type; // "LANDING" | "TAKEOFF" | "LAUNCH"
    this.scene = scene;
    this.camera = camera;
    this.ship = ship;
    this.cockpit = cockpit;
    this.onComplete = onComplete;
    this.onStageText = onStageText || (() => {});

    this.time = 0;
    this.duration = type === "LANDING" ? 4.0 : type === "TAKEOFF" ? 3.4 : 3.8;
    this.active = true;
    this.gearSoundPlayed = false;
    this.touchdownSoundPlayed = false;

    // Create 3D Touchdown Plasma/Dust Shockwave Ring on the landing pad
    this.shockwave = new THREE.Mesh(
      new THREE.RingGeometry(0.8, 1.8, 48),
      new THREE.MeshBasicMaterial({
        color: 0x22d3ee,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
      })
    );
    this.shockwave.rotation.x = -Math.PI / 2;
    this.shockwave.position.set(0, 0.22, 0);
    this.scene.add(this.shockwave);

    this.ship.visible = true;
    this.cockpit.visible = false;
    Audio.sfx.cutsceneBoom();
  }

  update(dt) {
    if (!this.active) return false;
    this.time += dt;
    const p = Math.min(1, this.time / this.duration);
    // Smooth ease-in-out
    const ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;

    if (this.type === "LANDING") {
      // Phase 1 (0..0.45): Sweeping descent from orbit (0, 22, 38) -> hover over pad (0, 5.5, 0)
      // Phase 2 (0.35..0.75): Deploy hydraulic landing gear & fire VTOL belly retro-thrusters
      // Phase 3 (0.75..1.0): Vertical touchdown to (0, 1.45, 0), shockwave ring, suspension bounce, lower boarding ramp!
      if (p < 0.4) {
        this.onStageText("LOCKING LANDING BEACON // FINAL APPROACH VECTOR");
      } else if (p < 0.78) {
        this.onStageText("DEPLOYING HYDRAULIC LANDING GEAR // RETRO-THRUSTERS ENGAGED");
        if (!this.gearSoundPlayed) {
          this.gearSoundPlayed = true;
          Audio.sfx.hydraulics();
        }
      } else {
        this.onStageText("TOUCHDOWN CONFIRMED // LOWERING AFT BOARDING RAMP");
        if (!this.touchdownSoundPlayed) {
          this.touchdownSoundPlayed = true;
          Audio.sfx.land();
        }
      }

      // Ship position spline
      const zPos = (1 - Math.min(1, p / 0.68)) * 34;
      let yPos;
      if (p < 0.78) {
        const dp = p / 0.78;
        yPos = THREE.MathUtils.lerp(20, 1.45, dp * dp * (3 - 2 * dp));
      } else {
        yPos = 1.45;
      }

      this.ship.position.set(0, yPos, zPos);
      const pitch = p < 0.65 ? Math.sin((p / 0.65) * Math.PI) * 0.16 : 0;
      const roll = p < 0.65 ? Math.sin(p * 10) * 0.08 * (1 - p) : 0;
      this.ship.rotation.set(pitch, 0, roll);

      // Hydraulic Landing Gear unfolds between p = 0.25 and p = 0.68
      const gearP = Math.max(0, Math.min(1, (p - 0.25) / 0.43));
      this.ship.setGearProgress(gearP);

      // Belly VTOL Retro-Thrusters fire between p = 0.3 and p = 0.85
      const retroVal = p > 0.3 && p < 0.88 ? Math.sin(((p - 0.3) / 0.58) * Math.PI) : 0;
      this.ship.setRetroThrust(retroVal);

      // Suspension bounce & expanding plasma shockwave on touchdown (p >= 0.78)
      if (p >= 0.78) {
        const tp = (p - 0.78) / 0.22;
        const bounce = -Math.sin(tp * Math.PI * 2.2) * Math.exp(-tp * 3.5) * 0.26;
        this.ship.setSuspensionBounce(bounce);

        this.shockwave.scale.setScalar(1 + tp * 7.5);
        this.shockwave.material.opacity = (1 - tp) * 0.85;

        // Lower aft boarding ramp
        const rampP = Math.max(0, Math.min(1, (tp - 0.15) / 0.85));
        this.ship.setRampProgress(rampP);
      } else {
        this.ship.setSuspensionBounce(0);
        this.ship.setRampProgress(0);
      }

      // Dramatic two-shot camera during Landing
      if (p < 0.52) {
        // Shot 1: Wide cinematic tracking shot showing planet pad & descending starship
        this.camera.position.set(14, 7.5, 16);
        this.camera.lookAt(this.ship.position.x, this.ship.position.y - 0.5, this.ship.position.z);
      } else {
        // Shot 2: Low-angle pad-level shot showcasing the hydraulic gear, retro-thrusters & boarding ramp!
        const angle = 0.65 + (p - 0.52) * 1.1;
        this.camera.position.set(Math.sin(angle) * 9.5, 2.1, Math.cos(angle) * 9.5);
        this.camera.lookAt(0, this.ship.position.y - 0.2, 0.5);
      }
    } else if (this.type === "TAKEOFF") {
      // Phase 1 (0..0.3): Retract aft boarding ramp & ignite VTOL thrusters
      // Phase 2 (0.3..0.7): Vertical liftoff & fold hydraulic landing gear
      // Phase 3 (0.7..1.0): Pitch up & blast forward into orbital flight!
      if (p < 0.32) {
        this.onStageText("SEALING AFT AIRLOCK // VTOL THRUSTERS IGNITED");
        if (!this.gearSoundPlayed) {
          this.gearSoundPlayed = true;
          Audio.sfx.hydraulics();
        }
      } else if (p < 0.7) {
        this.onStageText("VERTICAL LIFTOFF // RETRACTING LANDING GEAR");
      } else {
        this.onStageText("MAIN ION DRIVE ENGAGED // ORBITAL ASCENT");
      }

      const rampP = 1 - Math.max(0, Math.min(1, p / 0.28));
      this.ship.setRampProgress(rampP);

      const gearP = 1 - Math.max(0, Math.min(1, (p - 0.32) / 0.38));
      this.ship.setGearProgress(gearP);

      const retroVal = p < 0.75 ? Math.sin((p / 0.75) * Math.PI) : 0;
      this.ship.setRetroThrust(retroVal);

      const yPos = 1.45 + Math.pow(Math.max(0, (p - 0.18) / 0.82), 1.7) * 20;
      const zPos = -Math.pow(Math.max(0, (p - 0.55) / 0.45), 2.0) * 28;
      const pitch = p > 0.45 ? Math.sin(((p - 0.45) / 0.55) * Math.PI) * 0.28 : 0;

      this.ship.position.set(0, yPos, zPos);
      this.ship.rotation.set(pitch, 0, 0);

      // Sweeping pad-level camera looking up as the ship climbs into space
      const camAng = -0.7 + p * 1.4;
      this.camera.position.set(Math.sin(camAng) * 11, 2.8 + p * 6, Math.cos(camAng) * 11);
      this.camera.lookAt(this.ship.position);
    } else {
      // "LAUNCH" — Opening Cinematic Showcase of the Aegis Vanguard in Orbit
      if (p < 0.5) {
        this.onStageText("AEGIS VANGUARD // DEEP SPACE EXPLORATION VESSEL");
      } else {
        this.onStageText("HYPERDRIVE & PLANETARY SYSTEMS ONLINE // HELM READY");
      }

      this.ship.setGearProgress(0);
      this.ship.setRampProgress(0);
      this.ship.setRetroThrust(0);

      const zPos = 62 - ease * 14;
      this.ship.position.set(0, 18, zPos);
      this.ship.rotation.set(-0.18, 0, Math.sin(p * Math.PI * 2) * 0.12);
      if (this.ship.__quantumRing) {
        this.ship.__quantumRing.rotation.z += dt * 5;
      }

      if (p < 0.52) {
        // Shot 1: Heroic close-up flyby past the nose and quantum ring
        const sp = p / 0.52;
        this.camera.position.set(-5.5 + sp * 2, 18.8, zPos - 7 + sp * 14);
        this.camera.lookAt(this.ship.position);
      } else {
        // Shot 2: Sweeping behind the glowing triple engines into the cockpit/chase view
        const sp = (p - 0.52) / 0.48;
        const ang = (1 - sp) * 0.9;
        this.camera.position.set(
          Math.sin(ang) * 13,
          18 + 3.8,
          zPos + Math.cos(ang) * 13
        );
        this.camera.lookAt(0, 16, zPos - 15);
      }
    }

    if (this.time >= this.duration) {
      this.finish();
      return true;
    }
    return false;
  }

  finish() {
    this.active = false;
    this.ship.setRetroThrust(0);
    this.ship.setSuspensionBounce(0);
    if (this.shockwave) {
      this.scene.remove(this.shockwave);
    }
    if (this.onComplete) this.onComplete();
  }

  dispose() {
    if (this.shockwave) {
      this.scene.remove(this.shockwave);
    }
  }
}
