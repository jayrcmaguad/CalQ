window.CalcButtons = window.CalcButtons || {};
window.CalcButtons.integral = function(fn,a,b,steps=120){
  if(!Number.isFinite(a)||!Number.isFinite(b)) throw new Error('Integral bounds must be finite numbers.');
  if(a===b)return 0;
  let n=Math.max(20,Math.floor(steps)); if(n%2)n++;
  const h=(b-a)/n; let sum=fn(a)+fn(b);
  for(let i=1;i<n;i++){ const y=fn(a+i*h); if(!Number.isFinite(y)) return NaN; sum+=(i%2?4:2)*y; }
  return sum*h/3;
};
