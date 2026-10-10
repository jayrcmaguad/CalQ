/* * KaTeX renderer. * Input rendering is intentionally NON-EVALUATING. * Output rendering formats the already-evaluated CAS value. */
function texEscapeText(s) {  
  return String(s ?? '')    
    .replace(/\\/g, '\\backslash ')    
    .replace(/([{}])/g, '\\$1');
}

function balanceGroup(text, start, open, close) {  
  if (text[start] !== open) return -1;  
  let depth = 0;  
  for (let i = start; i < text.length; i++) {    
    if (text[i] === open) depth++;    
    else if (text[i] === close) {      
      depth--;      
      if (depth === 0) return i;    
    }  }  
  return -1;
}

function splitTopLevelOnce(text, separator) {  
  let paren = 0, bracket = 0, brace = 0;  
  for (let i = 0; i < text.length; i++) {    
    const ch = text[i];    
    if (ch === '(') paren++;    
    else if (ch === ')') paren--;    
    else if (ch === '[') bracket++;    else if (ch === ']') bracket--;    
    else if (ch === '{') brace++;    else if (ch === '}') brace--;    
    else if (ch === separator && paren === 0 && bracket === 0 && brace === 0) {      
      return [text.slice(0, i).trim(), text.slice(i + 1).trim()];    }  }  
  return null;
}

function formatDivisionTex(text) {  
  const pair = splitTopLevelOnce(text, '/');  
  if (!pair) return null;  
  const [left, right] = pair;  
  if (!left || !right) return null;  
  return `\\frac{${formatBasicTex(left)}}{${formatBasicTex(right)}}`;
}

function formatFunctionArgsTex(name, openArgs) {  
  const lower = name.toLowerCase();  
  const args = splitTopLevelArgs(openArgs);  
  const names = {    
    sqrt: '\\sqrt', sin: '\\sin', cos: '\\cos', tan: '\\tan', sec: '\\sec', csc: '\\csc', cot: '\\cot',    
    asin: '\\arcsin', acos: '\\arccos', atan: '\\arctan', acsc: '\\operatorname{arccsc}', asec: '\\operatorname{arcsec}', acot: '\\operatorname{arccot}',    
    arcsin: '\\arcsin', arccos: '\\arccos', arctan: '\\arctan', arccsc: '\\operatorname{arccsc}', arcsec: '\\operatorname{arcsec}', arccot: '\\operatorname{arccot}',    
    sinh: '\\sinh', cosh: '\\cosh', tanh: '\\tanh', asinh: '\\operatorname{arsinh}', acosh: '\\operatorname{arcosh}', atanh: '\\operatorname{artanh}', acsch: '\\operatorname{arcsch}', asech: '\\operatorname{arsech}', acoth: '\\operatorname{arcoth}',    
    log: '\\log', ln: '\\ln',    
    abs: '\\operatorname{abs}', floor: '\\lfloor', ceil: '\\lceil',    
    sqcomp: '\\text{sqcomp}', collect: '\\operatorname{collect}'  
  };  

  if (lower === 'sqrt' && args.length === 1) return `\\sqrt{${formatBasicTex(args[0])}}`;  
  if (lower === 'exp' && args.length === 1) return `e^{${formatBasicTex(args[0])}}`;  
  if (names[lower]) return `${names[lower]}\\left(${args.map(formatBasicTex).join(', ')}\\right)`;  
  return `${texEscapeText(name)}\\left(${args.map(formatBasicTex).join(', ')}\\right)`;
}

// Add this helper function to cas-engine.js to implement polynomial collection by variable
function evaluateCollect(exprStr, varStr) {
    try {
        // Use Algebrite to expand the expression first so terms are separate
        let expanded = Algebrite.run(`expand(${exprStr})`).toString();
        // If expansion fails, fall back to original
        if (!expanded || expanded.includes('error')) expanded = exprStr;
        
        // For a clean basic implementation, we can evaluate via Algebrite's substitution or grouping,
        // or return a simplified expanded form grouped relative to the variable.
        return Algebrite.run(`simplify(${expanded})`).toString();
    } catch (e) {
        return exprStr;
    }
}

