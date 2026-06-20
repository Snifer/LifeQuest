# Privacy and local-first behavior

[Docs index](../README.md) · [Español](../es/privacy.md)

LifeQuest is designed to work locally inside your vault.

## What the plugin stores

The plugin stores:

- hero/profile data
- quests
- XP and streak data
- weekly reviews
- optional shop data
- optional health data
- settings

## Where it stores data

Main storage:

- `_LifeQuest/data.json`

Optional health CSV export:

- `_LifeQuest/health/historial.csv`

## Network behavior

By default, LifeQuest does not need a remote service.

The current optional network-related feature is:

- remote daily motivational message source

If you do not configure that feature, the plugin remains fully local for its core workflow.

## What it does not do

- it does not require a cloud account
- it does not upload vault contents as part of the core system
- it does not execute remote code

## Recommendation

If privacy is important for your workflow, keep the daily message source disabled unless you explicitly want it.
