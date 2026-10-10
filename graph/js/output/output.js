window.OutputRenderer = (() => {
  function format(value){
    if(Array.isArray(value)) return value.join(', ');
    if(value && typeof value.toString==='function') return value.toString();
    return String(value);
  }
  return {format};
})();
