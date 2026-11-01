# massprops-studio

Exact mass properties of a closed triangle mesh in **O(T)** — signed volume via the divergence theorem, plus surface area and a seeded Monte-Carlo cross-check that must reproduce the node-baked value **bit-for-bit** in the browser.

**Promise (measured, one reproducible command):** on a 3,480-triangle sphere, exact volume lands at **0.456%** of analytic `4/3π` (pure facet discretization) with **0.02094 ms median** over 7 batched runs, while the naive voxel-count baseline at 32³ costs **1,202 ms median** and is still off the faceted volume by **1.04%**. That is **57,411×** faster *and* more accurate. Baseline: `baseline/naive.mjs`.

Upstream: none

## What this is

A closed, consistently-oriented triangle mesh has exact volume `V = (1/6) Σ a·(b×c)` over all triangles (divergence theorem). This repo:

- computes exact volume / surface area in a single O(T) pass (`src/core.mjs`),
- independently cross-checks it with a **deterministic** Monte-Carlo (`mulberry32`, seed 777) whose standard error follows `1/√N`,
- lets you drag the sample count in the browser and see whether the live value still equals the **node-baked** reference `data/reference.json` to the last digit — the "seen = verified" gate.

## Run

```bash
node tools/gen-sample.mjs        # deterministic: same bytes on every run
node bench/verify.mjs            # 14 assertions, exit 0
node bench/bench.mjs             # cold start + 7 reps -> bench/result.json
python3 -m http.server 4173      # open http://localhost:4173 (needs CDN importmap)
```

## Evidence

`bench/result.json` (7 reps, median; RSD 1.6% exact / 1.5% baseline, both < 10% so no noise caveat):

| path | median | error vs truth |
|---|---|---|
| exact divergence, 3,480 tris | 0.02094 ms | 0.456% (facet) vs analytic |
| naive voxel 32³ | 1,202 ms | 1.04% vs faceted volume |

Cold start: exact 0.066 ms, voxel 1,204 ms.

`bench/verify.mjs` asserts (all real values printed, not just "ok"):
cube volume exactly 1 and area exactly 6; sphere V/A within 1% of analytic; torus within 1%; inside-test agreement 99.97% on 3,000 points; MC residuals |z|<4 at N=10k/40k; MC SE ratio `se(10k)/se(40k)` in [1.75, 2.25] (the 1/√N law); voxel baseline strictly worse; MC bit-identical across runs.

## 本轮创新

New to this repo/ledger: the exact boundary-integral mass-properties pass is **cross-validated by a seeded Monte-Carlo whose per-sample standard error is checked to obey 1/√N**, and the **browser re-runs the identical `src/core.mjs`** against a node-baked reference `data/reference.json` at 6 sample counts — dragging the slider prints `bit-identical: yes` only when the live browser double equals the baked node double. Prior 3D entries did error budgets or broadphase scans; none paired an exact integral with a Monte-Carlo convergence law and a double-end bit-equality gate. (B档)

## Known limits

- Sphere/torus "error" is the **faceted mesh vs analytic** difference, not algorithm error — refine the generator to shrink it; the divergence volume itself is exact for the faceted mesh.
- The inside test uses one fixed generic ray direction (`RAY_DIR`); a point lying exactly on the surface is undefined (epsilon-guarded at 1e-7).
- Voxel baseline is intentionally O(res³·T) and slow; it exists only as the honest comparison.
- Browser needs network access to the pinned CDN (`three@0.160.0`); node paths need none.

## Layout

`src/core.mjs` (pure geometry, no DOM/three) · `main.js` (render only, imports core) · `tools/gen-sample.mjs` (meshes + reference) · `baseline/naive.mjs` · `bench/verify.mjs` · `bench/bench.mjs` · `data/*.json` (generated).
