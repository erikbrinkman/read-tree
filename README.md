Read Tree
=========
[![build](https://github.com/erikbrinkman/read-tree/actions/workflows/node.js.yml/badge.svg)](https://github.com/erikbrinkman/read-tree/actions/workflows/node.js.yml)
[![docs](https://img.shields.io/badge/docs-docs-blue)](https://erikbrinkman.github.io/read-tree/)
[![npm](https://img.shields.io/npm/v/read-tree)](https://www.npmjs.com/package/read-tree)
[![license](https://img.shields.io/github/license/erikbrinkman/read-tree)](LICENSE)

> :warning: now that browser extensions have an offscreen api, and deno has wasm dom support this isn't necessary, and so has been archived.

A parse5 tree adapter that works with readability. Simply use the exported
`treeAdapter` with `parse5`'s `parse` function, and pass the result into
readability to get a summarized document that's much more lightweight than
JSDom and doesn't require browser DOM parsing either.

```ts
import { Readability } from "@mozilla/readability";
import { parse } from "parse5";
import { treeAdapter } from "read-tree";
const doc = parse(content, { treeAdapter });
// NOTE Readabilty says it takes a compliant document, but it actually just
// takes the limited Document defined here.
const { content } = new Readability(parsed as unknown as Document).parse();
```

This was designed to work with Readablity, but not necessarily to be
performant. There are several operations that don't scale linearly and when
used by Readability result in quadratic time operators. These could be sped up
to linear with significant more effort in caching, but at this point,
compliance was more important than performance.

Conceptually this lies somewhere between `parse5` and `cheerio`. It tries to
imitate browser functionality more than parse5, but without as much
functionality as cheerio.
