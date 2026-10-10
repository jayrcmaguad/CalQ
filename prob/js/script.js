import { DISTRIBUTIONS } from './distributions.js';

const $ = s => document.querySelector(s);
const select = $('#distributionSelect'), form = $('#parameterForm'), typeBadge = $('#typeBadge');
const eventSelect = $('#eventSelect'), lower = $('#lowerInput'), upper = $('#upperInput');
const canvas = $('#plotCanvas'), ctx = canvas.getContext('2d');
let current = null, params = {}, plotState = {zoom:1,center:0,drag:false,lastX:0};

// =========================================================
// ASSET SHORTCUT
// Add a formula/<id>.js and optional css/plots/<id>.css file.
// No change to index.html, style.css, or this file is required.
// The distribution manifest is the only registry because browsers cannot
// enumerate a directory from a static website for security reasons.
// =========================================================
async function loadDistributionAssets(id){
  const formula = await import(`../formula/${id}.js`);
  const old = document.getElementById('plot-style');
  if(old) old.remove();
  const link = document.createElement('link'); link.id='plot-style'; link.rel='stylesheet'; link.href=`../css/plots/${id}.css`;
  link.onerror=()=>link.remove(); document.head.appendChild(link);
  return formula.default;
}

function fmt(x){ if(!Number.isFinite(x)) return 'undefined'; const a=Math.abs(x); if(a!==0 && (a<1e-6||a>=1e9)) return x.toExponential(6); return Number(x.toPrecision(10)).toString(); }
function clamp(v,a,b){return Math.min(b,Math.max(a,v));}
function logGamma(z){
  const c=[676.5203681218851,-1259.1392167224028,771.32342877765313,-176.61502916214059,12.507343278686905,-0.13857109526572012,9.9843695780195716e-6,1.5056327351493116e-7];
  if(z<0.5)return Math.log(Math.PI)-Math.log(Math.sin(Math.PI*z))-logGamma(1-z);
  z-=1; let x=0.9999999999998099; for(let i=0;i<c.length;i++)x+=c[i]/(z+i+1); const t=z+c.length-.5; return .5*Math.log(2*Math.PI)+(z+.5)*Math.log(t)-t+Math.log(x);
}
function gamma(z){return Math.exp(logGamma(z));}
function erf(x){const s=x<0?-1:1; x=Math.abs(x); const t=1/(1+.3275911*x); const y=1-((((1.061405429*t-1.453152027)*t+1.421413741)*t-.284496736)*t+.254829592)*t*Math.exp(-x*x); return s*y;}
function stdNormalCDF(x){return .5*(1+erf(x/Math.SQRT2));}
function poissonLogPMF(k,l){return k<0||!Number.isInteger(k)?-Infinity:k*Math.log(l)-l-logGamma(k+1);}
function binomialLogPMF(k,n,p){return k<0||k>n||!Number.isInteger(k)?-Infinity:logGamma(n+1)-logGamma(k+1)-logGamma(n-k+1)+k*Math.log(p)+(n-k)*Math.log1p(-p);}
function readParams(){
  params={}; current.params.forEach(([id,,def,min,max])=>{let el=document.getElementById('p-'+id); let v=Number(el.value); if(id==='n'||id==='N'||id==='K'||id==='r'||id==='a'||id==='b')v=Math.round(v); params[id]=v;});
  if(current.id==='gamma' && params.rate<=0) params.rate=1;
}
function renderForm(){
  form.innerHTML=''; current.params.forEach(([id,label,def,min,max])=>{
    const wrap=document.createElement('label'); wrap.className='field'; wrap.innerHTML=`<span>${label}</span><input id="p-${id}" type="number" step="any" value="${def}" ${min!==undefined?`min="${min}"`:''} ${max!==undefined?`max="${max}"`:''}>`; form.appendChild(wrap);
  });
  if(current.id==='gamma'){
    const rate=document.getElementById('p-rate'), scale=document.getElementById('p-scale');
    const note=document.createElement('div'); note.className='field'; note.innerHTML='<span>Gamma parameterization</span><div class="type-badge">Rate β / Scale θ are reciprocals</div>'; form.appendChild(note);
    rate.addEventListener('input',()=>{if(document.activeElement===rate)scale.value=fmt(1/Math.max(1e-12,Number(rate.value)));});
    scale.addEventListener('input',()=>{if(document.activeElement===scale)rate.value=fmt(1/Math.max(1e-12,Number(scale.value)));});
  }
  form.querySelectorAll('input').forEach(i=>i.addEventListener('input',update));
}
function renderEvents(){
  const discrete=current.type==='discrete';
  eventSelect.innerHTML=discrete?`<option value="eq">P(X = x)</option><option value="lt">P(X &lt; x)</option><option value="gt">P(X &gt; x)</option><option value="le">P(X ≤ x)</option><option value="ge">P(X ≥ x)</option><option value="betweenClosed">P(a ≤ X ≤ b)</option><option value="betweenOpen">P(a &lt; X &lt; b)</option>`:`<option value="eq">P(X = x)</option><option value="lt">P(X &lt; x)</option><option value="gt">P(X &gt; x)</option><option value="le">P(X ≤ x)</option><option value="ge">P(X ≥ x)</option><option value="betweenClosed">P(a ≤ X ≤ b)</option><option value="betweenOpen">P(a &lt; X &lt; b)</option>`;
  lower.value=discrete?'0':'-1'; upper.value=discrete?'10':'1'; updateEventFields();
}
function updateEventFields(){
  const between=eventSelect.value.startsWith('between');
  const lowerLabel=$('#lowerField span');
  const upperLabel=$('#upperField span');
  if(between){
    $('#lowerField').style.display='flex';
    $('#upperField').style.display='flex';
    lowerLabel.textContent='Lower x (a)';
    upperLabel.textContent='Upper x (b)';
    if(lower.value==='') lower.value='0';
    if(upper.value==='') upper.value='1';
  }else{
    $('#lowerField').style.display='flex';
    $('#upperField').style.display='none';
    lowerLabel.textContent='x';
    if(lower.value==='') lower.value='0';
  }
}
function getStats(){return current.module.stats(params);}
function update(){try{readParams(); current.module.validate?.(params); renderStats(); drawPlot(); calculateProbability();}catch(e){$('#probabilityResult').textContent=e.message;}}
function renderStats(){const s=getStats(); $('#statsGrid').innerHTML=Object.entries(s).map(([k,v])=>`<div class="stat"><div class="stat-name">${k}</div><div class="stat-value ${k==='MGF'?'formula':''}">${typeof v==='string'?v:fmt(v)}</div></div>`).join('');}
function calculateProbability(){try{readParams(); const op=eventSelect.value,a=Number(lower.value),b=Number(upper.value); let p; if(op==='eq')p=current.type==='discrete'?(current.module.pmf(a,params)||0):0; if(op==='lt')p=current.module.cdf(a,false,params); if(op==='le')p=current.module.cdf(a,true,params); if(op==='gt')p=1-current.module.cdf(a,true,params); if(op==='ge')p=1-current.module.cdf(a,false,params); if(op==='betweenClosed')p=current.module.cdf(b,true,params)-current.module.cdf(a,false,params); if(op==='betweenOpen')p=current.module.cdf(b,false,params)-current.module.cdf(a,true,params); $('#probabilityResult').textContent=`P = ${fmt(clamp(p,0,1))}`;}catch(e){$('#probabilityResult').textContent=e.message;}}
function resizeCanvas(){const r=canvas.getBoundingClientRect(),d=Math.max(1,Math.min(3,window.devicePixelRatio||1));const w=Math.max(1,Math.floor(r.width)),h=Math.max(1,Math.floor(r.height));canvas.width=w*d;canvas.height=h*d;canvas.style.width=w+'px';canvas.style.height=h+'px';ctx.setTransform(d,0,0,d,0,0);drawPlot();}
function niceStep(raw){const p=10**Math.floor(Math.log10(raw));const n=raw/p;const m=n<=1?1:n<=2?2:n<=5?5:10;return m*p;}
function drawPlot(){if(!current?.module)return; const r=canvas.getBoundingClientRect(),w=r.width,h=r.height; if(w<2||h<2)return; ctx.clearRect(0,0,w,h); const st=current.module.domain(params), center=plotState.center, span=(st.span||10)/plotState.zoom; const xMin=center-span/2,xMax=center+span/2; const left=48,right=14,top=22,bottom=38, pw=w-left-right,ph=h-top-bottom; const xPix=x=>left+(x-xMin)/(xMax-xMin)*pw; const yBase=top+ph*.72; const rawMaxY=current.module.plotMax(params,xMin,xMax); const maxY=Number.isFinite(rawMaxY)&&rawMaxY>0?rawMaxY:1; const yPix=y=>yBase-(y/(maxY||1))*ph*.62;
  ctx.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue('--border').trim();ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(left,yBase+.5);ctx.lineTo(w-right,yBase+.5);ctx.stroke();
  const step=niceStep((xMax-xMin)/8); ctx.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--text-faint').trim();ctx.font='10px system-ui';ctx.textAlign='center';ctx.textBaseline='top';
  const first=Math.ceil(xMin/step)*step; for(let x=first;x<=xMax+step*.01;x+=step){const px=xPix(x);ctx.beginPath();ctx.moveTo(px,yBase);ctx.lineTo(px,yBase+5);ctx.stroke();ctx.fillText(String(Math.round(x)),px,yBase+8);}
  if(current.type==='discrete') drawDiscrete(xPix,yPix,xMin,xMax,maxY,yBase); else drawContinuous(xPix,yPix,xMin,xMax,maxY,yBase);
}
function drawDiscrete(xPix,yPix,xMin,xMax,maxY,yBase){const c=getComputedStyle(document.documentElement).getPropertyValue('--text').trim(); const accent=getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(); const lo=Math.ceil(xMin),hi=Math.floor(xMax); ctx.strokeStyle=accent;ctx.fillStyle=accent;ctx.lineWidth=2; for(let k=lo;k<=hi;k++){const y=current.module.pmf(k,params);if(y<=0)continue;const x=xPix(k);ctx.beginPath();ctx.moveTo(x,yBase);ctx.lineTo(x,yPix(y));ctx.stroke();ctx.beginPath();ctx.arc(x,yPix(y),3.2,0,Math.PI*2);ctx.fill();} ctx.fillStyle=c;ctx.font='11px system-ui';ctx.textAlign='left';ctx.fillText('PMF',8,13);}
function drawContinuous(xPix,yPix,xMin,xMax,maxY,yBase){const accent=getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(); const steps=420; const vals=[];for(let i=0;i<=steps;i++){const x=xMin+(xMax-xMin)*i/steps; vals.push([x,current.module.pdf(x,params)]);} ctx.fillStyle='color-mix(in srgb,var(--accent) 20%,transparent)';ctx.beginPath();ctx.moveTo(xPix(vals[0][0]),yBase);for(const [x,y] of vals)ctx.lineTo(xPix(x),yPix(y));ctx.lineTo(xPix(vals[vals.length-1][0]),yBase);ctx.closePath();ctx.fill();ctx.strokeStyle=accent;ctx.lineWidth=2;ctx.beginPath();vals.forEach(([x,y],i)=>i?ctx.lineTo(xPix(x),yPix(y)):ctx.moveTo(xPix(x),yPix(y)));ctx.stroke();ctx.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--text').trim();ctx.font='11px system-ui';ctx.textAlign='left';ctx.fillText('PDF',8,13);
  // probability shading for the current event
  const op=eventSelect.value,a=Number(lower.value),b=Number(upper.value); let s1=-Infinity,s2=Infinity; if(op==='lt'||op==='le')s2=a;if(op==='gt'||op==='ge')s1=a;if(op.startsWith('between')){s1=a;s2=b;} if(Number.isFinite(s1)||Number.isFinite(s2)){ctx.fillStyle='color-mix(in srgb,var(--accent) 28%,transparent)';ctx.beginPath();const aa=Math.max(xMin,s1),bb=Math.min(xMax,s2); if(aa<bb){ctx.moveTo(xPix(aa),yBase);for(const [x,y] of vals)if(x>=aa&&x<=bb)ctx.lineTo(xPix(x),yPix(y));ctx.lineTo(xPix(bb),yBase);ctx.closePath();ctx.fill();}}
}
function setZoom(z,anchor){const old=plotState.zoom;plotState.zoom=clamp(z,.15,80); if(anchor!==undefined){const r=canvas.getBoundingClientRect(),left=48,right=14,w=r.width;const st=current.module.domain(params),oldSpan=(st.span||10)/old,newSpan=(st.span||10)/plotState.zoom;const xBefore=plotState.center-oldSpan/2+(anchor-left)/(w-left-right)*oldSpan;plotState.center=xBefore-(anchor-left)/(w-left-right)*newSpan;} drawPlot();}

