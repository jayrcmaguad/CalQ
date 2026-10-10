const containersEl=document.getElementById('containers');
const palette=document.getElementById('casCommandPalette');
const paletteList=document.getElementById('casCommandPaletteList');
let state={items:[{id:1,input:'',approximate:false}],nextId:2,activeMenu:null,activePaletteButton:null,theme:localStorage.getItem('cas-theme')||'auto'};

function makeItem(input=''){return {id:state.nextId++,input,approximate:false}}
function rebuildDynamicDefinitions(){
  const definitions=[];
  for(const item of state.items){
    const source=String(item.input??'').trim();
    if(!source)continue;
    const normalized=typeof normalizeInput==='function'?normalizeInput(source):source;
    const match=normalized.match(/^([A-Za-z_]\w*)\s*=(?!=)(.*)$/s);
    if(match && match[2].trim() && !/^\s*(?:solve|solveeq|solveeqs|solvesystem)\s*\(/i.test(normalized)) definitions.push([match[1],match[2].trim()]);
  }
  window.CAS_ENGINE?.setDefinitions?.(definitions);
}
function refreshAllOutputs(){
  rebuildDynamicDefinitions();
  state.items.forEach(item=>{
    const card=containersEl.querySelector(`.calc-container[data-id="${item.id}"]`);
    const output=card?.querySelector('.output-preview');
    if(output)updateOutput(output,item.input,item.approximate);
  });
}
function render(){
  rebuildDynamicDefinitions();
  const focusedId=document.activeElement?.closest?.('.calc-container')?.dataset?.id;
  const oldValue=document.activeElement?.classList?.contains('cas-input')?document.activeElement.value:null;
  containersEl.innerHTML='';
  state.items.forEach((item,i)=>containersEl.appendChild(renderContainer(item,i)));
  renderSettingsCommands();
  if(focusedId){const idx=state.items.findIndex(x=>String(x.id)===String(focusedId));const el=idx>=0?containersEl.querySelectorAll('.cas-input')[idx]:null;if(el){el.focus();if(oldValue!==null)el.setSelectionRange(oldValue.length,oldValue.length)}}
}
function renderContainer(item,index){
  const card=document.createElement('section');
  card.className='calc-container'+(state.activeMenu===item.id?' is-active':'');
  card.dataset.id=item.id;

  const preview=document.createElement('div');preview.className='calc-row preview-row';
  const pslot=document.createElement('div');pslot.className='preview-slot';
  const p=document.createElement('div');p.className='input-preview';pslot.appendChild(p);preview.appendChild(pslot);card.appendChild(preview);

  const inputRow=document.createElement('div');inputRow.className='calc-row input-row';
  const wrap=document.createElement('div');wrap.className='cas-input-wrap';
  const badge=document.createElement('div');badge.className='index-badge';badge.textContent=index+1;
  const input=document.createElement('input');input.className='cas-input';input.value=item.input;input.autocomplete='off';input.spellcheck=false;
  wrap.append(badge,input);inputRow.appendChild(wrap);card.appendChild(inputRow);

  const out=document.createElement('div');out.className='calc-row output-row';
  const formatToggle=document.createElement('button');formatToggle.type='button';formatToggle.className='result-format-toggle';formatToggle.textContent=item.approximate?'≈':'=';formatToggle.setAttribute('aria-label',item.approximate?'Show exact result':'Show decimal approximation');formatToggle.title=item.approximate?'Show exact result':'Show decimal approximation';
  const os=document.createElement('div');os.className='output-slot';
  const op=document.createElement('div');op.className='output-preview';os.appendChild(op);out.append(formatToggle,os);card.appendChild(out);
  formatToggle.addEventListener('click',()=>{item.approximate=!item.approximate;formatToggle.textContent=item.approximate?'≈':'=';formatToggle.setAttribute('aria-label',item.approximate?'Show exact result':'Show decimal approximation');formatToggle.title=item.approximate?'Show exact result':'Show decimal approximation';updateOutput(op,item.input,item.approximate);});

  const actions=document.createElement('div');actions.className='container-actions';
  actions.innerHTML='<button class="container-action add" type="button">+add</button><button class="container-action remove" type="button">−</button><button class="container-action duplicate" type="button">⧉</button><button class="container-action menu" type="button">•••</button>';
  card.appendChild(actions);

  renderInputKatex(p,item.input);
  updateOutput(op,item.input,item.approximate);
  setupMathPan(os, op, 'output');
  setupMathPan(pslot, p, 'input');

  input.addEventListener('input',()=>{
    item.input=input.value;
    // Input preview is formatting-only. Evaluation happens only for the output.
    renderInputKatex(p,item.input);
    item.approximate=false;formatToggle.textContent='=';formatToggle.title='Show decimal approximation';formatToggle.setAttribute('aria-label','Show decimal approximation');
    refreshAllOutputs();
  });
  input.addEventListener('focus',()=>{if(state.activeMenu){state.activeMenu=null;palette.classList.remove('is-open');palette.setAttribute('aria-hidden','true');render()}});

  return card;
}
function setupMathPan(viewport, content, mode='output'){
  if(!viewport||!content)return;
  viewport.classList.add('math-pan-viewport');
  content.classList.add('math-pan-content');
  const sync=()=>{
    const max=Math.max(0,viewport.scrollWidth-viewport.clientWidth);
    if(mode==='output' && max>0 && viewport.scrollLeft===0) viewport.scrollLeft=max;
  };
  let dragging=false,startX=0,startScroll=0;
  viewport.addEventListener('pointerdown',e=>{
    if(viewport.scrollWidth<=viewport.clientWidth)return;
    dragging=true;startX=e.clientX;startScroll=viewport.scrollLeft;viewport.classList.add('is-dragging');viewport.setPointerCapture?.(e.pointerId);
  });
  viewport.addEventListener('pointermove',e=>{if(dragging){viewport.scrollLeft=startScroll-(e.clientX-startX);e.preventDefault();}});
  const up=e=>{dragging=false;viewport.classList.remove('is-dragging');try{viewport.releasePointerCapture?.(e.pointerId)}catch(_){} };
  viewport.addEventListener('pointerup',up);viewport.addEventListener('pointercancel',up);
  viewport.addEventListener('dblclick',()=>{viewport.scrollLeft=mode==='output'?Math.max(0,viewport.scrollWidth-viewport.clientWidth):0;});
  requestAnimationFrame(sync);
  if(window.ResizeObserver){const ro=new ResizeObserver(sync);ro.observe(viewport);ro.observe(content);}
}
function updateOutput(el,input,approximate=false){
  let result=input.trim()?window.CAS_ENGINE.eval(input):null;
  if(result&&approximate)result=window.CAS_ENGINE.approximate(result);
  // Show the live variable name as well as its current value, e.g. A = 14 or A = false.
  if(result?.assignment && !['matrix','chemistry','error'].includes(result.kind)){
    const rhs=String(result.value??'');
    const rhsTex=/^(true|false)$/i.test(rhs)?`\\text{${rhs}}`:formatBasicTex(rhs);
    result={...result,value:`${result.assignment} = ${rhs}`,raw:`${result.assignment} = ${String(result.raw??rhs)}`,tex:`${formatBasicTex(result.assignment)}\\,=\\,${rhsTex}`};
  }
  renderOutputKatex(el,result);
}
function focusItem(id){const idx=state.items.findIndex(x=>x.id===id);const el=containersEl.querySelectorAll('.cas-input')[idx];if(el){el.focus();el.setSelectionRange(el.value.length,el.value.length)}}
function groupHtml(group){
  const [category,items]=group;const wrap=document.createElement('div');wrap.className='cas-command-group';
  const title=document.createElement('div');title.className='cas-command-category';title.textContent=category;wrap.appendChild(title);
  const list=document.createElement('div');list.className='cas-command-group-list';
  items.forEach(([label,sig,key])=>{const b=document.createElement('button');b.type='button';b.className='cas-command-item';b.innerHTML=`<span class="cas-command-name">${label}()</span><span class="cas-command-signature">${sig}</span>`;b.onclick=()=>insertCommand(key);list.appendChild(b)});
  wrap.appendChild(list);return wrap;
}
function renderPalette(){paletteList.innerHTML='';CAS_COMMAND_GROUPS.forEach(g=>paletteList.appendChild(groupHtml(g)))}
function insertCommand(key){
  const item=state.items.find(x=>x.id===state.activeMenu);if(!item)return;
  const text=key==='solveSystem'?'solveeq()':key==='completeSquare'?'sqcomp()':key+'()';
  item.input=item.input?item.input+text:text;
  closePalette(true);render();focusItem(item.id);
}
function renderSettingsCommands(){
  const list=document.getElementById('settingsCommandList');list.innerHTML='';
  CAS_COMMAND_GROUPS.forEach(([category,items])=>{
    const heading=document.createElement('div');heading.className='command-category-title';heading.textContent=category;list.appendChild(heading);
    items.forEach(([label,sig])=>{const row=document.createElement('div');row.className='command-item';row.innerHTML=`<code>${label}()</code><span>${sig}</span>`;list.appendChild(row)});
  });
}
function getActivePaletteButton(){
  if(state.activePaletteButton?.isConnected)return state.activePaletteButton;
  if(state.activeMenu==null)return null;
  return containersEl.querySelector(`.calc-container[data-id="${state.activeMenu}"] .container-action.menu`);
}
function positionPalette(){
  if(!palette.classList.contains('is-open'))return;
  const button=getActivePaletteButton();if(!button)return;
  const r=button.getBoundingClientRect();
  const gap=7;
  // Always anchor the palette below the exact ••• button that opened it.
  // Never flip it above the button; that was the source of the inconsistent
  // placement near different parts of the viewport.
  const p=palette.getBoundingClientRect();
  const margin=8;
  let left=r.left;
  const maxLeft=Math.max(margin,window.innerWidth-p.width-margin);
  left=Math.min(Math.max(margin,left),maxLeft);
  // Keep the palette below its trigger at all times. If there is not enough
  // room below it, shrink the palette and let its own command list scroll.
  const availableBelow=Math.max(96,window.innerHeight-r.bottom-gap-margin);
  palette.style.maxHeight=Math.min(600,Math.max(96,availableBelow))+'px';
  palette.style.left=Math.round(left)+'px';
  palette.style.top=Math.round(r.bottom+gap)+'px';
}
function openPalette(id,button=null){
  state.activeMenu=id;
  state.activePaletteButton=button;
  renderPalette();
  palette.classList.add('is-open');
  palette.setAttribute('aria-hidden','false');
  requestAnimationFrame(positionPalette);
}
function closePalette(reRender=true){
  state.activeMenu=null;
  state.activePaletteButton=null;
  palette.classList.remove('is-open');
  palette.setAttribute('aria-hidden','true');
  if(reRender)render();
}
function setupContainerActions(){
  containersEl.addEventListener('click',e=>{
    const button=e.target.closest('.container-action');
    if(!button||!containersEl.contains(button))return;
    e.preventDefault();
    e.stopPropagation();
    const card=button.closest('.calc-container');
    const id=Number(card?.dataset?.id);
    const index=state.items.findIndex(item=>item.id===id);
    if(index<0)return;
    if(button.classList.contains('menu')){openPalette(id,button);return}
    closePalette(false);
    if(button.classList.contains('add')){
      const n=makeItem();state.items.splice(index+1,0,n);render();focusItem(n.id);return;
    }
    if(button.classList.contains('remove')){
      if(state.items.length===1)state.items[0].input='';
      else state.items.splice(index,1);
      render();return;
    }
    if(button.classList.contains('duplicate')){
      const n=makeItem(state.items[index].input);state.items.splice(index+1,0,n);render();focusItem(n.id);
    }
  });
}
function setupMenu(){
  const toggle=document.getElementById('menuToggle'),menu=document.getElementById('sideMenu'),back=document.getElementById('menuBackdrop');
  function close(){menu.classList.remove('is-open');back.classList.remove('is-visible');toggle.setAttribute('aria-expanded','false');menu.setAttribute('aria-hidden','true')}
  toggle.onclick=()=>{const open=!menu.classList.contains('is-open');if(open){menu.classList.add('is-open');back.classList.add('is-visible');toggle.setAttribute('aria-expanded','true');menu.setAttribute('aria-hidden','false')}else close()};
  back.onclick=close;
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(palette.classList.contains('is-open'))closePalette();else close()}});
  document.querySelectorAll('.menu-section-toggle').forEach(btn=>btn.onclick=()=>{const content=btn.nextElementSibling;const open=btn.getAttribute('aria-expanded')==='true';btn.setAttribute('aria-expanded',String(!open));btn.querySelector('.section-arrow').textContent=open?'∨':'∧';content.hidden=open});
}
function setupTheme(){
  function apply(choice){
    state.theme=choice;

    if(typeof setCalQTheme==='function'){
      setCalQTheme(choice);
    }

    localStorage.setItem('cas-theme',choice);

    const actual=choice==='auto'
      ?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')
      :choice;

    document.documentElement.dataset.theme=actual;

    document.querySelectorAll('.display-option').forEach(b=>{
      b.classList.toggle('active',b.dataset.themeChoice===choice);
    });
  }

  document.querySelectorAll('.display-option').forEach(b=>{
    b.onclick=()=>apply(b.dataset.themeChoice);
  });

  const sharedTheme = localStorage.getItem('calq-display-mode');
apply(sharedTheme || state.theme);

  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change',()=>{
    if(state.theme==='auto')apply('auto');
  });
}
document.addEventListener('click',e=>{if(palette.classList.contains('is-open')&&!palette.contains(e.target)&&!e.target.closest('.container-action.menu'))closePalette()});
window.addEventListener('resize',positionPalette);
window.addEventListener('scroll',positionPalette,{passive:true});
window.visualViewport?.addEventListener('resize',positionPalette);
window.visualViewport?.addEventListener('scroll',positionPalette,{passive:true});

