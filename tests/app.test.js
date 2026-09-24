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

async function test(name,fn){const browser=await chromium.launch();let pg;
  try{pg=await newPage(browser);await fn(pg);assert.deepEqual(pg.errors,[],'errores de JavaScript');results.push(['✅',name])}
  catch(e){results.push(['❌',name,e.message.replace(/\s+/g,' ').slice(0,300)])}
  finally{await browser.close()}}

(async()=>{
await test('La app carga con el nombre y los íconos nuevos',async pg=>{
  assert.equal(await pg.title(),'Danscanner Pro');
  assert.equal((await pg.textContent('#topTitle')).trim(),'Danscanner Pro');
  assert.ok(await pg.$('.nav [data-go="nexa"]'),'falta la pestaña Nexa');
});

await test('Filtros: todos en blanco y negro puro',async pg=>{await seedPage(pg);
  const r=await pg.evaluate(async()=>{const out={};for(const [f] of FILTERS){if(f==='original')continue;const p={...window._pg,filter:f,skew:undefined};const c=await renderPage(p,{maxSide:600});const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let bad=0;for(let i=0;i<d.length;i+=4)if(!((d[i]===0||d[i]===255)&&d[i]===d[i+1]&&d[i+1]===d[i+2]))bad++;out[f]=bad}return out});
  for(const [f,bad] of Object.entries(r))assert.equal(bad,0,'el filtro '+f+' dejó grises o color');
});

await test('Nexa básico: extrae datos y busca en los documentos',async pg=>{
  await pg.evaluate(async t=>{await DB.putDoc({id:'d1',name:'Oficio 55',created:1,updated:Date.now(),text:t,pages:[]});Nexa.attachDoc(await DB.getDoc('d1'))},OFICIO);
  await pg.click('.nav [data-go="nexa"]');
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
  await pg.click('.nav [data-go="nexa"]');
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

for(const [ok,name,err] of results)console.log(ok,name+(err?' → '+err:''));
const fails=results.filter(r=>r[0]==='❌').length;console.log('\n'+(results.length-fails)+'/'+results.length+' pruebas OK');process.exit(fails?1:0);
})();
