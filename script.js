// Entrada animada: una estrella de puntas afiladas cae en la noche, cambia de azul a amarillo y a rosa,
// crea una onda suave y revela el nombre; el fondo se inunda de rosa y entra al sitio.
(() => {
'use strict';

/* ------------------------------------------------------------------
   AJUSTES RÁPIDOS
------------------------------------------------------------------ */
const CFG = {
  nombre:'Hanna Guzmán',
  subtitulo:'QA Tester & Frontend',
  rosa:[255,133,179],     // #FF85B3: color final del fondo (el rosa del sitio)
  tinta:[43,18,32],       // color del texto sobre el rosa
  espera:.7               // segundos que se queda todo completo antes de entrar al sitio
};
// Colores de la estrella según cuánto bajó (0 = arriba, 1 = al caer): azul → amarillo → rosa
const COLORES = [
  [0,   [91,157,255]],
  [.12, [91,157,255]],
  [.30, [214,234,255]],
  [.40, [255,248,230]],
  [.52, [255,214,107]],
  [.76, [255,172,130]],
  [1,   [255,133,179]]
];
// Tiempos en segundos
const T = { caida:.3, impacto:1.85, letras:2.2, paso:.065, sub:2.85, inundar:2.95, dur:.95 };
const END = T.inundar + T.dur;

/* ------------------------------------------------------------------ utilidades */
const $ = id => document.getElementById(id);
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t)};
const easeIO=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
const mixRGB=(a,b,t)=>[lerp(a[0],b[0],t),lerp(a[1],b[1],t),lerp(a[2],b[2],t)];
const rgba=(c,a=1)=>`rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;
const WHITE=[255,255,255];
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
const SKY=(()=>{const r=rng(7),a=[];for(let i=0;i<120;i++)a.push({x:r(),y:r(),r:.4+r()*1.1,a:.2+r()*.55,v:.7+r()*2,p:r()*6.28});return a})();

/* ------------------------------------------------------------------ lienzo y medidas */
const canvas=$('gl'), c=canvas.getContext('2d');
const nomEl=$('nomFrente'), subEl=$('sub');
function buildLetters(el,texto){
  const arr=[];
  for(const ch of texto){
    const s=document.createElement('span'); s.className='l'+(ch===' '?' sp':'');
    s.textContent = ch===' ' ? ' ' : ch; el.appendChild(s); arr.push({el:s,sp:ch===' ',cx:0,cy:0});
  }
  return arr;
}
const NOM=buildLetters(nomEl,CFG.nombre), SUB=buildLetters(subEl,CFG.subtitulo);
let L={}, lastT=0;

function layout(){
  const vw=document.documentElement.clientWidth||innerWidth, vh=innerHeight, dpr=Math.min(devicePixelRatio||1,2);
  const R=clamp(Math.min(vh*.135,vw*.23),44,118);
  let f=clamp(Math.min(vw*.062,vh*.066),20,56);
  const apply=()=>{ nomEl.style.fontSize=f+'px'; subEl.style.fontSize=(f*.36)+'px'; };
  apply();
  const first=NOM[0].el, last=NOM[NOM.length-1].el;
  const ancho=()=>last.offsetLeft+last.offsetWidth-first.offsetLeft;
  if(ancho()>vw*.86){ f*=vw*.86/ancho(); apply(); }
  const starH=R*1.81, g1=f*1.0, nameH=f*1.1, g2=f*.38, subH=f*.36*1.1;
  const top=(vh-(starH+g1+nameH+g2+subH))/2, yc=top+R, cx=vw/2;
  nomEl.style.top=(top+starH+g1)+'px'; subEl.style.top=(top+starH+g1+nameH+g2)+'px';
  [...NOM,...SUB].forEach(o=>{ const p=o.el.parentElement;
    o.cx=o.el.offsetLeft+o.el.offsetWidth/2; o.cy=p.offsetTop+o.el.offsetTop+o.el.offsetHeight/2; });
  L={vw,vh,dpr,R,f,cx,yc,y0:-R*.95,drift:Math.min(vw*.09,140),
     floodR:Math.hypot(Math.max(cx,vw-cx),Math.max(yc,vh-yc))+12, maxR:Math.hypot(vw,vh)*.55};
  canvas.width=Math.round(vw*dpr); canvas.height=Math.round(vh*dpr);
  render(lastT);
}

/* ------------------------------------------------------------------ posición de la estrella en la caída */
function pos(tt){
  const u=clamp((tt-T.caida)/(T.impacto-T.caida)), e=Math.pow(u,1.7);
  return {u, e, x:L.cx+L.drift*Math.pow(1-u,1.4), y:lerp(L.y0,L.yc,e), sc:lerp(.85,1,e), rot:-(1-u)*Math.PI*.55};
}

/* ------------------------------------------------------------------ estrella de puntas afiladas, con facetas (efecto gema) */
const RATIO=.43;
function drawStar(x,y,R,rot,s,rgb,glow,p){
  const q=1-p, base=mixRGB(rgb,WHITE,p);
  const luz=mixRGB(base,WHITE,.5*q), sombra=mixRGB(base,[60,20,40],.18+.14*q);
  c.save(); c.translate(x,y);
  if(glow>0){
    c.globalCompositeOperation='lighter';
    const h=c.createRadialGradient(0,0,R*.2,0,0,R*2.6);
    h.addColorStop(0,rgba(rgb,.42*glow)); h.addColorStop(1,rgba(rgb,0));
    c.fillStyle=h; c.beginPath(); c.arc(0,0,R*2.6,0,7); c.fill();
    c.globalCompositeOperation='source-over';
  }
  c.rotate(rot); c.scale(s,s);
  const P=[]; for(let i=0;i<10;i++){const r=i%2?R*RATIO:R,a=-Math.PI/2+i*Math.PI/5;P.push([Math.cos(a)*r,Math.sin(a)*r]);}
  c.beginPath(); P.forEach((pt,i)=>i?c.lineTo(pt[0],pt[1]):c.moveTo(pt[0],pt[1])); c.closePath();
  if(glow>0){ c.shadowColor=rgba(rgb,.85*glow); c.shadowBlur=R*.6*L.dpr; }
  c.fillStyle=rgba(base); c.fill(); c.shadowBlur=0; c.shadowColor='transparent';
  c.lineJoin='round'; c.lineWidth=.7;
  for(let i=0;i<10;i+=2){
    const tip=P[i], a=P[(i+9)%10], b=P[(i+1)%10];
    [a,b].forEach(v=>{
      const mx=(tip[0]+v[0])/3, my=(tip[1]+v[1])/3, m=Math.hypot(mx,my)||1;
      const sh=.5+.5*((mx/m)*-.55+(my/m)*-.83);
      const col=rgba(mixRGB(sombra,luz,clamp(sh*1.15)));
      c.fillStyle=col; c.strokeStyle=col;
      c.beginPath(); c.moveTo(0,0); c.lineTo(tip[0],tip[1]); c.lineTo(v[0],v[1]); c.closePath(); c.fill(); c.stroke();
    });
  }
  c.restore();
  if(glow>0){
    c.save(); c.translate(x,y); c.globalCompositeOperation='lighter';
    const fa=.3*Math.min(glow,1.3), sz=R*2.5*s;
    c.save(); c.scale(1,.035); let g=c.createRadialGradient(0,0,0,0,0,sz); g.addColorStop(0,`rgba(255,255,255,${fa})`); g.addColorStop(1,'rgba(255,255,255,0)'); c.fillStyle=g; c.beginPath(); c.arc(0,0,sz,0,7); c.fill(); c.restore();
    c.save(); c.scale(.035,1); g=c.createRadialGradient(0,0,0,0,0,sz*.75); g.addColorStop(0,`rgba(255,255,255,${fa*.8})`); g.addColorStop(1,'rgba(255,255,255,0)'); c.fillStyle=g; c.beginPath(); c.arc(0,0,sz*.75,0,7); c.fill(); c.restore();
    c.restore();
  }
}

/* ------------------------------------------------------------------ dibujo de cada cuadro */
const intro=$('intro'), coral=$('coral'), sitio=$('sitio');
function render(t){
  lastT=t;
  const {vw,vh,dpr,R,cx,yc}=L;
  c.setTransform(dpr,0,0,dpr,0,0);

  const g=c.createRadialGradient(vw/2,vh*.4,0,vw/2,vh*.4,Math.max(vw,vh)*.8);
  g.addColorStop(0,'#12102a'); g.addColorStop(1,'#04030a');
  c.fillStyle=g; c.fillRect(0,0,vw,vh);
  const fin=smooth(0,.7,t);
  c.fillStyle='#fff';
  for(const s of SKY){
    c.globalAlpha=fin*s.a*(.55+.45*Math.sin(t*s.v+s.p));
    c.beginPath(); c.arc(s.x*vw,s.y*vh,s.r,0,6.283); c.fill();
  }
  c.globalAlpha=1;

  const hv=t-T.impacto;

  if(hv>0){
    const fv=clamp(hv/1.1), fe=1-Math.pow(1-fv,3);
    if(fv<1){
      c.globalCompositeOperation='lighter';
      const rr=lerp(R,R*5.5,fe), gg=c.createRadialGradient(cx,yc,0,cx,yc,rr);
      gg.addColorStop(0,rgba(CFG.rosa,.34*(1-fv))); gg.addColorStop(1,rgba(CFG.rosa,0));
      c.fillStyle=gg; c.beginPath(); c.arc(cx,yc,rr,0,7); c.fill();
      c.globalCompositeOperation='source-over';
    }
    for(let i=0;i<3;i++){
      const v=(t-(T.impacto+i*.22))/1.7;
      if(v<=0||v>=1) continue;
      const e=1-Math.pow(1-v,3), r=lerp(R*.8,L.maxR,e), a=Math.pow(1-v,1.6);
      c.beginPath(); c.arc(cx,yc,r,0,7);
      c.lineWidth=lerp(14,6,v); c.strokeStyle=rgba(CFG.rosa,a*.05); c.stroke();
      c.lineWidth=lerp(1.6,.7,v); c.strokeStyle=rgba(mixRGB(CFG.rosa,WHITE,.35),a*.6); c.stroke();
    }
  }

  const fl=clamp((t-T.inundar)/T.dur), rr=fl>=1?1e5:easeIO(fl)*L.floodR;
  if(fl>0){
    c.fillStyle=rgba(CFG.rosa); c.beginPath();
    if(fl>=1) c.rect(0,0,vw,vh); else c.arc(cx,yc,rr,0,7);
    c.fill();
    const vg=c.createRadialGradient(cx,yc,0,cx,yc,Math.max(vw,vh)*.75);
    vg.addColorStop(0,`rgba(255,255,255,${.2*easeIO(fl)})`); vg.addColorStop(1,'rgba(255,255,255,0)');
    c.fillStyle=vg; c.fill();
  }
  intro.classList.toggle('sobre-rosa', fl>.55);

  const trailOn=1-smooth(T.impacto,T.impacto+.12,t);
  if(trailOn>0 && t>T.caida){
    c.globalCompositeOperation='lighter'; c.lineCap='round';
    let prev=pos(t);
    for(let k=1;k<=22;k++){
      const tt=t-k*.022; if(tt<T.caida) break;
      const ps=pos(tt), f=1-k/23, col=colorAt(ps.e);
      c.beginPath(); c.moveTo(prev.x,prev.y-R*.05); c.lineTo(ps.x,ps.y-R*.05);
      c.lineWidth=R*.2*f; c.strokeStyle=rgba(col,Math.pow(f,1.7)*.42*trailOn); c.stroke();
      c.lineWidth=Math.max(.6,R*.05*f); c.strokeStyle=rgba(mixRGB(col,WHITE,.7),Math.pow(f,1.3)*.8*trailOn); c.stroke();
      prev=ps;
    }
    c.globalCompositeOperation='source-over';
  }

  const ps=pos(t), col=colorAt(ps.e);
  const pulso=(hv>0&&hv<.5)?1+.06*Math.sin(Math.PI*hv/.5):1;
  const p=smooth(T.inundar+.2,T.inundar+.8,t);
  const glow=(1-p)*(1+(hv>0?.8*Math.max(0,1-hv/.7):0));
  drawStar(ps.x,ps.y,R,ps.rot,ps.sc*pulso,col,glow,p);

  const writ=(arr,t0,paso,alfa)=>{
    let n=0;
    arr.forEach(o=>{
      if(o.sp) return;
      const u=clamp((t-(t0+n*paso))/.75); n++;
      const e=1-Math.pow(1-u,3);
      const d=Math.hypot(o.cx-cx,o.cy-yc), k=fl>0?smooth(0,1,(rr-(d-30))/60):0;
      const s=o.el.style, cc=mixRGB(WHITE,CFG.tinta,k);
      s.opacity=(e*alfa).toFixed(3);
      s.transform=`translateY(${((1-e)*L.f*.35).toFixed(2)}px)`;
      s.filter=u<1?`blur(${((1-e)*7).toFixed(1)}px)`:'none';
      s.color=rgba(cc);
    });
  };
  writ(NOM,T.letras,T.paso,1);
  writ(SUB,T.sub,.045,.85);
}

/* ------------------------------------------------------------------ salida hacia el sitio */
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
  try{ await Promise.race([Promise.all([document.fonts.load('300 40px Outfit'),document.fonts.load('400 20px Outfit')]), new Promise(r=>setTimeout(r,1200))]); }catch(e){}
  // La animación se muestra SIEMPRE, en cada carga o recarga de la página.
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

  const links = [...document.querySelectorAll('.nav-links a')];
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

// Carrusel 3D de proyectos + sección de detalle
(() => {
  'use strict';
  const stage = document.getElementById('cfStage'); if (!stage) return;
  const cards = [...stage.querySelectorAll('.cf-card')];
  const dots = [...document.querySelectorAll('#cfDots i')];
  const prev = document.getElementById('cfPrev'), next = document.getElementById('cfNext');
  const detalle = document.getElementById('detalle');
  const items = [...detalle.querySelectorAll('.detalle-item')];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const nombres = ['Ticket Cine', 'Applica', 'Próximo proyecto'];
  let act = 1, arrastro = false, x0 = null;

  // si una captura no existe todavía, se ve el degradado con el nombre
  document.querySelectorAll('.cf-img img, .shot img').forEach(im => im.addEventListener('error', () => im.remove()));

  function colocar() {
    const w = cards[0].offsetWidth;
    cards.forEach((c, i) => {
      const o = i - act, a = Math.abs(o), s = Math.sign(o);
      c.style.transform = o === 0
        ? 'translate3d(0,0,70px) scale(1.04)'
        : `translate3d(${o * w * .64}px,0,${-130 * a}px) rotateY(${-s * 50}deg) scale(.92)`;
      c.style.opacity = a > 2 ? 0 : 1;
      c.style.zIndex = 10 - a;
      c.style.filter = o === 0 ? 'none' : 'brightness(.72) saturate(.9)';
      c.classList.toggle('is-active', o === 0);
      c.setAttribute('aria-current', o === 0 ? 'true' : 'false');
      c.setAttribute('aria-label', o === 0 ? (c.dataset.id ? nombres[i] + ', ver detalles' : nombres[i]) : 'Ir a ' + nombres[i]);
      c.tabIndex = o === 0 ? 0 : -1;
    });
    dots.forEach((d, i) => d.classList.toggle('on', i === act));
    prev.setAttribute('aria-disabled', act === 0);
    next.setAttribute('aria-disabled', act === cards.length - 1);
  }
  const ir = i => { act = Math.max(0, Math.min(cards.length - 1, i)); colocar(); };

  function abrir(id) {
    items.forEach(it => { it.hidden = it.dataset.id !== id; });
    detalle.hidden = false;
    const h = items.find(it => !it.hidden).querySelector('h2');
    detalle.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    setTimeout(() => { try { h.focus({ preventScroll: true }); } catch (e) {} }, reduce ? 0 : 600);
  }

  cards.forEach((c, i) => c.addEventListener('click', () => {
    if (arrastro) { arrastro = false; return; }
    if (i !== act) ir(i);
    else if (c.dataset.id) abrir(c.dataset.id);
  }));
  prev.addEventListener('click', () => ir(act - 1));
  next.addEventListener('click', () => ir(act + 1));
  document.getElementById('carrusel').addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') { ir(act - 1); cards[act].focus(); }
    if (e.key === 'ArrowRight') { ir(act + 1); cards[act].focus(); }
  });

  // deslizar con el dedo o el mouse
  stage.addEventListener('pointerdown', e => { x0 = e.clientX; arrastro = false; });
  stage.addEventListener('pointerup', e => {
    if (x0 === null) return;
    const dx = e.clientX - x0; x0 = null;
    if (Math.abs(dx) > 45) { arrastro = true; ir(act + (dx < 0 ? 1 : -1)); }
  });
  stage.addEventListener('pointercancel', () => { x0 = null; });

  detalle.querySelectorAll('.volver').forEach(b => b.addEventListener('click', () => {
    document.getElementById('proyectos').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    setTimeout(() => { detalle.hidden = true; }, reduce ? 0 : 800);
  }));

  addEventListener('resize', colocar);
  colocar();
})();

// Modo claro / oscuro (sol y luna)
(() => {
  'use strict';
  const root = document.documentElement, btn = document.getElementById('themeBtn');
  const meta = document.querySelector('meta[name="theme-color"]');
  const aplicar = (modo, guardar) => {
    root.dataset.theme = modo;
    btn.setAttribute('aria-pressed', String(modo === 'dark'));
    btn.setAttribute('aria-label', modo === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
    if (meta) meta.setAttribute('content', modo === 'dark' ? '#06040f' : '#FF85B3');
    if (guardar) { try { localStorage.setItem('hg-theme', modo); } catch (e) {} }
    dispatchEvent(new Event('themechange'));
  };
  aplicar(root.dataset.theme === 'dark' ? 'dark' : 'light', false);
  btn.addEventListener('click', () => aplicar(root.dataset.theme === 'dark' ? 'light' : 'dark', true));
})();

// Cielo de estrellas del fondo (se adapta al tema, con estrellas fugaces en modo oscuro)
(() => {
  'use strict';
  const cv = document.getElementById('stars'); if (!cv) return;
  const x = cv.getContext('2d'), root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W, H, dpr, stars = [], shoots = [], mx = 0, my = 0, tmx = 0, tmy = 0;

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const n = Math.min(Math.round(W * H / 9000), 220);
    stars = Array.from({ length: n }, () => ({
      x: Math.random(), y: Math.random(), r: .4 + Math.random() * 1.4, z: .2 + Math.random() * .8,
      v: .5 + Math.random() * 2, p: Math.random() * 6.28, h: Math.random()
    }));
    if (reduce) frame(0);
  }

  function frame(ms) {
    const dark = root.dataset.theme === 'dark', t = ms / 1000;
    mx += (tmx - mx) * .05; my += (tmy - my) * .05;
    x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, W, H);
    for (const s of stars) {
      const px = s.x * W + mx * s.z * 16, py = s.y * H + my * s.z * 16;
      const tw = .5 + .5 * Math.sin(t * s.v + s.p);
      let rgb;
      if (dark) rgb = s.h < .33 ? '0,240,255' : s.h < .66 ? '255,92,203' : '215,200,255';
      else rgb = s.h < .5 ? '238,99,70' : '123,77,255';
      const a = (dark ? .35 + .65 * tw : .16 + .3 * tw);
      x.fillStyle = `rgba(${rgb},${a.toFixed(3)})`;
      x.beginPath(); x.arc(px, py, s.r, 0, 6.283); x.fill();
      if (s.r > 1.45) {                           // destello en cruz para las más grandes
        x.strokeStyle = `rgba(${rgb},${(a * .8).toFixed(3)})`; x.lineWidth = .8;
        const l = s.r * 3.2 * (.6 + tw * .6);
        x.beginPath(); x.moveTo(px - l, py); x.lineTo(px + l, py); x.moveTo(px, py - l); x.lineTo(px, py + l); x.stroke();
      }
    }
    if (dark && !reduce) {                        // estrellas fugaces
      if (Math.random() < .006 && shoots.length < 2)
        shoots.push({ x: Math.random() * W * .8 + W * .2, y: Math.random() * H * .4, vx: -(6 + Math.random() * 5), vy: 3 + Math.random() * 3, l: 1 });
      shoots = shoots.filter(s => s.l > 0);
      for (const s of shoots) {
        const g = x.createLinearGradient(s.x, s.y, s.x - s.vx * 9, s.y - s.vy * 9);
        g.addColorStop(0, `rgba(0,240,255,${s.l})`); g.addColorStop(1, 'rgba(255,92,203,0)');
        x.strokeStyle = g; x.lineWidth = 1.6; x.lineCap = 'round';
        x.beginPath(); x.moveTo(s.x, s.y); x.lineTo(s.x - s.vx * 9, s.y - s.vy * 9); x.stroke();
        s.x += s.vx; s.y += s.vy; s.l -= .012;
      }
    }
    if (!reduce) requestAnimationFrame(frame);
  }

  addEventListener('resize', resize);
  addEventListener('themechange', () => { if (reduce) frame(0); });
  addEventListener('pointermove', e => { tmx = e.clientX / W - .5; tmy = e.clientY / H - .5; }, { passive: true });
  resize();
  if (!reduce) requestAnimationFrame(frame);
})();
