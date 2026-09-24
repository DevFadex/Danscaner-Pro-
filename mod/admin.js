/* Danscanner Pro · módulo que se carga solo cuando se usa */
window.__mods=window.__mods||{};
/* ---------- panel de administración ---------- */
function admInitials(n,e){const base=(n||'').trim()||(e||'').split('@')[0]||'?';const p=base.split(/[\s._-]+/).filter(Boolean);return (p.length>=2?p[0][0]+p[1][0]:base.slice(0,2)).toUpperCase()}
function admColor(seed){const pal=['#e53935','#d81b60','#8e24aa','#5e35b1','#3949ab','#1e88e5','#039be5','#00897b','#43a047','#f4511e','#6d4c41','#546e7a'];let h=0;for(const c of String(seed||''))h=(h*31+c.charCodeAt(0))>>>0;return pal[h%pal.length]}
function admAvatar(u,lg){return '<div class="avatar'+(lg?' lg':'')+'" style="background:'+admColor(u.id||u.email||'')+'">'+esc(admInitials(u.full_name,u.email))+'</div>'}
function admDate(iso){if(!iso)return '—';try{return new Date(iso).toLocaleDateString('es-AR',{day:'2-digit',month:'short',year:'numeric'})}catch(e){return '—'}}
function admRel(iso){if(!iso)return '';try{const d=new Date(iso),s=Math.floor((Date.now()-d)/1000);if(s<3600)return 'hace '+Math.max(1,Math.floor(s/60))+' min';if(s<86400)return 'hace '+Math.floor(s/3600)+' h';if(s<2592000)return 'hace '+Math.floor(s/86400)+' días';return 'el '+d.toLocaleDateString('es-AR')}catch(e){return ''}}
function admBadges(u,isMe){const st={activo:['activo','Activo'],pendiente:['pendiente','Pendiente'],bloqueado:['bloqueado','Bloqueado']}[u.status]||['user',u.status||'—'];
return '<span class="badge '+(u.role==='admin'?'admin':'user')+'">'+(u.role==='admin'?'Admin':'Usuario')+'</span><span class="badge '+st[0]+'">'+esc(st[1])+'</span>'+(isMe?'<span class="badge you">Vos</span>':'')}
__mods.adminSheet=async function(){if(!SB.ready||!SB.profile||SB.profile.role!=='admin')return toast('Solo el administrador puede entrar acá');
let users=[],filter='todos',query='',bulk=false;const sel=new Set();
const b=openSheet('👤 Administración de accesos','<div class="admin-wrap" id="admRoot"><div class="admin-empty"><div class="big">⏳</div>Cargando…</div></div>');
const draw=()=>{const st={total:users.length,activos:users.filter(u=>u.status==='activo').length,pend:users.filter(u=>u.status==='pendiente').length,bloq:users.filter(u=>u.status==='bloqueado').length,admins:users.filter(u=>u.role==='admin').length};
let list=users.filter(u=>{if(filter==='activos'&&u.status!=='activo')return false;if(filter==='pendientes'&&u.status!=='pendiente')return false;if(filter==='bloqueados'&&u.status!=='bloqueado')return false;if(filter==='admins'&&u.role!=='admin')return false;
if(query)return ((u.email||'')+' '+(u.full_name||'')).toLowerCase().includes(query.toLowerCase());return true});
list.sort((a,c)=>a.role!==c.role?(a.role==='admin'?-1:1):new Date(c.created_at||0)-new Date(a.created_at||0));
$('#admRoot',b).innerHTML='<div class="admin-stats">'
+'<div class="stat-card" data-tone="ac"><b>'+st.total+'</b><small>Total</small></div>'
+'<div class="stat-card" data-tone="ok"><b>'+st.activos+'</b><small>Activos</small></div>'
+'<div class="stat-card" data-tone="red"><b>'+st.bloq+'</b><small>Bloqueados</small></div>'
+'<div class="stat-card" data-tone="info"><b>'+st.admins+'</b><small>Admins</small></div></div>'
+'<div class="invite-cta" id="admInvite"><div class="ic">＋</div><div class="txt"><b>Invitar a alguien</b><small>Enlace o código QR para dar acceso</small></div><div class="arrow">›</div></div>'
+'<div class="admin-search"><input id="admQ" placeholder="Buscar por nombre o correo…" value="'+esc(query)+'"></div>'
+'<div class="admin-filters">'+[['todos','Todos',st.total],['activos','Activos',st.activos],['pendientes','Pendientes',st.pend],['bloqueados','Bloqueados',st.bloq],['admins','Admins',st.admins]].map(([k,l,n])=>'<button class="chip '+(filter===k?'on':'')+'" data-fl="'+k+'">'+l+' · '+n+'</button>').join('')+'</div>'
+(bulk&&sel.size?'<div class="admin-selbar"><b>'+sel.size+' seleccionado(s)</b><button data-bulk="activo">✓ Dar acceso</button><button data-bulk="bloqueado">✕ Quitar</button><button data-bulk="cancel">Cancelar</button></div>':'')
+'<div class="admin-list">'+(list.length?list.map(u=>{const isMe=u.id===SB.user.id;
return '<div class="admin-user" data-id="'+u.id+'" data-status="'+esc(u.status||'')+'" data-role="'+esc(u.role||'')+'">'
+(bulk&&!isMe?'<input type="checkbox" class="cb" data-cb="'+u.id+'" '+(sel.has(u.id)?'checked':'')+'>':'')
+admAvatar(u)+'<div class="inf"><div class="nm">'+esc(u.full_name||u.email||'(sin nombre)')+'</div><div class="em">'+esc(u.email||'')+'</div><div class="admin-badges">'+admBadges(u,isMe)+'</div>'+(u.created_at?'<div class="meta">Se registró '+admRel(u.created_at)+'</div>':'')+'</div><div class="chev">›</div></div>'}).join('')
:'<div class="admin-empty"><div class="big">🔎</div>No hay usuarios que coincidan.</div>')+'</div>'
+'<div class="admin-actions-top" style="margin-top:10px"><button class="btn" id="admBulk">'+(bulk?'✕ Cancelar':'☑️ Seleccionar')+'</button><button class="btn" id="admCsv">📥 CSV</button><button class="btn" id="admRef">↻ Actualizar</button></div>';
const q=$('#admQ',b);if(q)q.oninput=e=>{query=e.target.value;const p=e.target.selectionStart;draw();const n=$('#admQ',b);n.focus();try{n.setSelectionRange(p,p)}catch(x){}}};
const load=async(silent)=>{if(!silent)$('#admRoot',b).innerHTML='<div class="admin-empty"><div class="big">⏳</div>Cargando…</div>';
try{const r=await _to(SB.client.from('profiles').select('*').order('created_at',{ascending:false}),20000,'usuarios');
 if(r.error)throw r.error;users=r.data||[];draw()}
catch(e){$('#admRoot',b).innerHTML='<div class="admin-empty"><div class="big">⚠️</div>'+esc(e.message||e)+'<br><button class="btn pri" style="margin-top:12px" id="admRetry">↻ Reintentar</button></div>'}};
b.onclick=async e=>{
 if(e.target.closest('#admRetry'))return load();
 const f=e.target.closest('[data-fl]');if(f){filter=f.dataset.fl;return draw()}
 if(e.target.closest('#admInvite'))return adminInviteSheet();
 if(e.target.closest('#admRef'))return load(true);
 if(e.target.closest('#admBulk')){bulk=!bulk;if(!bulk)sel.clear();return draw()}
 if(e.target.closest('#admCsv'))return admCsv(users);
 const cb=e.target.closest('[data-cb]');if(cb){e.stopPropagation();cb.checked?sel.add(cb.dataset.cb):sel.delete(cb.dataset.cb);return draw()}
 const bl=e.target.closest('[data-bulk]');if(bl){const a=bl.dataset.bulk;if(a==='cancel'){bulk=false;sel.clear();return draw()}
  await withBusy(async()=>{let i=0;for(const id of sel){busy('Actualizando '+(++i)+'/'+sel.size);await SB.client.from('profiles').update({status:a}).eq('id',id)}});
  sel.clear();bulk=false;toast(a==='activo'?'Acceso habilitado':'Acceso quitado');return load(true)}
 const row=e.target.closest('.admin-user');if(row){const u=users.find(x=>x.id===row.dataset.id);if(u)adminUserDetail(u,()=>load(true),$('#admRoot',b))}};
await load()}
function adminUserDetail(u,onChange,host){const isMe=u.id===SB.user.id;
const b=host||openSheet('Detalle del usuario','');if(host)host.innerHTML='<button class="btn sm" data-act="back" style="margin-bottom:10px">← Volver a la lista</button>'+('<div class="udetail-head">'+admAvatar(u,true)+'<div class="txt"><h3>'+esc(u.full_name||u.email||'(sin nombre)')+'</h3><div class="em">'+esc(u.email||'')+'</div><div class="admin-badges" style="margin-top:8px">'+admBadges(u,isMe)+'</div></div></div>'
+'<div class="udetail-row"><span class="label">Rol</span><span class="val">'+(u.role==='admin'?'Administrador':'Usuario')+'</span></div>'
+'<div class="udetail-row"><span class="label">Estado</span><span class="val">'+(u.status==='activo'?'Puede entrar':u.status==='pendiente'?'Esperando autorización':'Bloqueado')+'</span></div>'
+'<div class="udetail-row"><span class="label">Registrado</span><span class="val">'+admDate(u.created_at)+' · '+admRel(u.created_at)+'</span></div>'
+'<div class="udetail-row"><span class="label">ID</span><span class="val"><code>'+esc(u.id)+'</code></span></div>'
+(isMe?'<p class="muted" style="margin-top:16px;text-align:center">Es tu propia cuenta: no podés quitarte el acceso.</p>'
 :'<div class="udetail-actions"><button class="btn '+(u.status==='activo'?'red':'pri')+'" data-act="st">'+(u.status==='activo'?'🚫 Quitar acceso':'✓ Dar acceso')+'</button><button class="btn" data-act="rol">'+(u.role==='admin'?'👤 Quitar admin':'👑 Hacer admin')+'</button><button class="btn" data-act="mail">📋 Copiar correo</button><button class="btn" data-act="del">🗑 Eliminar</button></div>'));
b.onclick=async e=>{const a=e.target.closest('[data-act]')?.dataset.act;if(!a)return;
if(a==='mail'){try{await navigator.clipboard.writeText(u.email||'');toast('Correo copiado')}catch(x){toast('No se pudo copiar')}return}
if(a==='back'){onChange&&onChange();return}
if(a==='st'){const n=u.status==='activo'?'bloqueado':'activo';const {error}=await SB.client.from('profiles').update({status:n}).eq('id',u.id);if(error)return toast('Error: '+error.message);toast(n==='activo'?'Acceso habilitado':'Acceso quitado');if(!host)await Nav.back();onChange&&onChange();return}
if(a==='rol'){const n=u.role==='admin'?'usuario':'admin';if(n==='admin'&&!confirm('¿Convertir a '+(u.email||'')+' en administrador? Va a poder dar y quitar accesos.'))return;const {error}=await SB.client.from('profiles').update({role:n}).eq('id',u.id);if(error)return toast('Error: '+error.message);toast(n==='admin'?'Ahora es administrador':'Ya no es administrador');if(!host)await Nav.back();onChange&&onChange();return}
if(a==='del'){if(!confirm('¿Eliminar el perfil de '+(u.email||'')+'? Si vuelve a entrar con su correo, se crea de nuevo.'))return;const {error}=await SB.client.from('profiles').delete().eq('id',u.id);if(error)return toast('Error: '+error.message);toast('Perfil eliminado');if(!host)await Nav.back();onChange&&onChange()}}}
function adminInviteSheet(){let role='usuario',days=7;
const b=openSheet('Invitar persona','<p class="muted" style="margin-top:0">La persona abre el enlace, entra con su correo y queda habilitada.</p>'
+'<div class="inv-step"><span class="num">1</span><div class="txt"><b>Correo (opcional)</b>Vacío = sirve para cualquiera.</div></div><input id="invEmail" type="email" inputmode="email" placeholder="correo@ejemplo.com">'
+'<div class="inv-step"><span class="num">2</span><div class="txt"><b>Rol</b>Con qué permisos entra.</div></div><div class="seg" id="invRole"><button data-r="usuario" class="on">👤 Usuario</button><button data-r="admin">👑 Admin</button></div>'
+'<div class="inv-step"><span class="num">3</span><div class="txt"><b>Vencimiento</b>Después de ese plazo el enlace no sirve más.</div></div><div class="seg" id="invDays"><button data-d="1">1 día</button><button data-d="7" class="on">7 días</button><button data-d="30">30 días</button></div>'
+'<button class="btn pri block" style="margin-top:16px" id="invGo"><i data-ico="check">✨</i> Generar enlace</button>');
b.onclick=async e=>{const r=e.target.closest('#invRole [data-r]');if(r){role=r.dataset.r;$$('#invRole button',b).forEach(x=>x.classList.toggle('on',x===r));return}
const d=e.target.closest('#invDays [data-d]');if(d){days=+d.dataset.d;$$('#invDays button',b).forEach(x=>x.classList.toggle('on',x===d));return}
if(!e.target.closest('#invGo'))return;
const email=($('#invEmail',b).value||'').trim()||null;
if(email&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))return toast('Escribí un correo válido');
await withBusy(async()=>{busy('Generando…');const {data,error}=await SB.client.rpc('create_invite',{p_email:email,p_days:days});
if(error)throw new Error(error.message);
const link=location.origin+location.pathname+'?invite='+data;busy('Armando el código QR…');
b.innerHTML='<div style="text-align:center;margin-bottom:8px"><div style="font-size:48px">🎉</div><h3 style="margin:8px 0 4px">Invitación lista</h3><p class="muted" style="margin:0">'+(email?'Solo para <b>'+esc(email)+'</b>':'Enlace abierto')+' · vence en '+days+' día(s)'+(role==='admin'?' · entra como administrador':'')+'</p></div>'
+'<div class="inv-result"><div class="qr-wrap" id="invQr"></div><div class="inv-link">'+esc(link)+'</div><div class="row" style="margin:0"><button class="btn block" id="invCopy"><i data-ico="type">📋</i> Copiar</button><button class="btn pri block" id="invShare"><i data-ico="share">📤</i> Compartir</button></div></div>'
+'<div class="inv-step"><span class="num">💡</span><div class="txt"><b>Cómo se usa</b>Mandaselo por WhatsApp, o que escanee el QR con la cámara del teléfono.</div></div>'
+'<div class="row"><button class="btn block" id="invNew">➕ Otra invitación</button><button class="btn pri block" data-back><i data-ico="check">✓</i> Listo</button></div>';
iconize(b);
try{await loadLib('qrcode');new QRCode($('#invQr',b),{text:link,width:190,height:190,correctLevel:QRCode.CorrectLevel.M})}
catch(x){$('#invQr',b).innerHTML='<p class="muted">El código QR necesita internet la primera vez. Usá el enlace de abajo.</p>'}
busy(false);
$('#invCopy',b).onclick=async()=>{try{await navigator.clipboard.writeText(link);toast('Enlace copiado')}catch(x){toast('Copialo del recuadro')}};
$('#invShare',b).onclick=async()=>{const txt='Te comparto el acceso a Danscanner Pro: '+link;try{if(navigator.share)return void await navigator.share({title:'Acceso a Danscanner Pro',text:txt,url:link});await navigator.clipboard.writeText(txt);toast('Copiado')}catch(x){}};
$('#invNew',b).onclick=()=>Nav.back().then(adminInviteSheet)})}}
function admCsv(list){if(!list||!list.length)return toast('No hay usuarios para exportar');
const head=['Nombre','Correo','Rol','Estado','Registrado','ID'];
const rows=list.map(u=>[u.full_name||'',u.email||'',u.role||'',u.status||'',admDate(u.created_at),u.id]);
const csv=[head,...rows].map(r=>r.map(c=>'"'+String(c).replace(/"/g,'""')+'"').join(';')).join('\n');
download(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}),'usuarios_'+new Date().toISOString().slice(0,10)+'.csv');toast('CSV descargado')}



