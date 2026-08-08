# Reading the two backends

A source-only comparison of the Python/FastAPI backend and the TypeScript/Hono
one that replaced it: what it is like to open the code cold, find the thing you
need to change, and change it correctly. No runtime numbers here — those are in
`REPORT.md`.

Metrics come from `complexity.py` and `complexity.ts`, which implement the *same*
definitions over each language's AST, rolled up by `metrics.ts`. Raw table:
`results-source-metrics.md`. Reproduce with:

```bash
cd experiment && bun install
python complexity.py <py-worktree>/api/src/*.py > /tmp/py.json
bun complexity.ts ../api/src/*.ts               > /tmp/ts.json
bun metrics.ts /tmp/py.json /tmp/ts.json
```

---

## 1. Verdict for a developer

**The TypeScript version is easier to read correctly, and harder to skim.**

Python is denser: 461 code lines against 654 for the same 19 endpoints. If you
measure reading effort in lines, Python wins by 42%. But 46 of those Python lines
are `response["Contents"]`-style dictionary access into values the type checker
knows nothing about — sites where the code asserts a shape the reader has to
verify against AWS documentation. TypeScript has **zero**. That is the whole
trade in one number.

Put differently: in the Python file you read fewer lines but you have to hold
more in your head. In the TypeScript file you read more lines but the editor
answers most of the questions the extra lines would have raised.

For a codebase whose entire job is shuffling AWS response shapes into JSON, that
is the right trade. For a codebase full of algorithmic logic, it would not be.

---

## 2. File-level

| metric | python | hono |
|---|---:|---:|
| source files | 5 | 11 |
| total lines | 627 | 850 |
| code lines | 461 | 654 |
| comment lines | 15 | 61 |
| comment density | 2.4% | 7.2% |
| largest file | 386 | 394 |
| imported names | 37 | 57 |
| type declarations | 14 | 5 |
| `Any` / `any` occurrences | **14** | **0** |
| stringly-typed access `x["k"]` / `.get("k")` | **46** | **0** |

Read this carefully, because the headline "TS is 42% longer" is misleading in
both directions.

**Where the extra 193 lines went** (measured, not estimated):

- **+46 comment lines.** A quarter of the gap. The AWS SDK's sharp edges
  (credential precedence, path-style addressing) needed documenting at the call
  site. Real lines to scroll past; not real complexity.
- **+6 files.** `main.py` (93 lines, doing app wiring + error mapping + static
  serving + path-traversal defence) became `app.ts` + `errors.ts` + `static.ts` +
  `cors.ts` + `index.ts`, each under 50 lines and each doing one thing.
- **+91 lines for `zip.ts`**, which streams the archive with backpressure where
  the Python version buffered it into a temp file.
- **~40 lines of SDK ceremony**: `await s3.send(new ListObjectsV2Command({...}))`
  against `s3.list_objects_v2(...)`.

Only the last is pure cost.

### The 14 type declarations vs 5

Python has 13 Pydantic models plus a `Settings` class; those declarations are
*load-bearing* — at runtime they validate, coerce and project. A TypeScript
`type` is erased. That difference is the whole lesson of this section:

```python
class ObjectList(BaseModel):          # 6 lines. At runtime this validates,
    Objects: list[S3Object]           # coerces, drops unknown keys, fixes JSON
    CommonPrefixes: list[CommonPrefix]  # key order, and generates OpenAPI.
    Prefix: str
    NextContinuationToken: str | None = None
    IsTruncated: bool = False
```

```ts
type ObjectList = {                   // 6 lines. Erased at runtime. Does
  Objects: S3Object[];                // nothing but check the code that
  CommonPrefixes: { Prefix: string }[];  // builds the object.
  Prefix: string;
  NextContinuationToken: string | null;
  IsTruncated: boolean;
};
```

Same six lines, but the Python one is *load-bearing* and the TypeScript one is
not. **This is the single biggest structural difference between the two
languages here**, and pretending otherwise is how a TypeScript port ends up
leaking raw SDK objects into responses.

The answer is the same one Python used: reach for a library. `zod` restores a
load-bearing declaration in the same number of lines Pydantic needed:

