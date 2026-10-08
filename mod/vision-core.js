/* Danscanner Pro · visión por computadora del escáner (v73)
 * Funciones puras, sin DOM: corren en el Worker de la cámara (mod/vision-worker.js),
 * en la página (pruebas, foto de galería) y en las pruebas automáticas.
 * Pipeline de detección (equivalente a OpenCV):
 *   gris → Gauss 5×5 → Canny(75,200) → dilatar 3×3 → componentes conectados (≈ findContours RETR_LIST)
 *   → envolvente convexa → approxPolyDP(0,02·perímetro) con 4 vértices → filtros (área, ángulos, convexo)
 *   → puntaje por área × bordes que de verdad acompañan los 4 lados.
 * La envolvente convexa (en lugar del contorno crudo) hace que un dedo o una sombra que muerden el borde
 * no rompan el cuadrilátero: el lado se "puentea" y el puntaje de bordes baja apenas.
 * Respaldo: si no hay bordes claros (hoja sin contraste en el borde) se usa la mancha clara más grande (Otsu). */
(function(G){
'use strict';

/* ---------- configuración: todos los parámetros ajustables en un solo lugar ---------- */
const VISION_CFG={
  analysisMaxSide:720,   // lado mayor del cuadro que se analiza (720p). Menos = más rápido y menos preciso
  blur:5,                // kernel gaussiano (5×5) antes de Canny: quita el grano del sensor
  cannyLo:75,cannyHi:200,// umbrales de Canny (magnitud L1 de Sobel, como OpenCV). Subirlos = menos bordes falsos
  minAreaFrac:0.20,      // la hoja debe ocupar al menos el 20 % del cuadro
  maxAreaFrac:0.985,     // y no ser el cuadro entero (eso es el borde de la imagen)
  approxEps:0.02,        // tolerancia de approxPolyDP = 0,02 × perímetro (se prueba hasta 0,08)
  minAngle:35,           // ángulos interiores entre 35° y 145°: admite hojas muy inclinadas (>45°) sin aceptar formas raras
  minSupport:0.45,       // al menos 45 % de los lados tienen borde real debajo (si no, era ruido o el fondo)
  minSideFrac:0.12,      // ningún lado menor al 12 % del lado mayor del cuadro
  everyN:1,              // detectar cada N cuadros (1 = todos los que el Worker llega a procesar)
  stableMs:300,          // el marco quieto más de 300 ms dispara el re-enfoque
  lowLuma:70,            // luminancia media (0-255) debajo de la cual hay poca luz → flash automático
  lowLumaOff:95,         // histéresis para apagarlo (evita que parpadee)
  blurMin:60,            // varianza del laplaciano mínima dentro de la hoja para auto-capturar (en el cuadro de análisis)
  blankStd:10,           // si la hoja casi no tiene contraste (está en blanco) no se bloquea por desenfoque
  minLongOut:2000,       // lado mayor mínimo del documento recortado (calidad para OCR)
  enhance:{claheClip:2.0,claheTiles:8,unsharpAmount:0.6,unsharpRadius:1,bnBlock:11,bnC:2}
};

/* ---------- utilidades geométricas (puras, con pruebas) ---------- */
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
/* Ordena 4 puntos como TL, TR, BR, BL (sentido horario en pantalla, y hacia abajo).
 * Se ordenan por ángulo alrededor del centro y se rota para que TL sea el de menor x+y:
 * funciona aunque la hoja esté girada más de 45°. */
function orderCorners(pts){
  if(!pts||pts.length!==4)throw new Error('orderCorners: se esperaban 4 puntos');
  const cx=(pts[0].x+pts[1].x+pts[2].x+pts[3].x)/4,cy=(pts[0].y+pts[1].y+pts[2].y+pts[3].y)/4;
  const s=pts.map(p=>({x:p.x,y:p.y,a:Math.atan2(p.y-cy,p.x-cx)})).sort((a,b)=>a.a-b.a);
  let k=0;for(let i=1;i<4;i++)if(s[i].x+s[i].y<s[k].x+s[k].y)k=i;
  const o=[];for(let i=0;i<4;i++){const p=s[(k+i)%4];o.push({x:p.x,y:p.y})}
  return o;
}
/* Tamaño de destino: el mayor de los lados opuestos (distancia euclídea), escalado para que
 * el lado mayor tenga al menos minLong px (y nunca más que maxLong). q en píxeles, ordenado TL,TR,BR,BL. */
function destSize(q,minLong,maxLong){
  const w=Math.max(dist(q[0],q[1]),dist(q[3],q[2])),h=Math.max(dist(q[0],q[3]),dist(q[1],q[2]));
  if(!(w>0&&h>0))throw new Error('destSize: cuadrilátero degenerado');
  let s=1;const L=Math.max(w,h);if(minLong&&L<minLong)s=minLong/L;if(maxLong&&L*s>maxLong)s=maxLong/L;
  return {w:Math.round(w*s),h:Math.round(h*s)};
}
function polyArea(q){let a=0;for(let i=0;i<q.length;i++){const p=q[i],r=q[(i+1)%q.length];a+=p.x*r.y-r.x*p.y}return Math.abs(a)/2}
function isConvex(q){let sg=0;for(let i=0;i<q.length;i++){const a=q[i],b=q[(i+1)%q.length],c=q[(i+2)%q.length];const z=(b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x);if(Math.abs(z)<1e-9)return false;const s=z>0?1:-1;if(!sg)sg=s;else if(s!==sg)return false}return true}
function angles(q){const r=[];for(let i=0;i<4;i++){const p=q[(i+3)%4],c=q[i],n=q[(i+1)%4];const ax=p.x-c.x,ay=p.y-c.y,bx=n.x-c.x,by=n.y-c.y;r.push(Math.acos(Math.max(-1,Math.min(1,(ax*bx+ay*by)/(Math.hypot(ax,ay)*Math.hypot(bx,by)||1))))*180/Math.PI)}return r}

/* ---------- imagen: gris, Gauss, Laplaciano ---------- */
function toGray(rgba,n,out){out=out||new Uint8Array(n);for(let i=0,j=0;i<n;i++,j+=4)out[i]=(rgba[j]*77+rgba[j+1]*150+rgba[j+2]*29)>>8;return out}
/* Gauss 5×5 separable [1 4 6 4 1]/16 con bordes replicados. tmp y out se reusan entre cuadros */
function gauss5(g,w,h,tmp,out){
  tmp=tmp||new Uint16Array(w*h);out=out||new Uint8Array(w*h);
  for(let y=0;y<h;y++){const r=y*w;for(let x=0;x<w;x++){const a=x<2?0:x-2,b=x<1?0:x-1,c=x>w-2?w-1:x+1,d=x>w-3?w-1:x+2;tmp[r+x]=g[r+a]+4*g[r+b]+6*g[r+x]+4*g[r+c]+g[r+d]}}
  for(let y=0;y<h;y++){const a=(y<2?0:y-2)*w,b=(y<1?0:y-1)*w,c=(y>h-2?h-1:y+1)*w,d=(y>h-3?h-1:y+2)*w,r=y*w;for(let x=0;x<w;x++)out[r+x]=(tmp[a+x]+4*tmp[b+x]+6*tmp[r+x]+4*tmp[c+x]+tmp[d+x]+128)>>8}
  return out;
}
/* Varianza del Laplaciano (medida clásica de nitidez) en un rectángulo [x0,y0,x1,y1) del gris.
 * Devuelve también el desvío estándar del gris para saber si la zona está en blanco. */
function blurScore(g,w,h,x0,y0,x1,y1){
  x0=Math.max(1,x0|0);y0=Math.max(1,y0|0);x1=Math.min(w-1,x1|0);y1=Math.min(h-1,y1|0);
  let n=0,s=0,s2=0,m=0,m2=0;
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const i=y*w+x,v=g[i],l=4*v-g[i-1]-g[i+1]-g[i-w]-g[i+w];s+=l;s2+=l*l;m+=v;m2+=v*v;n++}
  if(!n)return {lapVar:0,std:0};
  const mu=s/n,mg=m/n;return {lapVar:s2/n-mu*mu,std:Math.sqrt(Math.max(0,m2/n-mg*mg))};
}
function lumaStats(g,n){const H=new Uint32Array(256);let s=0;for(let i=0;i<n;i++){H[g[i]]++;s+=g[i]}let a=0,p5=0,p95=255;for(let v=0;v<256;v++){a+=H[v];if(a<n*.05)p5=v;if(a<n*.95)p95=v}return {mean:s/n,p5,p95,hist:H}}

/* ---------- Canny (Sobel L1, supresión de no máximos, histéresis) ---------- */
function canny(g,w,h,lo,hi,B){
  const n=w*h;B=B||{};
  const mag=B.mag&&B.mag.length===n?B.mag:(B.mag=new Int32Array(n));
  const dir=B.dir&&B.dir.length===n?B.dir:(B.dir=new Uint8Array(n));
  const out=B.edge&&B.edge.length===n?B.edge:(B.edge=new Uint8Array(n));
  const st=B.stack&&B.stack.length===n?B.stack:(B.stack=new Int32Array(n));
  mag.fill(0);out.fill(0);
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=y*w+x;
    const gx=(g[i-w+1]+2*g[i+1]+g[i+w+1])-(g[i-w-1]+2*g[i-1]+g[i+w-1]);
    const gy=(g[i+w-1]+2*g[i+w]+g[i+w+1])-(g[i-w-1]+2*g[i-w]+g[i-w+1]);
    const ax=gx<0?-gx:gx,ay=gy<0?-gy:gy;mag[i]=ax+ay;
    // dirección cuantizada: 0 horizontal, 1 diagonal /, 2 vertical, 3 diagonal \  (tan 22,5° ≈ 0,4142)
    dir[i]=ay*2.4142<ax?0:ax*2.4142<ay?2:((gx^gy)<0?1:3)}
  let sp=0;
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=y*w+x,m=mag[i];if(m<=lo)continue;let a,b;
    switch(dir[i]){case 0:a=mag[i-1];b=mag[i+1];break;case 2:a=mag[i-w];b=mag[i+w];break;case 1:a=mag[i-w+1];b=mag[i+w-1];break;default:a=mag[i-w-1];b=mag[i+w+1]}
    if(m>=a&&m>b){out[i]=1;if(m>hi){out[i]=2;st[sp++]=i}}}
  while(sp){const i=st[--sp];for(const o of [-w-1,-w,-w+1,-1,1,w-1,w,w+1]){const k=i+o;if(out[k]===1){out[k]=2;st[sp++]=k}}}
  for(let i=0;i<n;i++)out[i]=out[i]===2?1:0;
  return out;
}
function dilate3(e,w,h,out){out=out||new Uint8Array(w*h);out.fill(0);for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=y*w+x;if(e[i]){out[i-w-1]=out[i-w]=out[i-w+1]=out[i-1]=out[i]=out[i+1]=out[i+w-1]=out[i+w]=out[i+w+1]=1}}return out}

