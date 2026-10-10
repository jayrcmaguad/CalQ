/* CAS engine: one shared symbolic environment for every container. */
const COMMAND_GROUPS = [
  ['Algebra', [
    ['Simplify','simplify(expression)','simplify'],['Factor','factor(expression)','factor'],['Expand','expand(expression)','expand'],
    ['Collect','collect(expression, variable)','collect'],['Partial Fractions','partfrac(expression, variable)','partfrac'],
    ['GCD','gcd(a, b)','gcd'],['LCM','lcm(a, b)','lcm'],['Complete Square','sqcomp(expression, variable)','completeSquare']
  ]],
  ['Equations', [
    ['Solve','solve(equation, variable)','solve'],['Solve System','solveeq(equations)','solveSystem']
  ]],
  ['Calculus', [
    ['Integral','integrate(expression, variable)','integrate'],['Definite Integral','defint(expression, variable, lower, upper)','defint'],
    ['Derivative','diff(expression, variable)','diff'],['Nth Derivative','diff(expression, variable, order)','diffn'],
    ['Limit','limit(expression, variable, point)','limit'],['Summation','sum(expression, variable, lower, upper)','sum'],
    ['Product','product(expression, variable, lower, upper)','product'],['Laplace','laplace(expression, variable, s)','laplace'],
    ['Inverse Laplace','ilaplace(expression, s, variable)','ilaplace']
  ]],
  ['Linear Algebra', [
    ['Matrix','matrix([1,2],[3,4])','matrix'],['Identity Matrix','imatrix(n)','imatrix'],
    ['Determinant','det(A)','det'],['Inverse','invert(A)','inverse'],['Transpose','transpose(A)','transpose'],
    ['Trace','trace(A)','trace'],['Rank','rank(A)','rank'],['Augment','augment(A,B)','augment'],['Dot Product','dot(u,v)','dot'],['Cross Product','cross(u,v)','cross'],['Row Echelon Form','ref(A)','ref'],['Reduced Row Echelon Form','rref(A)','rref'],['Nullspace','nullspace(A)','nullspace'],['Cofactor Matrix','cofactor(A)','cofactor'],['Adjugate','adjugate(A)','adjugate'],['Balance Equation','balance(H2+O2->H2O)','balanceChem']
  ]],
  ['Trigonometry', [
    ['Sine','sin(expression)','sin'],['Cosine','cos(expression)','cos'],['Tangent','tan(expression)','tan'],
    ['Secant','sec(expression)','sec'],['Cosecant','csc(expression)','csc'],['Cotangent','cot(expression)','cot'],
    ['Arcsine / Inverse Sine','asin(expression)','asin'],['Arccosine / Inverse Cosine','acos(expression)','acos'],['Arctangent / Inverse Tangent','atan(expression)','atan'],
    ['Arccosecant / Inverse Cosecant','acsc(expression)','acsc'],['Arcsecant / Inverse Secant','asec(expression)','asec'],['Arccotangent / Inverse Cotangent','acot(expression)','acot'],
    ['Arcsine Alias','arcsin(expression)','arcsin'],['Arccosine Alias','arccos(expression)','arccos'],['Arctangent Alias','arctan(expression)','arctan'],
    ['Hyperbolic Sine','sinh(expression)','sinh'],['Hyperbolic Cosine','cosh(expression)','cosh'],['Hyperbolic Tangent','tanh(expression)','tanh'],
    ['Inverse Hyperbolic Sine','asinh(expression)','asinh'],['Inverse Hyperbolic Cosine','acosh(expression)','acosh'],['Inverse Hyperbolic Tangent','atanh(expression)','atanh'],
    ['Inverse Hyperbolic Cosecant','acsch(expression)','acsch'],['Inverse Hyperbolic Secant','asech(expression)','asech'],['Inverse Hyperbolic Cotangent','acoth(expression)','acoth']
  ]],
  ['Functions', [
    ['Square Root','sqrt(expression)','sqrt'],['Absolute Value','abs(expression)','abs'],['Logarithm','log(expression)','log'],
    ['Natural Logarithm','ln(expression)','ln'],['Exponential','exp(expression)','exp'],['Floor','floor(expression)','floor'],['Ceiling','ceil(expression)','ceil']
  ]],
  ['Complex & Number', [
    ['Conjugate','conjugate(expression)','conjugate'],['Real Part','realpart(expression)','realpart'],
    ['Imaginary Part','imagpart(expression)','imagpart'],['Sign','sign(expression)','sign'],['Heaviside','heaviside(expression)','heaviside']
  ]]
];
const COMMANDS=COMMAND_GROUPS.flatMap(([category,items])=>items.map(x=>[...x,category]));
const COMMAND_MAP=Object.fromEntries(COMMANDS.map(x=>[x[2],{label:x[0],signature:x[1],category:x[3]}]));
function normalizeInput(s){
  let str = String(s ?? '')
    .replace(/[−–]/g, '-')
    .replace(/×/g, '*')
    .replace(/[⋅∗]/g, '*')
    .replace(/÷/g, '/')
    .replace(/π/g, 'pi')
    .replace(/\b(sin|cos|tan|sec|csc|cot)\s*\^\s*-1\s*\(/gi, (m, n) => ({ sin: 'asin', cos: 'acos', tan: 'atan', sec: 'asec', csc: 'acsc', cot: 'acot' }[n.toLowerCase()] + '('))
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/⁴/g, '^4')
    .replace(/⁵/g, '^5')
    .trim();

  // Protect scientific notation numbers (e.g., 1e-5, 2.5E3)
  const sci = [];
  str = str.replace(/\b(\d+(?:\.\d+)?)[eE]([+-]?\d+)\b/g, (m) => {
    sci.push(m);
    return `__SCI_${sci.length - 1}__`;
  });

  // Delegate logarithm parsing to a balanced-parenthesis-aware adapter.
  // This keeps ln(...) natural and log(...) base-10, while avoiding double normalization and
  // supports nested calls such as ln(2+ln(3)) and log_2(8).
  str = normalizeLogarithmicInput(str);

  // Preserve Euler exponentials symbolically. Nerdamer's exp(x) representation
  // differentiates/integrates exactly, whereas replacing e with a decimal first
  // turns e^x into 2.71828...^x and pollutes symbolic calculus.
  str = normalizeEulerExponentials(str);

  // Replace standalone lowercase Euler's constant with a numeric literal.
  // Do this only after protecting scientific notation, and preserve uppercase E
  // as an ordinary user-defined variable. Nerdamer treats E as a symbol, not e.
  str = str.replace(/\be\b/g, '(2.718281828459045)');

  // Restore scientific numbers
  sci.forEach((val, idx) => {
    str = str.replace(`__SCI_${idx}__`, val);
  });

  return str;
}

function normalizeEulerExponentials(source) {
  const s = String(source ?? '');
  let out = '';
  for (let i = 0; i < s.length;) {
    // Also convert exp(argument), which the logarithm adapter may have rewritten
    // into e^(argument), back into Nerdamer's symbolic exponential function.
    if (/^\be\s*\^\s*/.test(s.slice(i))) {
      const m = s.slice(i).match(/^\be\s*\^\s*/);
      const start = i + m[0].length;
      if (s[start] === '(') {
        let depth = 0, end = -1;
        for (let j = start; j < s.length; j++) {
          if (s[j] === '(') depth++;
          else if (s[j] === ')' && --depth === 0) { end = j; break; }
        }
        if (end >= 0) {
          out += `exp(${s.slice(start + 1, end)})`;
          i = end + 1;
          continue;
        }
      }
      const atom = s.slice(start).match(/^[A-Za-z_][A-Za-z_0-9]*|^\d+(?:\.\d+)?/);
      if (atom) {
        out += `exp(${atom[0]})`;
        i = start + atom[0].length;
        continue;
      }
    }
    out += s[i++];
  }
  return out;
}