```ts
const objectListModel = z.object({
  Objects: z.array(s3ObjectModel),
  CommonPrefixes: z.array(z.object({ Prefix: z.string().default("") })).default([]),
  Prefix: z.string(),
  NextContinuationToken: nullable(z.string()),
  IsTruncated: z.boolean().default(false),
});
```

`z.infer` gives the response type, `z.input` gives the looser type a handler must
supply, and `.parse()` drops unknown keys and applies defaults. Handlers end in
`respondWith(objectListModel, {...})`, so renaming a field in one place and not
the other is a compile error. `api/src/model.ts` is 17 lines: two helpers and
`respondWith`. Everything else is zod.

---

## 3. Function-level

Inline callbacks (`.map(x => …)`) exist in the TS AST but have no Python
equivalent a counter can see, so they are excluded throughout.

| metric | python | hono |
|---|---:|---:|
| functions | 31 | 41 |
| mean lines / function | 12.9 | 14.2 |
| p90 lines / function | 26 | 30 |
| longest function | 43 | 68 |
| mean cyclomatic | 2.7 | 2.7 |
| p90 cyclomatic | 5 | 6 |
| max cyclomatic | 9 | **8** |
| functions with cc > 5 | 2 | 5 |
| mean max-nesting | 0.97 | **0.71** |
| deepest nesting | 4 | **3** |
| mean params | 1.68 | **1.27** |

Function size and average complexity are a **dead heat**: 12.9 vs 14.2 lines,
2.7 vs 2.7 mean cyclomatic. Neither codebase has a monster. TypeScript's longest
function (68 lines) is `zipStream`, which is one `ReadableStream` literal with
its `pull`/`cancel` callbacks — long by line count, trivial to read.

TypeScript is **flatter** (mean nesting 0.62 vs 0.97, max 3 vs 4). The deepest
Python function is `download_prefix` — a `with zipfile.ZipFile(...)` inside a
`for` inside a `try` inside the handler, four levels deep, plus a closure
(`iterfile`) defined at the bottom to stream the temp file back out. Its Hono
counterpart pushes the same work into an `async function*` generator and a
separate `zip.ts`, and never goes past three.

TypeScript has more functions over cc 5 (5 vs 2), but that is mostly an artefact
worth being explicit about: **`??` and `?.` count as branches and their Python
equivalent does not.** `response.Buckets ?? []` scores a decision point;
`response.get("Buckets", [])` scores nothing, because it is a method call. The
tables above already use the strict count (`??`/`?.` excluded) for TypeScript —
with them included, mean cyclomatic would read 3.6 instead of 2.7.

That difference is not noise, though. It reflects something true: **TypeScript
makes the "what if this field is missing?" question visible at every site, and
Python answers it silently inside `.get()`.** Whether that reads as clutter or as
honesty depends on whether you have ever been paged by a `KeyError`.

### Worst offenders

| rank | python | cc | lines | nest | hono | cc | lines | nest |
|---|---|---:|---:|---:|---|---:|---:|---:|
| 1 | `download_prefix` | 9 | 42 | 4 | `GET .../download/:key` | 8 | 23 | 2 |
| 2 | `fetch_objects` | 7 | 40 | 2 | `entries` (zip generator) | 8 | 23 | 2 |
| 3 | `list_objects_batch` | 5 | 43 | 3 | `onError` | 6 | 16 | 2 |
| 4 | `download_object` | 5 | 18 | 2 | `fetchObjects` | 6 | 37 | 2 |
| 5 | `copy_prefix` | 5 | 20 | 2 | `step` (zip producer) | 6 | 25 | 2 |
| 6 | `get_client` | 4 | 16 | 1 | `envCredentials` | 5 | 9 | 1 |

Both lists are short and the entries are the functions you would expect. Three of
TypeScript's top six are the streaming zip writer, which is genuinely the hardest
code in the repo — and it is hard because it does something the Python version
did not: stream with backpressure instead of buffering the archive in a temp
file. `envCredentials` is the one piece of pure port debt left.

---

## 4. Route handlers, which is what you actually edit

| metric | python | hono |
|---|---:|---:|
| handlers | 19 | 19 |
| mean lines / handler | 15.2 | 16.3 |
| mean cyclomatic / handler | 2.8 | **2.3** |
| stringly-typed access in handlers | **32** | **0** |

A handler is a page-worth of code in both. But 32 of the 46 unverifiable
dictionary lookups live in the handlers — the code you touch most often.

