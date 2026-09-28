'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const out = 'qa-results';
fs.mkdirSync(out, { recursive: true });
const source = fs.readFileSync('goku-alianzas-z/index.html', 'utf8');
const hook = `window.__QA = { G, scene, renderer, camera, loadExternalAsset, getModelAsset, MODEL_CACHE, externalMixers, makeFighter, removeFighter, startLevel, pause, pose, update, playExternal, clipFor, toTitle, summon, get P(){return P}, get B(){return B}, get allies(){return allies} };`;
let html = source.replace('/* ---------- Arranque ---------- */', hook + '\n/* ---------- Arranque ---------- */');
html = html.replace('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js', '/qa-vendor/build/three.js').replaceAll('https://cdn.jsdelivr.net/npm/three@0.128.0/', '/qa-vendor/');
fs.writeFileSync('goku-alianzas-z/qa-diagnostic.html', html);
(async () => {
  const browser = await chromium.launch({ headless:true, args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
  const page = await browser.newPage({ viewport:{width:960,height:640}, deviceScaleFactor:1 });
  const errors = [], warnings = [], failed = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (['error','warning'].includes(m.type())) warnings.push(m.text().slice(0,1000)); });
  page.on('response', r => { if (r.status() >= 400) failed.push({status:r.status(),url:r.url()}); });
  await page.route('**/fonts.googleapis.com/**', r => r.fulfill({status:200,body:''}));
  await page.goto('http://127.0.0.1:8765/goku-alianzas-z/qa-diagnostic.html', {waitUntil:'load',timeout:60000});
  await page.waitForFunction(() => !!window.__QA, {timeout:30000});
  await page.evaluate(() => { __QA.G.mode='paused'; });
  const inspect = async key => page.evaluate(async key => {
    try {
      const a = await Promise.race([__QA.loadExternalAsset(key),new Promise((_,r)=>setTimeout(()=>r(new Error('load timeout')),20000))]);
      a.scene.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(a.scene);
      const bones = [], meshes = [];
      a.scene.traverse(o=>{
        if(o.isBone) bones.push({name:o.name,parent:o.parent.name,pos:o.position.toArray(),quat:o.quaternion.toArray(),scale:o.scale.toArray(),world:o.getWorldPosition(new THREE.Vector3()).toArray()});
        if(o.isMesh) meshes.push({name:o.name,skinned:!!o.isSkinnedMesh,vertices:o.geometry.attributes.position.count,attributes:Object.keys(o.geometry.attributes),scale:o.scale.toArray(),position:o.position.toArray(),materials:(Array.isArray(o.material)?o.material:[o.material]).map(m=>({name:m.name,type:m.type,color:m.color&&m.color.getHexString(),map:m.map&&String(m.map.image&&m.map.image.src||m.map.name).slice(0,160),encoding:m.map&&m.map.encoding,vertexColors:m.vertexColors,transparent:m.transparent,opacity:m.opacity,side:m.side}))});
      });
      window.__assets = window.__assets || {}; window.__assets[key]=a;
      return {ok:true,bounds:{min:box.min.toArray(),max:box.max.toArray()},root:{scale:a.scene.scale.toArray(),quat:a.scene.quaternion.toArray()},bones,meshes,animations:a.animations.map(c=>({name:c.name,duration:c.duration,tracks:c.tracks.length,examples:c.tracks.slice(0,12).map(t=>({name:t.name,type:t.ValueTypeName,minTime:t.times[0],maxTime:t.times[t.times.length-1],firstValues:Array.from(t.values.slice(0,6))}))}))};
    } catch(e){return {ok:false,error:String(e),stack:e.stack};}
  },key);
  const baseline = {};
  for(const k of ['goku','piccolo','vegeta','freezer','cell','buu']) baseline[k]=await inspect(k);
  console.log('BASELINE',JSON.stringify(Object.fromEntries(Object.entries(baseline).map(([k,v])=>[k,v.ok?{ok:true,bones:v.bones.length,meshes:v.meshes.length,animations:v.animations.map(a=>({name:a.name,duration:a.duration}))}:{ok:false,error:v.error}]))));
  fs.writeFileSync(path.join(out,'baseline.json'),JSON.stringify({baseline,errors,warnings,failed},null,2));
  // Diagnose the FBX files even when the production page omitted its inflater dependency.
  await page.addScriptTag({url:'http://127.0.0.1:8765/qa-vendor/examples/js/libs/fflate.min.js'});
  const loaded = {};
  for(const k of ['goku','piccolo','vegeta','freezer','cell','buu']) {
    loaded[k]=await inspect(k);
    console.log('MODEL',k,JSON.stringify(loaded[k].ok?{bounds:loaded[k].bounds,bones:loaded[k].bones.filter(b=>!/finger|thumb|index|middle|ring|pinky|hair|eye|lip|tongue|teeth|brow|cloth|face/i.test(b.name)).slice(0,45),meshes:loaded[k].meshes,animations:loaded[k].animations.map(a=>({name:a.name,duration:a.duration,tracks:a.tracks}))}:loaded[k]));
    if(!loaded[k].ok) continue;
    await page.evaluate(key=>{
      __QA.G.mode='paused'; __QA.externalMixers.clear();
      document.querySelectorAll('.screen,#hud,#touch,#speed,#fx,#animeGrade').forEach(e=>e.hidden=true);
      const a=window.__assets[key];
      const s=new THREE.Scene(); s.background=new THREE.Color(0x8597a4);
      s.add(new THREE.HemisphereLight(0xffffff,0x667788,0.7)); const sun=new THREE.DirectionalLight(0xffffff,0.75); sun.position.set(4,8,6); s.add(sun);
      const wrap=new THREE.Group(); wrap.add(THREE.SkeletonUtils.clone(a.scene)); const b=new THREE.Box3().setFromObject(wrap),sz=b.getSize(new THREE.Vector3());
      wrap.scale.setScalar(3/Math.max(sz.y,.001)); wrap.updateMatrixWorld(true); const box=new THREE.Box3().setFromObject(wrap); const c=box.getCenter(new THREE.Vector3()); wrap.position.set(-c.x,-box.min.y,-c.z); s.add(wrap);
      const cam=new THREE.PerspectiveCamera(42,960/640,.01,1000); cam.position.set(0,1.65,6); cam.lookAt(0,1.5,0);
      window.__gallery={s,cam,wrap};
      // The game's RAF keeps rendering; replace only the renderer's input for this diagnostic page.
      if(!__QA.renderer.__rawRender) __QA.renderer.__rawRender=__QA.renderer.render.bind(__QA.renderer);
      __QA.renderer.render=()=>__QA.renderer.__rawRender(window.__gallery.s,window.__gallery.cam);
      __QA.renderer.setPixelRatio(1); __QA.renderer.render();
    },k);
    await page.waitForTimeout(750);
    await page.screenshot({path:path.join(out,k+'-front.png')});
    await page.evaluate(()=>{__gallery.cam.position.set(4,1.65,-5); __gallery.cam.lookAt(0,1.5,0);});
    await page.screenshot({path:path.join(out,k+'-back.png')});
  }
  fs.writeFileSync(path.join(out,'models.json'),JSON.stringify({loaded,errors,warnings,failed},null,2));
  console.log('ERRORS',JSON.stringify({errors,warnings:[...new Set(warnings)].slice(0,35),failed:[...new Map(failed.map(x=>[x.url,x])).values()]}));
  await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1;});
