/* Character integration v2: explicit materials, preserved import transforms and skeletal poses. */
const MODEL_FILES = {
  goku:{type:'gltf',url:'assets/models/goku/Goku Super Saiyan 3_1_.glb',height:2.9},
  piccolo:{type:'fbx',url:'assets/models/piccolo/DBFZ PICCOLO.fbx',height:3.05,diffuse:'assets/models/piccolo/Untitled433_20250829210547.png'},
  vegeta:{type:'fbx',url:'assets/models/vegeta/Vegeta.fbx',height:2.65,diffuse:'assets/models/vegeta/Vegeta.png'},
  freezer:{type:'fbx',url:'assets/models/frieza/Freeza.fbx',height:2.7},
  cell:{type:'gltf',url:'assets/models/cell/Cell Perfect.gltf',height:3.15},
  buu:{type:'obj',url:'assets/models/buu/22.OBJ',mtl:'assets/models/buu/22.mtl',height:2.65,yaw:Math.PI,diffuse:'assets/models/buu/223.jpg'}
};
const MODEL_CACHE=new Map(), externalMixers=new Set();
const modelManager=new THREE.LoadingManager();
modelManager.setURLModifier(url=>{
  const clean=url.replace(/\\/g,'/');
  if(/Vegeta\.png$/i.test(clean))return 'assets/models/vegeta/Vegeta.png';
  if(/piccolo_gi_d\.png$/i.test(clean))return 'assets/models/piccolo/piccolo_gi_d.png';
  if(/Piccolo_decal/i.test(clean))return 'assets/models/piccolo/Piccolo_decal.tga.png';
  if(/Piccolo_detail/i.test(clean))return 'assets/models/piccolo/Piccolo_detail.tga.png';
  return url;
});
const gltfLoader=new THREE.GLTFLoader(modelManager),fbxLoader=new THREE.FBXLoader(modelManager);
const objLoader=new THREE.OBJLoader(modelManager),mtlLoader=new THREE.MTLLoader(modelManager);
const textureLoader=new THREE.TextureLoader(modelManager);
const promiseLoad=(loader,url)=>new Promise((ok,fail)=>loader.load(url,ok,undefined,fail));
async function loadExternalAsset(key){
  const c=MODEL_FILES[key];if(!c)throw new Error('Unknown character: '+key);
  let scene,animations=[];
  if(c.type==='gltf'){const a=await promiseLoad(gltfLoader,c.url);scene=a.scene;animations=a.animations||[];}
  else if(c.type==='fbx'){scene=await promiseLoad(fbxLoader,c.url);animations=scene.animations||[];}
  else {const mats=await promiseLoad(mtlLoader,c.mtl);mats.preload();scene=await promiseLoad(new THREE.OBJLoader(modelManager).setMaterials(mats),c.url);}
  const diffuse=c.diffuse?await promiseLoad(textureLoader,c.diffuse):null;
  if(diffuse){diffuse.encoding=THREE.sRGBEncoding;diffuse.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());}
  return {scene,animations,diffuse};
}
function getModelAsset(key){
  if(!MODEL_CACHE.has(key))MODEL_CACHE.set(key,loadExternalAsset(key).catch(e=>{MODEL_CACHE.delete(key);throw e;}));
  return MODEL_CACHE.get(key);
}
function toonifyExternal(root,targetMats,key,diffuse){
  root.traverse(o=>{
    if(o.isLight||o.isCamera)o.visible=false;
    if(!o.isMesh)return;
    o.frustumCulled=false;
    const old=Array.isArray(o.material)?o.material:[o.material];
    const next=old.map(m=>{
      const name=(m&&m.name)||'',outline=key==='cell'&&/OUTLINE/i.test(o.name+' '+name);
      const map=outline?null:(diffuse||(m&&m.map)||null);
      const color=outline?new THREE.Color(0x101321):(map?new THREE.Color(0xffffff):(m&&m.color?m.color.clone():new THREE.Color(0xffffff)));
      // FBX diffuse colors are sRGB; glTF factors are already linear. Never convert normal/alpha data.
      if(!map&&MODEL_FILES[key].type==='fbx')color.convertSRGBToLinear();
      const nm=new THREE.MeshToonMaterial({name,color,map,gradientMap:GRAD,skinning:!!o.isSkinnedMesh,
        morphTargets:!!o.morphTargetInfluences,morphNormals:!!o.morphTargetInfluences,
        transparent:false,opacity:1,alphaTest:map&&key==='cell'?.2:0,
        side:outline?THREE.BackSide:THREE.FrontSide,vertexColors:false});
      if(map)map.encoding=THREE.sRGBEncoding;
      // The procedural scenery uses its legacy output. Imported textures get their own correct sRGB output.
      nm.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <encodings_fragment>','gl_FragColor = LinearTosRGB(gl_FragColor);');};
      nm.customProgramCacheKey=()=> 'gaz-character-linear-to-srgb-v2';
      if(outline){nm.color.setHex(0x101321);nm.polygonOffset=true;nm.polygonOffsetFactor=1;nm.polygonOffsetUnits=1;}
      targetMats.push(nm);return nm;
    });
    o.material=Array.isArray(o.material)?next:next[0];
    if(/dummy_material/i.test(old.map(m=>m.name).join(' ')))o.visible=false;
    if(o.isSkinnedMesh)o.normalizeSkinWeights();
  });
}
const RIG_NAMES={
 goku:{hips:'WAIST',spine:'SPINE2',head:'HEAD',upper:['SHOULDER_L','SHOULDER_R'],lower:['ELBOW_L','ELBOW_R'],hand:['WRIST_L','WRIST_R'],thigh:['THIGH_L','THIGH_R'],calf:['CLANK_L','CLANK_R'],foot:['TOE1_L','TOE1_R']},
 vegeta:{hips:'mixamorigHips',spine:'mixamorigSpine1',head:'mixamorigHead',upper:['mixamorigLeftArm','mixamorigRightArm'],lower:['mixamorigLeftForeArm','mixamorigRightForeArm'],hand:['mixamorigLeftHand','mixamorigRightHand'],thigh:['mixamorigLeftUpLeg','mixamorigRightUpLeg'],calf:['mixamorigLeftLeg','mixamorigRightLeg'],foot:['mixamorigLeftFoot','mixamorigRightFoot']},
 piccolo:{hips:'root_hips',spine:'spine_upper',head:'head_neck_upper',upper:['arm_left_shoulder_2','arm_right_shoulder_2'],lower:['arm_left_elbow','arm_right_elbow'],hand:['arm_left_wrist','arm_right_wrist'],thigh:['leg_left_thigh','leg_right_thigh'],calf:['leg_left_knee','leg_right_knee'],foot:['leg_left_ankle','leg_right_ankle']},
 cell:{hips:'pelvis',spine:'spine_02',head:'head',upper:['upperarm_l','upperarm_r'],lower:['lowerarm_l','lowerarm_r'],hand:['hand_l','hand_r'],thigh:['thigh_l','thigh_r'],calf:['calf_l','calf_r'],foot:['foot_l','foot_r']}
};
function buildRig(root,key){
  const names=RIG_NAMES[key];if(!names)return null;
  const byName=new Map();root.traverse(b=>{if(b.isBone&&!byName.has(b.name))byName.set(b.name,b);});
  const find=name=>byName.get(name);
  const rigs=[],rootQ=root.getWorldQuaternion(new THREE.Quaternion()),invRoot=rootQ.clone().invert();
  function segment(name,end){
    const b=find(name),e=find(end);if(!b||!e)return null;
    const v=e.getWorldPosition(new V()).sub(b.getWorldPosition(new V())).applyQuaternion(invRoot);
    if(v.lengthSq()<1e-10)return null;
    const rest=b.getWorldQuaternion(new THREE.Quaternion()).premultiply(invRoot);
    return {bone:b,axis:v.normalize(),rest,current:rest.clone()};
  }
  for(let i=0;i<2;i++){
    const upper=segment(names.upper[i],names.lower[i]),lower=segment(names.lower[i],names.hand[i]);
    const thigh=segment(names.thigh[i],names.calf[i]),calf=segment(names.calf[i],names.foot[i]);
    const b=upper&&upper.bone;const sign=b?Math.sign(root.worldToLocal(b.getWorldPosition(new V())).x)||1:(i===0?1:-1);
    rigs.push({sign,upper,lower,thigh,calf});
  }
  return {limbs:rigs,count:rigs.reduce((n,r)=>n+['upper','lower','thigh','calf'].filter(k=>r[k]).length,0)};
}
function aimSegment(seg,dir,rootQ,k){
  if(!seg)return;
  const target=new THREE.Quaternion().setFromUnitVectors(seg.axis,dir.normalize()).multiply(seg.rest);
  seg.current.slerp(target,k);
  const parentQ=seg.bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
  seg.bone.quaternion.copy(parentQ.multiply(rootQ).multiply(seg.current));
  seg.bone.updateMatrixWorld(true);
}
function clipFor(f,kind){
  if(f.key!=='goku')return null;
  const exact={idle:'A_0000_23_A_STD_g001_FMC1_4LP',charge:'A_0000_23_S_BST_a001_ry1_2CG1',special:'A_0000_23_S_BST_a001_ry1_3HT1'};
  return (f.animations||[]).find(a=>a.name===exact[kind])||null;
}
function playExternal(f,kind,opts){
  if(!f||f.disposed)return;
  const times={attack:.3,hurt:.24,death:Infinity,special:1.95};
  if(kind==='death'){f.motionEvent={kind,t:0,duration:Infinity};return;}
  if(f.motionEvent&&f.motionEvent.kind==='death')return;
  if(times[kind])f.motionEvent={kind,t:0,duration:times[kind]};
  // Only named, inspected clips are used. Never guess a cinematic clip from /hit/ or /DEM/.
  const clip=clipFor(f,kind);if(!f.mixer||!clip)return;
  const action=f.mixer.clipAction(clip);if(f.action===action)return;
  if(f.action)f.action.fadeOut(.12);
  action.reset().setLoop(THREE.LoopRepeat,Infinity).setEffectiveWeight(1).fadeIn(.12).play();f.action=action;
}
function updateExternal(f,o,move,dt){
  if(!f.external||f.disposed)return;
  f.motionTime=(f.motionTime||0)+dt;
  if(f.motionEvent){f.motionEvent.t+=dt;if(f.motionEvent.t>=f.motionEvent.duration)f.motionEvent=null;}
  const dead=!!o.dead||o.hp===0,air=o.pos.y>.4,moving=move&&(Math.abs(move.x)+Math.abs(move.z)>.1);
  let state=dead?'death':o.beamPose?'beam':o.kameCharge||o.charging?'charge':o.block?'block':(f.motionEvent?f.motionEvent.kind:(moving?'move':'idle'));
  if(f.mixer){
    const kind=state==='charge'?'charge':'idle';
    if(f.nativeState!==kind){playExternal(f,kind);f.nativeState=kind;}
    f.mixer.update(dt);
  }
  if(!f.rig)return; // Static sculptures are explicitly reported, not advertised as rigged animation.
  f.external.updateMatrixWorld(true);
  const q=f.external.getWorldQuaternion(new THREE.Quaternion()),k=1-Math.exp(-18*dt);
  const phase=f.motionTime*(moving?9:2),ev=f.motionEvent;
  const punch=state==='attack'&&ev?Math.sin(Math.PI*Math.min(1,ev.t/.3)):0;
  f.rig.limbs.forEach((r,i)=>{
    const side=r.sign,swing=moving&&!air?Math.sin(phase+i*Math.PI):0;
    let u=new V(side*.18,-.72,.35),l=new V(-side*.12,.5,.5);
    let th=new V(side*.055,-1,swing*.55),ca=new V(0,-1,-Math.max(0,-swing)*.7);
    if(moving&&!air){u.set(side*.14,-1,-swing*.5);l.set(0,-.5,.75);}
    if(air){th.set(side*.1,-.85,-.3-(i?.3:0));ca.set(0,-.6,-.8);u.set(side*.3,-.85,-.3);l.set(0,-.8,.25);}
    if(state==='block'){u.set(side*.18,-.25,.65);l.set(-side*.13,.9,.2);}
    if(state==='charge'){u.set(side*.3,-.8,-.12);l.set(-side*.05,-.05,.8);th.z=.08;ca.z=-.18;}
    if(state==='beam'||state==='special'){u.set(side*.1,.05,1);l.set(-side*.16,0,1);}
    if(state==='attack'&&(f.punchSide?i===0:i===1)){u.lerp(new V(side*.03,.12,1),punch);l.lerp(new V(0,.02,1),punch);}
    if(state==='hurt'){u.set(side*.45,-.2,.6);l.set(0,.5,.4);}
    if(dead){u.set(side*.3,-1,.1);l.set(0,-1,.1);th.set(side*.12,-1,0);ca.set(0,-1,0);}
    aimSegment(r.upper,u,q,k);aimSegment(r.lower,l,q,k);aimSegment(r.thigh,th,q,k);aimSegment(r.calf,ca,q,k);
  });
}
function attachExternalModel(f,key){
  f.key=key;f.modelStatus='loading';
  getModelAsset(key).then(asset=>{
    if(f.disposed||!f.g.parent)return;
    const cfg=MODEL_FILES[key],model=THREE.SkeletonUtils.clone(asset.scene),ext=new THREE.Group();
    // Normalize the wrapper, never overwrite the imported model/armature's scale or animated root.
    ext.add(model);model.rotation.y+=cfg.yaw||0;model.updateMatrixWorld(true);
    const skeletons=new Set();model.traverse(o=>{if(o.isSkinnedMesh)skeletons.add(o.skeleton);});
    skeletons.forEach(s=>s.pose());model.updateMatrixWorld(true);
    let box=new THREE.Box3().setFromObject(ext),size=box.getSize(new V());
    if(!Number.isFinite(size.y)||size.y<1e-5)throw new Error('Invalid model bounds: '+key);
    const scale=cfg.height/size.y;model.scale.multiplyScalar(scale);model.updateMatrixWorld(true);
    box=new THREE.Box3().setFromObject(ext);const center=box.getCenter(new V());
    model.position.add(new V(-center.x,-box.min.y,-center.z));model.updateMatrixWorld(true);
    toonifyExternal(model,f.mats,key,asset.diffuse);
    f.rig=buildRig(ext,key);f.modelStatus=f.rig&&f.rig.count===8?'rigged':'static';
    for(const ch of f.g.children)if(ch!==f.aura)ch.visible=false;
    f.g.add(ext);f.external=ext;f.animations=asset.animations||[];
    if(key==='goku'){
      // Rotation-only clips leave world motion and character scale under game control.
      f.animations=f.animations.map(c=>new THREE.AnimationClip(c.name,c.duration,c.tracks.filter(t=>t.name.endsWith('.quaternion')).map(t=>t.clone()).map(t=>{t.optimize();return t;})));
      f.mixer=new THREE.AnimationMixer(model);playExternal(f,'idle');
    }
    updateExternal(f,{pos:new V(),hp:100},null,1/60);
  }).catch(e=>{f.modelStatus='error';console.error('No se pudo cargar '+key+':',e);});
}
