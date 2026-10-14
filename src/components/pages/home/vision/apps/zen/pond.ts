/** Cached pond bed; only three fish and surface ripples move. No reactive animation state. */
export class KoiPond {
 private bed=document.createElement('canvas');
 private width=1; private height=1;
 resize(width:number,height:number):void {
  this.width=width;this.height=height;
  const ratio=Math.min(devicePixelRatio || 1,2);this.bed.width=Math.round(width*ratio);this.bed.height=Math.round(height*ratio);
  const ctx=this.bed.getContext('2d');if(!ctx)return;ctx.setTransform(ratio,0,0,ratio,0,0);
  const x=width*.73,y=height*.51,rx=width*.19,ry=height*.33;
  ctx.save();ctx.translate(x,y);ctx.rotate(-.12);
  ctx.shadowColor='#253f3b66';ctx.shadowBlur=14;ctx.shadowOffsetY=6;
  ctx.beginPath();ctx.ellipse(0,0,rx+8,ry+8,0,0,Math.PI*2);ctx.fillStyle='#738575';ctx.fill();ctx.shadowColor='transparent';
  const water=ctx.createRadialGradient(-rx*.45,-ry*.4,2,0,0,Math.max(rx,ry));water.addColorStop(0,'#9dc4ac');water.addColorStop(.45,'#568b80');water.addColorStop(1,'#294d4c');
  ctx.beginPath();ctx.ellipse(0,0,rx,ry,0,0,Math.PI*2);ctx.fillStyle=water;ctx.fill();ctx.strokeStyle='#d4dfbe66';ctx.lineWidth=2;ctx.stroke();
  for(let i=0;i<16;i++){const a=i/16*Math.PI*2;ctx.beginPath();ctx.ellipse(Math.cos(a)*(rx+5),Math.sin(a)*(ry+5),6+i%3,4+i%2,a,0,Math.PI*2);ctx.fillStyle=['#8d9884','#a0a38e','#5c766b'][i%3]!;ctx.fill();}
  for(let i=0;i<5;i++){const px=-rx*.52+i%2*14,py=-ry*.25+i*13;ctx.beginPath();ctx.moveTo(px,py);ctx.arc(px,py,9+i%3,-.5,Math.PI*2-.75);ctx.closePath();ctx.fillStyle=i%2 ? '#8fae6b' : '#6d955a';ctx.fill();ctx.strokeStyle='#acc68955';ctx.lineWidth=1;ctx.stroke();}
  ctx.beginPath();ctx.ellipse(rx*.2,-ry*.44,rx*.45,ry*.15,-.35,0,Math.PI*2);ctx.fillStyle='#d1e5c811';ctx.fill();ctx.restore();
 }
 contains(x:number,y:number):boolean {return ((x-this.width*.73)/(this.width*.21))**2+((y-this.height*.51)/(this.height*.36))**2<1;}
 draw(ctx:CanvasRenderingContext2D,time:number,moving:boolean):void {
  ctx.drawImage(this.bed,0,0,this.width,this.height);
  const t=moving ? time/1000 : 0;
  ctx.save();ctx.translate(this.width*.73,this.height*.51);ctx.rotate(-.12);
  ctx.beginPath();ctx.ellipse(0,0,this.width*.19,this.height*.33,0,0,Math.PI*2);ctx.clip();
  for(let i=0;i<3;i++){
   const a=t*.13+i*2.1,rx=this.width*(.09+i*.017),ry=this.height*(.12+i*.04);
   const x=Math.cos(a)*rx,y=Math.sin(a)*ry,rotation=Math.atan2(Math.cos(a)*ry,-Math.sin(a)*rx);
   ctx.save();ctx.translate(x,y);ctx.rotate(rotation);const s=Math.max(8,Math.min(this.width,this.height)*.036);
   ctx.globalAlpha=.35;ctx.beginPath();ctx.ellipse(3,5,s*.45,s*1.5,0,0,Math.PI*2);ctx.fillStyle='#162b28';ctx.fill();ctx.globalAlpha=1;
   ctx.beginPath();ctx.moveTo(0,-s*1.6);ctx.bezierCurveTo(s*.75,-s,s*.5,s*.6,0,s*1.5);ctx.bezierCurveTo(-s*.5,s*.6,-s*.75,-s,0,-s*1.6);ctx.fillStyle=i===1 ? '#dfb259' : '#ebe7d5';ctx.fill();
   ctx.beginPath();ctx.ellipse(0,-s*.6,s*.3,s*.5,.2,0,Math.PI*2);ctx.ellipse(s*.1,s*.3,s*.3,s*.35,-.4,0,Math.PI*2);ctx.fillStyle=i===1 ? '#a77340' : '#c57045';ctx.fill();
   const sway=moving ? Math.sin(t*2.5+i)*.3 : .1;ctx.beginPath();ctx.moveTo(0,s*1.15);ctx.lineTo(-s*.65+s*sway,s*2);ctx.lineTo(s*.65+s*sway,s*2);ctx.closePath();ctx.fillStyle='#dccaa799';ctx.fill();
   ctx.beginPath();ctx.moveTo(-s*.3,-s*.2);ctx.lineTo(-s*.9,s*.3);ctx.lineTo(-s*.3,s*.5);ctx.moveTo(s*.3,-s*.2);ctx.lineTo(s*.9,s*.3);ctx.lineTo(s*.3,s*.5);ctx.fillStyle='#dedfc477';ctx.fill();
   ctx.beginPath();ctx.arc(-s*.19,-s*1.03,1,0,Math.PI*2);ctx.arc(s*.19,-s*1.03,1,0,Math.PI*2);ctx.fillStyle='#233d35';ctx.fill();ctx.restore();
  }
  ctx.strokeStyle='#d7eddd33';ctx.lineWidth=.8;
  for(let i=0;i<4;i++){const phase=(t*.13+i*.25)%1;ctx.globalAlpha=(1-phase)*.45;ctx.beginPath();ctx.ellipse(-this.width*.04,this.height*.04,this.width*(.03+phase*.17),this.height*(.04+phase*.24),0,0,Math.PI*2);ctx.stroke();}
  ctx.restore();
 }
 dispose():void{this.bed.width=0;this.bed.height=0;}
}
