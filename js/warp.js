// ============================================================================
// STELLAR VOYAGE — Cinematic Cutscene Director
//   1. WarpCutscene(scene, camera, ship, cockpit, onDone, onSubtext)
//   2. FlightCutscene(mode, scene, camera, ship, cockpit, onDone, onSubtext)
//      Modes: "LANDING" (with volumetric pad steam eruption), "TAKEOFF", "LAUNCH"
// ============================================================================

import * as THREE from "three";
import Audio from "./audio.js?v=7";

// ============================================================================
// 1. MULTI-SHOT QUANTUM WARP CUTSCENE
// ============================================================================
export class WarpCutscene {
  constructor(scene, camera, ship, cockpit, onDone, onSubtext) {
    this.scene = scene;
    this.camera = camera;
    this.ship = ship;
    this.cockpit = cockpit;
    this.onDone = onDone;
    this.onSubtext = onSubtext;

    this.t = 0;
    this.duration = 5.4;
    this.active = false;

    this.group = new THREE.Group();
    this.group.position.copy(ship.position);
    this.group.quaternion.copy(ship.quaternion);

    // 1. Plasma Vortex Tunnel
    const tunnelGeo = new THREE.CylinderGeometry(8.5, 8.5, 220, 48, 36, true);
    tunnelGeo.rotateX(Math.PI / 2);

    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    const grad = ctx.createLinearGradient(0, 0, 512, 512);
    grad.addColorStop(0, "#020617");
    grad.addColorStop(0.25, "#0284c7");
    grad.addColorStop(0.5, "#38bdf8");
    grad.addColorStop(0.75, "#818cf8");
    grad.addColorStop(1, "#020617");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    for (let i = 0; i < 160; i++) {
      ctx.fillStyle = i % 2 === 0 ? "rgba(125,211,252,0.55)" : "rgba(192,132,252,0.45)";
      ctx.fillRect(Math.random() * 512, 0, 1 + Math.random() * 4, 512);
    }

    this.tunnelTex = new THREE.CanvasTexture(canvas);
    this.tunnelTex.wrapS = THREE.RepeatWrapping;
    this.tunnelTex.wrapT = THREE.RepeatWrapping;
    this.tunnelTex.repeat.set(3, 5);

    this.tunnelMat = new THREE.MeshBasicMaterial({
      map: this.tunnelTex,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.tunnelMesh = new THREE.Mesh(tunnelGeo, this.tunnelMat);
    this.group.add(this.tunnelMesh);

    // 2. Relativistic Star Streaks
    const streakCount = 460;
    const pos = new Float32Array(streakCount * 6);
    const col = new Float32Array(streakCount * 6);

    for (let i = 0; i < streakCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const rad = 1.6 + Math.random() * 6.5;
      const x = Math.cos(angle) * rad;
      const y = Math.sin(angle) * rad;
      const z = -Math.random() * 200 + 100;
      const len = 8 + Math.random() * 18;

      const idx = i * 6;
      pos[idx] = x;
      pos[idx + 1] = y;
      pos[idx + 2] = z;
      pos[idx + 3] = x;
      pos[idx + 4] = y;
      pos[idx + 5] = z + len;

      const c = i % 3 === 0 ? [0.45, 0.88, 1.0] : i % 3 === 1 ? [0.75, 0.62, 1.0] : [1, 1, 1];
      col[idx] = c[0];
      col[idx + 1] = c[1];
      col[idx + 2] = c[2];
      col[idx + 3] = c[0];
      col[idx + 4] = c[1];
      col[idx + 5] = c[2];
    }

    const streakGeo = new THREE.BufferGeometry();
    streakGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    streakGeo.setAttribute("color", new THREE.BufferAttribute(col, 3));

    this.streakMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending
    });
    this.streaks = new THREE.LineSegments(streakGeo, this.streakMat);
    this.group.add(this.streaks);

    // 3. Shockwave Portal Rings
    this.rings = [];
    const ringGeo = new THREE.TorusGeometry(6.8, 0.08, 12, 48);
    for (let i = 0; i < 12; i++) {
      const rMat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0x38bdf8 : 0xa855f7,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending
      });
      const rMesh = new THREE.Mesh(ringGeo, rMat);
      rMesh.position.z = -i * 18 + 60;
      this.group.add(rMesh);
      this.rings.push(rMesh);
    }

    scene.add(this.group);
  }

  start() {
    this.t = 0;
    this.active = true;
    this.ship.visible = true;
    if (this.cockpit) this.cockpit.visible = false;
  }

  update(dt) {
    if (!this.active) return;
    this.t += dt;
    const t = this.t;

    this.group.position.copy(this.ship.position);
    this.group.quaternion.copy(this.ship.quaternion);

    if (this.ship.__quantumRing) {
      this.ship.__quantumRing.rotation.z += dt * 12.0;
    }

    const fade =
      t < 0.65
        ? t / 0.65
        : t > this.duration - 0.9
        ? Math.max(0, (this.duration - t) / 0.9)
        : 1.0;

    this.tunnelMat.opacity = fade * 0.88;
    this.streakMat.opacity = fade * 0.95;

    this.tunnelTex.offset.y -= dt * 3.8;
    this.tunnelTex.offset.x += dt * 0.55;
    this.tunnelMesh.rotation.z += dt * 1.4;

    const posAttr = this.streaks.geometry.attributes.position;
    const arr = posAttr.array;
    const speed = 155 + Math.sin((t / this.duration) * Math.PI) * 195;
    for (let i = 0; i < arr.length; i += 6) {
      const len = arr[i + 5] - arr[i + 2];
      arr[i + 2] += speed * dt;
      if (arr[i + 2] > 90) arr[i + 2] = -120;
      arr[i + 5] = arr[i + 2] + len;
    }
    posAttr.needsUpdate = true;

    this.rings.forEach((r, idx) => {
      r.position.z += speed * 0.85 * dt;
      if (r.position.z > 80) r.position.z = -135;
      r.rotation.z += dt * (idx % 2 === 0 ? 2.2 : -2.2);
      r.material.opacity = fade * 0.65;
    });

    const shake = fade * 0.08;
    const sx = (Math.random() - 0.5) * shake;
    const sy = (Math.random() - 0.5) * shake;

    if (t < 1.4) {
      if (this.onSubtext) this.onSubtext("PHASE 1 // FOLDING SPACE-TIME CONTINUUM");
      const p = t / 1.4;
      const localCam = new THREE.Vector3(
        THREE.MathUtils.lerp(0, 4.2, p) + sx,
        THREE.MathUtils.lerp(2.2, 1.2, p) + sy,
        THREE.MathUtils.lerp(11.0, 5.2, p)
      );
      this.camera.position.copy(localCam.applyMatrix4(this.ship.matrixWorld));
      const lookTarget = new THREE.Vector3(0, 0.2, -18).applyMatrix4(this.ship.matrixWorld);
      this.camera.lookAt(lookTarget);
      this.camera.fov = THREE.MathUtils.lerp(55, 88, p);
      this.camera.updateProjectionMatrix();
    } else if (t < 4.0) {
      if (this.onSubtext) this.onSubtext("PHASE 2 // TRAVERSING QUANTUM SINGULARITY BRIDGE");
      const p = (t - 1.4) / 2.6;
      const angle = p * Math.PI * 1.45;
      const radius = 7.2 + Math.sin(p * Math.PI) * 2.2;
      const localCam = new THREE.Vector3(
        Math.sin(angle) * radius + sx,
        1.2 + Math.cos(angle * 2) * 0.8 + sy,
        Math.cos(angle) * radius
      );
      this.camera.position.copy(localCam.applyMatrix4(this.ship.matrixWorld));
      this.camera.lookAt(this.ship.position);
      this.camera.fov = 88 + Math.sin(p * Math.PI) * 12;
      this.camera.updateProjectionMatrix();
    } else {
      if (this.onSubtext) this.onSubtext("PHASE 3 // DE-COHERENCE & ORBITAL INSERTION");
      const p = Math.min(1, (t - 4.0) / 1.4);
      const ease = 1 - Math.pow(1 - p, 3);
      const localCam = new THREE.Vector3(
        THREE.MathUtils.lerp(-4.0, 0, ease) + sx,
        THREE.MathUtils.lerp(1.0, 2.5, ease) + sy,
        THREE.MathUtils.lerp(-6.5, 11.0, ease)
      );
      this.camera.position.copy(localCam.applyMatrix4(this.ship.matrixWorld));
      const forwardTarget = new THREE.Vector3(0, 0.2, -30).applyMatrix4(this.ship.matrixWorld);
      this.camera.lookAt(forwardTarget);
      this.camera.fov = THREE.MathUtils.lerp(88, 50, ease);
      this.camera.updateProjectionMatrix();
    }

    if (t >= this.duration) {
      this.finish();
    }
  }

  finish() {
    if (!this.active) return;
    this.active = false;
    this.camera.fov = 50;
    this.camera.updateProjectionMatrix();
    this.dispose();
    if (this.onDone) this.onDone();
  }

  dispose() {
    this.active = false;
    if (this.group && this.group.parent) {
      this.scene.remove(this.group);
    }
  }
}

