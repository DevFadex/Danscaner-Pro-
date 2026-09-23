/* Danscaner Pro · módulo que se carga solo cuando se usa */
window.__mods=window.__mods||{};
__mods.designSheet=function(){const d=D();const cols=['#e53935','#d81b60','#8e24aa','#3949ab','#1e88e5','#00897b','#43a047','#fb8c00','#6d4c41','#212121'];
const seg=(k,opts)=>'<div class="seg" data-k="'+k+'">'+opts.map(([v,n])=>'<button data-v="'+v+'" class="'+(String(d[k])===String(v)?'on':'')+'">'+n+'</button>').join('')+'</div>';
const b=openSheet('🎨 Diseño y visualización',
'<div class="cph">Plantillas listas</div><div class="chips" id="dsPre">'+Object.entries(PRESETS).map(([k,v])=>'<button class="chip" data-pre="'+k+'">'+v.label+'</button>').join('')+'</div>'
+'<div class="muted">Vista previa · tocá los botones</div><div class="dprev"><div class="hero-btns"><button class="hbtn big"><i class="icono-camara"></i><span>Escanear</span><small>Individual</small></button><button class="hbtn"><i data-ico="files">🗂️</i><span>Lote</span><small>Varias fotos</small></button><button class="hbtn"><i data-ico="image">🖼️</i><span>Galería</span><small>Imágenes</small></button></div><div class="dbar"><button class="tb"><b data-ico="crop">✂️</b>Recortar</button><button class="tb"><b data-ico="replace">🔁</b>Cambiar</button><button class="tb"><b data-ico="sign">✍️</b>Firmar</button><button class="tb"><b data-ico="adjust">🎚️</b>Ajustes</button></div><div class="item" style="pointer-events:none"><img src="'+((_metas[0]&&_metas[0].thumb)||'')+'" alt=""><div class="inf"><div class="nm">Documento de ejemplo</div><div class="muted">hoy · 3 pág. · 480 KB</div></div></div><button class="btn pri block"><i data-ico="save">💾</i> Botón principal</button></div>'
+'<div class="cph">Tema</div>'+seg('theme',[['light','Claro'],['dark','Oscuro'],['system','Automático']])
+'<div class="cph">Color principal</div><div class="swatches">'+cols.map(c=>'<button class="sw '+(d.color===c?'on':'')+'" data-col="'+c+'" style="background:'+c+'"></button>').join('')+'<label class="sw pick"><input type="color" id="dsCol" value="'+(d.color||'#e53935')+'"></label><button class="chip" data-col="">Por defecto</button></div>'
+'<div class="cph">Fondo</div>'+seg('bg',[['plano','Plano'],['suave','Degradado'],['papel','Papel']])
+'<div class="cph">Tipografía de la app</div>'+seg('uifont',[['sys','Moderna'],['serif','Formal'],['round','Redondeada'],['mono','Máquina']])
+'<div class="cph">Tamaño general</div>'+seg('zoom',[[0.9,'Compacto'],[1,'Normal'],[1.1,'Grande'],[1.25,'Muy grande']])
+'<div class="cph">Espaciado</div>'+seg('density',[['comp','Ajustado'],['normal','Normal'],['amplio','Amplio']])
+'<div class="cph">Documentos se ven como</div>'+seg('docView',[['list','Lista'],['grid','Cuadrícula']])
+'<div class="cph">Botones</div>'+seg('shape',[['round','Redondeado'],['square','Cuadrado'],['circle','Circular']])
+'<div class="cph">Íconos</div>'+seg('iconStyle',[['line','Profesional'],['emoji','Emoji']])+seg('ico',[[18,'Chicos'],[22,'Normales'],[27,'Grandes']])+seg('stroke',[[1.5,'Finos'],[1.9,'Normales'],[2.4,'Gruesos']])
+'<label class="chk"><input type="checkbox" id="dsCon" '+(d.contrast?'checked':'')+'> Contraste alto (letras más marcadas)</label>'
+'<label class="chk"><input type="checkbox" id="dsAnim" '+(d.anim?'checked':'')+'> Animación al tocar</label>'
+'<div class="cph">Botones de la barra de edición</div><div id="dsEd"></div>'
+'<div class="cph">Accesos rápidos del inicio <small class="muted">(hasta 8)</small></div><div class="chips" id="dsQuick"></div>'
+'<div class="row" style="margin-top:14px"><button class="btn block" id="dsReset"><i data-ico="rotl">↺</i> Restablecer</button><button class="btn pri block" data-back><i data-ico="check">✓</i> Listo</button></div>');
const drawEd=()=>{$('#dsEd',b).innerHTML=d.edTools.map((t,i)=>{const n=(ED_TOOLS.find(x=>x[0]===t.k)||[])[1];return '<div class="frow dsrow"><label class="chk" style="flex:1;margin:0"><input type="checkbox" data-eon="'+i+'" '+(t.on?'checked':'')+'> '+n+'</label><button class="ib" data-eup="'+i+'" '+(i?'':'disabled')+'>▲</button><button class="ib" data-edn="'+i+'" '+(i<d.edTools.length-1?'':'disabled')+'>▼</button></div>'}).join('')};
const QDEF=['Escanea a PDF','Unir PDF','PDF a WORD','Firmar PDF','Comprimir PDF','OCR PDF','JPG a PDF','Editar PDF'];
const drawQuick=()=>{const q=d.quick.length?d.quick:QDEF;$('#dsQuick',b).innerHTML=TOOLS.map(t=>'<button class="chip '+(q.includes(t.name)?'on':'')+'" data-q="'+esc(t.name)+'">'+esc(t.name)+'</button>').join('')};
const refresh=()=>{$$('.seg[data-k]',b).forEach(sg=>{const k=sg.dataset.k;$$('button',sg).forEach(x=>x.classList.toggle('on',String(x.dataset.v)===String(d[k])))});$$('.sw',b).forEach(x=>x.classList.toggle('on',x.dataset.col===d.color));const c=$('#dsCon',b),a=$('#dsAnim',b);if(c)c.checked=!!d.contrast;if(a)a.checked=!!d.anim};
drawEd();drawQuick();
const commit=()=>{saveS();applyDesign();if(d.theme)cambiarTema(d.theme)};
b.oninput=e=>{if(e.target.id==='dsCol'){d.color=e.target.value;commit();refresh()}};
b.onclick=e=>{const btn=e.target.closest('button,input');if(btn&&btn.closest('.dprev')){btn.classList.remove('pulse');void btn.offsetWidth;btn.classList.add('pulse');return}
const pre=e.target.closest('[data-pre]');if(pre){Object.assign(d,JSON.parse(JSON.stringify(PRESETS[pre.dataset.pre])));delete d.label;commit();refresh();toast('Plantilla aplicada');return}
const c=e.target.closest('[data-col]');if(c){d.color=c.dataset.col;commit();refresh();return}
const sv=e.target.closest('.seg[data-k] [data-v]');if(sv){const k=sv.parentNode.dataset.k;const v=sv.dataset.v;d[k]=isNaN(+v)?v:+v;commit();refresh();return}
if(e.target.id==='dsAnim'){d.anim=e.target.checked;commit();return}
if(e.target.id==='dsCon'){d.contrast=e.target.checked;commit();return}
const on=e.target.closest('[data-eon]');if(on){d.edTools[+on.dataset.eon].on=on.checked;commit();return}
const up=e.target.closest('[data-eup]'),dn=e.target.closest('[data-edn]');if(up||dn){const i=+(up||dn).dataset[up?'eup':'edn'],j=up?i-1:i+1;[d.edTools[i],d.edTools[j]]=[d.edTools[j],d.edTools[i]];drawEd();commit();return}
const q=e.target.closest('[data-q]');if(q){let arr=d.quick.length?d.quick.slice():QDEF.slice();const n=q.dataset.q;if(arr.includes(n))arr=arr.filter(x=>x!==n);else{if(arr.length>=8)return toast('Máximo 8 accesos. Quitá uno primero');arr.push(n)}d.quick=arr;drawQuick();commit();return}
if(e.target.closest('#dsReset')){if(!confirm('¿Volver al diseño original?'))return;S.design=JSON.parse(JSON.stringify(DESIGN_DEF));saveS();applyDesign();cambiarTema('system');Nav.back().then(designSheet)}}}
