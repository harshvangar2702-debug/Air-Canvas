import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * SceneManager owns the Three.js essentials: renderer, scene, camera, lights,
 * and (M5) OrbitControls.
 *
 * It deliberately knows nothing about strokes, gestures, or the webcam — those
 * live in their own modules (DESIGN.md §3) and attach to `scene` later.
 */
export class SceneManager {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  private grid: THREE.GridHelper;

  // The camera pose used for drawing (straight-on, framing the plane). We snap
  // back to it when leaving orbit mode so drawing always happens face-on.
  private readonly homePosition = new THREE.Vector3(0, 0, 5);
  private readonly homeTarget = new THREE.Vector3(0, 0, 0);

  constructor(container: HTMLElement) {
    this.scene = new THREE.Scene();
    // No opaque background: the renderer is created with alpha so the webcam
    // video layer behind the canvas shows through, letting the user draw over
    // their real surroundings.

    // Perspective camera pulled back on +Z, looking at the origin. Later
    // milestones draw on a plane near the origin, so keep the origin framed.
    this.camera = new THREE.PerspectiveCamera(
      60, // vertical FOV in degrees
      container.clientWidth / container.clientHeight,
      0.1, // near plane
      100, // far plane
    );
    this.camera.position.set(0, 0, 5);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setClearColor(0x000000, 0); // fully transparent clear
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    // Canvas sits above the video background (z-index 0) but below the HUD.
    this.renderer.domElement.style.position = 'relative';
    this.renderer.domElement.style.zIndex = '1';
    container.appendChild(this.renderer.domElement);

    // Simple two-light setup: ambient fill + one directional key light so
    // geometry reads as 3D rather than flat.
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    const key = new THREE.DirectionalLight(0xffffff, 0.9);
    key.position.set(3, 4, 5);
    this.scene.add(ambient, key);

    // Ground grid for spatial context, at the physics floor level. Hidden in
    // DRAW/AR mode (it would clutter the webcam view) and shown while orbiting
    // so the user can read depth and where strokes fall (setGridVisible).
    this.grid = new THREE.GridHelper(20, 20, 0x4f9dff, 0x2a3550);
    this.grid.position.y = -2.9;
    this.grid.visible = false;
    this.scene.add(this.grid);

    // OrbitControls let the user circle the drawing to prove it's 3D (M5).
    // Disabled by default: while drawing we keep the camera face-on so screen
    // and hand coordinates align. orbitEnabled toggles it (see setOrbitEnabled).
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true; // smooth, weighty feel
    this.controls.target.copy(this.homeTarget);
    this.controls.enabled = false;
    this.controls.update();

    // Keep aspect ratio + drawing buffer in sync with the container size.
    window.addEventListener('resize', () => this.onResize(container));
  }

  /**
   * Enable/disable orbiting. When turning it OFF we snap the camera back to the
   * face-on "home" pose so drawing coordinates line up with the screen again.
   */
  setOrbitEnabled(enabled: boolean): void {
    this.controls.enabled = enabled;
    if (!enabled) {
      this.camera.position.copy(this.homePosition);
      this.controls.target.copy(this.homeTarget);
      this.camera.lookAt(this.homeTarget);
      this.controls.update();
    }
  }

  /** Show/hide the ground grid (shown while orbiting for spatial context). */
  setGridVisible(visible: boolean): void {
    this.grid.visible = visible;
  }

  /**
   * Two-hand navigation (M10): orbit the camera around the target by `dAzimuth`
   * / `dPolar` radians and dolly by `scale` (>1 zooms out, <1 zooms in). Applied
   * as a spherical offset from the target so it composes with mouse orbit.
   */
  orbitBy(dAzimuth: number, dPolar: number, scale: number): void {
    const offset = this._v.copy(this.camera.position).sub(this.controls.target);
    const sph = this._sph.setFromVector3(offset);
    sph.theta -= dAzimuth;
    // Clamp polar away from the poles to avoid gimbal flip; clamp zoom radius.
    sph.phi = Math.min(Math.max(sph.phi - dPolar, 0.1), Math.PI - 0.1);
    sph.radius = Math.min(Math.max(sph.radius * scale, 1), 40);
    offset.setFromSpherical(sph);
    this.camera.position.copy(this.controls.target).add(offset);
    this.camera.lookAt(this.controls.target);
    this.controls.update();
  }

  // Scratch objects for orbitBy (avoid per-frame allocation).
  private _v = new THREE.Vector3();
  private _sph = new THREE.Spherical();

  private onResize(container: HTMLElement) {
    const w = container.clientWidth;
    const h = container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  render() {
    // Advance OrbitControls damping every frame (required when damping is on).
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
