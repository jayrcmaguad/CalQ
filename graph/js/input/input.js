window.InputManager = (() => {
  const state = {active:null};
  function setActive(el){state.active=el}
  function insert(text){
    const el=state.active;if(!el)return;
    const start=el.selectionStart??el.value.length,end=el.selectionEnd??start;
    el.setRangeText(text,start,end,'end');
    el.dispatchEvent(new Event('input',{bubbles:true}));el.focus();
  }
  function insertTemplate(text,cursorOffset){
    const el=state.active;if(!el)return;
    const start=el.selectionStart??el.value.length,end=el.selectionEnd??start;
    el.setRangeText(text,start,end,'end');
    const p=start+cursorOffset;el.setSelectionRange(p,p);el.dispatchEvent(new Event('input',{bubbles:true}));el.focus();
  }
  function deleteSelectionOrPrevious(){
    const el=state.active;if(!el)return;
    const p=el.selectionStart??0,q=el.selectionEnd??p;
    if(p!==q)el.setRangeText('',p,q,'end');else if(p>0)el.setRangeText('',p-1,p,'end');
    el.dispatchEvent(new Event('input',{bubbles:true}));el.focus();
  }
  function moveCursor(delta){
    const el=state.active;if(!el)return;const p=el.selectionStart??0,q=el.selectionEnd??p;const n=delta<0?Math.max(0,p-1):Math.min(el.value.length,q+1);el.setSelectionRange(n,n);el.focus();
  }
  return {state,setActive,insert,insertTemplate,deleteSelectionOrPrevious,moveCursor};
})();
