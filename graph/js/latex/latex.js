window.LatexRenderer = (() => {
  function render(element, source, display=false) {
    if (!element) return;
    if (!source) { element.innerHTML=''; return; }
    if (!window.katex) { element.textContent=source; return; }
    try { window.katex.render(String(source), element, {throwOnError:false, displayMode:display}); }
    catch { element.textContent=source; }
  }
  return { render };
})();
