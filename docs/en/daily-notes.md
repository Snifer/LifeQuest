# Daily notes

[Docs index](../README.md) · [Español](../es/daily-notes.md)

This guide explains how LifeQuest generates and synchronizes your daily note block.

## Quick path

1. Set your daily note format in settings
2. Create active quests
3. Run **Generate today’s quests in daily note**
4. Check items off in the note
5. Let LifeQuest sync progress back into the system

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

## Manual edits

You can edit the visible quest text, but keep the LifeQuest tag intact:

```text
#lq-quest-id
```

That tag is what allows LifeQuest to keep syncing the checkbox correctly.

If you remove the tag, the plugin can no longer map that line back to the quest.

## What happens on missed quests

LifeQuest checks the previous day and can apply penalties for incomplete quests when appropriate.

## Tips

- Keep the generated tag intact
- Avoid duplicating the same managed block manually
- Use grouping if your note gets too long
- Use pending-only mode if you regenerate often

## Next step

Read:

- [Widgets](widgets.md)
- [Troubleshooting](troubleshooting.md)
