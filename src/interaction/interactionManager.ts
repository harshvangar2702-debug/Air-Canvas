import * as THREE from 'three';
import type { Stroke } from '../scene/strokeManager';

/**
 * How close (world units) the cursor must be to a stroke to grab it. The
 * drawing plane fills the camera view (~5.8 units tall), so ~1.2 gives a
 * forgiving-but-not-greedy pick radius. Tunable.
 */
const GRAB_RADIUS = 1.2;

// Emissive tint applied to a grabbed stroke so the selection is obvious. Stored
// as a hex so we can restore the material to un-emissive (0x000000) on release.
const HIGHLIGHT_EMISSIVE = 0x444444;

/**
 * InteractionManager handles grab-to-move (DESIGN §8):
 *  - beginGrab(): select the nearest stroke within GRAB_RADIUS of the cursor.
 *  - moveGrab(): translate the selected stroke by the cursor's per-frame delta.
 *  - endGrab(): release + un-highlight.
 *
 * It moves the stroke's Mesh via `mesh.position` (an offset on top of the
 * world-space tube geometry), so the original points are preserved for picking
 * and for later physics reset (M7).
 */
export class InteractionManager {
  private selected: Stroke | null = null;
  private lastCursor = new THREE.Vector3();

  get isGrabbing(): boolean {
    return this.selected !== null;
  }

  /**
   * Try to grab the nearest stroke to `cursor`. Returns the selected stroke, or
   * null if none was within GRAB_RADIUS.
   */
  beginGrab(cursor: THREE.Vector3, strokes: readonly Stroke[]): Stroke | null {
    let best: Stroke | null = null;
    let bestDist = GRAB_RADIUS; // only consider strokes closer than the radius
    for (const stroke of strokes) {
      const d = this.distanceToStroke(cursor, stroke);
      if (d < bestDist) {
        bestDist = d;
        best = stroke;
      }
    }
    if (best) {
      this.selected = best;
      this.lastCursor.copy(cursor);
      this.setHighlight(best, true);
    }
    return best;
  }

  /** Translate the selected stroke by how far the cursor moved since last frame. */
  moveGrab(cursor: THREE.Vector3): void {
    if (!this.selected) return;
    // Delta-based move: robust to the arbitrary absolute grab anchor, and the
    // stroke follows the hand 1:1. (In v1 the cursor stays on the z=0 plane, so
    // this moves strokes within the view plane only — no webcam depth.)
    this.selected.mesh.position.add(cursor.clone().sub(this.lastCursor));
    this.lastCursor.copy(cursor);
  }

  /** Release the current stroke, if any. */
  endGrab(): void {
    if (this.selected) this.setHighlight(this.selected, false);
    this.selected = null;
  }

  /**
   * Distance from the cursor to the nearest sampled point of a stroke, in world
   * space. We add the mesh's current position offset so already-moved strokes
   * are picked at their new location, not where they were drawn.
   */
  private distanceToStroke(cursor: THREE.Vector3, stroke: Stroke): number {
    const offset = stroke.mesh.position;
    let min = Infinity;
    for (const p of stroke.points) {
      const dx = cursor.x - (p.x + offset.x);
      const dy = cursor.y - (p.y + offset.y);
      const dz = cursor.z - (p.z + offset.z);
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < min) min = d;
    }
    return min;
  }

  private setHighlight(stroke: Stroke, on: boolean): void {
    const mat = stroke.mesh.material as THREE.MeshStandardMaterial;
    mat.emissive.setHex(on ? HIGHLIGHT_EMISSIVE : 0x000000);
  }
}
