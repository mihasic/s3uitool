## File-level

| metric                                 |       python |         hono |
|----------------------------------------|--------------|--------------|
| source files                           |            5 |           10 |
| total lines                            |          627 |          917 |
| code lines                             |          461 |          678 |
| comment lines                          |           15 |          103 |
| comment density                        |         2.4% |        11.2% |
| largest file (lines)                   |          386 |          410 |
| imported names                         |           37 |           64 |
| type declarations                      |           14 |           13 |
| `Any` / `any` occurrences              |           14 |            1 |
| stringly-typed access `x["k"]`         |           46 |            0 |

## Function-level (excluding inline callbacks)

| metric                                 |       python |         hono |
|----------------------------------------|--------------|--------------|
| functions                              |           31 |           45 |
| mean lines / function                  |         12.9 |         13.5 |
| p90 lines / function                   |           26 |           30 |
| longest function                       |           43 |           68 |
| mean cyclomatic                        |          2.7 |          2.5 |
| p90 cyclomatic                         |            5 |            6 |
| max cyclomatic                         |            9 |            8 |
| functions with cc > 5                  |            2 |            5 |
| mean max-nesting                       |         0.97 |         0.62 |
| deepest nesting                        |            4 |            3 |
| mean params                            |         1.68 |         1.24 |

## Route handlers only

| metric                                 |       python |         hono |
|----------------------------------------|--------------|--------------|
| handlers                               |           19 |           19 |
| mean lines / handler                   |         15.2 |         16.0 |
| mean cyclomatic / handler              |          2.8 |          2.3 |
| stringly access in handlers            |           32 |            0 |

## Worst offenders (by cyclomatic complexity)

| rank | python | cc | lines | nest | hono | cc | lines | nest |
|---|---|---|---|---|---|---|---|---|
| 1 | `download_prefix` | 9 | 42 | 4 | `s3Routes.get(/buckets/:bucket/download/:key{.+})` | 8 | 23 | 2 |
| 2 | `fetch_objects` | 7 | 40 | 2 | `entries` | 8 | 23 | 2 |
| 3 | `list_objects_batch` | 5 | 43 | 3 | `onError` | 6 | 16 | 2 |
| 4 | `download_object` | 5 | 18 | 2 | `fetchObjects` | 6 | 37 | 2 |
| 5 | `copy_prefix` | 5 | 20 | 2 | `step` | 6 | 25 | 2 |
| 6 | `get_client` | 4 | 16 | 1 | `envCredentials` | 5 | 9 | 1 |
