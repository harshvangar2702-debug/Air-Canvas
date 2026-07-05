import type { HandMetrics } from '../gestures/metrics';
import type { GestureState } from '../gestures/gestureFSM';

// Distinct color per state so the header change is unmistakable at a glance.
const STATE_COLORS: Record<GestureState, string> = {
  IDLE: '#9aa4b2',
  DRAWING: '#4fd08a',
  GRABBING: '#ffb84f',
  ERASING: '#ff5a5a',
};

/**
 * A fixed-position debug panel: a large colored gesture-state header plus the
 * live metric values. The state header (M3) lets us confirm the FSM switches
 * cleanly with no flicker; the metrics (M2) stay for tuning.
 */
export class MetricsHud {
  private stateEl: HTMLDivElement;
  private el: HTMLDivElement;

  constructor(container: HTMLElement) {
    const panel = document.createElement('div');
    Object.assign(panel.style, {
      position: 'absolute',
      top: '12px',
      left: '12px',
      padding: '10px 12px',
      background: 'rgba(13, 15, 20, 0.6)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '8px',
      pointerEvents: 'none',
      zIndex: '5',
    });

    this.stateEl = document.createElement('div');
    Object.assign(this.stateEl.style, {
      font: '600 16px/1.4 ui-monospace, Menlo, Consolas, monospace',
      marginBottom: '6px',
    });

    this.el = document.createElement('div');
    Object.assign(this.el.style, {
      font: '12px/1.5 ui-monospace, Menlo, Consolas, monospace',
      color: '#e6e9ef',
      whiteSpace: 'pre',
    });

    panel.append(this.stateEl, this.el);
    container.appendChild(panel);
  }

  update(metrics: HandMetrics | null, state: GestureState): void {
    // State header is always shown, even when the hand is lost (state → IDLE).
    this.stateEl.textContent = `state: ${state}`;
    this.stateEl.style.color = STATE_COLORS[state];

    if (!metrics) {
      this.el.textContent = 'hand: (none)';
      return;
    }
    const { handSize, pinchDist, curls } = metrics;
    // Fixed decimals so the numbers don't jitter in width while reading them.
    this.el.textContent = [
      `handSize : ${handSize.toFixed(3)}`,
      `pinchDist: ${pinchDist.toFixed(3)}`,
      `curl idx : ${curls.index.toFixed(2)}`,
      `curl mid : ${curls.middle.toFixed(2)}`,
      `curl rng : ${curls.ring.toFixed(2)}`,
      `curl pnk : ${curls.pinky.toFixed(2)}`,
    ].join('\n');
  }
}