/* ---------- envolvente convexa y approxPolyDP ---------- */
function convexHull(P){if(P.length<3)return P.slice();P=P.slice().sort((a,b)=>a.x-b.x||a.y-b.y);const cr=(o,a,b)=>(a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x);const lo=[],up=[];
  for(const p of P){while(lo.length>=2&&cr(lo[lo.length-2],lo[lo.length-1],p)<=0)lo.pop();lo.push(p)}
  for(let i=P.length-1;i>=0;i--){const p=P[i];while(up.length>=2&&cr(up[up.length-2],up[up.length-1],p)<=0)up.pop();up.push(p)}
  lo.pop();up.pop();return lo.concat(up)}
function dpOpen(P,eps,a,b,keep){let mx=0,k=-1;const A=P[a],B=P[b],dx=B.x-A.x,dy=B.y-A.y,L=Math.hypot(dx,dy)||1;
  for(let i=a+1;i<b;i++){const d=Math.abs(dy*P[i].x-dx*P[i].y+B.x*A.y-B.y*A.x)/L;if(d>mx){mx=d;k=i}}
  if(mx>eps&&k>0){dpOpen(P,eps,a,k,keep);keep.push(P[k]);dpOpen(P,eps,k,b,keep)}}
/* approxPolyDP cerrado: se parte por los dos puntos más alejados entre sí (como OpenCV) */
function approxPolyDP(P,eps){const n=P.length;if(n<4)return P.slice();let i0=0,i1=0,best=-1;
  for(let i=0;i<n;i++){const d=(P[i].x-P[0].x)**2+(P[i].y-P[0].y)**2;if(d>best){best=d;i0=i}}best=-1;
  for(let i=0;i<n;i++){const d=(P[i].x-P[i0].x)**2+(P[i].y-P[i0].y)**2;if(d>best){best=d;i1=i}}
  const R=P.slice(i0).concat(P.slice(0,i0)),j=(i1-i0+n)%n;const A=R.slice(0,j+1),B=R.slice(j).concat([R[0]]);
  const out=[R[0]];dpOpen(A,eps,0,A.length-1,out);out.push(R[j]);dpOpen(B,eps,0,B.length-1,out);return out}
