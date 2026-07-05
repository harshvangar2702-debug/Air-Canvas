import * as THREE from 'three';
import type { Landmark } from '../vision/handTracker';
import { LM } from '../gestures/metrics';

/**
 * Fixed drawing-plane depth (DESIGN §4, PRD §5).
 *
 * v1 does NOT measure depth from the webcam. Every stroke point lands on a
 * single virtual plane at this constant world Z; the 3D feel comes from orbiting
 * the camera (M5), not from measured input depth.
 */
export const Z_PLANE = 0;

// Scratch vectors reused every frame so the per-frame mapping allocates nothing.
const _ndc = new THREE.Vector3();
const _dir = new THREE.Vector3();

/**
 * Map a normalized image point (x,y ∈ [0,1], origin top-left) to a world point
 * on the plane z = Z_PLANE.
 *
 * Rather than guessing a plane size, we project the point through the CAMERA the
 * exact inverse of how the 2D overlay projects landmarks to the screen. This
 * guarantees the resulting world point, when rendered, lands on the very same
 * screen pixel the overlay drew — so the 3D cursor sits precisely on the pinch
 * point of the on-screen skeleton, at any window aspect ratio.
 *
 * Steps:
 *  1. Mirror x for selfie view (overlay uses screenX = (1 - x)·w).
 *  2. Convert the mirrored image point to NDC (−1..1, y pointing up).
 *  3. Unproject to a world-space ray from the camera, then intersect that ray
 *     with the z = Z_PLANE plane.
 */
export function landmarkToWorld(
  lm: Landmark,
  camera: THREE.Camera,
  target = new THREE.Vector3(),
): THREE.Vector3 {
  const xm = 1 - lm.x; // selfie mirror, matches the overlay
  // Image (xm, y) → NDC. x: 0..1 → −1..1. Image-y grows down, NDC-y grows up.
  _ndc.set(xm * 2 - 1, 1 - lm.y * 2, 0.5);
  _ndc.unproject(camera); // a point along the pick ray, in world space

  // Ray from the camera through that point; intersect with z = Z_PLANE (the
  // fixed v1 drawing plane — no measured webcam depth).
  _dir.copy(_ndc).sub(camera.position).normalize();
  const t = (Z_PLANE - camera.position.z) / _dir.z;
  return target.copy(camera.position).addScaledVector(_dir, t);
}

/**
 * The drawing cursor is the MIDPOINT between the thumb tip and index tip — the
 * exact point the pinch closes on — mapped to the drawing plane.
 */
export function cursorFromLandmarks(
  landmarks: Landmark[],
  camera: THREE.Camera,
  target = new THREE.Vector3(),
): THREE.Vector3 {
  const thumb = landmarks[LM.THUMB_TIP];
  const index = landmarks[LM.INDEX_TIP];
  const mid: Landmark = {
    x: (thumb.x + index.x) / 2,
    y: (thumb.y + index.y) / 2,
    z: 0,
  };
  return landmarkToWorld(mid, camera, target);
}

/**
 * The palm center = midpoint of wrist and middle-finger MCP. Used as the erase
 * point for open-palm wiping (a palm has no meaningful pinch point).
 */
export function palmCenterFromLandmarks(
  landmarks: Landmark[],
  camera: THREE.Camera,
  target = new THREE.Vector3(),
): THREE.Vector3 {
  const wrist = landmarks[LM.WRIST];
  const middleMcp = landmarks[LM.MIDDLE_MCP];
  const mid: Landmark = {
    x: (wrist.x + middleMcp.x) / 2,
    y: (wrist.y + middleMcp.y) / 2,
    z: 0,
  };
  return landmarkToWorld(mid, camera, target);
}