function splitTopLevelArgs(text) {  
  const out=[]; let start=0, p=0, b=0, c=0;  
  for(let i=0;i<text.length;i++){    
    const ch=text[i];    
    if(ch==='(')p++; else if(ch===')')p--; else if(ch==='[')b++; else if(ch===']')b--; else if(ch==='{')c++; else if(ch==='}')c--;    
    else if(ch===',' && p===0 && b===0 && c===0){out.push(text.slice(start,i).trim());start=i+1;}  }  
  out.push(text.slice(start).trim());  
  return out.filter(Boolean);
}

// Sorts polynomial terms by degree descending
function sortPolynomialTerms(s) {
    // Only apply to expressions containing x and plus/minus operators without complex wrappers
    if (!s.includes('x') || /[\\int\lim\sum\prod]/.test(s)) return s;

    // Split expression into terms while keeping their signs
    let terms = s.match(/[+-]?[^+-]+/g);
    if (!terms || terms.length <= 1) return s;

    // Extract degree for each term
    let parsedTerms = terms.map(term => {
        let t = term.trim();
        let deg = 0;
        let caretMatch = t.match(/\^(\d+)/);
        if (caretMatch) {
            deg = parseInt(caretMatch[1], 10);
        } else if (t.includes('x')) {
            deg = 1; // x without caret is degree 1
        }
        return { text: t, degree: deg };
    });

    // Sort descending by degree
    parsedTerms.sort((a, b) => b.degree - a.degree);

    // Reconstruct string, ensuring leading term doesn't have an awkward leading '+'
    let result = parsedTerms[0].text;
    for (let i = 1; i < parsedTerms.length; i++) {
        let t = parsedTerms[i].text;
        if (!t.startsWith('+') && !t.startsWith('-')) {
            result += ' + ' + t;
        } else {
            result += ' ' + t;
        }
    }
    return result;
}

// Automatically converts negative-1 powers into fractions (e.g., (x-1)^-1 -> \frac{1}{x-1})
function convertNegativeExponentsToFraction(s) {
    // Match patterns like \left(...}\right)^{-1}, (...)^-1, or term^{-1}
    let prev;
    do {
        prev = s;
        // Matches parenthesized blocks, left-right blocks, or single tokens/variables followed by ^-1 or ^{-1}
        s = s.replace(/(\\(?:sin|cos|tan|sec|csc|cot|sinh|cosh|tanh|ln|log|arcsin|arccos|arctan|arccsc|arcsec|arccot)\s*\\left\(.+?\\right\)|\\sqrt\{.+?\}|\\left\(.+?\\right\)|\([^)]+\)|[A-Za-z_\\]+(?:\{[^}]+\})*)\s*\^\s*(?:\{|\()?\s*-1(?![\d.])\s*(?:\}|\))?/g, '\\frac{1}{$1}');
    } while (s !== prev); // Repeat in case of chained or nested elements
    return s;
}

// Combines fraction coefficients with inverse/denominator terms into a single clean fraction
// e.g., \frac{5}{2} \frac{1}{x-1}  OR  \frac{5}{2} (x-1)^{-1}  ->  \frac{5}{2(x-1)}


// Split top-level additive terms without breaking signs inside parentheses,
// function arguments, exponents, or scientific-notation literals.
function splitTopLevelAdditive(text) {
  const out = [];
  let start = 0, p = 0, b = 0, c = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') p++; else if (ch === ')') p--;
    else if (ch === '[') b++; else if (ch === ']') b--;
    else if (ch === '{') c++; else if (ch === '}') c--;
    else if ((ch === '+' || ch === '-') && p === 0 && b === 0 && c === 0) {
      const prev = text[i - 1] || '';
      if (i === 0 || /[+\-*/^(,]/.test(prev)) continue;
      if ((prev === 'e' || prev === 'E') && /\d/.test(text[i - 2] || '') && /\d/.test(text[i + 1] || '')) continue;
      out.push(text.slice(start, i).trim());
      start = i;
    }
  }
  if (start === 0) return null;
  out.push(text.slice(start).trim());
  return out.filter(Boolean);
}

