/* Danscanner Pro · Worker de la cámara (v73)
 * Corre fuera del hilo de la interfaz: recibe cada cuadro como ImageBitmap (transferido, sin copiar),
 * detecta el documento y devuelve esquinas + luz + nitidez + tiempos por etapa.
 * Motores: 'js' (mod/vision-core.js, liviano, sin descargas) u 'opencv' (OpenCV.js 4.10, Apache-2.0,
 * se descarga una sola vez desde el mismo sitio cuando el usuario lo activa en Ajustes).
 * Si OpenCV no carga o falla, vuelve solo al motor JS. */
'use strict';
importScripts('vision-core.js');
const V=self.DSVision;
let cfg=Object.assign({},V.VISION_CFG),engine='js',cv=null,cvState='off',oc=null,ox=null,B={};
let M=null;// matrices de OpenCV reusadas entre cuadros (se liberan al cambiar de tamaño o de motor)

function freeCv(){if(M){for(const k of Object.keys(M))try{M[k].delete()}catch(e){}M=null}}
async function loadCv(url){
  if(cv)return cv;cvState='loading';post({type:'engine',engine:'opencv',state:'loading'});const t0=performance.now();
  importScripts(url);const m=self.cv;if(!m)throw new Error('OpenCV no se cargó');
  /* el módulo de Emscripten trae un .then propio que nunca termina si se lo espera con await: se usa su callback y después se borra */
  if(!m.Mat)await new Promise((res,rej)=>{const to=setTimeout(()=>rej(new Error('OpenCV no respondió')),45000);const ok=()=>{clearTimeout(to);res()};
    if(typeof m.then==='function')m.then(()=>ok());else m.onRuntimeInitialized=ok});
  try{delete m.then}catch(e){}
  cv=m;cvState='ready';post({type:'engine',engine:'opencv',state:'ready',ms:Math.round(performance.now()-t0)});return cv;
}
/* Pilar 1 con OpenCV: gris → GaussianBlur 5×5 → Canny(75,200) → dilatar → findContours(RETR_LIST, CHAIN_APPROX_SIMPLE)
 * → convexHull → approxPolyDP(0,02·perímetro) con 4 vértices y convexo → el de mayor puntaje (área × bordes). */
function detectCv(id,w,h){
  const t0=performance.now();
  if(!M||M.w!==w||M.h!==h){freeCv();M={src:new cv.Mat(h,w,cv.CV_8UC4),gray:new cv.Mat(),blur:new cv.Mat(),edges:new cv.Mat(),dil:new cv.Mat(),k:cv.Mat.ones(3,3,cv.CV_8U)};M.w=w;M.h=h}
  M.src.data.set(id.data);
  cv.cvtColor(M.src,M.gray,cv.COLOR_RGBA2GRAY);const t1=performance.now();
  cv.GaussianBlur(M.gray,M.blur,new cv.Size(cfg.blur,cfg.blur),0,0,cv.BORDER_DEFAULT);const t2=performance.now();
  cv.Canny(M.blur,M.edges,cfg.cannyLo,cfg.cannyHi);cv.dilate(M.edges,M.dil,M.k);const t3=performance.now();
  const contours=new cv.MatVector(),hier=new cv.Mat();let best=null;
  try{
    cv.findContours(M.dil,contours,hier,cv.RETR_LIST,cv.CHAIN_APPROX_SIMPLE);
    const dil=M.dil.data,n=w*h;
    for(let i=0;i<contours.size();i++){const c=contours.get(i);try{
      if(cv.contourArea(c)<cfg.minAreaFrac*n*0.5)continue;
      const hull=new cv.Mat(),ap=new cv.Mat();try{
        cv.convexHull(c,hull,false,true);const per=cv.arcLength(hull,true);
        for(let f=cfg.approxEps;f<=0.0801;f+=0.01){cv.approxPolyDP(hull,ap,f*per,true);if(ap.rows<=4)break}
        if(ap.rows!==4||!cv.isContourConvex(ap))continue;
        const q=[];for(let k=0;k<4;k++)q.push({x:ap.data32S[k*2],y:ap.data32S[k*2+1]});
        if(!V.validQuad(q,w,h,cfg))continue;
        const sup=V.edgeSupport(q,dil,w,h),area=V.polyArea(q)/n,sc=area*(0.25+0.75*sup)*(0.5+0.5*sup);
        if(sup>=cfg.minSupport&&(!best||sc>best.sc))best={q,sc,sup};
      }finally{hull.delete();ap.delete()}
    }finally{c.delete()}}
  }finally{contours.delete();hier.delete()}
  const t4=performance.now();
  const g=M.gray.data;let quad=null,bs;
  if(best){const q=V.orderCorners(best.q);quad=q.map(p=>({x:(p.x+.5)/w,y:(p.y+.5)/h}));const xs=q.map(p=>p.x),ys=q.map(p=>p.y),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys),dx=(x1-x0)*.2,dy=(y1-y0)*.2;bs=V.blurScore(g,w,h,x0+dx,y0+dy,x1-dx,y1-dy)}
  else bs=V.blurScore(g,w,h,w*.25,h*.25,w*.75,h*.75);
  const L=V.lumaStats(g,w*h);const t5=performance.now();
  return {quad,conf:best?Math.round(best.sup*100)/100:0,src:'opencv',luma:Math.round(L.mean),p5:L.p5,p95:L.p95,blur:Math.round(bs.lapVar),std:Math.round(bs.std),
    t:{gray:+(t1-t0).toFixed(2),blur:+(t2-t1).toFixed(2),canny:+(t3-t2).toFixed(2),contours:+(t4-t3).toFixed(2),total:+(t5-t0).toFixed(2)}};
}
function post(m){self.postMessage(m)}
self.onmessage=async e=>{const m=e.data;
  try{
    if(m.type==='config'){Object.assign(cfg,m.cfg||{});return}
    if(m.type==='engine'){
      if(m.engine==='opencv'){try{await loadCv(m.url);engine='opencv'}catch(err){cvState='error';engine='js';post({type:'engine',engine:'js',state:'fallback',err:String(err&&err.message||err)})}}
      else{engine='js';freeCv();post({type:'engine',engine:'js',state:'ready'})}
      return}
    if(m.type==='dispose'){freeCv();B={};oc=ox=null;return}
    if(m.type==='frame'){
      // tamaño pedido (si el navegador ignoró resizeWidth/resizeHeight, se achica acá y no se analiza un cuadro 4K)
      const bm=m.bitmap,w=m.w||bm.width,h=m.h||bm.height;
      if(!oc||oc.width!==w||oc.height!==h){oc=new OffscreenCanvas(w,h);ox=oc.getContext('2d',{willReadFrequently:true});B={}}
      ox.drawImage(bm,0,0,w,h);bm.close();// el ImageBitmap se libera enseguida
      const id=ox.getImageData(0,0,w,h);let r;
      if(engine==='opencv'&&cv){try{r=detectCv(id,w,h)}catch(err){engine='js';freeCv();post({type:'engine',engine:'js',state:'fallback',err:String(err&&err.message||err)});r=V.detectDocument(id.data,w,h,cfg,B)}}
      else r=V.detectDocument(id.data,w,h,cfg,B);
      r.engine=engine==='opencv'&&cv?'opencv':'js';r.seq=m.seq;r.w=w;r.h=h;r.ts=m.ts;
      post({type:'result',r});
    }
  }catch(err){post({type:'error',seq:m&&m.seq,err:String(err&&err.message||err)})}
};
post({type:'hello',engine:'js'});
