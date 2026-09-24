// Pruebas de extremo a extremo de Danscanner Pro (Chromium con Playwright).
// Uso: servir la carpeta del proyecto en BASE_URL (por defecto http://localhost:8765) y correr `npm test`.
const {chromium}=require('playwright');
const assert=require('assert/strict');
const BASE=process.env.BASE_URL||'http://localhost:8765';
const W=ms=>new Promise(r=>setTimeout(r,ms));
const results=[];

async function newPage(browser){
  const pg=await browser.newPage({viewport:{width:390,height:844}});
  pg.errors=[];pg.on('pageerror',e=>pg.errors.push(e.message));
  await pg.route('**/config.js',r=>r.fulfill({body:'',contentType:'text/javascript'}));
  await pg.goto(BASE+'/index.html');await W(1200);
  await pg.evaluate(async()=>{for(const m of await DB.metas())await DB.delDoc(m.id);localStorage.removeItem('ds_nexa');S.lastBackup=Date.now();saveS();refreshLists()});
  return pg;
}
const DB_count=pg=>pg.evaluate(async()=>(await DB.metas()).length);
const seedPage=pg=>pg.evaluate(async()=>{const c=document.createElement('canvas');c.width=500;c.height=700;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,500,700);x.fillStyle='#000';x.font='36px Arial';x.fillText('OFICIO 55',40,90);window._pg=await makePage(c.toDataURL('image/jpeg',.9),{auto:false,filter:'magia'})});
const OFICIO='OFICIO N° 55/2026\nExpte. 23-26/2026. San Miguel de Tucumán, 12 de octubre de 2026.\nSe informa al Juzgado que el interno Juan Carlos PÉREZ, DNI 30.123.456, CUIL 20-30123456-7, solicita audiencia. El juez Martín Gómez fijó audiencia para el 20/10/2026. Se abonó $ 15.000,00. Contacto: tel. 381 555-1234, mail juzgado@justucuman.gov.ar.';

async function test(name,fn){const browser=await chromium.launch({args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});let pg;
  try{pg=await newPage(browser);await fn(pg);assert.deepEqual(pg.errors,[],'errores de JavaScript');results.push(['✅',name])}
  catch(e){results.push(['❌',name,e.message.replace(/\s+/g,' ').slice(0,300)])}
  finally{await browser.close()}}

