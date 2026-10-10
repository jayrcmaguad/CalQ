window.CASEngine = (() => {
  function ensureMath(){if(!window.math)throw new Error('Calculation engine is still loading.');return window.math;}

  function preprocess(expr){
    let s=String(expr ?? '').trim();
    if(window.SymbolicEngine?.normalizeLatex) s=window.SymbolicEngine.normalizeLatex(s);
    s=s.replace(/≤/g,'<=').replace(/≥/g,'>=').replace(/≠/g,'!=').replace(/×/g,'*').replace(/÷/g,'/');
    s=s.replace(/\bAns\b/gi,'Ans');
    s=s.replace(/\bnpr\s*\(/gi,'nPr(').replace(/\bncr\s*\(/gi,'nCr(');
    s=s.replace(/\bperm(?:utation)?\s*\(/gi,'nPr(').replace(/\bcomb(?:ination)?\s*\(/gi,'nCr(');
    s=s.replace(/(\d+(?:\.\d+)?)!/g,'factorial($1)');
    return s;
  }

  let lastAnswer;

  function scope(){
    const m=ensureMath();
    return {
      nPr:window.CalcButtons.nPr,npr:window.CalcButtons.nPr,
      nCr:window.CalcButtons.nCr,ncr:window.CalcButtons.nCr,
      factorial:window.CalcButtons.fact,
      cos:window.CalcButtons.cos,
      sec:x=>1/Math.cos(x),csc:x=>1/Math.sin(x),cot:x=>1/Math.tan(x),
      nthRoot:(x,n)=>Math.sign(Number(x))*Math.pow(Math.abs(Number(x)),1/Number(n)),
      integral:(f,a,b)=>window.CalcButtons.integral(x=>m.evaluate(preprocess(f),{x}),Number(a),Number(b)),
      deg:x=>Number(x)*Math.PI/180,
      mod:(a,b)=>Number(a)%Number(b),
      gcd:(a,b)=>{a=Math.abs(Math.trunc(a));b=Math.abs(Math.trunc(b));while(b){[a,b]=[b,a%b];}return a;},
      lcm:(a,b)=>Math.abs(a*b)/scope().gcd(a,b),
      mean:a=>Array.from(a).reduce((x,y)=>x+y,0)/a.length,
      median:a=>{const v=Array.from(a).map(Number).sort((x,y)=>x-y);const n=v.length;return n%2?v[(n-1)/2]:(v[n/2-1]+v[n/2])/2;},
      sum:a=>Array.from(a).reduce((x,y)=>x+y,0),
      prod:a=>Array.from(a).reduce((x,y)=>x*y,1),
      det:a=>m.det(a),
      inv:a=>m.inv(a),
      transpose:a=>m.transpose(a),
      trace:a=>m.trace(a),
      rank:a=>typeof m.rank==='function'?m.rank(a):matrixRank(a),
      zeros:(r,c)=>m.zeros(Number(r),Number(c??r)),
      ones:(r,c)=>m.ones(Number(r),Number(c??r)),
      identity:n=>m.identity(Number(n)),
      dot:(a,b)=>m.dot(a,b),
      cross:(a,b)=>m.cross(a,b),
      norm:a=>m.norm(a),
      Ans:lastAnswer,ans:lastAnswer
    };
  }

  function matrixRank(a){
    const rows=Array.isArray(a)?a:(a&&typeof a.toArray==='function'?a.toArray():null);
    if(!Array.isArray(rows)||!rows.length)return 0;
    const M=rows.map(r=>r.map(Number)); let rank=0,row=0; const cols=M[0]?.length||0;
    for(let col=0;col<cols&&row<M.length;col++){
      let pivot=row; for(let r=row+1;r<M.length;r++) if(Math.abs(M[r][col])>Math.abs(M[pivot][col])) pivot=r;
      if(Math.abs(M[pivot][col])<1e-12)continue;
      [M[row],M[pivot]]=[M[pivot],M[row]];
      const div=M[row][col]; for(let c=col;c<cols;c++)M[row][c]/=div;
      for(let r=0;r<M.length;r++){if(r===row)continue;const f=M[r][col];if(Math.abs(f)<1e-12)continue;for(let c=col;c<cols;c++)M[r][c]-=f*M[row][c];}
      rank++;row++;
    }
    return rank;
  }

  function splitArgs(s){
    const out=[];let depth=0,start=0;
    for(let i=0;i<s.length;i++){
      if('([{'.includes(s[i]))depth++;
      else if(')]}'.includes(s[i]))depth--;
      else if(s[i]===','&&depth===0){out.push(s.slice(start,i).trim());start=i+1;}
    }
    out.push(s.slice(start).trim());return out;
  }

  function numericValue(expr,vars={}){ return Number(ensureMath().evaluate(preprocess(expr),{...scope(),...vars})); }

  function numericSum(expr,v,lo,hi,vars={}){
    const start=Math.trunc(numericValue(lo,vars)),end=Math.trunc(numericValue(hi,vars));
    if(!Number.isFinite(start)||!Number.isFinite(end)) throw new Error('sum bounds must be finite integers.');
    if(Math.abs(end-start)>1000000) throw new Error('sum range is too large.');
    const step=start<=end?1:-1; let total=0;
    for(let k=start;;k+=step){
      const value=ensureMath().evaluate(preprocess(expr),{...scope(),...vars,[v]:k});
      total+=Number(value);
      if(k===end)break;
    }
    return total;
  }

  function piecewiseValue(args,vars={}){
    for(const part of args){
      if(!part)continue;
      const pair=splitArgs(part.replace(/^\s*\(|\)\s*$/g,''));
      if(pair.length>=2){
        if(Boolean(ensureMath().evaluate(preprocess(pair[1]),{...scope(),...vars}))) return ensureMath().evaluate(preprocess(pair[0]),{...scope(),...vars});
      } else return ensureMath().evaluate(preprocess(pair[0]),{...scope(),...vars});
    }
    return NaN;
  }

  function evaluate(expr,vars={}){
    const m=ensureMath(),source=preprocess(expr),match=source.match(/^integral\((.*)\)$/i);
    if(match){
      const a=splitArgs(match[1]);
      if(a.length!==3)throw new Error('Definite integral needs integral(function, lower, upper).');
      return window.CalcButtons.integral(x=>m.evaluate(preprocess(a[0]),{x,...scope(),...vars}),numericValue(a[1],vars),numericValue(a[2],vars));
    }
    const sm=source.match(/^sum\((.*)\)$/i);
    if(sm){const a=splitArgs(sm[1]);if(a.length!==4)throw new Error('sum needs sum(expression, variable, lower, upper).');return numericSum(a[0],a[1],a[2],a[3],vars);}
    const pw=source.match(/^piecewise\((.*)\)$/i);
    if(pw)return piecewiseValue(splitArgs(pw[1]),vars);
    try{return m.evaluate(source,{...scope(),...vars});}
    catch(error){
      const msg=String(error?.message||'');
      if(/undefined symbol/i.test(msg)){
        try{return m.simplify(source).toString();}catch{}
        return source;
      }
      throw error;
    }
  }

  function nerd(expr,method,...args){
    if(!window.nerdamer)return null;
    try{
      const n=window.nerdamer;
      let out;
      if(method==='diff') out=n.diff(preprocess(expr),args[0]||'x');
      else if(method==='integrate') out=n.integrate(preprocess(expr),args[0]||'x');
      else if(method==='simplify') out=n.simplify(preprocess(expr));
      else if(method==='expand') out=n.expand(preprocess(expr));
      else if(method==='factor') out=n.factor(preprocess(expr));
      else return null;
      return out?.text ? out.text() : String(out);
    }catch{return null;}
  }

  function simplify(expr){return nerd(expr,'simplify') || ensureMath().simplify(preprocess(expr)).toString();}
  function derivative(expr,v='x'){return nerd(expr,'diff',v) || ensureMath().derivative(preprocess(expr),v).toString();}
  function symbolicIntegral(expr,v='x'){
    const n=nerd(expr,'integrate',v); if(n)return n+' + C';
    const s=preprocess(expr).replace(/\s+/g,'');
    if(s===v)return `${v}^2/2 + C`;
    const pow=new RegExp(`^${v}\^(\\d+)$`).exec(s);
    if(pow){const n=Number(pow[1]);return `${v}^${n+1}/${n+1} + C`;}
    if(s===`sin(${v})`)return `-cos(${v}) + C`;
    if(s===`cos(${v})`)return `sin(${v}) + C`;
    if(s===`exp(${v})`)return `exp(${v}) + C`;
    throw new Error('Symbolic indefinite integration is not implemented for this expression.');
  }

  function solveEquation(eq,v='x'){
    if(window.nerdamer){try{
      const r=window.nerdamer.solve(preprocess(eq.replace('=','-')),v);
      const text=r?.text? r.text():String(r); const arr=text.replace(/^\[|\]$/g,'').split(',').map(x=>Number(ensureMath().evaluate(preprocess(x)))).filter(Number.isFinite);
      if(arr.length)return [...new Set(arr)];
    }catch{}}
    const m=ensureMath(),parts=eq.split('=');if(parts.length!==2)throw new Error('solve expects an equation such as solve(x^2=4,x).');
    const node=m.parse(`(${preprocess(parts[0])})-(${preprocess(parts[1])})`),fn=x=>Number(m.evaluate(node.toString(),{...scope(),x})),roots=[];
    for(let x=-100;x<100;x+=0.5){const a=fn(x),b=fn(x+0.5);if(!Number.isFinite(a)||!Number.isFinite(b))continue;if(a===0)roots.push(x);if(a*b<0){let lo=x,hi=x+0.5;for(let i=0;i<36;i++){const mid=(lo+hi)/2;if(fn(lo)*fn(mid)<=0)hi=mid;else lo=mid;}roots.push((lo+hi)/2);}}
    const unique=[...new Set(roots.map(x=>Number(x.toFixed(10))))];if(!unique.length)throw new Error('No numeric roots found in the search interval.');return unique;
  }

  function setLastAnswer(value){lastAnswer=value;}
  function getLastAnswer(){return lastAnswer;}

  function runCommand(input,vars={}){
    const s=String(input||'').trim(),m=s.match(/^([a-zA-Z_]\w*)\((.*)\)$/);
    if(m){
      const cmd=m[1].toLowerCase(),args=splitArgs(m[2]);
      if(cmd==='npr'||cmd==='perm'||cmd==='permutation')return window.CalcButtons.nPr(numericValue(args[0],vars),numericValue(args[1],vars));
      if(cmd==='ncr'||cmd==='comb'||cmd==='combination')return window.CalcButtons.nCr(numericValue(args[0],vars),numericValue(args[1],vars));
      if(cmd==='diff'||cmd==='derivative')return derivative(args[0],args[1]||'x');
      if(cmd==='integral')return args.length===3?evaluate(s,vars):symbolicIntegral(args[0],args[1]||'x');
      if(cmd==='sum'||cmd==='summation'){if(args.length!==4)throw new Error('sum needs sum(expression, variable, lower, upper).');return numericSum(args[0],args[1],args[2],args[3],vars);}
      if(cmd==='piecewise')return piecewiseValue(args,vars);
      if(cmd==='solve')return solveEquation(args[0],args[1]||'x');
      if(cmd==='simplify')return simplify(args[0]);
      if(cmd==='expand')return nerd(args[0],'expand') || ensureMath().expand(preprocess(args[0])).toString();
      if(cmd==='factor')return nerd(args[0],'factor') || ensureMath().factor(preprocess(args[0])).toString();
      if(cmd==='limit'){const ex=args[0],v=args[1]||'x',at=numericValue(args[2]??0,vars),h=1e-6,mm=ensureMath();return (mm.evaluate(preprocess(ex),{...scope(),...vars,[v]:at-h})+mm.evaluate(preprocess(ex),{...scope(),...vars,[v]:at+h}))/2;}
      const aliases={npr:'nPr',ncr:'nCr',nthroot:'nthRoot'};
      const canonical=aliases[cmd]||cmd;
      const supported=['factorial','abs','floor','ceil','mod','gcd','lcm','mean','median','sum','prod','det','inv','transpose','trace','rank','zeros','ones','identity','dot','cross','norm','sqrt','log','log10','ln','sin','cos','tan','asin','acos','atan','sec','csc','cot','nthRoot'];
      if(supported.includes(canonical))return evaluate(`${canonical}(${args.join(',')})`,vars);
    }
    return evaluate(s,vars);
  }

  function conditionValue(condition,x,vars={}){try{return Boolean(ensureMath().evaluate(preprocess(condition),{...scope(),...vars,x}));}catch{return false;}}
  function compilePiecewise(expr,vars={}){
    const inside=expr.replace(/^piecewise\(/i,'').replace(/\)\s*$/,'');
    const cases=splitArgs(inside).map(part=>{
      const p=splitArgs(part.replace(/^\s*\(|\)\s*$/g,''));
      return p.length>=2?{expr:p[0],cond:p[1]}:{expr:p[0],cond:null};
    });
    const compiled=cases.map(c=>({cond:c.cond,fn:ensureMath().compile(preprocess(c.expr))}));
    return x=>{for(const c of compiled){if(!c.cond||conditionValue(c.cond,x,vars))return Number(c.fn.evaluate({...scope(),...vars,x}));}return NaN;};
  }
  function compileFunction(expr,vars={}){
    const m=ensureMath(),source=preprocess(expr);
    if(/^piecewise\(/i.test(source))return compilePiecewise(source,vars);
    const compiled=m.compile(source);
    return x=>{const y=compiled.evaluate({...scope(),...vars,x});return typeof y==='number'?y:Number(y);};
  }
  return {evaluate,simplify,derivative,runCommand,compileFunction,preprocess,splitArgs,setLastAnswer,getLastAnswer};
})();
