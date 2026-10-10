window.CalcButtons = window.CalcButtons || {};
window.CalcButtons.nPr = (n, r) => {
  n = Number(n); r = Number(r);
  if (!Number.isInteger(n) || !Number.isInteger(r) || n < 0 || r < 0 || r > n) throw new Error('nPr requires integers with 0 ≤ r ≤ n.');
  let p = 1; for (let i = 0; i < r; i++) p *= n - i; return p;
};