(async()=>{
await test('La app carga con el nombre y los íconos nuevos',async pg=>{
  assert.equal(await pg.title(),'Danscanner Pro');
  assert.equal((await pg.textContent('#topTitle')).trim(),'Danscanner Pro');
  assert.ok(await pg.$('#btnNexa'),'falta el botón Nexa arriba');
});

await test('Modo B/N puro (opcional): todos los filtros en blanco y negro exacto',async pg=>{await seedPage(pg);
  const r=await pg.evaluate(async()=>{S.printBW=true;const out={};for(const [f] of FILTERS){if(f==='original')continue;const p={...window._pg,filter:f,skew:undefined};const c=await renderPage(p,{maxSide:600});const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let bad=0;for(let i=0;i<d.length;i+=4)if(!((d[i]===0||d[i]===255)&&d[i]===d[i+1]&&d[i+1]===d[i+2]))bad++;out[f]=bad}return out});
  for(const [f,bad] of Object.entries(r))assert.equal(bad,0,'el filtro '+f+' dejó grises o color');
});

await test('Nexa básico: extrae datos y busca en los documentos',async pg=>{
  await pg.evaluate(async t=>{await DB.putDoc({id:'d1',name:'Oficio 55',created:1,updated:Date.now(),text:t,pages:[]});Nexa.attachDoc(await DB.getDoc('d1'))},OFICIO);
  await pg.click('#btnNexa');
  const ask=async q=>{await pg.fill('#nxIn',q);await pg.press('#nxIn','Enter');await W(700);return pg.evaluate(()=>Nexa.st.msgs.at(-1).text)};
  const datos=await ask('Extraé los datos');
  for(const v of ['30.123.456','20-30123456-7','Expte. 23-26/2026','12 de octubre de 2026','$ 15.000,00','juzgado@justucuman.gov.ar','Juan Carlos PÉREZ'])assert.ok(datos.includes(v),'falta '+v);
  assert.ok((await ask('Buscá "Pérez" en mis documentos')).includes('Oficio 55'));
});

await test('Asistente de origen: menú, confirmación y archivo cargado',async pg=>{
  await seedPage(pg);await pg.evaluate(async()=>{await DB.putDoc({id:'s1',name:'Guardado',created:1,updated:Date.now(),pages:[window._pg]});refreshLists()});
  await pg.evaluate(()=>openTool(TOOLS.findIndex(t=>t.name==='Comprimir PDF')));await W(600);
  assert.equal(await pg.$$eval('#sheetBody [data-src]',x=>x.length),4);
  await pg.click('#sheetBody [data-src="saved"]');await W(400);await pg.check('#sheetBody input[value="s1"]');await pg.click('#srcDocOk');await W(600);
  await pg.click('#srcYes');await W(2000);
  assert.match(await pg.textContent('#toolBody .flist'),/Guardado\.pdf/);
});

await test('Ajustes: hoja inferior, secciones plegables y cierre',async pg=>{
  await pg.click('#navSettings');await W(500);
  assert.equal(await pg.evaluate(()=>document.body.style.position),'fixed','no bloquea el fondo');
  assert.ok(await pg.$('#sBackup'),'falta la fila de respaldo');
  await pg.click('#sheetBody .acc .acc-h');await W(400);assert.equal(await pg.$$eval('#sheetBody .acc.open',x=>x.length),1);
  await pg.mouse.click(195,20);await W(500);
  assert.equal(await pg.evaluate(()=>Nav.isOpen('sheet')),false,'tocar afuera no cierra');
});

await test('Respaldo: crear con contraseña y restaurar sin duplicar',async pg=>{
  await seedPage(pg);
  const r=await pg.evaluate(async()=>{await DB.putDoc({id:'b1',name:'Oficio',created:1,updated:1000,text:'texto',folder:'Expte 1',tags:['Judicial'],pages:[window._pg]});
    const bk=await Backup.create({pass:'clave123'});await DB.delDoc('b1');
    let bad='';try{await Backup.open(new File([bk.blob],bk.name),'mala')}catch(e){bad=e.message}
    const data=await Backup.open(new File([bk.blob],bk.name),'clave123');const r1=await Backup.restore(data);const r2=await Backup.restore(data);
    const d=await DB.getDoc('b1');return {bad,r1,r2,same:d.pages[0].orig===window._pg.orig,folder:d.folder}});
  assert.match(r.bad,/Contraseña incorrecta/);assert.equal(r.r1.added,1);assert.equal(r.r2.skipped,1);assert.ok(r.same);assert.equal(r.folder,'Expte 1');
});

await test('Organización: nombre, carpeta y etiqueta automáticos',async pg=>{
  await seedPage(pg);
  const r=await pg.evaluate(async t=>{await DB.putDoc({id:'o1',name:'Escaneo 24-09-2026 10.00',created:1,updated:Date.now(),text:t,pages:[window._pg]});await Org.auto('o1');const m=(await DB.metas()).find(x=>x.id==='o1');
    await DB.putDoc({id:'o2',name:'Mi nombre',created:1,updated:Date.now(),text:t,pages:[window._pg]});await Org.auto('o2');const m2=(await DB.metas()).find(x=>x.id==='o2');return {m,m2}},OFICIO);
  assert.equal(r.m.name,'Oficio · Expte 23-26/2026 · 12-10-2026');assert.equal(r.m.folder,'Expte 23-26/2026');assert.deepEqual(r.m.tags,['Judicial']);
  assert.equal(r.m2.name,'Mi nombre','pisó un nombre manual');
  await pg.click('.nav [data-go="docs"]');await W(300);
  assert.match(await pg.textContent('#docFolders'),/Expte 23-26\/2026/);
});

await test('Nexa: configuración gratis desde Ajustes',async pg=>{
  await pg.click('#navSettings');await W(500);await pg.click('#sAI');await W(700);
  assert.equal((await pg.textContent('#sheetTitle')).trim(),'Nexa · configuración');
});

await test('Nexa acciones: confirma antes de actuar y no confunde "borrador"',async pg=>{
  await seedPage(pg);
  await pg.evaluate(async()=>{const n=Date.now();await DB.putDoc({id:'a',name:'Oficio 55',created:1,updated:n-2000,text:'OFICIO 55',pages:[window._pg,window._pg]});await DB.putDoc({id:'b',name:'Oficio 60',created:1,updated:n-1000,text:'OFICIO 60',pages:[window._pg]});await DB.putDoc({id:'c',name:'Borrador del escrito',created:1,updated:n-5000,text:'Borrador con texto suficiente para convertir a Word.',pages:[window._pg]})});
  await pg.click('#btnNexa');
  const say=async q=>{await pg.fill('#nxIn',q);await pg.press('#nxIn','Enter');await W(700);return pg.evaluate(()=>{const m=Nexa.st.msgs.at(-1);return (m.action&&{k:m.action.kind,docs:m.action.docs.map(d=>d.name)})||null})};
  let a=await say('Uní los 2 últimos oficios');assert.deepEqual(a,{k:'merge',docs:['Oficio 60','Oficio 55']});
  assert.equal((await DB_count(pg)),3,'actuó sin confirmar');
  await pg.click('#nxLog .na-card [data-act="yes"]');await W(2500);assert.equal(await DB_count(pg),4);
  a=await say('Convertí el borrador a Word');assert.equal(a.k,'word');assert.deepEqual(a.docs,['Borrador del escrito']);
  a=await say('¿Cómo comprimo un PDF?');assert.equal(a,null,'una pregunta no debe ser una acción');
});

await test('Modo DNI: frente y dorso en A4 a tamaño real',async pg=>{
  await seedPage(pg);
  const r=await pg.evaluate(async()=>{const c=await dniCompose(window._pg,window._pg,{mode:'gris',guide:true});return {w:c.width,h:c.height}});
  assert.deepEqual(r,{w:2480,h:3508});
});

await test('Filtro Documento: papel blanco, texto negro y tinta azul conservada',async pg=>{
  const r=await pg.evaluate(async()=>{const W=1000,H=1300,c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');const g=x.createLinearGradient(0,0,W,H);g.addColorStop(0,'#f2ecd6');g.addColorStop(1,'#a69c84');x.fillStyle=g;x.fillRect(0,0,W,H);
    x.fillStyle='#262626';x.font='28px serif';for(let i=0;i<14;i++)x.fillText('Se informa que el interno Juan Pérez, DNI 30.123.456, causa N° 23-26.',60,120+i*44);
    x.strokeStyle='#1d3fb8';x.lineWidth=5;x.beginPath();x.moveTo(560,1000);for(let t=0;t<25;t++)x.lineTo(560+t*14,1000-Math.sin(t)*40);x.stroke();
    const p=await makePage(c.toDataURL('image/jpeg',.9),{auto:false,filter:'documento'});
    const st=async f=>{const cv=await renderPage({...p,filter:f},{maxSide:1000});const d=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data,k=cv.width/W;
      const reg=(x0,y0,x1,y1,fn)=>{let n=0,m=0;for(let y=Math.floor(y0*k);y<y1*k;y+=2)for(let xx=Math.floor(x0*k);xx<x1*k;xx+=2){const i=(y*cv.width+xx)*4;n++;if(fn(d[i],d[i+1],d[i+2]))m++}return m/n};
      return {paper:reg(40,1150,960,1280,(r,g,b)=>r>=250&&g>=250&&b>=250),blue:reg(560,940,920,1050,(r,g,b)=>b>r+40&&b>g+25),dark:reg(60,98,900,125,(r,g,b)=>r<70&&g<70&&b<70)}};
    const doc=await st('documento');S.printBW=true;const bw=await st('documento');S.printBW=false;return {doc,bw}});
  assert.ok(r.doc.paper>.98,'papel no blanco: '+r.doc.paper);assert.ok(r.doc.blue>.05,'se perdió la tinta azul');assert.ok(r.doc.dark>.05,'texto no negro');
  assert.equal(r.bw.blue,0,'el modo B/N puro no debe dejar color');
});

await test('PDF buscable: texto Unicode sin caracteres rotos',async pg=>{
  const r=await pg.evaluate(async()=>{await loadLib('pdflib');const {PDFDocument,rgb}=PDFLib;const doc=await PDFDocument.create();const page=doc.addPage([595,842]);const font=await pdfTextFont(doc);
    const words=['Tucumán','“Expte.”','N°','23-26/2026','Peñaloza'].map((text,i)=>({text,bbox:{x0:10+i*120,y0:10,x1:120+i*120,y1:40}}));
    pdfTextLayer(page,words,{dx:0,dy:0,dw:595,dh:842,cw:700,ch:1000,ph:842,font,rgb});const bytes=await doc.save();
    await loadLib('pdfjs');const pd=await pdfjsLib.getDocument({data:bytes}).promise;const tc=await (await pd.getPage(1)).getTextContent();return tc.items.map(i=>i.str).join(' ')});
  for(const w of ['Tucumán','“Expte.”','N°','23-26/2026','Peñaloza'])assert.ok(r.includes(w),'falta '+w+' en: '+r);
  assert.ok(!/\d{6,}/.test(r.replace('23-26/2026','')),'aparecen bloques de números');
});

await test('Editor: tono, deshacer/rehacer, presets y aplicar a todas',async pg=>{await seedPage(pg);
  await pg.evaluate(async()=>{DOC=newDoc();DOC.pages.push({...window._pg,id:uid()},{...window._pg,id:uid()});openDocScreen();Ed.open(0)});await W(900);
  await pg.click('[data-ed="adj"]');
  await pg.fill('#edA_shadows','40');await pg.dispatchEvent('#edA_shadows','input');await W(700);
  assert.equal(await pg.evaluate(()=>Ed.p.shadows),40);
  await pg.click('#edUndo');await W(600);assert.equal(await pg.evaluate(()=>Ed.p.shadows),0,'deshacer no volvió a 0');
  await pg.click('#edRedo');await W(600);assert.equal(await pg.evaluate(()=>Ed.p.shadows),40,'rehacer no funcionó');
  await pg.selectOption('#edPreset','0');await W(500);assert.equal(await pg.evaluate(()=>Ed.p.filter),'magia');
  pg.once('dialog',d=>d.accept());await pg.click('#edApplyAll');await W(1500);
  assert.equal(await pg.evaluate(()=>DOC.pages[1].sharp),await pg.evaluate(()=>Ed.p.sharp));
});

await test('Datos del documento: corrige OCR y extrae nombres, DNI, expte y fechas',async pg=>{await seedPage(pg);
  const txt='OFICIO N* 1234/26\nSan Miguel de Tucumán, 23 de septiembre de 2026\nExpte. N° 23-26/2O26\nEl interno LUCENA, Juan Benjamín, D.N.l 3O.l23.456, CUIL 20-30123456-3, el 22/O9/26. SOS y OSO.';
  const e=await pg.evaluate(t=>nbEntities(t),txt);
  assert.deepEqual(e.dni,['30.123.456']);assert.ok(e.personas.includes('LUCENA, Juan Benjamín'),'nombre: '+e.personas);
  assert.ok(e.expedientes.some(x=>x.includes('23-26/2026')),'expte: '+e.expedientes);assert.ok(e.fechas.includes('22/09/26'));
  assert.ok((await pg.evaluate(t=>ocrFixNums(t),txt)).includes('SOS y OSO'),'tocó palabras');
  assert.equal(await pg.evaluate(()=>cuilOk('20-30123456-3')),true);assert.equal(await pg.evaluate(()=>cuilOk('20-12345678-9')),false);
  await pg.evaluate(t=>{DOC=newDoc();DOC.pages.push({...window._pg,id:uid()});DOC.text=t;openDocScreen()},txt);await W(600);
  await pg.click('#docData');await W(700);const body=await pg.textContent('#sheetBody');
  for(const w of ['30.123.456','LUCENA, Juan Benjamín','23/09/2026','Copiar todo'])assert.ok(body.includes(w),'falta '+w);
});

await test('Cámara: bordes precisos, modo Libro y auto-captura sin repetir',async pg=>{
  const err=await pg.evaluate(async()=>{const c=document.createElement('canvas');c.width=3024;c.height=4032;const x=c.getContext('2d');x.fillStyle='#4a3f33';x.fillRect(0,0,3024,4032);
    const P=[[300,260],[2650,380],[2560,3700],[180,3560]];x.beginPath();x.moveTo(...P[0]);P.slice(1).forEach(p=>x.lineTo(...p));x.closePath();x.fillStyle='#f1ecdf';x.fill();
    const p=await makePage(c.toDataURL('image/jpeg',.9),{filter:'documento'});return Math.max(...p.quad.map((q,i)=>Math.hypot(q.x*3024-P[i][0],q.y*4032-P[i][1])))});
  assert.ok(err<10,'esquinas imprecisas: '+err+' px');
  const cut=await pg.evaluate(async()=>{const c=document.createElement('canvas');c.width=2400;c.height=1700;const x=c.getContext('2d');x.fillStyle='#222';x.fillRect(0,0,2400,1700);x.fillStyle='#f4efe2';x.fillRect(150,150,2100,1400);
    const g=x.createLinearGradient(1100,0,1300,0);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(.5,'rgba(0,0,0,.45)');g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(1100,150,200,1400);
    const ps=await splitBook(await makePage(c.toDataURL('image/jpeg',.9)));return [ps.length,ps[0].quad[1].x*2400]});
  assert.equal(cut[0],2);assert.ok(Math.abs(cut[1]-1200)<40,'lomo mal ubicado: '+cut[1]);
  await pg.evaluate(()=>{const _d=detectQuad;window.detectQuad=src=>src instanceof HTMLVideoElement?[{x:.2,y:.15},{x:.8,y:.15},{x:.8,y:.85},{x:.2,y:.85}]:_d(src);S.autoCapture=true;Cam.open('batch')});
  await W(5000);assert.equal(await pg.evaluate(()=>Cam.batch.length),1,'la auto-captura repitió la misma hoja o no capturó');
  assert.ok(await pg.$('#camKinds [data-kind="book"]'),'faltan los tipos de captura');
});

await test('Magia Pro calidad escáner: papel blanco, texto negro, azul conservado y sombra eliminada',async pg=>{
  const r=await pg.evaluate(async()=>{const W=1200,H=1600,c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');
    x.fillStyle='#e8e0c8';x.fillRect(0,0,W,H);x.fillStyle='#262626';x.font='bold 30px serif';for(let i=0;i<22;i++)x.fillText('Por la presente se informa al señor juez lo solicitado '+i,60,90+i*52);
    x.strokeStyle='#2438a8';x.lineWidth=4;x.beginPath();x.moveTo(700,1350);for(let t=0;t<25;t++)x.lineTo(700+t*16,1350-Math.sin(t*.8)*40);x.stroke();
    x.fillStyle='rgba(0,0,0,.42)';x.beginPath();x.moveTo(W*.6,0);x.lineTo(W,0);x.lineTo(W,H);x.lineTo(W*.35,H);x.fill();
    const p=await makePage(c.toDataURL('image/jpeg',.9),{auto:false,filter:'magia'});const cv=await renderPage(p,{maxSide:1200});const d=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data,sx=cv.width/W;
    const reg=(x0,y0,x1,y1,f)=>{let n=0,k=0;for(let y=Math.floor(y0*sx);y<y1*sx;y+=2)for(let xx=Math.floor(x0*sx);xx<x1*sx;xx+=2){const i=(y*cv.width+xx)*4;n++;if(f(d[i],d[i+1],d[i+2]))k++}return k/n};
    return {paperLit:reg(20,1450,400,1590,(r,g,b)=>r>=245&&g>=245&&b>=245),paperShadow:reg(1000,1450,1190,1590,(r,g,b)=>r>=245&&g>=245&&b>=245),
      text:reg(60,68,1100,96,(r,g,b)=>r<60&&g<60&&b<60),textShadow:reg(670,380,760,410,(r,g,b)=>r<60&&g<60&&b<60),blue:reg(700,1290,1100,1400,(r,g,b)=>b>r+50&&b>g+40)}});
  assert.ok(r.paperLit>.97&&r.paperShadow>.97,'papel no blanco '+JSON.stringify(r));
  assert.ok(r.text>.08&&r.textShadow>.08,'texto no negro '+JSON.stringify(r));assert.ok(r.blue>.03,'se perdió el azul '+JSON.stringify(r));
  assert.deepEqual(await pg.evaluate(()=>FILTERS.slice(0,9).map(f=>f[0])),['original','magia','mejorar','aclarar','color','sinsombra','gris','bn','ahorro']);
  assert.equal(await pg.evaluate(()=>S.filter),'magia');
});

await test('Birome azul clara: queda azul y marcada (no pálida)',async pg=>{
  const r=await pg.evaluate(async()=>{const W=1000,H=1300,c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');
    x.fillStyle='#ddd6c4';x.fillRect(0,0,W,H);x.strokeStyle='#222';x.lineWidth=3;for(let i=0;i<10;i++){x.beginPath();x.moveTo(40,100+i*100);x.lineTo(960,100+i*100);x.stroke()}
    x.strokeStyle='#8f96cf';x.lineWidth=2.5;for(let i=0;i<9;i++){x.beginPath();x.moveTo(300,150+i*100);for(let t=0;t<30;t++)x.lineTo(300+t*18,150+i*100-Math.sin(t*1.3)*18);x.stroke()}
    const out={};for(const f of ['magia','mejorar']){const p=await makePage(c.toDataURL('image/jpeg',.9),{auto:false,filter:f});const cv=await renderPage(p,{maxSide:1000});const d=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data;
      const Ls=[];for(let y=120;y<1000;y++)for(let xx=300;xx<840;xx++){const i=(y*cv.width+xx)*4;if(d[i+2]-d[i]>35)Ls.push(d[i]*.299+d[i+1]*.587+d[i+2]*.114)}Ls.sort((a,b)=>a-b);/* núcleo del trazo: el 30 % más oscuro (los bordes suaves no cuentan) */out[f]={n:Ls.length,L:Ls.length?Ls[Math.floor(Ls.length*.3)]:255}}return out});
  for(const f of ['magia','mejorar']){assert.ok(r[f].n>3000,f+': se perdió el azul '+JSON.stringify(r));assert.ok(r[f].L<135,f+': azul muy pálido '+JSON.stringify(r))}
});

await test('Birome con color diluido por la cámara: se reconstruye el azul sin teñir el negro',async pg=>{
  const r=await pg.evaluate(async()=>{const W=900,H=700,c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');
    x.fillStyle='#ddd6c4';x.fillRect(0,0,W,H);x.fillStyle='#1c1c1c';x.font='bold 34px sans-serif';for(let i=0;i<4;i++)x.fillText('PLANILLA DE ASISTENCIA',40,70+i*60);
    x.strokeStyle='#7c80b8';x.lineWidth=2.5;for(let i=0;i<4;i++){x.beginPath();x.moveTo(60,360+i*80);for(let t=0;t<40;t++)x.lineTo(60+t*19,360+i*80-Math.sin(t*1.2)*20);x.stroke()}
    /* croma diluida como en la cámara: se desenfoca solo el color */
    const id=x.getImageData(0,0,W,H),d=id.data,Y=new Float32Array(W*H);for(let i=0;i<W*H;i++)Y[i]=d[i*4]*.299+d[i*4+1]*.587+d[i*4+2]*.114;
    const bl=new Float32Array(W*H*3);const R=3;for(let y=0;y<H;y++)for(let xx=0;xx<W;xx++){let a=0,b=0,cc=0,n=0;for(let k=-R;k<=R;k++)for(let j=-R;j<=R;j++){const yy=y+k,x2=xx+j;if(yy<0||yy>=H||x2<0||x2>=W)continue;const q=(yy*W+x2)*4,l=Y[yy*W+x2];a+=d[q]-l;b+=d[q+1]-l;cc+=d[q+2]-l;n++}const o=(y*W+xx)*3;bl[o]=a/n;bl[o+1]=b/n;bl[o+2]=cc/n}
    for(let i=0;i<W*H;i++){d[i*4]=Y[i]+bl[i*3];d[i*4+1]=Y[i]+bl[i*3+1];d[i*4+2]=Y[i]+bl[i*3+2]}x.putImageData(id,0,0);
    const p=await makePage(c.toDataURL('image/jpeg',.88),{auto:false,filter:'magia'});const cv=await renderPage(p,{maxSide:900});const o=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data;
    let blue=0,dark=0,tint=0;for(let y=300;y<660;y++)for(let xx=50;xx<840;xx++){const i=(y*cv.width+xx)*4;if(o[i+2]-o[i]>35&&o[i]+o[i+1]+o[i+2]<600)blue++}
    for(let y=40;y<260;y++)for(let xx=40;xx<500;xx++){const i=(y*cv.width+xx)*4,l=o[i]*.299+o[i+1]*.587+o[i+2]*.114;if(l<80){dark++;if(Math.max(o[i],o[i+1],o[i+2])-Math.min(o[i],o[i+1],o[i+2])>40)tint++}}
    return {blue,dark,tint}});
  assert.ok(r.blue>2500,'no se recuperó el azul '+JSON.stringify(r));assert.ok(r.dark>5000&&r.tint/r.dark<.03,'el texto negro se tiñó '+JSON.stringify(r));
  assert.equal(await pg.evaluate(()=>S.maxCap),4200);
});

await test('Enderezado: sin cuñas blancas "cruzadas" fuera de la hoja',async pg=>{
  const r=await pg.evaluate(async()=>{const c=document.createElement('canvas');c.width=800;c.height=1000;const x=c.getContext('2d');x.fillStyle='#777';x.fillRect(0,0,800,1000);
    const src=c.toDataURL('image/jpeg',.9);const out={};
    const a=await makePage(src,{auto:false,filter:'original'});a.quad=[{x:.05,y:.05},{x:.95,y:.05},{x:.95,y:.95},{x:.05,y:.95}];const base=await renderPage({...a,skew:0},{maxSide:1000});a.skew=3;const ca=await renderPage(a,{maxSide:1000});out.q=[ca.width===base.width&&ca.height===base.height];
    const b=await makePage(src,{auto:false,filter:'original'});b.quad=null;b.skew=4;const cb=await renderPage(b,{maxSide:1000});const d=cb.getContext('2d').getImageData(0,0,cb.width,cb.height).data;
    const px=(xx,yy)=>{const i=(yy*cb.width+xx)*4;return d[i]};out.corners=[px(1,1),px(cb.width-2,1),px(1,cb.height-2),px(cb.width-2,cb.height-2)];return out});
  assert.ok(r.q[0],'con recorte no debe girarse de nuevo');assert.ok(r.corners.every(v=>v<200),'quedaron esquinas blancas: '+r.corners);
});

await test('Arranque sin ver el diseño anterior y Nexa arriba junto a Ajustes',async pg=>{
  assert.equal(await pg.evaluate(()=>document.documentElement.classList.contains('boot')),false,'la app quedó oculta');
  assert.equal(await pg.$('.nav [data-go="nexa"]'),null,'Nexa sigue en la barra de abajo');
  const labels=await pg.$$eval('.nav button',bs=>bs.map(b=>b.dataset.go||b.id||b.getAttribute('aria-label')));
  assert.deepEqual(labels,['home','docs','Escanear','tools','navSettings']);
  const [nx,st]=await Promise.all([pg.$eval('#btnNexa',e=>e.getBoundingClientRect().toJSON()),pg.$eval('#btnSettings',e=>e.getBoundingClientRect().toJSON())]);
  assert.ok(Math.abs(nx.top-st.top)<8&&nx.right<=st.left+2,'Nexa no está al lado de Ajustes');
  await pg.click('#btnNexa');await W(300);assert.ok(await pg.$eval('#v-nexa',e=>e.classList.contains('active')));
});

await test('Nexa conversa (nombre, versión, qué puede hacer) con botones; íconos profesionales sin internet',async pg=>{
  await pg.click('#btnNexa');await W(300);
  for(const q of ['¿Para qué servís?','¿Cómo te llamás?']){await pg.fill('#nxIn',q);await pg.click('#nxSend');await W(600)}
  const log=await pg.textContent('#nxLog');
  for(const w of ['Comprimir','Extraer datos','Soy Nexa IA','Versión','Nexa 3.'])assert.ok(log.includes(w),'falta '+w);
  assert.ok((await pg.$$('.nx-q')).length>=6,'faltan los botones interactivos');
  assert.equal(await pg.$$eval('#nxLog .nx-md',els=>els.some(e=>/\p{Extended_Pictographic}/u.test(e.textContent))),false,'quedaron emojis en Nexa');
  await pg.click('.nav [data-go="tools"]');await W(300);
  const t=await pg.$$eval('#toolsGrid .ic',els=>els.map(e=>!!e.querySelector('svg')&&!/\p{Extended_Pictographic}/u.test(e.textContent)));
  assert.ok(t.length>20&&t.every(Boolean),'herramientas con emojis');
  const lim=await pg.evaluate(async()=>{Object.defineProperty(navigator,'gpu',{value:{requestAdapter:async()=>({limits:{maxComputeWorkgroupStorageSize:16384},features:new Set()})},configurable:true});return NexaLocal.support()});
  /* con placa gráfica chica se ofrece el modo procesador y se explica el motivo */assert.equal(lim.cpu,true);assert.ok(/16 KB/.test(lim.gpuWhy),lim.gpuWhy);
});

await test('Editor: Mejorar imagen (se puede deshacer)',async pg=>{await seedPage(pg);
  await pg.evaluate(async()=>{DOC=newDoc();DOC.pages.push({...window._pg,id:uid(),filter:'original'});openDocScreen();Ed.open(0)});await W(900);
  const before=await pg.evaluate(async()=>{const c=await renderPage(Ed.p,{maxSide:500});return c.toDataURL().length});
  await pg.click('#editor [data-ed="enh"]');await W(700);assert.equal(await pg.evaluate(()=>Ed.p.enh),1);
  const after=await pg.evaluate(async()=>{const c=await renderPage(Ed.p,{maxSide:500});return c.toDataURL().length});assert.notEqual(before,after,'la imagen no cambió');
  await pg.click('#edUndo');await W(600);assert.ok(!await pg.evaluate(()=>Ed.p.enh),'deshacer no quitó la mejora');
});

await test('Nexa local por procesador (sin placa gráfica compatible) y saludo según la hora',async pg=>{
  await pg.evaluate(()=>{Object.defineProperty(navigator,'gpu',{value:{requestAdapter:async()=>({limits:{maxComputeWorkgroupStorageSize:16384},features:new Set()})},configurable:true})});
  const s=await pg.evaluate(()=>NexaLocal.support());assert.equal(s.cpu,true,'no ofrece el modo procesador');
  const r=await pg.evaluate(async()=>{const c=NexaLocal.cfg();c.url=location.origin+'/tests/tiny.gguf';const t=await NexaLocal.chat([{role:'user',content:'hola'}]);return {t,dl:c.downloaded,eng:c.engine}});
  assert.ok(r.t.length>0&&r.dl&&r.eng==='cpu','no respondió con el procesador: '+JSON.stringify(r));
  await pg.click('#btnNexa');await W(300);const h=await pg.textContent('#nxLog h3');assert.ok(/^(Buen día|Buenas tardes|Buenas noches), soy Nexa$/.test(h),h);
  await pg.fill('#nxIn','hola');await pg.click('#nxSend');await W(600);const log=await pg.textContent('#nxLog');
  assert.ok(/(buen día|buenas tardes|buenas noches)!/i.test(log)&&/(ayudo hoy|trabajamos hoy)/.test(log),log.slice(0,300));
  assert.ok(await pg.$('#btnNexa'));
});

await test('Gemini: acepta claves nuevas (AQ.) y la manda en la cabecera, no en la dirección',async pg=>{
  await pg.click('#btnNexa');await W(200);await pg.click('#nxCfg');await W(700);
  await pg.evaluate(()=>{window._f=window.fetch;window.fetch=async u=>/\/models\?/.test(String(u))?new Response(JSON.stringify({models:[{name:'models/gemini-3-flash',supportedGenerationMethods:['generateContent']}]}),{status:200}):window._f(u)});
  await pg.fill('#nlKey','AQ.Ab8RN6Kx_prueba-1234567890abcdef');await pg.click('#nlKeyGo');await W(500);
  await pg.evaluate(()=>{window.fetch=window._f});assert.equal(await pg.evaluate(()=>AI().models.gemini),'gemini-3-flash');
  assert.equal(await pg.evaluate(()=>AI().keys.gemini),'AQ.Ab8RN6Kx_prueba-1234567890abcdef');
  const req=await pg.evaluate(async()=>{let seen=null;const f=window.fetch;window.fetch=async(u,o)=>{seen={u:String(u),h:o&&o.headers};return new Response('data: {"candidates":[{"content":{"parts":[{"text":"ok"}]}}]}\n\n',{status:200,headers:{'Content-Type':'text/event-stream'}})};
    try{await aiChatStream([{role:'user',text:'hola'}],{prov:'gemini'})}catch(e){}window.fetch=f;return seen});
  assert.ok(req&&!/[?&]key=/.test(req.u),'la clave quedó en la dirección: '+(req&&req.u));assert.equal(req.h['x-goog-api-key'],'AQ.Ab8RN6Kx_prueba-1234567890abcdef');
});

await test('Gemini: si el modelo no existe para la clave, elige uno disponible solo',async pg=>{
  const r=await pg.evaluate(async()=>{const a=AI();a.keys.gemini='AQ.prueba-1234567890abcdefghij';a.models.gemini='gemini-viejo';const calls=[];const f=window.fetch;
    window.fetch=async(u,o)=>{u=String(u);calls.push(u);if(/\/models\?/.test(u))return new Response(JSON.stringify({models:[{name:'models/gemini-3-flash',supportedGenerationMethods:['generateContent']},{name:'models/gemini-3-flash-lite',supportedGenerationMethods:['generateContent']},{name:'models/gemini-embedding-001',supportedGenerationMethods:['embedContent']}]}),{status:200});
      if(/gemini-viejo/.test(u))return new Response(JSON.stringify({error:{message:'models/gemini-viejo is not found for API version v1beta'}}),{status:404});
      return new Response('data: {"candidates":[{"content":{"parts":[{"text":"¡Buenas tardes! ¿En qué te ayudo?"}]}}]}\n\n',{status:200,headers:{'Content-Type':'text/event-stream'}})};
    let out='';try{out=await aiChatStream([{role:'user',text:'hola'}],{prov:'gemini'})}catch(e){out='ERR '+e.message}window.fetch=f;return {out,model:AI().models.gemini}});
  assert.equal(r.model,'gemini-3-flash',JSON.stringify(r));assert.ok(/Buenas tardes/.test(r.out),JSON.stringify(r));
});

for(const [ok,name,err] of results)console.log(ok,name+(err?' → '+err:''));
const fails=results.filter(r=>r[0]==='❌').length;console.log('\n'+(results.length-fails)+'/'+results.length+' pruebas OK');process.exit(fails?1:0);
})();
