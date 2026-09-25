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
  /* las pruebas entran como administrador (Nexa está reservada al administrador mientras se desarrolla) */
  await pg.evaluate(()=>{SB.ready=true;SB.profile={id:'t',role:'admin',status:'activo'};applyPerms()});
  return pg;
}
const DB_count=pg=>pg.evaluate(async()=>(await DB.metas()).length);
const seedPage=pg=>pg.evaluate(async()=>{const c=document.createElement('canvas');c.width=500;c.height=700;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,500,700);x.fillStyle='#000';x.font='36px Arial';x.fillText('OFICIO 55',40,90);window._pg=await makePage(c.toDataURL('image/jpeg',.9),{auto:false,filter:'magia'})});
const OFICIO='OFICIO N° 55/2026\nExpte. 23-26/2026. San Miguel de Tucumán, 12 de octubre de 2026.\nSe informa al Juzgado que el interno Juan Carlos PÉREZ, DNI 30.123.456, CUIL 20-30123456-7, solicita audiencia. El juez Martín Gómez fijó audiencia para el 20/10/2026. Se abonó $ 15.000,00. Contacto: tel. 381 555-1234, mail juzgado@justucuman.gov.ar.';

async function test(name,fn){if(process.env.ONLY&&!name.includes(process.env.ONLY))return;const browser=await chromium.launch({args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});let pg;
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
  for(const w of ['Comprimir','Extraer datos','Soy Nexa IA','Versión','Nexa 4'])assert.ok(log.includes(w),'falta '+w);
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

await test('Nexa aprende (memoria local) y la conversación no se sale de la pantalla',async pg=>{
  await pg.click('#btnNexa');await W(300);
  for(const q of ['me llamo Daniel','recordá que trabajo en la Unidad 5','hola','¿Para qué servís?','¿Qué podés hacer?','hola']){await pg.fill('#nxIn',q);await pg.click('#nxSend');await W(450)}
  const log=await pg.textContent('#nxLog');assert.ok(/Hola, Daniel/.test(log),'no usa el nombre');
  const ctx=await pg.evaluate(()=>NexaMem.context());assert.ok(/Daniel/.test(ctx)&&/Unidad 5/.test(ctx),ctx);
  const lay=await pg.evaluate(()=>({doc:document.documentElement.scrollHeight,vh:innerHeight,inp:$('.nx-input').getBoundingClientRect().bottom,nav:$('.nav').getBoundingClientRect().top,min:Math.min(...[...document.querySelectorAll('#nxLog .nx-msg')].map(e=>e.getBoundingClientRect().height))}));
  assert.ok(lay.doc<=lay.vh+2,'la página se desplaza: '+JSON.stringify(lay));assert.ok(lay.inp<=lay.nav+2,'la barra de escritura queda tapada');assert.ok(lay.min>30,'mensajes aplastados '+lay.min);
  await pg.click('.nav [data-go="docs"]');await W(200);assert.equal(await pg.evaluate(()=>document.documentElement.classList.contains('nx-on')),false);
});

await test('Nexa aprende de Gemini: guarda respuestas, las reutiliza sin internet, "¿te sirvió?" y memoria automática',async pg=>{
  await pg.evaluate(()=>{const a=AI();a.keys.gemini='AQ.prueba-1234567890abcdefghij';a.models.gemini='gemini-3-flash';Nexa.st.prov='gemini';Nexa.st.docs=[];
    window._f=window.fetch;window.fetch=async(u,o)=>{const b=JSON.parse(o.body);const txt=JSON.stringify(b);
      const ans=/anotá SOLO datos/.test(txt)?'{"name":"","facts":["Trabaja con oficios judiciales del Servicio Penitenciario"],"len":"corto"}':'Para redactar un oficio de traslado indicá el número de expediente, el juzgado que lo ordena, los datos del interno, el destino y la fecha, y firmalo con sello.';
      return new Response('data: '+JSON.stringify({candidates:[{content:{parts:[{text:ans}]}}]})+'\n\n',{status:200,headers:{'Content-Type':'text/event-stream'}})}});
  await pg.click('#btnNexa');await W(200);
  for(const q of ['¿Cómo redacto un oficio de traslado?','gracias por la info','¿y quién lo firma?']){await pg.fill('#nxIn',q);await pg.click('#nxSend');await W(700)}
  await W(800);
  const kb=await pg.evaluate(()=>NexaKB.all().map(e=>e.q));assert.ok(kb.some(q=>/oficio de traslado/.test(q)),'no guardó la respuesta: '+kb);
  assert.ok(await pg.$('.nx-fb [data-fb="up"]'),'falta ¿Te sirvió?');await pg.click('.nx-fb [data-fb="up"] >> nth=0');await W(300);
  assert.ok(await pg.evaluate(()=>NexaKB.all().some(e=>e.good===true)));
  assert.ok(await pg.evaluate(()=>NexaMem.get().facts.some(f=>/oficios judiciales/.test(f))),'no hizo la memoria automática');
  /* sin internet: modo básico reutiliza lo aprendido */
  await pg.evaluate(()=>{window.fetch=window._f;Nexa.st.prov='basic';Nexa.st.msgs=[];Nexa.render()});
  await pg.fill('#nxIn','cómo redacto un oficio de traslado');await pg.click('#nxSend');await W(600);
  const log=await pg.textContent('#nxLog');assert.ok(/Respuesta aprendida/.test(log)&&/número de expediente/.test(log),log.slice(0,300));
  const ex=await pg.evaluate(()=>Nexa.localMsgs([{role:'user',text:'como hago un oficio de traslado'}])[0].content);assert.ok(/EJEMPLOS DE BUENAS RESPUESTAS/.test(ex));
});

await test('Paquete Nexa: plantillas, consultas sobre muchos documentos, voz y plazos',async pg=>{
  await pg.evaluate(async()=>{const mk=async(name,text,created)=>{const d=newDoc();d.name=name;d.text=text;d.created=created;d.autoDone=true;await DB.putDoc(d)};
    const now=Date.now(),in3=new Date(now+3*864e5),f=d=>pad2(d.getDate())+'/'+pad2(d.getMonth()+1)+'/'+d.getFullYear(),mes=new Date().toLocaleDateString('es-AR',{month:'long'});
    await mk('Oficio 55','OFICIO N° 55. San Miguel de Tucumán, 10 de '+mes+' de '+new Date().getFullYear()+'. Juzgado de Ejecución Penal II. Expte. N° 23-26/2026. El interno PÉREZ, Juan Carlos, DNI 30.123.456, será trasladado a Unidad 5.',now-864e5);
    await mk('Oficio 60','OFICIO N° 60. Expte. N° 99-10/2026. Interno GÓMEZ, Luis. DNI 28.555.444. La audiencia fue fijada para el día '+f(in3)+'.',now-2*864e5);
    window._mes=mes;await refreshLists()});await W(800);
  assert.ok(await pg.$('#plazosCard'),'no aparece la tarjeta de plazos en el inicio');
  await pg.click('#btnNexa');await W(300);const mes=await pg.evaluate(()=>window._mes);
  await pg.fill('#nxIn','¿Qué oficios de '+mes+' mencionan a Pérez?');await pg.click('#nxSend');await W(600);
  let log=await pg.textContent('#nxLog');assert.ok(/Encontré 1 oficio/.test(log)&&/Oficio 55/.test(log),log.slice(-400));
  await pg.fill('#nxIn','listame los expedientes de este mes');await pg.click('#nxSend');await W(600);log=await pg.textContent('#nxLog');assert.ok(/99-10\/2026/.test(log)&&/23-26\/2026/.test(log),log.slice(-400));
  await pg.fill('#nxIn','¿qué plazos tengo?');await pg.click('#nxSend');await W(500);log=await pg.textContent('#nxLog');assert.ok(/Audiencia/.test(log)&&/Oficio 60/.test(log),log.slice(-300));
  await pg.fill('#nxIn','recordame llamar al juzgado el 30/12');await pg.click('#nxSend');await W(500);assert.ok(await pg.evaluate(()=>Plazos.all().some(x=>/llamar al juzgado/i.test(x.label))));
  await pg.fill('#nxIn','haceme un oficio de traslado');await pg.click('#nxSend');await W(900);
  assert.equal(await pg.inputValue('[data-f="dni"]'),'28.555.444');await pg.click('#tplGo');await W(600);
  log=await pg.textContent('#nxLog');assert.ok(/GÓMEZ, Luis/.test(log)&&/99-10\/2026/.test(log),'plantilla sin datos');
  assert.ok(await pg.$('.nx-acts [data-nx="speak"]'),'falta el botón Escuchar');
  const sp=await pg.evaluate(()=>{let said='';Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{cancel(){},getVoices:()=>[],speak(u){said=u.text}}});NexaVoice.speak('**Hola** [[Botón|x]]');return said});assert.equal(sp,'Hola');
});

