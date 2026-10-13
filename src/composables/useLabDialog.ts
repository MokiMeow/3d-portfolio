import type { Ref } from 'vue';

/** Native modal focus handling, with restoration for triggers inside the room. */
export function useLabDialog(dialog: Ref<HTMLDialogElement | undefined>, opened: Ref<boolean>) {
  let trigger: HTMLElement | null = null;
  watch(opened, async value => {
    if (value) {
      trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      await nextTick();
      if (opened.value && !dialog.value?.open) dialog.value?.showModal();
    } else {
      dialog.value?.close();
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    }
  });
  onBeforeUnmount(() => dialog.value?.close());
}
