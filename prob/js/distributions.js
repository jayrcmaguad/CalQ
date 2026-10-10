export const DISTRIBUTIONS = [
  {id:'discrete_uniform',name:'Discrete Uniform',type:'discrete',params:[['a','Minimum',1],['b','Maximum',6]]},
  {id:'bernoulli',name:'Bernoulli',type:'discrete',params:[['p','Success probability',0.5,0,1]]},
  {id:'binomial',name:'Binomial',type:'discrete',params:[['n','Trials',10,0,1000],['p','Success probability',0.5,0,1]]},
  {id:'hypergeometric',name:'Hypergeometric',type:'discrete',params:[['N','Population',50,1,100000],['K','Successes in population',20,0,100000],['n','Draws',10,0,100000]]},
  {id:'geometric',name:'Geometric',type:'discrete',params:[['p','Success probability',0.5,0,1]]},
  {id:'negative_binomial',name:'Negative Binomial',type:'discrete',params:[['r','Required successes',5,1,10000],['p','Success probability',0.5,0,1]]},
  {id:'poisson',name:'Poisson',type:'discrete',params:[['lambda','Rate λ',4,0.000001,100000]]},
  {id:'uniform',name:'Continuous Uniform',type:'continuous',params:[['a','Minimum',0],['b','Maximum',1]]},
  {id:'normal',name:'Normal',type:'continuous',params:[['mu','Mean μ',0],['sigma','Standard deviation σ',1,0.000001]]},
  {id:'exponential',name:'Exponential',type:'continuous',params:[['lambda','Rate λ',1,0.000001]]},
  {id:'gamma',name:'Gamma',type:'continuous',params:[['shape','Shape α',2,0.000001],['rate','Rate β',1,0.000001],['scale','Scale θ',1,0.000001]]}
];
