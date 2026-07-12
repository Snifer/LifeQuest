# Quests and progression

[Docs index](../README.md) · [Español](../es/quests-and-progression.md)

This guide explains how quests, XP, levels, streaks, badges, and classes work in LifeQuest.

## Quick path

1. Create a quest
2. Assign a life area
3. Complete it from the dashboard or daily note
4. Watch XP, streaks, and rewards update

## Quest types

LifeQuest supports these frequencies:

- `daily`
- `weekly`
- `monthly`
- `free`

### Recommended use

| Frequency | Good use case |
|---|---|
| Daily | habits and repeated execution |
| Weekly | bigger weekly commitments |
| Monthly | milestones or reviews |
| Free | manual or flexible tasks |

## Quest fields

Each quest can include:

- title
- life area
- difficulty
- XP reward
- penalty
- reminder
- optional note
- status

## Subquests

LifeQuest now supports **one level of subquests**.

Current behavior:

- a root quest can contain subquests
- each subquest has its own XP, penalty, reminder, and difficulty
- subquests can be collapsed or expanded under their parent
- subquests can be reordered among siblings in the quest configuration modal
- the parent quest can stay manual or auto-complete when all active subquests are done, depending on settings
- hierarchy views can switch to roots-only mode and expand or collapse all roots at once

Important limitation:

- only one nesting level is supported in this first iteration

## Copying a quest to Markdown or Kanban

LifeQuest now lets you copy quest references directly from the quest UI:

- **Copy tag** → `#lq-<id>`
- **Copy Markdown checkbox** → `- [ ] Quest title #lq-<id>`
- **Command Palette** → `LifeQuest: Copy quest as Markdown`

Use the full Markdown checkbox when you want the fastest path into Kanban or any regular note. The command palette flow is useful when you want to find a quest quickly without opening the quest configuration modal.

## Difficulty

Difficulty affects how the quest feels in your system and may also affect related reward logic.

Use:

- easy for low-friction habits
- normal for baseline work
- hard for meaningful effort
- epic for rare, high-value actions

## XP and levels

Completing quests grants XP.

Failing or missing quests can apply penalties.

Level progression is based on:

- total XP
- `XP per level` in settings

## Streaks

Streaks increase when you keep daily activity alive.

They are used for:

- progression feedback
- motivational pacing
- optional reward logic

## Classes and life areas

Your hero class gives a bonus to one life area.

Examples:

- health
- work
- learning
- relationships
- finances

Classes and areas work together so the system can reflect your priorities.

## Badges

LifeQuest unlocks badges for some milestones, such as:

- streak milestones
- level milestones

Badges can also grant bonus XP.

## Good quest design tips

- Keep titles short and clear
- Avoid vague “work more” tasks
- Prefer visible actions
- Start easier than you think
- Use penalties carefully

## Next step

Read:

- [Daily notes](daily-notes.md)
- [Weekly review](weekly-review.md)