// ============================================================================
// 2. FLIGHT CUTSCENE DIRECTOR ("LANDING" WITH STEAM, "TAKEOFF", "LAUNCH")
// ============================================================================
export class FlightCutscene {
  constructor(mode, scene, camera, ship, cockpit, onDone, onSubtext) {
    this.mode = mode; // "LANDING" | "TAKEOFF" | "LAUNCH"
    this.scene = scene;
    this.camera = camera;
    this.ship = ship;
    this.cockpit = cockpit;
    this.onDone = onDone;
    this.onSubtext = onSubtext;

    this.t = 0;
    this.active = true;
    this.duration = mode === "LANDING" ? 6.2 : mode === "TAKEOFF" ? 4.6 : 4.0;

    this.gearSfxPlayed = false;
    this.steamSfxPlayed = false;
    this.touchdownPlayed = false;
    this.rampSfxPlayed = false;

    this.ship.visible = true;
    if (this.cockpit) this.cockpit.visible = false;

    this.startPos = new THREE.Vector3();
    this.midPos = new THREE.Vector3();
    this.endPos = new THREE.Vector3();
    this.startQuat = new THREE.Quaternion();
    this.endQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0));

    if (mode === "LANDING") {
      this.endPos.set(0, 3.65, 0); // North Pole Starport Plateau (+2.2m + 1.45m gear)
      this.midPos.set(0, 22.0, 28.0);
      this.startPos.set(0, 68.0, 130.0); // Descend through the upper cloud deck & atmosphere!
      this.ship.position.copy(this.startPos);
      this.ship.setGearProgress(0);
      this.ship.setRampProgress(0);
      this.ship.setRetroIntensity(0.2);
      this.ship.setSteamIntensity(0.25);
    } else if (mode === "TAKEOFF") {
      this.startPos.set(0, 3.65, 0);
      this.midPos.set(0, 18.0, -8.0);
      this.endPos.set(0, 65.0, -95.0);
      this.ship.position.copy(this.startPos);
      this.ship.setGearProgress(1);
      this.ship.setRampProgress(1);
      this.ship.setRetroIntensity(0.85);
      this.ship.setSteamIntensity(0.95);
      this.ship.triggerSteamBurst();
      Audio.sfx.hydraulics();
      Audio.sfx.steam(0.95, 2.8);
    } else {
      // "LAUNCH" opening orbital flyby facing the colossal full-screen planet globe
      this.startPos.set(0, -1800.0, 4420.0);
      this.midPos.set(0, -1800.0, 4350.0);
      this.endPos.set(0, -1800.0, 4280.0);
      this.ship.position.copy(this.startPos);
      this.ship.setGearProgress(0);
      this.ship.setRampProgress(0);
      this.ship.setRetroIntensity(0);
      this.ship.setSteamIntensity(0);
      Audio.sfx.steam(0.65, 2.0);
    }
  }

  update(dt) {
    if (!this.active) return;
    this.t += dt;
    const t = this.t;

    if (this.ship.__quantumRing) {
      this.ship.__quantumRing.rotation.z += dt * 4.5;
    }

    if (this.mode === "LANDING") {
      // ======================================================================
      // SHOT 1 (0.0s - 2.3s): Orbital Descent & Approach Flyby
      // ======================================================================
      if (t < 2.3) {
        if (this.onSubtext) {
          this.onSubtext("PHASE 1 // AUTOPILOT ALIGNING WITH NORTH POLE LANDING BEACON");
        }
        const p = t / 2.3;
        const ease = p * p * (3 - 2 * p);

        this.ship.position.lerpVectors(this.startPos, this.midPos, ease);
        this.ship.rotation.set(THREE.MathUtils.lerp(-0.22, 0.06, ease), 0, 0);
        this.ship.setRetroIntensity(THREE.MathUtils.lerp(0.2, 0.65, ease));
        this.ship.setSteamIntensity(THREE.MathUtils.lerp(0.2, 0.6, ease));

        if (t > 1.2 && !this.gearSfxPlayed) {
          this.gearSfxPlayed = true;
          Audio.sfx.hydraulics();
        }
        if (t > 1.2) {
          this.ship.setGearProgress(Math.min(1, (t - 1.2) / 1.1));
        }

        const camPos = new THREE.Vector3(10.5, 3.8, 8.5).add(this.midPos);
        this.camera.position.copy(camPos);
        this.camera.lookAt(this.ship.position);
      }
      // ======================================================================
      // SHOT 2 (2.3s - 4.6s): VTOL Retro-Burn, Billowing Pad Steam & Touchdown
      // ======================================================================
      else if (t < 4.6) {
        if (this.onSubtext) {
          this.onSubtext("PHASE 2 // DEPLOYING HYDRAULIC GEAR & VENTING HIGH-PRESSURE PAD STEAM");
        }
        const p = (t - 2.3) / 2.3;
        const ease = 1 - Math.pow(1 - p, 2.6);

        this.ship.position.lerpVectors(this.midPos, this.endPos, ease);
        this.ship.rotation.set(THREE.MathUtils.lerp(0.06, 0, ease), 0, 0);
        this.ship.setGearProgress(1);
        this.ship.setRetroIntensity(0.4 + Math.sin(p * Math.PI) * 0.6);
        this.ship.setSteamIntensity(THREE.MathUtils.lerp(0.65, 1.0, ease));

        if (!this.steamSfxPlayed) {
          this.steamSfxPlayed = true;
          Audio.sfx.steam(0.95, 2.8);
        }

        // Trigger massive 360-degree touchdown steam shockwave as landing pads hit deck!
        if (p > 0.85 && !this.touchdownPlayed) {
          this.touchdownPlayed = true;
          Audio.sfx.touchdown();
          this.ship.triggerSteamBurst();
        }

        const angle = THREE.MathUtils.lerp(0.55, 1.25, p);
        const radius = THREE.MathUtils.lerp(11.0, 8.2, p);
        this.camera.position.set(
          this.endPos.x + Math.sin(angle) * radius,
          this.endPos.y + THREE.MathUtils.lerp(0.8, 1.6, p),
          this.endPos.z + Math.cos(angle) * radius
        );
        this.camera.lookAt(
          this.ship.position.x,
          this.ship.position.y - 0.25,
          this.ship.position.z
        );
      }
      // ======================================================================
      // SHOT 3 (4.6s - 6.2s): Touchdown Steam Cloud & Aft Boarding Ramp Lowering
      // ======================================================================
      else {
        if (this.onSubtext) {
          this.onSubtext("PHASE 3 // TOUCHDOWN CONFIRMED — VENTING COOLANT STEAM & LOWERING RAMP");
        }
        const p = Math.min(1, (t - 4.6) / 1.6);
        const ease = p * p * (3 - 2 * p);

        this.ship.position.copy(this.endPos);
        this.ship.rotation.set(0, 0, 0);
        this.ship.setGearProgress(1);
        this.ship.setRampProgress(ease);
        this.ship.setRetroIntensity(Math.max(0, 1 - p * 2.2));
        this.ship.setSteamIntensity(THREE.MathUtils.lerp(1.0, 0.45, ease));

        if (!this.rampSfxPlayed) {
          this.rampSfxPlayed = true;
          Audio.sfx.hydraulics();
        }

        this.camera.position.set(
          this.endPos.x + THREE.MathUtils.lerp(5.2, 3.6, ease),
          this.endPos.y + THREE.MathUtils.lerp(1.2, 1.8, ease),
          this.endPos.z + THREE.MathUtils.lerp(6.8, 7.6, ease)
        );
        this.camera.lookAt(this.endPos.x, this.endPos.y + 0.1, this.endPos.z + 1.2);
      }
    } else if (this.mode === "TAKEOFF") {
      // ======================================================================
      // TAKEOFF SEQUENCE (0.0s - 4.6s)
      // ======================================================================
      if (t < 1.8) {
        if (this.onSubtext) {
          this.onSubtext("PHASE 1 // SEALING BOARDING RAMP & IGNITING VTOL LAUNCH STEAM");
        }
        const p = t / 1.8;
        const ease = p * p * (3 - 2 * p);

        this.ship.setRampProgress(1 - ease);
        this.ship.setGearProgress(1);
        this.ship.setRetroIntensity(ease);
        this.ship.setSteamIntensity(1.0);
        this.ship.position.copy(this.startPos);
        this.ship.position.y += Math.pow(p, 2) * 2.6;

        this.camera.position.set(
          this.startPos.x - 7.8,
          this.startPos.y + 1.4,
          this.startPos.z + 7.8
        );
        this.camera.lookAt(this.ship.position);
      } else {
        if (this.onSubtext) {
          this.onSubtext("PHASE 2 // RETRACTING LANDING GEAR — SUPERSONIC ORBITAL CLIMB");
        }
        const p = Math.min(1, (t - 1.8) / 2.8);
        const ease = p * p;

        if (!this.gearSfxPlayed) {
          this.gearSfxPlayed = true;
          Audio.sfx.hydraulics();
          Audio.sfx.steam(0.85, 2.2);
        }

        this.ship.setRampProgress(0);
        this.ship.setGearProgress(Math.max(0, 1 - p * 1.6));
        this.ship.setRetroIntensity(Math.max(0, 1 - p * 1.2));
        this.ship.setSteamIntensity(Math.max(0, 1 - p * 1.35));

        this.ship.position.lerpVectors(this.midPos, this.endPos, ease);
        this.ship.rotation.set(THREE.MathUtils.lerp(0, 0.2, ease), 0, 0);

        this.camera.position.set(
          this.ship.position.x + THREE.MathUtils.lerp(-6.5, 0, p),
          this.ship.position.y + THREE.MathUtils.lerp(1.6, 3.2, p),
          this.ship.position.z + THREE.MathUtils.lerp(9.0, 12.5, p)
        );
        this.camera.lookAt(this.ship.position);
      }
    } else {
      // ======================================================================
      // OPENING MISSION LAUNCH FLYBY (0.0s - 4.0s)
      // ======================================================================
      const p = Math.min(1, t / this.duration);
      const ease = 1 - Math.pow(1 - p, 3);

      if (this.onSubtext) {
        this.onSubtext(
          p < 0.55
            ? "PHASE 1 // CLEARING ORBITAL DOCKING CORRIDOR"
            : "PHASE 2 // ALL SYSTEMS NOMINAL — TRANSFERRING HELM TO PILOT"
        );
      }

      this.ship.position.lerpVectors(this.startPos, this.endPos, ease);
      this.ship.rotation.set(0, 0, 0);

      if (p < 0.55) {
        this.camera.position.set(6.5, -1797.5, 4312.0);
        this.camera.lookAt(0, -1800, 0);
      } else {
        const subP = (p - 0.55) / 0.45;
        const cEase = subP * subP * (3 - 2 * subP);
        this.camera.position.set(
          THREE.MathUtils.lerp(6.5, this.ship.position.x, cEase),
          THREE.MathUtils.lerp(-1797.5, this.ship.position.y + 3.4, cEase),
          THREE.MathUtils.lerp(4312.0, this.ship.position.z + 13.0, cEase)
        );
        this.camera.lookAt(0, -1800, 0);
      }
    }

    this.ship.updateMatrixWorld();
    if (this.ship.updateSteam) {
      this.ship.updateSteam(dt, t);
    }

    if (t >= this.duration) {
      this.finish();
    }
  }

  finish() {
    if (!this.active) return;
    this.active = false;
    this.ship.setRetroIntensity(0);
    if (this.mode !== "LANDING") {
      this.ship.setSteamIntensity(0);
    } else {
      this.ship.setSteamIntensity(0.35);
    }
    if (this.onDone) this.onDone();
  }

  dispose() {
    this.active = false;
  }
}
