# Widgets

[Docs index](../README.md) · [Español](../es/widgets.md)

Widgets let you embed live LifeQuest views inside any note using a markdown code block.

## Quick path

1. Create a code block with `lifequest`
2. Set `show`
3. Optionally set `theme`, `title`, or `period`
4. Preview the note

## Syntax

```lifequest
show: profile, xp-bar, streak
theme: card
title: Today
```

## Supported widget elements

- `profile`
- `xp-bar`
- `level`
- `streak`
- `multiplier`
- `quests-today`
- `area-progress`
- `weekly-chart`
- `coins`
- `weight`
- `health-progress`
- `bmi`
- `blood-pressure`
- `bp`

## Common parameters

| Parameter | Purpose |
|---|---|
| `show` | Which widgets to render |
| `theme` | Visual style |
| `title` | Optional widget title |
| `period` | Used by time-based widgets like `weekly-chart` |

## Example: simple hero snapshot

```lifequest
show: profile, level, xp-bar, streak
theme: card
title: Hero snapshot
```

## Example: monthly chart

```lifequest
show: weekly-chart
period: month
theme: card
title: XP this month
```

## Notes

- Widgets update from plugin data
- Some health widgets require the health add-on and profile setup
- Coin widgets require the economy/shop configuration to be active

## Next step

Read:

- [Getting started](getting-started.md)
- [Health add-on](health-addon.md)
