/**
 * Roll the two per-function metric dumps up into the tables used by
 * `REPORT-SOURCE.md`.
 *
 *   bun metrics.ts <python.json> <typescript.json>
 *
 * Produce the inputs with:
 *   python complexity.py <py-worktree>/api/src/*.py > python.json
 *   bun complexity.ts ../api/src/*.ts               > typescript.json
 */
type Fn = {
  name: string;
  kind: string;
  cyclomatic: number;
  cyclomaticStrict?: number;
  nesting: number;
  lines: number;
  stringly: number;
  params: number;
};
type File = {
  file: string;
  total: number;
  code: number;
  comment: number;
  blank: number;
  imports: number;
  importedNames: number;
  any: number;
  declarations: number;
  functions: Fn[];
};

const [pyPath, tsPath] = process.argv.slice(2);
if (!pyPath || !tsPath) {
  console.error("usage: bun metrics.ts <python.json> <typescript.json>");
  process.exit(2);
}

const py: File[] = await Bun.file(pyPath).json();
const ts: File[] = await Bun.file(tsPath).json();

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const mean = (xs: number[]) => (xs.length ? sum(xs) / xs.length : 0);
const max = (xs: number[]) => (xs.length ? Math.max(...xs) : 0);
const pct = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] ?? 0;
};
const fmt = (n: number, d = 1) => n.toFixed(d);

/** Inline callbacks (`.map(x => …)`) exist only in the TS AST; exclude for fairness. */
const substantive = (fs: File[]) => fs.flatMap((f) => f.functions).filter((fn) => fn.kind !== "callback");
const all = (fs: File[]) => fs.flatMap((f) => f.functions);

function row(label: string, a: string | number, b: string | number): string {
  return `| ${label.padEnd(38)} | ${String(a).padStart(12)} | ${String(b).padStart(12)} |`;
}

function fileTotals(fs: File[]) {
  return {
    files: fs.length,
    total: sum(fs.map((f) => f.total)),
    code: sum(fs.map((f) => f.code)),
    comment: sum(fs.map((f) => f.comment)),
    blank: sum(fs.map((f) => f.blank)),
    imports: sum(fs.map((f) => f.importedNames)),
    any: sum(fs.map((f) => f.any)),
    declarations: sum(fs.map((f) => f.declarations)),
    stringly: sum(all(fs).map((f) => f.stringly)),
  };
}

const P = fileTotals(py);
const T = fileTotals(ts);
const pf = substantive(py);
const tf = substantive(ts);
// `cyclomaticStrict` drops `??`/`?.`, which have no Python counterpart a counter can see.
const tcc = tf.map((f) => f.cyclomaticStrict ?? f.cyclomatic);
const pcc = pf.map((f) => f.cyclomatic);

console.log("## File-level\n");
console.log(row("metric", "python", "hono"));
console.log(`|${"-".repeat(40)}|${"-".repeat(14)}|${"-".repeat(14)}|`);
console.log(row("source files", P.files, T.files));
console.log(row("total lines", P.total, T.total));
console.log(row("code lines", P.code, T.code));
console.log(row("comment lines", P.comment, T.comment));
console.log(row("comment density", `${fmt((100 * P.comment) / P.total)}%`, `${fmt((100 * T.comment) / T.total)}%`));
console.log(row("largest file (lines)", max(py.map((f) => f.total)), max(ts.map((f) => f.total))));
console.log(row("imported names", P.imports, T.imports));
console.log(row("type declarations", P.declarations, T.declarations));
console.log(row("`Any` / `any` occurrences", P.any, T.any));
console.log(row('stringly-typed access `x["k"]`', P.stringly, T.stringly));

console.log("\n## Function-level (excluding inline callbacks)\n");
console.log(row("metric", "python", "hono"));
console.log(`|${"-".repeat(40)}|${"-".repeat(14)}|${"-".repeat(14)}|`);
console.log(row("functions", pf.length, tf.length));
console.log(row("mean lines / function", fmt(mean(pf.map((f) => f.lines))), fmt(mean(tf.map((f) => f.lines)))));
console.log(row("p90 lines / function", pct(pf.map((f) => f.lines), 90), pct(tf.map((f) => f.lines), 90)));
console.log(row("longest function", max(pf.map((f) => f.lines)), max(tf.map((f) => f.lines))));
console.log(row("mean cyclomatic", fmt(mean(pcc)), fmt(mean(tcc))));
console.log(row("p90 cyclomatic", pct(pcc, 90), pct(tcc, 90)));
console.log(row("max cyclomatic", max(pcc), max(tcc)));
console.log(row("functions with cc > 5", pcc.filter((c) => c > 5).length, tcc.filter((c) => c > 5).length));
console.log(row("mean max-nesting", fmt(mean(pf.map((f) => f.nesting)), 2), fmt(mean(tf.map((f) => f.nesting)), 2)));
console.log(row("deepest nesting", max(pf.map((f) => f.nesting)), max(tf.map((f) => f.nesting))));
console.log(row("mean params", fmt(mean(pf.map((f) => f.params)), 2), fmt(mean(tf.map((f) => f.params)), 2)));

const pRoutes = pf.filter((f) => f.kind === "route");
const tRoutes = tf.filter((f) => f.kind === "route");
console.log("\n## Route handlers only\n");
console.log(row("metric", "python", "hono"));
console.log(`|${"-".repeat(40)}|${"-".repeat(14)}|${"-".repeat(14)}|`);
console.log(row("handlers", pRoutes.length, tRoutes.length));
console.log(
  row("mean lines / handler", fmt(mean(pRoutes.map((f) => f.lines))), fmt(mean(tRoutes.map((f) => f.lines)))),
);
console.log(
  row(
    "mean cyclomatic / handler",
    fmt(mean(pRoutes.map((f) => f.cyclomatic))),
    fmt(mean(tRoutes.map((f) => f.cyclomaticStrict ?? f.cyclomatic))),
  ),
);
console.log(row("stringly access in handlers", sum(pRoutes.map((f) => f.stringly)), sum(tRoutes.map((f) => f.stringly))));

console.log("\n## Worst offenders (by cyclomatic complexity)\n");
const worst = (fs: Fn[], key: (f: Fn) => number, n: number) =>
  [...fs].sort((a, b) => key(b) - key(a)).slice(0, n);
console.log("| rank | python | cc | lines | nest | hono | cc | lines | nest |");
console.log("|---|---|---|---|---|---|---|---|---|");
const pw = worst(pf, (f) => f.cyclomatic, 6);
const tw = worst(tf, (f) => f.cyclomaticStrict ?? f.cyclomatic, 6);
for (let i = 0; i < 6; i++) {
  const a = pw[i];
  const b = tw[i];
  console.log(
    `| ${i + 1} | \`${a?.name ?? ""}\` | ${a?.cyclomatic ?? ""} | ${a?.lines ?? ""} | ${a?.nesting ?? ""} | ` +
      `\`${b?.name ?? ""}\` | ${b?.cyclomaticStrict ?? ""} | ${b?.lines ?? ""} | ${b?.nesting ?? ""} |`,
  );
}
