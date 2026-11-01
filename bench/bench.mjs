// bench/bench.mjs — cold start + >=5 repeats; writes bench/result.json with
// min/median/p95/stddev for exact volume/area, MC at N, and naive voxel baseline.
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { signedVolume, surfaceArea, mcVolume } from '../src/core.mjs';
import { voxelVolume } from '../baseline/naive.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const load = n => JSON.parse(readFileSync(join(here, '..', 'data', n + '.json'), 'utf8'));
const sph = load('sphere');
const Vexact = Math.abs(signedVolume(sph.verts, sph.tris));

function stats(arr) {
  const s = [...arr].sort((a,b)=>a-b);
  const n = s.length;
  const median = n % 2 ? s[(n-1)/2] : (s[n/2-1]+s[n/2])/2;
  const p95 = s[Math.min(n-1, Math.ceil(0.95*n)-1)];
  const mean = arr.reduce((a,b)=>a+b,0)/n;
  const sd = Math.sqrt(arr.reduce((a,b)=>a+(b-mean)*(b-mean),0)/n);
  return { min: s[0], median, p95, mean, stddev: sd, rsd: mean ? sd/mean*100 : 0, n };
}

function timeIt(fn, reps) {
  const times = [];
  for (let i = 0; i < reps; i++) { const t0 = performance.now(); fn(); times.push(performance.now()-t0); }
  return stats(times);
}

// cold start (first call, includes JIT)
let t0 = performance.now();
signedVolume(sph.verts, sph.tris);
const cold_exact = performance.now() - t0;

t0 = performance.now();
voxelVolume(sph.verts, sph.tris, 32);
const cold_voxel = performance.now() - t0;

const reps = 7;
// Batch tiny exact ops so they exceed timer resolution (RSD stays low).
const BATCH = 2000;
const exactV = timeIt(() => { for (let i=0;i<BATCH;i++) signedVolume(sph.verts, sph.tris); }, reps);
for (const k of ['min','median','p95','mean']) exactV[k] /= BATCH; exactV.stddev/=BATCH; exactV.rsd=exactV.mean?exactV.stddev/exactV.mean*100:0; exactV.batch=BATCH;
const exactA = timeIt(() => { for (let i=0;i<BATCH;i++) surfaceArea(sph.verts, sph.tris); }, reps);
for (const k of ['min','median','p95','mean']) exactA[k] /= BATCH; exactA.stddev/=BATCH; exactA.rsd=exactA.mean?exactA.stddev/exactA.mean*100:0; exactA.batch=BATCH;
const mc10k  = timeIt(() => mcVolume(sph.verts, sph.tris, 10000, 777), 5);
const mc40k  = timeIt(() => mcVolume(sph.verts, sph.tris, 40000, 777), 5);
const voxel32 = timeIt(() => voxelVolume(sph.verts, sph.tris, 32), 5);

const vox32 = voxelVolume(sph.verts, sph.tris, 32);
const voxErrPct = 100 * Math.abs(vox32 - Vexact) / Vexact;
const exactErrPct = 0; // cube-exact; sphere facet error vs analytic is task-level, see verify

const result = {
  date: new Date().toISOString(),
  mesh: { name: 'sphere', verts: sph.nv, tris: sph.nt, analyticV: sph.analyticV },
  exactVolume: Vexact,
  cold_start_ms: { exact_volume: cold_exact, voxel_baseline_res32: cold_voxel },
  exact_volume_ms: exactV,
  exact_area_ms: exactA,
  mc_10k_ms: mc10k,
  mc_40k_ms: mc40k,
  voxel_baseline_res32_ms: voxel32,
  error: {
    exact_vs_analytic_pct: 100*Math.abs(Vexact - sph.analyticV)/sph.analyticV,
    voxel_res32_vs_exact_pct: voxErrPct,
    speedup_voxel32_over_exact: voxel32.median / exactV.median,
  },
  note: 'times are wall-clock performance.now() on this VM; >5 reps median+p95; RSD explained in README',
};
writeFileSync(join(here, 'result.json'), JSON.stringify(result, null, 2)+'\n');
console.log(JSON.stringify(result, null, 2));
