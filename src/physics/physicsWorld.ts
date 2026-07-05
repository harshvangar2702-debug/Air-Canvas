import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { Stroke } from '../scene/strokeManager';

/**
 * Per-stroke physics bookkeeping. We store the geometry centroid and the mesh's
 * pre-physics transform so we can (a) sync the mesh to the body each frame and
 * (b) restore the stroke exactly when physics is reset (DESIGN §7).
 */
interface Body {
  stroke: Stroke;
  body: RAPIER.RigidBody;
  centroid: THREE.Vector3; // geometry centroid C (absolute, from draw-time points)
  origPosition: THREE.Vector3;
  origQuaternion: THREE.Quaternion;
}

// Gravity applied when physics is ON. OFF = strokes stay exactly where drawn.
const GRAVITY = { x: 0, y: -9.81, z: 0 };
// Ground sits just below the visible drawing area so strokes fall and land.
const GROUND_Y = -2.9;

/**
 * PhysicsWorld wraps a Rapier world and drives the finalized strokes as rigid
 * bodies when gravity is toggled on. Off by default so drawings float in place;
 * turning it on makes them fall/bounce, and reset() puts them back.
 */
export class PhysicsWorld {
  private world: RAPIER.World | null = null;
  private bodies: Body[] = [];
  private _enabled = false;

  // Scratch objects reused during the per-frame sync (no per-frame allocation).
  private _q = new THREE.Quaternion();
  private _v = new THREE.Vector3();

  /** Load the Rapier WASM and create the (empty) world. Call once at startup. */
  async init(): Promise<void> {
    await RAPIER.init();
    this.world = new RAPIER.World(GRAVITY);

    // A large, thin, fixed ground slab for strokes to land on.
    const groundBody = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(50, 0.1, 50).setTranslation(0, GROUND_Y, 0),
      groundBody,
    );
  }

  get enabled(): boolean {
    return this._enabled;
  }

  /**
   * Turn gravity ON: build a dynamic body for each current stroke and let them
   * fall. Strokes drawn after this stay static until physics is reset + re-enabled.
   */
  enable(strokes: readonly Stroke[]): void {
    if (!this.world || this._enabled) return;
    for (const stroke of strokes) this.addBody(stroke);
    this._enabled = true;
  }

  /** Turn gravity OFF and restore every stroke to its drawn transform. */
  reset(): void {
    if (!this.world) return;
    for (const b of this.bodies) {
      b.stroke.mesh.position.copy(b.origPosition);
      b.stroke.mesh.quaternion.copy(b.origQuaternion);
      this.world.removeRigidBody(b.body);
    }
    this.bodies = [];
    this._enabled = false;
  }

  /** Advance the simulation and sync each stroke's mesh to its body. */
  step(): void {
    if (!this.world || !this._enabled) return;
    this.world.step();

    for (const b of this.bodies) {
      const t = b.body.translation();
      const r = b.body.rotation();
      this._q.set(r.x, r.y, r.z, r.w);

      // The tube geometry is authored around absolute world points, so its
      // vertices carry the centroid C. To make the body's rotation appear to
      // pivot about C, set: quat = bodyRot, position = bodyPos − bodyRot·C.
      // Then quat·p + position = bodyRot·(p − C) + bodyPos for every vertex p.
      this._v.copy(b.centroid).applyQuaternion(this._q);
      b.stroke.mesh.quaternion.copy(this._q);
      b.stroke.mesh.position.set(t.x - this._v.x, t.y - this._v.y, t.z - this._v.z);
    }
  }

  private addBody(stroke: Stroke): void {
    const world = this.world!;

    // Geometry centroid C from the draw-time (absolute) points.
    const centroid = new THREE.Vector3();
    for (const p of stroke.points) centroid.add(p);
    centroid.multiplyScalar(1 / stroke.points.length);

    // Body starts at the stroke's CURRENT visual centroid = C + mesh.position
    // (the mesh offset accumulates grab moves), so enabling physics is seamless.
    const origPosition = stroke.mesh.position.clone();
    const origQuaternion = stroke.mesh.quaternion.clone();
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(
      centroid.x + origPosition.x,
      centroid.y + origPosition.y,
      centroid.z + origPosition.z,
    );
    const body = world.createRigidBody(bodyDesc);

    // Approximate the tube with a compound of ball colliders at each sampled
    // point, offset from the body centre by (p − C). Cheap and shape-preserving.
    for (const p of stroke.points) {
      world.createCollider(
        RAPIER.ColliderDesc.ball(stroke.radius)
          .setTranslation(p.x - centroid.x, p.y - centroid.y, p.z - centroid.z)
          .setRestitution(0.4)
          .setFriction(0.8),
        body,
      );
    }

    this.bodies.push({ stroke, body, centroid, origPosition, origQuaternion });
  }
}
