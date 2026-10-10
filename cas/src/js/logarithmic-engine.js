/* Logarithmic input adapter for Nerdamer.
 * Internal convention: Nerdamer log(x) is the natural logarithm.
 * User convention: ln(x) is natural log; log(x)/log10(x) are base 10.
 * Parsing is balanced-parenthesis aware, so nested expressions are supported.
 */
(function (root) {
  'use strict';

  function matchingParen(source, open) {
    let depth = 0;
    for (let i = open; i < source.length; i++) {
      if (source[i] === '(') depth++;
      else if (source[i] === ')' && --depth === 0) return i;
    }
    return -1;
  }

  function normalizeLogarithmicInput(source) {
    const s = String(source ?? '');
    let out = '';
    for (let i = 0; i < s.length;) {
      const match = s.slice(i).match(/^([A-Za-z_][A-Za-z_0-9]*)\s*\(/);
      if (!match) { out += s[i++]; continue; }
      const full = match[0];
      const name = match[1];
      const open = i + full.lastIndexOf('(');
      const close = matchingParen(s, open);
      if (close < 0) { out += s[i++]; continue; }
      const arg = normalizeLogarithmicInput(s.slice(open + 1, close));
      const lower = name.toLowerCase();
      let replacement;
      if (lower === 'ln') replacement = `log(${arg})`;
      else if (lower === 'log' || lower === 'log10') replacement = `(log(${arg})/log(10))`;
      else if (lower.startsWith('log_')) {
        const base = normalizeLogarithmicInput(name.slice(4));
        replacement = `(log(${arg})/log(${base}))`;
      } else if (lower === 'exp') replacement = `(e^(${arg}))`;
      else replacement = `${name}(${arg})`;
      out += replacement;
      i = close + 1;
    }
    return out;
  }

  root.normalizeLogarithmicInput = normalizeLogarithmicInput;
})(typeof window !== 'undefined' ? window : globalThis);