function perimeter(P){let s=0;for(let i=0;i<P.length;i++)s+=dist(P[i],P[(i+1)%P.length]);return s}
function quadFromHull(hull,C){const per=perimeter(hull);for(let f=C.approxEps;f<=0.0801;f+=0.01){const a=approxPolyDP(hull,f*per);if(a.length===4)return a;if(a.length<4)return null}return null}
/* fracción de los 4 lados que tiene borde real debajo (se mide sobre el mapa dilatado) */
function edgeSupport(q,ed,w,h){let hit=0,tot=0;for(let s=0;s<4;s++){const a=q[s],b=q[(s+1)%4],L=dist(a,b),n=Math.max(8,Math.min(80,L/3|0));
  for(let k=1;k<n;k++){const t=k/n,x=Math.round(a.x+(b.x-a.x)*t),y=Math.round(a.y+(b.y-a.y)*t);if(x<1||y<1||x>=w-1||y>=h-1)continue;tot++;if(ed[y*w+x])hit++}}return tot?hit/tot:0}
/* Ajuste fino de esquinas: para cada lado busca, en perpendicular (±r px), el punto de gradiente máximo;
 * ajusta una recta por mínimos cuadrados totales a esos puntos y corta las 4 rectas. Precisión sub-píxel. */
function refineQuad(q,mag,w,h,r){const lines=[];
  for(let s=0;s<4;s++){const a=q[s],b=q[(s+1)%4],L=dist(a,b);if(L<10)return null;const ux=(b.x-a.x)/L,uy=(b.y-a.y)/L,nx=-uy,ny=ux;const P=[];const n=Math.max(10,Math.min(60,L/4|0));
    for(let k=2;k<n-1;k++){const t=k/n,cx=a.x+(b.x-a.x)*t,cy=a.y+(b.y-a.y)*t;let bm=0,bx=0,by=0;
      for(let o=-r;o<=r;o++){const x=Math.round(cx+nx*o),y=Math.round(cy+ny*o);if(x<1||y<1||x>=w-1||y>=h-1)continue;const m=mag[y*w+x];if(m>bm){bm=m;bx=x;by=y}}
      if(bm>60)P.push({x:bx,y:by})}
    if(P.length<n*0.35)return null;let mx=0,my=0;for(const p of P){mx+=p.x;my+=p.y}mx/=P.length;my/=P.length;let sxx=0,syy=0,sxy=0;for(const p of P){const dx=p.x-mx,dy=p.y-my;sxx+=dx*dx;syy+=dy*dy;sxy+=dx*dy}
    const th=0.5*Math.atan2(2*sxy,sxx-syy);lines.push({px:mx,py:my,dx:Math.cos(th),dy:Math.sin(th)})}
  const X=(l1,l2)=>{const den=l1.dx*l2.dy-l1.dy*l2.dx;if(Math.abs(den)<1e-6)return null;const t=((l2.px-l1.px)*l2.dy-(l2.py-l1.py)*l2.dx)/den;return {x:l1.px+l1.dx*t,y:l1.py+l1.dy*t}};
  const out=[];for(let i=0;i<4;i++){const p=X(lines[(i+3)%4],lines[i]);if(!p||p.x<-w*.05||p.y<-h*.05||p.x>w*1.05||p.y>h*1.05)return null;out.push(p)}
  for(let i=0;i<4;i++)if(dist(out[i],q[i])>r*3)return null;return out}
