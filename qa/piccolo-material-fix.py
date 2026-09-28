"""Correct the inspected Piccolo FBX's material assignments before generating HTML."""
from pathlib import Path
p = Path(__file__).resolve().parent / 'character-v2.inc.js'
s = p.read_text()
if 'piccoloClothing' not in s:
    def replace(old, new):
        global s
        if old not in s:
            raise RuntimeError('Missing material patch anchor: ' + old)
        s = s.replace(old, new, 1)
    replace('  return {scene,animations,diffuse};', """  const piccoloClothing=key==='piccolo'?await promiseLoad(textureLoader,'assets/models/piccolo/piccolo_gi_d.png'):null;
  if(piccoloClothing){piccoloClothing.encoding=THREE.sRGBEncoding;piccoloClothing.wrapS=piccoloClothing.wrapT=THREE.RepeatWrapping;piccoloClothing.anisotropy=4;}
  return {scene,animations,diffuse,piccoloClothing};""")
    replace('function toonifyExternal(root,targetMats,key,diffuse){', 'function toonifyExternal(root,targetMats,key,diffuse,piccoloClothing){')
    replace('    if(!o.isMesh)return;\n    o.frustumCulled=false;', """    if(!o.isMesh)return;
    // This surface duplicates exactly 33,043 body triangles, with incompatible UVs.
    // It is NOT an outline shell: its normals and positions duplicate the original parts.
    if(key==='piccolo'&&/mesh13008/.test(o.name)){o.visible=false;return;}
    const garment=key==='piccolo'&&/\\+40-mesh/.test(o.name);
    o.frustumCulled=false;""")
    replace('const map=outline?null:(diffuse||(m&&m.map)||null);', 'const map=outline?null:((garment&&piccoloClothing)||diffuse||(m&&m.map)||null);')
    replace('toonifyExternal(model,f.mats,key,asset.diffuse);', 'toonifyExternal(model,f.mats,key,asset.diffuse,asset.piccoloClothing);')
    p.write_text(s)