function setupMatrixModal(){
  const modal=document.getElementById('matrixModal');
  const close=document.getElementById('matrixModalClose');
  const body=document.getElementById('matrixModalBody');
  const title=document.getElementById('matrixModalTitle');
  if(!modal)return;
  function hide(){modal.classList.remove('is-open');modal.setAttribute('aria-hidden','true');}
  close.onclick=hide;
  modal.addEventListener('click',e=>{if(e.target===modal)hide()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal.classList.contains('is-open'))hide()});
  let drag=false,sx=0,sy=0,ox=0,oy=0,dragPointer=null;
  const panel=modal.querySelector('.matrix-modal-panel');
  const head=modal.querySelector('.matrix-modal-head');
  const clampPanel=(left,top)=>{
    const maxLeft=Math.max(8,window.innerWidth-panel.getBoundingClientRect().width-8);
    const maxTop=Math.max(8,window.innerHeight-panel.getBoundingClientRect().height-8);
    panel.style.left=`${Math.min(maxLeft,Math.max(8,left))}px`;
    panel.style.top=`${Math.min(maxTop,Math.max(8,top))}px`;
    panel.style.right='auto';panel.style.bottom='auto';
  };
  head.addEventListener('pointerdown',e=>{
    if(e.target.closest('button'))return;
    drag=true;dragPointer=e.pointerId;sx=e.clientX;sy=e.clientY;
    const r=panel.getBoundingClientRect();ox=r.left;oy=r.top;
    panel.style.transform='none';panel.style.left=`${r.left}px`;panel.style.top=`${r.top}px`;
    try{head.setPointerCapture?.(e.pointerId)}catch(_){}e.preventDefault();
  });
  head.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==dragPointer)return;clampPanel(ox+e.clientX-sx,oy+e.clientY-sy)});
  const endDrag=e=>{if(dragPointer!==null&&e.pointerId!==undefined&&e.pointerId!==dragPointer)return;drag=false;dragPointer=null;try{if(e.pointerId!==undefined)head.releasePointerCapture?.(e.pointerId)}catch(_){}};
  head.addEventListener('pointerup',endDrag);head.addEventListener('pointercancel',endDrag);
  window.addEventListener('resize',()=>{if(modal.classList.contains('is-open')&&panel.style.transform==='none'){const r=panel.getBoundingClientRect();clampPanel(r.left,r.top)}});
  window.showMatrixResult=result=>{
    body.replaceChildren();
    const raw=String(result.raw||result.value||'');
    const normalized=window.CAS_ENGINE?.normalizeMatrixExpression?.(raw) || raw;
    const rows=Array.isArray(result.rows)&&result.rows.length
      ? result.rows.map(row=>Array.isArray(row)?row.map(cell=>String(cell)):[])
      : matrixRowsForModal(normalized);
    if(!rows.length || !rows[0]?.length || rows.some(row=>row.length!==rows[0].length)){
      body.textContent='Unable to render this matrix: rows must have the same number of columns.';
      title.textContent='Matrix';
      modal.classList.add('is-open');modal.setAttribute('aria-hidden','false');
      return;
    }
    const latex=`\\begin{bmatrix}${rows.map(row=>row.map(cell=>mathCellTex(cell)).join(' & ')).join(' \\\\ ')}\\end{bmatrix}`;
    const math=document.createElement('div'); math.className='matrix-katex';
    if(window.katex){window.katex.render(latex,math,{throwOnError:false,displayMode:true});}else math.textContent=latex;
    body.appendChild(math);
    title.textContent=`Matrix: ${rows.length}×${rows[0]?.length||0}`;
    panel.style.transform='translate(-50%,-50%)';panel.style.left='50%';panel.style.top='50%';panel.style.right='';panel.style.bottom='';
    modal.classList.add('is-open');modal.setAttribute('aria-hidden','false');
  };
}
function setupChemistryModal(){
  const modal=document.getElementById('chemistryModal');
  const close=document.getElementById('chemistryModalClose');
  const body=document.getElementById('chemistryModalBody');
  const title=document.getElementById('chemistryModalTitle');
  if(!modal)return;
  function hide(){modal.classList.remove('is-open');modal.setAttribute('aria-hidden','true');}
  close.onclick=hide;
  modal.addEventListener('click',e=>{if(e.target===modal)hide()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal.classList.contains('is-open'))hide()});
  let drag=false,sx=0,sy=0,ox=0,oy=0,dragPointer=null;
  const panel=modal.querySelector('.matrix-modal-panel');
  const head=modal.querySelector('.matrix-modal-head');
  const clampPanel=(left,top)=>{
    const maxLeft=Math.max(8,window.innerWidth-panel.getBoundingClientRect().width-8);
    const maxTop=Math.max(8,window.innerHeight-panel.getBoundingClientRect().height-8);
    panel.style.left=`${Math.min(maxLeft,Math.max(8,left))}px`;
    panel.style.top=`${Math.min(maxTop,Math.max(8,top))}px`;
    panel.style.right='auto';panel.style.bottom='auto';
  };
  head.addEventListener('pointerdown',e=>{
    if(e.target.closest('button'))return;
    drag=true;dragPointer=e.pointerId;sx=e.clientX;sy=e.clientY;
    const r=panel.getBoundingClientRect();ox=r.left;oy=r.top;
    panel.style.transform='none';panel.style.left=`${r.left}px`;panel.style.top=`${r.top}px`;
    try{head.setPointerCapture?.(e.pointerId)}catch(_){}e.preventDefault();
  });
  head.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==dragPointer)return;clampPanel(ox+e.clientX-sx,oy+e.clientY-sy)});
  const endDrag=e=>{if(dragPointer!==null&&e.pointerId!==undefined&&e.pointerId!==dragPointer)return;drag=false;dragPointer=null;try{if(e.pointerId!==undefined)head.releasePointerCapture?.(e.pointerId)}catch(_){}};
  head.addEventListener('pointerup',endDrag);head.addEventListener('pointercancel',endDrag);
  window.addEventListener('resize',()=>{if(modal.classList.contains('is-open')&&panel.style.transform==='none'){const r=panel.getBoundingClientRect();clampPanel(r.left,r.top)}});

  const addMath=(latex,cls='chemistry-math')=>{
    const d=document.createElement('div');d.className=cls;
    if(window.katex)window.katex.render(latex,d,{throwOnError:false,displayMode:true});
    else d.textContent=latex;
    body.appendChild(d);return d;
  };
  const matrixTex=(rows)=>`\\begin{bmatrix}${(rows||[]).map(row=>(row||[]).map(mathCellTex).join(' & ')).join(' \\\\ ')}\\end{bmatrix}`;
  const vectorTex=(items)=>`\\begin{bmatrix}${(items||[]).map(mathCellTex).join(' \\\\ ')}\\end{bmatrix}`;
  const chemicalFormulaTex=(formula)=>{
    let s=String(formula??'').trim().replace(/\s+/g,'');
    s=s.replace(/_\s*\{\s*(\d+)\s*\}/g,'$1').replace(/_\s*(\d+)/g,'$1').replace(/\{(\d+)\}/g,'$1');
    s=s.replace(/_/g,'');
    s=s.replace(/\^\s*\{?([0-9]+[+-])\}?/g,'^{$1}');
    let out='';
    for(let i=0;i<s.length;){
      const ch=s[i];
      if(/[A-Z]/.test(ch)){
        let el=ch;i++;
        if(i<s.length&&/[a-z]/.test(s[i]))el+=s[i++];
        out+=`\\mathrm{${el}}`;
        let digits='';while(i<s.length&&/[0-9]/.test(s[i]))digits+=s[i++];
        if(digits)out+=`_{${digits}}`;
        continue;
      }
      if(ch==='('||ch===')'||ch==='+'||ch==='-'||ch==='→'||ch==='=')out+=ch==='→'?'\\rightarrow ':ch;
      else if(/[0-9]/.test(ch)){let n='';while(i<s.length&&/[0-9]/.test(s[i]))n+=s[i++];out+=n;continue;}
      else out+=ch;
      i++;
    }
    return out;
  };
  const reactionTex=(equation)=>{
    const parts=String(equation??'').replace(/→/g,'->').split('->');
    const side=txt=>txt.split('+').map(x=>x.trim()).filter(Boolean).map(term=>{
      const m=term.match(/^(\d+)(.*)$/);const coeff=m?m[1]:'';const formula=m?m[2]:term;
      return (coeff&&coeff!=='1'?coeff:'')+chemicalFormulaTex(formula);
    }).join(' + ');
    return parts.length===2?`${side(parts[0])}\\rightarrow ${side(parts[1])}`:chemicalFormulaTex(equation);
  };

  window.showChemistryResult=result=>{
    body.replaceChildren();
    const c=result.chemistry||{};
    if(window.katex)window.katex.render('\\mathrm{Balancing}',title,{throwOnError:false,displayMode:false});else title.textContent='Balancing';
    addMath(reactionTex(c.original||''),'chemistry-original');
    addMath('\\begin{aligned}'+(c.elementEquations||[]).map(eq=>formatChemEquationTex(eq)).join(' \\\\ ' )+'\\end{aligned}','chemistry-heading');
    const rows=c.matrix||[];
    const matrixEquation=`${matrixTex(rows)}\\begin{bmatrix}${(c.coefficientNames||[]).map(mathCellTex).join(' \\\\ ')}\\end{bmatrix}=\\begin{bmatrix}${rows.map(()=> '0').join(' \\\\ ')}\\end{bmatrix}`;
    addMath(matrixEquation);
    addMath(matrixTex(c.rref||[]),'chemistry-heading');
    const solution='\\begin{aligned}'+(c.coefficientNames||[]).map((name,i)=>`${mathCellTex(name)}&=${mathCellTex((c.coefficients||[])[i])}`).join(' \\\\ ')+'\\end{aligned}';
    addMath(solution);
    addMath(reactionTex(c.equation||result.value),'chemistry-final');
    panel.style.transform='translate(-50%,-50%)';panel.style.left='50%';panel.style.top='50%';panel.style.right='';panel.style.bottom='';
    modal.classList.add('is-open');modal.setAttribute('aria-hidden','false');
  };
}
function mathCellTex(value){
  let s=String(value??'').trim();
  if(!s)return '0';
  s=s.replace(/_\s*\{\s*([^{}]+)\s*\}/g,'_$1').replace(/_\s*([0-9]+)/g,'_$1');
  return formatBasicTex(s);
}
function formatChemEquationTex(eq){
  let s=String(eq??'').trim().replace(/_\s*\{\s*([^{}]+)\s*\}/g,'_$1').replace(/_\s*([0-9]+)/g,'_$1');
  s=s.replace(/([A-Za-z])_([0-9]+)/g,'$1_{${2}}');
  return formatBasicTex(s);
}

function splitMatrixTopLevel(text, separator=','){
  const out=[];let start=0,p=0,b=0,c=0;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(ch==='(')p++; else if(ch===')')p--; else if(ch==='[')b++; else if(ch===']')b--; else if(ch==='{')c++; else if(ch==='}')c--;
    else if(ch===separator && p===0 && b===0 && c===0){out.push(text.slice(start,i).trim());start=i+1;}
  }
  out.push(text.slice(start).trim());
  return out.filter(Boolean);
}
function matrixRowsForModal(text){
  let s=String(text).trim().replace(/^matrix\s*\(/i,'').replace(/\)$/,'').trim();
  let rows=splitMatrixTopLevel(s);
  if(rows.length===1 && /^\[/.test(rows[0])){
    rows=splitMatrixTopLevel(rows[0].replace(/^\[|\]$/g,''), ',');
  }
  return rows.map(r=>{
    let row=r.trim().replace(/^\[|\]$/g,'').trim();
    return splitMatrixTopLevel(row).map(x=>x.trim()).filter(Boolean);
  }).filter(r=>r.length);
}

setupContainerActions();setupMenu();setupTheme();setupMatrixModal();setupChemistryModal();render();
