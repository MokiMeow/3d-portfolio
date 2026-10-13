<script setup lang="ts">
const playing = ref(false);
</script>
<template>
  <section
    class="glasses-player"
    :class="{ 'is-playing': playing }"
    aria-label="Smart glasses cinema"
  >
    <header class="glasses-topline">
      <span><i /> THROUGH THE LENS</span><span>MOHITH / OPTICS 01</span>
    </header>
    <div class="glasses-view">
      <iframe
        v-if="playing"
        title="Rick Astley — Never Gonna Give You Up"
        src="https://www.youtube-nocookie.com/embed/dQw4w9WgXc?autoplay=1&playsinline=1&rel=0"
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        referrerpolicy="strict-origin-when-cross-origin"
        allowfullscreen
      />
      <div v-else class="glasses-ready">
        <svg
          class="lens-trace"
          viewBox="0 0 800 400"
          fill="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="lens-rim">
              <stop stop-color="#dbcfa5" stop-opacity="0" />
              <stop offset=".45" stop-color="#dbcfa5" stop-opacity=".65" />
              <stop offset="1" stop-color="#a9c8bb" stop-opacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M20 200C0 20 355 8 371 171C379 222 372 328 181 342C70 348 28 306 20 200ZM780 200C800 20 445 8 429 171C421 222 428 328 619 342C730 348 772 306 780 200"
            stroke="url(#lens-rim)"
          />
          <path
            d="M371 180Q400 157 429 180"
            stroke="#dbcfa5"
            stroke-opacity=".3"
          />
        </svg>
        <p class="eyebrow">A small escape.</p>
        <h3>A different<br /><em>point of view.</em></h3>
        <button class="glasses-play" @click="playing = true">
          <span class="play-disc" aria-hidden="true"
            ><svg viewBox="0 0 24 24">
              <path d="m9 5 11 7-11 7Z" fill="currentColor" /></svg></span
          ><span>Take a look <span aria-hidden="true">↗</span></span>
        </button>
        <p class="glasses-whisper">Sound on. Trust questionable.</p>
      </div>
    </div>
    <footer class="glasses-bottom">
      <span>{{
        playing ? "Never giving you up." : "One film. No distractions."
      }}</span
      ><a
        v-if="playing"
        href="https://www.youtube.com/watch?v=dQw4w9WgXc"
        target="_blank"
        rel="noopener noreferrer"
        >Open on YouTube ↗</a
      ><span v-else>PRESS PLAY / STAY A WHILE</span>
    </footer>
  </section>
</template>
<style scoped>
.glasses-player {
  width: min(880px, calc(100vw - 40px), calc((100dvh - 170px) * 1.7));
  color: #eee9da;
}
.glasses-topline,
.glasses-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  font: 9px/1.6 monospace;
  letter-spacing: 0.12em;
  color: #aaa99d;
  padding: 18px 0;
}
.glasses-topline {
  border-bottom: 1px solid #ece5d620;
}
.glasses-topline > span:first-child {
  display: flex;
  align-items: center;
  gap: 9px;
  color: #d5d5c7;
}
.glasses-topline i {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #c7d7ad;
}
.glasses-view {
  aspect-ratio: 16/9;
  position: relative;
  min-height: 260px;
}
.glasses-view iframe {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
}
.glasses-ready {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
}
.lens-trace {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.eyebrow {
  font: 10px/1.4 monospace;
  letter-spacing: 0.2em;
  color: #c2b89e;
}
h3 {
  position: relative;
  font-size: clamp(32px, 5.6vw, 65px);
  line-height: 1;
  font-weight: 400;
  letter-spacing: -0.05em;
  margin: 18px 0 24px;
}
h3 em {
  font-family: Georgia, serif;
  font-weight: 400;
  color: #d3c29c;
}
.glasses-play {
  position: relative;
  display: flex;
  gap: 13px;
  align-items: center;
  font-size: 12px;
  min-height: 48px;
}
.play-disc {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  border: 1px solid #c9bb9566;
  transition:
    background 0.2s,
    transform 0.2s;
}
.play-disc svg {
  width: 17px;
  height: 17px;
}
.glasses-play:hover .play-disc {
  background: #e0d2aa18;
  transform: scale(1.08);
}
.glasses-play:focus-visible,
a:focus-visible {
  outline: 2px solid #d3c29c;
  outline-offset: 7px;
}
.glasses-whisper {
  margin-top: 16px;
  font-size: 10px;
  color: #aaa99d;
}
.glasses-bottom {
  border-top: 1px solid #ece5d620;
  letter-spacing: 0;
}
.glasses-bottom > span:last-child {
  font-size: 8px;
  letter-spacing: 0.1em;
}
.glasses-bottom a {
  color: #d3c29c;
}
.is-playing .glasses-view {
  background: #000;
}
@media (max-width: 550px) {
  .glasses-topline {
    font-size: 7px;
    letter-spacing: 0.08em;
  }
  .glasses-bottom {
    font-size: 9px;
  }
  .glasses-bottom > span:last-child {
    display: none;
  }
  .lens-trace {
    opacity: 0.5;
  }
}
@media (max-height: 500px) {
  .glasses-view {
    min-height: 180px;
  }
  h3 {
    font-size: 30px;
    margin: 12px 0;
  }
  .glasses-whisper {
    display: none;
  }
  .glasses-topline,
  .glasses-bottom {
    padding: 10px 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .play-disc {
    transition: none;
  }
}
</style>
