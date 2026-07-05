import * as THREE from 'three';
import type { GestureState } from '../gestures/gestureFSM';

// Fixed cursor colors for the ACTION states, matching the HUD header colors so
// the two readouts agree at a glance. IDLE/DRAWING instead take the active brush
// color (passed in) so the user sees which color they'll draw with.
const GRABBING_COLOR = 0xffb84f;
const ERASING_COLOR = 0xff5a5a;

/**
 * A small sphere that marks where the drawing cursor is on the plane. It recolors
 * by gesture state and hides when the hand is lost, giving the user continuous
 * feedback about where a stroke will start (DESIGN §3 cursor).
 */
export class Cursor {
  readonly mesh: THREE.Mesh;
  private material: THREE.MeshBasicMaterial;

  constructor(scene: THREE.Scene) {
    this.material = new THREE.MeshBasicMaterial({ color: 0x9aa4b2 });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 16), this.material);
    this.mesh.visible = false;
    scene.add(this.mesh);
  }

  /**
   * Move + recolor the cursor for a tracked hand. `brushColor` tints the cursor
   * while idle/drawing so it previews the current pen color; grab and erase use
   * their own fixed colors.
   */
  update(position: THREE.Vector3, state: GestureState, brushColor: number): void {
    this.mesh.visible = true;
    this.mesh.position.copy(position);
    const color =
      state === 'GRABBING'
        ? GRABBING_COLOR
        : state === 'ERASING'
          ? ERASING_COLOR
          : brushColor; // IDLE or DRAWING → preview the pen color
    this.material.color.setHex(color);
  }

  /** Hide when there's no hand to point with. */
  hide(): void {
    this.mesh.visible = false;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
