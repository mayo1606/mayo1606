# Character model assets

The branch `chatgpt/real-models-v1` now loads the uploaded models in their original formats.

Expected layout:

- `goku/Goku Super Saiyan 3_1_.glb`
- `piccolo/DBFZ PICCOLO.fbx` plus its PNG textures
- `vegeta/Vegeta.fbx` plus `Vegeta.png`
- `frieza/Freeza.fbx`
- `cell/Cell Perfect.gltf`, `Cell Perfect.bin`, plus its PNG textures
- `buu/22.OBJ`, `22.mtl`, plus its JPG textures

Detected asset capabilities:

- Goku SSJ3: skinned GLB with 13 animations.
- Vegeta: rigged FBX with animation data.
- Piccolo: skinned/rigged FBX; no animation stack detected.
- Cell: glTF with one skin and no animations.
- Frieza: static FBX.
- Majin Buu: static OBJ.

The game supports GLTF/GLB, FBX and OBJ/MTL directly. It automatically normalizes model height, applies the project's toon materials, preserves aura/shadow/combat logic, and falls back to the procedural character if an asset is absent.

For Majin Buu, the downloaded MTL referenced a missing `22.bmp`; the prepared asset pack changes that diffuse reference to the supplied `22.jpg`.
