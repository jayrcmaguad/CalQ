window.CalcButtons = window.CalcButtons || {};
window.CalcButtons.nCr = (n, r) => {
  n = Number(n); r = Number(r);
  if (!Number.isInteger(n) || !Number.isInteger(r) || n < 0 || r < 0 || r > n) throw new Error('nCr requires integers with 0 ≤ r ≤ n.');
  r = Math.min(r, n - r); let out = 1; for (let i = 1; i <= r; i++) out = out * (n - r + i) / i; return out;
};