await test('Corregir texto: borra la palabra mal escrita, escribe la correcta y se puede deshacer',async pg=>{
  await pg.evaluate(async()=>{const c=document.createElement('canvas');c.width=700;c.height=500;const x=c.getContext('2d');x.fillStyle='#f4f1ea';x.fillRect(0,0,700,500);x.fillStyle='#1c2f9a';x.font='40px Arial';x.fillText('ACTA DE LIVERTAD',60,120);x.fillStyle='#111';x.fillText('Firma',60,300);
    const p=await makePage(c.toDataURL('image/jpeg',.95));DOC=newDoc();DOC.pages.push({...p,id:uid(),filter:'original',quad:null});openDocScreen();Ed.open(0)});await W(900);
  assert.ok(await pg.$('#editor [data-ed="fix"]'),'falta el botón Corregir');
  await pg.evaluate(()=>{Fix.ocr=async function(){}});await pg.click('#editor [data-ed="fix"]');await W(900);
  /* palabras como las devuelve el OCR (proporciones de la imagen) */
  await pg.evaluate(()=>{const W=Fix.base.width,H=Fix.base.height,m=canvas(4,4).getContext('2d');m.font='40px Arial';const bb=(t,x0,base)=>{const r=m.measureText(t);return {t,x:x0/700,y:(base-r.actualBoundingBoxAscent)/500,w:r.width/700,h:(r.actualBoundingBoxAscent+r.actualBoundingBoxDescent)/500}};
    const a=m.measureText('ACTA DE ').width;Fix.setWords([bb('ACTA',60,120),bb('DE',60+m.measureText('ACTA ').width,120),bb('LIVERTAD',60+a,120),bb('Firma',60,300)])});
  await pg.fill('#fxFind','livertad');await W(200);assert.equal(await pg.$$eval('#fxBoxes>b.hit',x=>x.length),1);
  await pg.click('#fxBoxes>b.hit');await W(300);assert.equal(await pg.inputValue('#fxTxt'),'LIVERTAD');
  await pg.fill('#fxTxt','LIBERTAD');await W(200);await pg.click('#fxApply');await W(700);
  const r=await pg.evaluate(async()=>{const p=Ed.p,f=p.fixes&&p.fixes[0];if(!f)return null;const c=await renderPage(p,{maxSide:1800}),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data,W=c.width,H=c.height;
    const px=(x,y)=>{const i=(Math.round(y*H)*W+Math.round(x*W))*4;return [d[i],d[i+1],d[i+2]]};let blue=0,n=0;for(let y=Math.round(f.y*H);y<(f.y+f.h)*H;y++)for(let x=Math.round(f.x*W);x<(f.x+f.w)*W;x++){const i=(y*W+x)*4;n++;if(d[i+2]-d[i]>40)blue++}
    const o=await renderPage(p,{maxSide:1800,noFix:true}),od=o.getContext('2d').getImageData(0,0,W,H).data;let diff=0;for(let i=0;i<od.length;i+=4)diff+=Math.abs(od[i]-d[i]);
    return {t:f.t,orig:f.orig,blue:blue/n,pad:px(f.x+f.w+f.h*.1*H/W,f.y+f.h/2),diff}});
  assert.ok(r,'no se guardó la corrección');assert.equal(r.t,'LIBERTAD');assert.equal(r.orig,'LIVERTAD');
  assert.ok(r.blue>.08,'no conservó la tinta azul: '+r.blue);assert.ok(r.diff>1000,'la imagen no cambió');
  assert.ok(r.pad.every((v,k)=>Math.abs(v-[244,241,234][k])<14),'el borrado no tomó el color del papel: '+r.pad);
  await pg.click('#fxDone');await W(500);await pg.click('#edUndo');await W(700);assert.equal(await pg.evaluate(()=>(Ed.p.fixes||[]).length),0,'deshacer no quitó la corrección');
  /* a mano: el recuadro se ajusta a la tinta */
  const ib=await pg.evaluate(()=>{const c=canvas(200,100),x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,200,100);x.fillStyle='#000';x.fillRect(50,40,60,20);return fixInkBox(c,{x:.1,y:.1,w:.8,h:.8})});
  assert.ok(Math.abs(ib.x-.25)<.01&&Math.abs(ib.w-.3)<.01&&Math.abs(ib.y-.4)<.02,JSON.stringify(ib));
});

