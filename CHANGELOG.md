# Changelog

## 1.0.0

First stable release of LifeQuest for Obsidian.

### Added

- Core quest system with XP, levels, streaks, badges, and progress panel.
- Daily note integration with quest injection and checkbox sync.
- Weekly review with statistics and insights.
- Economy with coins, shop, and configurable rewards.
- Health add-on with weight tracking, blood pressure, and medication log.
- Base internationalization for Spanish and English.

### Changed

- Settings reorganized into clearer panels.
- Health and shop extracted as optional add-ons.
- Rewards configuration centralized in `rewardSettings`.
- More consistent UI and messaging in `es` / `en`.

### Fixed

- Date consistency in the daily note and quest synchronization.
- `getXPToNextLevel` calculation at max level.
- Weekly weigh-in rules now respect the current week and configured day.
- Weight trend computed from real dates with consistent units.
- Validation for economy, health, and configuration to prevent inconsistent states.
