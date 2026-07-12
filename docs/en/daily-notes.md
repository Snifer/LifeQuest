# Daily notes

[Docs index](../README.md) · [Español](../es/daily-notes.md)

This guide explains how LifeQuest generates your daily note block and how Markdown quest sync works beyond the daily note.

## Quick path

1. Set your daily note format in settings
2. Create active quests
3. Run **Generate today’s quests in daily note**
4. Check items off in the note
5. Let LifeQuest sync progress back into the system

For Kanban or other Markdown workflows:

1. Keep the `#lq-...` tag on the checkbox line
2. Set **Markdown sync scope** in settings
3. Prefer **Selected folders** if you do not want to scan the whole vault

## What the plugin generates

LifeQuest inserts a managed block into today’s note.

The block can include:

- a heading
- quest checkboxes
- optional grouping by area
- optional daily motivational message above the quest block

## Supported configuration

### Daily note format

Controls how LifeQuest identifies today’s note.

Example:

```text
YYYY-MM-DD
```

### Daily block template

You can customize the block template using:

- `{title}`
- `{content}`
- `{date}`

Example:

```text
{title}

{content}
```

Example with a callout:

```text
> [!todo] {date}
> Focus for today

{content}
```

### Group quests by area

When enabled, LifeQuest splits the generated block into sections like:

```text
### 📚 Learning
- [ ] Read 10 pages #lq-...
```

### Insert only pending quests

When enabled, regenerating the block hides quests already completed today.

This is useful if you rebuild the note later in the day and only want remaining work.

## Sync behavior

LifeQuest reads checkbox state from the generated block and syncs:

- completed quests
- failed or reversed quest states
- XP changes
- streak updates
- related notices and logs

## Markdown sync scope

LifeQuest can monitor quest checkboxes in three ways:

| Scope | What it monitors | Recommended for |
|-------|-------------------|-----------------|
| Daily note only | Today’s daily note file | Default workflow |
| Selected folders | Markdown files inside chosen folders | Kanban boards, project notes |
| Whole vault | All Markdown files in the vault | Advanced setups |

If you use Kanban, the best balance is usually **Selected folders**.

## Supported Markdown format

LifeQuest sync works when the checkbox line keeps the quest tag:

```text
- [ ] Build feature #lq-d23a-6cfb-4945-afe3-ecd6ea596e0c
- [x] Build feature #lq-d23a-6cfb-4945-afe3-ecd6ea596e0c
```

This means:

- the checkbox must be valid Markdown
- the `#lq-...` tag must stay on the same line
- the visible text can change

It works with:

- daily notes
- Kanban cards that store checklist lines in Markdown
- regular project notes

## Manual edits

You can edit the visible quest text, but keep the LifeQuest tag intact:

```text
#lq-quest-id
```

That tag is what allows LifeQuest to keep syncing the checkbox correctly.

If you remove the tag, the plugin can no longer map that line back to the quest.

## What happens on missed quests

LifeQuest checks the previous day and can apply penalties for incomplete quests when appropriate.

Important limitation:

- previous-day penalties currently come from the **daily note flow**
- generic Markdown sync is used for completions, not for retroactive penalties
- there is no multi-file penalties mode yet

Why this limitation exists:

- a Kanban card or project note can stay open for many days
- an unchecked item in those files does not reliably mean “failed yesterday”
- using generic Markdown for penalties would create false punishments

## Tips

- Keep the generated tag intact
- Avoid duplicating the same managed block manually
- Use grouping if your note gets too long
- Use pending-only mode if you regenerate often
- Prefer selected folders over whole-vault sync in large vaults

## Next step

Read:

- [Widgets](widgets.md)
- [Troubleshooting](troubleshooting.md)