await test('Nexa IA solo para el administrador mientras está en desarrollo',async pg=>{
  await pg.evaluate(()=>{SB.profile={id:'u',role:'usuario',status:'activo'};applyPerms();renderTools()});await W(200);
  assert.equal(await pg.isVisible('#btnNexa'),false,'un usuario ve el botón Nexa');
  const tool=await pg.evaluate(()=>{const i=TOOLS.findIndex(t=>t.name==='Asistente IA');const r=document.querySelector('#toolsGrid [data-tool="'+i+'"]');return !r||r.hidden});assert.ok(tool,'un usuario ve el Asistente IA en Herramientas');
  await pg.evaluate(()=>go('nexa'));await W(200);assert.equal(await pg.isVisible('#v-nexa'),false,'un usuario pudo abrir Nexa');
  await pg.click('#navSettings');await W(500);assert.equal(await pg.isVisible('#sAI'),false,'un usuario ve la configuración de Nexa');
  await pg.evaluate(()=>Nav.back());await W(400);
  await pg.evaluate(()=>{SB.profile={id:'a',role:'admin',status:'activo'};applyPerms()});await W(200);
  assert.equal(await pg.isVisible('#btnNexa'),true,'el administrador no ve Nexa');await pg.click('#btnNexa');await W(300);assert.equal(await pg.isVisible('#v-nexa'),true);
});

await test('Editar PDF: entrar a una página, corregir una palabra y zoom para encuadrar',async pg=>{
  const b64=await pg.evaluate(async()=>{await loadLib('pdflib');const d=await PDFLib.PDFDocument.create(),f=await d.embedFont(PDFLib.StandardFonts.Helvetica);for(const t of ['PAGINA UNO','ACTA DE LIVERTAD']){const p=d.addPage([400,300]);p.drawText(t,{x:40,y:200,size:24,font:f})}const u=await d.save();let s='';for(const b of u)s+=String.fromCharCode(b);return btoa(s)});
  await pg.evaluate(()=>openTool(TOOLS.findIndex(t=>t.name==='Editar PDF')));await W(600);if(await pg.evaluate(()=>$('#sheet').classList.contains('open'))){await pg.evaluate(()=>Nav.back());await W(500)}
  await pg.setInputFiles('#toolBody .fp input[type=file]',{name:'acta.pdf',mimeType:'application/pdf',buffer:Buffer.from(b64,'base64')});await W(800);if(await pg.$('#srcYes'))await pg.click('#srcYes');await W(2500);
  assert.equal(await pg.$$eval('#toolBody .pg [data-s="fix"]',x=>x.length),2,'falta Corregir en cada página');
  await pg.evaluate(()=>{Fix.ocr=async function(){}});await pg.click('#toolBody .pg[data-n="2"] .pgimg');await W(1200);
  assert.match(await pg.textContent('#fixer .shead .t'),/página 2/);
  /* el zoom agranda la hoja */
  const w0=await pg.$eval('#fxCv',c=>c.getBoundingClientRect().width);await pg.click('#fxIn');await W(200);const w1=await pg.$eval('#fxCv',c=>c.getBoundingClientRect().width);assert.ok(w1>w0*1.4,'no hace zoom '+w0+' → '+w1);await pg.click('#fxOut');
  await pg.evaluate(()=>{const W=Fix.base.width,H=Fix.base.height,k=W/400;const m=canvas(4,4).getContext('2d');m.font=(24*k)+'px Helvetica, Arial';const a=m.measureText('ACTA DE ').width,r=m.measureText('LIVERTAD');
    Fix.setWords([{t:'LIVERTAD',x:(40*k+a)/W,y:(100*k-r.actualBoundingBoxAscent)/H,w:r.width/W,h:(r.actualBoundingBoxAscent+r.actualBoundingBoxDescent)/H}])});
  await pg.fill('#fxFind','livertad');await W(200);await pg.click('#fxBoxes>b.hit');await W(300);await pg.fill('#fxTxt','LIBERTAD');await pg.click('#fxApply');await W(500);
  await pg.click('#fxDone');await W(600);
  assert.match(await pg.textContent('#toolBody .plist'),/Corrección · página 2/);
  await pg.click('#toolBody .run');await W(2500);const res=await pg.textContent('#toolBody .result');assert.ok(/Listo/.test(res)&&/2 de 2 página/.test(res),res);
  /* Colocar: zoom con botones */
  const z=await pg.evaluate(async()=>{const c=canvas(300,400);c.getContext('2d').fillRect(0,0,10,10);const pr=placeOverlay(c.toDataURL(),rectPng('#fff','#bbb'),{free:true});await new Promise(r=>setTimeout(r,500));const r0=$('#plBox').getBoundingClientRect().width;$('#plZin').click();await new Promise(r=>setTimeout(r,100));const r1=$('#plBox').getBoundingClientRect().width;$('#plOk').click();const res=await pr;return {r0,r1,ok:!!res,w:res&&res.box.w}});
  assert.ok(z.r1>z.r0*1.4,'Colocar no hace zoom '+JSON.stringify(z));assert.ok(z.ok&&Math.abs(z.w-.35)<.02,'el zoom cambió el tamaño guardado '+JSON.stringify(z));
});

