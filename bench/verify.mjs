// bench/verify.mjs — hard assertions over the exact core + baseline. exit 0 iff all pass.
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { signedVolume, surfaceArea, insideMesh, mcVolume, boundingBox } from '../src/core.mjs';
import { voxelVolume } from '../baseline/naive.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const load = n => JSON.parse(readFileSync(join(here, '..', 'data', n + '.json'), 'utf8'));

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`  PASS  ${name}${detail ? '  [' + detail + ']' : ''}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? '  [' + detail + ']' : ''}`); }
}
function near(a,b,tol){ return Math.abs(a-b) <= tol; }

console.log('== exact divergence-theorem mass properties vs analytic ==');
const cube = load('cube');
const Vc = signedVolume(cube.verts, cube.tris);
const Ac = surfaceArea(cube.verts, cube.tris);
check('cube volume 1.0 exact', near(Vc, 1, 1e-12), `V=${Vc}`);
check('cube area 6.0 exact', near(Ac, 6, 1e-12), `A=${Ac}`);

const sph = load('sphere');
const Vs = signedVolume(sph.verts, sph.tris);
const As = surfaceArea(sph.verts, sph.tris);
const Vse = 100 * Math.abs(Vs - sph.analyticV) / sph.analyticV;
const Ase = 100 * Math.abs(As - sph.analyticA) / sph.analyticA;
check('sphere V within 1% of 4/3π', Vse < 1.0, `V=${Vs.toFixed(6)} err=${Vse.toFixed(4)}%`);
check('sphere A within 1% of 4π', Ase < 1.0, `A=${As.toFixed(6)} err=${Ase.toFixed(4)}%`);
check('sphere orientation positive (outward)', Vs > 0, `V=${Vs.toFixed(6)}`);

const tor = load('torus');
const Vt = signedVolume(tor.verts, tor.tris);
const Ate = 100 * Math.abs(surfaceArea(tor.verts, tor.tris) - tor.analyticA) / tor.analyticA;
const Vte = 100 * Math.abs(Vt - tor.analyticV) / tor.analyticV;
check('torus V within 1% of 2π²Rr²', Vte < 1.0, `V=${Vt.toFixed(6)} err=${Vte.toFixed(4)}%`);
check('torus A within 1% of 4π²Rr', Ate < 1.0, `A err=${Ate.toFixed(4)}%`);

console.log('== inside/outside classification (analytic sphere membership) ==');
// deterministic pseudo-random points via a small LCG (independent of core RNG)
let seed = 12345;
const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
let agree = 0, total = 3000;
for (let i = 0; i < total; i++) {
  const p = [(rnd()*2-1)*1.4, (rnd()*2-1)*1.4, (rnd()*2-1)*1.4];
  const truth = Math.sqrt(p[0]*p[0]+p[1]*p[1]+p[2]*p[2]) < 1.0;
  const got = insideMesh(sph.verts, sph.tris, p);
  if (truth === got) agree++;
}
check('sphere inside test agreement >= 99.5%', agree/total >= 0.995, `${agree}/${total}=${(100*agree/total).toFixed(2)}%`);

console.log('== Monte-Carlo independent cross-check vs exact faceted volume ==');
const Vabs = Math.abs(Vs);
let worst = 0;
for (const N of [10000, 40000]) {
  const mc = mcVolume(sph.verts, sph.tris, N, 777);
  const z = Math.abs(mc.vol - Vabs) / mc.se;   // standardized residual (should be O(1))
  worst = Math.max(worst, z);
  check(`MC N=${N} within 4 SE of exact`, z <= 4.0, `vol=${mc.vol.toFixed(4)} se=${mc.se.toFixed(4)} |z|=${z.toFixed(2)}`);
}
check('MC se follows 1/sqrt(N): se(10k)/se(40k) ~ 2', (() => {
  const a = mcVolume(sph.verts, sph.tris, 10000, 777).se;
  const b = mcVolume(sph.verts, sph.tris, 40000, 777).se;
  return near(a/b, 2.0, 0.25);
})(), 'ratio within [1.75,2.25]');

console.log('== naive voxel baseline is strictly worse ==');
const vox32 = voxelVolume(sph.verts, sph.tris, 32);
const voxErr = 100 * Math.abs(vox32 - Vabs) / Vabs;
check('voxel res=32 error > exact error', voxErr > Vse, `voxel err=${voxErr.toFixed(2)}% vs exact ${Vse.toFixed(4)}%`);
check('voxel res=32 error > 0.5%', voxErr > 0.5, `voxel err=${voxErr.toFixed(2)}%`);

console.log('== determinism (same seed => identical result) ==');
const m1 = mcVolume(sph.verts, sph.tris, 5000, 4242);
const m2 = mcVolume(sph.verts, sph.tris, 5000, 4242);
check('MC bit-identical across runs', m1.vol === m2.vol && m1.hit === m2.hit, `vol=${m1.vol}`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
