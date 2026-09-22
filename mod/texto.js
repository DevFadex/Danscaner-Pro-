/* Danscaner Pro · módulo que se carga solo cuando se usa */
window.__mods=window.__mods||{};
/* ---------- 5. Editor de texto tipo Word ---------- */
function rtHtmlFromText(text){return String(text||'').split(/\n{2,}/).map(p=>'<p>'+esc(p).replace(/\n/g,'<br>')+'</p>').join('')||'<p><br></p>'}
function rtDocHtml(inner,title){return '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>'+esc(title)+'</title><style>@page{size:21cm 29.7cm;margin:2.5cm 2cm 2cm 3cm}body{font-family:Calibri,Arial,sans-serif;font-size:11pt;line-height:1.15}p{margin:0 0 8pt}</style></head><body>'+inner+'</body></html>'}
__mods.showText=function(text,name){const txt=String(text||'');
 const fonts=[['Calibri, Carlito, Arial, sans-serif','Calibri'],['Arial, Helvetica, sans-serif','Arial'],['"Times New Roman", Times, serif','Times New Roman'],['Georgia, serif','Georgia'],['Verdana, sans-serif','Verdana'],['"Courier New", monospace','Courier New']];
 const b=openSheet('Texto extraído',
 '<div class="rtbar">'
 +'<select class="rtsel" data-rt="font" title="Tipo de letra">'+fonts.map(([v,n])=>'<option value=\''+v+'\'>'+n+'</option>').join('')+'</select>'
 +'<select class="rtsel" data-rt="size" title="Tamaño">'+[8,9,10,11,12,14,16,18,20,24,28].map(s=>'<option'+(s===11?' selected':'')+'>'+s+'</option>').join('')+'</select>'
 +'<span class="rtsep"></span>'
 +'<button data-cmd="bold" title="Negrita"><b>N</b></button><button data-cmd="italic" title="Cursiva"><i>K</i></button><button data-cmd="underline" title="Subrayado"><u>S</u></button><button data-cmd="strikeThrough" title="Tachado"><s>ab</s></button>'
 +'<label class="rtcol" title="Color de letra">A<input type="color" data-rt="color" value="#c00000"></label><label class="rtcol hl" title="Resaltar">✎<input type="color" data-rt="hilite" value="#ffff00"></label>'
 +'<span class="rtsep"></span>'
 +'<button data-cmd="justifyLeft" title="Alinear a la izquierda"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 5 H20"/><path d="M4 9 H14"/><path d="M4 13 H20"/><path d="M4 17 H12"/></svg></button><button data-cmd="justifyCenter" title="Centrar"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 5 H20"/><path d="M7 9 H17"/><path d="M4 13 H20"/><path d="M8 17 H16"/></svg></button><button data-cmd="justifyRight" title="Alinear a la derecha"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 5 H20"/><path d="M10 9 H20"/><path d="M4 13 H20"/><path d="M12 17 H20"/></svg></button><button data-cmd="justifyFull" title="Justificar" class="on"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 5 H20"/><path d="M4 9 H20"/><path d="M4 13 H20"/><path d="M4 17 H20"/></svg></button>'
 +'<span class="rtsep"></span>'
 +'<button data-cmd="insertUnorderedList" title="Viñetas">•</button><button data-cmd="insertOrderedList" title="Numeración">1.</button><button data-cmd="outdent" title="Disminuir sangría">⇤</button><button data-cmd="indent" title="Aumentar sangría">⇥</button>'
 +'<select class="rtsel" data-rt="lh" title="Interlineado"><option value="1">1,0</option><option value="1.15" selected>1,15</option><option value="1.5">1,5</option><option value="2">2,0</option></select>'
 +'<span class="rtsep"></span>'
 +'<button data-cmd="removeFormat" title="Borrar formato">⌫A</button><button data-cmd="undo" title="Deshacer">↶</button><button data-cmd="redo" title="Rehacer">↷</button>'
 +'<button data-rt="joinlines" title="Unir renglones cortados en párrafos">¶</button>'
 +'</div>'
 +'<div class="rtpage"><div class="rtdoc" id="rtDoc" contenteditable="true" spellcheck="true" lang="es"></div></div>'
 +'<textarea id="ocrTxt" hidden></textarea>'
 +'<div class="row"><button class="btn block" data-t="copy"><i data-ico="type">📋</i> Copiar</button><button class="btn pri block" data-t="doc"><i data-ico="word">📝</i> Word</button></div>'
 +'<div class="row"><button class="btn block" data-t="pdf"><i data-ico="save">📄</i> PDF</button><button class="btn block" data-t="txt"><i data-ico="save">⬇</i> .txt</button><button class="btn block" data-t="share"><i data-ico="share">📤</i></button></div>'
 +'<p class="muted">'+(txt.trim()?'Editalo como en Word: elegí letra, tamaño, alineación (justificado viene activado), listas, sangría e interlineado. El botón ¶ une los renglones cortados en párrafos.':'No se detectó texto. Probá con más luz, la foto quieta y el filtro "Nítido" o "B/N".')+'</p>');
 const doc=$('#rtDoc',b),mirror=$('#ocrTxt',b);
 doc.innerHTML=rtHtmlFromText(txt);doc.style.textAlign='justify';doc.style.lineHeight='1.15';doc.style.fontFamily=fonts[0][0];
 const sync=()=>{mirror.value=doc.innerText};sync();doc.addEventListener('input',sync);
 try{document.execCommand('styleWithCSS',false,true)}catch(e){}
 const exec=(c,v)=>{doc.focus();try{document.execCommand(c,false,v)}catch(e){}sync()};
 b.onmousedown=e=>{if(e.target.closest('.rtbar button'))e.preventDefault()};
 b.onchange=e=>{const t=e.target.dataset.rt;if(!t)return;const v=e.target.value;
  if(t==='font')exec('fontName',v);
  if(t==='size'){exec('fontSize','7');doc.querySelectorAll('font[size="7"],span[style*="xxx-large"]').forEach(n=>{n.removeAttribute('size');n.style.fontSize=v+'pt'})}
  if(t==='color')exec('foreColor',v);
  if(t==='hilite')exec('hiliteColor',v);
  if(t==='lh'){doc.style.lineHeight=v}};
 b.onclick=async e=>{const c=e.target.closest('[data-cmd]');
  if(c){exec(c.dataset.cmd);if(/^justify/.test(c.dataset.cmd)){$$('.rtbar [data-cmd^="justify"]',b).forEach(x=>x.classList.toggle('on',x===c))}return}
  if(e.target.closest('[data-rt="joinlines"]')){doc.innerHTML=rtHtmlFromText(doc.innerText.replace(/(\w)-\n(\w)/g,'$1$2').replace(/([^\n.:;!?])\n(?!\n)/g,'$1 '));sync();toast('Renglones unidos en párrafos');return}
  const t=e.target.closest('[data-t]')?.dataset.t;if(!t)return;const nm=safeName(name||'texto'),plain=doc.innerText;
  if(t==='copy'){try{await navigator.clipboard.writeText(plain);toast('Copiado')}catch(er){toast('No se pudo copiar')}}
  if(t==='txt')download(new Blob([plain],{type:'text/plain;charset=utf-8'}),nm+'.txt');
  if(t==='doc'){const html=rtDocHtml('<div style="text-align:'+(doc.style.textAlign||'justify')+';line-height:'+doc.style.lineHeight+';font-family:'+doc.style.fontFamily.replace(/"/g,"'")+'">'+sanitizeHtml(doc.innerHTML)+'</div>',nm);download(new Blob(['\ufeff'+html],{type:'application/msword'}),nm+'.doc');toast('Se abre en Word con el formato')}
  if(t==='pdf')withBusy(async()=>{busy('Armando PDF…');const blob=await htmlToPdfBlob('<div style="text-align:'+(doc.style.textAlign||'justify')+';line-height:'+doc.style.lineHeight+';font-family:'+doc.style.fontFamily.replace(/"/g,"'")+';font-size:11pt">'+sanitizeHtml(doc.innerHTML)+'</div>');busy(false);download(blob,nm+'.pdf')});
  if(t==='share')share(new Blob([plain],{type:'text/plain;charset=utf-8'}),nm+'.txt')};
 return b}



