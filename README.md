# LifeQuest

<p align="center">
  <a href="https://obsidian.md/plugins"><img src="https://img.shields.io/badge/Obsidian-Plugin-7C3AED?logo=obsidian" alt="Obsidian Plugin"></a>
  <a href="https://github.com/Snifer/LifeQuest/releases"><img src="https://img.shields.io/github/v/release/Snifer/LifeQuest?label=version" alt="Latest release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green.svg" alt="MIT License"></a>
  <img src="https://img.shields.io/github/downloads/Snifer/LifeQuest/total?logo=github" alt="GitHub Downloads">
  <a href="https://ko-fi.com/bastiondeldino"><img src="https://img.shields.io/badge/Ko--fi-Buy%20me%20a%20coffee-ff5f5f?logo=ko-fi&logoColor=white" alt="Ko-fi"></a>
</p>

[English](README.md) | [Español](README-es.md)

LifeQuest is an Obsidian plugin that turns daily execution into a local RPG-style progression system. It combines quests, XP, streaks, weekly reviews, embeddable widgets, and optional add-ons for economy and health tracking.

LifeQuest started as a personal plugin built around my own workflow. I am sharing it because I believe it can also be useful to others. If you spot ways to improve it, feel free to open an issue, suggest changes, or request features so we can keep refining it over time. If you want to explore more of my productivity-related projects, you can find them on my YouTube channel: [youtube.com/c/sniferl4bs](https://youtube.com/c/sniferl4bs).

## What the plugin does

### Core system
- Hero profile with name, motto, avatar, accent color, and class.
- Custom life areas with color coding.
- Quest system with `daily`, `weekly`, `monthly`, and `free` frequencies.
- One-level subquests with independent XP, penalties, reminders, and difficulty.
- Optional parent auto-complete when all active subquests are completed on the same day.
- Difficulty, XP reward, penalty, reminders, and per-quest notes.
- XP progression with configurable XP-per-level.
- Streak tracking with multipliers and activity log.
- Weekly review view with stats, trends, insights, and reflection prompts.
- Dashboard view with hero summary, today summary, weekly chart, life areas, activity log, and quick actions.
- Dashboard quest lanes separated into pending, completed, and failed sections.
- Explicit dashboard actions to complete, fail, or reset quests without opening another modal.
- Optional dashboard compact mode plus manual, priority, XP, or area sorting.

### Daily note integration
- Generates a quest block inside the daily note using the configured date format.
- Supports a configurable block template with `{title}`, `{content}`, and `{date}` placeholders.
- Can group quests by life area inside the generated block.
- Can insert only pending quests when regenerating the daily block.
- Parses markdown checkboxes with `#lq-...` tags and syncs completion state back into LifeQuest.
- Can monitor only the daily note, selected folders, or the whole vault for Markdown quest sync.
- Applies previous-day penalties only through the daily note flow.
- Supports an optional daily motivational message above the generated block.

### Markdown quest sync
- Any Markdown checkbox line that keeps a LifeQuest tag like `#lq-d23a-...` can sync quest completion.
- This works with daily notes, Kanban cards, and other Markdown-based task workflows.
- You can copy the tag or a full Markdown checkbox directly from the quest UI.
- You can also use the command **LifeQuest: Copy quest as Markdown** to search any configured quest and copy its ready-to-paste checkbox with ID.
- Recommended setup for large vaults: use **selected folders** instead of **whole vault**.
- You can also define **excluded folders** to ignore archives, templates, or internal plugin data.
- Limitation: previous-day penalties are **not** derived from generic Markdown files yet. They still depend on the daily note.

### Widgets
LifeQuest registers a markdown code block processor for ````lifequest```` blocks, so you can embed live widgets in any note.

Supported widget elements:
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
- `blood-pressure` / `bp`

Example:

```lifequest
show: profile, xp-bar, streak, quests-today
theme: card
title: Estado de hoy
```

## Add-on system

LifeQuest separates optional functionality into add-ons exposed in **Settings → LifeQuest → Add-ons**.

### Shop add-on
- Enables the Hero Shop view.
- Lets the user redeem rewards using coins.
- Includes configurable coin rewards for level-ups, badges, streak milestones, weekly reviews, perfect weeks, epic quests, and health weigh-ins.
- Can display coin balance directly in the dashboard header.
- Can restore the default reward catalog without deleting custom rewards.

Dependencies and behavior:
- The economy itself is controlled by `coinsEnabled`.
- The shop UI is controlled by `shopEnabled`.
- If coin rewards are disabled, shop commands are blocked even if the shop add-on is enabled.

### Health add-on
- Enables the health tracking view.
- Modular internal submodules:
  - Weight and BMI tracking
  - Blood pressure logging
  - Medications and intake log
- Includes a body-profile setup flow for the weight module.
- Can export weight history to `_LifeQuest/health/historial.csv`.
- Schedules a weigh-in reminder when the profile has reminders enabled.

Dependencies and behavior:
- The add-on is controlled by `healthEnabled`.
- Each submodule is toggled independently through `healthModules`.
- Weight widgets and commands require the body profile to be configured first.

## Commands

The plugin currently registers these commands:
- `LifeQuest: Open dashboard`
- `LifeQuest: New quest`
- `LifeQuest: Quick complete quest`
- `LifeQuest: Copy quest as Markdown`
- `LifeQuest: Weekly review`
- `LifeQuest: Generate today's quests in daily note`
- `LifeQuest: Edit profile`
- `LifeQuest: Open hero shop`
- `LifeQuest: Health tracking`
- `LifeQuest: Log today's weight`

## Stored data

LifeQuest stores its data locally inside the vault:
- Main data file: `_LifeQuest/data.json`
- Health CSV export: `_LifeQuest/health/historial.csv`

The plugin is local-first. The only network-related feature currently present is the optional remote source for daily motivational messages, configured explicitly by the user.

## Views and UI

Custom views currently implemented:
- Dashboard
- Weekly review
- Shop
- Health tracker

Additional UI flows:
- Profile editor modal
- Quest configuration modal
- Health setup modal
- Settings panel with sidebar sections for interface, hero, progression, economy, add-ons, data, and about

## Installation

### Manual installation
1. Build or download `main.js`, `manifest.json`, and `styles.css`.
2. Copy them into your vault at `.obsidian/plugins/lifequest/`.
3. Open **Settings → Community plugins**.
4. Enable **LifeQuest**.

## Development

Requirements:
- Node.js 18+
- npm

Commands:
- `npm install`
- `npm run dev`
- `npm run build`
- `npm test -- --runInBand`
- `npm run lint`

## Current implementation notes

- The plugin is split across modules under `src/`, with `main.ts` acting as lifecycle entrypoint.
- Tests currently cover the engine and daily message parsing/selection logic.
- The `weekly-chart` widget supports `period: week`, `period: month`, and `period: all`.
- Markdown quest sync supports scoped monitoring through settings: daily note, selected folders, or whole vault.
- Subquests currently support one nesting level, collapse/expand, and sibling reordering from the quest configuration modal.
- Parent quests remain independent by default in v1, but you can now enable optional parent auto-complete in progression settings.
- Quest lists now support root-only filtering plus expand/collapse-all controls in hierarchy views.

## License

MIT
