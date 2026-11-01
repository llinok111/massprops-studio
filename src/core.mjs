// core.mjs — exact + Monte-Carlo mass properties of a closed triangle mesh.
// Input convention: verts = Float32Array/Array of [x,y,z,...] (length 3*nv),
// tris = Array of triangles, each triangle = [i0,i1,i2] vertex indices.
// IMPORTANT: deterministic, no window/document/three, node-runnable (G3 clean).

// Exact signed volume via divergence theorem: V = (1/6) sum over tris of a·(b×c).
// Closed, consistently-oriented mesh => |signedVolume| = true enclosed volume.
export function signedVolume(verts, tris) {
  let v6 = 0;
  for (let i = 0; i < tris.length; i++) {
    const t = tris[i];
    const ax = verts[3*t[0]], ay = verts[3*t[0]+1], az = verts[3*t[0]+2];
    const bx = verts[3*t[1]], by = verts[3*t[1]+1], bz = verts[3*t[1]+2];
    const cx = verts[3*t[2]], cy = verts[3*t[2]+1], cz = verts[3*t[2]+2];
    // a · (b × c) as scalar triple product (determinant)
    const det = ax*(by*cz - bz*cy) - ay*(bx*cz - bz*cx) + az*(bx*cy - by*cx);
    v6 += det;
  }
  return v6 / 6.0;
}

// Total surface area via sum of triangle areas.
export function surfaceArea(verts, tris) {
  let area = 0;
  for (let i = 0; i < tris.length; i++) {
    const t = tris[i];
    const ax = verts[3*t[0]], ay = verts[3*t[0]+1], az = verts[3*t[0]+2];
    const bx = verts[3*t[1]], by = verts[3*t[1]+1], bz = verts[3*t[1]+2];
    const cx = verts[3*t[2]], cy = verts[3*t[2]+1], cz = verts[3*t[2]+2];
    const ux = bx-ax, uy = by-ay, uz = bz-az;
    const vx = cx-ax, vy = cy-ay, vz = cz-az;
    const px = uy*vz - uz*vy;
    const py = uz*vx - ux*vz;
    const pz = ux*vy - uy*vx;
    area += 0.5 * Math.sqrt(px*px + py*py + pz*pz);
  }
  return area;
}

// Axis-aligned bounding box of the mesh.
export function boundingBox(verts) {
  let minx=Infinity,miny=Infinity,minz=Infinity,maxx=-Infinity,maxy=-Infinity,maxz=-Infinity;
  for (let i = 0; i < verts.length; i+=3) {
    const x=verts[i], y=verts[i+1], z=verts[i+2];
    if (x<minx) minx=x; if (x>maxx) maxx=x;
    if (y<miny) miny=y; if (y>maxy) maxy=y;
    if (z<minz) minz=z; if (z>maxz) maxz=z;
  }
  return { minx, miny, minz, maxx, maxy, maxz };
}

// Deterministic PRNG so node and browser agree bit-for-bit.
// Mulberry32 — a compact, well-characterized 32-bit PRNG yielding uniform [0,1).
export function makeRng(seed) {
  let a = (seed >>> 0) || 0x1a2b3c4d;
  return function() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Generic, non-axis-aligned ray direction (irrational-ish components) so the ray
// almost never aligns with mesh faces/edges for the even-odd inside test. This
// avoids the pathological double-counting that axis-aligned rays hit on coplanar
// exit faces. Kept as a fixed constant so node and browser agree bit-for-bit.
const RAY_DIR = [0.610343243, -0.5532964312, 0.566879432]; // arbitrary, |d|≈1

// Möller–Trumbore ray/triangle with strict interior counting.
// Returns true if the ray from o in RAY_DIR hits the interior of triangle (a,b,c)
// at t>eps and strictly inside (u,v>eps, u+v<1-eps).
function rayTri(dx,dy,dz, ax,ay,az, bx,by,bz, cx,cy,cz, ox,oy,oz) {
  const e1x = bx-ax, e1y = by-ay, e1z = bz-az;
  const e2x = cx-ax, e2y = cy-ay, e2z = cz-az;
  const Px = dy*e2z - dz*e2y;
  const Py = dz*e2x - dx*e2z;
  const Pz = dx*e2y - dy*e2x;
  const det = Px*e1x + Py*e1y + Pz*e1z;
  if (Math.abs(det) < 1e-14) return false;      // parallel
  const inv = 1.0/det;
  const Tx = ox-ax, Ty = oy-ay, Tz = oz-az;
  const u = (Tx*Px + Ty*Py + Tz*Pz) * inv;
  const EPS = 1e-7;
  if (u < EPS || u > 1-EPS) return false;
  const Qx = Ty*e1z - Tz*e1y;
  const Qy = Tz*e1x - Tx*e1z;
  const Qz = Tx*e1y - Ty*e1x;
  const v = (dx*Qx + dy*Qy + dz*Qz) * inv;
  if (v < EPS || u+v > 1-EPS) return false;
  const t = (e2x*Qx + e2y*Qy + e2z*Qz) * inv;
  return t > 1e-7;
}

export function insideMesh(verts, tris, p) {
  const ox=p[0], oy=p[1], oz=p[2];
  const dx=RAY_DIR[0], dy=RAY_DIR[1], dz=RAY_DIR[2];
  let count = 0;
  for (let i = 0; i < tris.length; i++) {
    const t = tris[i];
    const ax = verts[3*t[0]], ay = verts[3*t[0]+1], az = verts[3*t[0]+2];
    const bx = verts[3*t[1]], by = verts[3*t[1]+1], bz = verts[3*t[1]+2];
    const cx = verts[3*t[2]], cy = verts[3*t[2]+1], cz = verts[3*t[2]+2];
    if (rayTri(dx,dy,dz, ax,ay,az,bx,by,bz,cx,cy,cz, ox,oy,oz)) count++;
  }
  return (count & 1) === 1;
}

// Monte-Carlo volume: sample box uniformly, ratio of interior * box volume.
// Returns expected value with a Bernoulli SE = sqrt(p(1-p)/N) scaled by box volume.
export function mcVolume(verts, tris, N, seed, dirIndex=0) {
  const box = boundingBox(verts);
  const bw = box.maxx-box.minx, bh = box.maxy-box.miny, bd = box.maxz-box.minz;
  const boxVol = bw*bh*bd;
  const rng = makeRng(seed);
  let hit = 0;
  for (let i = 0; i < N; i++) {
    const p = [box.minx + rng()*bw, box.miny + rng()*bh, box.minz + rng()*bd];
    if (insideMesh(verts, tris, p, dirIndex)) hit++;
  }
  const f = hit / N;
  const vol = f * boxVol;
  const se = Math.sqrt((f*(1-f))/N) * boxVol;
  return { vol, f, hit, N, se, boxVol };
}

// Run exact + MC at several sample counts; return table. Deterministic for given seed.
export function scan(verts, tris, sampleLevels, seed) {
  const Vexact = signedVolume(verts, tris);
  const absV = Math.abs(Vexact);
  const A = surfaceArea(verts, tris);
  const box = boundingBox(verts);
  return sampleLevels.map(N => {
    const mc = mcVolume(verts, tris, N, seed);
    // relative error vs |signedVolume| (the "truth", exact within double rounding)
    const relErr = absV > 0 ? Math.abs(mc.vol - absV) / absV : NaN;
    // scaled SE in units of V
    const relSE = absV > 0 ? mc.se / absV : NaN;
    return { N, mcV: mc.vol, relErr, relSE, f: mc.f, boxVol: mc.boxVol };
  });
}