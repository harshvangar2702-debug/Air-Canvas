import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Pen render styles (M12). All produce a single geometry + MeshStandardMaterial
 *  so grab/erase/physics/highlight (which expect one Mesh) keep working. */
export type PenStyle = 'solid' | 'glow' | 'marker' | 'calligraphy' | 'dashed';

/** What StrokeManager needs to build the stroke mesh. */
export interface StrokeGeoMat {
  geometry: THREE.BufferGeometry;
  material: THREE.MeshStandardMaterial;
}

/**
 * Build the geometry + material for a stroke in the given pen style. The path is
 * a CatmullRom through `points` (closed for closed shapes). Each style varies the
 * tube radius/profile and the material:
 *  - solid: plain tube.
 *  - glow: emissive, un-tonemapped tube (reads as neon).
 *  - marker: wider, translucent tube (highlighter).
 *  - calligraphy: variable-radius tube, tapered toward the ends (brush feel).
 *  - dashed: many short tube segments merged into one geometry.
 */
export function buildStroke(
  points: THREE.Vector3[],
  closed: boolean,
  color: number,
  radius: number,
  style: PenStyle,
): StrokeGeoMat {
  const curve = new THREE.CatmullRomCurve3(points, closed);
  const segs = Math.max(8, points.length * 4);

  let geometry: THREE.BufferGeometry;
  switch (style) {
    case 'marker':
      geometry = new THREE.TubeGeometry(curve, segs, radius * 1.7, 8, closed);
      break;
    case 'calligraphy':
      geometry = taperedTube(curve, segs, radius, 8, closed);
      break;
    case 'dashed':
      geometry = dashedTube(curve, radius) ?? new THREE.TubeGeometry(curve, segs, radius, 8, closed);
      break;
    default: // solid + glow share the plain tube
      geometry = new THREE.TubeGeometry(curve, segs, radius, 8, closed);
  }

  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.0 });
  if (style === 'glow') {
    material.emissive = new THREE.Color(color);
    material.emissiveIntensity = 1.4;
    material.toneMapped = false; // let it read brighter than white
    material.roughness = 0.3;
  } else if (style === 'marker') {
    material.transparent = true;
    material.opacity = 0.45;
    material.roughness = 0.9;
  }

  return { geometry, material };
}

/**
 * Variable-radius tube (calligraphy). Mirrors THREE.TubeGeometry's frame walk but
 * scales the ring radius by `radiusFn(u)` — here a taper that's thin at the ends
 * and full in the middle, giving a brush/nib look.
 */
function taperedTube(
  curve: THREE.Curve<THREE.Vector3>,
  tubularSegments: number,
  base: number,
  radialSegments: number,
  closed: boolean,
): THREE.BufferGeometry {
  const frames = curve.computeFrenetFrames(tubularSegments, closed);
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const P = new THREE.Vector3();
  const N = new THREE.Vector3();

  const radiusFn = (u: number) => base * (0.25 + 0.75 * Math.sin(Math.PI * u));

  for (let i = 0; i <= tubularSegments; i++) {
    const u = i / tubularSegments;
    curve.getPointAt(u, P);
    const normal = frames.normals[i];
    const binormal = frames.binormals[i];
    const r = radiusFn(u);
    for (let j = 0; j <= radialSegments; j++) {
      const v = (j / radialSegments) * Math.PI * 2;
      const sin = Math.sin(v);
      const cos = -Math.cos(v);
      N.set(
        cos * normal.x + sin * binormal.x,
        cos * normal.y + sin * binormal.y,
        cos * normal.z + sin * binormal.z,
      ).normalize();
      positions.push(P.x + r * N.x, P.y + r * N.y, P.z + r * N.z);
      normals.push(N.x, N.y, N.z);
    }
  }

  for (let i = 1; i <= tubularSegments; i++) {
    for (let j = 1; j <= radialSegments; j++) {
      const a = (radialSegments + 1) * (i - 1) + (j - 1);
      const b = (radialSegments + 1) * i + (j - 1);
      const c = (radialSegments + 1) * i + j;
      const d = (radialSegments + 1) * (i - 1) + j;
      indices.push(a, b, d, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setIndex(indices);
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  return geo;
}

/**
 * Dashed tube: walk the curve by arc length, building a short tube for each dash
 * and merging them into one geometry. Returns null if the curve is too short to
 * produce any dash (caller falls back to a solid tube).
 */
function dashedTube(
  curve: THREE.Curve<THREE.Vector3>,
  radius: number,
): THREE.BufferGeometry | null {
  const total = curve.getLength();
  const dash = radius * 6;
  const gap = radius * 4;
  const pieces: THREE.BufferGeometry[] = [];

  for (let dist = 0; dist < total; dist += dash + gap) {
    const t0 = dist / total;
    const t1 = Math.min((dist + dash) / total, 1);
    if (t1 - t0 < 1e-4) continue;
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 4; k++) pts.push(curve.getPointAt(t0 + (t1 - t0) * (k / 4)));
    pieces.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 4, radius, 6, false));
  }

  if (!pieces.length) return null;
  const merged = mergeGeometries(pieces);
  pieces.forEach((p) => p.dispose());
  return merged;
}
