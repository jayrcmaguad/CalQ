export const logGamma=z=>{const c=[676.5203681218851,-1259.1392167224028,771.32342877765313,-176.61502916214059,12.507343278686905,-.13857109526572012,9.984369578019572e-6,1.5056327351493116e-7];if(z<.5)return Math.log(Math.PI)-Math.log(Math.sin(Math.PI*z))-logGamma(1-z);z-=1;let x=.9999999999998099;for(let i=0;i<c.length;i++)x+=c[i]/(z+i+1);const t=z+c.length-.5;return .5*Math.log(2*Math.PI)+(z+.5)*Math.log(t)-t+Math.log(x)};
export const gamma=z=>Math.exp(logGamma(z));
export const logFact=n=>logGamma(n+1);
export const erf=x=>{const s=x<0?-1:1;x=Math.abs(x);const t=1/(1+.3275911*x);return s*(1-((((1.061405429*t-1.453152027)*t+1.421413741)*t-.284496736)*t+.254829592)*t*Math.exp(-x*x));};
export const normalCDF=x=>.5*(1+erf(x/Math.SQRT2));
export const simpson=(f,a,b,n=800)=>{if(!Number.isFinite(a))a=-10;if(!Number.isFinite(b))b=10;if(b<=a)return 0;if(n%2)n++;const h=(b-a)/n;let s=f(a)+f(b);for(let i=1;i<n;i++)s+=(i%2?4:2)*f(a+i*h);return s*h/3};