function validQuad(q,w,h,C){if(!q||q.length!==4||!isConvex(q))return false;const A=polyArea(q)/(w*h);if(A<C.minAreaFrac||A>C.maxAreaFrac)return false;
  const L=Math.max(w,h);for(let i=0;i<4;i++)if(dist(q[i],q[(i+1)%4])<C.minSideFrac*L)return false;
  return angles(q).every(a=>a>=C.minAngle&&a<=180-C.minAngle)}

/* ---------- respaldo: la mancha clara más grande (Otsu), como el detector anterior ---------- */
function otsuTh(H,n){let sum=0;for(let i=0;i<256;i++)sum+=i*H[i];let sB=0,wB=0,best=-1,th=127,m1=0,m2=0;for(let t=0;t<256;t++){wB+=H[t];if(!wB)continue;const wF=n-wB;if(!wF)break;sB+=t*H[t];const a=sB/wB,b=(sum-sB)/wF,v=wB*wF*(a-b)*(a-b);if(v>best){best=v;th=t;m1=a;m2=b}}return {th,diff:m2-m1}}
function blobQuad(g,w,h,H,B){const n=w*h,o=otsuTh(H,n);if(o.diff<28)return null;const lab=B.lab&&B.lab.length===n?B.lab:(B.lab=new Int32Array(n)),st=B.stack&&B.stack.length===n?B.stack:(B.stack=new Int32Array(n));lab.fill(0);
  let best=0,bl=0,cur=0;for(let p=0;p<n;p++){if(lab[p]||g[p]<=o.th)continue;cur++;let sp=0,c=0;st[sp++]=p;lab[p]=cur;while(sp){const q=st[--sp];c++;const x=q%w;
    if(x>0&&!lab[q-1]&&g[q-1]>o.th){lab[q-1]=cur;st[sp++]=q-1}if(x<w-1&&!lab[q+1]&&g[q+1]>o.th){lab[q+1]=cur;st[sp++]=q+1}if(q>=w&&!lab[q-w]&&g[q-w]>o.th){lab[q-w]=cur;st[sp++]=q-w}if(q<n-w&&!lab[q+w]&&g[q+w]>o.th){lab[q+w]=cur;st[sp++]=q+w}}
    if(c>best){best=c;bl=cur}}
  if(best/n<0.12)return null;const pts=[];for(let y=0;y<h;y++){let a=-1,b=-1;for(let x=0;x<w;x++)if(lab[y*w+x]===bl){if(a<0)a=x;b=x}if(a>=0){pts.push({x:a,y});if(b!==a)pts.push({x:b,y})}}
  return convexHull(pts)}