select.innerHTML=DISTRIBUTIONS.map(d=>`<option value="${d.id}">${d.name}</option>`).join('');
select.addEventListener('change',async()=>{current=DISTRIBUTIONS.find(d=>d.id===select.value);current.module=await loadDistributionAssets(current.id);typeBadge.textContent=current.type==='discrete'?'Discrete':'Continuous';renderForm();renderEvents();plotState={zoom:1,center:0,drag:false,lastX:0};update();});
eventSelect.addEventListener('change',()=>{updateEventFields();drawPlot();calculateProbability();});
$('#calculateProbability').addEventListener('click',calculateProbability);[lower,upper].forEach(x=>x.addEventListener('input',()=>{calculateProbability();drawPlot();}));
$('#zoomIn').onclick=()=>setZoom(plotState.zoom*1.6);$('#zoomOut').onclick=()=>setZoom(plotState.zoom/1.6);$('#resetView').onclick=()=>{plotState.zoom=1;plotState.center=0;drawPlot();};
canvas.addEventListener('pointerdown',e=>{plotState.drag=true;plotState.lastX=e.clientX;canvas.classList.add('dragging');canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(!plotState.drag)return;const dx=e.clientX-plotState.lastX;plotState.lastX=e.clientX;const r=canvas.getBoundingClientRect(),pw=r.width-48-14,span=(current.module.domain(params).span||10)/plotState.zoom;plotState.center-=dx/pw*span;drawPlot();});
canvas.addEventListener('pointerup',()=>{plotState.drag=false;canvas.classList.remove('dragging');});
canvas.addEventListener('wheel',e=>{e.preventDefault();setZoom(plotState.zoom*(e.deltaY<0?1.18:1/1.18),e.offsetX);},{passive:false});
const plotResizeObserver=new ResizeObserver(()=>requestAnimationFrame(resizeCanvas)); plotResizeObserver.observe($('#plotWrap')); window.addEventListener('resize',()=>requestAnimationFrame(resizeCanvas));

