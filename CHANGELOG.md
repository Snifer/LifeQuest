# Changelog

## 1.0.2

Feature release focused on first-run experience and project planning artifacts.

### Added

- First-run onboarding flow to help new users configure language, hero profile, core settings, and optional add-ons.
- A command and settings entry to reopen onboarding at any time.
- Configurable daily note block templates with support for `{title}`, `{content}`, and `{date}` placeholders.
- Daily note options to group quests by area and insert only pending quests.

### Changed

- Set English as the default language for new installations.
- Disabled the shop add-on and dashboard coin balance by default for new installs.
- Updated the README in both English and Spanish to document the new daily note customization options.


## 1.0.1

Maintenance release focused on deployment and catalog-readiness updates for the Obsidian release process.

### Changed

- Updated release metadata and version mappings for the `1.0.1` deployment.
- Raised the minimum supported app version to `1.12.7`.
- Refined README presentation with bilingual references and repository badges.

### Fixed

- Adjusted manifest metadata to comply with Obsidian catalog validation rules.
- Updated GitHub workflows for CI, prerelease, and release automation.
- Improved plugin compatibility with popout windows by avoiding direct `document`, `setTimeout`, and `clearTimeout` usage patterns flagged by validation.
- Removed deprecated or discouraged UI API usage in settings and review styling to better match current Obsidian publishing requirements.

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
