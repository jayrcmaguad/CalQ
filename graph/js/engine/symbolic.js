window.SymbolicEngine = (() => {
  function readBracedGroup(text, start) {
    if (text[start] !== '{') return null;
    let depth = 0;
    for (let i = start; i < text.length; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}') {
        depth--;
        if (depth === 0) return { content: text.slice(start + 1, i), end: i + 1 };
      }
    }
    return null;
  }

  function readParenthesizedGroup(text, start) {
    if (text[start] !== '(') return null;
    let depth = 0;
    for (let i = start; i < text.length; i++) {
      if (text[i] === '(') depth++;
      else if (text[i] === ')') {
        depth--;
        if (depth === 0) return { content: text.slice(start + 1, i), end: i + 1 };
      }
    }
    return null;
  }

  function readOptionalBracket(text, start) {
    if (text[start] !== '[') return null;
    let depth = 0;
    for (let i = start; i < text.length; i++) {
      if (text[i] === '[') depth++;
      else if (text[i] === ']') {
        depth--;
        if (depth === 0) return { content: text.slice(start + 1, i), end: i + 1 };
      }
    }
    return null;
  }

  // Convert LaTeX commands before converting ordinary braces.  In particular,
  // this preserves nested structures such as \frac{\sqrt{x}}{2x}.
  function replaceLatexCommands(text) {
    let out = '';
    for (let i = 0; i < text.length;) {
      let command = null;
      if (text.startsWith('\\dfrac', i)) command = 'frac';
      else if (text.startsWith('\\tfrac', i)) command = 'frac';
      else if (text.startsWith('\\frac', i)) command = 'frac';

      if (command) {
        let j = i + (text.startsWith('\\dfrac', i) || text.startsWith('\\tfrac', i) ? 6 : 5);
        while (j < text.length && /\s/.test(text[j])) j++;
        const numerator = readBracedGroup(text, j);
        if (numerator) {
          j = numerator.end;
          while (j < text.length && /\s/.test(text[j])) j++;
          const denominator = readBracedGroup(text, j);
          if (denominator) {
            out += '(' + replaceLatexCommands(numerator.content) + ')/(' + replaceLatexCommands(denominator.content) + ')';
            i = denominator.end;
            continue;
          }
        }
      }

      if (text.startsWith('\\sqrt', i)) {
        let j = i + 5;
        while (j < text.length && /\s/.test(text[j])) j++;
        const index = readOptionalBracket(text, j);
        if (index) {
          j = index.end;
          while (j < text.length && /\s/.test(text[j])) j++;
          const group = readBracedGroup(text, j);
          if (group) {
            out += 'nthRoot(' + replaceLatexCommands(group.content) + ',' + replaceLatexCommands(index.content) + ')';
            i = group.end;
            continue;
          }
        }
        const group = readBracedGroup(text, j);
        if (group) {
          out += 'sqrt(' + replaceLatexCommands(group.content) + ')';
          i = group.end;
          continue;
        }
      }

      out += text[i++];
    }
    return out;
  }

  function normalizeLatex(s) {
    let out = String(s || '').trim();
    out = out.replace(/\\left|\\right/g, '')
      .replace(/\\cdot|\\times/g, '*').replace(/\\div/g, '/')
      .replace(/\\pi/g, 'pi').replace(/\\infty/g, 'Infinity')
      .replace(/\\leq/g, '<=').replace(/\\geq/g, '>=')
      .replace(/\\neq/g, '!=').replace(/\\pm/g, '+/-');

    out = replaceLatexCommands(out);

    // Recover the legacy malformed form produced by an earlier parser,
    // e.g. \frac(x)(sqrt(x)) -> (x)/(sqrt(x)).
    let recovered = '';
    for(let i=0;i<out.length;){
      const marker = out.startsWith('\\frac',i) || out.startsWith('\\dfrac',i) || out.startsWith('\\tfrac',i);
      if(marker){
        const nameLen=out.startsWith('\\dfrac',i)||out.startsWith('\\tfrac',i)?6:5;
        let j=i+nameLen; while(j<out.length && /\s/.test(out[j])) j++;
        const a=readParenthesizedGroup(out,j);
        if(a){ j=a.end; while(j<out.length && /\s/.test(out[j])) j++; const b=readParenthesizedGroup(out,j); if(b){ recovered+='('+a.content+')/('+b.content+')'; i=b.end; continue; } }
      }
      recovered+=out[i++];
    }
    out=recovered;

    let old = '';
    while (old !== out) {
      old = out;
      out = out.replace(/([A-Za-z]+)\^\{([^{}]*)\}/g, '$1^($2)')
        .replace(/\^\{([^{}]*)\}/g, '^($1)')
        .replace(/_\{([^{}]*)\}/g, '_($1)')
        .replace(/\{([^{}]*)\}/g, '($1)');
    }
    out = out.replace(/\\ln\b/g, 'log').replace(/\\log\b/g, 'log10')
      .replace(/\\sin\b/g, 'sin').replace(/\\cos\b/g, 'cos').replace(/\\tan\b/g, 'tan')
      .replace(/\\sec\b/g, 'sec').replace(/\\csc\b/g, 'csc').replace(/\\cot\b/g, 'cot')
      .replace(/\\arcsin\b/g, 'asin').replace(/\\arccos\b/g, 'acos').replace(/\\arctan\b/g, 'atan')
      .replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-')
      .replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/≠/g, '!=').replace(/∞/g, 'Infinity');
    return out;
  }

  function canonicalLatex(s) {
    try {
      if (!window.math) return String(s || '');
      const normalized = normalizeLatex(s);
      return window.math.parse(normalized).toTex({ parenthesis: 'auto' }).replace(/\\operatorname\{pi\}/g, '\\pi');
    } catch {
      return String(s || '');
    }
  }

  return { normalizeLatex, canonicalLatex };
})();
