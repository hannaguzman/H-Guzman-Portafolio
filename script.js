// Entrada animada: una estrella cae en la noche, cambia de azul a amarillo y a rosa,
// crea una onda suave y revela el nombre; al final el fondo se inunda de rosa y entra al sitio.
(() => {
'use strict';

/* ------------------------------------------------------------------
   AJUSTES RÁPIDOS
------------------------------------------------------------------ */
const CFG = {
  nombre:'Hanna Guzmán',
  rosa:[255,133,179],     // #FF85B3: color final del fondo y de la estrella
  coral:[238,99,70],      // #EE6346: borde de las letras
  espera:.7               // segundos que se queda todo completo antes de entrar al sitio
};
// Colores de la estrella según cuánto bajó (0 = arriba, 1 = al caer): azul → amarillo → rosa
const COLORES = [
  [0,   [61,139,255]],    // azul
  [.12, [61,139,255]],    // se queda azul un momento arriba
  [.30, [205,232,255]],   // destello celeste claro
  [.40, [255,249,228]],   // blanco cálido (evita tonos verdosos)
  [.52, [255,217,61]],    // amarillo
  [.75, [255,172,120]],   // durazno dorado
  [1,   [255,133,179]]    // rosa (al tocar)
];
// Tiempos en segundos
const T = { caida:.3, impacto:1.9, letras:2.25, paso:.06, inundar:3.0, dur:.9 };
const END = T.inundar + T.dur;

/* ------------------------------------------------------------------ utilidades */
const $ = id => document.getElementById(id);
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t)};
const easeIO=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
const easeOutBack=t=>{const c=1.7;return 1+(c+1)*Math.pow(t-1,3)+c*Math.pow(t-1,2)};
const mixRGB=(a,b,t)=>[lerp(a[0],b[0],t),lerp(a[1],b[1],t),lerp(a[2],b[2],t)];
const rgba=(c,a=1)=>`rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
function colorAt(u){
  for(let i=1;i<COLORES.length;i++){
    if(u<=COLORES[i][0]){
      const [t0,c0]=COLORES[i-1],[t1,c1]=COLORES[i];
      return mixRGB(c0,c1,smooth(0,1,(u-t0)/(t1-t0)));
    }
  }
  return COLORES[COLORES.length-1][1];
}

/* ------------------------------------------------------------------ cielo de estrellitas (siempre iguales) */
function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const SKY=(()=>{const r=rng(7),a=[];for(let i=0;i<110;i++)a.push({x:r(),y:r(),r:.5+r()*1.3,a:.25+r()*.6,v:.8+r()*2.2,p:r()*6.28});return a})();
// chispas que salen al impactar
const CHISPAS=(()=>{const r=rng(21),a=[];for(let i=0;i<18;i++)a.push({ang:i/18*6.283+r()*.3,vel:.8+r()*1.4,r:2+r()*3,c:[[61,139,255],[255,217,61],[255,133,179]][i%3]});return a})();

/* ------------------------------------------------------------------ estrella redondeada */
function starPath(c,R){
  const ratio=.52, pts=[];
  for(let i=0;i<10;i++){const r=i%2?R*ratio:R,a=-Math.PI/2+i*Math.PI/5;pts.push([Math.cos(a)*r,Math.sin(a)*r]);}
  c.beginPath();
  for(let i=0;i<10;i++){
    const p0=pts[(i+9)%10],p1=pts[i],p2=pts[(i+1)%10];
    const d1=Math.hypot(p0[0]-p1[0],p0[1]-p1[1]),d2=Math.hypot(p2[0]-p1[0],p2[1]-p1[1]);
    const rr=i%2?R*.16:R*.30, k1=Math.min(rr/d1,.46), k2=Math.min(rr/d2,.46);
    const a=[p1[0]+(p0[0]-p1[0])*k1,p1[1]+(p0[1]-p1[1])*k1], b=[p1[0]+(p2[0]-p1[0])*k2,p1[1]+(p2[1]-p1[1])*k2];
    if(i) c.lineTo(a[0],a[1]); else c.moveTo(a[0],a[1]);
    c.quadraticCurveTo(p1[0],p1[1],b[0],b[1]);
  }
  c.closePath();
}

/* ------------------------------------------------------------------ lienzo y medidas */
const canvas=$('gl'), c=canvas.getContext('2d');
let L={}, lastT=0;
function layout(){
  const vw=innerWidth, vh=innerHeight, dpr=Math.min(devicePixelRatio||1,2);
  const R=clamp(Math.min(vh*.14,vw*.23),44,124);
  const f=clamp(Math.min(vw*.098,vh*.105),32,92), gap=f*.5, nameH=f*1.1;
  const starH=R*1.81, lock=starH+gap+nameH;
  const top=(vh-lock)/2+vh*.02, yc=top+R, cx=vw/2;
  const ow=Math.max(4,f*.07);
  L={vw,vh,dpr,R,f,ow,cx,yc,y0:-R*.95,drift:Math.min(vw*.17,230),
     floodR:Math.hypot(Math.max(cx,vw-cx),Math.max(yc,vh-yc))+12, maxR:Math.hypot(vw,vh)*.55};
  canvas.width=Math.round(vw*dpr); canvas.height=Math.round(vh*dpr);
  const top2=(yc+R*.81+gap)+'px';
  [nomFondo,nomFrente].forEach(el=>{el.style.top=top2; el.style.fontSize=f+'px';});
  const ring=[]; for(let i=0;i<16;i++){const a=i/16*Math.PI*2; ring.push(`${(Math.cos(a)*ow).toFixed(2)}px ${(Math.sin(a)*ow).toFixed(2)}px 0 ${rgba(CFG.coral)}`);}
  nomFondo.style.textShadow=ring.join(',');
  render(lastT);
}

/* ------------------------------------------------------------------ nombre (dos capas: borde coral abajo, letras blancas arriba) */
function buildName(el){
  const arr=[];
  for(const ch of CFG.nombre){
    const s=document.createElement('span'); s.className='l'+(ch===' '?' sp':'');
    s.textContent = ch===' ' ? ' ' : ch; el.appendChild(s); arr.push(s);
  }
  return arr;
}
const nomFondo=$('nomFondo'), nomFrente=$('nomFrente');
const LB=buildName(nomFondo), LF=buildName(nomFrente);

/* ------------------------------------------------------------------ posición de la estrella en la caída */
function pos(tt){
  const u=clamp((tt-T.caida)/(T.impacto-T.caida)), e=Math.pow(u,1.7);   // cae acelerando
  return {u, e, x:L.cx+L.drift*Math.pow(1-u,1.4), y:lerp(L.y0,L.yc,e), sc:lerp(.8,1,e), rot:-(1-u)*Math.PI*1.15};
}

function drawStar(x,y,R,rot,sx,sy,rgb,glow,p){
  c.save(); c.translate(x,y); c.rotate(rot); c.scale(sx,sy);
  if(glow>0){                                   // halo luminoso
    c.globalCompositeOperation='lighter';
    const h=c.createRadialGradient(0,0,R*.2,0,0,R*2.7);
    h.addColorStop(0,rgba(rgb,.5*glow)); h.addColorStop(1,rgba(rgb,0));
    c.fillStyle=h; c.beginPath(); c.arc(0,0,R*2.7,0,7); c.fill();
    c.globalCompositeOperation='source-over';
  }
  starPath(c,R);
  if(p>0){ c.lineJoin='round'; c.lineWidth=2*L.ow; c.strokeStyle=rgba(CFG.coral,p); c.stroke(); }
  const base=mixRGB(rgb,[255,255,255],p), q=1-p;
  const gr=c.createLinearGradient(-R*.7,-R*.9,R*.7,R*.9);
  gr.addColorStop(0,rgba(mixRGB(base,[255,255,255],.5*q)));
  gr.addColorStop(.5,rgba(base));
  gr.addColorStop(1,rgba(mixRGB(base,[0,0,0],.26*q)));
  if(glow>0){ c.shadowColor=rgba(rgb,.9*glow); c.shadowBlur=R*.8*L.dpr; }
  c.fillStyle=gr; c.fill();
  c.shadowBlur=0; c.shadowColor='transparent';
  if(q>0){                                      // brillo suave arriba a la izquierda
    const hl=c.createRadialGradient(-R*.3,-R*.35,0,-R*.3,-R*.35,R*.95);
    hl.addColorStop(0,`rgba(255,255,255,${.55*q})`); hl.addColorStop(1,'rgba(255,255,255,0)');
    c.fillStyle=hl; c.fill();
  }
  c.restore();
}

/* ------------------------------------------------------------------ dibujo de cada cuadro */
function render(t){
  lastT=t;
  const {vw,vh,dpr,R,cx,yc}=L;
  c.setTransform(dpr,0,0,dpr,0,0);

  // noche
  const g=c.createRadialGradient(vw/2,vh*.4,0,vw/2,vh*.4,Math.max(vw,vh)*.8);
  g.addColorStop(0,'#13112b'); g.addColorStop(1,'#04030a');
  c.fillStyle=g; c.fillRect(0,0,vw,vh);
  const fin=smooth(0,.7,t);
  c.fillStyle='#fff';
  for(const s of SKY){
    c.globalAlpha=fin*s.a*(.55+.45*Math.sin(t*s.v+s.p));
    c.beginPath(); c.arc(s.x*vw,s.y*vh,s.r,0,6.283); c.fill();
  }
  c.globalAlpha=1;

  const hv=t-T.impacto;                          // tiempo desde el impacto

  // destello y ondas suaves
  if(hv>0){
    const fv=clamp(hv/.9), fe=1-Math.pow(1-fv,3);
    if(fv<1){
      c.globalCompositeOperation='lighter';
      const rr=lerp(R,R*6,fe), gg=c.createRadialGradient(cx,yc,0,cx,yc,rr);
      gg.addColorStop(0,rgba(CFG.rosa,.5*(1-fv))); gg.addColorStop(1,rgba(CFG.rosa,0));
      c.fillStyle=gg; c.beginPath(); c.arc(cx,yc,rr,0,7); c.fill();
      c.globalCompositeOperation='source-over';
    }
    for(let i=0;i<3;i++){
      const v=(t-(T.impacto+i*.2))/1.6;
      if(v<=0||v>=1) continue;
      const e=1-Math.pow(1-v,3), r=lerp(R*.7,L.maxR,e), a=Math.pow(1-v,1.5)*.8;
      c.beginPath(); c.arc(cx,yc,r,0,7);
      c.lineWidth=lerp(5,1.2,v); c.strokeStyle=rgba(CFG.rosa,a);
      c.shadowColor=rgba(CFG.rosa,a); c.shadowBlur=16*dpr; c.stroke(); c.shadowBlur=0;
    }
    // chispas de colores
    for(const s of CHISPAS){
      const v=clamp(hv/1.0); if(v>=1) break;
      const d=(1-Math.pow(1-v,3))*s.vel*R*1.9;
      c.fillStyle=rgba(s.c,(1-v)*.9);
      c.beginPath(); c.arc(cx+Math.cos(s.ang)*d,yc+Math.sin(s.ang)*d,s.r*(1-v*.6),0,7); c.fill();
    }
  }

  // inundación rosa desde el punto de impacto
  const fl=clamp((t-T.inundar)/T.dur);
  if(fl>=1){ c.fillStyle=rgba(CFG.rosa); c.fillRect(0,0,vw,vh); }
  else if(fl>0){ c.fillStyle=rgba(CFG.rosa); c.beginPath(); c.arc(cx,yc,easeIO(fl)*L.floodR,0,7); c.fill(); }

  // estela (partículas que quedan detrás de la estrella)
  const trailOn=1-smooth(T.impacto,T.impacto+.15,t);
  if(trailOn>0 && t>T.caida){
    c.globalCompositeOperation='lighter';
    for(let k=1;k<=16;k++){
      const tt=t-k*.024; if(tt<T.caida) break;
      const ps=pos(tt), col=colorAt(ps.e), f=1-k/17, side=((k*37)%11-5)/5;
      c.fillStyle=rgba(col,Math.pow(f,1.4)*.7*trailOn);
      c.beginPath(); c.arc(ps.x+side*R*.3*(1-f*.4),ps.y-R*.12-k*R*.045,R*.085*f+.8,0,7); c.fill();
      if(k%2){ c.fillStyle=rgba(mixRGB(col,[255,255,255],.6),Math.pow(f,2)*.6*trailOn);
        c.beginPath(); c.arc(ps.x-side*R*.5,ps.y-R*.35-k*R*.07,1+f*1.4,0,7); c.fill(); }
    }
    c.globalCompositeOperation='source-over';
  }

  // la estrella
  const ps=pos(t), col=colorAt(ps.e);
  let sx=1,sy=1;
  if(hv>0 && hv<.55){ const w=hv/.55, sq=Math.sin(Math.PI*w)*(1-w*.4); sx=1+.2*sq; sy=1-.24*sq; }
  const p=smooth(T.inundar+.15,T.inundar+.75,t);   // se vuelve blanca con borde coral al inundarse
  const glow=(1-p)*(hv>0?1+.9*Math.max(0,1-hv/.6):1);
  drawStar(ps.x,ps.y,R*ps.sc,hv>0?0:ps.rot,sx,sy,col,glow,p);

  // letras del nombre
  let n=0;
  for(let i=0;i<LF.length;i++){
    if(LF[i].classList.contains('sp')) continue;
    const u=clamp((t-(T.letras+n*T.paso))/.5); n++;
    const e=easeOutBack(u), tr=`translateY(${((1-e)*L.f*.4).toFixed(2)}px) scale(${(.4+.6*e).toFixed(3)})`, op=clamp(u*2.5).toFixed(3);
    [LF[i],LB[i]].forEach(s=>{s.style.opacity=op; s.style.transform=tr;});
  }
}

/* ------------------------------------------------------------------ salida hacia el sitio */
const intro=$('intro'), coral=$('coral'), sitio=$('sitio');
let done=false, raf=0, hold=0;
function entrar(){
  if(done) return; done=true; cancelAnimationFrame(raf); clearTimeout(hold);
  document.body.classList.remove('intro-activo');
  if(reduce){ coral.remove(); intro.classList.add('fundido'); }
  else { intro.classList.add('salir'); coral.classList.add('salir'); }
  setTimeout(()=>{document.body.classList.add('listo'); dispatchEvent(new Event('intro:listo'));}, reduce?100:550);
  setTimeout(()=>{ intro.remove(); coral.remove(); try{ sitio.inert=false; }catch(e){} }, reduce?600:1200);
}
$('saltar').addEventListener('click',entrar);
addEventListener('keydown',e=>{ if(e.key==='Escape') entrar(); });

/* ------------------------------------------------------------------ arranque */
function play(){
  if(reduce){ render(END+1); hold=setTimeout(entrar,1400); return; }
  let t0=null;
  const loop=now=>{
    if(t0===null) t0=now;
    const t=(now-t0)/1000;
    render(t);
    if(t>=END){ render(END+1); hold=setTimeout(entrar,CFG.espera*1000); return; }
    raf=requestAnimationFrame(loop);
  };
  raf=requestAnimationFrame(loop);
}
async function boot(){
  try{ await Promise.race([document.fonts.load('800 100px Outfit'), new Promise(r=>setTimeout(r,1200))]); }catch(e){}
  let visto=false;                               // no repetir en la misma pestaña (usar ?intro para verla de nuevo)
  try{ visto=sessionStorage.getItem('hg-intro')==='1' && !/[?&]intro/.test(location.search); }catch(e){}
  if(visto && !window.__introManual){
    intro.remove(); coral.remove(); document.body.classList.remove('intro-activo'); document.body.classList.add('listo');
    dispatchEvent(new Event('intro:listo')); return;
  }
  try{ sessionStorage.setItem('hg-intro','1'); }catch(e){}
  try{ sitio.inert=true; }catch(e){}
  layout();
  addEventListener('resize',layout);
  window.__intro={seek:t=>render(t),end:END};     // opcional: para probar tiempos (__intro.seek(1.5) en la consola)
  if(!window.__introManual) play();
}
boot();
})();

// Interacciones del sitio: año, copiar email, menú, revelado al hacer scroll.
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const email = 'hannaguzman611@gmail.com';

  $('#year').textContent = new Date().getFullYear();

  /* ---- Copiar email ---- */
  const btn = $('#copyEmailBtn'), status = $('#copyStatus'), toast = $('#toast');
  let tt;
  const aviso = msg => {
    status.textContent = msg; toast.textContent = msg; toast.classList.add('on');
    clearTimeout(tt); tt = setTimeout(() => { toast.classList.remove('on'); status.textContent = ''; }, 2200);
  };
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(email);
      btn.textContent = 'Email copiado';
      aviso('Email copiado al portapapeles');
      setTimeout(() => { btn.textContent = 'Copiar email'; }, 2200);
    } catch (e) {
      aviso('No se pudo copiar. Usá el enlace de email.');
    }
  });

  /* ---- Menú: sombra al bajar + sección activa ---- */
  const nav = $('#nav');
  const onScroll = () => nav.classList.toggle('scrolled', scrollY > 10);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  const links = [...document.querySelectorAll('.nav-links a:not(.nav-cta)')];
  if ('IntersectionObserver' in window) {
    const secs = links.map(a => $(a.getAttribute('href'))).filter(Boolean);
    const spy = new IntersectionObserver(es => {
      es.forEach(e => {
        if (e.isIntersecting) links.forEach(a => a.classList.toggle('activo', a.getAttribute('href') === '#' + e.target.id));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    secs.forEach(s => spy.observe(s));
  }

  /* ---- Revelar elementos (espera a que termine la entrada animada) ---- */
  let iniciado = false;
  const iniciar = () => {
    if (iniciado) return; iniciado = true;
    const items = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) { items.forEach(i => i.classList.add('in')); return; }
    const io = new IntersectionObserver(es => {
      es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: .12, rootMargin: '0px 0px -6% 0px' });
    items.forEach(i => io.observe(i));
  };
  addEventListener('intro:listo', iniciar);
  if (document.body.classList.contains('listo')) iniciar();

  /* ---- Seguridad: si la entrada tardara demasiado, se salta sola ---- */
  setTimeout(() => {
    const s = $('#saltar');
    if (document.getElementById('intro') && !document.body.classList.contains('listo')) s && s.click();
  }, 12000);
})();
