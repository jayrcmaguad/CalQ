window.CalcButtons = window.CalcButtons || {};
window.CalcButtons.fact = (n) => {
  n = Number(n); if (!Number.isInteger(n) || n < 0) throw new Error('factorial requires a non-negative integer.');
  let out = 1; for (let i = 2; i <= n; i++) out *= i; return out;
};
