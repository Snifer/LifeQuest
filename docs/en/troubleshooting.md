# Troubleshooting

[Docs index](../README.md) · [Español](../es/troubleshooting.md)

Use this page when something behaves differently from what you expect.

## Dashboard does not open

- confirm the plugin is enabled
- run the dashboard command
- reload Obsidian if needed

## Daily note block does not appear

- check `Daily note format`
- make sure you have active quests
- confirm today’s note name matches the configured format

## Checkbox sync does not work

- keep the `#lq-...` tag intact
- avoid deleting the managed block markers
- regenerate the block if it became inconsistent
- if the quest is outside the daily note, check **Markdown sync scope**
- if you use selected folders, confirm the file is inside one of those folders
- whole-vault mode can be heavier, so selected folders are usually the safer setup

## Penalties did not apply from Kanban or another note

- this is expected today
- previous-day penalties are currently evaluated from the daily note flow only
- Markdown/Kanban sync handles completions, but not generic retroactive penalties

## Shop does not open

- enable coin rewards
- enable the shop add-on

## Health tracking does not open

- enable the health add-on
- enable at least one health module
- complete the body profile if using weight tracking

## Data looks wrong

- review your settings
- check `_LifeQuest/data.json`
- export data before resetting anything

## Next step

Read:

- [FAQ](faq.md)
- [Privacy and local-first behavior](privacy.md)