await test('Corregir con la misma letra (Times negrita 12) y varias palabras a la vez',async pg=>{
  const b64=await pg.evaluate(async()=>{await loadLib('pdflib');const d=await PDFLib.PDFDocument.create(),f=await d.embedFont(PDFLib.StandardFonts.TimesRomanBold),r=await d.embedFont(PDFLib.StandardFonts.Helvetica);const p=d.addPage([595,842]);
    p.drawText('Interno: Frias Alberto Tomas, alojado en la Unidad 5.',{x:60,y:760,size:12,font:f});p.drawText('Se deja constancia de lo actuado.',{x:60,y:730,size:11,font:r});const u=await d.save();let s='';for(const b of u)s+=String.fromCharCode(b);return btoa(s)});
  await pg.evaluate(()=>openTool(TOOLS.findIndex(t=>t.name==='Editar PDF')));await W(600);if(await pg.evaluate(()=>$('#sheet').classList.contains('open'))){await pg.evaluate(()=>Nav.back());await W(500)}
  await pg.setInputFiles('#toolBody .fp input[type=file]',{name:'acta.pdf',mimeType:'application/pdf',buffer:Buffer.from(b64,'base64')});await W(800);if(await pg.$('#srcYes'))await pg.click('#srcYes');await W(2000);
  await pg.click('#toolBody .pg[data-n="1"] [data-s="fix"]');await W(2000);
  assert.ok(await pg.evaluate(()=>Fix.words.length>8),'no leyó las palabras del PDF');
  await pg.fill('#fxFind','frias alberto tomas');await W(300);assert.equal(await pg.$$eval('#fxBoxes>b.hit',x=>x.length),3,'no encontró la frase completa');
  await pg.click('#fxBoxes>b.hit');await W(400);
  const o=await pg.evaluate(()=>({orig:Fix.o.orig,f:Fix.o.f,b:Fix.o.b,n:Fix.selIdx.length,det:$('#fxDet').textContent}));
  assert.equal(o.orig,'Frias Alberto Tomas');assert.equal(o.n,3);assert.equal(o.f,'serif');assert.equal(o.b,1);assert.ok(/Times New Roman · negrita · 12 pt/.test(o.det),o.det);
  await pg.fill('#fxTxt','Robledo Ariel');await pg.click('#fxApply');await W(500);assert.ok(await pg.evaluate(()=>Fix._lastRects[0].dx<0),'no acomodó el renglón (queda hueco)');await pg.click('#fxDone');await W(500);
  assert.match(await pg.textContent('#toolBody .plist'),/Corrección · página 1/);
  /* escaneos: detecta la letra comparando la forma de la palabra */
  const det=await pg.evaluate(()=>{const out={};for(const [f,b] of [['serif',1],['sans',0],['mono',0]]){const c=canvas(900,200),x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,900,200);x.fillStyle='#222';x.font=fixFont({f,b},44);x.fillText('Frias Alberto Tomas',40,110);
    const m=x.measureText('Frias Alberto Tomas');const bx={x:(40-(m.actualBoundingBoxLeft||0))/900,y:(110-m.actualBoundingBoxAscent)/200,w:((m.actualBoundingBoxLeft||0)+m.actualBoundingBoxRight)/900,h:(m.actualBoundingBoxAscent+m.actualBoundingBoxDescent)/200};
    const r=fixDetect(c,{...bx,orig:'Frias Alberto Tomas'});out[f+b]=r&&(r.f+r.b)}return out});
  assert.deepEqual(det,{serif1:'serif1',sans0:'sans0',mono0:'mono0'},JSON.stringify(det));
  /* tocando la primera y la última palabra del renglón se eligen todas */
  await seedPage(pg);await pg.evaluate(async()=>{DOC=newDoc();DOC.pages.push({...window._pg,id:uid(),filter:'original'});openDocScreen();Ed.open(0)});await W(900);
  await pg.evaluate(()=>{Fix.ocr=async function(){}});await pg.click('#editor [data-ed="fix"]');await W(900);
  await pg.evaluate(()=>Fix.setWords([{t:'Frias',x:.1,y:.1,w:.1,h:.03},{t:'Alberto',x:.22,y:.1,w:.14,h:.03},{t:'Tomas',x:.38,y:.1,w:.12,h:.03},{t:'Otro',x:.1,y:.3,w:.1,h:.03}]));
  await pg.click('#fxBoxes>b[data-w="0"]');await W(300);await pg.click('#fxBoxes>b[data-w="2"]');await W(300);
  const g=await pg.evaluate(()=>({n:Fix.selIdx.join(','),orig:Fix.o.orig}));assert.equal(g.n,'0,1,2');assert.equal(g.orig,'Frias Alberto Tomas');
});

