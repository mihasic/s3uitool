/**
 * Per-function source metrics for TypeScript files.
 *
 * Emits the same JSON shape as `complexity.py`, using the same definitions:
 *
 *   cyclomatic  1 + every branch point (if, for, while, do, catch, ternary,
 *               boolean/nullish operator operand beyond the first, case clause,
 *               optional chain)
 *   nesting     deepest nesting of branch/loop/try/block statements in the function
 *   lines       physical lines from the declaration to its closing brace
 *   stringly    `x["literal"]` — member access the type checker cannot verify
 *   cyclomaticStrict
 *               same, minus `??` and `?.` — those are null-safety syntax rather
 *               than real branches, and Python hides the equivalent inside
 *               `dict.get(k, default)`, which no counter scores
 *   kind        route (registered on a Hono router) / named / callback
 *
 * Usage: bun complexity.ts <file.ts> [...]
 */
// Needs the classic TypeScript 5 compiler API (the repo itself uses the native TS 7
// binary, which does not expose one). `bun install` in this directory provides it.
import ts from "typescript";

type FunctionMetrics = {
  name: string;
  kind: "route" | "named" | "callback";
  cyclomatic: number;
  cyclomaticStrict: number;
  nesting: number;
  lines: number;
  stringly: number;
  params: number;
};

const BRANCH_KINDS = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.IfStatement,
  ts.SyntaxKind.ForStatement,
  ts.SyntaxKind.ForInStatement,
  ts.SyntaxKind.ForOfStatement,
  ts.SyntaxKind.WhileStatement,
  ts.SyntaxKind.DoStatement,
  ts.SyntaxKind.CatchClause,
  ts.SyntaxKind.ConditionalExpression,
  ts.SyntaxKind.CaseClause,
]);

const NESTING_KINDS = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.IfStatement,
  ts.SyntaxKind.ForStatement,
  ts.SyntaxKind.ForInStatement,
  ts.SyntaxKind.ForOfStatement,
  ts.SyntaxKind.WhileStatement,
  ts.SyntaxKind.DoStatement,
  ts.SyntaxKind.TryStatement,
  ts.SyntaxKind.CaseClause,
  ts.SyntaxKind.SwitchStatement,
]);

const BOOLEAN_OPERATORS = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.AmpersandAmpersandToken,
  ts.SyntaxKind.BarBarToken,
  ts.SyntaxKind.QuestionQuestionToken,
]);

function isFunctionLike(node: ts.Node): boolean {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isArrowFunction(node) ||
    ts.isFunctionExpression(node)
  );
}

/** Best-effort readable name: declaration name, variable name, or the route it handles. */
function nameOf(node: ts.Node, source: ts.SourceFile): string {
  const named = node as ts.FunctionDeclaration;
  if (named.name) return named.name.getText(source);

  const parent = node.parent;
  if (parent && ts.isVariableDeclaration(parent)) return parent.name.getText(source);
  if (parent && ts.isPropertyAssignment(parent)) return parent.name.getText(source);
  // Route handlers: `s3Routes.get("/buckets", async (c) => {...})`
  if (parent && ts.isCallExpression(parent)) {
    const callee = parent.expression.getText(source);
    const first = parent.arguments[0];
    if (first && ts.isStringLiteral(first)) return `${callee}(${first.text})`;
    return `${callee}()`;
  }
  return "<anonymous>";
}

const HTTP_VERBS = /\.(get|post|put|delete|patch|use|all)$/;

function kindOf(fn: ts.Node, source: ts.SourceFile): FunctionMetrics["kind"] {
  if (ts.isFunctionDeclaration(fn)) return "named";
  const parent = fn.parent;
  if (parent && ts.isVariableDeclaration(parent)) return "named";
  if (parent && ts.isCallExpression(parent) && HTTP_VERBS.test(parent.expression.getText(source))) return "route";
  return "callback";
}

function measure(fn: ts.Node, source: ts.SourceFile): FunctionMetrics {
  let cyclomatic = 1;
  let nullish = 0;
  let stringly = 0;
  let maxNesting = 0;

  const walk = (node: ts.Node, depth: number): void => {
    ts.forEachChild(node, (child) => {
      // Nested functions are reported separately; don't fold them in.
      if (isFunctionLike(child)) return;

      if (BRANCH_KINDS.has(child.kind)) cyclomatic += 1;
      if (ts.isBinaryExpression(child) && BOOLEAN_OPERATORS.has(child.operatorToken.kind)) {
        cyclomatic += 1;
        if (child.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) nullish += 1;
      }

      if (ts.isElementAccessExpression(child) && ts.isStringLiteral(child.argumentExpression)) stringly += 1;

      const childDepth = NESTING_KINDS.has(child.kind) ? depth + 1 : depth;
      maxNesting = Math.max(maxNesting, childDepth);
      walk(child, childDepth);
    });
  };
  walk(fn, 0);

  // `?.` is a token, not a node, so forEachChild never visits it — count textually.
  const optionalChains = (fn.getText(source).match(/\?\./g) ?? []).length;
  cyclomatic += optionalChains;
  nullish += optionalChains;

  const start = source.getLineAndCharacterOfPosition(fn.getStart(source)).line;
  const end = source.getLineAndCharacterOfPosition(fn.getEnd()).line;

  return {
    name: nameOf(fn, source),
    kind: kindOf(fn, source),
    cyclomatic,
    cyclomaticStrict: cyclomatic - nullish,
    nesting: maxNesting,
    lines: end - start + 1,
    stringly,
    params: (fn as ts.FunctionDeclaration).parameters?.length ?? 0,
  };
}

function analyse(path: string) {
  const text = require("node:fs").readFileSync(path, "utf8") as string;
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.ESNext, true);
  const lines = text.split("\n");

  const functions: FunctionMetrics[] = [];
  const visit = (node: ts.Node): void => {
    if (isFunctionLike(node)) functions.push(measure(node, source));
    ts.forEachChild(node, visit);
  };
  visit(source);

  let code = 0;
  let comment = 0;
  let blank = 0;
  for (const line of lines) {
    const stripped = line.trim();
    if (!stripped) blank += 1;
    else if (/^(\/\/|\/\*|\*)/.test(stripped)) comment += 1;
    else code += 1;
  }

  const imports = source.statements.filter(ts.isImportDeclaration);
  let importedNames = 0;
  for (const decl of imports) {
    const bindings = decl.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) importedNames += bindings.elements.length;
    else importedNames += 1;
  }

  return {
    file: path.split("/").pop(),
    total: lines.length,
    code,
    comment,
    blank,
    imports: imports.length,
    importedNames,
    any: (text.match(/\bany\b/g) ?? []).length,
    declarations: source.statements.filter((n) => ts.isTypeAliasDeclaration(n) || ts.isInterfaceDeclaration(n)).length,
    functions,
  };
}

console.log(JSON.stringify(process.argv.slice(2).map(analyse), null, 2));
