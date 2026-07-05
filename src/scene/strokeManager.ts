import * as THREE from 'three';
import { fitShape, type DrawTool } from './shapeFitter';
import { buildStroke, type PenStyle } from './penStyles';

/** Metadata stored per finalized stroke (DESIGN §6). Grows in later milestones. */
export interface Stroke {
  id: number;
  points: THREE.Vector3[];
  color: number;
  radius: number;
  mesh: THREE.Mesh;
}

/**
 * Minimum world-space distance between consecutive sampled points while drawing.
 * Throttles point density so a slow or shaky hand doesn't pile up thousands of
 * nearly-identical points into a huge geometry (DESIGN §9).
 */
const MIN_SEGMENT_DIST = 0.045;

/** Default brush color + radius; overridable per-stroke via the HUD (M8). */
const DEFAULT_RADIUS = 0.06;
const DEFAULT_COLOR = 0x4f9dff;

/** Cursor-to-stroke distance within which the eraser deletes a stroke. */
const ERASE_RADIUS = 0.6;

/**
 * StrokeManager owns the live drawing buffer and all finalized stroke meshes.
 *
 * Lifecycle (DESIGN §6):
 *  - begin(): start a new point buffer + a lightweight preview line.
 *  - extend(): append the cursor point if it moved > MIN_SEGMENT_DIST; rebuild
 *    the cheap preview line each frame.
 *  - finalize(): replace the preview with a TubeGeometry mesh through a smooth
 *    CatmullRom curve, and keep it as a persistent Stroke.
 */
export class StrokeManager {
  private scene: THREE.Scene;
  private strokes: Stroke[] = [];
  private nextId = 1;

  // Active (in-progress) stroke state, null when not drawing.
  private activePoints: THREE.Vector3[] = [];
  private previewLine: THREE.Line | null = null;
  private previewMaterial: THREE.LineBasicMaterial | null = null;
  // Brush settings snapshotted at begin() so a mid-stroke HUD change only
  // affects the NEXT stroke, not the one currently being drawn.
  private activeColor = DEFAULT_COLOR;
  private activeRadius = DEFAULT_RADIUS;
  private activeTool: DrawTool = 'freeform';
  private activePen: PenStyle = 'solid';

  // Current brush settings applied to the NEXT stroke started (HUD-controlled).
  private brushColor = DEFAULT_COLOR;
  private brushRadius = DEFAULT_RADIUS;
  private tool: DrawTool = 'freeform';
  private pen: PenStyle = 'solid';

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /** Select the active drawing tool: freeform keeps raw strokes, others snap. */
  setTool(tool: DrawTool): void {
    this.tool = tool;
  }

  /** Select the active pen render style (solid/glow/marker/calligraphy/dashed). */
  setPen(pen: PenStyle): void {
    this.pen = pen;
  }

  /** Set the color used by subsequently-drawn strokes. */
  setColor(hex: number): void {
    this.brushColor = hex;
  }

  /** Set the tube radius (thickness) used by subsequently-drawn strokes. */
  setRadius(radius: number): void {
    this.brushRadius = radius;
  }

  get color(): number {
    return this.brushColor;
  }

  get isDrawing(): boolean {
    return this.previewLine !== null;
  }

  /** Start a new stroke at the given world point. */
  begin(start: THREE.Vector3): void {
    this.activePoints = [start.clone()];
    // Lock in the brush settings for this stroke.
    this.activeColor = this.brushColor;
    this.activeRadius = this.brushRadius;
    this.activeTool = this.tool;
    this.activePen = this.pen;

    // Preview is a plain Line (cheap to rebuild every frame) until finalize.
    this.previewMaterial = new THREE.LineBasicMaterial({ color: this.activeColor });
    const geom = new THREE.BufferGeometry().setFromPoints(this.activePoints);
    this.previewLine = new THREE.Line(geom, this.previewMaterial);
    this.scene.add(this.previewLine);
  }

  /**
   * Append `point` to the active stroke if it moved far enough, then refresh the
   * preview line. No-op if not currently drawing.
   */
  extend(point: THREE.Vector3): void {
    if (!this.previewLine) return;

    const last = this.activePoints[this.activePoints.length - 1];
    if (point.distanceTo(last) < MIN_SEGMENT_DIST) return;
    this.activePoints.push(point.clone());

    // Rebuild the preview geometry from the current points. Cheap for the small
    // point counts throttling keeps us at; the finalized tube is built once.
    this.previewLine.geometry.dispose();
    this.previewLine.geometry = new THREE.BufferGeometry().setFromPoints(this.activePoints);
  }

  /**
   * Finalize the active stroke into a persistent tube mesh. Returns the new
   * Stroke, or null if the stroke was too short to render (e.g. a stray tap).
   */
  finalize(): Stroke | null {
    if (!this.previewLine) return null;

    // Always tear down the preview first so we can't leak it on early return.
    this.scene.remove(this.previewLine);
    this.previewLine.geometry.dispose();
    this.previewMaterial?.dispose();
    this.previewLine = null;
    this.previewMaterial = null;

    const raw = this.activePoints;
    this.activePoints = [];

    // Need at least two distinct points to build a curve/tube.
    if (raw.length < 2) return null;

    // Freeform keeps the raw stroke; a shape tool snaps the raw points to the
    // ideal outline (M11) — reusing the same tube-build path below.
    const fitted =
      this.activeTool === 'freeform'
        ? { points: raw, closed: false }
        : fitShape(raw, this.activeTool);
    const points = fitted.points;

    // Build the stroke geometry + material for the active pen style (DESIGN §6;
    // M12). buildStroke always returns a single Mesh's worth of geo+material so
    // grab/erase/physics keep operating on one mesh.
    const { geometry, material } = buildStroke(
      points,
      fitted.closed,
      this.activeColor,
      this.activeRadius,
      this.activePen,
    );
    const mesh = new THREE.Mesh(geometry, material);
    this.scene.add(mesh);

    const stroke: Stroke = {
      id: this.nextId++,
      points,
      color: this.activeColor,
      radius: this.activeRadius,
      mesh,
    };
    this.strokes.push(stroke);
    return stroke;
  }

  /**
   * Erase (delete + dispose) every finalized stroke whose nearest point is
   * within `radius` of the cursor. Returns how many were removed. Iterates
   * back-to-front so splicing during removal is safe.
   */
  eraseNear(cursor: THREE.Vector3, radius = ERASE_RADIUS): number {
    let removed = 0;
    for (let i = this.strokes.length - 1; i >= 0; i--) {
      const stroke = this.strokes[i];
      if (this.minDistanceToStroke(cursor, stroke) < radius) {
        this.scene.remove(stroke.mesh);
        stroke.mesh.geometry.dispose();
        (stroke.mesh.material as THREE.Material).dispose();
        this.strokes.splice(i, 1);
        removed++;
      }
    }
    return removed;
  }

  /** Remove + dispose every finalized stroke (Clear button). */
  clear(): void {
    for (const stroke of this.strokes) {
      this.scene.remove(stroke.mesh);
      stroke.mesh.geometry.dispose();
      (stroke.mesh.material as THREE.Material).dispose();
    }
    this.strokes = [];
  }

  /** Min distance from `cursor` to any sampled point of a stroke (world space). */
  private minDistanceToStroke(cursor: THREE.Vector3, stroke: Stroke): number {
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

  /** All finalized strokes (used by later milestones for grab/physics/export). */
  get all(): readonly Stroke[] {
    return this.strokes;
  }
}