await test('Nexa más rápida e interactiva: modo rápido, menos texto a la IA local, sugerencias, otra respuesta, editar y conversaciones',async pg=>{
  /* Gemini en modo rápido (sin "pensar" de más) y si el modelo no lo admite se reintenta normal */
  const g=await pg.evaluate(async()=>{const a=AI();a.keys.gemini='AQ.prueba-1234567890abcdefghij';a.models.gemini='gemini-2.5-flash';const bodies=[];const f=window.fetch;
    window.fetch=async(u,o)=>{const b=JSON.parse(o.body);bodies.push(b);if(b.generationConfig.thinkingConfig&&bodies.length===1)return new Response(JSON.stringify({error:{message:'thinking not supported'}}),{status:400});
      return new Response('data: {"candidates":[{"content":{"parts":[{"text":"Listo"}]}}]}\n\n',{status:200,headers:{'Content-Type':'text/event-stream'}})};
    let out='';try{out=await aiChatStream([{role:'user',text:'hola'}],{prov:'gemini'})}catch(e){out='ERR '+e.message}window.fetch=f;
    return {out,first:JSON.stringify(bodies[0].generationConfig.thinkingConfig),second:!!bodies[1]&&!bodies[1].generationConfig.thinkingConfig,g3:JSON.stringify(nxThinking('gemini-3-flash'))}});
  assert.equal(g.out,'Listo');assert.equal(g.first,'{"thinkingBudget":0}');assert.ok(g.second,'no reintentó sin el modo rápido');assert.equal(g.g3,'{"thinkingLevel":"low"}');
  /* la IA local por procesador recibe solo lo relevante del documento */
  const l=await pg.evaluate(()=>{const c=NexaLocal.cfg();c.base='cpu-0.5b';const filler='Texto de relleno administrativo sin datos importantes para la consulta. '.repeat(300);
    Nexa.st.docs=[{id:'x',name:'Acta larga',text:filler+'\n\nEl interno Pérez tiene audiencia el 20/10/2026 en el Juzgado de Ejecución N° 2.\n\n'+filler}];
    const m=Nexa.localMsgs([{role:'user',text:'¿cuándo es la audiencia del interno Pérez?'}]);Nexa.st.docs=[];return {len:m[0].content.length,has:/audiencia el 20\/10\/2026/.test(m[0].content)}});
  assert.ok(l.len<4500,'el mensaje a la IA local sigue siendo largo: '+l.len);assert.ok(l.has,'dejó afuera la parte relevante');
  await pg.evaluate(()=>{NexaLocal.cfg().base='';Nexa.st.prov='basic';Nexa.st.msgs=[]});
  await pg.click('#btnNexa');await W(400);
  /* sugerencias mientras escribís */
  await pg.fill('#nxIn','qué pla');await W(400);assert.ok(await pg.$$eval('.nx-ac button',x=>x.some(b=>/plazos/i.test(b.textContent))),'no sugiere mientras escribo');
  await pg.fill('#nxIn','');await pg.fill('#nxIn','hola');await pg.press('#nxIn','Enter');await W(600);
  /* otra respuesta y editar la pregunta */
  assert.ok(await pg.$('#nxLog [data-nx="regen"]'),'falta "Otra respuesta"');const n0=await pg.evaluate(()=>Nexa.st.msgs.length);
  await pg.click('#nxLog [data-nx="regen"]');await W(600);assert.equal(await pg.evaluate(()=>Nexa.st.msgs.length),n0,'regenerar duplicó mensajes');
  await pg.click('#nxLog [data-nx="edit"]');await W(300);assert.equal(await pg.inputValue('#nxIn'),'hola');assert.equal(await pg.evaluate(()=>Nexa.st.msgs.length),n0-2);
  await pg.fill('#nxIn','¿qué podés hacer?');await pg.press('#nxIn','Enter');await W(600);
  /* conversaciones guardadas */
  await pg.click('#nxNew');await W(400);assert.equal(await pg.evaluate(()=>Nexa.st.msgs.length),0);assert.equal(await pg.evaluate(()=>NxHist.all().length),1);
  await pg.click('#nxHist');await W(500);assert.match(await pg.textContent('#sheetBody'),/qué podés hacer/);await pg.click('#sheetBody [data-o]');await W(600);
  assert.ok(await pg.evaluate(()=>Nexa.st.msgs.some(m=>/qué podés hacer/.test(m.text))),'no abrió la conversación guardada');
});

await test('Nexa local no deja esperando: saluda al instante y responde rápido mientras el modelo carga',async pg=>{
  await pg.evaluate(()=>{const c=NexaLocal.cfg();c.downloaded=true;c.base='cpu-0.5b';NexaLocal.engine=null;NexaCPU.w=null;window._loads=0;NexaLocal.load=function(){window._loads++;return new Promise(()=>{})};Nexa.st.prov='local';Nexa.st.msgs=[]});
  await pg.click('#btnNexa');await W(300);
  const t0=Date.now();await pg.fill('#nxIn','hola');await pg.press('#nxIn','Enter');await W(500);
  let last=await pg.evaluate(()=>Nexa.st.msgs.at(-1));assert.equal(last.role,'assistant');assert.ok(/(buen día|buenas tardes|buenas noches|hola)/i.test(last.text),last.text);assert.ok(Date.now()-t0<3000);
  await pg.fill('#nxIn','¿qué podés hacer?');await pg.press('#nxIn','Enter');await W(500);
  await pg.fill('#nxIn','como hago un oficio de traslado');await pg.press('#nxIn','Enter');await W(700);
  last=await pg.evaluate(()=>Nexa.st.msgs.at(-1));assert.equal(last.role,'assistant');assert.ok(/Respuesta rápida mientras la IA del teléfono/.test(last.text),last.text.slice(-200));
  assert.ok(await pg.evaluate(()=>window._loads>0),'no empezó a cargar el modelo');assert.equal(await pg.evaluate(()=>Nexa.st.prov),'local');
});

await test('Computadora: menú lateral y pantalla completa; en el celular sigue igual',async pg=>{
  const m=await pg.evaluate(()=>{const n=$('.nav').getBoundingClientRect();return {bottom:Math.round(n.bottom),w:Math.round(n.width),h:Math.round(n.height)}});
  assert.ok(m.w>=380&&m.h<100,'en el celular cambió la barra de abajo: '+JSON.stringify(m));
  await pg.setViewportSize({width:1440,height:860});await W(400);
  const d=await pg.evaluate(()=>{const n=$('.nav').getBoundingClientRect(),a=$('.app').getBoundingClientRect(),f=$('.nav .fab').getBoundingClientRect();return {nw:Math.round(n.width),nh:Math.round(n.height),al:Math.round(a.left),aw:Math.round(a.width),fy:Math.round(f.top)}});
  assert.ok(d.nw<300&&d.nh>=800,'no hay menú lateral: '+JSON.stringify(d));assert.ok(d.al>=200&&d.aw>1100,'el contenido no ocupa el ancho: '+JSON.stringify(d));assert.ok(d.fy<120,'Escanear no está arriba');
  await pg.click('.nav [data-go="tools"]');await W(300);assert.ok(await pg.isVisible('#v-tools'));
});

