# Write Your Own Durable Object

The code in the editor is a Durable Object class named `App`. When you run it, your class starts as a child of this site's Durable Object and its `fetch()` is called.

## Try this

1. Run it a few times as is. `memory` and `sqlite` grow together.
2. Change one character in a comment and run again. A code change recreates the instance, so **`memory` goes back to 1 while `sqlite` keeps counting**.

`memory` is in-memory state, lost on eviction or a code update. `sqlite` is durable state written with `ctx.storage.sql`. In production, `memory` disappears the same way after about 10 seconds without traffic.

## How it works

This site does not register your class as a DO directly. A DO on the site acts as the "parent" and loads your class as a **facet** (a child) with `ctx.facets.get()`. A facet has its own SQLite database, separate from the parent's, so your code cannot touch the parent's data. When you change the code, `ctx.facets.abort()` stops the facet and it is recreated. Storage is kept, which is why only `sqlite` continues counting.

The network is blocked and CPU is limited to 100 ms.
