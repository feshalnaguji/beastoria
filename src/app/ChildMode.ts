/**
 * Child mode (G3): the browser side. Fullscreen + keyboard lock where the
 * browser allows it, page-level key/right-click/zoom/leave guards, sticky
 * tap-to-start after reloads, the 🔒 parent gate, and the gentle play timer.
 * All decisions come from the pure childSettings / parentGate / childKeys
 * modules; the rest of the app is reached only through `ChildHooks`.
 */
import {
  addPlayTime, browserStore, extendTimer, offSettings, saveChildSettings, setTimer, type ChildSettings,
} from './childSettings';
import { shouldShowTapCard, shouldSwallowKey } from './childKeys';
import { answerGate, gateLocked, makeQuestion, newGateState } from './parentGate';
import {
  showGateQuestion, showLockButton, showParentPanel, showSleepScreen, showTapCard,
} from '../ui/ChildCards';

export interface ChildHooks {
  onChange(on: boolean): void;
  onSleep(): void;
  onWake(): void;
  /** The child's tap on the start veil — a user gesture main.ts can use to unlock audio. */
  onTap(): void;
}

type KeyboardLock = { lock?: (keys?: string[]) => Promise<void>; unlock?: () => void };
const keyboardApi = (): KeyboardLock | undefined =>
  (navigator as Navigator & { keyboard?: KeyboardLock }).keyboard;

const HEARTBEAT_MS = 1000;
const PERSIST_EVERY_BEATS = 5;

export class ChildMode {
  private tapCard: HTMLDivElement | null = null;
  private card: HTMLDivElement | null = null;
  private lockBtn: HTMLButtonElement | null = null;
  private sleepScreen: HTMLDivElement | null = null;
  private gate = newGateState();
  private asleep = false;
  private exiting = false;
  private beats = 0;

