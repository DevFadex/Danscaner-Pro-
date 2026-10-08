/* Danscanner Pro · de PDF, Word o foto a Excel «tal cual» (v75). Se carga solo al usar la herramienta.
 * Cómo trabaja:
 *  1. Cada página se dibuja como imagen y se buscan las líneas de las tablas (rayas horizontales y verticales finas y largas).
 *     Con las líneas se arma la grilla real: filas, columnas y celdas combinadas.
 *  2. Las palabras salen del texto del PDF (con su posición) o, si la página es una foto/escaneo, del OCR.
 *     Para el OCR se borran las líneas de la tabla antes de leer (las rayas confunden al lector) y las celdas dudosas se releen solas.
 *  3. Cada palabra cae en su celda por su posición. Fuera de las tablas con líneas, las columnas se deducen por los espacios
 *     verticales que se repiten en todos los renglones (así un nombre con espacios no se parte en dos columnas).
 *  4. Word (.docx) se lee directo de su XML: tablas con celdas combinadas, negritas, sombreado y anchos.
 *  5. El Excel se escribe con ExcelJS: bordes donde había líneas, negritas, combinadas, anchos de columna y números/fechas reales. */
window.__mods=window.__mods||{};
(function(){
'use strict';
const TX={};
const med=a=>{if(!a.length)return 0;const s=a.slice().sort((x,y)=>x-y);return s[s.length>>1]};
const clusterVals=(vals,tol)=>{const s=vals.slice().sort((a,b)=>a-b),out=[];for(const v of s){const L=out[out.length-1];if(L&&v-L.max<=tol){L.max=v;L.sum+=v;L.n++}else out.push({min:v,max:v,sum:v,n:1})}return out.map(c=>c.sum/c.n)};

/* ---------- 1. líneas de tabla en una imagen ---------- */
/* words (opcional, PDF digital): se conocen las letras, así que se borran de la máscara y el umbral puede ser mucho más fino:
 * aparecen las líneas grises claras y finas (0,25 pt) que antes se perdían y dejaban la planilla sin grilla (v76). */
TX.findRules=function(c,words){
  const W=c.width,H=c.height,d=c.getContext('2d',{willReadFrequently:true}).getImageData(0,0,W,H).data,N=W*H;
  const g=new Uint8Array(N);for(let i=0,j=0;i<N;i++,j+=4)g[i]=(d[j]*77+d[j+1]*150+d[j+2]*29)>>8;
  // umbral: más oscuro que el papel (mediana) por un margen
  const H2=new Uint32Array(256);for(let i=0;i<N;i+=7)H2[g[i]]++;let a=0,paper=255;const tot=Math.ceil(N/7);for(let v=255;v>=0;v--){a+=H2[v];if(a>=tot*.5){paper=v;break}}
  const th=words?Math.max(paper-110,paper-16):Math.min(170,paper-60),dark=new Uint8Array(N);for(let i=0;i<N;i++)dark[i]=g[i]<th?1:0;
  if(words)for(const w of words){const a=Math.max(0,Math.floor(w.x0)),b=Math.min(W-1,Math.ceil(w.x1)),t=Math.max(0,Math.floor(w.y0)),u=Math.min(H-1,Math.ceil(w.y1));for(let y=t;y<=u;y++)dark.fill(0,y*W+a,y*W+b+1)}
  const minH=Math.max(40,W*.05),minV=Math.max(24,H*.018),maxThick=Math.max(5,Math.round(Math.min(W,H)*.006));
  const runs=(len,cnt,at,minLen)=>{const out=[];for(let k=0;k<cnt;k++){let i=0;while(i<len){if(!at(k,i)){i++;continue}let j=i,holes=0,last=i;while(j<len){if(at(k,j)){last=j;j++}else if(j-last<=2){holes++;j++}else break}const L=last-i+1;if(L>=minLen&&holes<=L*.06)out.push({k,a:i,b:last});i=j+1}}return out};
  const join=(rs)=>{rs.sort((p,q)=>p.k-q.k||p.a-q.a);const segs=[];for(const r of rs){let s=null;for(let t=segs.length-1;t>=0;t--){const S=segs[t];if(r.k-S.k1>1)break;if(r.k-S.k1<=1&&Math.min(S.b,r.b)-Math.max(S.a,r.a)>Math.min(S.b-S.a,r.b-r.a)*.6){s=S;break}}if(s){s.k1=r.k;s.a=Math.min(s.a,r.a);s.b=Math.max(s.b,r.b)}else segs.push({k0:r.k,k1:r.k,a:r.a,b:r.b})}
    return segs.filter(s=>s.k1-s.k0+1<=maxThick).map(s=>({pos:(s.k0+s.k1)/2,a:s.a,b:s.b,th:s.k1-s.k0+1}))};
  const hs=join(runs(W,H,(y,x)=>dark[y*W+x],minH)).map(s=>({y:s.pos,x0:s.a,x1:s.b,th:s.th}));
  const vs=join(runs(H,W,(x,y)=>dark[y*W+x],minV)).map(s=>({x:s.pos,y0:s.a,y1:s.b,th:s.th}));
  // une segmentos colineales cortados (por ejemplo por una letra que toca la línea)
  const mergeCol=(arr,p,lo,hi)=>{arr.sort((u,v)=>u[p]-v[p]||u[lo]-v[lo]);const out=[];for(const s of arr){const L=out.find(o=>Math.abs(o[p]-s[p])<=2&&s[lo]<=o[hi]+8&&s[hi]>=o[lo]-8);if(L){L[lo]=Math.min(L[lo],s[lo]);L[hi]=Math.max(L[hi],s[hi])}else out.push({...s})}return out};
  return {h:mergeCol(hs,'y','x0','x1'),v:mergeCol(vs,'x','y0','y1'),W,H};
};

/* ---------- 2. grillas: grupos de líneas que se cruzan ---------- */
TX.findGrids=function(R){
  const {h,v}=R,tol=6,n=h.length+v.length,par=[...Array(n).keys()],f=i=>par[i]===i?i:(par[i]=f(par[i])),u=(i,j)=>{par[f(i)]=f(j)};
  for(let i=0;i<h.length;i++)for(let j=0;j<v.length;j++){const H0=h[i],V=v[j];if(V.x>=H0.x0-tol&&V.x<=H0.x1+tol&&H0.y>=V.y0-tol&&H0.y<=V.y1+tol)u(i,h.length+j)}
  const groups=new Map();for(let i=0;i<n;i++){const r=f(i);if(!groups.has(r))groups.set(r,{h:[],v:[]});if(i<h.length)groups.get(r).h.push(h[i]);else groups.get(r).v.push(v[i-h.length])}
  const grids=[];
  for(const G of groups.values()){if(G.h.length<2||G.v.length<2)continue;
    const Xs=clusterVals(G.v.map(s=>s.x),tol),Ys=clusterVals(G.h.map(s=>s.y),tol);if(Xs.length<2||Ys.length<2)continue;
    const nr=Ys.length-1,nc=Xs.length-1;
    const vb=(r,c)=>{const x=Xs[c+1],ym=(Ys[r]+Ys[r+1])/2;return G.v.some(s=>Math.abs(s.x-x)<=tol&&s.y0-tol<=ym&&s.y1+tol>=ym)};
    const hb=(r,c)=>{const y=Ys[r+1],xm=(Xs[c]+Xs[c+1])/2;return G.h.some(s=>Math.abs(s.y-y)<=tol&&s.x0-tol<=xm&&s.x1+tol>=xm)};
    const id=(r,c)=>r*nc+c,P=[...Array(nr*nc).keys()],F=i=>P[i]===i?i:(P[i]=F(P[i])),U=(i,j)=>{const a=F(i),b=F(j);if(a!==b)P[Math.max(a,b)]=Math.min(a,b)};
    for(let r=0;r<nr;r++)for(let c=0;c<nc;c++){if(c<nc-1&&!vb(r,c))U(id(r,c),id(r,c+1));if(r<nr-1&&!hb(r,c))U(id(r,c),id(r+1,c))}
    const cells=new Map();for(let r=0;r<nr;r++)for(let c=0;c<nc;c++){const k=F(id(r,c));const C=cells.get(k)||{r1:r,c1:c,r2:r,c2:c};C.r1=Math.min(C.r1,r);C.c1=Math.min(C.c1,c);C.r2=Math.max(C.r2,r);C.c2=Math.max(C.c2,c);cells.set(k,C)}
    grids.push({Xs,Ys,nr,nc,cells:[...cells.values()],root:(r,c)=>F(id(r,c)),cellOf:k=>cells.get(k),x0:Xs[0],x1:Xs[nc],y0:Ys[0],y1:Ys[nr]})}
  return grids.sort((a,b)=>a.y0-b.y0);
};

/* ---------- 3. de palabras con posición a filas de planilla ---------- */
const idx=(arr,v)=>{for(let i=0;i<arr.length-1;i++)if(v>=arr[i]&&v<arr[i+1])return i;return -1};
function textOf(words){if(!words.length)return '';const hh=med(words.map(w=>w.y1-w.y0))||10;const ws=words.slice().sort((a,b)=>((a.y0+a.y1)/2)-((b.y0+b.y1)/2));const lines=[];for(const w of ws){const cy=(w.y0+w.y1)/2;let L=lines.find(l=>Math.abs(l.cy-cy)<hh*.55);if(!L){L={cy,ws:[]};lines.push(L)}L.ws.push(w)}
  lines.sort((a,b)=>a.cy-b.cy);return lines.map(l=>l.ws.sort((a,b)=>a.x0-b.x0).map(w=>w.t).join(' ')).join('\n')}
/* una página → bloques en orden de arriba hacia abajo: {kind:'grid'|'rows'|'text', rows:[[cell]], merges, widths(pt)} */
TX.layoutPage=function(words,grids,scale,hrules){
  const used=new Set(),blocks=[];
  for(const G of grids){const bucket=new Map();
    words.forEach((w,i)=>{const cx=(w.x0+w.x1)/2,cy=(w.y0+w.y1)/2;if(cx<G.x0-2||cx>G.x1+2||cy<G.y0-2||cy>G.y1+2)return;const c=idx(G.Xs,cx),r=idx(G.Ys,cy);if(r<0||c<0)return;used.add(i);const k=G.root(r,c);(bucket.get(k)||bucket.set(k,[]).get(k)).push(w)});
    const rows=Array.from({length:G.nr},()=>Array(G.nc).fill(null)),merges=[];
    for(const C of G.cells){const k=G.root(C.r1,C.c1),ws=bucket.get(k)||[];const t=textOf(ws);rows[C.r1][C.c1]={v:t,b:ws.length>0&&ws.every(w=>w.b),border:true};
      for(let r=C.r1;r<=C.r2;r++)for(let c=C.c1;c<=C.c2;c++)if(r!==C.r1||c!==C.c1)rows[r][c]={v:'',border:true};
      if(C.r2>C.r1||C.c2>C.c1)merges.push({r1:C.r1,c1:C.c1,r2:C.r2,c2:C.c2})}
    // filas vacías de la grilla (separadores) se quitan
    const keep=rows.map(r=>r.some(c=>c&&c.v));const rmap=[];let nr=0;keep.forEach((k,i)=>{rmap[i]=k?nr++:-1});
    const rows2=rows.filter((r,i)=>keep[i]),mg=merges.map(m=>({...m,r1:rmap[m.r1],r2:Math.max(...Array.from({length:m.r2-m.r1+1},(_,j)=>rmap[m.r1+j]))})).filter(m=>m.r1>=0&&m.r2>=m.r1&&(m.r2>m.r1||m.c2>m.c1));
    blocks.push({kind:'grid',y:G.y0,rows:rows2,merges:mg,widths:G.Xs.slice(1).map((x,i)=>(x-G.Xs[i])/scale)})}
  // palabras fuera de las grillas: renglones → bloques de texto o tablas sin líneas
  const free=words.filter((w,i)=>!used.has(i));if(free.length)blocks.push(...TX.freeBlocks(free,scale,hrules||[]));
  return blocks.sort((a,b)=>a.y-b.y);
};
/* Tablas sin líneas (v76). Antes las columnas salían de juntar frases separadas por ~2,5 letras: con columnas apretadas
 * o celdas de dos renglones todo se corría. Ahora:
 *  · las frases se cortan con el espacio real del documento (≈1,8 espacios), no con un ancho fijo;
 *  · las columnas son las «calles» verticales vacías en todos los renglones del bloque (se tolera un título que cruce);
 *  · una celda de varios renglones se junta con su fila: por las líneas horizontales si las hay o, si no,
 *    por la columna «ancla» (la que nunca ocupa dos renglones seguidos, como N° o DNI). */
TX.freeBlocks=function(free,scale,hrules){const out=[];
  const hh=med(free.map(w=>w.y1-w.y0))||10,cw=med(free.map(w=>(w.x1-w.x0)/Math.max(1,w.t.length)))||hh*.5;
  const lines=[];for(const w of free.slice().sort((a,b)=>(a.y0+a.y1)-(b.y0+b.y1))){const cy=(w.y0+w.y1)/2;let L=lines.find(l=>Math.abs(l.cy-cy)<hh*.5);if(!L){L={cy,ws:[],y0:w.y0,y1:w.y1};lines.push(L)}L.ws.push(w);L.y0=Math.min(L.y0,w.y0);L.y1=Math.max(L.y1,w.y1)}
  lines.sort((a,b)=>a.cy-b.cy);
  // espacio entre palabras típico del documento
  const gs=[];for(const L of lines){L.ws.sort((a,b)=>a.x0-b.x0);for(let k=1;k<L.ws.length;k++){const g=L.ws[k].x0-L.ws[k-1].x1;if(g>0)gs.push(g)}}gs.sort((a,b)=>a-b);
  const sp=gs.length?gs[Math.floor(gs.length*.3)]:cw*.5,gapS=Math.max(sp*1.8,cw*.75),gapT=Math.max(cw*2.4,hh*.9);
  const phr=(L,gap)=>{const ph=[];for(const w of L.ws){const P=ph[ph.length-1];if(P&&w.x0-P.x1<gap*Math.max(1,(w.y1-w.y0)/hh)){P.t+=' '+w.t;P.x1=Math.max(P.x1,w.x1);P.b=P.b&&!!w.b;P.ws.push(w)}else ph.push({t:w.t,x0:w.x0,x1:w.x1,b:!!w.b,ws:[w]})}return ph};
  for(const L of lines){L.ph=phr(L,gapS);L.big=phr(L,gapT).length}
  const textLine=L=>out.push({kind:'text',y:L.y0,rows:[[{v:phr(L,gapT).map(p=>p.t).join('   '),b:L.ws.every(w=>w.b),x:L.ws[0].x0}]],merges:[],widths:[]});
  const pitch=med(lines.slice(1).map((l,i)=>l.cy-lines[i].cy))||hh*1.4;
  let i=0;while(i<lines.length){const L=lines[i];
    if(L.ph.length<2){textLine(L);i++;continue}
    let j=i;const blk=[];while(j<lines.length){const M=lines[j],P=blk[blk.length-1];if(P&&M.cy-P.cy>pitch*2.6)break;
      if(M.ph.length<2){const nx=lines[j+1],near=P&&M.cy-P.cy<hh*1.9,nextT=nx&&nx.ph.length>=2&&nx.cy-M.cy<pitch*2.6;if(!(nextT||near))break}
      blk.push(M);j++}
    const rows=TX.gutterRows(blk,{hh,cw,gapS,hrules});
    if(!rows){blk.forEach(textLine);i=j;continue}
    out.push({kind:'rows',y:blk[0].y0,rows:rows.rows,merges:[],widths:rows.widths.map(w=>w/scale)});i=j}
  return out};
/* columnas por calles vacías y filas (con celdas de varios renglones) */
TX.gutterRows=function(blk,{hh,cw,gapS,hrules}){const n=blk.length;if(n<2)return null;
  let x0=Infinity,x1=-Infinity;for(const L of blk)for(const p of L.ph){x0=Math.min(x0,p.x0);x1=Math.max(x1,p.x1)}x0=Math.floor(x0);x1=Math.ceil(x1);const Wd=x1-x0+1;
  const cov=new Uint16Array(Wd);for(const L of blk)for(const p of L.ph)for(let x=Math.max(0,Math.floor(p.x0)-x0);x<=Math.min(Wd-1,Math.ceil(p.x1)-x0);x++)cov[x]++;
  const tol=n>=8?Math.floor(n*.1):n>=4?1:0,minW=n>=3?1:cw*1.5,gut=[];
  for(let x=0;x<Wd;){if(cov[x]>tol){x++;continue}let e=x;while(e<Wd&&cov[e]<=tol)e++;const a=x+x0,b=e-1+x0;x=e;if(b-a+1<minW)continue;
    // con tolerancia: solo vale si lo que cruza la calle la atraviesa entera (un título), no si es una columna casi vacía
    let strict=true;for(let q=a-x0;q<=b-x0;q++)if(cov[q]){strict=false;break}
    if(!strict){let ok=true;for(const L of blk)for(const p of L.ph)if(p.x1>=a&&p.x0<=b&&!(p.x0<a-cw&&p.x1>b+cw)){ok=false;break}
      if(!ok){// adentro hay una columna rala: las partes sin nada a los costados siguen siendo calles
        for(let q=a-x0;q<=b-x0;){if(cov[q]){q++;continue}let e2=q;while(e2<=b-x0&&!cov[e2])e2++;if(e2-q>=Math.max(minW,cw*.6))gut.push([q+x0,e2-1+x0]);q=e2}continue}}
    gut.push([a,b])}
  if(!gut.length)return null;
  // el corte va en el tramo de la calle que no pisa ninguna palabra (si un encabezado pegado cruza, se corta entre sus palabras)
  const cutOf=([a,b])=>{const busy=new Uint8Array(b-a+1);for(const L of blk)for(const p of L.ph)if(p.x1>=a&&p.x0<=b)for(const w of p.ws)for(let x=Math.max(a,Math.floor(w.x0));x<=Math.min(b,Math.ceil(w.x1));x++)busy[x-a]=1;
    let best=null;for(let x=0;x<busy.length;){if(busy[x]){x++;continue}let e=x;while(e<busy.length&&!busy[e])e++;if(!best||e-x>best[1]-best[0])best=[x,e];x=e}return best?a+(best[0]+best[1]-1)/2:(a+b)/2};
  const cuts=gut.map(cutOf),nc=cuts.length+1,colAt=x=>{let k=0;while(k<cuts.length&&x>cuts[k])k++;return k};
  const lineCells=blk.map((L,li)=>{const r=Array(nc).fill(null);const add=(k,t,b)=>{r[k]=r[k]?{v:r[k].v+' '+t,b:r[k].b&&b}:{v:t,b}};
    for(const p of L.ph){const k0=colAt(p.x0),k1=colAt(p.x1);if(k0===k1){add(k0,p.t,p.b);continue}
      // cruza una calle: si el corte cae entre dos palabras se reparte palabra por palabra (dos celdas que quedaron pegadas);
      // si corta una palabra al medio es un título que abarca varias columnas: queda donde más ocupa
      const splits=cuts.slice(k0,k1).every(x=>p.ws.some((w,q)=>q&&p.ws[q-1].x1<=x&&w.x0>=x));
      if(!splits&&(p.b||li<2)){let best=k0,bo=-1;for(let k=k0;k<=k1;k++){const lo=k?cuts[k-1]:-Infinity,hi=k<cuts.length?cuts[k]:Infinity,o=Math.min(hi,p.x1)-Math.max(lo,p.x0);if(o>bo){bo=o;best=k}}add(best,p.t,p.b)}
      else for(const w of p.ws)add(colAt((w.x0+w.x1)/2),w.t,!!w.b)}
    return {r,cy:L.cy,y0:L.y0}});
  // filas: con líneas horizontales que crucen el bloque, todo lo que queda entre dos líneas es una fila
  const bx0=x0,bx1=x1,hs=(hrules||[]).filter(s=>s.x0<=bx0+(bx1-bx0)*.25&&s.x1>=bx1-(bx1-bx0)*.25).map(s=>s.y).sort((a,b)=>a-b);
  const rows=[];const join=(P,R)=>R.r.forEach((c,k)=>{if(!c)return;P.r[k]=P.r[k]?{v:P.r[k].v+' '+c.v,b:P.r[k].b&&c.b}:c});
  const inside=hs.filter(y=>y>blk[0].y0-hh&&y<blk[n-1].y1+hh);
  if(inside.length>=3){const band=cy=>{let k=0;while(k<inside.length&&inside[k]<cy)k++;return k};let pb=null;
    for(const R of lineCells){const bd=band(R.cy);const P=rows[rows.length-1];if(P&&bd===pb)join(P,R);else rows.push({r:R.r.slice(),cy:R.cy});pb=bd}}
  else{// columna ancla: llena en muchos renglones y casi nunca en dos renglones pegados
    const tight=(a,b)=>b.cy-a.cy<hh*1.9;let key=-1,bs=null;
    for(let k=0;k<nc;k++){const cnt=lineCells.filter(R=>R.r[k]).length;if(cnt<n*.35)continue;let wr=0;for(let q=1;q<n;q++)if(lineCells[q].r[k]&&lineCells[q-1].r[k]&&tight(lineCells[q-1],lineCells[q]))wr++;
      const s=[wr,-cnt,k];if(!bs||s[0]<bs[0]||(s[0]===bs[0]&&s[1]<bs[1]))(bs=s,key=k)}
    const kc=lineCells.filter(R=>key>=0&&R.r[key]),gaps=kc.slice(1).map((R,q)=>R.cy-kc[q].cy),P0=med(gaps)||hh*2;
    lineCells.forEach((R,q)=>{const P=rows[rows.length-1];const prev=lineCells[q-1];
      if(P&&key>=0&&!R.r[key]&&R.cy-prev.cy<Math.min(P0*.85,hh*2)){join(P,R);return}rows.push({r:R.r.slice(),cy:R.cy})})}
  // anchos: de calle a calle
  const edges=[x0,...cuts,x1];return {rows:rows.map(R=>R.r),widths:edges.slice(1).map((e,k)=>e-edges[k])}};

/* ---------- 4. palabras de un PDF digital ---------- */
TX.pdfWords=async function(page,vp,c){const G=c?TX.grayOf(c):null;
  const tc=await page.getTextContent(),words=[];
  for(const it of tc.items){if(!it.str||!it.str.trim())continue;const t=it.transform,fs=Math.hypot(t[2],t[3])||Math.hypot(t[0],t[1])||10;
    const [bx,by]=vp.convertToViewportPoint(t[4],t[5]);const s=vp.scale,w=(it.width||0)*s,hgt=fs*s;let bold=false;
    try{const f=page.commonObjs.has(it.fontName)?page.commonObjs.get(it.fontName):null;bold=!!(f&&(f.bold||/bold|black|heavy|semibold|demi/i.test(f.name||'')))}catch(e){}
    if(!bold){const st=tc.styles&&tc.styles[it.fontName];if(st&&/bold/i.test(st.fontFamily||''))bold=true}
    // un ítem puede traer varias palabras: se reparten por cantidad de letras
    const str=it.str,parts=str.split(/(\s+)/),L=str.length||1;let pos=0;
    const toks=[];for(const p of parts){if(p&&!/^\s+$/.test(p)){const x0=bx+w*pos/L,x1=bx+w*(pos+p.length)/L;toks.push({t:p,x0,x1,y0:by-hgt*.82,y1:by+hgt*.2,b:bold})}pos+=p.length}
    if(G&&toks.length&&Math.abs(t[1])<Math.abs(t[0])*.1)TX.inkWords(G,toks,bx,bx+w,by-hgt*.82,by+hgt*.2);words.push(...toks)}
  return words;
};
/* pdf.js junta en un solo ítem textos cercanos del mismo renglón (por ejemplo dos celdas vecinas) y deja un solo espacio entre ellos:
 * repartir por cantidad de letras corría las palabras de columna. Se miran los píxeles de la página dibujada: los huecos más anchos
 * entre tinta son los cortes reales entre palabras (v76). Las rayas verticales de la tabla (tinta de punta a punta) no cuentan. */
TX.grayOf=function(c){const W=c.width,H=c.height,d=c.getContext('2d',{willReadFrequently:true}).getImageData(0,0,W,H).data,g=new Uint8Array(W*H);for(let i=0,j=0;i<g.length;i++,j+=4)g[i]=(d[j]*77+d[j+1]*150+d[j+2]*29)>>8;return {g,W,H}};
TX.inkWords=function(G,toks,X0,X1,Y0,Y1){const {g,W,H}=G,a=Math.max(0,Math.floor(X0)-1),b=Math.min(W-1,Math.ceil(X1)+1),t=Math.max(0,Math.floor(Y0)),u=Math.min(H-1,Math.ceil(Y1)),hgt=u-t+1;if(b-a<2||hgt<3)return;
  const ink=new Uint8Array(b-a+1);for(let x=a;x<=b;x++){let n=0;for(let y=t;y<=u;y++)if(g[y*W+x]<200)n++;ink[x-a]=n>0&&n<hgt*.92?1:0}
  let f=0,l=ink.length-1;while(f<=l&&!ink[f])f++;while(l>=f&&!ink[l])l--;if(f>l)return;
  const gaps=[];for(let x=f;x<=l;){if(ink[x]){x++;continue}let e=x;while(e<=l&&!ink[e])e++;gaps.push({a:x,b:e-1,len:e-x});x=e}
  const k=toks.length;if(gaps.length<k-1)return;
  const cut=gaps.slice().sort((p,q)=>q.len-p.len||p.a-q.a).slice(0,k-1).sort((p,q)=>p.a-q.a);
  // los cortes elegidos tienen que ser más anchos que los huecos entre letras; si no, se deja el reparto por letras
  if(k>1){const rest=gaps.length>k-1?gaps.slice().sort((p,q)=>q.len-p.len)[k-1].len:0;if(cut.some(c=>c.len<=rest))return}
  const st=[f,...cut.map(c=>c.b+1)],en=[...cut.map(c=>c.a-1),l];toks.forEach((w,i)=>{w.x0=a+st[i];w.x1=a+en[i]+1})};

/* ---------- 5. OCR de una imagen (con las líneas de tabla borradas) ---------- */
let _w=null,_wLang='';
TX.ocrWorker=async function(){const lang=(typeof S!=='undefined'&&S.lang)||'spa';if(_w&&_wLang===lang)return _w;await loadLib('tess');if(_w)try{await _w.terminate()}catch(e){}_w=await Tesseract.createWorker(lang,1);_wLang=lang;
  try{await _w.setParameters({preserve_interword_spaces:'1',user_defined_dpi:'300'})}catch(e){}return _w};
TX.endOcr=async function(){if(_w){try{await _w.terminate()}catch(e){}_w=null}};
/* mejora para OCR: gris, contraste estirado y líneas de tabla pintadas de blanco */
TX.prepOcr=function(c,R){const o=document.createElement('canvas');o.width=c.width;o.height=c.height;const x=o.getContext('2d',{willReadFrequently:true});x.drawImage(c,0,0);const id=x.getImageData(0,0,o.width,o.height),d=id.data,n=o.width*o.height;
  const g=new Uint8Array(n),H=new Uint32Array(256);for(let i=0,j=0;i<n;i++,j+=4){g[i]=(d[j]*77+d[j+1]*150+d[j+2]*29)>>8;H[g[i]]++}let a=0,lo=0,hi=255;for(let v=0;v<256;v++){a+=H[v];if(a<n*.01)lo=v;if(a<n*.97)hi=v}hi=Math.max(hi,lo+40);
  for(let i=0,j=0;i<n;i++,j+=4){const v=Math.max(0,Math.min(255,(g[i]-lo)*255/(hi-lo)));d[j]=d[j+1]=d[j+2]=v}x.putImageData(id,0,0);
  if(R){x.fillStyle='#fff';for(const s of R.h){const t=Math.ceil(s.th/2)+2;x.fillRect(s.x0-2,s.y-t,s.x1-s.x0+4,t*2)}for(const s of R.v){const t=Math.ceil(s.th/2)+2;x.fillRect(s.x-t,s.y0-2,t*2,s.y1-s.y0+4)}}
  // además, el preparado de OCR de la app (fondo parejo, nitidez y blanco y negro); puede agrandar la imagen: se guarda el factor
  if(typeof prepOcr==='function'){try{const p=prepOcr(o);p._k=p.width/o.width;return p}catch(e){}}o._k=1;return o};
TX.ocrWords=async function(c,R,onProg){const w=await TX.ocrWorker();const img=TX.prepOcr(c,R);
  try{await w.setParameters({tessedit_pageseg_mode:'3',tessedit_char_whitelist:''})}catch(e){}
  const {data}=await w.recognize(img,{},{blocks:true,text:false});const words=[];
  const k=img._k||1;
  for(const b of data.blocks||[])for(const p of b.paragraphs||[])for(const l of p.lines||[])for(const wd of l.words||[]){const t=(wd.text||'').trim();if(!t||wd.confidence<15)continue;if(/^[|_\-–—=~]+$/.test(t))continue;words.push({t,x0:wd.bbox.x0/k,y0:wd.bbox.y0/k,x1:wd.bbox.x1/k,y1:wd.bbox.y1/k,conf:wd.confidence,b:!!wd.is_bold})}
  return {words,img};
};
/* tablas con líneas: se lee celda por celda (recorte agrandado, contraste estirado, modo «un renglón»).
 * Es mucho más preciso que leer la página entera: no se mezclan columnas y no se pierden los números sueltos.
 * Si la celda parece un número/fecha/DNI se relee solo con dígitos (evita 6↔0, l↔1). */
TX.ocrCell=async function(w,c,x0,y0,x1,y1,tall){const pad=4;x0+=pad;y0+=pad;x1-=pad;y1-=pad;const cw=x1-x0,ch=y1-y0;if(cw<6||ch<6)return '';
  const src=c.getContext('2d',{willReadFrequently:true}).getImageData(Math.round(x0),Math.round(y0),Math.round(cw),Math.round(ch)).data;let mn=255,mx=0,dk=0;const gs=new Uint8Array(src.length/4);
  for(let i=0,j=0;j<gs.length;i+=4,j++){const g=(src[i]*77+src[i+1]*150+src[i+2]*29)>>8;gs[j]=g;if(g<mn)mn=g;if(g>mx)mx=g}if(mx-mn<45)return '';const th=mn+(mx-mn)*.55;for(let j=0;j<gs.length;j++)if(gs[j]<th)dk++;if(dk<gs.length*.002)return '';
  const k=Math.max(1,Math.min(4,(tall?60:90)/Math.min(ch,tall?40:ch))),cv=document.createElement('canvas');cv.width=Math.round(cw*k)+40;cv.height=Math.round(ch*k)+40;const cx=cv.getContext('2d',{willReadFrequently:true});cx.fillStyle='#fff';cx.fillRect(0,0,cv.width,cv.height);cx.imageSmoothingQuality='high';cx.drawImage(c,x0,y0,cw,ch,20,20,cw*k,ch*k);
  const id=cx.getImageData(0,0,cv.width,cv.height),d=id.data;for(let i=0;i<d.length;i+=4){const g=(d[i]*77+d[i+1]*150+d[i+2]*29)>>8,v=Math.max(0,Math.min(255,(g-mn)*255/Math.max(1,mx-mn)));d[i]=d[i+1]=d[i+2]=v}cx.putImageData(id,0,0);
  await w.setParameters({tessedit_pageseg_mode:tall?'6':'7',tessedit_char_whitelist:''});let {data}=await w.recognize(cv);let t=(data.text||'').replace(/[ \t]+\n/g,'\n').trim();
  if(!tall&&t&&/^[\d.,/\-$ %]+$/.test(t.replace(/[oOQD]/g,'0').replace(/[lI|]/g,'1').replace(/[sS]/g,'5'))){try{await w.setParameters({tessedit_char_whitelist:'0123456789.,/-$% '});const d2=(await w.recognize(cv)).data;const t2=(d2.text||'').trim();if(t2&&d2.confidence>=data.confidence-8)t=t2}finally{await w.setParameters({tessedit_char_whitelist:''})}}
  return TX.fixOcr(t)};
/* arreglos típicos del OCR en planillas */
TX.fixOcr=function(t){return String(t||'').replace(/^N\s?[°ºeo*•?9]\.?$/i,'N°').replace(/^Nro\.?$/i,'Nro.').replace(/[‘’`´]/g,"'").replace(/[“”]/g,'"').replace(/\s{2,}/g,' ').replace(/^[|_]+|[|_]+$/g,'').trim()};
TX.ocrGridCells=async function(c,G,onProg){const w=await TX.ocrWorker(),words=[];const rowH=med(G.Ys.slice(1).map((y,i)=>y-G.Ys[i]));let n=0;
  for(const C of G.cells){n++;if(onProg&&n%6===1)onProg('Leyendo celdas con OCR… '+n+'/'+G.cells.length);const x0=G.Xs[C.c1],x1=G.Xs[C.c2+1],y0=G.Ys[C.r1],y1=G.Ys[C.r2+1];
    const t=await TX.ocrCell(w,c,x0,y0,x1,y1,(y1-y0)>rowH*1.7);if(t)words.push({t,x0:x0+2,x1:x1-2,y0:y0+2,y1:y1-2,conf:90,b:false})}
  try{await w.setParameters({tessedit_char_whitelist:''})}catch(e){}return words};

/* ---------- 6. páginas → hojas ---------- */
TX.analyzeCanvas=async function(c,{words=null,ocr=false,scale=1,onProg}={}){
  const R=TX.findRules(c,words&&!ocr?words:null),grids=TX.findGrids(R);let ws=words;
  if(!ws||ocr){onProg&&onProg('Leyendo con OCR…');const o=await TX.ocrWords(c,R);
    // el texto suelto sale de la lectura de la página; las tablas con líneas se leen celda por celda
    const inGrid=q=>grids.some(G=>{const cx=(q.x0+q.x1)/2,cy=(q.y0+q.y1)/2;return cx>G.x0&&cx<G.x1&&cy>G.y0&&cy<G.y1});
    ws=o.words.filter(q=>!inGrid(q)).map(q=>({...q,t:TX.fixOcr(q.t)})).filter(q=>q.t);for(const G of grids)ws.push(...await TX.ocrGridCells(c,G,onProg))}
  return TX.layoutPage(ws,grids,scale,R.h)};
TX.fromPdf=async function(ab,{ocr='auto',onProg}={}){
  const pdf=await openPdfjs(ab),pages=[];
  for(let i=1;i<=pdf.numPages;i++){onProg&&onProg('Página '+i+'/'+pdf.numPages);const page=await pdf.getPage(i);const base=page.getViewport({scale:1});const sc=Math.min(3,Math.max(1.5,2200/Math.max(base.width,base.height)));const vp=page.getViewport({scale:sc});
    const c=document.createElement('canvas');c.width=Math.round(vp.width);c.height=Math.round(vp.height);const x=c.getContext('2d',{willReadFrequently:true});x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);await page.render({canvasContext:x,viewport:vp}).promise;
    let words=await TX.pdfWords(page,vp,c);const chars=words.reduce((s,w)=>s+w.t.length,0);const needOcr=ocr==='si'||(ocr==='auto'&&chars<25);
    pages.push({blocks:await TX.analyzeCanvas(c,{words:needOcr?null:words,ocr:needOcr,scale:sc,onProg}),ocr:needOcr,scale:sc});c.width=c.height=1}
  return pages};
TX.fromImages=async function(srcs,{onProg}={}){const pages=[];let n=0;for(const s of srcs){n++;onProg&&onProg('Imagen '+n+'/'+srcs.length);const img=s instanceof HTMLCanvasElement?s:await loadImg(s);
  const k=Math.min(2.2,Math.max(1,2400/Math.max(img.naturalWidth||img.width,img.naturalHeight||img.height)));const c=document.createElement('canvas');c.width=Math.round((img.naturalWidth||img.width)*k);c.height=Math.round((img.naturalHeight||img.height)*k);const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.imageSmoothingQuality='high';x.drawImage(img,0,0,c.width,c.height);
  // 1 pt ≈ 1/72 pulgada; una foto de hoja A4 de ~2400 px de alto → ~3,4 px por punto
  const sc=Math.max(c.width,c.height)/842;pages.push({blocks:await TX.analyzeCanvas(c,{ocr:true,scale:sc,onProg}),ocr:true,scale:sc});c.width=c.height=1}return pages};

/* ---------- 7. Word (.docx) leído de su XML ---------- */
TX.fromDocx=async function(ab){await loadLib('jszip');const zip=await JSZip.loadAsync(ab);const xml=await zip.file('word/document.xml').async('string');const doc=new DOMParser().parseFromString(xml,'application/xml');
  const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main',q=(el,n)=>[...el.childNodes].filter(e=>e.namespaceURI===W&&e.localName===n),q1=(el,n)=>q(el,n)[0],val=e=>e&&(e.getAttributeNS(W,'val')||e.getAttribute('w:val'));
  const runBold=r=>{const rp=q1(r,'rPr');const b=rp&&q1(rp,'b');return !!b&&val(b)!=='0'&&val(b)!=='false'};
  const paraText=p=>{let t='',allB=true,any=false;for(const r of p.getElementsByTagNameNS(W,'r')){for(const n of r.childNodes){if(n.namespaceURI!==W)continue;if(n.localName==='t'){t+=n.textContent;if(n.textContent.trim()){any=true;if(!runBold(r))allB=false}}else if(n.localName==='tab')t+='\t';else if(n.localName==='br')t+='\n'}}
    const pp=q1(p,'pPr'),jc=pp&&q1(pp,'jc');return {t,b:any&&allB,al:jc&&val(jc)}};
  const body=doc.getElementsByTagNameNS(W,'body')[0],blocks=[];let y=0;
  for(const el of body.childNodes){if(el.namespaceURI!==W)continue;
    if(el.localName==='p'){const P=paraText(el);if(P.t.trim())blocks.push({kind:'text',y:y++,rows:[[{v:P.t.replace(/\t+/g,'   '),b:P.b,al:P.al}]],merges:[],widths:[]});continue}
    if(el.localName!=='tbl')continue;
    const grid=q1(el,'tblGrid'),gw=grid?q(grid,'gridCol').map(g=>(+(g.getAttributeNS(W,'w')||g.getAttribute('w:w'))||1440)/20):[];
    const rows=[],merges=[],vOpen={};
    q(el,'tr').forEach((tr,r)=>{const row=[];let c=0;
      for(const tc of q(tr,'tc')){const pr=q1(tc,'tcPr'),gs=pr&&q1(pr,'gridSpan'),span=gs?+val(gs)||1:1,vm=pr&&q1(pr,'vMerge'),shd=pr&&q1(pr,'shd');
        const ps=q(tc,'p').map(paraText),t=ps.map(p=>p.t).join('\n').trim(),b=ps.some(p=>p.t.trim())&&ps.filter(p=>p.t.trim()).every(p=>p.b),al=(ps.find(p=>p.al)||{}).al;
        const fill=shd&&(shd.getAttributeNS(W,'fill')||shd.getAttribute('w:fill'));const cell={v:t,b,border:true,al,fill:fill&&/^[0-9A-F]{6}$/i.test(fill)&&fill.toUpperCase()!=='FFFFFF'?fill.toUpperCase():null};
        if(vm&&val(vm)!=='restart'&&vOpen[c]){vOpen[c].r2=r;row[c]={v:'',border:true}}else{row[c]=cell;if(vm&&val(vm)==='restart')vOpen[c]={r1:r,c1:c,r2:r,c2:c+span-1};else delete vOpen[c]}
        if(span>1&&!(vm&&val(vm)!=='restart'&&vOpen[c]&&vOpen[c].r1!==r))merges.push({r1:r,c1:c,r2:r,c2:c+span-1,_h:true});
        for(let k=1;k<span;k++)row[c+k]={v:'',border:true};c+=span}
      rows.push(row)});
    blocks.push({kind:'grid',y:y++,rows,merges:TX._docxMerges(el,W,q,q1,val,merges),widths:gw})}
  return [{blocks}]};
/* recalcula las combinadas verticales recorriendo la tabla (vMerge «restart» abre, vMerge vacío continúa) */
TX._docxMerges=function(tbl,W,q,q1,val,hMerges){const res=hMerges.map(m=>({r1:m.r1,c1:m.c1,r2:m.r2,c2:m.c2}));const open={};
  q(tbl,'tr').forEach((tr,r)=>{let c=0;const seen=new Set();for(const tc of q(tr,'tc')){const pr=q1(tc,'tcPr'),gs=pr&&q1(pr,'gridSpan'),span=gs?+val(gs)||1:1,vm=pr&&q1(pr,'vMerge');
    if(vm&&val(vm)==='restart'){open[c]={r1:r,c1:c,r2:r,c2:c+span-1}}else if(vm&&open[c]){open[c].r2=r}else if(open[c]){const o=open[c];if(o.r2>o.r1)res.push(o);delete open[c]}seen.add(c);c+=span}
    for(const k of Object.keys(open))if(!seen.has(+k)){const o=open[k];if(o.r2>o.r1)res.push(o);delete open[k]}});
  for(const k in open){const o=open[k];if(o.r2>o.r1)res.push(o)}
  // si una vertical incluye una horizontal de la misma fila de inicio, se queda la vertical (que ya cubre todo el ancho)
  return res.filter((m,i)=>!(m.r1===m.r2&&res.some((n,j)=>j!==i&&n.r2>n.r1&&n.r1===m.r1&&n.c1===m.c1&&n.c2===m.c2)))};

/* ---------- 8. valores: números y fechas de verdad, DNI y códigos como texto ---------- */
TX.typed=function(s){const t=String(s==null?'':s).trim();if(!t)return null;
  if(/^\d{1,2}\.\d{3}\.\d{3}$/.test(t)||/^0\d+/.test(t)||/^\d{2}-\d{8}-\d$/.test(t)||/^\d{10,}$/.test(t))return t;// DNI, CUIL, códigos con ceros
  let m;if(m=t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/)){let y=+m[3];if(y<100)y+=2000;const d=new Date(Date.UTC(y,+m[2]-1,+m[1]));if(d.getUTCDate()===+m[1])return {date:d}}
  if(m=t.match(/^(-?)\$?\s?(\d{1,3}(?:\.\d{3})+|\d+),(\d{1,2})$/))return {num:+(m[1]+m[2].replace(/\./g,'')+'.'+m[3]),fmt:'#,##0.'+'0'.repeat(m[3].length)};
  if(m=t.match(/^(-?)\$\s?(\d{1,3}(?:\.\d{3})+|\d+)$/))return {num:+(m[1]+m[2].replace(/\./g,'')),fmt:'"$" #,##0'};
  if(/^-?\d{1,9}$/.test(t))return {num:+t};
  if(m=t.match(/^(-?\d+(?:[.,]\d+)?)\s?%$/))return {num:+m[1].replace(',','.')/100,fmt:'0.##%'};
  return t};

/* ---------- 9. hojas → Excel ---------- */
TX.toSheets=function(pages,mode){const sheets=[];const mk=name=>({name,rows:[],merges:[],widths:[]});let cur=mode==='cada'?null:mk('Hoja1');
  pages.forEach((pg,pi)=>{if(mode==='cada'){cur=mk('Página '+(pi+1));sheets.push(cur)}else if(pi===0)sheets.push(cur);else if(cur.rows.length)cur.rows.push([]);
    for(const B of pg.blocks){if(cur.rows.length&&B.kind!=='text'&&cur.rows[cur.rows.length-1].length)cur.rows.push([]);const r0=cur.rows.length;
      B.rows.forEach(r=>cur.rows.push(r.map(c=>c)));for(const m of B.merges)cur.merges.push({r1:m.r1+r0,c1:m.c1,r2:m.r2+r0,c2:m.c2});
      B.widths.forEach((w,k)=>{cur.widths[k]=Math.max(cur.widths[k]||0,w)});
      if(B.kind!=='text'&&cur.rows.length>r0)cur.rows.push([])}
    while(cur.rows.length&&!cur.rows[cur.rows.length-1].length)cur.rows.pop()});
  return sheets};
TX.buildXlsx=async function(sheets){
  try{await loadLib('exceljs');const wb=new ExcelJS.Workbook();wb.creator='Danscanner Pro';
    for(const S0 of sheets){const ws=wb.addWorksheet(S0.name.slice(0,31).replace(/[\\/?*[\]:]/g,' '));let maxC=0;
      S0.rows.forEach((row,r)=>{row.forEach((c,k)=>{if(!c)return;maxC=Math.max(maxC,k+1);const cell=ws.getCell(r+1,k+1);const v=TX.typed(c.v);
        if(v&&typeof v==='object'){if(v.date){cell.value=v.date;cell.numFmt='dd/mm/yyyy'}else{cell.value=v.num;if(v.fmt)cell.numFmt=v.fmt}}else cell.value=v==null?null:v;
        cell.alignment={vertical:'top',wrapText:/\n/.test(c.v||'')||(c.border&&String(c.v||'').length>18),horizontal:c.al==='center'?'center':c.al==='right'||c.al==='end'?'right':undefined};
        if(c.b)cell.font={bold:true};if(c.fill)cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF'+c.fill}};
        if(c.border)cell.border={top:{style:'thin'},left:{style:'thin'},bottom:{style:'thin'},right:{style:'thin'}}})});
      for(const m of S0.merges){try{ws.mergeCells(m.r1+1,m.c1+1,m.r2+1,m.c2+1)}catch(e){}}
      // títulos sueltos: se combinan a lo ancho de la tabla para que no corten las columnas
      S0.rows.forEach((row,r)=>{if(row.length===1&&row[0]&&!row[0].border&&maxC>1){try{ws.mergeCells(r+1,1,r+1,maxC);ws.getCell(r+1,1).alignment={vertical:'top',wrapText:true,horizontal:row[0].al==='center'?'center':undefined}}catch(e){}}});
      for(let k=0;k<maxC;k++){const pt=S0.widths[k];const txt=Math.max(4,...S0.rows.map(r=>r[k]&&!(r.length===1)?Math.max(...String(r[k].v||'').split('\n').map(s=>s.length)):0));
        ws.getColumn(k+1).width=Math.max(6,Math.min(60,pt?pt/5.6:txt+2))}}
    const buf=await wb.xlsx.writeBuffer();return new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})}
  catch(e){console.warn('ExcelJS no disponible, uso SheetJS',e);await loadLib('xlsx');const wb=XLSX.utils.book_new();
    for(const S0 of sheets){const ws=XLSX.utils.aoa_to_sheet(S0.rows.map(r=>r.map(c=>{if(!c)return null;const v=TX.typed(c.v);return v&&typeof v==='object'?(v.date||v.num):v})),{cellDates:true});ws['!merges']=S0.merges.map(m=>({s:{r:m.r1,c:m.c1},e:{r:m.r2,c:m.c2}}));ws['!cols']=S0.widths.map(w=>({wch:Math.max(6,Math.min(60,(w||40)/5.6))}));XLSX.utils.book_append_sheet(wb,ws,S0.name.slice(0,31))}
    return new Blob([XLSX.write(wb,{type:'array',bookType:'xlsx'})],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})}};
/* vista previa como tabla HTML (lo mismo que va al Excel) */
TX.previewHtml=function(S0,maxRows=60){const esc2=s=>String(s==null?'':s).replace(/[&<>"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));const covered=new Set(),span={};
  for(const m of S0.merges){span[m.r1+','+m.c1]=m;for(let r=m.r1;r<=m.r2;r++)for(let c=m.c1;c<=m.c2;c++)if(r!==m.r1||c!==m.c1)covered.add(r+','+c)}
  const nc=Math.max(1,...S0.rows.map(r=>r.length));let h='<table class="tx-prev">';
  S0.rows.slice(0,maxRows).forEach((row,r)=>{h+='<tr>';if(row.length===1&&row[0]&&!row[0].border){h+='<td colspan="'+nc+'" class="t'+(row[0].b?' b':'')+'">'+esc2(row[0].v)+'</td></tr>';return}
    for(let c=0;c<nc;c++){if(covered.has(r+','+c))continue;const cell=row[c],m=span[r+','+c];h+='<td'+(m?' colspan="'+(m.c2-m.c1+1)+'" rowspan="'+(m.r2-m.r1+1)+'"':'')+' class="'+(cell&&cell.border?'g':'')+(cell&&cell.b?' b':'')+'"'+(cell&&cell.fill?' style="background:#'+cell.fill+'"':'')+'>'+esc2(cell?cell.v:'').replace(/\n/g,'<br>')+'</td>'}h+='</tr>'});
  return h+'</table>'+(S0.rows.length>maxRows?'<p class="muted">… y '+(S0.rows.length-maxRows)+' filas más</p>':'')};

/* ---------- 10. pantalla de la herramienta ---------- */
__mods.uiToExcel=function(el,{accept}={}){let files=[],camPages=null,last=null;
  el.innerHTML='<p class="muted tx-intro">Pasá un PDF, un Word o fotos de una planilla. Las tablas salen con sus columnas, celdas combinadas, negritas y bordes. Si es una foto o un escaneo, se lee solo con OCR.</p>'
   +'<div class="fp"></div><div class="row"><button class="btn" id="txCam"><i data-ico="camera">📷</i> Escanear la planilla con la cámara</button></div>'
   +'<div class="row">'+opt('Hojas del Excel',sel('txm',[['una','Todo en una hoja'],['cada','Una hoja por página']]))+opt('Leer con OCR',sel('txo',[['auto','Automático (si no tiene texto)'],['si','Siempre (PDF escaneado)']]))+'</div>'
   +'<button class="btn pri block run" id="txRun"><i data-ico="xlsx">📊</i> Convertir a Excel</button><div class="tx-prevw"></div><div class="result"></div>';
  try{iconize(el)}catch(e){}
  filePicker($('.fp',el),{accept:accept||'.pdf,application/pdf,.docx,image/*',multi:true,onChange:f=>{files=f;camPages=null;$('.result',el).innerHTML='';$('.tx-prevw',el).innerHTML=''}});
  $('#txCam',el).onclick=async()=>{if(typeof camSecure==='function'&&!camSecure())return toast('La cámara necesita HTTPS');const pages=await new Promise(res=>{_srcHook=res;Cam.open('batch')});if(pages&&pages.length){camPages=pages;files=[];toast(pages.length+' foto(s) listas: tocá Convertir a Excel')}};
  $('#txRun',el).onclick=()=>withBusy(async()=>{const prog=m=>busy(m);let pages=[],name='planilla';
    if(camPages&&camPages.length){const cs=[];for(const p of camPages)cs.push(await renderPage(p,{maxSide:2600}));pages=await TX.fromImages(cs,{onProg:prog});name='planilla escaneada'}
    else{if(!files.length)return toast('Elegí un archivo o escaneá la planilla');const imgs=[];
      for(const f of files){const nm=f.name.toLowerCase();name=f.name.replace(/\.[^.]+$/,'');
        if(/\.docx$/.test(nm))pages.push(...await TX.fromDocx(await f.arrayBuffer()));
        else if(/\.pdf$/.test(nm)||f.type==='application/pdf')pages.push(...await TX.fromPdf(await f.arrayBuffer(),{ocr:$('.txo',el).value,onProg:prog}));
        else if(/^image\//.test(f.type))imgs.push(URL.createObjectURL(f))}
      if(imgs.length){pages.push(...await TX.fromImages(imgs,{onProg:prog}));imgs.forEach(u=>URL.revokeObjectURL(u))}}
    await TX.endOcr();
    const sheets=TX.toSheets(pages,$('.txm',el).value);if(!sheets.some(s=>s.rows.length))throw new Error('No se encontró texto. Probá con una foto más nítida o activá OCR «Siempre».');
    busy('Armando el Excel…');const blob=await TX.buildXlsx(sheets);last={sheets,blob};
    const nRows=sheets.reduce((a,s)=>a+s.rows.length,0),ocrN=pages.filter(p=>p.ocr).length;
    $('.tx-prevw',el).innerHTML='<div class="cph">Vista previa'+(sheets.length>1?' · '+esc(sheets[0].name):'')+'</div><div class="tx-scroll">'+TX.previewHtml(sheets[0])+'</div>';
    busy(false);showResults($('.result',el),[{blob,name:name+'.xlsx',note:nRows+' filas · '+sheets.length+' hoja(s)'+(ocrN?' · '+ocrN+' página(s) leídas con OCR':'')}])});
  el._tx=()=>last};
__mods.TX=TX;window.TablaX=TX;
})();