await test('Actualizar la app no borra las herramientas guardadas ni el modelo de Nexa local',async pg=>{
  const r=await pg.evaluate(async()=>{for(const k of await caches.keys())await caches.delete(k);
    const lib=location.origin+'/libs/tesseract.min.js',cdn='https://tessdata.projectnaptha.com/4.0.0/spa.traineddata.gz',app=location.origin+'/index.html';
    const old=await caches.open('danscaner-v40');await old.put(lib,new Response('lib'));await old.put(cdn,new Response('idioma'));await old.put(app,new Response('app vieja'));
    await (await caches.open('webllm/model')).put('https://huggingface.co/modelo.bin',new Response('modelo'));
    const src=await (await fetch('sw.js')).text();const L={};const self={addEventListener:(t,f)=>L[t]=f,location,clients:{claim:async()=>{}},skipWaiting:()=>{}};
    await new Promise((ok,ko)=>{const sc=document.createElement('script');sc.src=URL.createObjectURL(new Blob(['window.__swInit=function(self){'+src+'\n}'],{type:'text/javascript'}));sc.onload=ok;sc.onerror=ko;document.head.appendChild(sc)});window.__swInit(self);let P;L.activate({waitUntil:p=>P=p});await P;
    const keys=await caches.keys(),libs=await caches.open('danscaner-libs');
    const res={keys,lib:!!(await libs.match(lib)),cdn:!!(await libs.match(cdn)),app:!!(await libs.match(app))};
    await clearCaches();res.afterClean=await caches.keys();return res});
  assert.ok(!r.keys.includes('danscaner-v40'),'no borró la copia vieja de la app');assert.ok(r.keys.includes('webllm/model'),'borró el modelo de Nexa local');
  assert.ok(r.lib&&r.cdn,'perdió las herramientas guardadas');assert.ok(!r.app,'guardó la app vieja como herramienta');
  assert.deepEqual(r.afterClean,['webllm/model'],'la limpieza rápida borró el modelo: '+r.afterClean);
});

await test('Revisión: OCR sin internet (incluido en la app) y Firmar PDF usa el editor completo',async pg=>{
  await pg.route(/cdn\.jsdelivr|cdnjs|unpkg|projectnaptha/,r=>r.abort());
  const t=await pg.evaluate(async()=>{const c=document.createElement('canvas');c.width=900;c.height=300;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,900,300);x.fillStyle='#000';x.font='40px Arial';x.fillText('Acta de libertad del interno',40,120);
    const r=await ocrCanvases(async fn=>{await fn(c)},'spa',1);busy(false);return r.join(' ')});
  assert.ok(/libertad/i.test(t),'el OCR no funcionó sin internet: '+t);
  assert.ok(await pg.evaluate(()=>TOOLS.find(t=>t.name==='Firmar PDF').ui===TOOLS.find(t=>t.name==='Editar PDF').ui),'Firmar PDF no usa el editor completo');
  assert.equal(await pg.evaluate(()=>{let m='';const t=$('#toast');toast('Uncaught NetworkError: Failed to execute importScripts');m=t.textContent;return /Sin conexión/.test(m)}),true);
});

await test('Análisis del documento: formato, perspectiva, luz, sombras, nitidez y OCR, sin internet y sin modificar nada',async pg=>{
  const ids=await pg.evaluate(async()=>{
    const mkPage=blur=>{const c=document.createElement('canvas');c.width=1240;c.height=1754;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.fillStyle='#111';x.font='26px Times New Roman';
      for(let y=160;y<1650;y+=39)x.fillText('Por la presente se informa al Juzgado que el interno solicita audiencia conforme',120,y);
      if(!blur)return c;const d=document.createElement('canvas');d.width=c.width;d.height=c.height;const dx=d.getContext('2d');dx.filter='blur('+blur+'px)';dx.drawImage(c,0,0);return d};
    const photo=(pc,shadow)=>{const c=document.createElement('canvas');c.width=1600;c.height=2100;const x=c.getContext('2d');x.fillStyle='#4a3a2c';x.fillRect(0,0,c.width,c.height);const s=Math.min(1280/pc.width,1785/pc.height);
      x.drawImage(pc,(c.width-pc.width*s)/2,(c.height-pc.height*s)/2,pc.width*s,pc.height*s);if(shadow){x.fillStyle='rgba(0,0,0,.55)';x.beginPath();x.ellipse(1100,1550,480,420,.4,0,7);x.fill()}return c.toDataURL('image/jpeg',.9)};
    const save=async(name,src)=>{const d=newDoc();d.name=name;d.pages.push(await makePage(src));await DB.putDoc(d);return d.id};
    return [await save('Nítido',photo(mkPage(0))),await save('Movido',photo(mkPage(2.5))),await save('Con sombra',photo(mkPage(0),true))]});
  await pg.click('#btnNexa');await W(300);
  await pg.fill('#nxIn','analizá el documento');await pg.press('#nxIn','Enter');await W(400);
  assert.match(await pg.evaluate(()=>Nexa.st.msgs.at(-1).text),/adjuntalo/);
  const ask=async id=>{await pg.evaluate(async id=>{Nexa.attachDoc(await DB.getDoc(id))},id);const before=await pg.evaluate(async id=>JSON.stringify((await DB.getDoc(id)).pages),id);
    await pg.fill('#nxIn','analizá la calidad del documento');await pg.press('#nxIn','Enter');await pg.waitForFunction(()=>!Nexa.sending&&/ANÁLISIS/.test((Nexa.st.msgs.at(-1)||{}).text||''),null,{timeout:20000});
    assert.equal(await pg.evaluate(async id=>JSON.stringify((await DB.getDoc(id)).pages),id),before,'el análisis modificó el documento');
    const t=await pg.evaluate(()=>Nexa.st.msgs.at(-1).text);await pg.evaluate(()=>{Nexa.st.docs=[];Nexa.save();Nexa.renderDocs()});return t};
  const a=await ask(ids[0]);for(const k of ['Documento:** Sí','Formato aprox.:** A4','Perspectiva:** Buena','Iluminación:** Uniforme','Sombras:** Ninguna','Nitidez:** Alta','Texto detectable:** Sí','Calidad estimada OCR:** Alta','RECOMENDACIONES','sin internet'])assert.ok(a.includes(k),'nítido: falta '+k+'\n'+a);
  const b=await ask(ids[1]);assert.ok(b.includes('Nitidez:** Baja')&&b.includes('Calidad estimada OCR:** Baja')&&/movida o desenfocada/.test(b),b);
  const c=await ask(ids[2]);assert.ok(/Sombras:\*\* (Intensas|Moderadas)/.test(c)&&/sombras/i.test(c.split('RECOMENDACIONES')[1]),c);
  /* editor: botón Analizar */
  await pg.evaluate(async id=>{DOC=await DB.getDoc(id);openDocScreen();Ed.open(0)},ids[0]);await W(800);
  await pg.click('#editor [data-ed="anal"]');await pg.waitForSelector('#sheetBody .an-md',{timeout:15000});
  assert.match(await pg.textContent('#sheetBody'),/Perspectiva: Buena[\s\S]*RECOMENDACIONES/);
  await pg.evaluate(()=>Nav.back());await W(300);
});

