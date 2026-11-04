/* Danscanner Pro · Excel a PDF, Word o JPG «tal cual» (v92)
 * Se lee con ExcelJS (MIT, libs/exceljs): colores, letras, bordes, celdas combinadas, anchos, altos, logos,
 * área de impresión y la configuración de página que trae el archivo. Los .xls, .csv y .ods (que ExcelJS no lee)
 * van por SheetJS, solo con los valores.
 * Antes de convertir se acomoda en la hoja: tamaño, orientación, escala, márgenes, centrado y se arrastra la planilla.
 * Todo se hace en el teléfono. */
window.__mods=window.__mods||{};
(function(){
const PX_TW=15;            /* 1 px (96 ppp) = 15 twips */
const PX_EMU=9525;         /* 1 px = 9525 EMU */
const MM_TW=56.6929;
const THEME=['FFFFFF','000000','E7E6E6','44546A','4472C4','ED7D31','A5A5A5','FFC000','5B9BD5','70AD47'];
const INDEXED=['000000','FFFFFF','FF0000','00FF00','0000FF','FFFF00','FF00FF','00FFFF','000000','FFFFFF','FF0000','00FF00','0000FF','FFFF00','FF00FF','00FFFF','800000','008000','000080','808000','800080','008080','C0C0C0','808080','9999FF','993366','FFFFCC','CCFFFF','660066','FF8080','0066CC','CCCCFF','000080','FF00FF','FFFF00','00FFFF','800080','800000','008080','0000FF','00CCFF','CCFFFF','CCFFCC','FFFF99','99CCFF','FF99CC','CC99FF','FFCC99','3366FF','33CCCC','99CC00','FFCC00','FF9900','FF6600','666699','969696','003366','339966','003300','333300','993300','993366','333399','333333'];
const tint=(hex,t)=>{if(!t)return hex;const c=[0,2,4].map(i=>parseInt(hex.substr(i,2),16)).map(v=>Math.round(t<0?v*(1+t):v+(255-v)*t));return c.map(v=>Math.max(0,Math.min(255,v)).toString(16).padStart(2,'0')).join('').toUpperCase()};
function colorOf(c,def){if(!c)return def;if(c.argb){const a=String(c.argb);return (a.length===8?a.slice(2):a).toUpperCase()}if(c.theme!=null&&THEME[c.theme])return tint(THEME[c.theme],c.tint||0);if(c.indexed!=null&&INDEXED[c.indexed])return INDEXED[c.indexed];return def}
const colLetter=s=>{let n=0;for(const ch of s.toUpperCase())n=n*26+(ch.charCodeAt(0)-64);return n};
function parseRange(t){const m=String(t||'').trim().replace(/\$/g,'').replace(/^.*!/,'').match(/^([A-Za-z]{1,3})(\d+)(?::([A-Za-z]{1,3})(\d+))?$/);if(!m)return null;
 const a={c:colLetter(m[1]),r:+m[2]},b=m[3]?{c:colLetter(m[3]),r:+m[4]}:a;return {r0:Math.min(a.r,b.r),c0:Math.min(a.c,b.c),r1:Math.max(a.r,b.r),c1:Math.max(a.c,b.c)}}
const BSTY={thin:[1,'solid',4,'single'],hair:[1,'solid',2,'single'],medium:[2,'solid',12,'single'],thick:[3,'solid',18,'single'],dotted:[1,'dotted',4,'dotted'],dashed:[1,'dashed',4,'dashed'],mediumDashed:[2,'dashed',12,'dashed'],dashDot:[1,'dashed',4,'dotDash'],mediumDashDot:[2,'dashed',12,'dotDash'],dashDotDot:[1,'dashed',4,'dotDotDash'],mediumDashDotDot:[2,'dashed',12,'dotDotDash'],slantDashDot:[2,'dashed',12,'dotDash'],double:[3,'double',4,'double']};
const PAPER={9:'a4',5:'oficio',1:'carta'};
const SIZES={a4:[210,297],oficio:[216,356],carta:[216,279]};
const mm2px=mm=>mm*96/25.4,px2mm=px=>px*25.4/96;

/* ---------- 1) leer el archivo a un modelo común ---------- */
async function load(file){const name=String(file.name||'').toLowerCase(),ab=await file.arrayBuffer();
 if(/\.(xlsx|xlsm)$/.test(name)){try{return await loadExcelJS(ab)}catch(e){console.warn('ExcelJS no pudo leerlo, sigo con SheetJS',e)}}
 return loadSheetJS(ab)}
/* el número como lo muestra Excel en Argentina: el formato de la celda (SheetJS SSF) con punto de miles y coma decimal */
function fmtNum(v,f,date){try{if(typeof XLSX==='undefined'||!XLSX.SSF)return null;let fm=f||'General';if(date&&(!f||f==='General'))fm='dd/mm/yyyy';
 const val=v instanceof Date?(v.getTime()/86400000+25569):v;let t=XLSX.SSF.format(fm,val);if(!date&&!XLSX.SSF.is_date(fm))t=t.replace(/[.,]/g,ch=>ch==='.'?',':'.');return t}catch(e){return null}}
async function loadExcelJS(ab){await loadLib('exceljs');await loadLib('xlsx');const wb=new ExcelJS.Workbook();await wb.xlsx.load(ab);const sheets=[];
 for(const ws of wb.worksheets){if(ws.state&&ws.state!=='visible')continue;const d=ws.dimensions;const sh={name:ws.name,cells:new Map(),merges:[],images:[],cols:[],rows:[],setup:{}};
  let used=d&&d.top?{r0:d.top,c0:d.left,r1:d.bottom,c1:d.right}:null;
  const mg=(ws.model&&ws.model.merges)||[];for(const m of mg){const r=parseRange(m);if(r){sh.merges.push(r);used=used?{r0:Math.min(used.r0,r.r0),c0:Math.min(used.c0,r.c0),r1:Math.max(used.r1,r.r1),c1:Math.max(used.c1,r.c1)}:r}}
  for(const im of (ws.getImages?ws.getImages():[])){try{const img=wb.getImage(+im.imageId);if(!img||!img.buffer)continue;const ext=String(img.extension||'png').toLowerCase().replace('jpg','jpeg');const rg=im.range||{};const tl=rg.tl||{};
    const nc=tl.nativeCol!=null?tl.nativeCol+(tl.nativeColOff||0)/(PX_EMU*64):(tl.col||0),nr=tl.nativeRow!=null?tl.nativeRow+(tl.nativeRowOff||0)/(PX_EMU*20):(tl.row||0);
    let w=0,h=0;if(rg.ext){w=rg.ext.width;h=rg.ext.height}
    let brc=null;if(rg.br){const br=rg.br;brc={c:br.nativeCol!=null?br.nativeCol+(br.nativeColOff||0)/(PX_EMU*64):br.col,r:br.nativeRow!=null?br.nativeRow+(br.nativeRowOff||0)/(PX_EMU*20):br.row}}
    const b64=btoa(Array.from(new Uint8Array(img.buffer),ch=>String.fromCharCode(ch)).join(''));
    sh.images.push({src:'data:image/'+ext+';base64,'+b64,ext:ext==='jpeg'?'jpeg':'png',bytes:new Uint8Array(img.buffer),c:nc,r:nr,w,h,br:brc});
    const r1=Math.ceil(brc?brc.r:nr+1),c1=Math.ceil(brc?brc.c:nc+1);used=used?{r0:Math.min(used.r0,Math.floor(nr)+1),c0:Math.min(used.c0,Math.floor(nc)+1),r1:Math.max(used.r1,r1),c1:Math.max(used.c1,c1)}:{r0:Math.floor(nr)+1,c0:Math.floor(nc)+1,r1,c1}}catch(e){console.warn('imagen de la planilla',e)}}
  if(!used){sheets.push({...sh,empty:true});continue}
  sh.used=used;
  for(let c=1;c<=used.c1;c++){const col=ws.getColumn(c);sh.cols[c]={w:col.width?Math.round(col.width*7+5):64,hidden:!!col.hidden}}
  for(let r=1;r<=used.r1;r++){const row=ws.getRow(r);sh.rows[r]={h:row.height?row.height*96/72:null,hidden:!!row.hidden}}
  for(let r=used.r0;r<=used.r1;r++){const row=ws.getRow(r);for(let c=used.c0;c<=used.c1;c++){const cell=row.getCell(c);if(cell.isMerged&&cell.master&&cell.master!==cell)continue;
    let text='';try{text=cell.text==null?'':String(cell.text)}catch(e){text=cell.value==null?'':String(cell.value)}
    const v=cell.value,res=v&&typeof v==='object'&&'result' in v?v.result:v,num=typeof res==='number'||res instanceof Date;
    if(typeof res==='number')text=fmtNum(res,cell.numFmt)||text;else if(res instanceof Date)text=fmtNum(res,cell.numFmt,true)||text;
    const st=cell.style||{},f=st.font||{},al=st.alignment||{},fl=st.fill,bd=st.border||{};
    const s={};if(f.bold)s.b=1;if(f.italic)s.i=1;if(f.underline)s.u=1;if(f.strike)s.st=1;if(f.size)s.sz=f.size;if(f.name)s.fn=f.name;const fc=colorOf(f.color,null);if(fc&&fc!=='000000')s.fc=fc;
    if(fl&&fl.type==='pattern'&&fl.pattern&&fl.pattern!=='none'){const bg=colorOf(fl.fgColor,null)||colorOf(fl.bgColor,null);if(bg)s.bg=bg}
    if(al.horizontal&&al.horizontal!=='general')s.ha=al.horizontal==='centerContinuous'?'center':al.horizontal==='fill'||al.horizontal==='distributed'?'justify':al.horizontal;else if(num)s.ha='right';
    s.va=al.vertical==='middle'?'center':al.vertical==='top'?'top':al.vertical==='justify'||al.vertical==='distributed'?'center':'bottom';if(al.wrapText)s.wr=1;if(al.indent)s.ind=al.indent;
    for(const k of ['top','left','bottom','right']){const b=bd[k];if(b&&b.style&&BSTY[b.style])s['b'+k[0]]=[b.style,colorOf(b.color,'000000')]}
    if(text||Object.keys(s).length)sh.cells.set(r+','+c,{t:text,s})}}
  const ps=ws.pageSetup||{},mgn=ps.margins||{};const pa=parseRange(ps.printArea&&String(ps.printArea).split(',')[0]);
  sh.setup={land:ps.orientation==='landscape',size:PAPER[ps.paperSize]||null,area:pa,
   fit:ps.fitToPage?((ps.fitToHeight===1&&ps.fitToWidth===1)?'pagina':'ancho'):(ps.scale&&ps.scale!==100?'custom':null),zoom:ps.scale||100,
   margin:mgn.left!=null?Math.round(Math.min(30,Math.max(0,mgn.left*25.4))):null,center:!!ps.horizontalCentered,vcenter:!!ps.verticalCentered,
   rep:(()=>{const m=String(ps.printTitlesRow||'').replace(/\$/g,'').match(/^(\d+):(\d+)$/);return m?[+m[1],+m[2]]:null})()};
  sheets.push(sh)}
 return {sheets,styled:true}}
async function loadSheetJS(ab){await loadLib('xlsx');const wb=XLSX.read(ab,{cellDates:true,cellStyles:true});const sheets=[];
 for(const name of wb.SheetNames){const ws=wb.Sheets[name];const sh={name,cells:new Map(),merges:[],images:[],cols:[],rows:[],setup:{}};if(!ws['!ref']){sheets.push({...sh,empty:true});continue}
  const R=XLSX.utils.decode_range(ws['!ref']);sh.used={r0:R.s.r+1,c0:R.s.c+1,r1:R.e.r+1,c1:R.e.c+1};
  for(const m of ws['!merges']||[])sh.merges.push({r0:m.s.r+1,c0:m.s.c+1,r1:m.e.r+1,c1:m.e.c+1});
  const cols=ws['!cols']||[],rows=ws['!rows']||[];for(let c=1;c<=sh.used.c1;c++){const cc=cols[c-1]||{};sh.cols[c]={w:cc.wpx||(cc.wch?Math.round(cc.wch*7+5):64),hidden:!!cc.hidden}}
  for(let r=1;r<=sh.used.r1;r++){const rr=rows[r-1]||{};sh.rows[r]={h:rr.hpx||null,hidden:!!rr.hidden}}
  for(let r=sh.used.r0;r<=sh.used.r1;r++)for(let c=sh.used.c0;c<=sh.used.c1;c++){const cell=ws[XLSX.utils.encode_cell({r:r-1,c:c-1})];if(!cell)continue;const t=cell.w!=null?cell.w:(cell.v==null?'':String(cell.v));
   const s={};if(cell.t==='n'||cell.t==='d')s.ha='right';s.va='bottom';if(t)sh.cells.set(r+','+c,{t,s})}
  sheets.push(sh)}
 return {sheets,styled:false}}

/* ---------- 2) armar la tabla y las páginas ---------- */
const escH=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const FONT=n=>"'"+String(n||'Calibri').replace(/'/g,'')+"','Carlito','Liberation Sans',Arial,sans-serif";
function cellCss(s,grid){let css='';const bd=(k,side)=>{const b=s['b'+k];if(b){const [w,st]=BSTY[b[0]];return 'border-'+side+':'+w+'px '+st+' #'+b[1]+';'}return grid?'border-'+side+':1px solid #D9D9D9;':''};
 css+=bd('t','top')+bd('l','left')+bd('b','bottom')+bd('r','right');
 if(s.bg)css+='background:#'+s.bg+';';if(s.ha)css+='text-align:'+s.ha+';';css+='vertical-align:'+(s.va==='center'?'middle':s.va||'bottom')+';';
 css+='font-family:'+FONT(s.fn)+';font-size:'+((s.sz||11)*96/72).toFixed(1)+'px;';if(s.b)css+='font-weight:700;';if(s.i)css+='font-style:italic;';
 const dec=[s.u?'underline':'',s.st?'line-through':''].filter(Boolean).join(' ');if(dec)css+='text-decoration:'+dec+';';if(s.fc)css+='color:#'+s.fc+';';
 css+='white-space:'+(s.wr?'pre-wrap':'pre')+';';if(s.ind)css+='padding-left:'+(3+s.ind*9)+'px;';return css}
function mergeAt(sh){const m=new Map();for(const g of sh.merges)for(let r=g.r0;r<=g.r1;r++)for(let c=g.c0;c<=g.c1;c++)m.set(r+','+c,g);return m}
/* filas y columnas visibles del área */
function areaOf(sh,o){const a=(o.range&&parseRange(o.range))||sh.setup.area||sh.used;const rows=[],cols=[];
 for(let r=a.r0;r<=a.r1;r++)if(!(sh.rows[r]&&sh.rows[r].hidden))rows.push(r);for(let c=a.c0;c<=a.c1;c++)if(!(sh.cols[c]&&sh.cols[c].hidden))cols.push(c);return {a,rows,cols}}
function tableHtml(sh,rows,cols,o,MA,rowH){const W=c=>(sh.cols[c]&&sh.cols[c].w)||64;const tw=cols.reduce((s,c)=>s+W(c),0);
 let h='<table class="xq-t" style="width:'+tw+'px"><colgroup>'+cols.map(c=>'<col style="width:'+W(c)+'px">').join('')+'</colgroup><tbody>';const cset=new Set(cols),rset=new Set(rows);
 for(const r of rows){const hh=rowH?rowH.get(r):(sh.rows[r]&&sh.rows[r].h);h+='<tr data-r="'+r+'"'+(hh?' style="height:'+hh.toFixed(1)+'px"':'')+'>';
  for(const c of cols){const g=MA.get(r+','+c);let cs=1,rs=1,key=r+','+c;
   if(g){const fr=rows.find(x=>x>=g.r0&&x<=g.r1),fc=cols.find(x=>x>=g.c0&&x<=g.c1);if(r!==fr||c!==fc)continue;key=g.r0+','+g.c0;cs=cols.filter(x=>x>=g.c0&&x<=g.c1).length;rs=rows.filter(x=>x>=r&&x<=g.r1).length}
   const cell=sh.cells.get(key)||{t:'',s:{}};let s=cell.s;if(g){/* el borde derecho e inferior de una combinada salen de la última celda */const br=sh.cells.get(g.r0+','+g.c1),bb=sh.cells.get(g.r1+','+g.c0);s={...s};if(br&&br.s.br)s.br=br.s.br;if(bb&&bb.s.bb)s.bb=bb.s.bb}
   h+='<td'+(cs>1?' colspan="'+cs+'"':'')+(rs>1?' rowspan="'+rs+'"':'')+' style="'+cellCss(s,o.grid)+'">'+escH(cell.t)+'</td>'}
  h+='</tr>'}
 return {html:h+'</tbody></table>',tw}}
const XQ_CSS='.xq-t{border-collapse:collapse;table-layout:fixed;background:#fff;color:#000}.xq-t td{padding:1px 3px;overflow:hidden;line-height:1.2;box-sizing:border-box}'
 +'.xq-page{position:relative;background:#fff;box-sizing:border-box;overflow:hidden}.xq-in{position:absolute;transform-origin:0 0}.xq-img{position:absolute;pointer-events:none}.xq-num{position:absolute;bottom:4mm;left:0;right:0;text-align:center;font:11px Arial,sans-serif;color:#444}';
function ensureCss(){if(!document.getElementById('xqCss'))document.head.insertAdjacentHTML('beforeend','<style id="xqCss">'+XQ_CSS+'</style>')}
/* mide el alto real de cada fila (las que se ajustan solas crecen con el texto) */
function measure(sh,area,o,MA){ensureCss();const host=document.createElement('div');host.style.cssText='position:fixed;left:-99999px;top:0;visibility:hidden';const {html,tw}=tableHtml(sh,area.rows,area.cols,o,MA,null);host.innerHTML=html;document.body.appendChild(host);
 const rowH=new Map();for(const tr of host.querySelectorAll('tr'))rowH.set(+tr.dataset.r,tr.getBoundingClientRect().height);host.remove();return {rowH,tw}}
/* opciones → páginas: [{rows,scale,offX,offY,images}] */
function paginate(sh,o){const MA=mergeAt(sh),area=areaOf(sh,o);if(!area.rows.length||!area.cols.length)return {pages:[],area};const {rowH,tw}=measure(sh,area,o,MA);
 let [wmm,hmm]=SIZES[o.size]||SIZES.a4;if(o.land)[wmm,hmm]=[hmm,wmm];const pw=mm2px(wmm),ph=mm2px(hmm),m=mm2px(o.margin),cw=pw-2*m,ch=ph-2*m-(o.num?mm2px(8):0);
 const th=area.rows.reduce((s,r)=>s+rowH.get(r),0);
 const s=o.fit==='ancho'?Math.min(1,cw/tw):o.fit==='pagina'?Math.min(1,cw/tw,ch/th):o.fit==='100'?1:Math.max(.1,o.zoom/100);
 const rep=o.rep>0?area.rows.slice(0,o.rep):[];const repH=rep.reduce((t,r)=>t+rowH.get(r),0);const avail=ch/s;const groups=[];let cur=[],hh=0;
 for(const r of area.rows){const h=rowH.get(r);if(cur.length&&hh+h>avail+.5&&cur.some(x=>!rep.includes(x))){groups.push(cur);cur=rep.slice();hh=repH}cur.push(r);hh+=h}if(cur.length)groups.push(cur);
 const W=c=>(sh.cols[c]&&sh.cols[c].w)||64;const colX=new Map();{let x=0;for(let c=1;c<=Math.max(...area.cols)+1;c++){colX.set(c,x);if(area.cols.includes(c))x+=W(c)}}
 const pages=groups.map((rows,pi)=>{const gh=rows.reduce((t,r)=>t+rowH.get(r),0);let offX=m+(o.center?Math.max(0,(cw-tw*s)/2):0)+mm2px(o.dx||0),offY=m+(o.vcenter?Math.max(0,(ch-gh*s)/2):0)+mm2px(o.dy||0);
  /* logos e imágenes: van en la página de la fila donde están ancladas */
  const rowY=new Map();{let y=0;for(const r of rows){if(!rowY.has(r))rowY.set(r,y);y+=rowH.get(r)}}
  const imgs=[];for(const im of sh.images){const r=Math.floor(im.r)+1;if(!rowY.has(r)||rep.includes(r)&&pi>0)continue;const c=Math.floor(im.c)+1;if(!area.cols.includes(c))continue;
   const x=colX.get(c)+(im.c-Math.floor(im.c))*W(c),y=rowY.get(r)+(im.r-Math.floor(im.r))*rowH.get(r);let w=im.w,h=im.h;
   if((!w||!h)&&im.br){const c2=Math.floor(im.br.c)+1,r2=Math.floor(im.br.r)+1;const x2=(colX.get(c2)||x)+(im.br.c-Math.floor(im.br.c))*W(c2);let y2=y;{let yy=0,ok=false;for(const rr of rows){if(rr===r2){y2=yy+(im.br.r-Math.floor(im.br.r))*rowH.get(rr);ok=true;break}yy+=rowH.get(rr)}if(!ok)y2=y+20}w=Math.max(8,x2-x);h=Math.max(8,y2-y)}
   imgs.push({...im,x,y,w:w||80,h:h||40})}
  return {rows,scale:s,offX,offY,images:imgs,gh}});
 return {pages,area,tw,rowH,pw,ph,wmm,hmm,MA,s}}
function pageEl(sh,P,pg,i,o){const div=document.createElement('div');div.className='xq-page';div.style.cssText='width:'+P.pw+'px;height:'+P.ph+'px';
 const inner=document.createElement('div');inner.className='xq-in';inner.style.cssText='left:'+pg.offX+'px;top:'+pg.offY+'px;transform:scale('+pg.scale+')';
 inner.innerHTML=tableHtml(sh,pg.rows,P.area.cols,o,P.MA,P.rowH).html+pg.images.map(im=>'<img class="xq-img" src="'+im.src+'" style="left:'+im.x.toFixed(1)+'px;top:'+im.y.toFixed(1)+'px;width:'+im.w.toFixed(1)+'px;height:'+im.h.toFixed(1)+'px" alt="">').join('');
 div.appendChild(inner);if(o.num){const n=document.createElement('div');n.className='xq-num';n.textContent=(i+1)+' / '+o._total;div.appendChild(n)}return div}

/* ---------- 3) Word: la tabla con sus anchos, colores, bordes y combinadas ---------- */
const xe=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
async function toDocx(list,o){await loadLib('jszip');const zip=new JSZip();const media=[];let body='';let firstSect=true;
 const TW=px=>Math.max(0,Math.round(px*PX_TW));
 for(const {sh,P} of list){if(!P.pages.length)continue;const s=P.s,rows=P.area.rows,cols=P.area.cols,W=c=>(sh.cols[c]&&sh.cols[c].w)||64,MA=P.MA;const rep=o.rep>0?rows.slice(0,o.rep):[];
  const pg0=P.pages[0],left=TW(pg0.offX-mm2px(o.margin)),topTw=TW(pg0.offY-mm2px(o.margin));
  if(!firstSect)body+='<w:p><w:r><w:br w:type="page"/></w:r></w:p>';firstSect=false;
  /* logos de la planilla, anclados a la hoja en su lugar */
  let anch='';for(const im of pg0.images){const id=media.length+1;media.push({id,ext:im.ext,bytes:im.bytes});const x=Math.round((pg0.offX+im.x*s)*PX_EMU),y=Math.round((pg0.offY+im.y*s)*PX_EMU),cx=Math.round(im.w*s*PX_EMU),cy=Math.round(im.h*s*PX_EMU);
   anch+='<w:r><w:drawing><wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="'+(2+id)+'" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1"><wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="page"><wp:posOffset>'+x+'</wp:posOffset></wp:positionH><wp:positionV relativeFrom="page"><wp:posOffset>'+y+'</wp:posOffset></wp:positionV><wp:extent cx="'+cx+'" cy="'+cy+'"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/><wp:docPr id="'+(100+id)+'" name="Imagen '+id+'"/><wp:cNvGraphicFramePr/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="'+(100+id)+'" name="img'+id+'"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdImg'+id+'"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="'+cx+'" cy="'+cy+'"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:anchor></w:drawing></w:r>'}
  body+='<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="'+Math.max(20,topTw)+'" w:lineRule="exact"/></w:pPr>'+anch+'</w:p>';
  const gw=cols.map(c=>TW(W(c)*s));const B=(b,dflt)=>{if(b){const [,,sz,val]=BSTY[b[0]];return '<w:VAL w:val="'+val+'" w:sz="'+sz+'" w:space="0" w:color="'+b[1]+'"/>'}return dflt?'<w:VAL w:val="single" w:sz="2" w:space="0" w:color="D9D9D9"/>':'<w:VAL w:val="nil"/>'};
  let t='<w:tbl><w:tblPr><w:tblW w:w="'+gw.reduce((a,b)=>a+b,0)+'" w:type="dxa"/><w:tblInd w:w="'+left+'" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="40" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="40" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>'+gw.map(w=>'<w:gridCol w:w="'+w+'"/>').join('')+'</w:tblGrid>';
  rows.forEach(r=>{t+='<w:tr><w:trPr><w:trHeight w:val="'+TW(P.rowH.get(r)*s)+'" w:hRule="atLeast"/>'+(rep.includes(r)?'<w:tblHeader/>':'')+'<w:cantSplit/></w:trPr>';
   for(let ci=0;ci<cols.length;){const c=cols[ci],g=MA.get(r+','+c);let span=1,vm='';let key=r+','+c;
    if(g){const fc=cols.find(x=>x>=g.c0&&x<=g.c1);span=cols.filter(x=>x>=g.c0&&x<=g.c1).length;key=g.r0+','+g.c0;const fr=rows.find(x=>x>=g.r0&&x<=g.r1);if(g.r1>g.r0)vm=r===fr?'<w:vMerge w:val="restart"/>':'<w:vMerge/>';if(c!==fc){ci++;continue}}
    const cell=sh.cells.get(key)||{t:'',s:{}};let s2=cell.s;if(g){const br=sh.cells.get(g.r0+','+g.c1),bb=sh.cells.get(g.r1+','+g.c0);s2={...s2};if(br&&br.s.br)s2.br=br.s.br;if(bb&&bb.s.bb)s2.bb=bb.s.bb}
    const cont=g&&vm==='<w:vMerge/>';const w=gw.slice(ci,ci+span).reduce((a,b)=>a+b,0);
    const bord=['top','left','bottom','right'].map(k=>B(s2['b'+k[0]],o.grid).replace(/VAL/,k)).join('');
    let tc='<w:tc><w:tcPr><w:tcW w:w="'+w+'" w:type="dxa"/>'+(span>1?'<w:gridSpan w:val="'+span+'"/>':'')+vm+'<w:tcBorders>'+bord+'</w:tcBorders>'+(s2.bg?'<w:shd w:val="clear" w:color="auto" w:fill="'+s2.bg+'"/>':'')+'<w:vAlign w:val="'+(s2.va==='center'?'center':s2.va==='top'?'top':'bottom')+'"/></w:tcPr>';
    const jc=s2.ha==='center'?'center':s2.ha==='right'?'right':s2.ha==='justify'?'both':'left';
    const rpr='<w:rPr><w:rFonts w:ascii="'+xe(s2.fn||'Calibri')+'" w:hAnsi="'+xe(s2.fn||'Calibri')+'" w:cs="'+xe(s2.fn||'Calibri')+'"/>'+(s2.b?'<w:b/>':'')+(s2.i?'<w:i/>':'')+(s2.st?'<w:strike/>':'')+(s2.u?'<w:u w:val="single"/>':'')+(s2.fc?'<w:color w:val="'+s2.fc+'"/>':'')+'<w:sz w:val="'+Math.max(2,Math.round((s2.sz||11)*2*s))+'"/></w:rPr>';
    const txt=cont?'':String(cell.t||'');const runs=txt.split('\n').map((ln,k)=>(k?'<w:r>'+rpr+'<w:br/></w:r>':'')+'<w:r>'+rpr+'<w:t xml:space="preserve">'+xe(ln)+'</w:t></w:r>').join('');
    tc+='<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="'+jc+'"/>'+(s2.ind?'<w:ind w:left="'+Math.round(s2.ind*135*s)+'"/>':'')+'</w:pPr>'+runs+'</w:p></w:tc>';t+=tc;ci+=span}
   t+='</w:tr>'});
  body+=t+'</w:tbl><w:p/>'}
 let [wmm,hmm]=SIZES[o.size]||SIZES.a4;if(o.land)[wmm,hmm]=[hmm,wmm];const mt=Math.round(o.margin*MM_TW);
 const sect='<w:sectPr><w:pgSz w:w="'+Math.round(wmm*MM_TW)+'" w:h="'+Math.round(hmm*MM_TW)+'"'+(o.land?' w:orient="landscape"':'')+'/><w:pgMar w:top="'+mt+'" w:right="'+mt+'" w:bottom="'+mt+'" w:left="'+mt+'" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr>';
 const doc='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>'+body+sect+'</w:body></w:document>';
 zip.file('[Content_Types].xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
 zip.file('_rels/.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
 zip.file('word/_rels/document.xml.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+media.map(m=>'<Relationship Id="rIdImg'+m.id+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image'+m.id+'.'+m.ext+'"/>').join('')+'</Relationships>');
 zip.file('word/document.xml',doc);for(const m of media)zip.file('word/media/image'+m.id+'.'+m.ext,m.bytes);
 return zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'})}

/* ---------- 4) la pantalla ---------- */
const FMT={pdf:['PDF','Generar PDF'],docx:['Word','Generar Word'],jpg:['JPG','Generar JPG']};
__mods.uiExcelPdf=function(el,fmt0){ensureCss();let book=null,file=null,tmr=0,last=null;const st={fmt:fmt0||'pdf',dx:0,dy:0};
 const ch=(cls,opts)=>'<div class="xq-seg '+cls+'" role="radiogroup">'+opts.map(([v,n])=>'<button type="button" class="chip" data-v="'+v+'" role="radio">'+n+'</button>').join('')+'</div>';
 el.innerHTML='<div class="fp"></div><div class="xq-opts" hidden>'
  +'<div class="xq-row"><span class="xq-l">Convertir a</span>'+ch('xq-fmt',[['pdf','PDF'],['docx','Word'],['jpg','JPG']])+'</div>'
  +'<div class="row">'+opt('Hoja','<select class="xq-sh"></select>')+opt('Tamaño de hoja','<select class="xq-sz"><option value="a4">A4</option><option value="oficio">Oficio</option><option value="carta">Carta</option></select>')+'</div>'
  +'<div class="xq-row"><span class="xq-l">Orientación</span>'+ch('xq-or',[['v','Vertical'],['h','Horizontal']])+'</div>'
  +'<div class="row">'+opt('Escala','<select class="xq-fit"><option value="ancho">Ajustar al ancho</option><option value="pagina">Todo en una hoja</option><option value="100">Tamaño real (100 %)</option><option value="custom">Personalizada</option></select>')+opt('Rango (opcional)','<input class="xq-rg" placeholder="Ej.: A1:H40" autocomplete="off" spellcheck="false">')+'</div>'
  +'<label class="opt xq-zw" hidden><span>Escala: <b class="xq-zv">100</b> %</span><input type="range" class="xq-z" min="25" max="200" value="100"></label>'
  +'<label class="opt"><span>Márgenes: <b class="xq-mv">10</b> mm</span><input type="range" class="xq-m" min="0" max="30" value="10"></label>'
  +'<div class="row">'+opt('Repetir filas de título','<select class="xq-rep"><option value="0">No</option><option value="1">La primera</option><option value="2">Las 2 primeras</option><option value="3">Las 3 primeras</option></select>')+'</div>'
  +'<label class="chk"><input type="checkbox" class="xq-grid"> Mostrar las líneas de la cuadrícula</label><label class="chk"><input type="checkbox" class="xq-cen" checked> Centrar a lo ancho</label><label class="chk"><input type="checkbox" class="xq-vcen"> Centrar a lo alto</label><label class="chk"><input type="checkbox" class="xq-pnum"> Numerar las páginas</label>'
  +'<div class="cph">Vista previa <span class="muted xq-info"></span></div><p class="muted xq-tip">Arrastrá la planilla en la primera hoja para acomodarla.</p><div class="xq-pos"><button type="button" class="btn sm xq-reset">Volver al lugar</button></div><div class="xq-prev"><div class="xq-pages"></div></div></div>'
  +'<button class="btn pri block run">'+FMT[st.fmt][1]+'</button><div class="result"></div>';
 const $q=s=>el.querySelector(s);
 const segSet=(cls,v)=>el.querySelectorAll('.'+cls+' [data-v]').forEach(b=>{const on=b.dataset.v===v;b.classList.toggle('on',on);b.setAttribute('aria-checked',on)});
 const segGet=cls=>{const b=el.querySelector('.'+cls+' .on');return b?b.dataset.v:null};
 segSet('xq-fmt',st.fmt);segSet('xq-or','v');
 const O=()=>({sheet:$q('.xq-sh').value,size:$q('.xq-sz').value,land:segGet('xq-or')==='h',fit:$q('.xq-fit').value,zoom:+$q('.xq-z').value,margin:+$q('.xq-m').value,range:$q('.xq-rg').value.trim(),rep:+$q('.xq-rep').value,
  grid:$q('.xq-grid').checked,center:$q('.xq-cen').checked,vcenter:$q('.xq-vcen').checked,num:$q('.xq-pnum').checked,dx:st.dx,dy:st.dy});
 const sheetsSel=o=>o.sheet==='*'?book.sheets.filter(s=>!s.empty):book.sheets.filter(s=>s.name===o.sheet&&!s.empty);
 const build=o=>{const list=sheetsSel(o).map(sh=>({sh,P:paginate(sh,o)}));const total=list.reduce((t,x)=>t+x.P.pages.length,0);o._total=total;return {list,total}};
 const layout=()=>{if(!book)return;const o=O();$q('.xq-mv').textContent=o.margin;$q('.xq-zv').textContent=o.zoom;$q('.xq-zw').hidden=o.fit!=='custom';
  let res;try{res=build(o)}catch(e){console.warn(e);$q('.xq-info').textContent='· el rango no es válido';return}last={o,res};
  const wrap=$q('.xq-pages');wrap.innerHTML='';let i=0,pw=0;for(const {sh,P} of res.list)for(const pg of P.pages){const h=document.createElement('div');h.className='xq-hold';h.appendChild(pageEl(sh,P,pg,i,o));wrap.appendChild(h);pw=P.pw;i++}
  const first=res.list.find(x=>x.P.pages.length);const z=pw?Math.min(1,($q('.xq-prev').clientWidth-20)/pw):1;wrap.style.setProperty('--xz',z);
  wrap.querySelectorAll('.xq-hold').forEach(h=>{const p=h.firstChild;h.style.width=(parseFloat(p.style.width)*z)+'px';h.style.height=(parseFloat(p.style.height)*z)+'px';p.style.transform='scale('+z+')';p.style.transformOrigin='0 0'});
  const sc=first?first.P.s:1;$q('.xq-info').textContent='· '+res.total+' página(s) · '+(first?first.P.wmm+'×'+first.P.hmm+' mm':'')+' · escala '+Math.round(sc*100)+' %';
  const wide=first&&o.fit!=='ancho'&&o.fit!=='pagina'&&first.P.tw*sc>mm2px((o.land?(SIZES[o.size]||SIZES.a4)[1]:(SIZES[o.size]||SIZES.a4)[0])-2*o.margin)+1;
  $q('.xq-tip').textContent=wide?'La planilla es más ancha que la hoja: elegí «Ajustar al ancho», «Horizontal» o bajá la escala.':'Arrastrá la planilla en la primera hoja para acomodarla.';$q('.xq-tip').classList.toggle('xq-warn',!!wide);
  dragWire(wrap.querySelector('.xq-hold .xq-in'),z)};
 const relayout=()=>{clearTimeout(tmr);tmr=setTimeout(layout,120)};
 /* arrastrar la planilla en la primera hoja: corre todas las hojas igual */
 function dragWire(inn,z){if(!inn)return;inn.style.cursor='grab';inn.style.touchAction='none';let sx=0,sy=0,b0=null,on=false;
  inn.addEventListener('pointerdown',e=>{on=true;sx=e.clientX;sy=e.clientY;b0={l:parseFloat(inn.style.left),t:parseFloat(inn.style.top)};inn.setPointerCapture(e.pointerId);inn.style.cursor='grabbing';e.preventDefault()});
  inn.addEventListener('pointermove',e=>{if(!on)return;const dx=(e.clientX-sx)/z,dy=(e.clientY-sy)/z;inn.style.left=(b0.l+dx)+'px';inn.style.top=(b0.t+dy)+'px'});
  const up=e=>{if(!on)return;on=false;inn.style.cursor='grab';const dx=(e.clientX-sx)/z,dy=(e.clientY-sy)/z;if(Math.abs(dx)+Math.abs(dy)<2)return;st.dx+=px2mm(dx);st.dy+=px2mm(dy);relayout()};
  inn.addEventListener('pointerup',up);inn.addEventListener('pointercancel',up)}
 el.addEventListener('click',e=>{const b=e.target.closest('.xq-seg [data-v]');if(b){const g=b.parentElement;g.querySelectorAll('[data-v]').forEach(x=>{x.classList.toggle('on',x===b);x.setAttribute('aria-checked',x===b)});
   if(g.classList.contains('xq-fmt')){st.fmt=b.dataset.v;$q('.run').textContent=FMT[st.fmt][1]}else relayout();return}
  if(e.target.closest('.xq-reset')){st.dx=0;st.dy=0;relayout()}});
 el.addEventListener('input',e=>{if(e.target.closest('.xq-opts'))relayout()});el.addEventListener('change',e=>{if(e.target.closest('.xq-opts'))relayout()});
 try{new ResizeObserver(()=>{if(book)relayout()}).observe(el)}catch(e){}
 filePicker($q('.fp'),{accept:'.xlsx,.xls,.xlsm,.csv,.ods',multi:false,onChange:files=>{file=files[0];book=null;st.dx=st.dy=0;$q('.result').innerHTML='';$q('.xq-opts').hidden=!file;if(!file)return;
  withBusy(async()=>{busy('Leyendo planilla…');book=await load(file);const vis=book.sheets.filter(s=>!s.empty);if(!vis.length){busy(false);toast('La planilla está vacía');return}
   $q('.xq-sh').innerHTML=(vis.length>1?'<option value="*">Todas las hojas</option>':'')+vis.map(s=>'<option>'+esc(s.name)+'</option>').join('');
   /* lo que trae el archivo para imprimir manda: orientación, papel, escala, márgenes, centrado y filas de título */
   const su=vis[0].setup||{},u=vis[0].used;segSet('xq-or',su.land!=null&&(su.land||su.size||su.fit)?(su.land?'h':'v'):((u.c1-u.c0)>6?'h':'v'));if(su.size)$q('.xq-sz').value=su.size;
   if(su.fit)$q('.xq-fit').value=su.fit;if(su.fit==='custom'){$q('.xq-z').value=su.zoom}if(su.margin!=null)$q('.xq-m').value=su.margin;if(su.center)$q('.xq-cen').checked=true;if(su.vcenter)$q('.xq-vcen').checked=true;
   if(su.rep&&su.rep[0]===(su.area||u).r0)$q('.xq-rep').value=String(Math.min(3,su.rep[1]-su.rep[0]+1));
   $q('.xq-grid').checked=!book.styled;busy(false);layout();if(!book.styled)toast('Este formato no guarda colores ni bordes: se pasan los datos con la cuadrícula',4500)})}});
 $q('.run').onclick=()=>withBusy(async()=>{if(!book)return toast('Primero elegí una planilla');layout();if(!last||!last.res.total)return toast('No hay nada para convertir en esa hoja o rango');const o=last.o,res=last.res,base=baseName(file);
  if(st.fmt==='docx'){busy('Armando el Word…');const blob=await toDocx(res.list,o);busy(false);return showResults($q('.result'),[{blob,name:base+'.docx',note:res.total+' página(s) aprox. · '+o.size.toUpperCase()+' '+(o.land?'horizontal':'vertical')}])}
  await loadLib('h2c');const host=document.createElement('div');host.style.cssText='position:fixed;left:-99999px;top:0';document.body.appendChild(host);const cans=[];
  try{let i=0;for(const {sh,P} of res.list)for(const pg of P.pages){busy('Generando página '+(i+1)+'/'+res.total);host.innerHTML='';const p=pageEl(sh,P,pg,i,o);host.appendChild(p);
    cans.push({c:await html2canvas(p,{scale:st.fmt==='jpg'?2.5:2,backgroundColor:'#ffffff',logging:false,useCORS:true}),P});i++}}finally{host.remove()}
  if(st.fmt==='jpg'){const outs=[];for(const [i,{c}] of cans.entries()){outs.push({blob:await canvasBlob(c,'image/jpeg',.92),name:base+(cans.length>1?'_'+(i+1):'')+'.jpg',note:'Página '+(i+1)+' · '+c.width+'×'+c.height+' px'});c.width=c.height=1}busy(false);return showResults($q('.result'),outs)}
  await loadLib('pdflib');const pdf=await PDFLib.PDFDocument.create();for(const {c,P} of cans){await canvasToPdfPage(pdf,c,P.wmm*72/25.4,P.hmm*72/25.4);c.width=c.height=1}
  busy(false);showResults($q('.result'),[{blob:pdfBlob(await pdf.save()),name:base+'.pdf',note:res.total+' página(s) · '+o.size.toUpperCase()+' '+(o.land?'horizontal':'vertical')+' · márgenes '+o.margin+' mm'}])})};
/* para las pruebas */
__mods.xl={load,loadExcelJS,paginate,pageEl,toDocx,parseRange,colorOf,tableHtml,mergeAt};
document.head.insertAdjacentHTML('beforeend','<style id="xqUiCss">.xq-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:6px 0 10px}.xq-l{font-weight:700;min-width:96px}.xq-seg{display:flex;gap:8px;flex-wrap:wrap}.xq-seg .chip{min-height:42px;padding:0 16px;font-weight:700}'
 +'.xq-prev{overflow:auto;max-height:62vh;padding:10px;border-radius:16px;background:var(--stage,#E3E9F1)}.xq-pages{display:flex;flex-direction:column;align-items:center;gap:12px}.xq-hold{position:relative;overflow:hidden;box-shadow:0 6px 18px -8px rgba(23,32,51,.45);border-radius:2px;flex:none}'
 +'.xq-hold .xq-page{position:absolute;left:0;top:0}.xq-pos{display:flex;gap:8px;margin:0 0 8px}.xq-tip{margin:0 0 6px}.xq-tip.xq-warn{color:#B45309;font-weight:700}</style>');
})();
