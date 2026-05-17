# Task Timeline

An Obsidian plugin that renders Markdown tasks across the vault as a
horizontal timeline view. Each task is a bar positioned on a date axis;
the sidebar lists the tasks aligned to their bars.

## Examples

Each task line that the plugin recognizes is a Markdown checkbox plus a
date marker. A range is two ISO dates joined by ` - ` (space-dash-space)
inside the same marker. The first date is the start, the second is the
due date.

```markdown
# Inline tasks (body is the bar label)

- [ ] Ship v0.1 (@2025-05-20)
- [ ] Ship v0.1 (@2025-05-18 - 2025-05-25)

- [ ] Plan launch 📅 2025-05-20
- [ ] Plan launch 📅 2025-05-17 - 2025-05-20

- [ ] Review PR @{2025-05-20}
- [ ] Review PR @{2025-05-19 - 2025-05-21}

# Linked-page tasks (bar label is the page title)

- [ ] [[Plan launch]]
- [ ] [[Q3 roadmap|Roadmap]]
```

For a linked-page task, the dates come from the linked page's note
properties:

```markdown
---
due: 2025-05-20
start: 2025-05-15
---

Notes about the launch...
```

Done tasks (`[x]`) render as a muted, struck-through bar.

See [`.claude/spec.html`](./.claude/spec.html) for the full syntax
reference (precedence between markers, mixed-body fall-through, validity
rules for ranges).

## Docs

The design lives under [`.claude/`](./.claude/). Open the HTML files in a
browser for the rendered view.

- **Spec** (what to build): [`.claude/spec.html`](./.claude/spec.html)
- **Implementation** (how to build it): [`.claude/implementation.html`](./.claude/implementation.html)

## Quick start

- `npm i` to install dependencies.
- `npm run dev` to build in watch mode.
- `npm run build` to produce a production bundle.
- `npm run lint` to run ESLint with Obsidian plugin rules.

See the [implementation doc](./.claude/implementation.html) for the manual
install path and the milestone breakdown.