$('#menuToggle').onclick=()=>{$('#sideMenu').classList.add('is-open');$('#menuBackdrop').classList.add('is-visible');$('#sideMenu').setAttribute('aria-hidden','false');};$('#menuBackdrop').onclick=closeMenu;function closeMenu(){$('#sideMenu').classList.remove('is-open');$('#menuBackdrop').classList.remove('is-visible');$('#sideMenu').setAttribute('aria-hidden','true');}
$('#settingsToggle').onclick=()=>{const e=$('#settingsContent'),hidden=e.hidden;e.hidden=!hidden;$('#settingsArrow').textContent=hidden?'⌃':'⌄';};$('#helpToggle').onclick=()=>{const e=$('#helpContent'),hidden=e.hidden;e.hidden=!hidden;$('#helpArrow').textContent=hidden?'⌃':'⌄';};
// =========================================================
// SHARED THEME SYNCHRONIZATION
// =========================================================

function applyDistributionTheme(theme, notifyShared = true) {
  const resolvedTheme =
    theme === 'auto'
      ? (matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light')
      : theme;

  document.documentElement.dataset.theme = resolvedTheme;

  // Keep the calculator's theme buttons synchronized.
  document.querySelectorAll('[data-theme]').forEach(button => {
    button.classList.toggle(
      'active',
      button.dataset.theme === theme
    );
  });

  // Notify the shared theme system when the user changes the theme.
  if (
    notifyShared &&
    typeof window.setCalQTheme === 'function'
  ) {
    window.setCalQTheme(theme);
  }

  drawPlot();
}

// Theme buttons
document.querySelectorAll('[data-theme]').forEach(button => {
  button.addEventListener('click', () => {
    applyDistributionTheme(button.dataset.theme);
  });
});

// Load the shared theme on startup when available.
const initialTheme =
  localStorage.getItem('calq-display-mode') ||
  localStorage.getItem('distribution-calculator-theme') ||
  'light';

applyDistributionTheme(initialTheme, false);

// Update the resolved theme when the device appearance changes.
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  const theme = localStorage.getItem('calq-display-mode') ||
                localStorage.getItem('distribution-calculator-theme') ||
                'light';

  if (theme === 'auto') {
    applyDistributionTheme('auto', false);
  }
});
select.value='discrete_uniform';select.dispatchEvent(new Event('change'));
setTimeout(resizeCanvas,50);
