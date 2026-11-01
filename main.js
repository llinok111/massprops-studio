// main.js — render layer only. All computation comes from src/core.mjs (identical to node).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { signedVolume, surfaceArea, mcVolume } from './src/core.mjs';

const $ = id => document.getElementById(id);
const view = $('view');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
view.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0e1116);
const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000);
camera.position.set(3.2, 2.4, 4.2);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
scene.add(new THREE.AmbientLight(0xffffff, 0.55));
const d1 = new THREE.DirectionalLight(0xffffff, 1.4); d1.position.set(4, 6, 5); scene.add(d1);
const d2 = new THREE.DirectionalLight(0x88aaff, 0.7); d2.position.set(-5, -3, -4); scene.add(d2);

let mesh = null, cur = null, ref = null;
const LEVELS = [1000, 2500, 5000, 10000, 20000, 40000];

function resize() {
  const w = view.clientWidth, h = view.clientHeight;
  renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener('resize', resize);

function buildGeometry(m) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(m.verts);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const idx = new Uint32Array(m.tris.length * 3);
  m.tris.forEach((t, i) => { idx[3*i] = t[0]; idx[3*i+1] = t[1]; idx[3*i+2] = t[2]; });
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

async function loadMesh(name) {
  const [m, r] = await Promise.all([
    fetch(`./data/${name}.json`).then(x => x.json()),
    fetch('./data/reference.json').then(x => x.json()),
  ]);
  cur = m; ref = r[name];
  if (mesh) { scene.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose(); }
  const geo = buildGeometry(m);
  const mat = new THREE.MeshStandardMaterial({ color: 0x58a6ff, roughness: 0.38, metalness: 0.15, flatShading: false, side: THREE.DoubleSide });
  mesh = new THREE.Mesh(geo, mat);
  scene.add(mesh);
  controls.target.set(0, 0, 0);
  const rad = geo.boundingSphere.radius;
  camera.position.set(rad*1.9, rad*1.4, rad*2.1);
  camera.near = rad/100; camera.far = rad*100; camera.updateProjectionMatrix();

  const vExact = signedVolume(m.verts, m.tris);
  const a = surfaceArea(m.verts, m.tris);
  $('vExact').textContent = vExact.toFixed(9);
  $('vArea').textContent = a.toFixed(6);
  $('tris').textContent = m.tris.length.toLocaleString();
  $('verts').textContent = m.nv.toLocaleString();
  $('vAn').textContent = m.analyticV.toFixed(9);
  updateMC();
}

function updateMC() {
  if (!cur) return;
  const N = LEVELS[+$('nsamples').value];
  $('nval').textContent = N.toLocaleString();
  const mc = mcVolume(cur.verts, cur.tris, N, 777);
  const baked = ref.mc[String(N)];
  const diff = baked === undefined ? NaN : Math.abs(mc.vol - baked);
  $('vMc').textContent = mc.vol.toFixed(12);
  $('vMcNode').textContent = baked === undefined ? '—' : baked.toFixed(12);
  $('vDiff').textContent = baked === undefined ? '—' : diff.toExponential(2);
  const bit = baked !== undefined && mc.vol === baked;
  $('vBit').textContent = baked === undefined ? 'n/a' : (bit ? 'yes' : 'NO');
  $('vBit').className = 'v mono ' + (baked === undefined ? '' : (bit ? 'ok' : 'bad'));
}

$('mesh').addEventListener('change', e => loadMesh(e.target.value));
$('nsamples').addEventListener('input', updateMC);

resize();
loadMesh('sphere').catch(err => {
  const el = document.createElement('div'); el.id='err'; el.textContent = 'load error: ' + err.message;
  view.appendChild(el);
});
renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
