# Getting started

[Docs index](../README.md) · [Español](../es/getting-started.md)

This guide helps you go from installation to your first useful LifeQuest workflow.

## Quick path

1. Install and enable the plugin
2. Complete onboarding
3. Open the dashboard
4. Create your first quest
5. Use quick complete or quick copy actions if you want a faster daily flow
6. Generate your daily note block
7. Optional: enable Markdown sync for selected folders if you use Kanban
8. Optional: copy the Markdown checkbox from the quest UI or from **LifeQuest: Copy quest as Markdown** into your Kanban note

## What LifeQuest is

LifeQuest turns daily execution into a local RPG-style system with:

- quests
- XP and levels
- streaks
- weekly reviews
- note widgets
- optional shop and health add-ons

## Install

### Manual install

1. Build or download `main.js`, `manifest.json`, and `styles.css`
2. Copy them to:

   ```text
   .obsidian/plugins/lifequest/
   ```

3. Open **Settings → Community plugins**
4. Enable **LifeQuest**

## First setup

On a fresh install, LifeQuest opens an onboarding flow that lets you configure:

- language
- hero name and motto
- base life areas
- starting class
- daily note format
- optional add-ons

You can reopen onboarding later from:

- plugin settings
- the onboarding command

## Core views

### Dashboard

Use the dashboard as your main control center. It shows:

- hero summary
- today summary
- weekly chart
- life areas
- recent activity
- quick actions
- separated pending / completed / failed quest sections
- per-quest complete, fail, and reset buttons
- compact mode and dashboard sorting controls

### Weekly review

Use the weekly review to reflect on:

- XP earned
- completion rate
- life area performance
- quest performance
- insights and next-week adjustments

## First recommended workflow

1. Open the dashboard
2. Create 3 to 5 simple daily quests
3. Use the dashboard quick complete action during the day if you want less friction
4. If you use Kanban, copy a quest checkbox from the quest UI or by using **LifeQuest: Copy quest as Markdown**
5. Generate today’s quests into your daily note
6. Review the dashboard in the evening
7. Complete the weekly review at the end of the week

## Default storage

LifeQuest stores its data locally in:

- `_LifeQuest/data.json`
- `_LifeQuest/health/historial.csv` for health CSV exports

## Next step

Read:

- [Quests and progression](quests-and-progression.md)
- [Daily notes](daily-notes.md)
- [Widgets](widgets.md)
