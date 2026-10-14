<template>
  <div class="display-preview-art" aria-hidden="true">
    <div class="screen">
      <svg class="wallpaper" viewBox="0 0 800 450" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="mac-preview-blue" x2="1" y2="1"><stop stop-color="#75d1e4"/><stop offset=".5" stop-color="#4378c1"/><stop offset="1" stop-color="#252f73"/></linearGradient><linearGradient id="mac-preview-sand" x2="0" y2="1"><stop stop-color="#f3cdb9"/><stop offset="1" stop-color="#ad81b7"/></linearGradient></defs><path fill="#283a75" d="M0 0h800v450H0z"/><path d="M-100-100C600-60 240 120 620 450H-100Z" fill="url(#mac-preview-blue)"/><path d="M800-100C400 100 600 280 300 500H900Z" fill="url(#mac-preview-sand)"/><path d="M-100 500Q500 120 900 500" fill="#747bb6" opacity=".7"/></svg>
      <div class="mini-menu"><b>Finder</b><span>File</span><span>Edit</span><span>View</span><i/> <span>100%</span><span>9:41</span></div>
      <div class="mini-code"><div class="mini-title"><i/><i/><i/><span>workspace.ts</span></div><pre><span>// A little room to create.</span>
const space = {
  focus: 'one thing',
  possibilities: Infinity
};

export default space;</pre><div class="mini-status">TypeScript <span>UTF-8</span></div></div>
      <div class="mini-finder"><div class="mini-title"><i/><i/><i/><span>Projects</span></div><div class="finder-inside"><aside>Favourites<b>Recents</b><b>Desktop</b><b>Documents</b><b>Projects</b></aside><main><div v-for="name in ['Experiments','Sketchbook','Inspiration']" :key="name"><svg viewBox="0 0 48 40" fill="none"><path d="M3 10h17l5 5h20v21H3Z" fill="#6cbeef"/><path d="M3 10V5h16l5 5" fill="#9ddcf7"/></svg><span>{{ name }}</span></div></main></div><footer>3 items · Local workspace</footer></div>
      <div class="mini-dock"><i/><i/><i/><i/><i/></div>
    </div>
    <div class="display-shadow"/><p>YOUR PRIVATE WORKSPACE</p>
  </div>
</template>
<style scoped>
.display-preview-art { position:relative; width:100%; padding:18px 4px 0; perspective:1200px; font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text',sans-serif; }
.screen { position:relative; aspect-ratio:16/10; border-radius:18px; overflow:hidden; border:1px solid #ffffff75; box-shadow:0 28px 55px #00152d66,inset 0 0 0 4px #ffffff0a; transform:rotateY(7deg) rotateX(3deg); }
.wallpaper { position:absolute; inset:0; width:100%; height:100%; }
.mini-menu { position:relative; display:flex; gap:12px; align-items:center; padding:0 12px; height:24px; font-size:8px; background:#19213b55; color:#fff; }
.mini-menu i { flex:1; }
.mini-code,.mini-finder { position:absolute; border-radius:9px; overflow:hidden; box-shadow:0 12px 30px #0005; border:1px solid #ffffff30; }
.mini-code { width:58%; height:68%; right:4%; top:17%; background:#1e2637; }
.mini-finder { width:60%; height:59%; left:5%; top:25%; background:#eef1f5; color:#30394a; }
.mini-title { display:flex; gap:4px; align-items:center; height:24px; padding:0 8px; background:#ffffff12; font-size:7px; }
.mini-finder .mini-title { background:#e0e3e9; }
.mini-title i { width:6px; height:6px; border-radius:50%; background:#ff6c63; }
.mini-title i:nth-child(2) { background:#f8cf5d; }.mini-title i:nth-child(3) { background:#6ed588; }
.mini-title span { flex:1; text-align:center; padding-right:20px; }
pre { padding:6px 12px; text-align:left; font-size:clamp(5px,1.1cqw,10px); line-height:1.8; color:#a8ccf2; margin:0; font-family:'SFMono-Regular',Consolas,monospace; }
pre>span { color:#7e9d8e; }
.finder-inside { display:flex; height:calc(100% - 43px); }
aside { width:30%; background:#dfe5ec; padding:10px 8px; display:flex; flex-direction:column; gap:9px; text-align:left; font-size:7px; color:#7d8795; }
aside b { color:#52637b; font-weight:500; }
main { flex:1; display:flex; justify-content:space-around; align-items:flex-start; gap:6px; padding:16px 10px; }
main>div { display:flex; flex-direction:column; align-items:center; gap:4px; font-size:6px; }
main svg { width:30px; height:26px; }
footer { font-size:6px; height:19px; display:grid; place-items:center; border-top:1px solid #0000000a; color:#7e8795; }
.mini-status { position:absolute; inset:auto 0 0; background:#30466f; padding:3px 10px; font-size:6px; text-align:left; }.mini-status span { float:right; }
.mini-dock { position:absolute; bottom:3%; left:50%; transform:translateX(-50%); padding:5px 7px; display:flex; gap:5px; border-radius:10px; background:#ffffff35; border:1px solid #ffffff30; }
.mini-dock i { width:19px; height:19px; border-radius:5px; background:linear-gradient(135deg,#b8edff,#2698e9); box-shadow:inset 0 1px 0 #ffffff65; }.mini-dock i:nth-child(2){background:linear-gradient(145deg,#74c37e,#26714b)}.mini-dock i:nth-child(3){background:linear-gradient(145deg,#abb6ed,#586cc5)}.mini-dock i:nth-child(4){background:linear-gradient(145deg,#ffdd7d,#f9f5de)}.mini-dock i:nth-child(5){background:linear-gradient(145deg,#d6ddeb,#79859b)}
.display-shadow { width:80%; height:14px; margin:18px auto 0; background:#0b153433; filter:blur(12px); border-radius:50%; }
p { color:#d2dff1b3; font-size:9px; letter-spacing:.2em; text-align:center; margin:12px 0 0; }
@media(prefers-reduced-motion:reduce) { .screen { transform:none; } }
</style>