function canonicalizeMatrixLiteral(text){
  let s=String(text??'').trim();
  let changed=true;
  while(changed){
    changed=false;
    for(let i=0;i<s.length;i++){
      if(s[i]!=='[')continue;
      let depth=0,end=-1;
      for(let j=i;j<s.length;j++){
        if(s[j]==='[')depth++; else if(s[j]===']'){depth--;if(depth===0){end=j;break;}}
      }
      if(end<0)break;
      const inside=s.slice(i+1,end);
      let p=0,b=0,c=0,hasRowSep=false;
      for(const ch of inside){if(ch==='(')p++;else if(ch===')')p--;else if(ch==='[')b++;else if(ch===']')b--;else if(ch==='{')c++;else if(ch==='}')c--;else if(ch===';'&&p===0&&b===0&&c===0){hasRowSep=true;break;}}
      if(hasRowSep){
        const rows=matrixRows('['+inside+']');
        if(rows.length && rows.every(r=>r.length===rows[0].length)) {
          s=s.slice(0,i)+`matrix(${rows.map(r=>`[${r.join(',')}]`).join(',')})`+s.slice(end+1);
          changed=true; break;
        }
      }
    }
  }
  // Also canonicalize nested row-array notation such as [[1,2],[3,4]],
  // including assignment form A=[[1,2],[3,4]].
  const trimmed=s.trim();
  const assignment=trimmed.match(/^([A-Za-z_]\w*)\s*=\s*(\[\s*\[.*\]\s*\])$/s);
  const candidate=assignment?assignment[2]:trimmed;
  if(/^\[\s*\[.*\]\s*\]$/s.test(candidate)){
    const rows=matrixRows(candidate);
    if(rows.length && rows.every(row=>row.length===rows[0].length)){
      const literal=`matrix(${rows.map(row=>`[${row.join(',')}]`).join(',')})`;
      return assignment?`${assignment[1]}=${literal}`:literal;
    }
  }
  return s;
}
function splitArgs(s){const out=[];let start=0,depth=0;for(let i=0;i<s.length;i++){const c=s[i];if(c==='('||c==='[')depth++;else if(c===')'||c===']')depth--;else if(c===','&&depth===0){out.push(s.slice(start,i).trim());start=i+1}}out.push(s.slice(start).trim());return out.filter(Boolean)}
function parseCall(s){const m=String(s).match(/^([A-Za-z_]\w*)\s*\((.*)\)$/s);return m?{name:m[1].toLowerCase(),args:splitArgs(m[2])}:null}
function splitMatrixTopLevel(text, separator=',') {
  const out=[]; let start=0, p=0, b=0, c=0;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(ch==='(')p++; else if(ch===')')p--;
    else if(ch==='[')b++; else if(ch===']')b--;
    else if(ch==='{')c++; else if(ch==='}')c--;
    else if(ch===separator && p===0 && b===0 && c===0){out.push(text.slice(start,i).trim());start=i+1;}
  }
  out.push(text.slice(start).trim());
  return out.filter(Boolean);
}
function stripOuterPair(text, open='[', close=']'){
  const s=String(text??'').trim();
  if(!s.startsWith(open)||!s.endsWith(close))return s;
  let depth=0;
  for(let i=0;i<s.length;i++){
    if(s[i]===open)depth++;
    else if(s[i]===close){depth--;if(depth===0&&i!==s.length-1)return s;}
  }
  return depth===0?s.slice(1,-1).trim():s;
}
function matrixRows(text){
  let s=String(text??'').trim();
  // Accept matrix([1,2],[3,4]), matrix(1,2;3,4), [[1,2],[3,4]], and [1,2;3,4].
  const call=parseCall(s);
  if(call?.name==='matrix'){
    const inner=s.slice(s.indexOf('(')+1,-1).trim();
    const semicolonRows=splitMatrixTopLevel(inner,';');
    if(semicolonRows.length>1){
      return semicolonRows.map(row=>splitMatrixTopLevel(stripOuterPair(row),',')).filter(row=>row.length);
    }
    const args=call.args;
    if(args.length>1 && args.every(a=>/^\[.*\]$/s.test(a))){
      return args.map(row=>splitMatrixTopLevel(stripOuterPair(row),',')).filter(row=>row.length);
    }
    if(args.length===1){
      s=args[0];
    } else {
      // matrix(1,2,3) means a single row vector.
      return [args];
    }
  }
  s=s.trim();
  if(s.startsWith('[')&&s.endsWith(']'))s=stripOuterPair(s);
  const semicolonRows=splitMatrixTopLevel(s,';');
  if(semicolonRows.length>1)return semicolonRows.map(row=>splitMatrixTopLevel(stripOuterPair(row),',')).filter(row=>row.length);
  const rowParts=splitMatrixTopLevel(s,',');
  if(rowParts.length>1 && rowParts.every(row=>/^\[.*\]$/s.test(row)))
    return rowParts.map(row=>splitMatrixTopLevel(stripOuterPair(row),',')).filter(row=>row.length);
  return [splitMatrixTopLevel(stripOuterPair(s),',')].filter(row=>row.length);
}