await test('Nexa en dos modos (sin internet / con internet), detener siempre corta y enseñarle a Nexa',async pg=>{
  await pg.click('#btnNexa');await W(300);
  assert.equal(await pg.evaluate(()=>Nexa.st.prov+'|'+Nexa.provLabel()+'|'+Nexa.prov()),'offline|Nexa sin internet|basic');
  await pg.click('#nxProv');await W(150);assert.equal(await pg.evaluate(()=>[...document.querySelectorAll('#nxMenu [data-p]')].map(b=>b.dataset.p).join(',')),'offline,online');
  await pg.click('#nxMenu [data-p="online"]');await W(500);assert.equal(await pg.evaluate(()=>Nav.isOpen('sheet')),true,'no pidió activar internet');
  await pg.evaluate(()=>Nav.back());await W(300);assert.match(await pg.textContent('#nxStat'),/Falta activar/);assert.equal(await pg.evaluate(()=>Nexa.prov()),'basic');
  assert.equal(await pg.evaluate(()=>{const a=AI();a.keys.gemini='AIzaTEST_______________________';return Nexa.prov()}),'gemini');
  assert.equal(await pg.evaluate(()=>[nxMode('local'),nxMode('basic'),nxMode('auto'),nxMode('openai')].join()),'offline,offline,online,online');
  await pg.evaluate(()=>{AI().keys.gemini='';Nexa.st.prov='offline';Nexa.save();Nexa.status()});
  /* detener mientras Nexa sigue trabajando: corta al instante y lo que termine después no aparece */
  await pg.evaluate(()=>{window._ans=NexaBasic.answer;NexaBasic.answer=()=>new Promise(r=>{window._res=r})});
  await pg.fill('#nxIn','resumí lo importante');await pg.press('#nxIn','Enter');await W(500);
  assert.equal(await pg.evaluate(()=>Nexa.sending),true);
  await pg.click('#nxSend');await W(300);
  assert.equal(await pg.evaluate(()=>Nexa.sending+' '+Nexa.st.msgs.length+' '+$('#nxSend').classList.contains('stop')),'false 0 false');
  assert.equal(await pg.inputValue('#nxIn'),'resumí lo importante');
  await pg.evaluate(()=>{window._res('RESPUESTA VIEJA');NexaBasic.answer=window._ans});await W(400);
  assert.equal(await pg.evaluate(()=>Nexa.st.msgs.length+' '+Nexa.sending+' '+Nexa.st.prov),'0 false offline');assert.ok(!/RESPUESTA VIEJA/.test(await pg.textContent('#nxLog')));
  /* detener mientras lee un documento escaneado sin texto: corta la lectura (OCR) */
  await seedPage(pg);await pg.evaluate(async()=>{const d=newDoc();d.name='Escaneo sin texto';d.pages.push({...window._pg,id:uid()});await DB.putDoc(d);Nexa.attachDoc(d);
   await loadLib('tess');window._term=0;Tesseract.createWorker=async()=>({setParameters:async()=>{},recognize:()=>new Promise(()=>{}),terminate:async()=>{window._term++}})});
  await pg.fill('#nxIn','sacá la información del documento');await pg.press('#nxIn','Enter');await W(1500);
  assert.match(await pg.evaluate(()=>$('#nxLog .nx-typing')&&$('#nxLog .nx-typing').getAttribute('data-msg')||''),/Leyendo «Escaneo sin texto» · página 1 de 1/);
  await pg.click('#nxSend');await W(300);assert.equal(await pg.evaluate(()=>Nexa.sending+' '+window._term+' '+$('#busy').classList.contains('on')),'false 1 false');
  await pg.evaluate(()=>{Nexa.st.docs=[];Nexa.save();Nexa.renderDocs();$('#nxIn').value=''});
  /* enseñar y que lo use */
  await pg.fill('#nxIn','si te preguntan horario de visitas, respondé de 9 a 12 hs');await pg.press('#nxIn','Enter');await W(500);
  assert.match(await pg.evaluate(()=>Nexa.st.msgs.at(-1).text),/Aprendido/);
  await pg.fill('#nxIn','¿cuál es el horario de visitas?');await pg.press('#nxIn','Enter');await W(800);
  assert.match(await pg.evaluate(()=>Nexa.st.msgs.at(-1).text),/9 a 12 hs/);
  assert.ok(await pg.evaluate(()=>NexaKB.all().some(e=>e.src==='Danscanner')),'falta el conocimiento de base');
  assert.match(await pg.evaluate(()=>Nexa.system()),/horario de visitas → de 9 a 12 hs/);
  await pg.evaluate(()=>nexaSheet());await W(600);assert.equal(await pg.isVisible('#nlTeach'),true);
  await pg.fill('#ntQ','teléfono de la oficina');await pg.fill('#ntA','381 000-0000');await pg.click('#ntAdd');await W(200);
  assert.ok(await pg.evaluate(()=>NexaKB.all().some(e=>e.q==='teléfono de la oficina'&&e.src==='vos')));
  await pg.evaluate(()=>Nav.back());await W(300);
});

