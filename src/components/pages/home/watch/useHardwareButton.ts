export interface HardwareButtonOptions {
  holdMs: number;
  press: () => void;
  hold: () => void;
  double?: () => void;
  drag?: (delta: number) => void;
}
export function useHardwareButton(options: HardwareButtonOptions) {
  const pressed = ref(false);
  const held = ref(false);
  let holdTimer = 0;
  let singleTimer = 0;
  let lastPress = 0;
  let pointerId: number | null = null;
  let startY = 0;
  let previousY = 0;
  let dragged = false;
  let suppressClick = false;
  let keyboardHeld = false;
  function start(): void {
    pressed.value = true;
    held.value = false;
    dragged = false;
    clearTimeout(holdTimer);
    holdTimer = window.setTimeout(() => {
      if (!pressed.value || dragged) return;
      held.value = true;
      suppressClick = true;
      clearTimeout(singleTimer);
      options.hold();
    }, options.holdMs);
  }
  function finish(cancelled = false): void {
    clearTimeout(holdTimer);
    if (held.value || dragged || cancelled) suppressClick = true;
    pressed.value = false;
  }
  function activate(): void {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    const current = Date.now();
    if (options.double && current - lastPress < 280 && singleTimer) {
      clearTimeout(singleTimer);
      singleTimer = 0;
      lastPress = 0;
      options.double();
    } else if (options.double) {
      lastPress = current;
      singleTimer = window.setTimeout(() => {
        singleTimer = 0;
        options.press();
      }, 280);
    } else options.press();
  }
  function pointerDown(event: PointerEvent): void {
    if (event.button !== 0 || !event.isPrimary) return;
    suppressClick = false;
    pointerId = event.pointerId;
    startY = previousY = event.clientY;
    if (event.currentTarget instanceof HTMLElement) event.currentTarget.setPointerCapture(event.pointerId);
    start();
  }
  function pointerMove(event: PointerEvent): void {
    if (pointerId !== event.pointerId || !pressed.value || !options.drag) return;
    if (Math.abs(event.clientY - startY) > 5) {
      dragged = true;
      clearTimeout(holdTimer);
    }
    if (!dragged) return;
    const delta = (previousY - event.clientY) / 8;
    if (Math.abs(delta) >= 0.6) {
      previousY = event.clientY;
      options.drag(delta);
    }
  }
  function pointerUp(event: PointerEvent): void {
    if (pointerId !== event.pointerId) return;
    finish();
    pointerId = null;
  }
  function pointerCancel(): void {
    if (pointerId === null) return;
    finish(true);
    pointerId = null;
  }
  function keyDown(event: KeyboardEvent): void {
    if (event.key !== ' ' && event.key !== 'Enter') return;
    event.preventDefault();
    event.stopPropagation();
    if (event.repeat || keyboardHeld) return;
    suppressClick = false;
    keyboardHeld = true;
    start();
  }
  function keyUp(event: KeyboardEvent): void {
    if (event.key !== ' ' && event.key !== 'Enter') return;
    event.preventDefault();
    event.stopPropagation();
    if (!keyboardHeld) return;
    keyboardHeld = false;
    finish();
    activate();
  }
  function blur(): void {
    if (keyboardHeld) {
      keyboardHeld = false;
      finish(true);
    }
  }
  onBeforeUnmount(() => {
    clearTimeout(holdTimer);
    clearTimeout(singleTimer);
  });
  return {
    pressed,
    held,
    pointerDown,
    pointerMove,
    pointerUp,
    pointerCancel,
    keyDown,
    keyUp,
    blur,
    click: activate
  };
}