function splitTopLevelMatrixOperator(source, operators){
  const s=String(source??'');let p=0,b=0,c=0,found=-1,foundOp='';
  for(let i=0;i<s.length;i++){
    const ch=s[i];
    if(ch==='(')p++;else if(ch===')')p--;else if(ch==='[')b++;else if(ch===']')b--;else if(ch==='{')c++;else if(ch==='}')c--;
    else if(p===0&&b===0&&c===0&&operators.includes(ch)){
      if(ch==='+'||ch==='-'){
        const prev=s[i-1]||'',next=s[i+1]||'';
        if(i===0||/[+\-*/^(,]/.test(prev))continue;
        if((prev==='e'||prev==='E')&&/\d/.test(s[i-2]||'')&&/\d/.test(next))continue;
      }
      if(ch==='*'&&((s[i-1]||'')==='*'||(s[i+1]||'')==='*'))continue;
      found=i;foundOp=ch;
    }
  }
  if(found<0)return null;
  const left=s.slice(0,found).trim(),right=s.slice(found+1).trim();
  return left&&right?{left,right,op:foundOp}:null;
}
function matrixTex(text){const source=String(text??'').trim();const looks=/^matrix\s*\(/i.test(source)||/^\s*\[\s*\[/.test(source);if(!looks)return null;const rows=matrixRows(source);if(!rows.length||rows.some(r=>r.length!==rows[0].length))return null;const fmt=typeof formatBasicTex==='function'?formatBasicTex:(x=>String(x));return `\\begin{bmatrix}${rows.map(r=>r.map(c=>fmt(c)).join(' & ')).join(' \\\\ ')}\\end{bmatrix}`}

function checkLogDomain(expr) {
  const str = String(expr ?? '');
  
  // Domain check for ln(x), log(x), log10(x) with literal numbers
  const match = str.match(/\b(?:ln|log|log10)\s*\(\s*(-?\d+(?:\.\d+)?)\s*\)/i);
  if (match) {
    const val = parseFloat(match[1]);
    if (val <= 0) {
      return `Error: Domain restriction violation. Argument for ${match[0]} must be > 0`;
    }
  }

  // Domain check for log_y(x)
  const matchBase = str.match(/\blog_(-?\d+(?:\.\d+)?)\s*\(\s*(-?\d+(?:\.\d+)?)\s*\)/i);
  if (matchBase) {
    const base = parseFloat(matchBase[1]);
    const arg = parseFloat(matchBase[2]);
    if (arg <= 0) {
      return `Error: Domain restriction violation. Argument for log_${base}(${arg}) must be > 0`;
    }
    if (base <= 0 || base === 1) {
      return `Error: Domain restriction violation. Base for log_${base}(${arg}) must be > 0 and != 1`;
    }
  }

  return null;
}

function approximateDecimalAsFraction(literal, maxDenominator=10000, tolerance=1e-10) {
  const value=Number(literal);
  if(!Number.isFinite(value))return null;
  const sign=value<0?-1:1;let x=Math.abs(value);
  let h0=0,h1=1,k0=1,k1=0;
  for(let i=0;i<40;i++){
    const a=Math.floor(x),h=a*h1+h0,k=a*k1+k0;
    if(k>maxDenominator)break;
    if(Math.abs(value-sign*h/k)<=Math.max(tolerance,Math.abs(value)*tolerance)){
      const n=sign*h;if(k===1)return String(n);return `${n}/${k}`;
    }
    h0=h1;h1=h;k0=k1;k1=k;
    const remainder=x-a;if(remainder<1e-15)break;x=1/remainder;
  }
  return null;
}
function exactifySimpleDecimalCoefficients(source) {
  const gcd = (a, b) => { while (b) { const t = a % b; a = b; b = t; } return a; };
  return String(source ?? '').replace(/(?<![\w.])(\d+\.\d+)(?![\d.]|[eE][+-]?\d)/g, (literal, _decimal, offset, whole) => {
    const parts = literal.split('.');
    const digits = parts[1];
    if (digits.length > 6) return literal;
    const denominator = 10 ** digits.length;
    const numerator = Number(parts[0]) * denominator + Number(digits);
    const divisor = gcd(Math.abs(numerator), denominator);
    const n = numerator / divisor;
    const d = denominator / divisor;
    if (d > 1000) return literal;
    if (d === 1) return String(n);
    const fraction = `${n}/${d}`;
    const previous = whole[offset - 1] || '';
    const next = whole[offset + literal.length] || '';
    if (previous === '/' || next === '/') return `(${fraction})`;
    if (/[A-Za-z_(]/.test(next)) return `(${fraction})`;
    return fraction;
  });
}
function exactifyDecimalValues(source) {
  let text=exactifySimpleDecimalCoefficients(String(source??''));
  // Long decimal approximations are converted only when a small-denominator
  // rational reproduces the displayed decimal to high precision. Thus 1.3 ->
  // 13/10 and 1.33333333333 -> 4/3, while pi-like decimals stay decimal.
  return text.replace(/(?<![\w.])(\d+\.\d{7,})(?![\w.]|[eE][+-]?\d)/g,(literal,_n,offset,whole)=>{
    const fraction=approximateDecimalAsFraction(literal);
    if(!fraction)return literal;
    const previous=whole[offset-1]||'',next=whole[offset+literal.length]||'';
    if(previous==='/'||next==='/'||/[A-Za-z_(]/.test(next))return `(${fraction})`;
    return fraction;
  });
}
function stripBalancedOuterParens(value){
  let s=String(value??'').trim();
  while(s.startsWith('(')&&s.endsWith(')')){
    let depth=0,wraps=true;
    for(let i=0;i<s.length;i++){
      if(s[i]==='(')depth++;else if(s[i]===')')depth--;
      if(depth===0&&i<s.length-1){wraps=false;break;}
      if(depth<0){wraps=false;break;}
    }
    if(!wraps||depth!==0)break;
    s=s.slice(1,-1).trim();
  }
  return s;
}

class CASEngine{
  constructor(){this.vars=new Map();this.definitionsManaged=false}
  reset(){this.vars.clear();this.definitionsManaged=false;try{window.nerdamer?.clearVars?.()}catch(e){}}
  setDefinitions(entries){
    this.vars.clear();
    const list=entries||[];
    for(const [name, expression] of list) this.vars.set(String(name),String(expression??''));
    this.definitionsManaged=list.length>0;
  }
  setVar(name,value){
    const raw=typeof value==='object'&&value!==null?(value.raw??value.value??''):String(value??'');
    this.vars.set(String(name),raw);
  }
  resolve(expr, alreadyNormalized=false, stack=[]){
    let s=alreadyNormalized?String(expr??''):normalizeInput(expr);
    for(const [name,definition] of this.vars){
      if(stack.includes(name) || name===s) continue;
      // Allow implicit multiplication (4x) while avoiding substitutions inside names (exp, x2, etc.).
      const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      const pattern=new RegExp(`(?<![A-Za-z_])${escaped}(?![A-Za-z_0-9])`,'g');
      if(!pattern.test(s)) continue;
      pattern.lastIndex=0;
      const replacement=this.resolve(definition,true,[...stack,name]);
      s=s.replace(pattern,(match,offset,whole)=>{
        const before=whole[offset-1]||'';
        const needsMultiply=/[0-9.)\]}]/.test(before);
        return `${needsMultiply?'*':''}(${replacement})`;
      });
    }
    return s;
  }
  findTopLevelEquals(source){
    let depth=0;
    for(let i=0;i<source.length;i++){
      const ch=source[i];
      if(ch==='('||ch==='['||ch==='{')depth++;
      else if(ch===')'||ch===']'||ch==='}')depth--;
      else if(ch==='='&&depth===0&&source[i-1]!=='='&&source[i+1]!=='='&&source[i-1]!=='<'&&source[i-1]!=='>'&&source[i-1]!=='!')return i;
    }
    return -1;
  }
  equationDifference(equation){
    const i=this.findTopLevelEquals(String(equation));
    if(i<0)return String(equation);
    return `((${String(equation).slice(0,i)})-(${String(equation).slice(i+1)}))`;
  }
  solveOne(args){
    const equation=String(args[0]??'').trim();
    const variable=String(args[1]||'x').trim();
    if(!equation)return {value:'Error: solve() needs an equation or expression',raw:'',kind:'error'};
    try{
      const solved=nerdamer(`solve(${this.equationDifference(equation)},${variable})`);
      const text=this.solutionText(solved,variable);
      return {value:text,raw:text,kind:'symbolic'};
    }catch(e){return {value:`Error: ${e.message||e}`,raw:'',kind:'error'};}
  }
  solutionText(solution, variable='x'){
    const text=this.textOf(solution).trim();
    if(!text)return `${variable} = []`;
    if(/^\[.*\]$/.test(text))return `${variable} = ${text}`;
    return text.includes('=')?text:`${variable} = ${text}`;
  }
  solveSystem(source){
    const text=String(source??'').trim();
    if(!text)return {value:'Error: solveeqs() needs a list of equations',raw:'',kind:'error'};
    try{
      const body=text.replace(/^\s*\[/,'').replace(/\]\s*$/,'').trim();
      const equations=[];let start=0,depth=0;
      for(let i=0;i<body.length;i++){
        const ch=body[i];
        if(ch==='('||ch==='['||ch==='{')depth++;
        else if(ch===')'||ch===']'||ch==='}')depth--;
        else if((ch===';'||ch===',')&&depth===0){const part=body.slice(start,i).trim();if(part)equations.push(part);start=i+1;}
      }
      const tail=body.slice(start).trim();if(tail)equations.push(tail);
      if(!equations.length)throw new Error('No equations were provided');
      if(equations.some(eq=>this.findTopLevelEquals(eq)<0))throw new Error('Each item must be an equation, for example [x+y=3; x-y=1]');
      if(typeof nerdamer.solveEquations!=='function')throw new Error('This Nerdamer build does not expose solveEquations()');
      // The bundled Nerdamer 1.x API can return unnamed symbols unless this option is enabled.
      try{nerdamer.set?.('SOLUTIONS_AS_OBJECT',true)}catch(_){}
      const solved=nerdamer.solveEquations(equations);
      const formatObject=obj=>Object.entries(obj||{}).map(([name,value])=>`${name} = ${this.textOf(value)}`).join(', ');
      const formatOne=entry=>{
        if(Array.isArray(entry)&&entry.length>=2)return `${entry[0]} = ${this.textOf(entry[1])}`;
        if(entry&&typeof entry==='object'&&typeof entry.text!=='function'){
          const pairs=Object.entries(entry);
          if(pairs.length)return formatObject(entry);
        }
        return this.textOf(entry);
      };
      let output='';
      if(Array.isArray(solved)) {
        const isPairList=solved.length>0&&solved.every(item=>Array.isArray(item)&&item.length>=2&&typeof item[0]==='string');
        output=solved.map(formatOne).filter(Boolean).join(isPairList?', ':'; ');
      }
      else if(solved&&typeof solved==='object'&&typeof solved.text!=='function') output=formatObject(solved);
      else output=this.textOf(solved);
      if(!output)throw new Error('No solution was returned; the system may be inconsistent or unsupported');
      return {value:output,raw:output,kind:'symbolic'};
    }catch(e){return {value:`Error: ${e.message||e}`,raw:'',kind:'error'};}
  }
  eval(expr){
    if (String(expr ?? '').trim() === 'e') {
      return { value: '2.718281828459045', raw: '2.718281828459045', kind: 'numeric' };
    }
    const domainError = checkLogDomain(expr);
    if(domainError) return {value: domainError, raw: domainError, kind: 'error'};

    const normalized=normalizeInput(expr);
    // Do not rewrite a bracketed system of equations as a matrix literal.
    const raw=/^\s*(?:solve|solveeq|solveeqs|solvesystem)\s*\(/i.test(normalized)?normalized:canonicalizeMatrixLiteral(normalized);if(!raw)return {value:'',kind:'empty'};
    const assignment=raw.match(/^([A-Za-z_]\w*)\s*=\s*(?![=])(.*)$/s);
    if(assignment&&!/^solve\s*\(/i.test(raw)){
      const name=assignment[1],rhs=assignment[2];
      if(!rhs.trim())return {value:'',kind:'empty'};
      if(!this.definitionsManaged)this.setVar(name,rhs);
      const value=this.eval(rhs);
      if(value.kind==='error')return value;
      return {...value,assignment:name};
    }
    if(/^[A-Za-z_]\w*$/.test(raw)&&this.vars.has(raw))return this.eval(this.vars.get(raw));
    const eqIndex=this.findTopLevelEquals(raw);
    if(eqIndex>=0){
      const left=this.resolve(raw.slice(0,eqIndex),true), right=this.resolve(raw.slice(eqIndex+1),true);
      try{
        const difference=nerdamer(`simplify((${left})-(${right}))`);
        const exact=this.textOf(difference).trim();
        if(exact==='0')return {value:'true',raw:'true',kind:'boolean'};
        try{
          const decimal=nerdamer(`(${left})-(${right})`).evaluate().text('decimals',14);
          const numeric=Number(decimal);
          if(Number.isFinite(numeric)){const truth=Math.abs(numeric)<1e-12;return {value:String(truth),raw:String(truth),kind:'boolean'};}
        }catch(_){}
        return {value:`${left} = ${right}`,raw:`${left} = ${right}`,kind:'symbolic'};
      }catch(e){return {value:`Error: ${e.message||e}`,raw:'',kind:'error'};}
    }
    return this.evaluate(raw);
  }
  evaluate(raw){
    const initialCall=parseCall(raw);
    const preserveSolverSymbols=initialCall&&['solve','solveeq','solveeqs','solvesystem'].includes(initialCall.name);
    const resolved=preserveSolverSymbols?raw:this.resolve(raw,true);const call=parseCall(resolved);try{
    if(call){const a=call.args.map(x=>['solve','solveeq','solveeqs','solvesystem'].includes(call.name)?x:this.resolve(x,true));switch(call.name){
      case 'simplify':return this.result(nerdamer(`simplify(${a[0]})`));
      case 'factor':return this.result(nerdamer(`factor(${a[0]})`));
      case 'expand':return this.result(nerdamer(`expand(${a[0]})`));
      case 'solve':return this.solveOne(a);
      case 'solvesystem': case 'solveeq': case 'solveeqs': return this.solveSystem(a.join(';'));
      case 'integrate':return this.withIntegrationConstant(this.result(nerdamer(`integrate(${a[0]},${a[1]||'x'})`)));
      case 'defint':return this.definiteIntegral(a);
      case 'diff':return this.result(a.length>=3?nerdamer(`diff(${a[0]},${a[1]||'x'},${a[2]})`):nerdamer(`diff(${a[0]},${a[1]||'x'})`));
      case 'diffn':return this.result(nerdamer(`diff(${a[0]},${a[1]||'x'},${a[2]||'2'})`));
      case 'limit':return this.result(nerdamer(`limit(${a[0]},${a[1]||'x'},${a[2]||'0'})`));
      case 'sum':return this.sum(a);
      case 'product':return this.product(a);
      case 'matrix':return this.matrixResult(raw);
      case 'imatrix':return this.matrixOrScalar(nerdamer(`imatrix(${a[0]})`));
      case 'det':return this.scalarLinearAlgebra('det',a[0]);
      case 'inverse': case 'invert':return this.linearMatrixResult(this.inverseMatrix(a[0]));
      case 'transpose':return this.linearMatrixResult(this.transposeMatrix(a[0]));
      case 'trace':return this.scalarLinearAlgebra('trace',a[0]);
      case 'rank':return this.scalarLinearAlgebra('rank',a[0]);
      case 'augment':return this.linearMatrixResult(this.augmentMatrix(a[0],a[1]));
      case 'dot':return this.vectorScalar('dot',a[0],a[1]);
      case 'cross':return this.linearMatrixResult(this.crossVector(a[0],a[1]));
      case 'ref':return this.linearMatrixResult(this.refMatrix(a[0]));
      case 'rref':return this.linearMatrixResult(this.rrefMatrix(a[0]));
      case 'nullspace':{const ns=this.nullspaceMatrix(a[0]);return ns.rows.length?this.linearMatrixResult(ns):{value:'{0}',raw:'{0}',kind:'symbolic',tex:'\\{\\mathbf{0}\\}'};}
      case 'cofactor':return this.linearMatrixResult(this.cofactorMatrix(a[0]));
      case 'adjugate':return this.linearMatrixResult(this.adjugateMatrix(a[0]));
      case 'balance': case 'balancechem': return this.balanceChemistry(a[0]);
      case 'completesquare': case 'sqcomp': return this.result(nerdamer(`sqcomp(${a[0]}${a[1]?','+a[1]:''})`));
      case 'laplace':return this.result(nerdamer(`laplace(${a[0]},${a[1]||'t'},${a[2]||'s'})`));
      case 'ilaplace':return this.result(nerdamer(`ilaplace(${a[0]},${a[1]||'s'},${a[2]||'t'})`));
      case 'sin':case 'cos':case 'tan':case 'sec':case 'csc':case 'cot':
      case 'asin':case 'acos':case 'atan':case 'acsc':case 'asec':case 'acot':
      case 'sinh':case 'cosh':case 'tanh':case 'asinh':case 'acosh':case 'atanh':case 'acsch':case 'asech':case 'acoth':
        return this.result(nerdamer(`${call.name}(${a[0]})`));
      case 'atan2':return this.result(nerdamer(`atan2(${a[0]},${a[1]})`));
      case 'arcsin':return this.result(nerdamer(`asin(${a[0]})`));
      case 'arccos':return this.result(nerdamer(`acos(${a[0]})`));
      case 'arctan':return this.result(nerdamer(`atan(${a[0]})`));
      case 'arccsc':return this.result(nerdamer(`acsc(${a[0]})`));
      case 'arcsec':return this.result(nerdamer(`asec(${a[0]})`));
      case 'arccot':return this.result(nerdamer(`acot(${a[0]})`));
      // normalizeLogarithmicInput has already translated ln(x) to Nerdamer's
      // natural-log primitive log(x). Do not wrap it in log() a second time.
      case 'ln': case 'log': return this.result(nerdamer(`log(${a[0]})`));
      case 'log10': return this.result(nerdamer(`log(${a[0]})/log(10)`));
      case 'exp': return this.result(nerdamer(`exp(${a[0]})`));
    }}
    return this.result(nerdamer(resolved));
  }catch(e){return {value:`Error: ${e.message||e}`,raw:'',kind:'error'}}}
  definiteIntegral(a){
    if(a.length<4)return {value:'Error: defint requires expression, variable, lower, upper',raw:'',kind:'error'};
    const [expr,variable,lower,upper]=a;
    const v=(variable||'x').trim();
    try{
      // The browser bundle shipped with this project is Nerdamer 1.x. Its
      // defint notation is inconsistent across builds, so evaluate the
      // mathematically equivalent F(upper)-F(lower) path explicitly.
      const antiderivative=nerdamer(`integrate(${expr},${v})`);
      const upperValue=antiderivative.sub(v,upper);
      const lowerValue=antiderivative.sub(v,lower);
      return this.result(nerdamer(`(${this.textOf(upperValue)})-(${this.textOf(lowerValue)})`));
    }catch(e){
      try{return this.result(nerdamer(`defint(${expr},${v},${lower},${upper})`));}
      catch(f){return {value:`Error: ${f.message||f}`,raw:'',kind:'error'}}
    }
  }
  generic(name,a){try{return this.result(nerdamer(`${name}(${a.join(',')})`))}catch(e){return {value:`Error: ${e.message||e}`,raw:'',kind:'error'}}}
  withIntegrationConstant(result) {
    if (!result || result.kind === 'error' || result.value == null) return result;
    const raw = String(result.raw ?? result.value ?? '').trim();
    if (!raw) return result;
    // Keep the integration constant explicit, and avoid adding it twice if a
    // future CAS build starts returning one itself.
    if (/(?:^|[+\-])\s*C\s*$/.test(raw)) return result;
    const base = raw === '0' ? '' : raw;
    const integrated = base ? `${base} + C` : 'C';
    return { ...result, value: integrated, raw: integrated, kind: result.kind || 'symbolic' };
  }
  approximate(result) {
    const raw = String(result?.raw ?? result?.value ?? '').trim();
    if (!raw || result?.kind === 'error' || result?.kind === 'chemistry') return result;
    const approximateScalar=(source)=>{
      const input=String(source??'').trim();
      try{
        const expression=nerdamer(normalizeInput(input)).evaluate();
        let value=this.textOf(expression.text('decimals',14));
        if(!value||value===input){const decimal=expression.toDecimal?.();if(decimal!=null&&String(decimal)!=='[object Object]')value=String(decimal);}
        return value||input;
      }catch(_){return input;}
    };
    if(result.kind==='matrix'){
      try{
        const rows=Array.isArray(result.rows)&&result.rows.length?result.rows:this.matrixData(raw);
        if(!rows||!rows.length)return result;
        const approxRows=rows.map(row=>row.map(approximateScalar));
        const value=`matrix(${approxRows.map(row=>`[${row.join(',')}]`).join(',')})`;
        return {...result,value,raw:value,rows:approxRows,approximate:true};
      }catch(_){return {...result,approximate:true};}
    }
    try {
      const value=approximateScalar(raw);
      return { ...result, value: value || raw, raw, kind: result.kind || 'numeric', approximate: true };
    } catch (e) {
      return { ...result, approximate: true };
    }
  }
  result(r, kind = 'symbolic') {
    if (this.isMatrixEntity(r)) return this.matrixOrScalar(r);

    // Keep exact CAS forms (fractions, radicals, and symbolic constants) as the
    // default. Some Nerdamer simplifications emit terminating decimal
    // coefficients (for example 0.5*sqrt(2) or 0.5*x) even when the exact
    // rational coefficient is known. Convert only decimals whose reduced
    // denominator is small, avoiding false rationalization of pi-like values.
    const raw = exactifyDecimalValues(this.textOf(r));
    if (this.containsMatrix(raw)) return this.matrixOrScalarText(raw);
    return { value: raw, raw, kind };
  }
  isMatrixEntity(r){
    if(!r||typeof r!=='object') return false;
    if(String(r.dataType||'').toUpperCase()==='MATRIX') return true;
    if(String(r.constructor?.name||'').toLowerCase()==='matrix') return true;
    return Array.isArray(r.elements) && r.elements.length>0 && Array.isArray(r.elements[0]);
  }
  containsMatrix(text){return /\bmatrix\s*\(/i.test(String(text||''));}
  textOf(r) {
    if (r == null) return '';
    let t = typeof r === 'string' ? r : typeof r.text === 'function' ? r.text() : typeof r.toString === 'function' ? r.toString() : String(r);

    const sci = [];
    t = t.replace(/\b(\d+(?:\.\d+)?)[eE]([+-]?\d+)\b/g, (m) => {
      sci.push(m);
      return `__SCI_${sci.length - 1}__`;
    });

    // 1. Convert internal natural log 'log(' back to 'ln(' for display
    t = t.replace(/\blog\s*\(/g, 'ln(');

    // Lowercase e is normalized to a numeric literal before Nerdamer sees it.
    // Leave uppercase E untouched because it may be a genuine symbolic variable.

    sci.forEach((val, idx) => {
      t = t.replace(`__SCI_${idx}__`, val);
    });

    return t;
  }
  scalarExpr(text){return exactifyDecimalValues(this.textOf(nerdamer(`simplify(${text})`)));}
  scalarLinearAlgebra(op,expr){
    const M=Array.isArray(expr)?expr.map(row=>row.slice()):this.matrixData(expr); if(!M)return {value:`Error: ${op} requires a matrix`,raw:'',kind:'error'};
    try{
      if(op==='trace'){if(M.length!==M[0].length)throw new Error('trace requires a square matrix');let t='0';for(let i=0;i<M.length;i++)t=`${t}+(${M[i][i]})`;return this.result(nerdamer(`simplify(${t})`));}
      if(op==='det'){return this.result(nerdamer(`simplify(${this.detExpr(M)})`));}
      if(op==='rank'){const rank=this.rrefMatrix(M).rank;return {value:String(rank),raw:String(rank),kind:'numeric'};}
    }catch(e){return {value:`Error: ${e.message||e}`,raw:'',kind:'error'}}
    return {value:`Error: unsupported ${op}`,raw:'',kind:'error'};
  }
  detExpr(M){
    const n=M.length;if(!n)return '1';
    if(M.some(row=>row.length!==n))throw new Error('determinant requires a square matrix');
    if(n===1)return `(${M[0][0]})`;
    // Gaussian elimination computes a determinant in O(n^3). The old recursive
    // cofactor expansion was exponential and became unusably slow on larger matrices.
    const A=this.normalizeMatrixCells(M);let sign=1,det='1';
    for(let c=0;c<n;c++){
      let pivot=c;
      while(pivot<n&&this.scalarExpr(A[pivot][c])==='0')pivot++;
      if(pivot===n)return '0';
      if(pivot!==c){[A[c],A[pivot]]=[A[pivot],A[c]];sign*=-1;}
      const pv=A[c][c];det=this.scalarExpr(`(${det})*(${pv})`);
      for(let r=c+1;r<n;r++){
        if(this.scalarExpr(A[r][c])==='0')continue;
        const factor=this.scalarExpr(`(${A[r][c]})/(${pv})`);
        for(let j=c+1;j<n;j++)A[r][j]=this.scalarExpr(`(${A[r][j]})-(${factor})*(${A[c][j]})`);
        A[r][c]='0';
      }
    }
    return sign<0?this.scalarExpr(`-(${det})`):det;
  }
  normalizeMatrixCells(M){return M.map(r=>r.map(x=>this.scalarExpr(x)));}
  rrefMatrix(expr){
    let M=Array.isArray(expr)?expr.map(r=>r.slice()):this.matrixData(expr);if(!M)throw new Error('rref requires a matrix');
    M=this.normalizeMatrixCells(M);const rows=M.length,cols=M[0].length;let pivotRow=0;
    for(let c=0;c<cols&&pivotRow<rows;c++){
      let pivot=-1;for(let r=pivotRow;r<rows;r++){if(this.scalarExpr(M[r][c])!=='0'){pivot=r;break;}}
      if(pivot<0)continue;[M[pivotRow],M[pivot]]=[M[pivot],M[pivotRow]];
      const pv=M[pivotRow][c];M[pivotRow]=M[pivotRow].map(x=>this.scalarExpr(`(${x})/(${pv})`));
      for(let r=0;r<rows;r++){if(r===pivotRow)continue;const f=M[r][c];if(this.scalarExpr(f)==='0')continue;M[r]=M[r].map((x,j)=>this.scalarExpr(`(${x})-(${f})*(${M[pivotRow][j]})`));}
      pivotRow++;
    }
    return {rows:M,rank:pivotRow};
  }
  refMatrix(expr){
    let M=Array.isArray(expr)?expr.map(r=>r.slice()):this.matrixData(expr);if(!M)throw new Error('ref requires a matrix');
    M=this.normalizeMatrixCells(M);const rows=M.length,cols=M[0].length;let pr=0;
    for(let c=0;c<cols&&pr<rows;c++){
      let pivot=-1;for(let r=pr;r<rows;r++){if(this.scalarExpr(M[r][c])!=='0'){pivot=r;break;}}if(pivot<0)continue;
      [M[pr],M[pivot]]=[M[pivot],M[pr]];const pv=M[pr][c];M[pr]=M[pr].map(x=>this.scalarExpr(`(${x})/(${pv})`));
      for(let r=pr+1;r<rows;r++){const f=M[r][c];if(this.scalarExpr(f)==='0')continue;M[r]=M[r].map((x,j)=>this.scalarExpr(`(${x})-(${f})*(${M[pr][j]})`));}pr++;
    }return {rows:M,rank:pr};
  }
  inverseMatrix(expr){
    const M=Array.isArray(expr)?expr.map(row=>row.slice()):this.matrixData(expr);
    if(!M||!M.length||M.length!==M[0].length)throw new Error('inverse requires a square matrix');
    const n=M.length;
    // Check the original matrix. Checking the augmented [A|I] is incorrect:
    // the identity block makes the augmented matrix full row-rank even if A is singular.
    if(this.rrefMatrix(M).rank<n)throw new Error('matrix is singular and cannot be inverted');
    const aug=M.map((r,i)=>r.concat(Array.from({length:n},(_,j)=>i===j?'1':'0')));
    const rr=this.rrefMatrix(aug);
    return {rows:rr.rows.map(r=>r.slice(n)),rank:n};
  }
  transposeMatrix(expr){const M=Array.isArray(expr)?expr.map(row=>row.slice()):this.matrixData(expr);if(!M||!M.length)throw new Error('transpose requires a matrix');return {rows:M[0].map((_,j)=>M.map(r=>r[j])),rank:Math.min(M.length,M[0].length)};}
  augmentMatrix(a,b){const A=Array.isArray(a)?a.map(row=>row.slice()):this.matrixData(a),B=Array.isArray(b)?b.map(row=>row.slice()):this.matrixData(b);if(!A||!B||A.length!==B.length)throw new Error('augment requires matrices with the same number of rows');return {rows:A.map((r,i)=>r.concat(B[i])),rank:Math.min(A.length,A[0].length+B[0].length)};}
  vectorData(expr){const M=this.matrixData(expr);if(M)return M.flat();const s=String(this.resolve(expr)).replace(/^\(|\)$/g,'');if(/^\[.*\]$/.test(s))return s.slice(1,-1).split(',').map(x=>x.trim()).filter(Boolean);return null;}
  vectorScalar(op,a,b){const A=this.vectorData(a),B=this.vectorData(b);if(!A||!B||A.length!==B.length)return {value:`Error: ${op} requires equal-length vectors`,raw:'',kind:'error'};try{if(op==='dot')return this.result(nerdamer(`simplify(${A.map((x,i)=>`(${x})*(${B[i]})`).join('+')})`));}catch(e){return {value:`Error: ${e.message||e}`,raw:'',kind:'error'}}return {value:`Error: unsupported ${op}`,raw:'',kind:'error'};}
  crossVector(a,b){const A=this.vectorData(a),B=this.vectorData(b);if(!A||!B||A.length!==3||B.length!==3)throw new Error('cross requires two 3-dimensional vectors');return {rows:[[this.scalarExpr(`(${A[1]})*(${B[2]})-(${A[2]})*(${B[1]})`),this.scalarExpr(`(${A[2]})*(${B[0]})-(${A[0]})*(${B[2]})`),this.scalarExpr(`(${A[0]})*(${B[1]})-(${A[1]})*(${B[0]})`)]],rank:1};}
  cofactorMatrix(expr){const M=Array.isArray(expr)?expr.map(row=>row.slice()):this.matrixData(expr);if(!M||!M.length||M.length!==M[0].length)throw new Error('cofactor requires a square matrix');const n=M.length;return {rows:M.map((_,i)=>M.map((__,j)=>{const minor=M.filter((_,r)=>r!==i).map(row=>row.filter((_,c)=>c!==j));const sign=(i+j)%2===0?'1':'-1';return this.scalarExpr(`(${sign})*(${this.detExpr(minor)})`);})),rank:n};}
  adjugateMatrix(expr){const C=this.cofactorMatrix(expr);return {rows:C.rows[0].map((_,j)=>C.rows.map(r=>r[j])),rank:C.rank};}
  nullspaceMatrix(expr){
    const rr=this.rrefMatrix(expr),R=rr.rows,rows=R.length,cols=R[0].length,pivots=[];for(let i=0;i<rows;i++){const j=R[i].findIndex(x=>this.scalarExpr(x)!=='0');if(j>=0)pivots.push(j);}const free=[];for(let j=0;j<cols;j++)if(!pivots.includes(j))free.push(j);const basis=free.map(f=>{const v=Array(cols).fill('0');v[f]='1';for(let i=0;i<pivots.length;i++)v[pivots[i]]=this.scalarExpr(`-(${R[i][f]})`);return v;});return {rows:basis.map(v=>[...v]),rank:rr.rank,nullspace:true};
  }
  linearMatrixResult(obj){
    try{
      const rows=obj?.rows||obj;
      if(!rows||!rows.length)return {value:'matrix()',raw:'matrix()',kind:'matrix',rows:[]};
      const normalized=rows.map(row=>Array.from(row,cell=>exactifyDecimalValues(String(cell).trim())));
      if(!normalized[0]?.length||normalized.some(row=>row.length!==normalized[0].length))throw new Error('matrix rows must all have the same number of columns');
      const value=`matrix(${normalized.map(row=>`[${row.join(',')}]`).join(',')})`;
      return {value,raw:value,kind:'matrix',rows:normalized};
    }catch(e){return {value:`Error: ${e.message||e}`,raw:'',kind:'error'}}
  }
  matrixResult(source){
    try{
      const rows=matrixRows(String(source??''));
      if(!rows.length || !rows[0].length) throw new Error('matrix() needs at least one row and one column');
      const width=rows[0].length;
      if(rows.some(row=>row.length!==width)) throw new Error('matrix rows must all have the same number of columns');
      const normalized=rows.map(row=>row.map(cell=>exactifyDecimalValues(this.resolve(cell,true).trim())));
      const value=`matrix(${normalized.map(row=>`[${row.join(',')}]`).join(',')})`;
      return {value,raw:value,kind:'matrix',rows:normalized};
    }catch(e){return {value:`Error: ${e.message||e}`,raw:'',kind:'error'};}
  }
  matrixData(expression, stack=[]){
    let source=stripBalancedOuterParens(String(expression??'').trim());
    if(!source)return null;
    // Resolve named matrix definitions recursively, including definitions whose
    // value is itself a matrix operation (R=rref(matrix(...)); transpose(R)).
    if(/^[A-Za-z_]\w*$/.test(source) && this.vars.has(source)){
      if(stack.includes(source))throw new Error(`cyclic matrix definition: ${[...stack,source].join(' -> ')}`);
      return this.matrixData(this.vars.get(source),[...stack,source]);
    }
    // Support matrix arithmetic as inputs to other linear-algebra functions,
    // e.g. transpose(A*B), rref(A+matrix(...)), and A/2.
    for(const operators of [['+','-'],['*','/']]){
      const split=splitTopLevelMatrixOperator(source,operators);
      if(!split)continue;
      const L=this.matrixData(split.left,stack),R=this.matrixData(split.right,stack);
      if(!L&&!R)return null;
      const scalar=(text)=>exactifyDecimalValues(this.resolve(text,true).trim());
      if(split.op==='+'||split.op==='-'){
        if(L&&R){
          if(L.length!==R.length||L[0].length!==R[0].length)throw new Error('matrix addition/subtraction requires matching dimensions');
          return L.map((row,i)=>row.map((x,j)=>this.scalarExpr(`(${x})${split.op}(${R[i][j]})`)));
        }
        if(L){const k=scalar(split.right);return L.map(row=>row.map(x=>this.scalarExpr(`(${x})${split.op}(${k})`)));}
        const k=scalar(split.left);return R.map(row=>row.map(x=>this.scalarExpr(`(${k})${split.op}(${x})`)));
      }
      if(split.op==='*'){
        if(L&&R){
          if(L[0].length!==R.length)throw new Error(`matrix multiplication dimension mismatch: ${L.length}×${L[0].length} cannot multiply ${R.length}×${R[0].length}`);
          return L.map(row=>R[0].map((_,j)=>{let sum='0';for(let k=0;k<R.length;k++)sum=this.scalarExpr(`(${sum})+(${row[k]})*(${R[k][j]})`);return sum;}));
        }
        if(L){const k=scalar(split.right);return L.map(row=>row.map(x=>this.scalarExpr(`(${x})*(${k})`)));}
        const k=scalar(split.left);return R.map(row=>row.map(x=>this.scalarExpr(`(${k})*(${x})`)));
      }
      if(split.op==='/'&&L&&!R){const k=scalar(split.right);return L.map(row=>row.map(x=>this.scalarExpr(`(${x})/(${k})`)));}
      return null;
    }
    const call=parseCall(source);
    if(call){
      const name=call.name;
      if(name==='matrix'){
        const rows=matrixRows(source);
        if(!rows.length||!rows[0]?.length||rows.some(row=>row.length!==rows[0].length))throw new Error('matrix rows must all have the same number of columns');
        return rows.map(row=>row.map(cell=>exactifyDecimalValues(String(this.resolve(cell,true)).trim())));
      }
      if(name==='transpose'){
        const M=this.matrixData(call.args[0],stack);if(!M||!M.length)return null;
        return M[0].map((_,j)=>M.map(row=>row[j]));
      }
      if(name==='rref'||name==='ref'){
        const M=this.matrixData(call.args[0],stack);if(!M||!M.length)return null;
        return (name==='rref'?this.rrefMatrix(M):this.refMatrix(M)).rows;
      }
      if(name==='inverse'||name==='invert'){
        const M=this.matrixData(call.args[0],stack);if(!M)return null;
        return this.inverseMatrix(M).rows;
      }
      if(name==='cofactor'||name==='adjugate'){
        const M=this.matrixData(call.args[0],stack);if(!M)return null;
        return (name==='cofactor'?this.cofactorMatrix(M):this.adjugateMatrix(M)).rows;
      }
      if(name==='nullspace'){
        const M=this.matrixData(call.args[0],stack);if(!M)return null;
        return this.nullspaceMatrix(M).rows;
      }
      if(name==='augment'){
        const A=this.matrixData(call.args[0],stack),B=this.matrixData(call.args[1],stack);if(!A||!B)return null;
        return this.augmentMatrix(A,B).rows;
      }
    }
    // Assignment substitution may wrap a definition in parentheses, so parse
    // once more after resolving only expressions that are not known matrix calls.
    const resolved=stripBalancedOuterParens(this.resolve(source,true));
    if(resolved!==source){
      const nested=parseCall(resolved);
      if(nested&&['matrix','transpose','rref','ref','inverse','invert','cofactor','adjugate','nullspace','augment'].includes(nested.name))return this.matrixData(resolved,stack);
      if(/^[A-Za-z_]\w*$/.test(resolved)&&this.vars.has(resolved))return this.matrixData(resolved,stack);
    }
    // Do not mistake an ordinary scalar such as 2 or an unknown symbol x for
    // a 1×1 matrix. Matrix data must originate from matrix(...) or bracket syntax.
    if(!/^matrix\s*\(/i.test(resolved)&&!/^\s*\[/.test(resolved))return null;
    const rows=matrixRows(resolved);
    if(!rows.length || !rows[0]?.length || rows.some(row=>row.length!==rows[0].length))return null;
    return rows.map(row=>row.map(cell=>exactifyDecimalValues(String(this.resolve(cell,true)).trim())));
  }
  matrixOrScalar(r){
    const raw=this.textOf(r);
    if(this.isMatrixEntity(r) || this.containsMatrix(raw)) return this.matrixOrScalarText(raw);
    return {value:raw,raw,kind:'symbolic'};
  }
  matrixOrScalarText(raw){
    const normalized=this.normalizeMatrixExpression(String(raw));
    const rows=matrixRows(normalized);
    if(rows.length && rows[0]?.length && rows.every(row=>row.length===rows[0].length)){
      const clean=rows.map(row=>row.map(cell=>exactifyDecimalValues(String(cell).trim())));
      const value=`matrix(${clean.map(row=>`[${row.join(',')}]`).join(',')})`;
      return {value,raw:value,kind:'matrix',rows:clean};
    }
    return {value:String(raw),raw:String(raw),kind:'symbolic'};
  }
  normalizeMatrixExpression(raw){
    const s=String(raw).trim();
    if(/^matrix\s*\(/i.test(s)) return s;
    const m=s.match(/matrix\s*\(/i);
    if(!m) return s;
    const open=s.indexOf('(',m.index);
    let depth=0,close=-1;
    for(let i=open;i<s.length;i++){
      if(s[i]==='(') depth++; else if(s[i]===')'){depth--; if(depth===0){close=i;break;}}
    }
    if(close<0) return s;
    const before=s.slice(0,m.index).trim();
    const after=s.slice(close+1).trim();
    const factorBefore=before.replace(/[()*\s]+$/g,'').trim();
    const factorAfter=after.replace(/^[*\/\s]+/,'').trim();
    if(factorBefore || factorAfter){
      try{
        const inside=s.slice(m.index,close+1);
        const rows=matrixRows(inside);
        if(rows.length && rows.every(row=>row.length===rows[0].length)){
          const sign=factorBefore ? factorBefore : `1/(${factorAfter})`;
          const scaled=rows.map(row=>row.map(cell=>{try{return this.textOf(nerdamer(`(${sign})*(${cell})`))}catch(e){return `(${sign})*(${cell})`}}));
          return `matrix(${scaled.map(row=>`[${row.join(',')}]`).join(',')})`;
        }
      }catch(e){}
    }
    return s;
  }
  parseChemicalFormula(formula){
    let s=String(formula||'').trim().replace(/\s+/g,'');
    // Accept calculator/LaTeX-style subscripts: H_2, H_{2}, SO_4^{2-}.
    s=s.replace(/_\s*\{\s*(\d+)\s*\}/g,'$1').replace(/_\s*(\d+)/g,'$1');
    s=s.replace(/\^\s*\{\s*(\d+)\s*([+-])\s*\}/g,'^$1$2');
    s=s.replace(/\^\s*(\d+)\s*([+-])/g,'^$1$2');
    let charge=0;
    const cm=s.match(/(?:\^?(\d+)?([+-]))$/);
    if(cm){ charge=(cm[2]==='-'?-1:1)*Number(cm[1]||1); s=s.slice(0,cm.index); }
    s=s.replace(/[·.]/g,'');
    // Square/curly brackets are grouping brackets in chemical formulas.
    const matching={')':'(',']':'[','}':'{'};
    let i=0;
    const parseGroup=(stop)=>{
      const counts={};
      const add=(el,n)=>counts[el]=(counts[el]||0)+n;
      while(i<s.length){
        const ch=s[i];
        if(stop && ch===stop){i++;break;}
        if(ch==='('||ch==='['||ch==='{'){
          const close=ch==='('?')':ch==='['?']':'}'; i++;
          const inner=parseGroup(close);
          let digits=''; while(i<s.length&&/\d/.test(s[i]))digits+=s[i++];
          const mult=digits?Number(digits):1;
          for(const [el,n] of Object.entries(inner))add(el,n*mult);
          continue;
        }
        if(/[A-Z]/.test(ch)){
          let el=s[i++]; if(i<s.length&&/[a-z]/.test(s[i]))el+=s[i++];
          let digits=''; while(i<s.length&&/\d/.test(s[i]))digits+=s[i++];
          add(el,digits?Number(digits):1); continue;
        }
        // Leading hydrate coefficients such as 5H2O are handled as a multiplier
        // by the caller; a stray punctuation mark is invalid rather than silently
        // becoming a phantom element.
        if(ch==='+'||ch==='-'||ch==='^'){i++;continue;}
        throw new Error(`invalid formula ${formula}`);
      }
      return counts;
    };
    const counts=parseGroup(null);
    if(!Object.keys(counts).length)throw new Error(`invalid formula ${formula}`);
    if(charge)counts.__charge=charge;
    return counts;
  }
  splitChemicalSide(side){
    const out=[]; let start=0,p=0,b=0,c=0;
    for(let i=0;i<String(side).length;i++){
      const ch=side[i]; if(ch==='(')p++; else if(ch===')')p--; else if(ch==='[')b++; else if(ch===']')b--; else if(ch==='{')c++; else if(ch==='}')c--;
      else if(ch==='+'&&p===0&&b===0&&c===0){const term=side.slice(start,i).trim();if(term)out.push(term);start=i+1;}
    }
    const last=side.slice(start).trim();if(last)out.push(last);
    return out.map(term=>{const m=term.match(/^(\d+)\s*(.*)$/);return {formula:(m?m[2]:term).trim(),original:term};});
  }
  _chemFrac(n,d=1){
    n=typeof n==='bigint'?n:BigInt(n); d=typeof d==='bigint'?d:BigInt(d);
    if(d<0n){n=-n;d=-d;} const gcd=(a,b)=>{a=a<0n?-a:a;b=b<0n?-b:b;while(b){const t=a%b;a=b;b=t;}return a||1n;};
    const g=gcd(n,d); return {n:n/g,d:d/g};
  }
  _chemAdd(a,b){return this._chemFrac(a.n*b.d+b.n*a.d,a.d*b.d)}
  _chemSub(a,b){return this._chemFrac(a.n*b.d-b.n*a.d,a.d*b.d)}
  _chemMul(a,b){return this._chemFrac(a.n*b.n,a.d*b.d)}
  _chemDiv(a,b){if(b.n===0n)throw new Error('division by zero in stoichiometric reduction');return this._chemFrac(a.n*b.d,a.d*b.n)}
  _chemZero(a){return a.n===0n}
  _chemRref(M){
    const A=M.map(r=>r.map(x=>this._chemFrac(x))), rows=A.length, cols=A[0].length; let pr=0; const pivots=[];
    for(let c=0;c<cols&&pr<rows;c++){
      let pivot=-1; for(let r=pr;r<rows;r++)if(!this._chemZero(A[r][c])){pivot=r;break;} if(pivot<0)continue;
      [A[pr],A[pivot]]=[A[pivot],A[pr]]; const pv=A[pr][c];
      for(let j=0;j<cols;j++)A[pr][j]=this._chemDiv(A[pr][j],pv);
      for(let r=0;r<rows;r++){if(r===pr)continue;const f=A[r][c];if(this._chemZero(f))continue;for(let j=0;j<cols;j++)A[r][j]=this._chemSub(A[r][j],this._chemMul(f,A[pr][j]));}
      pivots.push(c);pr++;
    }
    const text=A.map(r=>r.map(x=>x.d===1n?String(x.n):`${x.n}/${x.d}`)); return {rows:text,rank:pr,pivots,fractions:A};
  }
  _chemNullVector(M){
    const rr=this._chemRref(M), cols=M[0].length, free=[]; for(let c=0;c<cols;c++)if(!rr.pivots.includes(c))free.push(c);
    if(!free.length)throw new Error('no non-zero stoichiometric solution found');
    const f=free[0], v=Array(cols).fill(null).map(()=>this._chemFrac(0)); v[f]=this._chemFrac(1);
    for(let r=0;r<rr.pivots.length;r++)v[rr.pivots[r]]=this._chemFrac(-rr.fractions[r][f].n,rr.fractions[r][f].d);
    const lcm=(a,b)=>{const gcd=(x,y)=>{x=x<0n?-x:x;y=y<0n?-y:y;while(y){const t=x%y;x=y;y=t;}return x||1n;};return (a/gcd(a,b))*b;};
    let L=1n; for(const x of v)L=lcm(L,x.d); let ints=v.map(x=>x.n*(L/x.d));
    const gcdAll=ints.reduce((g,x)=>{x=x<0n?-x:x;while(x){const t=g%x;g=x;x=t;}return g||1n;},0n)||1n; ints=ints.map(x=>x/gcdAll);
    if(ints.some(x=>x<0n))ints=ints.map(x=>-x); if(ints.some(x=>x===0n))throw new Error('degenerate stoichiometric solution');
    return ints.map(x=>Number(x));
  }
  balanceChemistry(equation){
    try{
      const raw=String(equation||'').trim().replace(/\s+/g,' ');
      const arrow=raw.match(/(?:->|=>|=|→|⟶)/); if(!arrow)throw new Error('use balance(reactants -> products)');
      const parts=raw.split(arrow[0]); if(parts.length!==2)throw new Error('equation must have one reaction arrow');
      const left=this.splitChemicalSide(parts[0]), right=this.splitChemicalSide(parts[1]);
      if(!left.length||!right.length)throw new Error('both sides need at least one species');
      const species=[...left,...right], parsed=species.map(x=>this.parseChemicalFormula(x.formula));
      const elements=[...new Set(parsed.flatMap(x=>Object.keys(x).filter(k=>k!=='__charge')))]; if(!elements.length)throw new Error('no chemical elements found');
      const M=elements.map(el=>species.map((_,j)=>{const n=parsed[j][el]||0;return j<left.length?n:-n;}));
      const rr=this._chemRref(M), nums=this._chemNullVector(M);
      const lhs=left.map((sp,i)=>`${nums[i]===1?'':nums[i]}${sp.formula}`).join(' + ');
      const rhs=right.map((sp,i)=>`${nums[left.length+i]===1?'':nums[left.length+i]}${sp.formula}`).join(' + ');
      const balanced=`${lhs} -> ${rhs}`;
      const coefficientNames=species.map((_,i)=>i<26?String.fromCharCode(97+i):`c_${i+1}`);
      const elementEquations=elements.map((el,row)=>{
        const terms=species.map((sp,j)=>{const n=parsed[j][el]||0;if(!n)return '';const sign=j<left.length?'+':'-';return `${sign}${n===1?'':n}${coefficientNames[j]}`;}).filter(Boolean).join('');
        return `${terms.replace(/^\+/,'')}=0`;
      });
      return {value:balanced,raw:balanced,kind:'chemistry',chemistry:{original:raw,equation:balanced,elements,matrix:M,rref:rr.rows,coefficients:nums,coefficientNames,reactants:left.map(x=>x.formula),products:right.map(x=>x.formula),elementEquations,matrixEquation:{coefficients:coefficientNames,rows:M,vector:coefficientNames}}};
    }catch(e){return {value:`Error: ${e.message||e}`,raw:'',kind:'error'}}
  }
  isZeroExpr(x){
    try{return this.textOf(nerdamer(`simplify(${String(x)})`)).replace(/\s+/g,'')==='0';}
    catch(e){return String(x).replace(/\s+/g,'')==='0';}
  }
  rationalParts(x){
    const s=this.textOf(nerdamer(String(x))).replace(/\s+/g,'');
    if(/^[-+]?\d+$/.test(s))return {n:Number(s),d:1};
    const m=s.match(/^(-?\d+)\/(\d+)$/);if(m)return {n:Number(m[1]),d:Number(m[2])};
    const n=Number(s);if(Number.isFinite(n))return {n,d:1};throw new Error(`non-rational coefficient ${s}`);
  }
  gcdInt(a,b){a=Math.abs(a);b=Math.abs(b);while(b){const t=a%b;a=b;b=t;}return a||1;}
  lcmInt(a,b){return Math.abs(a/this.gcdInt(a,b)*b)||1;}
  sum(a){
    if(a.length<4)return {value:`sum(${a.join(', ')})`,kind:'error'};
    const [expr,v,lo,hi]=a.map(x=>String(x).trim());
    try{
      const direct=nerdamer(`sum(${expr},${v},${lo},${hi})`);
      const raw=this.textOf(direct);
      if(/^sum\s*\(/i.test(raw)){
        const closed=this.symbolicPolynomialSum(expr,v,lo,hi);
        if(closed){
          const simplified=nerdamer(`simplify(${closed})`);
          return this.result(simplified);
        }
      }
      return this.result(direct);
    }catch(e){return {value:`Error: ${e.message||e}`,raw:'',kind:'error'}}
  }
  product(a){
    if(a.length<4)return {value:`product(${a.join(', ')})`,kind:'error'};
    const [expr,v,lo,hi]=a.map(x=>String(x).trim());
    try{
      const direct=nerdamer(`product(${expr},${v},${lo},${hi})`);
      const raw=this.textOf(direct);
      if(/^product\s*\(/i.test(raw)){
        const index = v;
        const count = `((${hi})-(${lo})+1)`;
        const parsed = nerdamer(expr);
        const vars = typeof parsed.variables === 'function' ? parsed.variables() : [];
        if(!vars.includes(index)) return this.result(nerdamer(`(${expr})^${count}`));

        // Exact factorial form for Π k, k=a..b.
        if(expr.replace(/\s+/g,'')===index){
          return this.result(nerdamer(`factorial(${hi})/factorial((${lo})-1)`));
        }

        // Do not manufacture a Gamma closed form for arbitrary symbolic
        // products. Nerdamer deliberately preserves symbolic products when
        // the bounds are symbolic, which is safer and more general.
      }
      // Nerdamer intentionally preserves genuinely non-closed symbolic
      // products. Returning that node is safer than inventing a wrong formula.
      return this.result(direct);
    }catch(e){return {value:`Error: ${e.message||e}`,raw:'',kind:'error'}}
  }
  isPolynomialIn(expr,v){
    const cleaned=String(expr).replace(/\s+/g,'');
    if(/\b(sin|cos|tan|sec|csc|cot|sinh|cosh|tanh|log|ln|exp|sqrt|abs|floor|ceil|limit|integrate|diff|sum|product)\s*\(/i.test(cleaned))return false;
    try{
      const e=nerdamer(cleaned);
      return e.variables().includes(v) && e.variables().every(x=>x===v);
    }catch(e){return false;}
  }
  symbolicPolynomialSum(expr,v,lo,hi){
    try{
      const poly=nerdamer(expr).expand();
      const terms=String(this.textOf(poly)).match(/[+-]?[^+-]+/g)?.map(t=>t.trim()).filter(Boolean)||[];
      let total='0';
      for(const term of terms){
        const variablePart=term.match(/^([+-]?(?:\d+(?:\.\d+)?(?:\/\d+)?)?)\*?([A-Za-z_]\w*)(?:\^(\d+))?$/);
        let coeff, power;
        if(variablePart){
          if(variablePart[2]!==v)return null;
          coeff=variablePart[1]===''||variablePart[1]==='+'?'1':variablePart[1]==='-'?'-1':variablePart[1];
          power=variablePart[3]?Number(variablePart[3]):1;
        }else{
          if(!/^[+-]?(?:\d+(?:\.\d+)?(?:\/\d+)?)$/.test(term))return null;
          coeff=term; power=0;
        }
        if(power<0||power>12)return null;
        total += `+(${coeff})*(${this.powerSum(power,lo,hi)})`;
      }
      return total;
    }catch(e){return null;}
  }
  powerSum(n,lo,hi){
    const P={
      0:`(${hi})-(${lo})+1`,
      1:`(${hi})*(${hi}+1)/2-(${lo}-1)*(${lo})/2`,
      2:`(${hi})*(${hi}+1)*(2*${hi}+1)/6-(${lo}-1)*(${lo})*(2*(${lo}-1)+1)/6`,
      3:`(${hi}*(${hi}+1)/2)^2-(((${lo}-1)*${lo}/2)^2)`,
      4:`(${hi})*(${hi}+1)*(2*${hi}+1)*(3*${hi}^2+3*${hi}-1)/30-(${lo}-1)*${lo}*(2*(${lo}-1)+1)*(3*(${lo}-1)^2+3*(${lo}-1)-1)/30`,
      5:`(${hi})^2*(${hi}+1)^2*(2*${hi}^2+2*${hi}-1)/12-(${lo}-1)^2*${lo}^2*(2*(${lo}-1)^2+2*(${lo}-1)-1)/12`
    };
    return P[n]||`sum(${v}^${n},${v},${lo},${hi})`;
  }
  isInt(s){return /^-?\d+$/.test(String(s).trim())}
}
window.CAS_ENGINE=new CASEngine();window.CAS_COMMANDS=COMMANDS;window.CAS_COMMAND_GROUPS=COMMAND_GROUPS;window.CAS_COMMAND_MAP=COMMAND_MAP;
