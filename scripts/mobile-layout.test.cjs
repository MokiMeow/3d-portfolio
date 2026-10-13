const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const {Group} = require('three');
function load(file, requireModule = require) {
 const exports={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.resolve(__dirname,'../src',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:requireModule,document:{hidden:false}});
 return exports;
}
const {portraitFramingScale}=load('utils/viewport-framing.ts');
test('portrait coverage stays constant across small and tall phones',()=>{
 for(const [w,h] of [[320,568],[360,640],[390,844],[412,915],[430,932],[768,1024]]) {
  const scale=portraitFramingScale(w,h);
  assert.ok(Number.isFinite(scale));
  assert.ok(Math.abs(scale*w/h-.87)<1e-10);
 }
 assert.equal(portraitFramingScale(844,390),1);
 assert.equal(portraitFramingScale(1536,864),1);
});
test('orientation round trip preserves relative zoom',()=>{
 let radius=23*portraitFramingScale(390,844)*.6;
 const original=radius;
 radius*=portraitFramingScale(844,390)/portraitFramingScale(390,844);
 radius*=portraitFramingScale(390,844)/portraitFramingScale(844,390);
 assert.ok(Math.abs(radius-original)<1e-10);
});
test('wide contact stations get room for their side pedestals in portrait',()=>{
 for(const [w,h] of [[320,568],[390,844],[768,1024]]) {
  assert.ok(portraitFramingScale(w,h,1.12)>portraitFramingScale(w,h));
 }
 assert.equal(portraitFramingScale(844,390,1.12),1);
});
test('home and projected stations cannot render in the same view',()=>{
 const {World}=load('experiences/home/world/index.ts',id=>id==='three'?require('three'):{ExperienceBasedBlueprint:class{}});
 const world=Object.create(World.prototype);
 world._homeRenderGroup=new Group();world._projectedRenderGroup=new Group();
 world.prepareRender(false);
 assert.equal(world._homeRenderGroup.visible,true);assert.equal(world._projectedRenderGroup.visible,false);
 world.prepareRender(true);
 assert.equal(world._homeRenderGroup.visible,false);assert.equal(world._projectedRenderGroup.visible,true);
 world.prepareRender(false);
 assert.equal(world._homeRenderGroup.visible,true);assert.equal(world._projectedRenderGroup.visible,false);
});

test('cached mobile entry starts once and releases loader subscriptions on unmount',async()=>{
 const {EventEmitter}=require('node:events');
 const loader=new EventEmitter();loader.progress=100;
 const ui=new EventEmitter();let ready=0,gestures=0,cleanup;
 ui.on('ready',()=>ready++);
 const callbacks=new Map();let timer=0;
 const states=new Map();
 const experience={loader,ui,sound:{startFromGesture:async()=>{gestures++;}}};
 const context={
  exports:{},
  require:id=>id==='gsap'?{default:{timeline:()=>({clear(){},kill(){},isActive:()=>false,to(_el,options){options.onComplete();}})}}:id.includes('experiences/home')?{HomeExperience:class{constructor(){return experience;}}}:id==='~/static'?{events:{PROGRESSED:'progress',LOADED:'loaded',READY:'ready'}}:{Config:{GSAP_ANIMATION_DURATION:1,GSAP_ANIMATION_EASE:'none'}},
  ref:value=>({value}),
  useState:key=>{if(!states.has(key))states.set(key,{value:key==='isExperienceConstructed'});return states.get(key);},
  watch:(state,callback)=>callback(state.value),
  onBeforeUnmount:callback=>{cleanup=callback;},
  window:{addEventListener(){},removeEventListener(){}},
  localStorage:{getItem:()=>null,setItem(){}},
  setTimeout:callback=>{callbacks.set(++timer,callback);return timer;},
  clearTimeout:id=>callbacks.delete(id),
 };
 const source=fs.readFileSync(path.resolve(__dirname,'../src/components/pages/home/Loader.vue'),'utf8').match(/<script[^>]*>([\s\S]*?)<\/script>/)[1];
 vm.runInNewContext(ts.transpileModule(source+'\nexports.entry={initUI,onPressStart,loaderContainer,isLoadingEnded};',{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
 const {entry}=context.exports;
 entry.initUI();entry.initUI();
 assert.equal(loader.listenerCount('loaded'),1);
 assert.equal(loader.listenerCount('progress'),1);
 for(const [id,callback] of callbacks){callbacks.delete(id);callback();}
 entry.loaderContainer.value={};entry.onPressStart();entry.onPressStart();
 for(const [id,callback] of callbacks){callbacks.delete(id);callback();}
 await Promise.resolve();
 assert.equal(gestures,1);assert.equal(ready,1);assert.equal(entry.isLoadingEnded.value,true);
 cleanup();assert.equal(loader.listenerCount('loaded'),0);assert.equal(loader.listenerCount('progress'),0);
});