  constructor(private settings: ChildSettings, private readonly hooks: ChildHooks) {
    window.addEventListener('keydown', this.onKeyDown, { capture: true });
    window.addEventListener('contextmenu', (e) => {
      if (this.settings.on) e.preventDefault();
    });
    window.addEventListener(
      'wheel',
      (e) => {
        if (this.settings.on && e.ctrlKey) e.preventDefault();
      },
      { passive: false },
    );
    window.addEventListener('beforeunload', (e) => {
      if (!this.settings.on) return;
      e.preventDefault();
      e.returnValue = '';
    });
    document.addEventListener('fullscreenchange', () => this.maybeShowTapCard());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.persist();
    });
    window.addEventListener('pagehide', () => this.persist());
    setInterval(() => this.heartbeat(), HEARTBEAT_MS);
  }

  get on(): boolean {
    return this.settings.on;
  }

  /** True while the play timer has put the valley to sleep — nothing may restart the loop. */
  get isAsleep(): boolean {
    return this.asleep;
  }

  /** Must run inside a user gesture (the start card's button). */
  start(timerMin: number | null): void {
    if (this.settings.on) return; // a stray second start card must never reset the timer
    this.settings = offSettings();
    this.settings.on = true;
    setTimer(this.settings, timerMin);
    this.persist();
    this.applyOn();
    void this.enterLock();
  }

  /** Boot with sticky child mode: lock the UI now, wait for the child's tap to go fullscreen. */
  resumeSticky(): void {
    this.applyOn();
    if (this.settings.expired) {
      this.sleep();
      return;
    }
    if (document.fullscreenEnabled) this.maybeShowTapCard();
    else this.showTap(); // no fullscreen API: one tap to start, and it never comes back
  }

  exit(): void {
    this.exiting = true;
    this.settings = offSettings();
    this.persist();
    for (const el of [this.tapCard, this.card, this.lockBtn]) el?.remove();
    this.tapCard = this.card = null;
    this.lockBtn = null;
    this.wake();
    keyboardApi()?.unlock?.();
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    document.body.style.userSelect = '';
    this.hooks.onChange(false);
    this.exiting = false;
  }

  private persist(): void {
    saveChildSettings(this.settings, browserStore());
  }

  private get overlayOpen(): boolean {
    return this.tapCard !== null || this.card !== null;
  }

  private applyOn(): void {
    document.body.style.userSelect = 'none';
    if (!this.lockBtn) this.lockBtn = showLockButton(() => this.openGate());
    this.hooks.onChange(true);
  }

  private async enterLock(): Promise<void> {
    try {
      if (document.fullscreenEnabled && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
      await keyboardApi()?.lock?.();
    } catch {
      /* no fullscreen / no keyboard lock (Firefox, iPhone): the in-app locks still hold */
    }
  }

  private maybeShowTapCard(): void {
    if (this.exiting) return;
    const show = shouldShowTapCard({
      on: this.settings.on,
      expired: this.settings.expired,
      fullscreenEnabled: document.fullscreenEnabled,
      isFullscreen: document.fullscreenElement !== null,
      overlayOpen: this.overlayOpen,
    });
    if (show) this.showTap();
  }

  private showTap(): void {
    if (this.tapCard) return;
    this.tapCard = showTapCard(() => {
      this.tapCard = null;
      this.hooks.onTap();
      void this.enterLock();
    });
  }

  // --- parent gate -------------------------------------------------------

  private openGate(): void {
    this.card?.remove();
    this.tapCard?.remove();
    this.tapCard = null;
    const now = Date.now();
    const q = makeQuestion(Math.random);
    this.card = showGateQuestion({
      question: q,
      lockedMsLeft: gateLocked(this.gate, now) ? this.gate.lockedUntil - now : 0,
      onAnswer: (choice) => {
        const r = answerGate(this.gate, q, choice, Date.now());
        if (r === 'correct') this.openPanel();
        else this.openGate(); // wrong → a fresh question; locked → the "try again" card
      },
      onClose: () => this.closeCard(),
    });
  }

  private openPanel(): void {
    this.card?.remove();
    this.card = showParentPanel({
      timerMin: this.settings.timerMin,
      onTimer: (m) => {
        setTimer(this.settings, m);
        this.persist();
        this.openPanel();
      },
      onPlus15: () => {
        extendTimer(this.settings, 15);
        this.persist();
        this.openPanel();
      },
      onResume: () => this.closeCard(),
      onExit: () => this.exit(),
    });
  }

  private closeCard(): void {
    this.card?.remove();
    this.card = null;
    if (!this.settings.expired) this.wake();
    this.maybeShowTapCard();
  }

  // --- gentle play timer -------------------------------------------------

  private heartbeat(): void {
    // Only the tap veil and the grown-ups panel pause play time. The gate question card does
    // not: a child can open it by holding the 🔒 and would otherwise freeze the timer.
    const paused = this.tapCard !== null || this.card?.dataset.testid === 'child-panel';
    if (!this.settings.on || this.settings.expired || paused || document.hidden) return;
    if (addPlayTime(this.settings, HEARTBEAT_MS)) {
      this.persist();
      this.sleep();
      return;
    }
    if (++this.beats % PERSIST_EVERY_BEATS === 0) this.persist();
  }

  private sleep(): void {
    if (this.asleep) return;
    this.asleep = true;
    this.tapCard?.remove();
    this.tapCard = null;
    this.sleepScreen = showSleepScreen();
    this.hooks.onSleep();
  }

  private wake(): void {
    if (!this.asleep) return;
    this.asleep = false;
    this.sleepScreen?.remove();
    this.sleepScreen = null;
    this.hooks.onWake();
  }

  // --- keys --------------------------------------------------------------

  private onKeyDown = (e: KeyboardEvent): void => {
    if (!this.settings.on) return;
    const tag = e.target instanceof HTMLElement ? e.target.tagName : null;
    if (!shouldSwallowKey(e, tag)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
  };
}
