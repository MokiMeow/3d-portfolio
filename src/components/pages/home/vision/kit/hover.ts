import type { Directive } from 'vue';

/**
 * The visionOS hover effect. On the headset a control lights up where your eyes rest;
 * here the pointer stands in for them. The directive only tracks the pointer inside the
 * element and exposes it as `--hx` / `--hy` (in px); the look lives in kit.css under `.vk-hover`.
 *
 * Usage: `<button v-hover class="vk-button">` after `import { vHover } from '../kit/hover'`.
 */
type Tracked = HTMLElement & { __vkMove?: (event: PointerEvent) => void; __vkLeave?: () => void };

export const vHover: Directive<Tracked> = {
  mounted(element) {
    element.classList.add('vk-hover');
    element.__vkMove = (event) => {
      if (event.pointerType === 'touch') return;
      const box = element.getBoundingClientRect();
      // The shell may scale or tilt windows, so convert through the box's real size.
      const sx = element.offsetWidth / (box.width || 1), sy = element.offsetHeight / (box.height || 1);
      element.style.setProperty('--hx', `${(event.clientX - box.left) * sx}px`);
      element.style.setProperty('--hy', `${(event.clientY - box.top) * sy}px`);
      element.classList.add('vk-lit');
    };
    element.__vkLeave = () => element.classList.remove('vk-lit');
    element.addEventListener('pointermove', element.__vkMove, { passive: true });
    element.addEventListener('pointerleave', element.__vkLeave, { passive: true });
  },
  beforeUnmount(element) {
    if (element.__vkMove) element.removeEventListener('pointermove', element.__vkMove);
    if (element.__vkLeave) element.removeEventListener('pointerleave', element.__vkLeave);
  },
};