/* ---------- detectDocument: el pilar 1 ---------- */
/* rgba: Uint8ClampedArray del cuadro de análisis (w×h). B: buffers que se reusan entre cuadros (cero allocaciones grandes en el bucle).
 * Devuelve {quad (normalizado 0-1, TL,TR,BR,BL) | null, conf, luma, blur, std, t:{gray,blur,canny,contours,total}} */
function detectDocument(rgba,w,h,cfg,B){
  const C=Object.assign({},VISION_CFG,cfg||{});B=B||{};const n=w*h,now=()=>(typeof performance!=='undefined'?performance.now():Date.now());const t0=now();
  if(!B.g||B.g.length!==n){B.g=new Uint8Array(n);B.bl=new Uint8Array(n);B.tmp=new Uint16Array(n);B.dil=new Uint8Array(n);B.lab=new Int32Array(n)}
  const g=toGray(rgba,n,B.g);const L=lumaStats(g,n);const t1=now();
  const bl=gauss5(g,w,h,B.tmp,B.bl);const t2=now();
  const ed=canny(bl,w,h,C.cannyLo,C.cannyHi,B);const dil=dilate3(ed,w,h,B.dil);const t3=now();
  // componentes conectados (8 vecinos) de los bordes dilatados; de cada uno, el extremo izquierdo y derecho de cada fila → envolvente
  const lab=B.lab;lab.fill(0);const st=B.stack;let cur=0;const comps=[];const minBox=C.minAreaFrac*n*0.9;
  for(let p=0;p<n;p++){if(!dil[p]||lab[p])continue;cur++;let sp=0,cnt=0,x0=w,x1=0,y0=h,y1=0;st[sp++]=p;lab[p]=cur;
    while(sp){const q=st[--sp];cnt++;const x=q%w,y=(q-x)/w;if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;
      for(const o of [-w-1,-w,-w+1,-1,1,w-1,w,w+1]){const k=q+o;if(k<0||k>=n||lab[k]||!dil[k])continue;const kx=k%w;if(kx-x>1||x-kx>1)continue;lab[k]=cur;st[sp++]=k}}
    if((x1-x0+1)*(y1-y0+1)>=minBox&&cnt>40)comps.push({id:cur,x0,x1,y0,y1,cnt})}
  const cands=[];
  for(const c of comps.sort((a,b)=>(b.x1-b.x0)*(b.y1-b.y0)-(a.x1-a.x0)*(a.y1-a.y0)).slice(0,6)){
    const pts=[];for(let y=c.y0;y<=c.y1;y++){let a=-1,b=-1;const r=y*w;for(let x=c.x0;x<=c.x1;x++)if(lab[r+x]===c.id){if(a<0)a=x;b=x}if(a>=0){pts.push({x:a,y});if(b!==a)pts.push({x:b,y})}}
    const hull=convexHull(pts),q=quadFromHull(hull,C);if(q&&validQuad(q,w,h,C))cands.push({q,src:'canny'})}
  // la mancha clara (Otsu) siempre compite: sobre un fondo con textura los bordes del fondo se pegan a la hoja y la envolvente queda grande
  {const hb=blobQuad(bl,w,h,L.hist,B);const q=hb&&quadFromHull(hb,C);if(q&&validQuad(q,w,h,C))cands.push({q,src:'blob'})}
  // ajuste fino: cada lado se acomoda al borde más fuerte cercano (recta por mínimos cuadrados) y se cortan las rectas
  for(const c of cands){const r=refineQuad(c.q,B.mag,w,h,6);if(r&&validQuad(r,w,h,C)&&edgeSupport(r,dil,w,h)>=edgeSupport(c.q,dil,w,h)-0.02)c.q=r}
  let best=null;for(const c of cands){const sup=edgeSupport(c.q,dil,w,h),area=polyArea(c.q)/n;const sc=area*(0.25+0.75*sup)*(0.5+0.5*sup);if(sup>=(c.src==='blob'?0.3:C.minSupport)&&(!best||sc>best.sc))best={q:c.q,sc,sup,area,src:c.src}}
  const t4=now();
  let quad=null,blur={lapVar:0,std:0};
  if(best){const q=orderCorners(best.q);quad=q.map(p=>({x:Math.min(1,Math.max(0,(p.x+.5)/w)),y:Math.min(1,Math.max(0,(p.y+.5)/h))}));
    const xs=q.map(p=>p.x),ys=q.map(p=>p.y),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys),dx=(x1-x0)*.2,dy=(y1-y0)*.2;
    blur=blurScore(g,w,h,x0+dx,y0+dy,x1-dx,y1-dy)}
  else blur=blurScore(g,w,h,w*.25,h*.25,w*.75,h*.75);
  const t5=now();
  return {quad,conf:best?Math.round(best.sup*100)/100:0,src:best?best.src:null,luma:Math.round(L.mean),p5:L.p5,p95:L.p95,blur:Math.round(blur.lapVar),std:Math.round(blur.std),
    t:{gray:+(t1-t0).toFixed(2),blur:+(t2-t1).toFixed(2),canny:+(t3-t2).toFixed(2),contours:+(t4-t3).toFixed(2),total:+(t5-t0).toFixed(2)}};
}

/* ---------- enfoque y flash: decisiones puras (el pilar 4 las aplica sobre la cámara) ---------- */
/* torch con histéresis: se prende debajo de lowLuma y se apaga recién arriba de lowLumaOff */
function torchDecision(luma,on,C){C=C||VISION_CFG;return on?luma<C.lowLumaOff:luma<C.lowLuma}
/* ¿se puede disparar? bloquea si está movida, salvo que la hoja esté casi en blanco (no hay textura para medir) */
function captureAllowed(r,C){C=C||VISION_CFG;if(!r||!r.quad)return false;if(r.std<C.blankStd)return true;return r.blur>=C.blurMin}

const API={VISION_CFG,orderCorners,destSize,polyArea,isConvex,angles,toGray,gauss5,blurScore,lumaStats,canny,dilate3,convexHull,approxPolyDP,quadFromHull,edgeSupport,refineQuad,validQuad,detectDocument,torchDecision,captureAllowed};
G.DSVision=API;
if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof self!=='undefined'?self:this);
