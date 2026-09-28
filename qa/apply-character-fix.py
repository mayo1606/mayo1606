"""Apply the character integration fix with guarded, idempotent replacements."""
from pathlib import Path
root = Path(__file__).resolve().parents[1]
block = (root / 'qa/character-v2.inc.js').read_text()
for filename in ['index.html', 'juego.html']:
    p = root / 'goku-alianzas-z' / filename
    s = p.read_text()
    if 'Character integration v2:' in s:
        continue
    def replace(old, new, label):
        global s
        if old not in s:
            raise RuntimeError('Missing anchor ' + label + ' in ' + filename)
        s = s.replace(old, new, 1)
    replace('<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/FBXLoader.js"></script>', '<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/libs/fflate.min.js"></script>\n<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/FBXLoader.js"></script>', 'FBX dependency')
    start = s.index('const MODEL_FILES = {')
    end = s.index('\nconst LOOKS = {', start)
    s = s[:start] + block + '\n' + s[end:]
    replace('  for (const mixer of externalMixers) mixer.update(dt);', '  // Character mixers advance only from pose(), never while paused or hidden.', 'pause mixers')
    old = '''function removeFighter(f) {
  if (!f) return;
  if (f.mixer) externalMixers.delete(f.mixer);
  scene.remove(f.g); scene.remove(f.shadow);
}'''
    new = '''function removeFighter(f) {
  if (!f || f.disposed) return;
  f.disposed = true;
  if (f.mixer) { f.mixer.stopAllAction(); f.mixer.uncacheRoot(f.mixer.getRoot()); externalMixers.delete(f.mixer); }
  for (const m of new Set(f.mats)) m.dispose();
  scene.remove(f.g); scene.remove(f.shadow);
}'''
    replace(old, new, 'dispose')
    start = s.index('function pose(o, target, move, dt) {')
    end = s.index('/* ---------- Bucle de juego', start)
    pose = s[start:end].replace('o.dead', 'dead')
    pose = pose.replace('const f = o.f, t = G.t;', 'const f = o.f, t = G.t, dead = !!o.dead || o.hp === 0;')
    pose = pose.replace('const pitch = dead ? -0.3 : (flying ? 0.4 : 0.1) * mz + lunge - f.hurt * 3;', 'const pitch = dead ? -0.3 : (f.external ? (flying ? 0.12 : 0.03) * mz + lunge * 0.15 - f.hurt * 0.5 : (flying ? 0.4 : 0.1) * mz + lunge - f.hurt * 3);')
    pose = pose.replace('const roll = dead ? Math.PI / 2 : -(flying ? 0.35 : 0.1) * mx;', 'const roll = dead ? Math.PI / 2 : -(f.external ? (flying ? 0.12 : 0.025) : (flying ? 0.35 : 0.1)) * mx;')
    pose = pose.replace('f.shadow.material.opacity = 0.35 * s;', 'f.shadow.material.opacity = 0.35 * s;\n  if (f.external) updateExternal(f, o, move, dt);')
    s = s[:start] + pose + s[end:]
    old = "titleF.forEach((f, i) => { f.g.position.y = 0.6 + Math.sin(G.t * 2 + i) * 0.25; f.aura.material.opacity = 0.18; f.aura.material.color.setHex(i ? 0xfff27a : 0xffe066); });"
    new = "titleF.forEach((f, i) => { f.g.position.y = 0.6 + Math.sin(G.t * 2 + i) * 0.12; f.aura.material.opacity = 0.18; f.aura.material.color.setHex(i ? 0xfff27a : 0xffe066); if (f.external) updateExternal(f, {pos:f.g.position, hp:100}, null, dt); });"
    replace(old, new, 'title animations')
    p.write_text(s)
mtl = root / 'goku-alianzas-z/assets/models/buu/22.mtl'
mtl.write_text(mtl.read_text().replace('map_Kd 22.jpg', 'map_Kd 223.jpg'))
