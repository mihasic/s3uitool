"""Per-function source metrics for Python files.

Emits the same JSON shape as `complexity.ts` so the two backends can be compared
on identical definitions:

  cyclomatic  1 + every branch point (if/elif, for, while, except, ternary,
              boolean operator operand beyond the first, match case,
              comprehension `if`, `assert`)
  nesting     deepest nesting of branch/loop/with/try blocks inside the function
  lines       physical lines from `def` to the last line of the body
  stringly    `x["literal"]` / `x.get("literal")` — member access that the type
              checker cannot verify, the boto3 tax
  kind        route (has an HTTP-method decorator) / named / nested

Usage: python complexity.py <file.py> [...]
"""

import ast
import json
import sys
from pathlib import Path

BRANCH_NODES = (
    ast.If,
    ast.For,
    ast.AsyncFor,
    ast.While,
    ast.ExceptHandler,
    ast.IfExp,
    ast.Assert,
    ast.match_case,
)
NESTING_NODES = (ast.If, ast.For, ast.AsyncFor, ast.While, ast.Try, ast.With, ast.AsyncWith, ast.match_case)
FUNCTION_NODES = (ast.FunctionDef, ast.AsyncFunctionDef)


def measure(fn: ast.AST) -> dict[str, int]:
    cyclomatic = 1
    stringly = 0
    max_nesting = 0

    def walk(node: ast.AST, depth: int) -> None:
        nonlocal cyclomatic, stringly, max_nesting
        for child in ast.iter_child_nodes(node):
            # Nested functions are reported separately; don't fold them in.
            if isinstance(child, FUNCTION_NODES) and child is not fn:
                continue

            if isinstance(child, BRANCH_NODES):
                cyclomatic += 1
            elif isinstance(child, ast.BoolOp):
                cyclomatic += len(child.values) - 1
            elif isinstance(child, ast.comprehension):
                cyclomatic += 1 + len(child.ifs)

            if isinstance(child, ast.Subscript) and isinstance(child.slice, ast.Constant):
                if isinstance(child.slice.value, str):
                    stringly += 1
            elif isinstance(child, ast.Call) and isinstance(child.func, ast.Attribute) and child.func.attr == "get":
                if child.args and isinstance(child.args[0], ast.Constant) and isinstance(child.args[0].value, str):
                    stringly += 1

            child_depth = depth + 1 if isinstance(child, NESTING_NODES) else depth
            max_nesting = max(max_nesting, child_depth)
            walk(child, child_depth)

    walk(fn, 0)

    body = getattr(fn, "body", [])
    start = min((d.lineno for d in getattr(fn, "decorator_list", [])), default=fn.lineno)  # type: ignore[attr-defined]
    end = max(getattr(node, "end_lineno", fn.lineno) or fn.lineno for node in body) if body else fn.lineno  # type: ignore[attr-defined]

    args = fn.args  # type: ignore[attr-defined]
    params = len(args.posonlyargs) + len(args.args) + len(args.kwonlyargs)

    return {
        "cyclomatic": cyclomatic,
        "nesting": max_nesting,
        "lines": end - start + 1,
        "stringly": stringly,
        "params": params,
    }


def analyse(path: Path) -> dict[str, object]:
    text = path.read_text()
    tree = ast.parse(text)
    lines = text.splitlines()

    nested = {
        child.name
        for node in ast.walk(tree)
        if isinstance(node, FUNCTION_NODES)
        for child in ast.walk(node)
        if isinstance(child, FUNCTION_NODES) and child is not node
    }

    functions = []
    for node in ast.walk(tree):
        if not isinstance(node, FUNCTION_NODES):
            continue
        decorators = " ".join(ast.unparse(d) for d in node.decorator_list)
        if any(f".{verb}(" in decorators for verb in ("get", "post", "put", "delete", "patch")):
            kind = "route"
        elif node.name in nested:
            kind = "nested"
        else:
            kind = "named"
        functions.append({"name": node.name, "kind": kind, **measure(node)})

    code = comment = blank = 0
    for line in lines:
        stripped = line.strip()
        if not stripped:
            blank += 1
        elif stripped.startswith("#"):
            comment += 1
        else:
            code += 1

    imports = sum(1 for n in ast.walk(tree) if isinstance(n, (ast.Import, ast.ImportFrom)))
    imported_names = sum(len(n.names) for n in ast.walk(tree) if isinstance(n, (ast.Import, ast.ImportFrom)))
    anys = text.count("Any")
    classes = sum(1 for n in ast.walk(tree) if isinstance(n, ast.ClassDef))

    return {
        "file": path.name,
        "total": len(lines),
        "code": code,
        "comment": comment,
        "blank": blank,
        "imports": imports,
        "importedNames": imported_names,
        "any": anys,
        "declarations": classes,
        "functions": functions,
    }


if __name__ == "__main__":
    print(json.dumps([analyse(Path(p)) for p in sys.argv[1:]], indent=2))
