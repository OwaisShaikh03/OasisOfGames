// Descriptive statistics, a Welch t-test and outlier detection (no packages needed)

function describe(values) {
  const a = values.filter(Number.isFinite);
  if (!a.length) return null;
  const n = a.length;
  const mean = a.reduce((s, x) => s + x, 0) / n;
  const sd = n > 1 ? Math.sqrt(a.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1)) : 0;
  const s = [...a].sort((x, y) => x - y);
  const mid = Math.floor(n / 2);
  const median = n % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  return { n, mean, sd, median, min: s[0], max: s[n - 1], cv: mean ? sd / Math.abs(mean) : null };
}

// ln(gamma(x)), Lanczos approximation
function lgamma(x) {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x;
  let t = x + 5.5;
  t -= (x + 0.5) * Math.log(t);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += c[j] / ++y;
  return -t + Math.log((2.5066282746310005 * ser) / x);
}

// Continued fraction for the incomplete beta function
function betacf(a, b, x) {
  const FPMIN = 1e-30;
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 3e-12) break;
  }
  return h;
}

// Regularized incomplete beta function I_x(a, b)
function ibeta(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2)
    ? (bt * betacf(a, b, x)) / a
    : 1 - (bt * betacf(b, a, 1 - x)) / b;
}

// Two-sided p-value for Student's t with df degrees of freedom
const tTwoSided = (t, df) => ibeta(df / (df + t * t), df / 2, 0.5);

// Welch's t-test: is the mean of b different from the mean of a?
function welch(a, b) {
  const x = describe(a);
  const y = describe(b);
  if (!x || !y || x.n < 2 || y.n < 2) return null;
  const vx = x.sd ** 2 / x.n;
  const vy = y.sd ** 2 / y.n;
  const se2 = vx + vy;
  const diff = y.mean - x.mean;
  // Every run in both groups gave the same value (for example FPS stuck at the cap): no test possible
  if (se2 === 0) return { diff, t: null, df: null, p: null };
  const t = diff / Math.sqrt(se2);
  const df = se2 ** 2 / (vx ** 2 / (x.n - 1) + vy ** 2 / (y.n - 1));
  return { diff, t, df, p: tTwoSided(t, df) };
}

// Positions of outliers: modified z-score (median and MAD) above 3.5. Needs 5+ values.
function outlierIndexes(values) {
  if (values.length < 5) return [];
  const med = describe(values).median;
  const mad = describe(values.map((v) => Math.abs(v - med))).median;
  if (!mad) return [];
  return values.map((v, i) => (Math.abs((0.6745 * (v - med)) / mad) > 3.5 ? i : -1)).filter((i) => i >= 0);
}

module.exports = { describe, welch, outlierIndexes };