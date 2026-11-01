// gen-sample.mjs — deterministic closed meshes; run twice => identical bytes.
import { writeFileSync, readFileSync, mkdirSync, rmSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { signedVolume, surfaceArea, mcVolume } from '../src/core.mjs';
const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, '..', 'data');
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const scl=(s,a)=>[s*a[0],s*a[1],s*a[2]];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];

// Push triangle [ia,ib,ic] so outward normal faces away from center.
// verts is the growing vertex list (index -> point).
function pushOut(center, verts, ia, ib, ic, tris){
  const pa=verts[ia], pb=verts[ib], pc=verts[ic];
  const nv = cross(sub(pb,pa), sub(pc,pa));
  const cent = scl(1/3, add(add(pa,pb),pc));
  if (dot(sub(cent,center), nv) >= 0) tris.push([ia,ib,ic]);
  else tris.push([ib,ia,ic]);
}

function genSphere(nlon, nlat){
  const center=[0,0,0]; const verts=[]; const tris=[];
  verts.push([0,-1,0]);
  const ring=[];
  for(let j=0;j<nlat-1;j++){
    const phi=(j+1)/nlat*Math.PI - Math.PI/2;
    ring[j]=[];
    for(let i=0;i<nlon;i++){
      const th=i/nlon*2*Math.PI;
      verts.push([Math.cos(phi)*Math.cos(th), Math.sin(phi), Math.cos(phi)*Math.sin(th)]);
      ring[j][i]=verts.length-1;
    }
  }
  const northIdx=verts.length; verts.push([0,1,0]);
  const sIdx=0;
  for(let i=0;i<nlon;i++) pushOut(center, verts, sIdx, ring[0][i], ring[0][(i+1)%nlon], tris);
  for(let j=0;j<nlat-2;j++)
    for(let i=0;i<nlon;i++){
      pushOut(center,verts, ring[j][i], ring[j+1][i], ring[j+1][(i+1)%nlon], tris);
      pushOut(center,verts, ring[j+1][(i+1)%nlon], ring[j][i], ring[j][(i+1)%nlon], tris);
    }
  for(let i=0;i<nlon;i++) pushOut(center, verts, northIdx, ring[nlat-2][i], ring[nlat-2][(i+1)%nlon], tris);
  return {name:'sphere', R:1, analyticV:(4/3)*Math.PI, analyticA:4*Math.PI, verts:verts.flat(), tris, nv:verts.length, nt:tris.length};
}

function genTorus(n){
  const R=2, r=0.7; const verts=[]; const tris=[]; const idx=[];
  const tubeCenter=[];
  for(let u=0;u<n;u++){ idx[u]=[];
    for(let vv=0;vv<n;vv++){
      const U=u/n*2*Math.PI, V=vv/n*2*Math.PI;
      verts.push([(R+r*Math.cos(V))*Math.cos(U), (R+r*Math.cos(V))*Math.sin(U), r*Math.sin(V)]);
      idx[u][vv]=verts.length-1;
    }
  }
  const pushOutTube=(ia,ib,ic)=>{
    // outward = away from the tube centerline. The tube centerline at longitude U is
    // at distance R from the axis; the outward radial is (cos V cos U, cos V sin U, sin V)
    // relative to the tube center point. Compute via the unique U of the first tri vertex.
    const pa=verts[ia];
    const U=Math.atan2(pa[1],pa[0]);
    // tube direction t = (cosV cosU, cosV sinU, sinV) using U; sign normalization arbitrary
    // A robust proxy: outward = normalized( p - axisProjection ), where axisProjection pulls p
    // down to the tube centerline (distance R from axis at height 0). 
    const ax=Math.cos(U), ay=Math.sin(U);
    // projection of p onto the tube centerline = (R*ax, R*ay, 0)
    const pb=verts[ib],pc=verts[ic];
    const nv=cross(sub(pb,pa),sub(pc,pa));
    const cent=scl(1/3,add(add(pa,pb),pc));
    const outVec=sub(cent,[R*ax,R*ay,0]);
    if(dot(outVec,nv)>=0) tris.push([ia,ib,ic]); else tris.push([ib,ia,ic]);
  };
  for(let u=0;u<n;u++)for(let v=0;v<n;v++){
    const a=idx[u][v], b=idx[(u+1)%n][v], c=idx[(u+1)%n][(v+1)%n], d=idx[u][(v+1)%n];
    pushOutTube(a,c,b);
    pushOutTube(c,a,d);
  }
  const V=2*Math.PI*Math.PI*R*r*r, A=4*Math.PI*Math.PI*R*r;
  return {name:'torus', R, r, analyticV:V, analyticA:A, verts:verts.flat(), tris, nv:verts.length, nt:tris.length};
}

function genCube(){
  const pts=[[-0.5,-0.5,-0.5],[0.5,-0.5,-0.5],[0.5,0.5,-0.5],[-0.5,0.5,-0.5],[-0.5,-0.5,0.5],[0.5,-0.5,0.5],[0.5,0.5,0.5],[-0.5,0.5,0.5]];
  const center=[0,0,0]; const tris=[];
  const faces=[[0,1,2,3],[4,5,6,7],[0,1,5,4],[3,2,6,7],[0,3,7,4],[1,2,6,5]];
  for(const f of faces){ pushOut(center, pts, f[0], f[1], f[2], tris); pushOut(center, pts, f[0], f[2], f[3], tris); }
  return {name:'cube', edge:1, analyticV:1, analyticA:6, verts:pts.flat(), tris, nv:8, nt:tris.length};
}

function write(o){ writeFileSync(join(dataDir,o.name+'.json'), JSON.stringify(o)+'\n'); }
const LEVELS=[1000,2500,5000,10000,20000,40000];
function bakeReference(){
  const out={};
  for(const name of ['cube','sphere','torus']){
    const m=JSON.parse(readFileSync(join(dataDir,name+'.json'),'utf8'));
    out[name]={ exactVolume:signedVolume(m.verts,m.tris), surfaceArea:surfaceArea(m.verts,m.tris),
      mc: Object.fromEntries(LEVELS.map(N=>[String(N), mcVolume(m.verts,m.tris,N,777).vol])) };
  }
  writeFileSync(join(dataDir,'reference.json'), JSON.stringify(out,null,2)+'\n');
}
function main(){
  rmSync(dataDir,{recursive:true,force:true}); mkdirSync(dataDir,{recursive:true});
  write(genSphere(60,30));
  write(genTorus(48));
  write(genCube());
  bakeReference();
  console.log("done");
}
main();
