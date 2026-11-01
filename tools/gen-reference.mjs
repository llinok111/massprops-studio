// gen-reference.mjs — bake node-side exact + MC reference values the browser must match.
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { signedVolume, surfaceArea, mcVolume } from '../src/core.mjs';
const here = dirname(fileURLToPath(import.meta.url));
const D = join(here, '..', 'data');
const out = {};
for (const name of ['cube','sphere','torus']) {
  const m = JSON.parse(readFileSync(join(D, name+'.json'), 'utf8'));
  out[name] = {
    exactVolume: signedVolume(m.verts, m.tris),
    surfaceArea: surfaceArea(m.verts, m.tris),
    mc: { '10000': mcVolume(m.verts, m.tris, 10000, 777).vol,
          '40000': mcVolume(m.verts, m.tris, 40000, 777).vol },
  };
}
writeFileSync(join(D, 'reference.json'), JSON.stringify(out, null, 2)+'\n');
console.log('reference baked');
