import { Notice } from 'obsidian';
import type LifequestPlugin from '../main';
import { generateDailyNote } from '../daily-note';
import { ProfileEditorModal } from '../ui/profile-editor';
import { QuestConfigModal } from '../ui/quest-config';
import { QuestCopyMarkdownModal } from '../ui/quest-copy-markdown-modal';
import { SHOP_VIEW_TYPE } from '../ui/shop';
import { HEALTH_VIEW_TYPE } from '../ui/health-tracker';
import { HealthSetupModal } from '../ui/health-setup';
import { OnboardingModal } from '../ui/onboarding';
import { executeObsidianCommand } from '../command-api';
import { getLang, pick } from '../i18n';

export function registerCommands(plugin: LifequestPlugin) {
	const lang = getLang(plugin);
	plugin.addCommand({
		id: 'open-dashboard',
		name: pick(lang, 'LifeQuest: Abrir panel', 'LifeQuest: Open dashboard'),
		callback: () => void plugin.openDashboard()
	});

	plugin.addCommand({
		id: 'open-onboarding',
		name: pick(lang, 'LifeQuest: Reabrir onboarding', 'LifeQuest: Reopen onboarding'),
		callback: () => new OnboardingModal(plugin, true).open()
	});

	plugin.addCommand({
		id: 'new-quest',
		name: pick(lang, 'LifeQuest: Nueva quest', 'LifeQuest: New quest'),
		callback: () => new QuestConfigModal(plugin).open()
	});

	plugin.addCommand({
		id: 'copy-quest-markdown',
		name: pick(lang, 'LifeQuest: Copiar quest en Markdown', 'LifeQuest: Copy quest as Markdown'),
		callback: () => {
			if (plugin.data.quests.length === 0) {
				new Notice(pick(lang, 'No hay quests configuradas todavía.', 'There are no configured quests yet.'));
				return;
			}
			new QuestCopyMarkdownModal(plugin).open();
		}
	});

	plugin.addCommand({
		id: 'weekly-review',
		name: pick(lang, 'LifeQuest: Revisión semanal', 'LifeQuest: Weekly review'),
		callback: () => void plugin.openWeeklyReview()
	});

	plugin.addCommand({
		id: 'generate-daily-note',
		name: pick(lang, 'LifeQuest: Generar quests de hoy en la nota diaria', 'LifeQuest: Generate today\'s quests in daily note'),
		callback: () => void generateDailyNote(plugin)
	});

	plugin.addCommand({
		id: 'open-profile',
		name: pick(lang, 'LifeQuest: Editar perfil', 'LifeQuest: Edit profile'),
		callback: () => new ProfileEditorModal(plugin).open()
	});

	plugin.addCommand({
		id: 'open-shop',
		name: pick(lang, 'LifeQuest: Abrir tienda del héroe', 'LifeQuest: Open hero shop'),
		callback: () => {
			if (!plugin.data.settings.coinsEnabled) {
				new Notice(pick(lang, 'Activa las recompensas con monedas en los ajustes de LifeQuest.', 'Enable coin rewards in LifeQuest settings.'));
				return;
			}

			if (!plugin.data.settings.shopEnabled) {
				new Notice(pick(lang, 'Activa el addon de tienda en los ajustes de LifeQuest.', 'Enable the shop add-on in LifeQuest settings.'));
				return;
			}

			const existing = plugin.app.workspace.getLeavesOfType(SHOP_VIEW_TYPE);
			if (existing.length > 0 && existing[0]) {
				void plugin.app.workspace.revealLeaf(existing[0]);
			} else {
				void plugin.app.workspace.getRightLeaf(false)?.setViewState({
					type: SHOP_VIEW_TYPE,
					active: true,
				});
			}
		}
	});

	plugin.addCommand({
		id: 'open-health',
		name: pick(lang, 'LifeQuest: Seguimiento de salud', 'LifeQuest: Health tracking'),
		callback: () => {
			if (!plugin.data.settings.healthEnabled || !plugin.data.health?.enabled) {
				new Notice(pick(lang, 'Activa el addon de salud en los ajustes de LifeQuest.', 'Enable the health add-on in LifeQuest settings.'));
				return;
			}
			if (!plugin.data.settings.healthModules.weight && !plugin.data.settings.healthModules.bloodPressure && !plugin.data.settings.healthModules.medications) {
				new Notice(pick(lang, 'Activa al menos un submódulo de salud para usar esta vista.', 'Enable at least one health submodule to use this view.'));
				return;
			}
			if (plugin.data.settings.healthModules.weight && !plugin.data.health?.profile) {
				new Notice(pick(lang, 'Completa primero tu perfil corporal para usar el seguimiento de peso.', 'Complete your body profile first to use weight tracking.'));
				new HealthSetupModal(plugin.app, plugin, false).open();
				return;
			}

			const existing = plugin.app.workspace.getLeavesOfType(HEALTH_VIEW_TYPE);
			if (existing.length > 0 && existing[0]) {
				void plugin.app.workspace.revealLeaf(existing[0]);
			} else {
				void plugin.app.workspace.getRightLeaf(false)?.setViewState({
					type: HEALTH_VIEW_TYPE,
					active: true,
				});
			}
		}
	});

	plugin.addCommand({
		id: 'log-weight',
		name: pick(lang, 'LifeQuest: Registrar peso de hoy', 'LifeQuest: Log today\'s weight'),
		callback: () => {
			if (!plugin.data.settings.healthEnabled || !plugin.data.settings.healthModules.weight) {
				new Notice(pick(lang, 'Activa el submódulo de peso en los ajustes de LifeQuest.', 'Enable the weight module in LifeQuest settings.'));
				return;
			}
			if (!plugin.data.health?.profile) {
				new Notice(pick(lang, 'Configura primero tu perfil corporal para registrar peso.', 'Set up your body profile first to log weight.'));
				new HealthSetupModal(plugin.app, plugin, false).open();
				return;
			}

			void executeObsidianCommand(plugin.app, `${plugin.manifest.id}:open-health`);
		}
	});
}
