// genera escenas sintéticas: hoja (A4 / oficio / certificado) sobre fondos variados, con perspectiva, sombra y otro papel
window.makeScene=function(seed){let s=seed*9301+49297;const R=()=>{s=(s*9301+49297)%233280;return s/233280};
 const W=1600,H=1200,portrait=R()<.7;const cw=portrait?1200:1600,ch=portrait?1600:1200;const c=document.createElement('canvas');c.width=cw;c.height=ch;const x=c.getContext('2d');
 const bgT=Math.floor(R()*5);
 // fondo
 const bgc=[[70,45,30],[110,110,115],[205,190,165],[40,60,90],[150,120,90]][bgT];x.fillStyle='rgb('+bgc+')';x.fillRect(0,0,cw,ch);
 for(let i=0;i<400;i++){const v=(R()-.5)*40;x.fillStyle='rgba('+bgc.map(a=>Math.max(0,Math.min(255,a+v))).join(',')+',.5)';if(bgT===0||bgT===4)x.fillRect(0,R()*ch,cw,2+R()*6);else x.fillRect(R()*cw,R()*ch,3+R()*20,3+R()*20)}
 if(bgT===3){for(let i=0;i<30;i++){x.strokeStyle='rgba(255,255,255,.25)';x.lineWidth=3;x.beginPath();x.moveTo(0,i*60);x.lineTo(cw,i*60+200);x.stroke()}}
 // tipo de hoja
 const kind=['a4','oficio','cert'][Math.floor(R()*3)],ratio=kind==='oficio'?1.647:1.414;
 const scale=kind==='cert'?.42+R()*.12:.62+R()*.2;let pw,ph;if(portrait){ph=ch*scale;pw=ph/ratio}else{pw=cw*scale;ph=pw/ratio;if(R()<.5){ph=ch*scale;pw=ph/ratio}}
 const cx=cw/2+(R()-.5)*cw*.12,cy=ch/2+(R()-.5)*ch*.1,rot=(R()-.5)*.25;
 const corners=[[-pw/2,-ph/2],[pw/2,-ph/2],[pw/2,ph/2],[-pw/2,ph/2]].map(([a,b])=>{const k=(R()-.5)*.12;return [cx+(a*Math.cos(rot)-b*Math.sin(rot))*(1+k),cy+(a*Math.sin(rot)+b*Math.cos(rot))*(1+(R()-.5)*.08)]});
 // perspectiva simple: acercar esquinas de arriba
 const pers=R()*.08;corners[0][0]+=pw*pers;corners[1][0]-=pw*pers;
 // otro papel detrás (a veces)
 if(R()<.45){x.save();x.fillStyle='#f2f0ea';x.translate(cx+(R()<.5?-1:1)*pw*.55,cy+(R()-.5)*ph*.4);x.rotate((R()-.5)*.6);x.fillRect(-pw/2,-ph/2,pw,ph);x.restore()}
 // hoja: dibujar contenido plano y mapear con homografía aproximada (dos triángulos)
 const pc=document.createElement('canvas');pc.width=600;pc.height=Math.round(600*ratio);const px=pc.getContext('2d');px.fillStyle=R()<.3?'#fbf6e8':'#ffffff';px.fillRect(0,0,pc.width,pc.height);px.fillStyle='#222';
 for(let y=60;y<pc.height-40;y+=22){if(R()<.15)continue;px.fillRect(50,y,300+R()*200,7)}
 if(R()<.7){px.strokeStyle='#111';px.lineWidth=2;const ty=120+R()*100,rows=6+Math.floor(R()*6);for(let r=0;r<=rows;r++){px.beginPath();px.moveTo(30,ty+r*34);px.lineTo(570,ty+r*34);px.stroke()}px.beginPath();px.moveTo(30,ty);px.lineTo(30,ty+rows*34);px.moveTo(570,ty);px.lineTo(570,ty+rows*34);px.moveTo(220,ty);px.lineTo(220,ty+rows*34);px.stroke()}
 if(R()<.5){px.strokeStyle='#1d3fa8';px.lineWidth=3;px.beginPath();px.ellipse(420,pc.height-120,60,35,0,0,7);px.stroke()}
 const drawTri=(s0,s1,s2,d0,d1,d2)=>{x.save();x.beginPath();x.moveTo(...d0);x.lineTo(...d1);x.lineTo(...d2);x.closePath();x.clip();const [a,b]=s0,[c2,d]=s1,[e,f]=s2;const den=(c2-a)*(f-b)-(e-a)*(d-b);
  const m11=((d1[0]-d0[0])*(f-b)-(d2[0]-d0[0])*(d-b))/den,m12=((d2[0]-d0[0])*(c2-a)-(d1[0]-d0[0])*(e-a))/den,m21=((d1[1]-d0[1])*(f-b)-(d2[1]-d0[1])*(d-b))/den,m22=((d2[1]-d0[1])*(c2-a)-(d1[1]-d0[1])*(e-a))/den;
  x.transform(m11,m21,m12,m22,d0[0]-m11*a-m12*b,d0[1]-m21*a-m22*b);x.drawImage(pc,0,0);x.restore()};
 const S=[[0,0],[pc.width,0],[pc.width,pc.height],[0,pc.height]];
 // sombra proyectada de la hoja
 x.save();x.shadowColor='rgba(0,0,0,.45)';x.shadowBlur=18;x.shadowOffsetX=6;x.shadowOffsetY=8;x.fillStyle='#fff';x.beginPath();corners.forEach((p,i)=>i?x.lineTo(...p):x.moveTo(...p));x.closePath();x.fill();x.restore();
 drawTri(S[0],S[1],S[2],corners[0],corners[1],corners[2]);drawTri(S[0],S[2],S[3],corners[0],corners[2],corners[3]);
 // iluminación despareja + sombra de mano/teléfono
 const g=x.createLinearGradient(0,0,cw,ch);g.addColorStop(0,'rgba(255,255,240,'+(R()*.12)+')');g.addColorStop(1,'rgba(0,0,0,'+(.05+R()*.25)+')');x.fillStyle=g;x.fillRect(0,0,cw,ch);
 if(R()<.4){x.fillStyle='rgba(0,0,0,.22)';x.beginPath();x.ellipse(cw*(R()),ch*(.7+R()*.3),cw*.35,ch*.25,R(),0,7);x.fill()}
 return {canvas:c,quad:corners.map(([a,b])=>({x:a/cw,y:b/ch})),kind,bg:bgT}};
window.quadIoU=function(a,b){const n=240;const inside=(q,px,py)=>{let s=0;for(let i=0;i<4;i++){const p=q[i],r=q[(i+1)%4];const cr=(r.x-p.x)*(py-p.y)-(r.y-p.y)*(px-p.x);if(cr===0)continue;const sg=Math.sign(cr);if(!s)s=sg;else if(sg!==s)return false}return true};let I=0,U=0;for(let i=0;i<n;i++)for(let j=0;j<n;j++){const px=(j+.5)/n,py=(i+.5)/n,A=inside(a,px,py),B=b&&inside(b,px,py);if(A&&B)I++;if(A||B)U++}return U?I/U:0};
