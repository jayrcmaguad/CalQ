window.GraphingCalculatorApp = (() => {
  const GRAPH_COLORS=['#2563eb','#dc2626','#16a34a','#9333ea','#ea580c','#0891b2','#db2777','#4f46e5'];
  const state = { expressions: [], keypadMode: 0, theme: 'auto', graph: null, vars: {}, autoFraction: true };
  const K = {
    main: { name:'Main keypad', cols:9, rows:[
      [['x','x'],['y','y'],['π','pi'],['e','e'],['7','7'],['8','8'],['9','9'],['×','*'],['÷','/']],
      [['x²','^(2)'],['xʸ','^()'],['√x','sqrt()'],['|x|','abs()'],['4','4'],['5','5'],['6','6'],['+','+'],['−','-']],
      [['<','<'],['>','>'],['x⁻¹','^(-1)'],['a⁄b','frac'],['1','1'],['2','2'],['3','3'],['=','='],['⌫','__DEL__']],
      [['ans','ans'],[',',','],['(','('],[')',')'],['0','0'],['.','.'],['←','__LEFT__'],['→','__RIGHT__'],['↵','__ENTER__']]
    ]},
    scientific: { name:'Scientific keypad', cols:7, rows:[
      [['sin','sin('],['cos','cos('],['tan','tan('],['%','%'],['!','!'],['$','$'],['⌫','__DEL__']],
      [['sin⁻¹','asin('],['cos⁻¹','acos('],['tan⁻¹','atan('],['{','{'],['}','}'],['≤','≤'],['≥','≥']],
      [['ln','ln('],['log₁₀','log10('],['logₐ','log('],['d/dx','diff('],['∫','integral('],['i','i']],
      [['eˣ','e^('],['10ˣ','10^('],['ⁿ√x','nthRoot('],['xₐ','subscript('],['<','<'],['>','>'],['↵','__ENTER__']]
    ]},
    greek: { name:'Greek keyboard', cols:7, rows:[
      [['α','alpha'],['β','beta'],['γ','gamma'],['δ','delta'],['ε','epsilon'],['ζ','zeta'],['η','eta']],
      [['θ','theta'],['λ','lambda'],['μ','mu'],['π','pi'],['ρ','rho'],['σ','sigma'],['φ','phi']],
      [['χ','chi'],['ψ','psi'],['ω','omega'],['Δ','Delta'],['Σ','Sigma'],['Ω','Omega'],['Γ','Gamma']],
      [['Λ','Lambda'],['Π','Pi'],['Φ','Phi'],['Ψ','Psi'],['∞','Infinity'],['⌫','__DEL__'],['↵','__ENTER__']]
    ]},
    latin: { name:'Latin alphabet', cols:7, rows:[
      [['a','a'],['b','b'],['c','c'],['d','d'],['e','e'],['f','f'],['g','g']],
      [['h','h'],['i','i'],['j','j'],['k','k'],['l','l'],['m','m'],['n','n']],
      [['o','o'],['p','p'],['q','q'],['r','r'],['s','s'],['t','t'],['u','u']],
      [['v','v'],['w','w'],['x','x'],['y','y'],['z','z'],['⇧','__SHIFT__'],['⌫','__DEL__']]
    ]}
  };
  const order = ['main','scientific','greek','latin'];
  let latinUppercase = false;
  const $ = id => document.getElementById(id);

  function init(){
    state.graph = new GraphEngine.Graph($('graphCanvas'));
    bindUI();
    const savedTheme=localStorage.getItem('calq-display-mode')||'auto';
applyTheme(savedTheme,false);
    renderKeypad();
    adjustMobileLayout();
    window.addEventListener('resize', () => { state.graph.resize(); adjustMobileLayout(); });
  }

  function addExpression(value=''){
    const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now()+Math.random());
    state.expressions.push({id,value});
    renderExpressions();
    return id;
  }

  function removeExpression(id){
    if(state.expressions.length===1){ state.expressions[0].value=''; renderExpressions(); plot(); return; }
    state.expressions=state.expressions.filter(x=>x.id!==id);
    renderExpressions(); plot();
  }

  function makeRow(item,i){
    const row=document.createElement('article'); row.className='expression-row';
    const visual=document.createElement('div'); visual.className='input-visual';
    const visualMath=document.createElement('div'); visualMath.className='input-visual-math';
    visual.append(visualMath);
    const bar=document.createElement('div'); bar.className='expression-bar';
    const index=document.createElement('span'); index.className='expression-index'; index.textContent=i+1;
    const input=document.createElement('input');
    input.className='expression-input'; input.value=item.value; input.placeholder='Expression';
    input.autocomplete='off'; input.spellcheck=false; input.inputMode='none';
    const color=document.createElement('input'); color.type='color'; color.className='expression-color'; color.value=item.color||GRAPH_COLORS[i%GRAPH_COLORS.length]; color.title='Graph color'; item.color=color.value;
    const remove=document.createElement('button'); remove.className='remove-expression'; remove.textContent='×'; remove.title='Remove expression'; remove.dataset.id=item.id;
    bar.append(index,input,color,remove);
    const bottom=document.createElement('div'); bottom.className='answer-row';
    const answer=document.createElement('div'); answer.className='answer-value'; answer.textContent='Answer: —';
    const latex=document.createElement('div'); latex.className='answer-latex';
    bottom.append(answer,latex); row.append(visual,bar,bottom);
    return {row,input,visualMath,answer,latex,remove,color};
  }

  function renderExpressions(){
    const root=$('expressionList'); root.innerHTML='';
    state.expressions.forEach((item,i)=>{
      const ui=makeRow(item,i); root.appendChild(ui.row); InputManager.setActive(ui.input);
      ui.input.addEventListener('focus',()=>InputManager.setActive(ui.input));
      ui.input.addEventListener('input',()=>{ item.value=ui.input.value; updateRow(item,ui); plot(); });
      ui.color?.addEventListener('input',()=>{ item.color=ui.color.value; plot(); });
      ui.input.addEventListener('keydown',e=>{ if(e.key==='Enter'){e.preventDefault();calculateExpression(item,ui);} });
      ui.remove.addEventListener('click',()=>removeExpression(item.id));
      updateRow(item,ui);
    });
  }

  function rebuildVariables(){
    state.vars={};
    const assignments=state.expressions
      .map(item=>item.value.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/))
      .filter(Boolean);
    // Resolve definitions repeatedly so A=B+1 and B=7 work regardless of
    // their order in the expression list. Unresolved symbols simply remain
    // unresolved instead of poisoning the whole calculator state.
    for(let pass=0; pass<assignments.length; pass++){
      let changed=false;
      for(const m of assignments){
        try{
          const value=CASEngine.evaluate(m[2],state.vars);
          if(state.vars[m[1]]!==value){ state.vars[m[1]]=value; changed=true; }
        }catch{}
      }
      if(!changed) break;
    }
  }

  function isAssignment(value){ return /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/.test(value); }
  const GRAPHABLE_COMMANDS = new Set(['simplify','expand','factor','diff','derivative','integral','limit','abs','floor','ceil','mod','sqrt','log','log10','ln','sin','cos','tan','asin','acos','atan','sec','csc','cot','nthroot','npr','ncr','factorial','gcd','lcm','mean','median','sum','prod','det','inv','transpose','trace','rank','piecewise','summation','parametric','polar']);
  const NON_GRAPHABLE_COMMANDS = new Set(['solve']);
  function commandName(value){ const m=String(value||'').trim().match(/^([A-Za-z_]\w*)\s*\(/); return m?m[1].toLowerCase():null; }
  function isCommand(value){ const name=commandName(value); return !!name && (GRAPHABLE_COMMANDS.has(name)||NON_GRAPHABLE_COMMANDS.has(name)); }


  function fractionLatex(value){
    let s=String(value);
    s=s.replace(/(^|[+\-*\/,\s(])(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)(?=$|[+\-*\/,\s)])/g,
      (_,prefix,a,b)=>`${prefix}\\frac{${a}}{${b}}`);
    return s;
  }

  function visualLatex(value){
    if(!value) return '';
    if(isCommand(value)) return null;
    const latex = SymbolicEngine.canonicalLatex(value);
    return state.autoFraction ? fractionLatex(latex) : latex;
  }

  function updateRow(item,ui){
    const value=item.value.trim();
    rebuildVariables();
    const command=isCommand(value);
    const assignment=isAssignment(value);
    const visual=visualLatex(value);
    ui.visualMath.textContent='';
    if(command || assignment){ ui.visualMath.textContent=value; }
    else if(visual){ LatexRenderer.render(ui.visualMath,visual); }
    ui.latex.textContent='';

    if(!value){ ui.answer.textContent='Answer: —'; ui.answer.classList.remove('error'); return; }
    try{
      if(command && /^integral\s*\(/i.test(value)){
        const inside=value.replace(/^integral\s*\(/i,'').replace(/\)\s*$/,'');
        const parts=inside.split(',');
        if(parts.length<3 || parts.some(part=>part.trim()==='')){
          ui.answer.textContent='Answer: —'; ui.answer.classList.remove('error'); return;
        }
      }
      let result;
      const graphParts=splitGraphRestriction(value);
      const calculationSource=(graphParts.restriction ? graphParts.expression : value);
      if(assignment){
        const match=value.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/);
        const name=match[1],rhs=match[2];
        result=CASEngine.evaluate(rhs,state.vars);
        state.vars[name]=result;
      } else {
        result=CASEngine.runCommand(calculationSource,state.vars);
      }
      CASEngine.setLastAnswer(result);
      ui.answer.textContent='Answer: '+formatResult(result);
      ui.answer.classList.remove('error');
      if(!command && !assignment){
        const answerLatex=state.autoFraction ? fractionLatex(SymbolicEngine.canonicalLatex(String(result))) : SymbolicEngine.canonicalLatex(String(result));
        LatexRenderer.render(ui.latex,answerLatex);
      }
    }catch(e){
      ui.answer.textContent='Answer: '+(e.message||'Invalid expression');
      ui.answer.classList.add('error');
    }
  }

  function rational(value){
    if(typeof value!=='number'||!Number.isFinite(value)||Number.isInteger(value))return null;
    const sign=value<0?-1:1,x=Math.abs(value),maxDen=100000;
    let bestN=Math.round(x),bestD=1,bestErr=Math.abs(x-bestN);
    let a=Math.floor(x),h0=1,h1=a,k0=0,k1=1;
    for(let i=0;i<32;i++){
      const approx=h1/k1,err=Math.abs(x-approx);
      if(err<bestErr){bestErr=err;bestN=h1;bestD=k1;}
      if(err<1e-10||k1>maxDen)break;
      const rem=x-a;if(rem===0)break;a=Math.floor(1/rem);
      const h2=a*h1+h0,k2=a*k1+k0;h0=h1;h1=h2;k0=k1;k1=k2;
    }
    return bestD>1&&bestErr<1e-8?`${sign*bestN}/${bestD}`:null;
  }

  function formatResult(result){
    if(Array.isArray(result)) return result.map(formatResult).join(', ');
    if(typeof result==='number'){ const r=rational(result); return r||Number(result.toFixed(12)).toString(); }
    if(result&&typeof result.toString==='function') return result.toString();
    return String(result);
  }

  function calculateExpression(item,ui){ updateRow(item,ui); plot(); $('statusLine').textContent='Calculated'; }

  function splitTopLevelArgs(s){
    const out=[]; let depth=0, start=0;
    for(let i=0;i<s.length;i++){
      const ch=s[i];
      if('([{'.includes(ch)) depth++;
      else if(')]}'.includes(ch)) depth--;
      else if(ch===',' && depth===0){ out.push(s.slice(start,i).trim()); start=i+1; }
    }
    out.push(s.slice(start).trim());
    return out;
  }

  function graphValueToPlot(result, command, originalSource){
    if(result===undefined || result===null) return {expression:null,points:[],regions:[],parametrics:[]};
    let value=result;
    if(value && typeof value.toArray==='function'){try{value=value.toArray();}catch{}}
    if(typeof value==='number') return Number.isFinite(value)?{expression:String(value),points:[],regions:[],parametrics:[]}:{expression:null,points:[],regions:[],parametrics:[]};
    if(typeof value==='string'){
      const text=value.trim();
      if(!text)return {expression:null,points:[],regions:[],parametrics:[]};
      return {expression:text,points:[],regions:[],parametrics:[]};
    }
    if(Array.isArray(value)){
      if(!value.length)return {expression:null,points:[],regions:[],parametrics:[]};
      if(command==='solve' && value.every(v=>Number.isFinite(Number(v)))) return {expression:null,points:value.map(v=>[Number(v),0]),regions:[],parametrics:[]};
      if(value.every(row=>Array.isArray(row)&&row.length===2&&Number.isFinite(Number(row[0]))&&Number.isFinite(Number(row[1])))) return {expression:null,points:value.map(row=>[Number(row[0]),Number(row[1])]),regions:[],parametrics:[]};
      if(value.every(v=>Number.isFinite(Number(v)))) return {expression:null,points:value.map((v,i)=>[i+1,Number(v)]),regions:[],parametrics:[]};
    }
    return {expression:null,points:[],regions:[],parametrics:[]};
  }

  function parseParametric(source){
    const m=source.match(/^parametric\s*\((.*)\)$/i); if(!m)return null;
    const a=splitTopLevelArgs(m[1]); if(a.length!==4)return null;
    return {x:a[0],y:a[1],min:a[2],max:a[3]};
  }
  function parsePolar(source){
    const m=source.match(/^polar\s*\((.*)\)$/i); if(!m)return null;
    const a=splitTopLevelArgs(m[1]); if(a.length!==3)return null;
    return {r:a[0],min:a[1],max:a[2]};
  }
  function parseIntegralRegion(source){
    const m=source.match(/^integral\s*\((.*)\)$/i); if(!m)return null;
    const a=splitTopLevelArgs(m[1]); if(a.length!==3)return null;
    try{return {expression:a[0],min:Number(CASEngine.evaluate(a[1],state.vars)),max:Number(CASEngine.evaluate(a[2],state.vars))};}catch{return null;}
  }

  function graphSource(source){
    const raw=String(source||'').trim(); if(!raw)return {expression:null,points:[],regions:[],parametrics:[]};
    const restrictionParts=splitGraphRestriction(raw); const s=restrictionParts.restriction?restrictionParts.expression:raw;
    const restriction=restrictionParts.restriction;
    let m=s.match(/^y\s*=\s*(.+)$/i); if(m)return {expression:m[1].trim(),points:[],regions:[],parametrics:[]};
    m=s.match(/^f\s*\(\s*x\s*\)\s*=\s*(.+)$/i); if(m)return {expression:m[1].trim(),points:[],regions:[],parametrics:[]};
    const pointMatch=s.match(/^\(\s*(-?(?:\d+(?:\.\d*)?|\.\d+))\s*,\s*(-?(?:\d+(?:\.\d*)?|\.\d+))\s*\)$/);
    if(pointMatch)return {expression:null,points:[[Number(pointMatch[1]),Number(pointMatch[2])]],regions:[],parametrics:[]};
    const param=parseParametric(s); if(param)return {expression:null,points:[],regions:[],parametrics:[param]};
    const polar=parsePolar(s); if(polar)return {expression:null,points:[],regions:[],parametrics:[{polar:true,...polar}]};
    const command=commandName(s);
    if(command==='integral'){
      const region=parseIntegralRegion(s);
      if(region)return {expression:region.expression,points:[],regions:[region],parametrics:[]};
      try{return graphValueToPlot(CASEngine.runCommand(s,state.vars),command,s);}catch{return {expression:null,points:[],regions:[],parametrics:[]};}
    }
    if(command==='solve'){
      try{return graphValueToPlot(CASEngine.runCommand(s,state.vars),command,s);}catch{return {expression:null,points:[],regions:[],parametrics:[]};}
    }
    if(command==='piecewise')return {expression:s,points:[],regions:[],parametrics:[]};
    if(isAssignment(s)){
      const mm=s.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/); if(!mm)return {expression:null,points:[],regions:[],parametrics:[]};
      try{
        const rhs=mm[2].trim(),result=CASEngine.runCommand(rhs,state.vars),plotted=graphValueToPlot(result,commandName(rhs),rhs);
        if(!plotted.expression && /\bx\b/.test(rhs))plotted.expression=rhs;
        return plotted;
      }catch{return /\bx\b/.test(mm[2])?{expression:mm[2],points:[],regions:[],parametrics:[]}:{expression:null,points:[],regions:[],parametrics:[]};}
    }
    if(command && (GRAPHABLE_COMMANDS.has(command)||NON_GRAPHABLE_COMMANDS.has(command))){
      try{const result=CASEngine.runCommand(s,state.vars),plotted=graphValueToPlot(result,command,s);if(plotted.expression||plotted.points.length)return plotted;}catch{}
      if(GRAPHABLE_COMMANDS.has(command))return {expression:s,points:[],regions:[],parametrics:[]};
      return {expression:null,points:[],regions:[],parametrics:[]};
    }
    return {expression:s,points:[],regions:[],parametrics:[]};
  }


  function parseGraphRestriction(text){
    const s=String(text||'').trim().replace(/\s+/g,'').replace(/≤/g,'<=').replace(/≥/g,'>=');
    let m=s.match(/^(-?(?:\d+(?:\.\d*)?|\.\d+))<x<(-?(?:\d+(?:\.\d*)?|\.\d+))$/i);
    if(m) return {min:Number(m[1]),max:Number(m[2]),minOpen:true,maxOpen:true};
    m=s.match(/^(-?(?:\d+(?:\.\d*)?|\.\d+))<=x<=(-?(?:\d+(?:\.\d*)?|\.\d+))$/i);
    if(m) return {min:Number(m[1]),max:Number(m[2]),minOpen:false,maxOpen:false};
    m=s.match(/^(-?(?:\d+(?:\.\d*)?|\.\d+))<=x<(-?(?:\d+(?:\.\d*)?|\.\d+))$/i);
    if(m) return {min:Number(m[1]),max:Number(m[2]),minOpen:false,maxOpen:true};
    m=s.match(/^(-?(?:\d+(?:\.\d*)?|\.\d+))<x<=(-?(?:\d+(?:\.\d*)?|\.\d+))$/i);
    if(m) return {min:Number(m[1]),max:Number(m[2]),minOpen:true,maxOpen:false};
    m=s.match(/^x>(=)?(-?(?:\d+(?:\.\d*)?|\.\d+))$/i);
    if(m) return {min:Number(m[2]),max:Infinity,minOpen:!m[1],maxOpen:true};
    m=s.match(/^x<(=)?(-?(?:\d+(?:\.\d*)?|\.\d+))$/i);
    if(m) return {min:-Infinity,max:Number(m[2]),minOpen:true,maxOpen:!m[1]};
    return null;
  }

  function splitGraphRestriction(source){
    const parts=splitTopLevelArgs(source);
    if(parts.length<2) return {expression:source,restriction:null};
    const restriction=parts.slice(1).join(',');
    return {expression:parts[0],restriction:parseGraphRestriction(restriction),restrictionText:restriction};
  }

  function partsLookLikeRestriction(source){ const p=splitTopLevelArgs(source); return p.length>1 && /[<>≤≥]/.test(p.slice(1).join(',')); }

  function plot(){
    const curves=[],points=[],regions=[],parametrics=[]; let errors=0;
    for(let index=0;index<state.expressions.length;index++){
      const item=state.expressions[index],source=item.value.trim(); if(!source)continue;
      const originalRestriction=splitGraphRestriction(source).restriction,plotted=graphSource(source);
      if(!plotted)continue;
      if(Array.isArray(plotted.points))points.push(...plotted.points.map(p=>[p[0],p[1],item.color||GRAPH_COLORS[index%GRAPH_COLORS.length]]));
      if(Array.isArray(plotted.regions))for(const r of plotted.regions){try{regions.push({...r,fn:CASEngine.compileFunction(r.expression,state.vars),color:item.color||GRAPH_COLORS[index%GRAPH_COLORS.length]});}catch{errors++;}}
      if(Array.isArray(plotted.parametrics))for(const r of plotted.parametrics){try{parametrics.push({...r,xFn:r.x?CASEngine.compileFunction(r.x,state.vars):null,yFn:r.y?CASEngine.compileFunction(r.y,state.vars):null,rFn:r.r?CASEngine.compileFunction(r.r,state.vars):null,color:item.color||GRAPH_COLORS[index%GRAPH_COLORS.length]});}catch{errors++;}}
      if(!plotted.expression)continue;
      try{
        const parsed=splitGraphRestriction(plotted.expression); if(originalRestriction&&!parsed.restriction)parsed.restriction=originalRestriction;
        const fn=CASEngine.compileFunction(parsed.expression,state.vars);
        if(parsed.restriction){const r=parsed.restriction;curves.push({fn:x=>{if((Number.isFinite(r.min)&&(r.minOpen?x<=r.min:x<r.min))||(Number.isFinite(r.max)&&(r.maxOpen?x>=r.max:x>r.max)))return NaN;return fn(x);},color:item.color||GRAPH_COLORS[index%GRAPH_COLORS.length]});}
        else if(partsLookLikeRestriction(plotted.expression))errors++; else curves.push({fn,color:item.color||GRAPH_COLORS[index%GRAPH_COLORS.length]});
      }catch{errors++;}
    }
    state.graph.setFunctions(curves,points,regions,parametrics);
    $('statusLine').textContent=errors?`${errors} expression${errors>1?'s':''} cannot be graphed.`:'Ready';
  }


  function renderKeypad(){
    const key=order[state.keypadMode],cfg=K[key],root=$('keypad');
    root.innerHTML=''; root.style.setProperty('--keypad-cols',cfg.cols); root.dataset.mode=key; $('keypadName').textContent=cfg.name; root.style.setProperty('--keypad-rows', cfg.rows.length);
    cfg.rows.flat().forEach(([label,value])=>{
      const b=document.createElement('button'); b.className='key'; b.type='button';
      b.textContent = key==='latin' && /^[a-z]$/.test(label) ? (latinUppercase ? label.toUpperCase() : label) : ((value==='__SHIFT__' && latinUppercase) ? '⇩' : label);
      if(['÷','×','−','+','^','=','!','≤','≥','≠','<','>'].includes(label))b.classList.add('operator');
      if(['⌫','↵'].includes(label))b.classList.add('utility');
      b.addEventListener('click',()=>keyAction(value)); root.appendChild(b);
    });
  }


  function adjustMobileLayout(){
    const shell=document.querySelector('.app-shell');
    const card=document.querySelector('.keypad-card');
    const keypad=document.querySelector('.keypad');
    if(!shell || !card || !keypad || window.innerWidth>600) return;

    requestAnimationFrame(()=>{
      const styles=getComputedStyle(card);
      const innerWidth=card.clientWidth-parseFloat(styles.paddingLeft)-parseFloat(styles.paddingRight);
      const cols=9, gap=3;
      const keySize=Math.max(0,(innerWidth-gap*(cols-1))/cols);
      const mainGridHeight=keySize*4+gap*3;
      const cardOverhead=card.clientHeight-keypad.clientHeight;
      const keypadCardHeight=mainGridHeight+cardOverhead;
      const shellHeight=shell.clientHeight;
      const gaps=10;
      const graphHeight=Math.round(shellHeight*.27);
      const expressionHeight=Math.max(0,shellHeight-graphHeight-keypadCardHeight-gaps);
      shell.style.gridTemplateRows=`${graphHeight}px ${expressionHeight}px ${keypadCardHeight}px`;
    });
  }

  function keyAction(value){
    const el=InputManager.state.active;if(!el)return;
    el.focus({preventScroll:true});
    if(value==='__SHIFT__'){ latinUppercase=!latinUppercase; renderKeypad(); adjustMobileLayout(); return; }
    if(value==='__DEL__'){const p=el.selectionStart??el.value.length,q=el.selectionEnd??p;if(p!==q)el.setRangeText('',p,q);else if(p>0)el.setRangeText('',p-1,p);el.dispatchEvent(new Event('input',{bubbles:true}));return;}
    if(value==='__CALC__'||value==='__ENTER__'){
      const row=el.closest('.expression-row');
      if(row){const id=row.querySelector('.remove-expression')?.dataset?.id,item=state.expressions.find(x=>x.id===id);if(item)calculateExpression(item,{input:el,answer:row.querySelector('.answer-value'),latex:row.querySelector('.answer-latex'),visualMath:row.querySelector('.input-visual-math')});}
      return;
    }
    if(value==='ans'){ InputManager.insert('Ans'); return; }
    if(value==='__LEFT__'){const p=Math.max(0,(el.selectionStart??0)-1);el.setSelectionRange(p,p);return;}
    if(value==='__RIGHT__'){const p=Math.min(el.value.length,(el.selectionStart??0)+1);el.setSelectionRange(p,p);return;}
    if(value==='frac') InputManager.insertTemplate('\\frac{}{}',6);
    else if(value==='sqrt()') InputManager.insertTemplate('\\sqrt{}',6);
    else if(value==='abs()') InputManager.insertTemplate('abs()',4);
    else if(value==='^()') InputManager.insertTemplate('^()',2);
    else if(value==='e^(') InputManager.insert('e^(');
    else if(value==='10^(') InputManager.insert('10^(');
    else if(value==='integral(') InputManager.insertTemplate('integral(,,)',9);
    else if(order[state.keypadMode]==='latin' && /^[a-z]$/.test(value)) InputManager.insert(latinUppercase ? value.toUpperCase() : value);
    else InputManager.insert(value);
  }

  function bindUI(){
    $('addExpression').onclick=()=>addExpression('');
    document.querySelectorAll('[data-keypad]').forEach(b=>b.onclick=()=>{state.keypadMode=Number(b.dataset.keypad);renderKeypad();adjustMobileLayout();});
    $('zoomIn').onclick=()=>state.graph.zoom(.75);
    $('zoomOut').onclick=()=>state.graph.zoom(1.3333);
    $('resetView').onclick=()=>state.graph.reset();
    $('graphFullscreen').onclick=()=>setGraphFullscreen(true);
    $('graphMinimize').onclick=()=>setGraphFullscreen(false);
    const gx=$('gridX'),gy=$('gridY'),square=$('gridSquare');
    if(gx&&gy){ gx.oninput=()=>state.graph.setGridSpacing(Number(gx.value)||1, Number(gy.value)||1); gy.oninput=()=>state.graph.setGridSpacing(Number(gx.value)||1, Number(gy.value)||1); }
    if(square){ square.onclick=()=>{gx.value=gy.value='1';state.graph.setGridSpacing(1,1);}; }
    $('menuToggle').onclick=toggleMenu; $('menuBackdrop').onclick=closeMenu;
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeMenu();setGraphFullscreen(false);}});
    bindSection('settingsToggle','settingsContent','settingsArrow'); bindSection('commandsToggle','commandsContent','commandsArrow');
    document.querySelectorAll('.display-option').forEach(b=>b.onclick=()=>applyTheme(b.dataset.theme,true));
    const fractionToggle=$('autoFractionToggle');
    if(fractionToggle){fractionToggle.checked=state.autoFraction;fractionToggle.onchange=()=>{state.autoFraction=fractionToggle.checked;renderExpressions();};}
  }

  function bindSection(btn,content,arrow){
    $(btn).onclick=()=>{const open=$(btn).getAttribute('aria-expanded')==='false';$(btn).setAttribute('aria-expanded',String(open));$(content).hidden=!open;$(arrow).textContent=open?'∧':'∨';};
  }
  function toggleMenu(){const open=!$('sideMenu').classList.contains('is-open');$('sideMenu').classList.toggle('is-open',open);$('menuBackdrop').classList.toggle('is-visible',open);$('menuToggle').setAttribute('aria-expanded',String(open));$('sideMenu').setAttribute('aria-hidden',String(!open));}
  function closeMenu(){$('sideMenu').classList.remove('is-open');$('menuBackdrop').classList.remove('is-visible');$('menuToggle').setAttribute('aria-expanded','false');$('sideMenu').setAttribute('aria-hidden','true');}
  function setGraphFullscreen(open){
    const section=document.querySelector('.graph-section');
    if(!section) return;
    section.classList.toggle('is-fullscreen',!!open);
    document.body.classList.toggle('graph-fullscreen-active',!!open);
    requestAnimationFrame(()=>state.graph?.resize());
  }
    function applyTheme(theme, persist = true) {
    state.theme = theme;

    if (persist) {
      if (typeof setCalQTheme === 'function') {
        setCalQTheme(theme);
      }
      localStorage.setItem('calc-theme', theme);
    }

    const root = document.documentElement;

    root.dataset.theme = theme === 'auto'
      ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : theme;

    document.querySelectorAll('.display-option').forEach(x => {
      x.classList.toggle('active', x.dataset.theme === theme);
    });

    state.graph?.draw(state.graph.functions || []);
  }

  return { init };
})();