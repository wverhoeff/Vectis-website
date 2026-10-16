const svg = document.querySelector('#structure');
const visual = document.querySelector('.structural-visual');
const toggle = document.querySelector('#motion-toggle');

if (svg && visual && toggle) {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const baseYaw = .64;
  const paths = [...svg.querySelectorAll('[data-points]')].map(element => ({
    element,
    points: element.dataset.points.split(';').map(point => point.split(',').map(Number)),
    closed: element.dataset.closed === 'true',
    scan: element.parentElement.id === 'scan',
  }));
  const scanPaths = paths.filter(item => item.scan);
  const dots = [...svg.querySelectorAll('[data-point]')].map(element => ({element, point:element.dataset.point.split(',').map(Number)}));
  let yaw=baseYaw, targetYaw=baseYaw, paused=false, inView=false, frame=null, lastTime=0, elapsed=0;
  function project([x,y,z]) {
    return [405+(x*Math.cos(yaw)+z*Math.sin(yaw))*1.12,505-y*1.04+(z*Math.cos(yaw)-x*Math.sin(yaw))*.42];
  }
  function drawPath(item,height) {
    const points=item.points.map(p=>project(item.scan?[p[0],height,p[2]]:p));
    item.element.setAttribute('d','M'+points.map(([x,y])=>`${x.toFixed(2)},${y.toFixed(2)}`).join('L')+(item.closed?'Z':''));
  }
  function drawAll(height=168) {
    paths.forEach(item=>drawPath(item,height));
    dots.forEach(({element,point})=>{const [x,y]=project(point);element.setAttribute('cx',x.toFixed(2));element.setAttribute('cy',y.toFixed(2));});
  }
  const canRun=()=>!paused&&!reduceMotion.matches&&inView&&!document.hidden;
  function animate(time) {
    frame=null;
    if(!canRun()){lastTime=0;return;}
    const delta=lastTime?Math.min(time-lastTime,64):0;
    elapsed+=delta;lastTime=time;
    const height=168+Math.sin(elapsed*.00023)*140;
    if(Math.abs(targetYaw-yaw)>.0002){yaw+=(targetYaw-yaw)*(1-Math.exp(-delta/180));drawAll(height);}
    else scanPaths.forEach(item=>drawPath(item,height));
    frame=requestAnimationFrame(animate);
  }
  function reconcile() {
    toggle.hidden=reduceMotion.matches;
    if(frame!==null)cancelAnimationFrame(frame);
    frame=null;lastTime=0;
    if(reduceMotion.matches){yaw=targetYaw=baseYaw;drawAll();}
    if(canRun())frame=requestAnimationFrame(animate);
  }
  toggle.addEventListener('click',()=>{
    paused=!paused;
    toggle.textContent=paused?'Resume motion ▷':'Pause motion Ⅱ';
    reconcile();
  });
  visual.addEventListener('pointermove',event=>{
    if(!canRun()||!finePointer.matches)return;
    const bounds=visual.getBoundingClientRect();
    targetYaw=baseYaw+Math.max(-.5,Math.min(.5,(event.clientX-bounds.left)/bounds.width-.5))*.55;
  });
  visual.addEventListener('pointerleave',()=>{targetYaw=baseYaw;});
  if('IntersectionObserver' in window)new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;reconcile();},{threshold:.05}).observe(visual);
  else inView=true;
  reduceMotion.addEventListener('change',reconcile);
  document.addEventListener('visibilitychange',reconcile);
  reconcile();
}
