/** Original two-colour illustrations, shared by the physical paper and reader. */
export function drawNewspaperArt(ctx: CanvasRenderingContext2D, width: number, height: number, kind = 'room') {
  ctx.save();
  ctx.scale(width / 800, height / 400);
  ctx.fillStyle = '#ded8c9'; ctx.fillRect(0, 0, 800, 400);
  const ink = '#343d38', rust = '#a5523b';
  ctx.strokeStyle = ink; ctx.fillStyle = ink; ctx.lineWidth = 3;
  const line = (...p: number[]) => { ctx.beginPath(); ctx.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]); ctx.stroke(); };
  const oval = (x: number, y: number, rx: number, ry: number, fill = ink) => {
    ctx.fillStyle = fill; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  };
  if (kind === 'record') {
    oval(391, 209, 166, 166);
    ctx.strokeStyle = '#72796b'; ctx.lineWidth = 1.3;
    for (const r of [75, 101, 127, 148]) { ctx.beginPath(); ctx.arc(391, 209, r, 0, Math.PI * 2); ctx.stroke(); }
    oval(391, 209, 46, 46, rust); oval(391, 209, 5, 5, '#e9e3d6');
    ctx.strokeStyle = ink; ctx.lineWidth = 12; line(650, 66, 650, 166, 517, 222);
    ctx.lineWidth = 24; line(517, 222, 492, 231);
    oval(650, 66, 21, 21);
  } else if (kind === 'plant') {
    ctx.fillStyle = rust; ctx.beginPath(); ctx.moveTo(307, 274); ctx.lineTo(492, 274); ctx.lineTo(466, 371); ctx.lineTo(336, 371); ctx.closePath(); ctx.fill();
    oval(399, 274, 92, 21, '#31352b');
    ctx.strokeStyle = ink; ctx.lineWidth = 5; line(402, 288, 393, 198, 424, 58);
    for (let i = 0; i < 6; i++) {
      const x = 401 + (i % 2 ? 10 : -4), y = 250 - i * 32, direction = i % 2 ? 1 : -1;
      ctx.fillStyle = i % 2 ? '#65775b' : ink; ctx.beginPath(); ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + direction * 58, y + 14, x + direction * 94, y - 23, x + direction * 93, y - 55);
      ctx.bezierCurveTo(x + direction * 42, y - 70, x + direction * 19, y - 31, x, y); ctx.fill();
    }
  } else {
    // Isometric drawing desk, window and a single terracotta sun.
    oval(571, 123, 81, 81, rust);
    ctx.strokeStyle = ink; ctx.lineWidth = 3;
    line(119, 289, 411, 382, 705, 280); line(119, 289, 119, 48, 413, 129, 705, 48, 705, 280);
    line(413, 129, 413, 382);
    ctx.fillStyle = '#ede8dd'; ctx.beginPath(); ctx.moveTo(193, 236); ctx.lineTo(388, 291); ctx.lineTo(600, 215); ctx.lineTo(405, 165); ctx.closePath(); ctx.fill(); ctx.stroke();
    line(193, 236, 193, 318); line(388, 291, 388, 365); line(600, 215, 600, 299);
    ctx.fillStyle = rust; ctx.beginPath(); ctx.moveTo(297, 238); ctx.lineTo(408, 267); ctx.lineTo(516, 229); ctx.lineTo(405, 201); ctx.closePath(); ctx.fill();
    line(311, 235, 397, 257); line(326, 227, 411, 249);
    ctx.fillStyle = ink; ctx.fillRect(249, 73, 8, 107); line(198, 83, 307, 114); line(198, 137, 307, 168);
    oval(531, 208, 20, 7, ink); ctx.fillStyle = '#75836c'; ctx.fillRect(514, 179, 34, 27); oval(531, 179, 17, 6, ink);
    ctx.strokeStyle = ink; line(532, 177, 532, 129); line(532, 150, 553, 135); line(532, 162, 509, 145);
  }
  ctx.restore();
}

export function drawNewspaperCover(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#eee8db'; ctx.fillRect(0, 0, 768, 1024);
  ctx.fillStyle = '#272c28'; ctx.textAlign = 'center';
  ctx.font = 'bold 80px Georgia'; ctx.fillText('The Lab Post', 384, 105);
  ctx.font = '18px monospace'; ctx.fillText('MOHITH’S STUDIO  /  SLOW EDITION  /  No. 01', 384, 147);
  ctx.fillRect(42, 169, 684, 3);
  ctx.font = 'bold 65px Georgia'; ctx.fillText('Small room.', 384, 255); ctx.fillText('Big ideas.', 384, 326);
  ctx.save(); ctx.translate(42, 365); drawNewspaperArt(ctx, 684, 342); ctx.restore();
  ctx.textAlign = 'left'; ctx.font = 'bold 28px Georgia'; ctx.fillText('A place to make, pause and notice.', 42, 756);
  ctx.fillStyle = '#74776a';
  for (let col = 0; col < 3; col++) for (let row = 0; row < 12; row++)
    ctx.fillRect(42 + col * 236, 793 + row * 13, row === 11 ? 133 : 210, 2);
  ctx.fillStyle = '#272c28'; ctx.fillRect(42, 968, 684, 2);
  ctx.font = '16px monospace'; ctx.fillText('DESIGN · MUSIC · SMALL DISCOVERIES', 42, 997);
}