await test('Certificado: sale en su tamaño real, centrado en una hoja A4 blanca',async pg=>{
  const r=await pg.evaluate(async()=>{const mk=async(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,w,h);x.fillStyle='#000';x.fillRect(20,20,50,10);const p=await makePage(c.toDataURL('image/jpeg',.9),{auto:false,filter:'original'});p.paper='cert';return p};
    const v=await mk(686,979),h=await mk(1400,1000);const mm=x=>Math.round(x/72*25.4);
    const bytes=await buildPDF([v,h],{size:'auto'});const doc=await PDFLib.PDFDocument.load(bytes);
    const pv=paperFor(v,686,979,'auto'),ph=paperFor(h,1400,1000,'auto'),old=paperFor({paper:'a5'},686,979,'auto');
    return {pages:doc.getPages().map(p=>{const z=p.getSize();return mm(z.width)+'x'+mm(z.height)}).join(' '),v:mm(pv.dw)+'x'+mm(pv.dh),h:mm(ph.dw)+'x'+mm(ph.dh),old:mm(old.pw)+'x'+mm(old.ph)}});
  assert.equal(r.pages,'210x297 297x210','el certificado no sale en hoja A4');
  assert.equal(r.v,'147x210');assert.equal(r.h,'207x148');assert.equal(r.old,'148x210','las páginas guardadas en A5 cambiaron');
  await seedPage(pg);await pg.evaluate(async()=>{DOC=newDoc();DOC.pages.push({...window._pg,id:uid()});openDocScreen();Ed.open(0)});await W(800);
  await pg.click('#editor [data-ed="paper"]');await W(400);await pg.click('#sheetBody [data-pp="cert"]');await W(500);
  assert.equal(await pg.evaluate(()=>Ed.p.paper),'cert');assert.match(await pg.textContent('#editor [data-ed="paper"]'),/Cert/);
  await pg.evaluate(()=>Nav.back());await W(400);await pg.evaluate(()=>Nav.back());await W(400);
});

await test('Escaneo: detección de la hoja (tablas, otro papel detrás, sombras), tamaño A4/oficio/certificado y borrar la foto en la cámara',async pg=>{
  await pg.addScriptTag({content:require('fs').readFileSync(__dirname+'/fixtures/escenas.js','utf8')});
  const d=await pg.evaluate(async()=>{let s=0,bad=0;const n=24;for(let i=1;i<=n;i++){const sc=makeScene(i);const p=await makePage(sc.canvas.toDataURL('image/jpeg',.85));const v=quadIoU(sc.quad,p.quad);s+=v;if(v<.9)bad++}return {avg:s/n,bad}});
  assert.ok(d.avg>.85&&d.bad<=8,'la detección de la hoja no alcanza: '+JSON.stringify(d));
  /* tamaño de hoja automático */
  const sz=await pg.evaluate(async()=>{const mk=async(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,w,h);x.fillStyle='#000';x.fillRect(20,20,50,10);return makePage(c.toDataURL('image/jpeg',.9),{auto:false,filter:'original'})};
    const a=await mk(1000,1414),o=await mk(1000,1650),c=await mk(1000,1414);c.paper='a5';const bytes=await buildPDF([a,o,c],{size:'auto'});const doc=await PDFLib.PDFDocument.load(bytes);return doc.getPages().map(p=>{const z=p.getSize();return Math.round(z.width/72*25.4)+'x'+Math.round(z.height/72*25.4)}).join(' ')});
  assert.equal(sz,'210x297 216x356 148x210');assert.equal(await pg.evaluate(()=>S.size),'auto');
  /* cámara: revisar la foto, repetir, pasar a lote y borrar la última */
  await pg.evaluate(()=>{S.autoCapture=false;Cam.kind='cert';Cam.open('single')});await pg.waitForFunction(()=>Cam.stream&&$('#camVideo').videoWidth>0,null,{timeout:15000});
  await pg.evaluate(()=>Cam.shoot());await pg.waitForFunction(()=>!$('#camRev').hidden,null,{timeout:20000});
  assert.equal(await pg.evaluate(()=>Cam.review.length),1);assert.equal(await pg.evaluate(()=>Cam.review[0].paper),'cert','el modo Certificado no marcó la hoja');
  await pg.click('#rvAgain');await W(200);assert.equal(await pg.evaluate(()=>!Cam.review&&$('#camRev').hidden&&!Cam.busy),true);
  await pg.evaluate(()=>Cam.shoot());await pg.waitForFunction(()=>!$('#camRev').hidden,null,{timeout:20000});await pg.click('#rvMore');await W(200);
  assert.equal(await pg.evaluate(()=>Cam.mode+' '+Cam.batch.length),'batch 1');assert.equal(await pg.isVisible('#camUndo'),true);
  await pg.click('#camUndo');await W(200);assert.equal(await pg.evaluate(()=>Cam.batch.length),0);
  await pg.evaluate(()=>Nav.back());await W(600);
  /* editor: elegir el tamaño de la hoja */
  await seedPage(pg);await pg.evaluate(async()=>{DOC=newDoc();DOC.pages.push({...window._pg,id:uid()});openDocScreen();Ed.open(0)});await W(800);
  await pg.click('#editor [data-ed="paper"]');await W(400);await pg.click('#sheetBody [data-pp="oficio"]');await W(500);
  assert.equal(await pg.evaluate(()=>Ed.p.paper),'oficio');assert.match(await pg.textContent('#editor [data-ed="paper"]'),/Oficio/);
});

for(const [ok,name,err] of results)console.log(ok,name+(err?' → '+err:''));
const fails=results.filter(r=>r[0]==='❌').length;console.log('\n'+(results.length-fails)+'/'+results.length+' pruebas OK');process.exit(fails?1:0);
})();
