/* Danscanner Pro · Editor de Word (v84). Se carga solo cuando se usa la herramienta.
 * 1. Abre un PDF (texto real o, si es escaneado, con OCR) o un Word (.docx) y lo convierte en un documento editable.
 *    Del PDF se respetan párrafos, títulos, negritas, centrado/derecha/justificado, sangría y tablas (con el lector de mod/tabla.js).
 * 2. Se edita con una cinta como la de Word: Inicio (letra, tamaño, estilos, colores, alineación, listas, interlineado),
 *    Insertar (imagen o logo, firma, fecha, tabla, salto de página, línea, símbolos), Diseño (hoja, orientación, márgenes,
 *    números de página, vista) y Revisar (buscar y reemplazar, contar palabras, ortografía).
 * 3. Se guarda como Word (.docx propio: párrafos, formato, listas, tablas, imágenes, pie con número de página) o como PDF.
 * Todo corre en el teléfono; el borrador se guarda solo en este dispositivo. */
window.__mods=window.__mods||{};
(function(){
'use strict';
const WD={};
const PAGES={a4:{n:'A4',w:210,h:297},oficio:{n:'Oficio',w:216,h:356},carta:{n:'Carta',w:216,h:279}};
const MARGINS={normal:{n:'Normal (2,5 cm)',t:25,r:25,b:25,l:25},judicial:{n:'Judicial (izq. 3 cm)',t:25,r:20,b:20,l:30},estrecho:{n:'Estrecho (1,3 cm)',t:13,r:13,b:13,l:13}};
const FONTS=[['Arial','Arial, Helvetica, sans-serif'],['Times New Roman','"Times New Roman", Times, serif'],['Calibri','Calibri, Carlito, Arial, sans-serif'],['Georgia','Georgia, serif'],['Verdana','Verdana, sans-serif'],['Courier New','"Courier New", monospace']];
const SIZES=[8,9,10,11,12,14,16,18,20,24,28,36];
const KEY='ds_word_draft';
const med=a=>{if(!a.length)return 0;const s=a.slice().sort((x,y)=>x-y);return s[s.length>>1]};
const escH=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* ---------- 1. PDF → HTML editable ---------- */
/* v85: las imágenes del PDF (logos, sellos, firmas) se sacan con su lugar exacto: se recorren las operaciones de dibujo de la página
 * (con la matriz de transformación) y se recorta cada una de la página dibujada, con el blanco transparente para que quede superpuesta como en el original.
 * El texto que cae adentro de un logo o una firma (garabatos que el PDF trae como letras) se saca del texto. Una imagen que tapa 3 o más renglones
 * es un fondo o una marca de agua: no se toma. */
WD.pdfImages=async function(ab){const lib=await getPdfjs(),O=lib.OPS,pdf=await openPdfjs(ab),pages=[];
 const mul=(m,t)=>[m[0]*t[0]+m[2]*t[1],m[1]*t[0]+m[3]*t[1],m[0]*t[2]+m[2]*t[3],m[1]*t[2]+m[3]*t[3],m[0]*t[4]+m[2]*t[5]+m[4],m[1]*t[4]+m[3]*t[5]+m[5]];
 const IMG=new Set([O.paintImageXObject,O.paintInlineImageXObject,O.paintImageMaskXObject,O.paintJpegXObject].filter(x=>x!=null));
 for(let n=1;n<=pdf.numPages;n++){const page=await pdf.getPage(n),vp=page.getViewport({scale:1}),ol=await page.getOperatorList();let ctm=[1,0,0,1,0,0];const stk=[],boxes=[];
  for(let i=0;i<ol.fnArray.length;i++){const f=ol.fnArray[i],a=ol.argsArray[i];
   if(f===O.save)stk.push(ctm.slice());else if(f===O.restore)ctm=stk.pop()||ctm;else if(f===O.transform)ctm=mul(ctm,a);
   else if(f===O.paintFormXObjectBegin){stk.push(ctm.slice());if(a&&a[0]&&a[0].length===6)ctm=mul(ctm,a[0])}else if(f===O.paintFormXObjectEnd)ctm=stk.pop()||ctm;
   else if(IMG.has(f)){const pts=[[0,0],[1,0],[0,1],[1,1]].map(([x,y])=>[ctm[0]*x+ctm[2]*y+ctm[4],ctm[1]*x+ctm[3]*y+ctm[5]]);
    const r=vp.convertToViewportRectangle([Math.min(...pts.map(p=>p[0])),Math.min(...pts.map(p=>p[1])),Math.max(...pts.map(p=>p[0])),Math.max(...pts.map(p=>p[1]))]);
    const b={x0:Math.max(0,Math.min(r[0],r[2])),y0:Math.max(0,Math.min(r[1],r[3])),x1:Math.min(vp.width,Math.max(r[0],r[2])),y1:Math.min(vp.height,Math.max(r[1],r[3]))};
    if(b.x1-b.x0>=6&&b.y1-b.y0>=6&&!boxes.some(o=>Math.abs(o.x0-b.x0)<2&&Math.abs(o.y0-b.y0)<2&&Math.abs(o.x1-b.x1)<2&&Math.abs(o.y1-b.y1)<2))boxes.push(b)}}
  pages.push({n,W:vp.width,H:vp.height,boxes})}
 return {pdf,pages}};
WD.cropTransparent=function(c,b,k){const pad=2,x=Math.max(0,Math.floor(b.x0*k)-pad),y=Math.max(0,Math.floor(b.y0*k)-pad),w=Math.min(c.width-x,Math.ceil((b.x1-b.x0)*k)+pad*2),h=Math.min(c.height-y,Math.ceil((b.y1-b.y0)*k)+pad*2);
 const o=document.createElement('canvas');o.width=w;o.height=h;const ox=o.getContext('2d');ox.drawImage(c,x,y,w,h,0,0,w,h);const id=ox.getImageData(0,0,w,h),d=id.data;
 for(let i=0;i<d.length;i+=4){const l=(d[i]*77+d[i+1]*150+d[i+2]*29)>>8;if(l>242)d[i+3]=0;else if(l>214)d[i+3]=Math.round((242-l)/28*255)}ox.putImageData(id,0,0);return o.toDataURL('image/png')};
const mmPt=v=>Math.round(v*25.4/72*10)/10;
WD.pdfToHtml=async function(ab,onProg){await lazyMod('tabla');const TX=__mods.TX;let im=null;onProg&&onProg('Buscando logos, sellos y firmas…');try{im=await WD.pdfImages(ab.slice(0))}catch(e){console.warn('imágenes del PDF',e)}
 const pages=await TX.fromPdf(ab,{ocr:'auto',onProg});try{await TX.endOcr()}catch(e){}let floats=0;const secs=[];
 for(const [i,pg] of pages.entries()){const P=im&&im.pages[i];let fl='';
  if(P&&!pg.ocr){const sc=pg.scale||1;const lines=(pg.blocks||[]).filter(b=>b.kind==='text').map(b=>{const c=b.rows[0][0];return {b,cx:((c.x+(c.x1||c.x))/2)/sc,cy:(b.y+(c.h||10)/2)/sc,drop:false}});const keep=[];
   for(const bx of P.boxes){if((bx.x1-bx.x0)*(bx.y1-bx.y0)>P.W*P.H*.5)continue;const inside=lines.filter(l=>l.cx>=bx.x0-2&&l.cx<=bx.x1+2&&l.cy>=bx.y0-2&&l.cy<=bx.y1+2);if(inside.length>=3)continue;inside.forEach(l=>l.drop=true);keep.push(bx)}
   if(keep.length){pg.blocks=pg.blocks.filter(b=>!lines.some(l=>l.b===b&&l.drop));onProg&&onProg('Copiando logos, sellos y firmas…');const k=3;const {c}=await renderPdfPage(im.pdf,i+1,k);
    for(const bx of keep){fl+='<img class="wfl" alt="" draggable="false" src="'+WD.cropTransparent(c,bx,k)+'" data-x="'+mmPt(bx.x0)+'" data-y="'+mmPt(bx.y0)+'" data-w="'+mmPt(bx.x1-bx.x0)+'">';floats++}c.width=c.height=1}}
  const inner=WD.blocksToHtml(pg)||'<p><br></p>';const sst=(pg._lh&&Math.abs(pg._lh-1.15)>.08?'line-height:'+pg._lh+';':'')+(pg._pt&&pg._pt>=7&&pg._pt<=20&&Math.abs(pg._pt-12)>=.5?'font-size:'+pg._pt+'pt;':'');
  secs.push('<section class="wpg"'+(sst?' style="'+sst+'"':'')+'>'+fl+inner+'</section>')}
 return {html:secs.join('')||'<p><br></p>',ocr:pages.some(p=>p.ocr),pages:pages.length,floats}};
WD.tableHtml=function(B){const cov=new Set(),span={};for(const m of B.merges||[]){span[m.r1+','+m.c1]=m;for(let r=m.r1;r<=m.r2;r++)for(let c=m.c1;c<=m.c2;c++)if(r!==m.r1||c!==m.c1)cov.add(r+','+c)}
 const nc=Math.max(1,...B.rows.map(r=>r.length)),bd=B.kind==='grid';let h='<table class="wtb'+(bd?'':' wtb-nb')+'"><tbody>';
 B.rows.forEach((row,r)=>{h+='<tr>';for(let c=0;c<nc;c++){if(cov.has(r+','+c))continue;const cell=row[c],m=span[r+','+c];const v=cell?escH(cell.v).replace(/\n/g,'<br>'):'';
   h+='<td'+(m?(m.c2>m.c1?' colspan="'+(m.c2-m.c1+1)+'"':'')+(m.r2>m.r1?' rowspan="'+(m.r2-m.r1+1)+'"':''):'')+'>'+(cell&&cell.b&&v?'<b>'+v+'</b>':v||'<br>')+'</td>'}h+='</tr>'});
 return h+'</tbody></table>'};
WD.blocksToHtml=function(pg){const B=pg.blocks||[];if(!B.length)return '';const Wd=pg.W||1,sc=pg.scale||1;
 const T=B.filter(b=>b.kind==='text').map(b=>b.rows[0][0]);if(!T.length)return B.map(WD.tableHtml).join('');
 const L=Math.min(...T.map(c=>c.x)),R=Math.max(...T.map(c=>c.x1||c.x)),CW=Math.max(1,R-L),hMed=med(T.map(c=>c.h||0).filter(Boolean))||12;
 const ys=[];for(let i=1;i<B.length;i++)if(B[i].kind==='text'&&B[i-1].kind==='text')ys.push(B[i].y-B[i-1].y);const pitch=med(ys)||hMed*1.5;
 const alignOf=c=>{const x0=c.x,x1=c.x1||c.x,w=x1-x0,mid=(x0+x1)/2;if(w<CW*.85&&Math.abs(mid-(L+R)/2)<Wd*.035&&x0>L+Wd*.04)return 'center';if(x0>L+CW*.35&&R-x1<Wd*.03)return 'right';return 'left'};
 const ptOf=c=>Math.round((c.h||hMed)/sc);let out='',P=null,lastY=null;const mmOf=px=>Math.round(px/sc*.3528*10)/10;
 /* v85: interlineado y tamaño de letra del PDF (se aplican a la hoja) */
 pg._lh=Math.max(1,Math.min(2.4,Math.round(pitch/(hMed/1.02)*100)/100));pg._pt=Math.round(hMed/sc/1.02*2)/2;
 const flush=()=>{if(!P)return;let st='';const al=P.lines.length>1&&P.align==='left'&&P.lines.slice(0,-1).every(c=>R-(c.x1||c.x)<CW*.06)?'justify':P.align;
  if(al!=='left')st+='text-align:'+al+';';const x0s=P.lines.map(c=>c.x),allIn=P.align==='left'&&Math.min(...x0s)>L+Wd*.035;
  if(allIn)st+='margin-left:'+mmOf(Math.min(...x0s)-L)+'mm;';else if(P.align==='left'&&P.lines[0].x>L+Wd*.035&&P.lines[0].x<L+CW*.3)st+='text-indent:'+mmOf(P.lines[0].x-L)+'mm;';
  if(P.gap>0)st+='margin-top:'+P.gap+'mm;';
  const tag=P.head?(P.head>1.75?'h1':P.head>1.4?'h2':'h3'):'p';let txt='';P.lines.forEach((c,i)=>{const t=escH(c.v.replace(/\s{2,}/g,' ').trim());if(!i){txt=t;return}txt=/[A-Za-zÁÉÍÓÚÑáéíóúñ]-$/.test(txt)?txt.slice(0,-1)+t:txt+' '+t});
  if(P.bold&&!P.head)txt='<b>'+txt+'</b>';if(P.head)st+='font-size:'+P.pt+'pt;';out+='<'+tag+(st?' style="'+st+'"':'')+'>'+(txt||'<br>')+'</'+tag+'>';P=null};
 let prev=null;
 for(const b of B){if(b.kind!=='text'){flush();out+=WD.tableHtml(b);prev=null;continue}
  const c=b.rows[0][0],al=alignOf(c),rel=(c.h||hMed)/hMed,head=rel>=1.3?rel:0;
  const cont=P&&prev&&!head&&!P.head&&al==='left'&&P.align==='left'&&b.y-prev.y<=pitch*1.35&&R-(prev.x1||prev.x)<CW*.12&&!/[:]$/.test(prev.v.trim())&&!!c.b===!!P.bold;
  if(!cont){flush();/* espacio de más respecto del renglón anterior (o del margen de arriba en el primero) */const gap=lastY==null?Math.max(0,mmOf(b.y)-25):Math.max(0,mmOf(b.y-lastY-pitch));P={lines:[c],align:al,head,pt:ptOf(c),bold:!!c.b,gap:gap>1?Math.round(gap*10)/10:0}}else P.lines.push(c);prev={...c,y:b.y};lastY=b.y}
 flush();return out};

/* ---------- 2. Word (.docx) → HTML (mammoth, MIT) ---------- */
WD.docxToHtml=async function(ab){await loadLib('mammoth');const r=await mammoth.convertToHtml({arrayBuffer:ab},{styleMap:['p[style-name=\'Title\'] => h1:fresh']});return r.value||'<p><br></p>'};

/* ---------- 3. HTML → .docx propio ---------- */
const xe=s=>String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const hex=c=>{if(!c)return null;c=String(c).trim();let m=c.match(/^#([0-9a-f]{3})$/i);if(m)return m[1].split('').map(x=>x+x).join('').toUpperCase();m=c.match(/^#([0-9a-f]{6})$/i);if(m)return m[1].toUpperCase();
 m=c.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/i);if(m){if(m[4]!==undefined&&+m[4]===0)return null;return [m[1],m[2],m[3]].map(v=>(+v).toString(16).padStart(2,'0')).join('').toUpperCase()}
 const named={black:'000000',white:'FFFFFF',red:'FF0000',blue:'0000FF',yellow:'FFFF00',green:'008000'};return named[c.toLowerCase()]||null};
const ptOfCss=v=>{if(!v)return null;let m=String(v).match(/^([\d.]+)(pt|px|em|rem)?$/);if(!m)return null;const n=+m[1];return m[2]==='px'?n*.75:m[2]==='em'||m[2]==='rem'?n*12:n};
const mmOfCss=v=>{if(!v)return 0;const m=String(v).match(/^(-?[\d.]+)(mm|cm|px|pt|em)?$/);if(!m)return 0;const n=+m[1];return m[2]==='cm'?n*10:m[2]==='px'?n*.2646:m[2]==='pt'?n*.3528:m[2]==='em'?n*4.23:n};
const TW=mm=>Math.round(mm*56.6929);
WD.toDocx=async function(root,st){await loadLib('jszip');const pg=PAGES[st.page]||PAGES.a4,mg=MARGINS[st.margin]||MARGINS.normal;const land=st.orient==='h';const pw=land?pg.h:pg.w,ph=land?pg.w:pg.h;
 const contentPx=(pw-mg.l-mg.r)*3.7795;const imgs=[];let nums=[];let docPrId=1;const baseFont=(st.font||'Arial'),baseSize=st.size||12;
 const BLOCK=/^(P|DIV|H1|H2|H3|H4|H5|H6|BLOCKQUOTE|UL|OL|LI|TABLE|HR|PRE|SECTION|ARTICLE|HEADER|FOOTER)$/;
 const runProps=(f)=>{let r='';if(f.font)r+='<w:rFonts w:ascii="'+xe(f.font)+'" w:hAnsi="'+xe(f.font)+'" w:cs="'+xe(f.font)+'"/>';if(f.b)r+='<w:b/><w:bCs/>';if(f.i)r+='<w:i/><w:iCs/>';if(f.s)r+='<w:strike/>';
  if(f.color)r+='<w:color w:val="'+f.color+'"/>';if(f.sz)r+='<w:sz w:val="'+Math.round(f.sz*2)+'"/><w:szCs w:val="'+Math.round(f.sz*2)+'"/>';if(f.u)r+='<w:u w:val="single"/>';if(f.hl)r+='<w:shd w:val="clear" w:color="auto" w:fill="'+f.hl+'"/>';return r?'<w:rPr>'+r+'</w:rPr>':''};
 const fmtOf=(el,f)=>{f={...f};const t=el.tagName,s=el.style||{};if(/^(B|STRONG)$/.test(t))f.b=true;if(/^(I|EM)$/.test(t))f.i=true;if(t==='U')f.u=true;if(/^(S|STRIKE|DEL)$/.test(t))f.s=true;
  if(t==='FONT'){if(el.getAttribute('color'))f.color=hex(el.getAttribute('color'))||f.color;if(el.getAttribute('face'))f.font=el.getAttribute('face').split(',')[0].replace(/["']/g,'').trim()}
  if(s.fontWeight&&(s.fontWeight==='bold'||+s.fontWeight>=600))f.b=true;if(s.fontWeight&&(s.fontWeight==='normal'||+s.fontWeight&&+s.fontWeight<600))f.b=false;if(s.fontStyle==='italic')f.i=true;
  const td=(s.textDecorationLine||s.textDecoration||'');if(/underline/.test(td))f.u=true;if(/line-through/.test(td))f.s=true;if(s.color)f.color=hex(s.color)||f.color;if(s.backgroundColor){const h=hex(s.backgroundColor);if(h)f.hl=h}
  if(s.fontSize){const p=ptOfCss(s.fontSize);if(p)f.sz=p}if(s.fontFamily)f.font=s.fontFamily.split(',')[0].replace(/["']/g,'').trim();return f};
 const picXml=(rid,name,cx,cy,id)=>'<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="'+id+'" name="'+name+'"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="'+rid+'"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="'+cx+'" cy="'+cy+'"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic>';
 const anchorRun=(img)=>{const src=img.getAttribute('src')||'';const m=src.match(/^data:image\/(png|jpe?g|gif);base64,(.+)$/i);if(!m)return '';const ext=m[1].toLowerCase()==='jpg'?'jpeg':m[1].toLowerCase();
  const n=imgs.length+1;imgs.push({name:'image'+n+'.'+(ext==='jpeg'?'jpg':ext),data:m[2],id:'rIdImg'+n});const nw=img.naturalWidth||300,nh=img.naturalHeight||150,wmm=+img.dataset.w||40,hmm=wmm*nh/Math.max(1,nw);
  const E=v=>Math.round(v*36000),id=docPrId++;
  return '<w:r><w:drawing><wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="'+(251658240+id)+'" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1"><wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="page"><wp:posOffset>'+E(+img.dataset.x||0)+'</wp:posOffset></wp:positionH><wp:positionV relativeFrom="page"><wp:posOffset>'+E(+img.dataset.y||0)+'</wp:posOffset></wp:positionV><wp:extent cx="'+E(wmm)+'" cy="'+E(hmm)+'"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/><wp:docPr id="'+id+'" name="Imagen '+id+'"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>'+picXml(imgs[n-1].id,imgs[n-1].name,E(wmm),E(hmm),id)+'</wp:anchor></w:drawing></w:r>'};
 /* párrafo mínimo (1 pt) que lleva las imágenes libres de una hoja; desde la segunda hoja, empieza página nueva */
 let secN=0;const floatPara=(host)=>{const first=secN++===0;let fl=[...host.querySelectorAll('img.wfl')].filter(i=>(i.closest('section.wpg')||root)===host);
  /* imágenes libres que quedaron fuera de las hojas: van con la primera */if(first&&host!==root)fl=fl.concat([...root.querySelectorAll('img.wfl')].filter(i=>!i.closest('section.wpg')));if(!fl.length&&first)return '';
  return '<w:p><w:pPr>'+(first?'':'<w:pageBreakBefore/>')+'<w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/><w:rPr><w:sz w:val="2"/></w:rPr></w:pPr>'+fl.map(anchorRun).join('')+'</w:p>'};
 const imgRun=(img)=>{if(img.classList&&img.classList.contains('wfl'))return '';const src=img.getAttribute('src')||'';const m=src.match(/^data:image\/(png|jpe?g|gif);base64,(.+)$/i);if(!m)return '';const ext=m[1].toLowerCase()==='jpg'?'jpeg':m[1].toLowerCase();
  const n=imgs.length+1;imgs.push({name:'image'+n+'.'+(ext==='jpeg'?'jpg':ext),data:m[2],id:'rIdImg'+n});const nw=img.naturalWidth||+img.getAttribute('width')||300,nh=img.naturalHeight||+img.getAttribute('height')||150;
  let w=nw;const sw=img.style.width;if(/%$/.test(sw))w=contentPx*parseFloat(sw)/100;else if(/px$/.test(sw))w=parseFloat(sw);w=Math.min(w,contentPx);const h=w*nh/Math.max(1,nw);const cx=Math.round(w*9525),cy=Math.round(h*9525),id=docPrId++;
  return '<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="'+cx+'" cy="'+cy+'"/><wp:docPr id="'+id+'" name="Imagen '+id+'"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="'+id+'" name="'+imgs[n-1].name+'"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="'+imgs[n-1].id+'"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="'+cx+'" cy="'+cy+'"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>'};
 const runs=(node,f)=>{let r='';for(const n of node.childNodes){if(n.nodeType===3){const t=n.nodeValue.replace(/[\r\n]+/g,' ');if(t)r+='<w:r>'+runProps(f)+'<w:t xml:space="preserve">'+xe(t)+'</w:t></w:r>';continue}if(n.nodeType!==1)continue;const t=n.tagName;
   if(t==='BR'){r+='<w:r><w:br/></w:r>';continue}if(t==='IMG'){r+=imgRun(n);continue}if(BLOCK.test(t))continue;r+=runs(n,fmtOf(n,f))}return r};
 const pPr=(el,{style,num,lvl,jcOver}={})=>{const s=el.style||{};let p='';if(style)p+='<w:pStyle w:val="'+style+'"/>';if(num)p+='<w:numPr><w:ilvl w:val="'+(lvl||0)+'"/><w:numId w:val="'+num+'"/></w:numPr>';
  const ta=jcOver||s.textAlign||(el.getAttribute&&el.getAttribute('align'))||'';const jc={center:'center',right:'right',justify:'both',left:'left',start:'left',end:'right'}[ta];
  const inSec=el.closest&&el.closest('section.wpg'),lhS=s.lineHeight||(inSec&&inSec.style.lineHeight)||'',lh=parseFloat(lhS),mt=mmOfCss(s.marginTop);
  const la=lh&&!/px|pt/.test(lhS)?' w:line="'+Math.round(240*lh)+'" w:lineRule="auto"':'',bf=mt>0?' w:before="'+TW(mt)+'"':'',af=inSec?' w:after="0"':'';if(la||bf||af)p+='<w:spacing'+bf+af+la+'/>';
  let ind='';const ml=mmOfCss(s.marginLeft)||mmOfCss(s.paddingLeft)+(el.tagName==='BLOCKQUOTE'?10:0);const ti=mmOfCss(s.textIndent);if(ml||ti)ind='<w:ind'+(ml?' w:left="'+TW(ml)+'"':'')+(ti>0?' w:firstLine="'+TW(ti)+'"':ti<0?' w:hanging="'+TW(-ti)+'"':'')+'/>';p+=ind;
  if(jc)p+='<w:jc w:val="'+jc+'"/>';return p?'<w:pPr>'+p+'</w:pPr>':''};
 const para=(el,f,o)=>'<w:p>'+pPr(el,o)+runs(el,f)+'</w:p>';
 const hasBlock=el=>[...el.children].some(c=>BLOCK.test(c.tagName)||(c.tagName==='IMG'&&(c.style.display==='block'||c.classList.contains('wfl'))));
 const imgBlock=img=>{const s=img.style;const jc=s.marginLeft==='auto'&&s.marginRight==='auto'?'center':s.marginLeft==='auto'?'right':'left';return '<w:p><w:pPr><w:jc w:val="'+jc+'"/></w:pPr>'+imgRun(img)+'</w:p>'};
 const blocks=(el,f,ctx={})=>{let out='';let inl=null;const flushInl=()=>{if(inl){out+='<w:p>'+pPr(el,{jcOver:el.style&&el.style.textAlign})+inl+'</w:p>';inl=null}};
  for(const n of el.childNodes){if(n.nodeType===3){if(n.nodeValue.trim()){inl=(inl||'')+runs({childNodes:[n]},f)}continue}if(n.nodeType!==1)continue;const t=n.tagName;
   if(t==='IMG'&&n.classList.contains('wfl'))continue;
   if(t==='SECTION'&&n.classList.contains('wpg')){flushInl();out+=floatPara(n)+blocks(n,fmtOf(n,f),ctx);continue}
   if(t==='IMG'&&n.style.display==='block'){flushInl();out+=imgBlock(n);continue}
   if(!BLOCK.test(t)){if(t==='BR'){inl=(inl||'')+'<w:r><w:br/></w:r>';continue}inl=(inl||'')+(t==='IMG'?imgRun(n):runs({childNodes:[n]},f));continue}
   flushInl();const nf=fmtOf(n,f);
   if(t==='HR'){out+=n.classList.contains('wpb')?'<w:p><w:r><w:br w:type="page"/></w:r></w:p>':'<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="8" w:space="1" w:color="auto"/></w:pBdr></w:pPr></w:p>';continue}
   if(t==='TABLE'){out+=table(n,nf)+'<w:p/>';continue}
   if(t==='UL'||t==='OL'){const lvl=(ctx.lvl==null?0:ctx.lvl+1);let num=1;if(t==='OL'){num=nums.length+2;nums.push(num)}
    for(const li of n.children){if(li.tagName!=='LI')continue;const lf=fmtOf(li,nf);const sub=[...li.children].filter(c=>c.tagName==='UL'||c.tagName==='OL');
     const tmp=li.cloneNode(true);[...tmp.children].forEach(c=>{if(c.tagName==='UL'||c.tagName==='OL')c.remove()});
     if(hasBlock(tmp)){const inner=blocks(tmp,lf,{lvl});out+=inner.replace('<w:p>','<w:p><w:pPr><w:numPr><w:ilvl w:val="'+lvl+'"/><w:numId w:val="'+num+'"/></w:numPr></w:pPr>').replace('</w:pPr><w:pPr>','')}
     else out+=para(tmp,lf,{num,lvl});for(const s2 of sub){const w=document.createElement('div');w.appendChild(s2.cloneNode(true));out+=blocks(w,lf,{lvl})}}continue}
   const style={H1:'Heading1',H2:'Heading2',H3:'Heading3',H4:'Heading3',H5:'Heading3',H6:'Heading3',BLOCKQUOTE:'Quote'}[t];
   if(hasBlock(n)){out+=blocks(n,nf,ctx);continue}
   out+=para(n,nf,{style})}
  flushInl();return out};
 const table=(tb,f)=>{const rows=[...tb.querySelectorAll(':scope > tbody > tr, :scope > thead > tr, :scope > tr')];const grid=[];let ncol=0;
  rows.forEach((tr,r)=>{grid[r]=grid[r]||[];let c=0;for(const td of tr.children){while(grid[r][c])c++;const cs=+td.getAttribute('colspan')||1,rs=+td.getAttribute('rowspan')||1;
   for(let i=0;i<rs;i++){grid[r+i]=grid[r+i]||[];for(let j=0;j<cs;j++)grid[r+i][c+j]=i===0&&j===0?{td,cs,rs}:{cov:true,start:i>0&&j===0,cs,first:grid[r][c]}}c+=cs}ncol=Math.max(ncol,grid[r].length)});
  const bd=!tb.classList.contains('wtb-nb');const B='<w:top w:val="single" w:sz="4" w:color="000000"/><w:left w:val="single" w:sz="4" w:color="000000"/><w:bottom w:val="single" w:sz="4" w:color="000000"/><w:right w:val="single" w:sz="4" w:color="000000"/><w:insideH w:val="single" w:sz="4" w:color="000000"/><w:insideV w:val="single" w:sz="4" w:color="000000"/>';
  const colW=Math.floor(TW(pw-mg.l-mg.r)/Math.max(1,ncol));
  let x='<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/>'+(bd?'<w:tblBorders>'+B+'</w:tblBorders>':'')+'<w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>'+Array.from({length:ncol},()=>'<w:gridCol w:w="'+colW+'"/>').join('')+'</w:tblGrid>';
  grid.forEach(row=>{x+='<w:tr>';for(let c=0;c<ncol;){const g=row[c];if(!g){x+='<w:tc><w:tcPr><w:tcW w:w="'+colW+'" w:type="dxa"/></w:tcPr><w:p/></w:tc>';c++;continue}
    if(g.cov&&!g.start){c++;continue}
    if(g.cov&&g.start){const cs=g.cs;x+='<w:tc><w:tcPr><w:tcW w:w="'+colW*cs+'" w:type="dxa"/>'+(cs>1?'<w:gridSpan w:val="'+cs+'"/>':'')+'<w:vMerge/></w:tcPr><w:p/></w:tc>';c+=cs;continue}
    const td=g.td,cf=fmtOf(td,f);if(td.tagName==='TH')cf.b=true;const sh=hex(td.style.backgroundColor);let inner=hasBlock(td)?blocks(td,cf):para(td,cf);if(!/<w:p[ >]/.test(inner))inner='<w:p/>';
    x+='<w:tc><w:tcPr><w:tcW w:w="'+colW*g.cs+'" w:type="dxa"/>'+(g.cs>1?'<w:gridSpan w:val="'+g.cs+'"/>':'')+(g.rs>1?'<w:vMerge w:val="restart"/>':'')+(sh?'<w:shd w:val="clear" w:color="auto" w:fill="'+sh+'"/>':'')+'</w:tcPr>'+inner+'</w:tc>';c+=g.cs}x+='</w:tr>'});
  return x+'</w:tbl>'};
 const rootFl=root.querySelector('section.wpg')?'':floatPara(root);const body=(rootFl+blocks(root,{}))||'<w:p/>';
 const NS='xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
 const sect='<w:sectPr>'+(st.pnum?'<w:footerReference w:type="default" r:id="rIdFtr"/>':'')+'<w:pgSz w:w="'+TW(pw)+'" w:h="'+TW(ph)+'"'+(land?' w:orient="landscape"':'')+'/><w:pgMar w:top="'+TW(mg.t)+'" w:right="'+TW(mg.r)+'" w:bottom="'+TW(mg.b)+'" w:left="'+TW(mg.l)+'" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr>';
 const doc='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document '+NS+'><w:body>'+body+sect+'</w:body></w:document>';
 const rpr='<w:rFonts w:ascii="'+xe(baseFont)+'" w:hAnsi="'+xe(baseFont)+'" w:cs="'+xe(baseFont)+'"/><w:sz w:val="'+baseSize*2+'"/><w:szCs w:val="'+baseSize*2+'"/><w:lang w:val="es-AR"/>';
 const hs=(id,n,sz)=>'<w:style w:type="paragraph" w:styleId="'+id+'"><w:name w:val="'+n+'"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="'+(+id.slice(-1)-1)+'"/></w:pPr><w:rPr><w:b/><w:bCs/><w:sz w:val="'+sz*2+'"/><w:szCs w:val="'+sz*2+'"/></w:rPr></w:style>';
 const styles='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr>'+rpr+'</w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>'
  +'<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>'+hs('Heading1','heading 1',16)+hs('Heading2','heading 2',14)+hs('Heading3','heading 3',12)
  +'<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="567" w:right="567"/></w:pPr><w:rPr><w:i/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Footer"><w:name w:val="footer"/><w:basedOn w:val="Normal"/></w:style></w:styles>';
 const lvls=(fmt)=>Array.from({length:9},(_,i)=>'<w:lvl w:ilvl="'+i+'"><w:start w:val="1"/><w:numFmt w:val="'+(fmt==='bullet'?'bullet':['decimal','lowerLetter','lowerRoman'][i%3])+'"/><w:lvlText w:val="'+(fmt==='bullet'?['•','◦','▪'][i%3]:'%'+(i+1)+'.')+'"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="'+(720+i*360)+'" w:hanging="360"/></w:pPr></w:lvl>').join('');
 const numbering='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/>'+lvls('bullet')+'</w:abstractNum><w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="hybridMultilevel"/>'+lvls('decimal')+'</w:abstractNum>'
  +'<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>'+nums.map(n=>'<w:num w:numId="'+n+'"><w:abstractNumId w:val="1"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride></w:num>').join('')+'</w:numbering>';
 const footer='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:pStyle w:val="Footer"/><w:jc w:val="center"/></w:pPr><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>';
 const zip=new JSZip();
 zip.file('[Content_Types].xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpg" ContentType="image/jpeg"/><Default Extension="gif" ContentType="image/gif"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>'+(st.pnum?'<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>':'')+'<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>');
 zip.file('_rels/.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>');
 zip.file('docProps/core.xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>'+xe(st.name||'Documento')+'</dc:title><dc:creator>Danscanner Pro</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">'+new Date().toISOString().replace(/\.\d+Z$/,'Z')+'</dcterms:created></cp:coreProperties>');
 zip.file('word/_rels/document.xml.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdSt" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdNum" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>'+(st.pnum?'<Relationship Id="rIdFtr" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>':'')+imgs.map(i=>'<Relationship Id="'+i.id+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/'+i.name+'"/>').join('')+'</Relationships>');
 zip.file('word/document.xml',doc);zip.file('word/styles.xml',styles);zip.file('word/numbering.xml',numbering);if(st.pnum)zip.file('word/footer1.xml',footer);
 for(const i of imgs)zip.file('word/media/'+i.name,i.data,{base64:true});
 return zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'})};

/* ---------- 4. HTML → PDF (con la hoja, márgenes y números de página elegidos) ---------- */
WD.toPdf=async function(root,st){await loadLib('html2pdf');const pg=PAGES[st.page]||PAGES.a4,mg=MARGINS[st.margin]||MARGINS.normal,land=st.orient==='h';const pw=land?pg.h:pg.w,ph=land?pg.w:pg.h;
 const wrap=document.createElement('div');wrap.className='wd-print';const c=root.cloneNode(true);c.removeAttribute('contenteditable');c.querySelectorAll('.wsel').forEach(n=>n.classList.remove('wsel'));
 c.querySelectorAll('hr.wpb').forEach(h=>{const d=document.createElement('div');d.className='html2pdf__page-break';h.replaceWith(d)});
 wrap.innerHTML='<style>.wd-print{color:#000;background:#fff}.wd-print p,.wd-print h1,.wd-print h2,.wd-print h3,.wd-print blockquote{margin:0 0 6pt}.wd-print h1{font-size:16pt}.wd-print h2{font-size:14pt}.wd-print h3{font-size:12pt}.wd-print table{border-collapse:collapse;width:100%}.wd-print td,.wd-print th{border:1px solid #000;padding:2pt 4pt;vertical-align:top}.wd-print table.wtb-nb td{border:0}.wd-print section.wpg p,.wd-print section.wpg h1,.wd-print section.wpg h2,.wd-print section.wpg h3{margin-bottom:0}.wd-print img{max-width:100%}.wd-print blockquote{margin-left:10mm;font-style:italic}tr,img{page-break-inside:avoid}</style>';
 wrap.appendChild(c);c.style.cssText=(root.getAttribute('style')||'')+';width:'+(pw-mg.l-mg.r)+'mm;padding:0;margin:0;min-height:0;box-shadow:none;zoom:1;position:relative;background-image:none';
 /* v85: un PDF convertido trae una sección por hoja: cada una se arma como la hoja entera (con sus márgenes) para que logos, sellos y firmas
  * queden en su lugar exacto, aunque estén en el margen */
 const secs=[...c.querySelectorAll('section.wpg')];let margin=[mg.t,mg.l,mg.b,mg.r];
 c.querySelectorAll('img.wfl').forEach(im=>{im.style.cssText='position:absolute;max-width:none;width:'+(+im.dataset.w||40)+'mm;left:'+(+im.dataset.x||0)+'mm;top:'+(+im.dataset.y||0)+'mm'});
 if(secs.length){margin=[0,0,0,0];c.style.width=pw+'mm';secs.forEach((sc,i)=>{sc.style.cssText='position:relative;box-sizing:border-box;width:'+pw+'mm;min-height:'+(ph-.6)+'mm;padding:'+mg.t+'mm '+mg.r+'mm '+mg.b+'mm '+mg.l+'mm;margin:0';
   if(i<secs.length-1){const d=document.createElement('div');d.className='html2pdf__page-break';sc.after(d)}})}
 else c.querySelectorAll('img.wfl').forEach(im=>{im.style.left=((+im.dataset.x||0)-mg.l)+'mm';im.style.top=((+im.dataset.y||0)-mg.t)+'mm'});
 let w=html2pdf().set({margin,image:{type:'jpeg',quality:.96},html2canvas:{scale:2,useCORS:true,backgroundColor:'#ffffff'},jsPDF:{unit:'mm',format:[pg.w,pg.h],orientation:land?'landscape':'portrait'},pagebreak:{mode:['css','legacy'],avoid:['tr','img']}}).from(wrap).toPdf();
 if(st.pnum)w=w.get('pdf').then(pdf=>{const n=pdf.internal.getNumberOfPages();for(let i=1;i<=n;i++){pdf.setPage(i);pdf.setFontSize(10);pdf.setTextColor(60);pdf.text(String(i),pw/2,ph-Math.max(6,mg.b/2),{align:'center'})}});
 return w.outputPdf('blob')};

/* ---------- 5. Pantalla del editor ---------- */
const I=(d)=>'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+d+'</svg>';
const ICO={undo:I('<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>'),redo:I('<path d="m15 14 5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>'),
 al:I('<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>'),ac:I('<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>'),ar:I('<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>'),aj:I('<path d="M4 6h16M4 10h16M4 14h16M4 18h16"/>'),
 ul:I('<circle cx="5" cy="7" r="1"/><circle cx="5" cy="12" r="1"/><circle cx="5" cy="17" r="1"/><path d="M9 7h11M9 12h11M9 17h11"/>'),ol:I('<path d="M4 6h1v4M4 10h2M4 14h2l-2 3h2M10 7h10M10 12h10M10 17h10"/>'),
 out:I('<path d="M21 6H11M21 12H11M21 18H11M7 9l-3 3 3 3"/>'),ind:I('<path d="M21 6H11M21 12H11M21 18H11M4 9l3 3-3 3"/>'),clr:I('<path d="M4 7V5h12v2M10 5l-3 14M14 14l6 6M20 14l-6 6"/>'),
 img:I('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 17-5-5-8 8"/>'),sign:I('<path d="M3 17c3 0 4-7 7-7s1 7 4 7 3-3 7-3"/><path d="M3 21h18"/>'),date:I('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
 tbl:I('<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 10h18M3 15h18M9 4v16M15 4v16"/>'),pb:I('<path d="M6 3v6h12V3M6 21v-6h12v6"/><path d="M3 12h3M9 12h2M13 12h2M18 12h3"/>'),hr:I('<path d="M3 12h18"/>'),
 find:I('<circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/>'),count:I('<path d="M4 6h16M4 12h10M4 18h7"/><path d="M17 15v6M14 18h6"/>'),abc:I('<path d="M3 16l3-9 3 9M4 13h4M12 7h3a2 2 0 0 1 0 4h-3zm0 4h3.5a2.5 2.5 0 0 1 0 5H12zM22 9a3 3 0 1 0 0 6"/>'),
 view:I('<rect x="6" y="3" width="12" height="18" rx="1"/><path d="M9 7h6M9 11h6M9 15h4"/>'),num:I('<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M11 17h2"/>')};
function btn(k,label,ico,title){return '<button type="button" class="wd-b" data-k="'+k+'" title="'+escH(title||label)+'" aria-label="'+escH(title||label)+'">'+(ico||'')+(label?'<span>'+label+'</span>':'')+'</button>'}
function selc(k,opts,title,cur){return '<label class="wd-s" title="'+escH(title)+'"><select data-k="'+k+'" aria-label="'+escH(title)+'">'+opts.map(([v,n])=>'<option value="'+escH(v)+'"'+(String(v)===String(cur)?' selected':'')+'>'+escH(n)+'</option>').join('')+'</select></label>'}
function colorBtn(k,label,title,val){return '<label class="wd-b wd-col" title="'+escH(title)+'"><span class="wd-cl" style="--c:'+val+'">'+label+'</span><input type="color" data-k="'+k+'" value="'+val+'" aria-label="'+escH(title)+'"></label>'}
const SEP='<span class="wd-sep" aria-hidden="true"></span>';
function ribbons(st){return {
 inicio:btn('undo','',ICO.undo,'Deshacer')+btn('redo','',ICO.redo,'Rehacer')+SEP
  +selc('block',[['p','Normal'],['h1','Título 1'],['h2','Título 2'],['h3','Título 3'],['blockquote','Cita']],'Estilo','p')
  +selc('font',FONTS.map(([n])=>[n,n]),'Tipo de letra',st.font)+selc('size',SIZES.map(s=>[s,s]),'Tamaño',st.size)+SEP
  +btn('bold','<b>N</b>','','Negrita')+btn('italic','<i>K</i>','','Cursiva')+btn('underline','<u>S</u>','','Subrayado')+btn('strikeThrough','<s>abc</s>','','Tachado')
  +colorBtn('color','A','Color de letra','#C00000')+colorBtn('hilite','ab','Resaltar','#FFF176')+SEP
  +btn('justifyLeft','',ICO.al,'Alinear a la izquierda')+btn('justifyCenter','',ICO.ac,'Centrar')+btn('justifyRight','',ICO.ar,'Alinear a la derecha')+btn('justifyFull','',ICO.aj,'Justificar')+SEP
  +btn('insertUnorderedList','',ICO.ul,'Viñetas')+btn('insertOrderedList','',ICO.ol,'Numeración')+btn('outdent','',ICO.out,'Disminuir sangría')+btn('indent','',ICO.ind,'Aumentar sangría')
  +selc('lh',[['1','Interlineado 1,0'],['1.15','1,15'],['1.5','1,5'],['2','2,0']],'Interlineado','1.15')+btn('removeFormat','',ICO.clr,'Borrar formato'),
 insertar:'<label class="wd-b" title="Imagen o logo">'+ICO.img+'<span>Imagen o logo</span><input type="file" accept="image/*" data-k="img" hidden></label>'
  +btn('sign','Firma',ICO.sign)+btn('date','Fecha',ICO.date)+btn('table','Tabla',ICO.tbl)+btn('pb','Salto de página',ICO.pb)+btn('hr','Línea',ICO.hr)
  +selc('sym',[['','Símbolo'],['N° ','N°'],['°','°'],['§','§'],['«»','« »'],['—','—'],['✓','✓'],['$','$'],['€','€']],'Insertar símbolo',''),
 diseno:selc('page',Object.entries(PAGES).map(([k,v])=>[k,'Hoja '+v.n]),'Tamaño de hoja',st.page)+selc('orient',[['v','Vertical'],['h','Horizontal']],'Orientación',st.orient)
  +selc('margin',Object.entries(MARGINS).map(([k,v])=>[k,'Márgenes: '+v.n]),'Márgenes',st.margin)+btn('pnum','Números de página',ICO.num)+btn('view',st.view==='sheet'?'Vista: hoja':'Vista: edición',ICO.view,'Cambiar la vista'),
 revisar:btn('find','Buscar y reemplazar',ICO.find)+btn('count','Contar palabras',ICO.count)+btn('spell','Ortografía',ICO.abc)+btn('newdoc','Documento nuevo','')}}

__mods.uiWord=function(el){
 const st={name:'Documento',page:'a4',orient:'v',margin:'normal',pnum:false,font:'Arial',size:12,view:matchMedia('(min-width:1024px)').matches?'sheet':'edit'};
 let draft=null;try{draft=JSON.parse(localStorage.getItem(KEY)||'null')}catch(e){}
 el.innerHTML='<div class="wd-start"><p class="wd-lead">Abrí un PDF o un Word y editalo como en Word: letra, alineación, tablas, logos y tu firma. Después lo guardás en Word o en PDF.</p>'
  +'<div class="fp"></div><button class="btn block" id="wdBlank">Empezar un documento en blanco</button>'
  +(draft&&draft.html?'<button class="btn pri block" id="wdDraft">Seguir con «'+escH(draft.name||'Documento')+'»</button>':'')
  +'<p class="muted wd-note">Si el PDF es una foto o un escaneo, se lee con OCR en el teléfono. El borrador queda guardado solo en este dispositivo.</p></div>'
  +'<div class="wd-app" hidden>'
   +'<div class="wd-top"><input class="wd-name" aria-label="Nombre del documento" value="Documento"><button class="btn sm" data-k="docx">Word</button><button class="btn sm pri" data-k="pdf">PDF</button></div>'
   +'<div class="wd-tabs" role="tablist">'+[['inicio','Inicio'],['insertar','Insertar'],['diseno','Diseño'],['revisar','Revisar']].map(([k,n],i)=>'<button role="tab" data-tab="'+k+'" aria-selected="'+(i?'false':'true')+'">'+n+'</button>').join('')+'<span class="wd-saved" aria-live="polite"></span></div>'
   +'<div class="wd-bar" role="toolbar" aria-label="Herramientas"></div><div class="wd-ctx" hidden></div>'
   +'<div class="wd-desk"><div class="wd-page"><i class="wd-mk tl"></i><i class="wd-mk tr"></i><i class="wd-mk bl"></i><i class="wd-mk br"></i><div class="wd-doc" contenteditable="true" spellcheck="true" lang="es"></div></div></div>'
  +'</div>';
 try{iconize(el)}catch(e){}
 const app=$('.wd-app',el),doc=$('.wd-doc',el),page=$('.wd-page',el),desk=$('.wd-desk',el),bar=$('.wd-bar',el),ctx=$('.wd-ctx',el);let tab='inicio';
 el._wd={doc,st,toDocx:()=>WD.toDocx(doc,st),toPdf:()=>WD.toPdf(doc,st)};
 /* hoja: tamaño real en vista «hoja»; en el celular, vista «edición» con la letra a tamaño legible */
 const layout=()=>{const pg=PAGES[st.page],mg=MARGINS[st.margin],land=st.orient==='h',pw=land?pg.h:pg.w,ph=land?pg.w:pg.h;
  doc.style.fontFamily=(FONTS.find(f=>f[0]===st.font)||FONTS[0])[1];doc.style.fontSize=st.size+'pt';
  app.classList.toggle('wd-sheet',st.view==='sheet');
  if(st.view==='sheet'){page.style.width=pw+'mm';page.style.minHeight=ph+'mm';doc.style.padding=mg.t+'mm '+mg.r+'mm '+mg.b+'mm '+mg.l+'mm';const avail=desk.clientWidth-24,px=pw*3.7795;page.style.zoom=avail>0&&px>avail?String(avail/px):'1';
   doc.style.backgroundImage='repeating-linear-gradient(to bottom,transparent 0,transparent calc('+(ph)+'mm - 1px),#9aa3b5 calc('+(ph)+'mm - 1px),#9aa3b5 '+ph+'mm)'}
  else{page.style.width='';page.style.minHeight='';page.style.zoom='1';doc.style.padding='';doc.style.backgroundImage=''}
  posFloats()};
 /* v85: imágenes libres (logos, sellos, firmas): se guardan en mm desde el borde de la hoja (data-x/y/w) y se dibujan en su lugar */
 const geom=()=>{const pg=PAGES[st.page],mg=MARGINS[st.margin],land=st.orient==='h';return {mg,pw:land?pg.h:pg.w,ph:land?pg.w:pg.h}};
 const hostOf=im=>im.closest('section.wpg')||doc;
 const pxPerMm=host=>{const {mg,pw}=geom();if(st.view==='sheet')return 3.7795;const cs=getComputedStyle(doc);const w=host===doc?doc.clientWidth-(parseFloat(cs.paddingLeft)||0)-(parseFloat(cs.paddingRight)||0):host.clientWidth;return w/(pw-mg.l-mg.r)};
 function posFloats(){const {mg,ph}=geom(),sheet=st.view==='sheet';
  doc.querySelectorAll('section.wpg').forEach(sc=>{sc.style.minHeight=sheet?(ph-mg.t-mg.b)+'mm':'';sc.style.marginBottom=sheet?(mg.b+mg.t)+'mm':''});
  const cs=getComputedStyle(doc),padL=parseFloat(cs.paddingLeft)||0,padT=parseFloat(cs.paddingTop)||0;
  doc.querySelectorAll('img.wfl').forEach(im=>{const host=hostOf(im),x=+im.dataset.x||0,y=+im.dataset.y||0,w=+im.dataset.w||40;im.setAttribute('contenteditable','false');im.draggable=false;
   if(sheet){const inSec=host!==doc;im.style.left=(inSec?x-mg.l:x)+'mm';im.style.top=(inSec?y-mg.t:y)+'mm';im.style.width=w+'mm'}
   else{const k=pxPerMm(host),ox=host===doc?padL:0,oy=host===doc?padT:0;im.style.left=(ox+(x-mg.l)*k)+'px';im.style.top=(oy+(y-mg.t)*k)+'px';im.style.width=(w*k)+'px'}})}
 /* arrastrar con el dedo */
 let drag=null;
 doc.addEventListener('pointerdown',e=>{const im=e.target.closest('img.wfl');if(!im)return;e.preventDefault();const z=parseFloat(page.style.zoom)||1;
  drag={im,x0:e.clientX,y0:e.clientY,dx:+im.dataset.x||0,dy:+im.dataset.y||0,k:pxPerMm(hostOf(im))*(st.view==='sheet'?z:1),moved:false};try{im.setPointerCapture(e.pointerId)}catch(er){}});
 doc.addEventListener('pointermove',e=>{if(!drag)return;const dx=(e.clientX-drag.x0)/drag.k,dy=(e.clientY-drag.y0)/drag.k;if(Math.abs(dx)+Math.abs(dy)>.8)drag.moved=true;
  drag.im.dataset.x=Math.round((drag.dx+dx)*10)/10;drag.im.dataset.y=Math.round((drag.dy+dy)*10)/10;posFloats()});
 const endDrag=()=>{if(!drag)return;const d=drag;drag=null;if(d.moved){changed();d.im._moved=Date.now()}};doc.addEventListener('pointerup',endDrag);doc.addEventListener('pointercancel',endDrag);
 /* imagen nueva (firma, logo): libre, a la altura del cursor y centrada; después se arrastra */
 const insertFloat=(src,wmm,alt)=>{const {mg,pw}=geom();let host=doc,ref=null;if(saved){const n=saved.startContainer;const e2=n.nodeType===1?n:n.parentElement;if(e2&&doc.contains(e2)){host=e2.closest('section.wpg')||doc;ref=e2.closest('p,h1,h2,h3,li,td,div,blockquote')}}
  const z=st.view==='sheet'?(parseFloat(page.style.zoom)||1):1,k=pxPerMm(host)*z;const hr=host.getBoundingClientRect(),cs=getComputedStyle(doc);
  const oy=host===doc?(parseFloat(cs.paddingTop)||0)*z:0;let y=mg.t+10;if(ref&&ref!==host){y=mg.t+(ref.getBoundingClientRect().top-hr.top-oy)/k}
  const {ph}=geom();y=Math.min(Math.max(mg.t,y),ph-mg.b-wmm*.5);/* siempre adentro de la hoja */
  /* que no caiga encima de otra imagen libre de la misma hoja */const xN=(pw-wmm)/2,hN=wmm*.5;for(let t=0;t<6;t++){const hit=[...host.querySelectorAll('img.wfl')].filter(o=>hostOf(o)===host).find(o=>{const ox=+o.dataset.x||0,oy=+o.dataset.y||0,ow=+o.dataset.w||40,oh=ow*((o.naturalHeight||1)/(o.naturalWidth||2));return xN<ox+ow&&xN+wmm>ox&&y<oy+oh&&y+hN>oy});if(!hit)break;const oh=(+hit.dataset.w||40)*((hit.naturalHeight||1)/(hit.naturalWidth||2));y=(+hit.dataset.y)-hN-4;if(y<mg.t){y=(+hit.dataset.y)+oh+4}}
  const im=document.createElement('img');im.className='wfl';im.alt=alt||'';im.src=src;im.dataset.w=wmm;im.dataset.x=Math.round((pw-wmm)/2*10)/10;im.dataset.y=Math.round(y*10)/10;host.appendChild(im);posFloats();changed();try{im.scrollIntoView({block:'center',behavior:'smooth'})}catch(e){}
  setTimeout(()=>{im.click();toast('Arrastrala con el dedo hasta donde va',3500)},60)};
 const drawBar=()=>{bar.innerHTML=ribbons(st)[tab];$$('.wd-tabs [data-tab]',el).forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tab===tab)));const pn=bar.querySelector('[data-k="pnum"]');if(pn)pn.classList.toggle('on',st.pnum);const sp=bar.querySelector('[data-k="spell"]');if(sp)sp.classList.toggle('on',doc.spellcheck)};
 /* selección: se guarda para no perderla al tocar los botones o las listas */
 let saved=null;const onSel=()=>{if(!doc.isConnected){document.removeEventListener('selectionchange',onSel);return}const s=getSelection();if(s.rangeCount&&doc.contains(s.anchorNode))saved=s.getRangeAt(0).cloneRange()};document.addEventListener('selectionchange',onSel);
 const restore=()=>{doc.focus({preventScroll:true});if(saved){const s=getSelection();s.removeAllRanges();s.addRange(saved)}};
 const exec=(c,v)=>{restore();try{document.execCommand('styleWithCSS',false,true);document.execCommand(c,false,v)}catch(e){}changed()};
 const insertHTML=h=>{restore();if(!saved){doc.insertAdjacentHTML('beforeend',h)}else document.execCommand('insertHTML',false,h);changed()};
 /* borrador automático */
 let tSave=0;const status=t=>{const s=$('.wd-saved',el);if(s)s.textContent=t};
 const save=()=>{try{localStorage.setItem(KEY,JSON.stringify({name:st.name,html:doc.innerHTML,st,at:Date.now()}));status('Borrador guardado')}catch(e){status('Borrador muy grande: guardalo en Word o PDF')}};
 const changed=()=>{clearTimeout(tSave);tSave=setTimeout(save,1200);status('')};doc.addEventListener('input',changed);
 const open=(html,name)=>{doc.innerHTML=sanitizeHtml(html)||'<p><br></p>';if(doc.querySelector('img.wfl')&&st.view!=='sheet'){st.view='sheet';setTimeout(()=>toast('Vista de hoja: los logos, el sello y la firma quedan en su lugar. Tocalos para moverlos.',4500),400)}doc.querySelectorAll('hr.wpb').forEach(h=>h.setAttribute('contenteditable','false'));st.name=name||st.name;$('.wd-name',el).value=st.name;$('.wd-start',el).hidden=true;app.hidden=false;drawBar();layout();changed();setTimeout(layout,60)};
 el._wd.open=open;
 filePicker($('.fp',el),{accept:'.pdf,application/pdf,.docx',multi:false,label:'Abrir PDF o Word',onChange:files=>{const f=files[0];if(!f)return;withBusy(async()=>{const nm=f.name.replace(/\.[^.]+$/,''),ab=await f.arrayBuffer();
   if(/\.docx$/i.test(f.name)){busy('Abriendo el Word…');open(await WD.docxToHtml(ab),nm)}
   else{busy('Convirtiendo el PDF…');const r=await WD.pdfToHtml(ab,m=>busy(m));open(r.html,nm);if(r.ocr)toast('Algunas páginas eran escaneadas: se leyeron con OCR. Revisá el texto.',4500)}})}});
 $('#wdBlank',el).onclick=()=>open('<p><br></p>','Documento');
 const dr=$('#wdDraft',el);if(dr)dr.onclick=()=>{Object.assign(st,draft.st||{});open(draft.html,draft.name)};
 $('.wd-name',el).oninput=e=>{st.name=e.target.value.trim()||'Documento';changed()};
 $('.wd-tabs',el).onclick=e=>{const b=e.target.closest('[data-tab]');if(!b)return;tab=b.dataset.tab;drawBar();bar.scrollLeft=0};
 addEventListener('resize',()=>{if(doc.isConnected)layout()});
 /* que los botones no le saquen el foco al texto */
 bar.addEventListener('pointerdown',e=>{if(e.target.closest('button.wd-b'))e.preventDefault()});ctx.addEventListener('pointerdown',e=>{if(e.target.closest('button'))e.preventDefault()});
 const blocksInSel=()=>{const r=saved;const all=[...doc.querySelectorAll('p,h1,h2,h3,h4,li,blockquote,div,td')].filter(n=>!n.querySelector('p,h1,h2,h3,li,div'));if(!r)return [];return all.filter(n=>r.intersectsNode(n))};
 const fixSizes=v=>{doc.querySelectorAll('font[size="7"]').forEach(n=>{const s=document.createElement('span');s.style.fontSize=v+'pt';while(n.firstChild)s.appendChild(n.firstChild);n.replaceWith(s)});doc.querySelectorAll('span[style*="xxx-large"]').forEach(n=>{n.style.fontSize=v+'pt'})};
 const closeCtx=()=>{ctx.hidden=true;ctx.innerHTML='';doc.querySelectorAll('.wsel').forEach(n=>n.classList.remove('wsel'))};
 bar.addEventListener('change',async e=>{const k=e.target.dataset.k,v=e.target.value;if(!k)return;
  if(k==='block'){exec('formatBlock','<'+v+'>');e.target.value='p'}
  if(k==='font'){exec('fontName',(FONTS.find(f=>f[0]===v)||FONTS[0])[1])}
  if(k==='size'){exec('fontSize','7');fixSizes(v);changed()}
  if(k==='color')exec('foreColor',v);if(k==='hilite')exec('hiliteColor',v);
  if(k==='lh'){restore();const bs=blocksInSel();(bs.length?bs:[doc]).forEach(n=>n.style.lineHeight=v);changed()}
  if(k==='sym'&&v){exec('insertText',v);e.target.value=''}
  if(k==='img'){const f=e.target.files[0];e.target.value='';if(!f)return;const src=await imgToData(f);insertFloat(src,40,'Imagen')}
  if(k==='page'||k==='orient'||k==='margin'){st[k]=v;layout();changed()}});
 bar.addEventListener('click',async e=>{const b=e.target.closest('button[data-k]');if(!b)return;const k=b.dataset.k;
  const CMD=['undo','redo','bold','italic','underline','strikeThrough','justifyLeft','justifyCenter','justifyRight','justifyFull','insertUnorderedList','insertOrderedList','outdent','indent','removeFormat'];
  if(CMD.includes(k)){exec(k);return}
  if(k==='sign'){const png=await signatureSheet();if(png)insertFloat(png,55,'Firma');return}
  if(k==='date'){exec('insertText',new Date().toLocaleDateString('es-AR',{day:'numeric',month:'long',year:'numeric'}));return}
  if(k==='pb'){insertHTML('<hr class="wpb" contenteditable="false"><p><br></p>');return}
  if(k==='hr'){exec('insertHorizontalRule');return}
  if(k==='table'){const sb=openSheet('Insertar tabla','<div class="row">'+opt('Filas','<input type="number" id="wdR" min="1" max="40" value="3">')+opt('Columnas','<input type="number" id="wdC" min="1" max="12" value="3">')+'</div><label class="chk"><input type="checkbox" id="wdBd" checked> Con bordes</label><button class="btn pri block" id="wdTOk">Insertar tabla</button>');
   $('#wdTOk',sb).onclick=async()=>{const r=Math.max(1,Math.min(40,+$('#wdR',sb).value||3)),c=Math.max(1,Math.min(12,+$('#wdC',sb).value||3)),bd=$('#wdBd',sb).checked;await Nav.back();
    insertHTML('<table class="wtb'+(bd?'':' wtb-nb')+'"><tbody>'+Array.from({length:r},()=>'<tr>'+Array.from({length:c},()=>'<td><br></td>').join('')+'</tr>').join('')+'</tbody></table><p><br></p>')};return}
  if(k==='pnum'){st.pnum=!st.pnum;b.classList.toggle('on',st.pnum);toast(st.pnum?'Las páginas van numeradas al pie':'Sin números de página');changed();return}
  if(k==='view'){st.view=st.view==='sheet'?'edit':'sheet';const sl=bar.scrollLeft;drawBar();bar.scrollLeft=sl;layout();return}
  if(k==='spell'){doc.spellcheck=!doc.spellcheck;b.classList.toggle('on',doc.spellcheck);toast(doc.spellcheck?'Se marcan las palabras mal escritas':'Sin revisión ortográfica');return}
  if(k==='count'){const t=doc.innerText||'',w=(t.match(/\S+/g)||[]).length,pa=[...doc.querySelectorAll('p,h1,h2,h3,li')].filter(p=>p.innerText.trim()).length;
   openSheet('Contar palabras','<div class="wd-stats"><div><b>'+w.toLocaleString('es-AR')+'</b><span>palabras</span></div><div><b>'+t.replace(/\s/g,'').length.toLocaleString('es-AR')+'</b><span>caracteres sin espacios</span></div><div><b>'+t.length.toLocaleString('es-AR')+'</b><span>caracteres con espacios</span></div><div><b>'+pa+'</b><span>párrafos</span></div></div>');return}
  if(k==='find'){findSheet(doc,changed);return}
  if(k==='newdoc'){if(!confirm('¿Empezar un documento nuevo? El actual se pierde si no lo guardaste en Word o PDF.'))return;try{localStorage.removeItem(KEY)}catch(er){}open('<p><br></p>','Documento');return}});
 /* imagen o tabla tocada: panel con sus opciones */
 doc.addEventListener('click',e=>{const img=e.target.closest('img'),td=e.target.closest('td,th');
  if(img&&img.classList.contains('wfl')){closeCtx();img.classList.add('wsel');const {pw}=geom();
   ctx.innerHTML='<b>Imagen libre</b><label class="wd-rng">Tamaño <input type="range" min="8" max="'+Math.round(pw)+'" value="'+Math.round(+img.dataset.w||40)+'" data-c="fw"></label><button type="button" class="btn sm" data-c="fc">Centrar</button><button type="button" class="btn sm" data-c="fi">Poner en el texto</button><button type="button" class="btn sm" data-c="del">Quitar</button><button type="button" class="btn sm" data-c="ok">Listo</button><span class="muted wd-tip">Arrastrala con el dedo</span>';ctx.hidden=false;
   ctx.oninput=ev=>{if(ev.target.dataset.c==='fw'){const ow=+img.dataset.w||40,nw=+ev.target.value;img.dataset.x=Math.round(((+img.dataset.x||0)+(ow-nw)/2)*10)/10;img.dataset.w=nw;posFloats();changed()}};
   ctx.onclick=ev=>{const q=ev.target.closest('[data-c]');if(!q)return;const a=q.dataset.c;
    if(a==='fc'){img.dataset.x=Math.round((pw-(+img.dataset.w||40))/2*10)/10;posFloats();changed()}
    if(a==='fi'){const {mg}=geom();const pct=Math.min(100,Math.round((+img.dataset.w||40)/(pw-mg.l-mg.r)*100));img.classList.remove('wfl','wsel');['x','y','w'].forEach(k=>delete img.dataset[k]);img.removeAttribute('contenteditable');img.style.cssText='width:'+pct+'%';closeCtx();changed()}
    if(a==='del'){img.remove();closeCtx();changed()}if(a==='ok')closeCtx()};return}
  if(img){closeCtx();img.classList.add('wsel');const w=parseFloat(img.style.width)||Math.round(img.getBoundingClientRect().width/doc.clientWidth*100);
   ctx.innerHTML='<b>Imagen</b><label class="wd-rng">Tamaño <input type="range" min="8" max="100" value="'+Math.round(w)+'" data-c="w"></label>'+btn('il','',ICO.al,'A la izquierda')+btn('ic','',ICO.ac,'Al centro')+btn('ir','',ICO.ar,'A la derecha')+'<button type="button" class="btn sm" data-c="free">Mover libre</button><button type="button" class="btn sm" data-c="del">Quitar</button><button type="button" class="btn sm" data-c="ok">Listo</button>';ctx.hidden=false;
   ctx.oninput=ev=>{if(ev.target.dataset.c==='w'){img.style.width=ev.target.value+'%';changed()}};
   ctx.onclick=ev=>{const q=ev.target.closest('[data-k],[data-c]');if(!q)return;const a=q.dataset.k||q.dataset.c;
    if(a==='il'||a==='ic'||a==='ir'){img.style.display='block';img.style.marginLeft=a==='il'?'0':'auto';img.style.marginRight=a==='ir'?'0':'auto';changed()}
    if(a==='free'){const {mg,pw}=geom();const host=img.closest('section.wpg')||doc,z=st.view==='sheet'?(parseFloat(page.style.zoom)||1):1,k=pxPerMm(host)*z,hr=host.getBoundingClientRect(),ir=img.getBoundingClientRect(),cs=getComputedStyle(doc);
     const ox=host===doc?(parseFloat(cs.paddingLeft)||0)*z:0,oy=host===doc?(parseFloat(cs.paddingTop)||0)*z:0;const wmm=Math.round(ir.width/k*10)/10;img.style.cssText='';img.className='wfl';img.dataset.w=wmm;img.dataset.x=Math.round((mg.l+(ir.left-hr.left-ox)/k)*10)/10;img.dataset.y=Math.round((mg.t+(ir.top-hr.top-oy)/k)*10)/10;if(img.parentElement!==host)host.appendChild(img);closeCtx();posFloats();changed();toast('Ahora la podés arrastrar con el dedo');return}
    if(a==='del'){img.remove();closeCtx();changed()}if(a==='ok')closeCtx()};return}
  if(td){const tb=td.closest('table');closeCtx();ctx.innerHTML='<b>Tabla</b>'+['+ Fila','+ Columna','− Fila','− Columna','Bordes','Quitar tabla'].map((n,i)=>'<button type="button" class="btn sm" data-c="t'+i+'">'+n+'</button>').join('')+'<button type="button" class="btn sm" data-c="ok">Listo</button>';ctx.hidden=false;
   ctx.oninput=null;ctx.onclick=ev=>{const q=ev.target.closest('[data-c]');if(!q)return;const a=q.dataset.c,tr=td.closest('tr'),ci=[...tr.children].indexOf(td);
    if(a==='t0'){const n=tr.cloneNode(true);n.querySelectorAll('td,th').forEach(c=>{c.innerHTML='<br>';c.removeAttribute('rowspan')});tr.after(n)}
    if(a==='t1'){tb.querySelectorAll('tr').forEach(r=>{const c=r.children[Math.min(ci,r.children.length-1)];const n=document.createElement(c?c.tagName:'td');n.innerHTML='<br>';c?c.after(n):r.appendChild(n)})}
    if(a==='t2'){if(tb.querySelectorAll('tr').length>1)tr.remove();else tb.remove();closeCtx()}
    if(a==='t3'){tb.querySelectorAll('tr').forEach(r=>{const c=r.children[ci];if(c)c.remove()});if(!tb.querySelector('td,th'))tb.remove();closeCtx()}
    if(a==='t4')tb.classList.toggle('wtb-nb');if(a==='t5'){tb.remove();closeCtx()}if(a==='ok')closeCtx();changed()};return}
  closeCtx()});
 $('.wd-top',el).addEventListener('click',e=>{const b=e.target.closest('[data-k]');if(!b)return;const k=b.dataset.k;
  withBusy(async()=>{busy(k==='pdf'?'Armando el PDF…':'Armando el Word…');closeCtx();const nm=safeName(st.name||'Documento');const blob=k==='pdf'?await WD.toPdf(doc,st):await WD.toDocx(doc,st);busy(false);save();
   const sb=openSheet(k==='pdf'?'PDF listo':'Word listo','<div class="result"></div>');showResults($('.result',sb),[{blob,name:nm+(k==='pdf'?'.pdf':'.docx'),note:k==='pdf'?(PAGES[st.page].n+' · '+MARGINS[st.margin].n):'Se abre en Word, Google Docs o WPS'}])})});
 return el};
async function imgToData(f){const img=await loadImg(URL.createObjectURL(f));const max=1400,s=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));const c=document.createElement('canvas');c.width=Math.round(img.naturalWidth*s);c.height=Math.round(img.naturalHeight*s);
 const x=c.getContext('2d');x.imageSmoothingQuality='high';x.drawImage(img,0,0,c.width,c.height);return /png|gif|webp|svg/i.test(f.type)?c.toDataURL('image/png'):c.toDataURL('image/jpeg',.9)}
function findSheet(doc,changed){const b=openSheet('Buscar y reemplazar',opt('Buscar','<input id="wfQ" autocomplete="off">')+opt('Reemplazar por','<input id="wfR" autocomplete="off">')+'<label class="chk"><input type="checkbox" id="wfC"> Distinguir mayúsculas</label><div class="row"><button class="btn block" id="wfFind">Contar</button><button class="btn pri block" id="wfAll">Reemplazar todo</button></div><p class="muted" id="wfMsg" role="status"></p>');
 const re=()=>{const q=$('#wfQ',b).value;if(!q)return null;return new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),$('#wfC',b).checked?'g':'gi')};
 const nodes=()=>{const w=document.createTreeWalker(doc,NodeFilter.SHOW_TEXT);const a=[];let n;while(n=w.nextNode())a.push(n);return a};
 $('#wfFind',b).onclick=()=>{const r=re();if(!r)return;const n=nodes().reduce((s,t)=>s+(t.nodeValue.match(r)||[]).length,0);$('#wfMsg',b).textContent=n?'Aparece '+n+' '+(n===1?'vez':'veces')+'.':'No aparece en el documento.'};
 $('#wfAll',b).onclick=()=>{const r=re();if(!r)return;const to=$('#wfR',b).value;let n=0;for(const t of nodes()){const v=t.nodeValue;const m=v.match(r);if(m){n+=m.length;t.nodeValue=v.replace(r,()=>to)}}changed();$('#wfMsg',b).textContent=n?'Se reemplazó '+n+' '+(n===1?'vez':'veces')+'.':'No aparece en el documento.'}}
__mods.WD=WD;window.WordEd=WD;
})();
