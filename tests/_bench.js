const {chromium}=require('playwright');const W=ms=>new Promise(r=>setTimeout(r,ms));const fs=require('fs');const SP='/tmp/claude-0/-home-user-Danscaner-Pro-/8a501787-a1ae-5d67-ac38-c99bab1f9884/scratchpad/det/';
(async()=>{const b=await chromium.launch();const pg=await b.newPage();pg.on('pageerror',e=>console.log('ERR',e.message));
await pg.route('**/config.js',r=>r.fulfill({body:'',contentType:'text/javascript'}));await pg.goto('http://localhost:8765/index.html');await W(1500);
await pg.addScriptTag({content:fs.readFileSync(SP+'scenes.js','utf8')});if(fs.existsSync(SP+'cand.js'))await pg.addScriptTag({content:fs.readFileSync(SP+'cand.js','utf8')});
const N=+process.argv[2]||60;
const r=await pg.evaluate(async N=>{const res=[];for(let i=1;i<=N;i++){const sc=makeScene(i);const img=await loadImg(sc.canvas.toDataURL('image/jpeg',.85));
  const t0=performance.now();let q=null;try{q=_v21_detect(img);if(q)q=refineQuad(img,q)}catch(e){}const t1=performance.now();
  let q2=null;if(window.docQuad2){try{q2=docQuad2(img);if(q2&&window.REF)q2=refineQuad(img,q2)}catch(e){console.log(e.message)}}const t2=performance.now();
  res.push({i,kind:sc.kind,bg:sc.bg,old:+quadIoU(sc.quad,q).toFixed(3),nw:window.docQuad2?+quadIoU(sc.quad,q2).toFixed(3):null,to:Math.round(t1-t0),tn:Math.round(t2-t1)})}return res},N);
const avg=k=>(r.reduce((a,x)=>a+x[k],0)/r.length).toFixed(3),bad=k=>r.filter(x=>x[k]<.9).length;
console.log('actual  IoU prom',avg('old'),' malas(<0.9):',bad('old'),' ms',avg('to'));if(r[0].nw!==null)console.log('nuevo   IoU prom',avg('nw'),' malas(<0.9):',bad('nw'),' ms',avg('tn'));
if(process.argv[3])console.log(JSON.stringify(r.filter(x=>x.old<.9||(x.nw!==null&&x.nw<.9))));
if(process.argv[4]){const ids=process.argv[4].split(',').map(Number);for(const id of ids){const u=await pg.evaluate(async id=>{const sc=makeScene(id);const img=await loadImg(sc.canvas.toDataURL('image/jpeg',.85));let q=_v21_detect(img);if(q)q=refineQuad(img,q);const q2=window.docQuad2?docQuad2(img):null;const c=sc.canvas,x=c.getContext('2d');const dr=(qq,col)=>{if(!qq)return;x.strokeStyle=col;x.lineWidth=8;x.beginPath();qq.forEach((p,i)=>i?x.lineTo(p.x*c.width,p.y*c.height):x.moveTo(p.x*c.width,p.y*c.height));x.closePath();x.stroke()};dr(sc.quad,'#00ff00');dr(q,'#ff0000');dr(q2,'#00c8ff');const t=document.createElement('canvas');t.width=c.width/4;t.height=c.height/4;t.getContext('2d').drawImage(c,0,0,t.width,t.height);return t.toDataURL('image/png')},id);fs.writeFileSync(SP+'s'+id+'.png',Buffer.from(u.split(',')[1],'base64'))}}
await b.close()})();
