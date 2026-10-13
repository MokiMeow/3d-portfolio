import { RECORD_ARM } from "./room-mechanics";

/** Drive cueing on the same clock as the room, including delayed audio starts. */
export function createRecordCue(arm: { position: { y: number }; rotation: { y: number } }) {
  let playing = false, elapsed = 920;
  let fromHeight = arm.position.y, fromAngle = arm.rotation.y;
  const mix = (a: number, b: number, t: number) => {
    t = Math.max(0, Math.min(1, t));
    return a + (b - a) * t * t * (3 - 2 * t);
  };
  const settle = () => {
    arm.position.y = playing ? RECORD_ARM.playingY : RECORD_ARM.liftedY;
    arm.rotation.y = playing ? RECORD_ARM.playingAngle : 0;
  };
  return {
    setPlaying(next: boolean, immediate = false) {
      if (immediate) { playing = next; elapsed = 920; settle(); return; }
      if (next === playing) return;
      playing = next;
      fromHeight = arm.position.y;
      fromAngle = arm.rotation.y;
      elapsed = 0;
    },
    update(delta: number) {
      elapsed = Math.min(920, elapsed + Math.max(0, delta));
      // Reassert the actual playback pose after cueing; an interrupted animation
      // or a background tab cannot leave the needle parked over a spinning record.
      if (elapsed === 920) { settle(); return; }
      const raised = RECORD_ARM.liftedY + .035;
      arm.rotation.y = mix(fromAngle, playing ? RECORD_ARM.playingAngle : 0, (elapsed - 160) / 520);
      arm.position.y = elapsed < 680
        ? mix(fromHeight, raised, elapsed / 160)
        : mix(raised, playing ? RECORD_ARM.playingY : RECORD_ARM.liftedY, (elapsed - 680) / 240);
    },
  };
}