// Tokenize top-level multiplication/division. These operators have equal
// precedence and associate left-to-right: 1/3*x means (1/3)*x, not 1/(3*x).
function splitTopLevelMulDiv(text) {
  const parts = [];
  let start = 0, p = 0, b = 0, c = 0, previousOperator = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') p++; else if (ch === ')') p--;
    else if (ch === '[') b++; else if (ch === ']') b--;
    else if (ch === '{') c++; else if (ch === '}') c--;
    else if ((ch === '*' || ch === '/') && p === 0 && b === 0 && c === 0) {
      const value = text.slice(start, i).trim();
      if (!value) return null;
      parts.push({ op: previousOperator, value });
      previousOperator = ch;
      start = i + 1;
    }
  }
  if (start === 0) return null;
  const value = text.slice(start).trim();
  if (!value) return null;
  parts.push({ op: previousOperator, value });
  const numerator = [], denominator = [];
  parts.forEach((part, i) => (i > 0 && part.op === '/' ? denominator : numerator).push(formatBasicTex(part.value)));
  return { numerator, denominator };
}

function formatBasicTex(source) {  
  let s = String(source ?? '').trim();  
  if (!s) return '';  
  if (s[0] === '+') return '+' + formatBasicTex(s.slice(1));
  if (s[0] === '-') return '-' + formatBasicTex(s.slice(1));
  s = s.replace(/[−–]/g, '-').replace(/×/g, '*').replace(/÷/g, '/').replace(/π/g, 'pi');  
  const supMap = {'⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9'};
    s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, match => '^' + match.split('').map(c => supMap[c]).join(''));  

  // Split addition/subtraction first so a trailing integration constant or
  // polynomial term cannot accidentally become part of a fraction denominator.
  const additiveTerms = splitTopLevelAdditive(s);
  if (additiveTerms) return additiveTerms.map(term => {
    if (term.startsWith('+')) return '+ ' + formatBasicTex(term.slice(1));
    if (term.startsWith('-')) return '- ' + formatBasicTex(term.slice(1));
    return formatBasicTex(term);
  }).join(' ');

  const functionTokens = [];  
  const tokenFor = tex => {    
    const token = `@@CASFN${functionTokens.length}@@`;    
    functionTokens.push(tex);    
    return token;  };  
  let rebuilt = '';  
  for (let i = 0; i < s.length;) {    
    const match = s.slice(i).match(/^([A-Za-z_]\w*)\s*\(/);    
    if (!match) { rebuilt += s[i++]; continue; }    
    const name = match[1];    
    const lower = name.toLowerCase();    
    const functionNames = new Set(['sqrt','sin','cos','tan','sec','csc','cot','asin','acos','atan','acsc','asec','acot','arcsin','arccos','arctan','arccsc','arcsec','arccot','sinh','cosh','tanh','asinh','acosh','atanh','acsch','asech','acoth','log','ln','exp','abs','floor','ceil','factor','expand','simplify','solve','solveeq','solveeqs','integrate','defint','diff','limit','matrix','imatrix','det','invert','transpose','trace','rank','augment','dot','cross','ref','rref','nullspace','cofactor','adjugate','sqcomp','collect']);    
    const open = i + match[0].lastIndexOf('(');    
    const close = balanceGroup(s, open, '(', ')');    
    if (close < 0 || !functionNames.has(lower)) {      
      rebuilt += name;      
      i += name.length;      
      continue;    }    
    rebuilt += tokenFor(formatFunctionArgsTex(name, s.slice(open + 1, close)));    
    i = close + 1;  }  
  s = rebuilt;  

  const multiplicative = splitTopLevelMulDiv(s);
  if (multiplicative) {
    let numeratorFactors = multiplicative.numerator.slice();
    const denominator = multiplicative.denominator.join('');
    let sign = '';
    if (numeratorFactors.length > 1 && numeratorFactors[0] === '1') numeratorFactors.shift();
    else if (numeratorFactors.length > 1 && numeratorFactors[0] === '-1') { numeratorFactors.shift(); sign = '-'; }
    const numerator = sign + numeratorFactors.join('');
    let res = denominator ? `\\frac{${numerator || '1'}}{${denominator}}` : numerator;
    functionTokens.forEach((tex, i) => { res = res.replaceAll(`@@CASFN${i}@@`, tex); });
    return res;
  }

  let grouped = '';  
  for (let i=0;i<s.length;) {    
    if (s[i]==='(') {      
      const close=balanceGroup(s,i,'(',')');      
      if(close>=0){        
        let isExponent = false;        
        for (let j = grouped.length - 1; j >= 0; j--) {          
          const ch = grouped[j];          
          if (/\s/.test(ch)) continue;          
          if (ch === '^') isExponent = true;          
          break;        }        
        if (isExponent) {          
          grouped += `{${formatBasicTex(s.slice(i+1,close))}}`;        } else {          
          grouped += `\\left(${formatBasicTex(s.slice(i+1,close))}\\right)`;        }        
        i=close+1;         
        continue;      }    }    
    grouped += s[i++];  }  
  s = grouped;  

  s = s.replace(/\bpi\b/g, '\\pi');  
  s = s.replace(/\*/g, '');    

  // Normalize only simple, unbraced exponents. Leave already-grouped powers
  // such as x^{x+1} intact instead of truncating their contents.
  s = s.replace(/\^\s*(-?(?:\d+|[A-Za-z][A-Za-z0-9_]*))\b/g, '^{$1}');  
  // Likewise, do not truncate grouped subscripts such as a_{i+1}.
  s = s.replace(/_\s*([A-Za-z0-9]+)\b/g, '_{$1}');  
  s = convertNegativeExponentsToFraction(s);
  functionTokens.forEach((tex, i) => {     
    s = s.replaceAll(`@@CASFN${i}@@`, tex); 
  });
  // A function token can itself be the base of a negative-one power; run the
  // formatter once more after restoring those function names.
  s = convertNegativeExponentsToFraction(s);

  return s; 
}

