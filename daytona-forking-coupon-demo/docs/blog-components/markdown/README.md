# Markdown Blog Components

These Markdown partials replace the small-text screenshots for the guide's two
most diagram-heavy sections.

Use these when the blog supports Markdown but not Svelte or MDX components.

## Files

- `04-multilevel-fork-tree.md`: replaces `.artifacts/screenshots/guide-inserts/04-multilevel-fork-tree.png`.
- `05-state-semantics.md`: replaces `.artifacts/screenshots/guide-inserts/05-state-semantics.png`.

## How to use them

Paste the Markdown directly into the article where the screenshot placeholder
currently appears.

For `[SCREENSHOT: current fork tree]`, paste:

```text
docs/blog-components/markdown/04-multilevel-fork-tree.md
```

For `[SCREENSHOT: state layers and lifecycle semantics]`, paste:

```text
docs/blog-components/markdown/05-state-semantics.md
```

The PNG screenshots can still be used as fallbacks, but the Markdown versions
will be easier to read in a blog layout because the text remains native article
text.
