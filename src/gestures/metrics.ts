import type { Landmark } from '../vision/handTracker';

/**
 * MediaPipe Hands landmark indices we care about (GESTURES.md reference).
 * Named constants beat magic numbers when reading the gesture math below.
 */
export const LM = {
  WRIST: 0,
  THUMB_TIP: 4,
  INDEX_MCP: 5,
  INDEX_TIP: 8,
  MIDDLE_MCP: 9, // hand-size anchor
  MIDDLE_TIP: 12,
  RING_MCP: 13,
  RING_TIP: 16,
  PINKY_MCP: 17,
  PINKY_TIP: 20,
} as const;

/** Metrics derived from one smoothed hand, all normalized by hand size. */
export interface HandMetrics {
  /** Reference length = |wrist − middle-MCP|, in normalized image units. */
  handSize: number;
  /** |thumbTip − indexTip| / handSize. Small when pinching (DESIGN §5). */
  pinchDist: number;
  /**
   * Per-finger curl = |fingerTip − wrist| / handSize. LARGE when the finger is
   * extended, SMALL when curled into a fist. (GESTURES.md: fist = all curls
   * below threshold.) Order: index, middle, ring, pinky.
   */
  curls: { index: number; middle: number; ring: number; pinky: number };
}

/** Euclidean distance between two landmarks in the normalized x/y plane. */
function dist2D(a: Landmark, b: Landmark): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

/**
 * Compute scale-invariant gesture metrics from smoothed landmarks.
 *
 * Everything is normalized by `handSize` (wrist↔middle-MCP) so the same
 * thresholds work whether the hand is near or far from the camera — this is
 * what lets us avoid depth (PRD §5, DESIGN §5). We use only x/y (not the noisy
 * z) for these distances.
 */
export function computeMetrics(landmarks: Landmark[]): HandMetrics {
  const wrist = landmarks[LM.WRIST];
  const middleMcp = landmarks[LM.MIDDLE_MCP];

  // Hand size floors at a tiny epsilon so we never divide by zero if landmarks
  // momentarily coincide.
  const handSize = Math.max(dist2D(wrist, middleMcp), 1e-6);

  const pinchDist =
    dist2D(landmarks[LM.THUMB_TIP], landmarks[LM.INDEX_TIP]) / handSize;

  const curls = {
    index: dist2D(landmarks[LM.INDEX_TIP], wrist) / handSize,
    middle: dist2D(landmarks[LM.MIDDLE_TIP], wrist) / handSize,
    ring: dist2D(landmarks[LM.RING_TIP], wrist) / handSize,
    pinky: dist2D(landmarks[LM.PINKY_TIP], wrist) / handSize,
  };

  return { handSize, pinchDist, curls };
}
