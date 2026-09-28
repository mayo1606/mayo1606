'use strict';
const {chromium}=require('playwright');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
 try {
 const page=await browser.newPage({viewport:{width:960,height:640},deviceScaleFactor:1});
 await page.route('**/fonts.googleapis.com/**',r=>r.fulfill({status:200,body:''}));
 await page.goto('http://127.0.0.1:8765/goku-alianzas-z/qa-regression.html',{waitUntil:'load'});
 await page.waitForFunction(()=>!!window.__QA);
 await page.evaluate(async()=>{
  __QA.G.mode='paused';document.querySelectorAll('.screen,#hud,#touch,#speed,#fx,#animeGrade').forEach(e=>e.hidden=true);
  await __QA.getModelAsset('piccolo');window.f=__QA.makeFighter('piccolo');
 });
 await page.waitForFunction(()=>f.external);
 await page.evaluate(()=>{
  const s=new THREE.Scene();s.background=new THREE.Color(0x738c96);s.add(new THREE.HemisphereLight(0xffffff,0x667788,.58));const light=new THREE.DirectionalLight(0xfff4e6,.9);light.position.set(4,7,6);s.add(light);s.add(f.g);
  const c=new THREE.PerspectiveCamera(40,1.5,.01,1000);c.position.set(.25,1.65,6.5);c.lookAt(0,1.5,0);
  const render=__QA.renderer.render.bind(__QA.renderer);__QA.renderer.render=()=>render(s,c);__QA.renderer.setPixelRatio(1);
  for(let i=0;i<45;i++)__QA.pose({f,pos:new THREE.Vector3(),hp:100},new THREE.Vector3(0,0,10),null,1/60);
  window.meshes=[];f.external.traverse(o=>{if(o.isMesh)meshes.push(o);});
 });
 const stats=await page.evaluate(()=>meshes.map(m=>({name:m.name,verts:m.geometry.attributes.position.count})));
 fs.writeFileSync('qa-results/piccolo-material-meshes.json',JSON.stringify(stats,null,2));
 for(const flip of [true,false])for(const hide of [false,true]){
  await page.evaluate(({flip,hide})=>{const textures=new Set();for(const m of meshes){m.visible=!(hide&&/mesh13008/.test(m.name));for(const a of(Array.isArray(m.material)?m.material:[m.material]))if(a.map)textures.add(a.map);}for(const t of textures){t.flipY=flip;t.needsUpdate=true;}}, {flip,hide});
  await page.waitForTimeout(150);
  await page.screenshot({path:`qa-results/piccolo-flip${flip}-hide${hide}.png`});
 }
 // Show separate surfaces, without conflating topology or texture errors.
 for(const target of ['mesh1016','mesh0015','mesh12008','mesh13008','mesh10009']){
  await page.evaluate(target=>{for(const m of meshes)m.visible=m.name.includes(target);},target);
  await page.waitForTimeout(100);await page.screenshot({path:`qa-results/piccolo-surface-${target}.png`});
 }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