Concretely, `get_object` has **10** of them in 26 lines:

```python
@router.get("/buckets/{bucket}/objects/{key:path}", response_model=S3ObjectContent)
def get_object(bucket: str, key: str) -> dict[str, Any]:
    head = s3.head_object(Bucket=bucket, Key=key)
    obj_data = {
        "Key": key,
        "LastModified": head["LastModified"],      # KeyError if absent
        "ETag": head["ETag"],                      # KeyError if absent
        "Size": head["ContentLength"],             # note: renamed field
        "StorageClass": head.get("StorageClass"),
        "ContentType": head.get("ContentType"),
        "Metadata": head.get("Metadata"),
    }
    ...
    return obj_data          # -> dict[str, Any]; the real shape is in the decorator
```

Three separate things a reader has to already know: that `head` is a dict with
those exact keys, that `ContentLength` becomes `Size`, and that the declared
return type `dict[str, Any]` is a lie the `response_model=` argument corrects.

```ts
const s3ObjectContentModel = model({
  ...s3ObjectModel.shape,                        // Key, LastModified, ETag, Size, StorageClass
  ContentType: nullable(str),
  Metadata: nullable(stringMap),
  Content: nullable(str),
});

s3Routes.get("/buckets/:bucket/objects/:key{.+}", async (c) => {
  const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  ...
  return respondWith(s3ObjectContentModel, {
    Key: key,
    LastModified: head.LastModified,             // Date | undefined -> string | null
    ETag: head.ETag,
    Size: head.ContentLength,                    // the rename is right here
    StorageClass: head.StorageClass,
    ContentType: head.ContentType,
    Metadata: head.Metadata,
    Content: content,
  });
});
```

The same length as the Python, and the same division of labour: a declaration
that owns the contract, and a handler that just names the sources. Every field is
autocompleted, the defaults live in the model instead of being repeated as
`?? ""`, and the `ContentLength → Size` rename is visible at the point it
happens. Typo `head.ContentLenght` and the build fails; typo
`head["ContentLenght"]` and you find out in production.

The same pattern in `fetchObjects` is subtler and worth seeing side by side:

```python
kwargs = {"Bucket": bucket, "Prefix": s3_prefix, "Delimiter": delimiter, "MaxKeys": max_keys}
if continuation_token:
    kwargs["ContinuationToken"] = continuation_token
response = s3.list_objects_v2(**kwargs)
```

```ts
const input: ListObjectsV2CommandInput = {
  Bucket: bucket, Prefix: s3Prefix, Delimiter: delimiter, MaxKeys: maxKeys,
};
if (continuationToken) input.ContinuationToken = continuationToken;
const response = await s3.send(new ListObjectsV2Command(input));
```

Structurally identical, one annotation apart. But the annotation means a
misspelled `MaxKey` is a compile error rather than a silently-ignored parameter
that quietly returns 1000 objects instead of 20.

---

## 5. What the code does not tell you

The most underrated readability metric: how much behaviour is real but invisible.

**FastAPI version — you must know that:**
1. `response_model=X` silently drops extra keys, coerces types, and fixes JSON
   key order. The handler's `-> dict[str, Any]` says nothing.
2. `def` (not `async def`) means Starlette runs the handler on a threadpool. Get
   this wrong and blocking boto3 calls stall the event loop.
3. `Annotated[UploadFile, File()]` triggers multipart parsing and spools bodies
   over 1 MiB to a temp file.
4. `@app.exception_handler(ClientError)` catches every boto3 failure app-wide;
   nothing at the call sites hints at it.
5. `datetime` fields become ISO strings via pydantic, with a specific format.
6. `{key:path}` percent-decodes the segment.
7. `BaseSettings` reads env vars *and* `.env`, coercing `"0"`/`"false"` to
   `False`.

**Hono version — you must know that:**
1. `:key{.+}` matches across `/` and decodes the segment.
2. `app.onError` catches thrown errors app-wide.
3. `new Response(Bun.file(p))` infers Content-Type from the extension.

Seven versus three. This is why Python is shorter, and it is also why the Python
file is harder to modify safely: five of those seven are things the port only
discovered by diffing live responses. A reader who does not know all seven will
write code that looks right and behaves differently.

The flip side is fair: the Hono version had to spell those seven behaviours out
as ordinary code, which is what most of the +188 lines are. Explicit is longer.

