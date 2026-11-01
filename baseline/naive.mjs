// baseline/naive.mjs — the "obvious" volumetric method we compare against:
// voxel-count volume (occupancy by center-in-mesh test). Error decays O(h).
// Run: node baseline/naive.mjs  (prints volume + error vs mesh signedVolume)
import { insideMesh } from '../src/core.mjs';

export function voxelVolume(verts, tris, res) {
  let minx=Infinity,miny=Infinity,minz=Infinity,maxx=-Infinity,maxy=-Infinity,maxz=-Infinity;
  for(let i=0;i<verts.length;i+=3){const x=verts[i],y=verts[i+1],z=verts[i+2];
    if(x<minx)minx=x;if(x>maxx)maxx=x;if(y<miny)miny=y;if(y>maxy)maxy=y;if(z<minz)minz=z;if(z>maxz)maxz=z;}
  const dx=(maxx-minx)/res, dy=(maxy-miny)/res, dz=(maxz-minz)/res;
  const cell=dx*dy*dz; let count=0;
  for(let i=0;i<res;i++)for(let j=0;j<res;j++)for(let k=0;k<res;k++){
    const p=[minx+(i+0.5)*dx, miny+(j+0.5)*dy, minz+(k+0.5)*dz];
    if(insideMesh(verts,tris,p)) count++;
  }
  return count*cell;
}
