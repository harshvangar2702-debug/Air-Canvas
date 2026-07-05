/**
 * Full-screen friendly error overlay for the failure modes in DESIGN §10:
 * camera permission denied, no camera device, or WASM/model load failure.
 * Provides a Retry button that re-runs the provided async startup routine.
 */
export function showErrorOverlay(message: string, onRetry: () => void): void {
  // Remove any existing overlay so retries don't stack.
  document.getElementById('aircanvas-error')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'aircanvas-error';
  Object.assign(overlay.style, {
    position: 'absolute',
    inset: '0',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    background: 'rgba(13, 15, 20, 0.92)',
    color: '#e6e9ef',
    textAlign: 'center',
    padding: '24px',
    zIndex: '10',
  });

  const title = document.createElement('div');
  title.textContent = '✋ AirCanvas needs your camera';
  title.style.fontSize = '20px';
  title.style.fontWeight = '600';

  const detail = document.createElement('div');
  detail.textContent = message;
  detail.style.maxWidth = '420px';
  detail.style.opacity = '0.85';
  detail.style.fontSize = '14px';
  detail.style.lineHeight = '1.5';

  const retry = document.createElement('button');
  retry.textContent = 'Retry';
  Object.assign(retry.style, {
    padding: '10px 22px',
    fontSize: '14px',
    borderRadius: '8px',
    border: '1px solid #4f9dff',
    background: '#4f9dff',
    color: '#0d0f14',
    cursor: 'pointer',
  });
  retry.onclick = () => {
    overlay.remove();
    onRetry();
  };

  overlay.append(title, detail, retry);
  document.body.appendChild(overlay);
}

/** Turn a getUserMedia / init error into a human-friendly sentence. */
export function describeCameraError(err: unknown): string {
  if (err instanceof DOMException) {
    if (err.name === 'NotAllowedError') {
      return 'Camera access was blocked. Allow the camera in your browser and click Retry.';
    }
    if (err.name === 'NotFoundError') {
      return 'No camera was found. Connect a webcam and click Retry.';
    }
  }
  return 'Something went wrong starting hand tracking. Check the console and click Retry.';
}