---

## 6. Tests

| metric | python (pytest) | hono (`bun test`) |
|---|---:|---:|
| test files | 3 | 4 |
| code lines | 115 | 375 |
| tests | 5 | 27 |
| lines per test | 23 | 14 |
| stringly-typed access | 23 | 2 |

The Python suite is not smaller because pytest is more expressive — it is smaller
because it tested five things. Per test, the TypeScript suite is *shorter* (14
lines vs 23), despite `bun test` having no fixture-injection mechanism as terse
as pytest's.

What pytest genuinely does better: `conftest.py` fixtures are more elegant than
a `bunfig.toml` preload, and parametrisation would be nicer. What `bun test` does
better here: `app.request()` needs no test-client dependency (`httpx2` was a dev
dep purely for `TestClient`), and the suite runs in 0.3 s.

---

## 7. Ergonomics that do not show up in any metric

**In favour of the TypeScript version:**

- **One language across the repo.** The frontend already defines `S3Object`,
  `ObjectListResponse`, `Queue`, `Message` in `app/src/types/s3.ts`. Those are
  now the same language as the server's — they can literally be the same
  declarations. With Python they could only ever be a hand-maintained copy that
  drifts.
- **Jump-to-definition works across the AWS boundary.** `HeadObjectCommand` →
  its input and output interfaces. In the Python version, `s3` is `Any`; there
  is nothing to jump to without installing `boto3-stubs`.
- **One toolchain.** `bun run check` / `typecheck` / `test` cover everything.
  No `uv`, `ruff`, `mypy`, `pytest`, second lockfile, or second CI job.
- **The error path is one function.** `errors.ts:onError` is 22 lines and holds
  the entire AWS-error-to-HTTP mapping. It was 11 lines in `main.py` but split
  across a decorator and two module-level dicts.

**In favour of the Python version:**

- **Density.** `s3_routes.py` fits eleven endpoints in 386 lines with room to
  spare. It reads fast.
- **`response_model` is genuinely excellent.** One argument gives you
  validation, coercion, field projection and `/docs` from one argument. `zod` +
  `respondWith` matches all of that except `/docs`, which is still gone.
- **Keyword arguments beat positional.** `fetch_objects(s3, bucket, prefix,
  continuation_token=..., max_keys=...)` is more readable at the call site than
  `fetchObjects(s3, bucket, prefix, token, maxKeys, filterText, delimiter)` with
  seven positional parameters. That TS function is the worst-reading signature in
  the new codebase and should take an options object.
- **`with` blocks.** `with zipfile.ZipFile(...)` and `with ThreadPoolExecutor(...)`
  express scoped resources in one line each; `zip.ts` needed 37 lines and a
  manual `ReadableStream` to do the same job.

---

## 8. Follow-ups

**Done since this was written:**

- **`respondWith(schema, value)`** (`api/src/model.ts`, 17 lines over zod). One
  declaration per response shape yields the output type, the input type a handler
  must supply, and a runtime parse that drops unknown keys and applies defaults —
  the three jobs `response_model=` did. Handlers lost every `?? ""` and can no
  longer leak a raw SDK object.
- **Dropped FastAPI wire-compatibility.** The frontend is the only client, so
  `cors.ts` (34 lines mirroring Starlette's preflight), `serialize.ts`
  (pydantic's microsecond ISO format, `urllib.parse.quote`'s escaping), the
  405-emulation in `notFound`, the hand-rolled `.env` loader, and the 422 body
  that copied pydantic's error text are all gone. Errors are now
  `{ "error": "<sentence>" }`, which the client actually reads and shows.

**Still open:**

1. **Give `fetchObjects` an options object.** Seven positional parameters, four
   of them optional, is the one place the port reads worse than the original.
2. **Export the response types and import them in `app/src/types/s3.ts`.**
   Deletes a hand-maintained duplicate and makes client/server drift a build
   error. `model.ts` makes this nearly free: `Output<typeof objectListModel>`
   *is* the client's `ObjectListResponse`.
3. **Add `zod` schemas for the five JSON request bodies** (`copy`,
   `copy-prefix`, `delete-prefix`, `objects/batch`, send-message). They are
   currently `as`-cast — the last thing Pydantic gave that types alone cannot.