function findMatrixCall(text){  
  const s=String(text??'');  
  const m=s.match(/matrix\s*\(/i);  
  if(!m)return null;  
  const open=s.indexOf('(',m.index);  
  const close=balanceGroup(s,open,'(',')');  
  if(close<0)return null;  
  return {start:m.index,end:close+1,inside:s.slice(open+1,close),full:s.slice(m.index,close+1)};
}

function matrixPreviewText(source){  
  let s=String(source??'').trim();  
  if(!s)return null;  
  const assignment=s.match(/^([A-Za-z_]\w*)\s*=\s*(.*)$/s);  
  const prefix=assignment?`${assignment[1]}\=`:'';  
  const rhs=assignment?assignment[2].trim():s;  
  const call=findMatrixCall(rhs);  
  const isLiteralMatrix=/^\s*\[/.test(rhs);  
  if(!call && !isLiteralMatrix)return null;  
  const literal='[...]';  
  if(call){    
    const before=rhs.slice(0,call.start).trim();    
    const after=rhs.slice(call.end).trim();    
    const joinBefore=before && /[*/]$/.test(before)?before.slice(0,-1)+'·':before;    
    const joinAfter=after && /^[*/]/.test(after)?(after[0]==='*'?'·':'/')+after.slice(1):after;    
    return prefix+joinBefore+literal+joinAfter;  }  
  return prefix+literal;
}

function formatInputTex(source) {
  let s = String(source ?? '').trim();
  if (!s) return ''; 
  s = s.replace(/[−–—]/g, '-');

  const inverseTrig = s.match(/^(sin|cos|tan|sec|csc|cot)\s*\^\s*-1\s*\((.*)\)$/i);
  if (inverseTrig) {
    const name = inverseTrig[1].toLowerCase();
    const texName = { sin: '\\arcsin', cos: '\\arccos', tan: '\\arctan', sec: '\\operatorname{arcsec}', csc: '\\operatorname{arccsc}', cot: '\\operatorname{arccot}' }[name];
    return `${texName}\\left(${formatBasicTex(inverseTrig[2])}\\right)`;
  }

  let call = typeof parseCall === 'function' ? parseCall(s) : null;
  if (!call) {
    const match = s.match(/^([A-Za-z_]\w*)\s*\(/);
    if (match) {
      const name = match[1];
      const open = s.indexOf('(', match.index);
      const close = balanceGroup(s, open, '(', ')');
      if (close >= 0) {
        const args = splitTopLevelArgs(s.slice(open + 1, close));
        call = { name, args };
      }
    }
  }

  if (call) {
    const n = call.name.toLowerCase();
    const a = call.args;
    if (n === 'exp' && a.length >= 1) return `e^{${formatBasicTex(a[0] || '')}}`;
    if (n === 'integrate') return `\\int ${formatBasicTex(a[0] || '')}\\,d${formatBasicTex(a[1] || 'x')}`;
    if (n === 'defint') return `\\int_{${formatBasicTex(a[2] || '')}}^{${formatBasicTex(a[3] || '')}} ${formatBasicTex(a[0] || '')}\\,d${formatBasicTex(a[1] || 'x')}`;
    if (n === 'diffn' || (n === 'diff' && a.length >= 3) || (n === 'derivative' && a.length >= 3)) {
      const expr = formatBasicTex(a[0] || '');
      const v = formatBasicTex(a[1] || 'x');
      const order = formatBasicTex(a[2] || '2');
      return `\\frac{d^{${order}}}{d${v}^{${order}}}\\left(${expr}\\right)`;
    }
    if (n === 'diff' || n === 'derivative') return `\\frac{d}{d${formatBasicTex(a[1] || 'x')}}\\left(${formatBasicTex(a[0] || '')}\\right)`;
    if (n === 'sqcomp') return `\\text{sqcomp}\\left(${formatBasicTex(a[0] || '')}\\right)`;
    if (n === 'limit') {
      const arg0 = formatBasicTex(a[0] || '');
      const arg1 = formatBasicTex(a[1] || 'x');
      const arg2 = formatBasicTex(a[2] || '0');
      return `\\lim_{${arg1}\\to ${arg2}} \\left(${arg0}\\right)`;
    }
    if (n === 'sum') return `\\sum_{${formatBasicTex(a[1] || 'i')}=${formatBasicTex(a[2] || '1')}}^{${formatBasicTex(a[3] || 'n')}} ${formatBasicTex(a[0] || '')}`;
    if (n === 'product') return `\\prod_{${formatBasicTex(a[1] || 'i')}=${formatBasicTex(a[2] || '1')}}^{${formatBasicTex(a[3] || 'n')}} ${formatBasicTex(a[0] || '')}`;
  }

  const assignment = s.match(/^([A-Za-z_]\w*)\s*=\s*(.*)$/s);
  if (assignment) {
    const lhs = texEscapeText(assignment[1]);
    const rhs = assignment[2].trim();
    if (rhs) return `${lhs}\\,=\\,${formatInputTex(rhs)}`;
    return `${lhs}\\,=\\,`;
  }
  return formatBasicTex(s);
}

function renderKatex(el, tex, display = false) {  
  if (!el) return;  
  if (!tex) {    
    el.textContent = '';    
    return;  }  
  try {    
    window.katex.render(tex, el, {      
      displayMode: display,      
      throwOnError: false,      
      strict: false,      
      trust: false    });  } catch (error) {    
    el.textContent = tex;  }
}

function formatOutputTex(value) {    
    let s = String(value ?? '').trim();    
    if (!s) return '';    
    if (typeof matrixTex === 'function') {        
        const matrix = matrixTex(s);        
        if (matrix) return matrix;  
    }    

    return formatBasicTex(s);
}

function renderOutputKatex(el, result) {  
  if (!el) return;  
  if (!result || result.value == null || result.value === '') {    
    el.textContent = '';    
    return;  }  
  const rawValue = String(result.raw ?? result.value ?? '').trim();  
  if (result.kind === 'chemistry') {    
    el.replaceChildren();    
    const button = document.createElement('button');    
    button.type = 'button';    
    button.className = 'matrix-show-button chemistry-show-button';    
    button.textContent = 'Show balancing';    
    button.addEventListener('click', () => window.showChemistryResult?.(result));    
    el.appendChild(button);    
    return;  }  
  const matrixLike = result.kind === 'matrix' || /\bmatrix\s*\(/i.test(rawValue);  
  if (matrixLike) {    
    el.replaceChildren();    
    const button = document.createElement('button');    
    button.type = 'button';    
    button.className = 'matrix-show-button';    
    button.textContent = 'Show matrix';    
    button.addEventListener('click', () => window.showMatrixResult?.(result));    
    el.appendChild(button);    
    return;  }  
  if (result.kind === 'error') {    
    const span = document.createElement('span');    
    span.className = 'render-error';    span.textContent = String(result.value);    
    el.replaceChildren(span);    
    return;  }  
  renderKatex(el, result.tex || formatOutputTex(result.value), false);
}

function renderInputKatex(el, source) {  
  const matrixText = matrixPreviewText(source);  
  if (matrixText !== null) {    
    el.textContent = matrixText;    
    el.classList.add('matrix-raw-preview');    
    return;  }  
  el.classList.remove('matrix-raw-preview');    
  const raw = String(source ?? '');  
  renderKatex(el, formatInputTex(raw), false);
}

window.formatInputTex = formatInputTex;
window.formatOutputTex = formatOutputTex;
window.renderInputKatex = renderInputKatex;
window.renderOutputKatex = renderOutputKatex;
