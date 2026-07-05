/**
 * ControlBar: the app toolbar (DESIGN §3 hud). A single "glass" panel of icon
 * buttons, toggles, color swatches, and radio groups. Buttons accept HTML so
 * inline SVG icons (see icons.ts) render instead of emoji, for a professional
 * look. `pointerEvents` is left default so clicks land here, not on the canvas.
 */

const PANEL_BG = 'rgba(17, 20, 28, 0.72)';
const BTN_BG = 'rgba(255,255,255,0.06)';
const BTN_BG_ACTIVE = '#4f9dff';
const FG = '#e6e9ef';
const FG_ACTIVE = '#0b0d12';

export class ControlBar {
  private buttons = new Map<string, HTMLButtonElement>();
  private bar: HTMLDivElement;

  constructor(container: HTMLElement) {
    this.bar = document.createElement('div');
    Object.assign(this.bar.style, {
      position: 'absolute',
      top: '12px',
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: '6px',
      padding: '8px 10px',
      maxWidth: 'calc(100% - 24px)',
      background: PANEL_BG,
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '14px',
      boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
      backdropFilter: 'blur(12px)',
      zIndex: '5',
      userSelect: 'none',
    });
    container.appendChild(this.bar);
  }

  /** Base styling shared by all square icon/label buttons. */
  private styleButton(btn: HTMLButtonElement): void {
    Object.assign(btn.style, {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: '38px',
      height: '38px',
      padding: '0 9px',
      borderRadius: '10px',
      border: '1px solid transparent',
      background: BTN_BG,
      color: FG,
      cursor: 'pointer',
      transition: 'background 0.12s, color 0.12s',
    });
    btn.onpointerenter = () => {
      if (btn.dataset.active !== 'true') btn.style.background = 'rgba(255,255,255,0.12)';
    };
    btn.onpointerleave = () => {
      if (btn.dataset.active !== 'true') btn.style.background = BTN_BG;
    };
  }

  /** A thin vertical divider between button groups. */
  addDivider(): void {
    const d = document.createElement('div');
    Object.assign(d.style, {
      width: '1px',
      height: '24px',
      margin: '0 2px',
      background: 'rgba(255,255,255,0.12)',
    });
    this.bar.appendChild(d);
  }

  /** A toggle button. `html` may be an SVG icon string. `title` = tooltip. */
  addToggle(id: string, html: string, title: string, onChange: (active: boolean) => void): void {
    const btn = document.createElement('button');
    btn.innerHTML = html;
    btn.title = title;
    this.styleButton(btn);
    btn.dataset.active = 'false';
    btn.onclick = () => {
      const active = btn.dataset.active !== 'true';
      this.setActive(id, active);
      onChange(active);
    };
    this.bar.appendChild(btn);
    this.buttons.set(id, btn);
  }

  /** Reflect a button's active state visually (highlighted when on). */
  setActive(id: string, active: boolean): void {
    const btn = this.buttons.get(id);
    if (!btn) return;
    btn.dataset.active = String(active);
    btn.style.background = active ? BTN_BG_ACTIVE : BTN_BG;
    btn.style.color = active ? FG_ACTIVE : FG;
  }

  /** A plain (non-toggle) action button. `html` may be an SVG icon string. */
  addButton(html: string, title: string, onClick: () => void): void {
    const btn = document.createElement('button');
    btn.innerHTML = html;
    btn.title = title;
    this.styleButton(btn);
    btn.onclick = onClick;
    this.bar.appendChild(btn);
  }

  /**
   * A single-select icon group (used for the shape/tool picker). Each option's
   * `html` is an SVG icon; `onPick` fires with the chosen value. First selected.
   */
  addIconRadioGroup<T>(
    options: { html: string; value: T; title: string }[],
    onPick: (value: T) => void,
  ): void {
    const btns: HTMLButtonElement[] = [];
    const select = (i: number) => {
      btns.forEach((b, j) => {
        const on = j === i;
        b.dataset.active = String(on);
        b.style.background = on ? BTN_BG_ACTIVE : BTN_BG;
        b.style.color = on ? FG_ACTIVE : FG;
      });
      onPick(options[i].value);
    };
    options.forEach((opt, i) => {
      const b = document.createElement('button');
      b.innerHTML = opt.html;
      b.title = opt.title;
      this.styleButton(b);
      b.onclick = () => select(i);
      btns.push(b);
      this.bar.appendChild(b);
    });
    if (options.length) select(0);
  }

  /** A single-select row of color swatches; the picked swatch gets a ring. */
  addColorSwatches(colors: number[], onPick: (hex: number) => void): void {
    const group = document.createElement('div');
    Object.assign(group.style, { display: 'flex', gap: '5px', alignItems: 'center' });

    const swatches: HTMLButtonElement[] = [];
    const select = (i: number) => {
      swatches.forEach((s, j) => {
        s.style.outline = j === i ? '2px solid #fff' : '2px solid transparent';
      });
      onPick(colors[i]);
    };

    colors.forEach((hex, i) => {
      const sw = document.createElement('button');
      Object.assign(sw.style, {
        width: '22px',
        height: '22px',
        padding: '0',
        borderRadius: '50%',
        border: '1px solid rgba(0,0,0,0.4)',
        outline: '2px solid transparent',
        outlineOffset: '1px',
        background: `#${hex.toString(16).padStart(6, '0')}`,
        cursor: 'pointer',
      });
      sw.onclick = () => select(i);
      swatches.push(sw);
      group.appendChild(sw);
    });

    this.bar.appendChild(group);
    if (colors.length) select(0);
  }

  /** A single-select group of short text labels (used for brush thickness). */
  addRadioGroup<T>(options: { label: string; value: T }[], onPick: (value: T) => void): void {
    // Wrap in a no-wrap row so the labels (e.g. S M L) always stay on one line.
    const group = document.createElement('div');
    Object.assign(group.style, { display: 'flex', gap: '6px', flexWrap: 'nowrap' });

    const btns: HTMLButtonElement[] = [];
    const select = (i: number) => {
      btns.forEach((b, j) => {
        const on = j === i;
        b.dataset.active = String(on);
        b.style.background = on ? BTN_BG_ACTIVE : BTN_BG;
        b.style.color = on ? FG_ACTIVE : FG;
      });
      onPick(options[i].value);
    };
    options.forEach((opt, i) => {
      const b = document.createElement('button');
      b.textContent = opt.label;
      this.styleButton(b);
      b.style.font = '13px/1 ui-sans-serif, system-ui, sans-serif';
      b.onclick = () => select(i);
      btns.push(b);
      group.appendChild(b);
    });
    this.bar.appendChild(group);
    if (options.length) select(0);
  }
}
