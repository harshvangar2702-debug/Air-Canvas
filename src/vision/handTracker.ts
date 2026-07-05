import {
  FilesetResolver,
  HandLandmarker,
  type HandLandmarkerResult,
} from '@mediapipe/tasks-vision';

/**
 * A single normalized hand landmark from MediaPipe.
 * x, y ∈ [0, 1] in image space (origin top-left, BEFORE selfie mirroring).
 * z is relative depth (negative = toward camera) and NOISY — treated only as a
 * soft hint, never as true metric depth (PRD §5, DESIGN §4).
 */
export interface Landmark {
  x: number;
  y: number;
  z: number;
}

/**
 * Called every processed video frame with ALL detected hands (0, 1, or 2), each
 * as its own 21-landmark array. Index 0 is the primary hand used for drawing;
 * two-hand navigation (M10) uses both entries. Empty array = no hand.
 */
export type HandFrameCallback = (hands: Landmark[][], result: HandLandmarkerResult) => void;

/**
 * HandTracker owns the webcam stream and the MediaPipe HandLandmarker.
 *
 * Responsibilities (DESIGN §3):
 *  - request the camera and start a hidden <video> element,
 *  - load the HandLandmarker WASM + model (VIDEO mode, max 1 hand),
 *  - run detection once per animation frame and emit landmarks.
 *
 * It does NOT smooth, classify gestures, or touch Three.js — those are separate
 * modules downstream. This keeps the vision layer swappable.
 */
export class HandTracker {
  readonly video: HTMLVideoElement;
  private landmarker: HandLandmarker | null = null;
  private running = false;

  // MediaPipe's VIDEO mode requires strictly increasing timestamps and rejects
  // duplicate frames, so we track the last processed video time.
  private lastVideoTime = -1;

  constructor() {
    // Video element that backs the MediaPipe input AND is shown as the scene
    // background so the user can draw over their real surroundings. It sits
    // behind the transparent WebGL canvas (see attachAsBackground) and is
    // mirrored horizontally to match the selfie-view landmark mirroring.
    this.video = document.createElement('video');
    this.video.autoplay = true;
    this.video.playsInline = true;
    this.video.muted = true;
  }

  /**
   * Insert the (mirrored) video as a full-cover background layer inside the
   * given container, behind the transparent WebGL canvas. Call once at startup.
   */
  attachAsBackground(container: HTMLElement): void {
    Object.assign(this.video.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      transform: 'scaleX(-1)', // selfie mirror, matches landmark/overlay mirroring
      zIndex: '0',
    });
    container.insertBefore(this.video, container.firstChild);
  }

  /** Show/hide the webcam background (hidden during orbit mode for a clean 3D view). */
  setBackgroundVisible(visible: boolean): void {
    this.video.style.visibility = visible ? 'visible' : 'hidden';
  }

  /**
   * Load the WASM fileset + hand-landmark model. Kept separate from the camera
   * request so failures can be reported distinctly (WASM vs. permission).
   */
  async init(): Promise<void> {
    // Served from the MediaPipe CDN; matches the installed tasks-vision version.
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm',
    );

    this.landmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numHands: 2, // primary hand draws; the second enables two-hand navigation (M10).
      // Lowered from the 0.5 defaults so fast motion (which blurs the hand and
      // drops the model's confidence) doesn't cause the hand to vanish between
      // frames. Combined with the stroke grace-period in main.ts, this keeps a
      // stroke alive through brief tracking dropouts.
      minHandDetectionConfidence: 0.3,
      minHandPresenceConfidence: 0.3,
      minTrackingConfidence: 0.3,
    });
  }

  /**
   * Request the webcam and begin streaming into the hidden video element.
   * Throws on permission-denied / no-device so the caller can show the overlay.
   */
  async startCamera(): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 1280, height: 720, facingMode: 'user' },
      audio: false,
    });
    this.video.srcObject = stream;

    // Wait until the first frame's dimensions are known before detecting.
    await new Promise<void>((resolve) => {
      this.video.onloadeddata = () => resolve();
    });
    await this.video.play();
  }

  /**
   * Start the per-frame detection loop. `onFrame` fires each processed frame.
   * Detection is driven by requestAnimationFrame; vision runs at display rate
   * but skips frames where the video time hasn't advanced.
   */
  start(onFrame: HandFrameCallback): void {
    if (!this.landmarker) {
      throw new Error('HandTracker.init() must complete before start()');
    }
    this.running = true;

    const loop = () => {
      if (!this.running) return;
      this.detect(onFrame);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  private detect(onFrame: HandFrameCallback): void {
    const landmarker = this.landmarker;
    if (!landmarker) return;

    // Only run when the video has a genuinely new frame; MediaPipe VIDEO mode
    // rejects repeated timestamps.
    if (this.video.currentTime === this.lastVideoTime) return;
    this.lastVideoTime = this.video.currentTime;

    // performance.now() gives the monotonically increasing timestamp MediaPipe
    // expects (milliseconds).
    const result = landmarker.detectForVideo(this.video, performance.now());

    // Emit all detected hands (0..2), each a 21-landmark array. result.landmarks
    // is already NormalizedLandmark[][]; it structurally matches Landmark[][].
    onFrame(result.landmarks, result);
  }

  stop(): void {
    this.running = false;
    const stream = this.video.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
  }
}
