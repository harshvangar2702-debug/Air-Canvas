import * as THREE from 'three';

/** Drawing tools. `freeform` keeps the raw stroke; others snap to a shape. */
export type DrawTool =
  | 'freeform'
  | 'line'
  | 'rectangle'
  | 'square'
  | 'circle'
  | 'ellipse'
  | 'triangle'
  | 'arrow';

/** Result of fitting: the ideal outline points, and whether it's a closed loop. */
export interface FittedShape {
  points: THREE.Vector3[];
  closed: boolean;
}

// Segments used to render curved shapes (circle/ellipse) and per straight edge.
const CURVE_SEGMENTS = 64;
const EDGE_SEGMENTS = 12;

/** Axis-aligned bounds of the raw points on the drawing plane (z is constant). */
function bounds(points: THREE.Vector3[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const z = points[0].z;
  return { minX, minY, maxX, maxY, z, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}

/** Sample a straight edge a→b into EDGE_SEGMENTS points (excludes the endpoint). */
function edge(a: THREE.Vector3, b: THREE.Vector3, out: THREE.Vector3[]) {
  for (let i = 0; i < EDGE_SEGMENTS; i++) {
    const t = i / EDGE_SEGMENTS;
    out.push(new THREE.Vector3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z));
  }
}

/** Build a closed polygon outline (densely sampled edges) from corner points. */
function polygon(corners: THREE.Vector3[]): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  for (let i = 0; i < corners.length; i++) {
    edge(corners[i], corners[(i + 1) % corners.length], out);
  }
  return out;
}

/**
 * Snap raw drawn points to the ideal outline for `tool`. Corners are densely
 * sampled so the TubeGeometry built from these points reads as straight edges
 * with crisp corners (DESIGN §6 build path is reused by StrokeManager).
 */
export function fitShape(raw: THREE.Vector3[], tool: DrawTool): FittedShape {
  const b = bounds(raw);
  const z = b.z;
  const V = (x: number, y: number) => new THREE.Vector3(x, y, z);

  switch (tool) {
    case 'line': {
      // Straight segment between the first and last drawn points.
      const a = raw[0];
      const c = raw[raw.length - 1];
      const pts: THREE.Vector3[] = [];
      edge(a, c, pts);
      pts.push(c.clone());
      return { points: pts, closed: false };
    }

    case 'rectangle':
      return { points: polygon([V(b.minX, b.maxY), V(b.maxX, b.maxY), V(b.maxX, b.minY), V(b.minX, b.minY)]), closed: true };

    case 'square': {
      // Centered square whose side = the larger bounding dimension.
      const half = Math.max(b.maxX - b.minX, b.maxY - b.minY) / 2;
      return {
        points: polygon([
          V(b.cx - half, b.cy + half),
          V(b.cx + half, b.cy + half),
          V(b.cx + half, b.cy - half),
          V(b.cx - half, b.cy - half),
        ]),
        closed: true,
      };
    }

    case 'circle': {
      // Centroid + mean radius → regular polygon (reads as a circle).
      const r = (Math.abs(b.maxX - b.minX) + Math.abs(b.maxY - b.minY)) / 4;
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i < CURVE_SEGMENTS; i++) {
        const a = (i / CURVE_SEGMENTS) * Math.PI * 2;
        pts.push(V(b.cx + Math.cos(a) * r, b.cy + Math.sin(a) * r));
      }
      return { points: pts, closed: true };
    }

    case 'ellipse': {
      const rx = (b.maxX - b.minX) / 2;
      const ry = (b.maxY - b.minY) / 2;
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i < CURVE_SEGMENTS; i++) {
        const a = (i / CURVE_SEGMENTS) * Math.PI * 2;
        pts.push(V(b.cx + Math.cos(a) * rx, b.cy + Math.sin(a) * ry));
      }
      return { points: pts, closed: true };
    }

    case 'triangle':
      // Apex at top-center, base at the bounding-box bottom corners.
      return { points: polygon([V(b.cx, b.maxY), V(b.maxX, b.minY), V(b.minX, b.minY)]), closed: true };

    case 'arrow': {
      // Shaft first→last, plus a two-barb head at the end. Traced as one path:
      // start → tip → barbL → tip → barbR so it's a single continuous tube.
      const start = raw[0];
      const tip = raw[raw.length - 1];
      const dx = tip.x - start.x;
      const dy = tip.y - start.y;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len, uy = dy / len; // unit direction
      const head = Math.min(len * 0.3, 0.6); // barb length
      // Barbs at ±30° from the reversed direction.
      const ang = Math.PI / 6;
      const rot = (s: number) =>
        V(
          tip.x - head * (ux * Math.cos(ang) + s * -uy * Math.sin(ang)),
          tip.y - head * (uy * Math.cos(ang) + s * ux * Math.sin(ang)),
        );
      const barbL = rot(1);
      const barbR = rot(-1);
      const pts: THREE.Vector3[] = [];
      edge(start, tip, pts);
      pts.push(tip.clone(), barbL, tip.clone(), barbR);
      return { points: pts, closed: false };
    }

    default:
      return { points: raw, closed: false };
  }
}
