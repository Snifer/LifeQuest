import { App, ButtonComponent, Notice, PluginSettingTab, Setting } from 'obsidian';
import type LifequestPlugin from './main';
import { DEFAULT_DATA, type RewardSettings, type ShopReward } from './types';
import { executeObsidianCommand } from './command-api';
import { getLang, pick, t } from './i18n';
import { HealthSetupModal } from './ui/health-setup';
import { exportHealthCSV } from './ui/health-tracker';
import { ConfirmModal } from './ui/confirm-modal';
import { moment } from './obsidian-moment';
import { refreshTrackedQuestState } from './daily-note';

type TranslationKey = Parameters<typeof t>[0];
type TranslationVars = Record<string, string | number>;
type MessageTone = LifequestPlugin['data']['settings']['messagesTone'];
type DailyMessageMode = LifequestPlugin['data']['settings']['dailyMessage']['mode'];

const REWARD_PRESETS: Record<string, RewardSettings> = {
	conservative: {
		notificationsEnabled: true,
		multiplier: 0.8,
		levelUp: { base: 30, factor: 5 },
		badges: { common: 10, epic: 40 },
		streakMilestones: { streak7: 20, streak30: 60, streak100: 180 },
		weeklyReview: 10,
		perfectWeek: 25,
		epicQuest: 5,
		weighIn: { base: 5, streak4: 10, streak12: 20 },
	},
	balanced: {
		notificationsEnabled: true,
		multiplier: 1.0,
		levelUp: { base: 50, factor: 10 },
		badges: { common: 20, epic: 75 },
		streakMilestones: { streak7: 30, streak30: 100, streak100: 300 },
		weeklyReview: 15,
		perfectWeek: 40,
		epicQuest: 10,
		weighIn: { base: 10, streak4: 20, streak12: 30 },
	},
	intense: {
		notificationsEnabled: true,
		multiplier: 1.25,
		levelUp: { base: 75, factor: 15 },
		badges: { common: 30, epic: 100 },
		streakMilestones: { streak7: 50, streak30: 150, streak100: 500 },
		weeklyReview: 25,
		perfectWeek: 60,
		epicQuest: 20,
		weighIn: { base: 15, streak4: 30, streak12: 50 },
	},
};

type SettingsSection =
	| 'interface'
	| 'hero'
	| 'progression'
	| 'economy'
	| 'addons'
	| 'data'
	| 'about';

export class LifequestSettingTab extends PluginSettingTab {
	plugin: LifequestPlugin;
	private activeSection: SettingsSection = 'interface';

	constructor(app: App, plugin: LifequestPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	private tr(key: TranslationKey, vars?: TranslationVars): string;
	private tr(esText: string, enText: string): string;
	private tr(first: string, second: TranslationVars | string = {}): string {
		const lang = getLang(this.plugin);
		if (typeof second === 'string') return pick(lang, first, second);
		return t(first as TranslationKey, lang, second);
	}

	private parseBoundedInt(raw: string, min: number, max: number, labelEs: string, labelEn: string): number | null {
		const value = parseInt(raw, 10);
		if (Number.isNaN(value)) {
			new Notice(this.tr(`${labelEs}: ingresa un número válido.`, `${labelEn}: enter a valid number.`));
			return null;
		}
		if (value < min || value > max) {
			new Notice(this.tr(`${labelEs}: usa un valor entre ${min} y ${max}.`, `${labelEn}: use a value between ${min} and ${max}.`));
			return null;
		}
		return value;
	}

	private setDestructiveButton(button: ButtonComponent): ButtonComponent {
		button.buttonEl.classList.add('mod-warning');
		return button;
	}

	display(): void {
		this.rerender();
	}

	private rerender(): void {
		const { containerEl } = this;
		containerEl.empty();
		const layout = containerEl.createDiv({ cls: 'lq-settings-layout' });
		const sidebar = layout.createDiv({ cls: 'lq-settings-sidebar' });
		const panel = layout.createDiv({ cls: 'lq-settings-panel' });

		new Setting(sidebar).setName(this.tr('Ajustes del plugin', 'Plugin settings')).setHeading();
		sidebar.createEl('p', {
			text: this.tr('settings_plugin_panels_desc'),
			cls: 'lq-settings-subtitle',
		});

		const nav = sidebar.createDiv({ cls: 'lq-settings-nav' });
		const sections: Array<{ id: SettingsSection; label: string; badge?: string }> = [
			{ id: 'interface', label: this.tr('settings_interface') },
			{ id: 'hero', label: this.tr('settings_hero_areas') },
			{ id: 'progression', label: this.tr('settings_progression') },
			{ id: 'economy', label: this.tr('settings_economy') },
			{ id: 'addons', label: this.tr('Add-ons', 'Add-ons'), badge: this.getAddonBadge() },
			{ id: 'data', label: this.tr('settings_data') },
			{ id: 'about', label: this.tr('settings_about') },
		];

		sections.forEach((section) => {
			const btn = nav.createEl('button', {
				text: section.label,
				cls: `lq-settings-nav-btn ${this.activeSection === section.id ? 'is-active' : ''}`,
			});
			if (section.badge) {
				btn.createSpan({ text: section.badge, cls: 'lq-settings-badge' });
			}
			btn.addEventListener('click', () => {
				this.activeSection = section.id;
				this.rerender();
			});
		});

		this.renderSection(panel);
	}

	private renderSection(panel: HTMLElement): void {
		switch (this.activeSection) {
			case 'interface':
				this.renderInterfacePanel(panel);
				break;
			case 'hero':
				this.renderHeroPanel(panel);
				break;
			case 'progression':
				this.renderProgressionPanel(panel);
				break;
			case 'economy':
				this.renderEconomyPanel(panel);
				break;
			case 'addons':
				this.renderAddonsPanel(panel);
				break;
			case 'data':
				this.renderDataPanel(panel);
				break;
			case 'about':
				this.renderAboutPanel(panel);
				break;
		}
	}

	private renderInterfacePanel(panel: HTMLElement): void {
		this.renderPanelHeader(panel, this.tr('settings_interface'), this.tr('Opciones generales de idioma, tono y comportamiento diario.', 'General options for language, tone and daily behavior.'));

		this.renderSubheading(panel, this.tr('settings_language_view'));
		new Setting(panel)
			.setName(this.tr('Idioma', 'Language'))
			.setDesc(this.tr('Selecciona el idioma de los mensajes e interfaces de LifeQuest.', 'Select the language for LifeQuest messages and interfaces.'))
			.addDropdown((drop) => drop
				.addOption('es', 'Español')
				.addOption('en', 'English')
				.setValue(this.plugin.data.settings.language)
				.onChange(async (val: string) => {
					this.plugin.data.settings.language = val as 'es' | 'en';
					await this.plugin.store.save(this.plugin.data);
				}));

		new Setting(panel)
			.setName(this.tr('Tono de mensajes', 'Message tone'))
			.setDesc(this.tr('Tono para subidas de nivel, badges y feedback de progreso.', 'Tone for level ups, badges and progress feedback.'))
			.addDropdown((drop) => drop
				.addOption('motivating', this.tr('Motivador', 'Motivating'))
				.addOption('neutral', this.tr('Neutral', 'Neutral'))
				.addOption('stoic', this.tr('Estoico', 'Stoic'))
				.addOption('humorous', this.tr('Humorístico', 'Humorous'))
				.setValue(this.plugin.data.settings.messagesTone)
				.onChange(async (val: string) => {
					this.plugin.data.settings.messagesTone = val as MessageTone;
					await this.plugin.store.save(this.plugin.data);
				}));

		this.renderSubheading(panel, this.tr('settings_daily_routine'));
		new Setting(panel)
			.setName(this.tr('Formato de nota diaria', 'Daily note format'))
			.setDesc(this.tr('Formato de tus notas diarias usando sintaxis de moment.js.', 'Format of your daily notes using moment.js syntax.'))
			.addText((text) => text
				.setValue(this.plugin.data.settings.dailyNoteFormat)
				.onChange(async (val) => {
					this.plugin.data.settings.dailyNoteFormat = val;
					await this.plugin.store.save(this.plugin.data);
				}));

		new Setting(panel)
			.setName(this.tr('Plantilla del bloque diario', 'Daily block template'))
			.setDesc(this.tr(
				'Personaliza el bloque generado. Puedes usar {title}, {content} y {date}.',
				'Customize the generated block. You can use {title}, {content}, and {date}.'
			))
			.addTextArea((text) => text
				.setPlaceholder('{title}\n{content}')
				.setValue(this.plugin.data.settings.dailyNoteTemplate)
				.onChange(async (val) => {
					this.plugin.data.settings.dailyNoteTemplate = val.trim().length > 0 ? val : '{title}\n{content}';
					await this.plugin.store.save(this.plugin.data);
				}));

		new Setting(panel)
			.setName(this.tr('Agrupar quests por área', 'Group quests by area'))
			.setDesc(this.tr(
				'Divide el bloque diario en secciones por área de vida.',
				'Split the daily block into sections by life area.'
			))
			.addToggle((toggle) => toggle
				.setValue(this.plugin.data.settings.dailyNoteGroupByArea)
				.onChange(async (val) => {
					this.plugin.data.settings.dailyNoteGroupByArea = val;
					await this.plugin.store.save(this.plugin.data);
				}));

		new Setting(panel)
			.setName(this.tr('Insertar solo quests pendientes', 'Insert only pending quests'))
			.setDesc(this.tr(
				'Oculta las quests ya completadas hoy cuando vuelves a generar el bloque.',
				'Hide quests already completed today when you regenerate the block.'
			))
			.addToggle((toggle) => toggle
				.setValue(this.plugin.data.settings.dailyNoteOnlyPending)
				.onChange(async (val) => {
					this.plugin.data.settings.dailyNoteOnlyPending = val;
					await this.plugin.store.save(this.plugin.data);
				}));

		new Setting(panel)
			.setName(this.tr('Alcance de sincronización markdown', 'Markdown sync scope'))
			.setDesc(this.tr(
				'Define si LifeQuest escucha solo la daily note, carpetas concretas o toda la bóveda.',
				'Choose whether LifeQuest listens only to the daily note, specific folders, or the whole vault.'
			))
			.addDropdown((drop) => drop
				.addOption('daily-note', this.tr('Solo daily note', 'Daily note only'))
				.addOption('folders', this.tr('Carpetas específicas', 'Selected folders'))
				.addOption('vault', this.tr('Toda la bóveda', 'Whole vault'))
				.setValue(this.plugin.data.settings.markdownSyncScope)
				.onChange(async (val) => {
					this.plugin.data.settings.markdownSyncScope = val as LifequestPlugin['data']['settings']['markdownSyncScope'];
					await this.plugin.store.save(this.plugin.data);
					await refreshTrackedQuestState(this.plugin);
					this.rerender();
				}));

		if (this.plugin.data.settings.markdownSyncScope === 'folders') {
			new Setting(panel)
				.setName(this.tr('Carpetas monitoreadas', 'Tracked folders'))
				.setDesc(this.tr(
					'Una carpeta por línea. Ejemplo: Projects o Kanban/Work. Solo se revisarán archivos Markdown dentro de esas rutas.',
					'One folder per line. Example: Projects or Kanban/Work. Only Markdown files inside those paths will be checked.'
				))
				.addTextArea((text) => text
					.setPlaceholder('Projects, kanban board')
					.setValue(this.plugin.data.settings.markdownSyncFolders.join('\n'))
					.onChange(async (val) => {
						this.plugin.data.settings.markdownSyncFolders = val
							.split('\n')
							.map((entry) => entry.trim())
							.filter((entry, index, arr) => entry.length > 0 && arr.indexOf(entry) === index);
						await this.plugin.store.save(this.plugin.data);
						await refreshTrackedQuestState(this.plugin);
					}));
		}

		if (this.plugin.data.settings.markdownSyncScope === 'folders' || this.plugin.data.settings.markdownSyncScope === 'vault') {
			new Setting(panel)
				.setName(this.tr('Carpetas excluidas', 'Excluded folders'))
				.setDesc(this.tr(
					'Una carpeta por línea. Útil para ignorar archive, templates u otras zonas que no deberían disparar sincronización.',
					'One folder per line. Useful for ignoring archive, templates, or other areas that should not trigger sync.'
				))
				.addTextArea((text) => text
					.setPlaceholder('Archive, templates')
					.setValue(this.plugin.data.settings.markdownSyncExcludedFolders.join('\n'))
					.onChange(async (val) => {
						this.plugin.data.settings.markdownSyncExcludedFolders = val
							.split('\n')
							.map((entry) => entry.trim())
							.filter((entry, index, arr) => entry.length > 0 && arr.indexOf(entry) === index);
						await this.plugin.store.save(this.plugin.data);
						await refreshTrackedQuestState(this.plugin);
					}));
		}

		if (this.plugin.data.settings.markdownSyncScope === 'vault') {
			new Setting(panel)
				.setName(this.tr('Aviso de rendimiento', 'Performance warning'))
				.setDesc(this.tr(
					'Monitorear toda la bóveda puede ser más pesado en vaults grandes. Si usás Kanban, suele convenir limitarlo a carpetas específicas.',
					'Monitoring the whole vault can be heavier in large vaults. If you use Kanban, limiting sync to selected folders is usually better.'
				));
		}

		new Setting(panel)
			.setName(this.tr('Frase diaria remota', 'Remote daily message'))
			.setDesc(this.tr('Añade una frase motivacional encima de la nota diaria solo si activas esta opción.', 'Add a motivational message above the daily note only if you enable this option.'))
			.addToggle((toggle) => toggle
				.setValue(this.plugin.data.settings.dailyMessage.enabled)
				.onChange(async (val) => {
					this.plugin.data.settings.dailyMessage.enabled = val;
					await this.plugin.store.save(this.plugin.data);
					this.rerender();
				}));

		if (this.plugin.data.settings.dailyMessage.enabled) {
			new Setting(panel)
				.setName(this.tr('Modo de frase', 'Message mode'))
				.setDesc(this.tr('Elige si se toma una frase diaria pseudoaleatoria o una entrada exacta por día del año.', 'Choose whether to use a pseudo-random daily quote or an exact entry by day of year.'))
				.addDropdown((drop) => drop
					.addOption('random_daily', this.tr('Aleatoria diaria', 'Daily random'))
						.addOption('day_of_year', this.tr('Por día del año', 'By day of year'))
						.setValue(this.plugin.data.settings.dailyMessage.mode)
						.onChange(async (val) => {
							this.plugin.data.settings.dailyMessage.mode = val as DailyMessageMode;
							await this.plugin.store.save(this.plugin.data);
						}));

			new Setting(panel)
				.setName(this.tr('URL fuente en español', 'Spanish source URL'))
				.setDesc(this.tr('Archivo remoto de frases en castellano. Usa preferiblemente el raw de GitHub.', 'Remote file for Spanish messages. Prefer the GitHub raw URL.'))
				.addText((text) => text
					.setPlaceholder('https://raw.githubusercontent.com/...')
					.setValue(this.plugin.data.settings.dailyMessage.sourceUrls.es)
					.onChange(async (val) => {
						this.plugin.data.settings.dailyMessage.sourceUrls.es = val.trim();
						await this.plugin.store.save(this.plugin.data);
					}));

			new Setting(panel)
				.setName(this.tr('URL fuente en inglés', 'English source URL'))
				.setDesc(this.tr('Archivo remoto de frases en inglés. Usa preferiblemente el raw de GitHub.', 'Remote file for English messages. Prefer the GitHub raw URL.'))
				.addText((text) => text
					.setPlaceholder('https://raw.githubusercontent.com/...')
					.setValue(this.plugin.data.settings.dailyMessage.sourceUrls.en)
					.onChange(async (val) => {
						this.plugin.data.settings.dailyMessage.sourceUrls.en = val.trim();
						await this.plugin.store.save(this.plugin.data);
					}));

			panel.createEl('p', {
				text: this.tr('Formato soportado por línea: `001 | frase | autor` o `frase | autor`. El idioma activo del plugin decide qué fuente usar.', 'Supported per-line format: `001 | quote | author` or `quote | author`. The active plugin language decides which source is used.'),
				cls: 'setting-item-description',
			});
		}

		new Setting(panel)
			.setName(this.tr('Recordatorio vespertino', 'Evening reminder'))
			.setDesc(this.tr('Recordarte revisar tus quests por la tarde.', 'Remind you to review your quests in the evening.'))
			.addToggle((toggle) => toggle
				.setValue(this.plugin.data.settings.eveningReminder)
				.onChange(async (val) => {
					this.plugin.data.settings.eveningReminder = val;
					await this.plugin.store.save(this.plugin.data);
				}));

		new Setting(panel)
			.setName(this.tr('Alerta de racha', 'Streak alert'))
			.setDesc(this.tr('Muestra una alerta cuando estás por perder la racha.', 'Show an alert when you are about to lose your streak.'))
			.addToggle((toggle) => toggle
				.setValue(this.plugin.data.settings.streakAlert)
				.onChange(async (val) => {
					this.plugin.data.settings.streakAlert = val;
					await this.plugin.store.save(this.plugin.data);
				}));
	}

	private renderHeroPanel(panel: HTMLElement): void {
		this.renderPanelHeader(panel, this.tr('settings_hero_areas'), this.tr('Personaliza las áreas de vida y las clases del sistema.', 'Customize life areas and system classes.'));

		this.renderSubheading(panel, this.tr('settings_life_areas'));
		this.plugin.data.settings.lifeAreas.forEach((area, index) => {
			new Setting(panel)
				.setName(area.name)
				.setDesc(this.tr(`ID: ${area.id}`, `ID: ${area.id}`))
				.addText((text) => text
					.setValue(area.name)
					.onChange(async (val) => {
						const target = this.plugin.data.settings.lifeAreas[index];
						if (target) target.name = val;
						await this.plugin.store.save(this.plugin.data);
					}))
				.addColorPicker((color) => color
					.setValue(area.color)
					.onChange(async (val) => {
						const target = this.plugin.data.settings.lifeAreas[index];
						if (target) target.color = val;
						await this.plugin.store.save(this.plugin.data);
					}))
				.addButton((btn) => btn
					.setIcon('trash')
					.setTooltip(this.tr('Eliminar área', 'Delete area'))
					.onClick(async () => {
						this.plugin.data.settings.lifeAreas.splice(index, 1);
						await this.plugin.store.save(this.plugin.data);
						this.rerender();
					}));
		});

		new Setting(panel)
			.setName(this.tr('Nueva área', 'New area'))
			.setDesc(this.tr('Añade una nueva categoría principal para tus quests.', 'Add a new main category for your quests.'))
			.addButton((btn) => btn
				.setButtonText(this.tr('+ Añadir área', '+ Add new area'))
				.onClick(async () => {
					const lang = getLang(this.plugin);
					this.plugin.data.settings.lifeAreas.push({
						id: `area-${Date.now()}`,
						name: pick(lang, 'Nueva Área', 'New area'),
						color: '#ffffff',
					});
					await this.plugin.store.save(this.plugin.data);
					this.rerender();
				}));

		this.renderSubheading(panel, this.tr('settings_hero_classes'));
		panel.createEl('p', {
			text: this.tr('Cada clase otorga +20% de XP en un área específica.', 'Each class grants +20% XP in one specific area.'),
			cls: 'setting-item-description',
		});

		this.plugin.data.settings.heroClasses.forEach((heroClass, index) => {
			new Setting(panel)
				.setName(heroClass.name)
				.setDesc(heroClass.description)
				.addText((text) => text
					.setPlaceholder(this.tr('Nombre de clase', 'Class name'))
					.setValue(heroClass.name)
					.onChange(async (val) => {
						heroClass.name = val;
						await this.plugin.store.save(this.plugin.data);
					}))
				.addDropdown((drop) => {
					this.plugin.data.settings.lifeAreas.forEach((area) => {
						drop.addOption(area.id, area.name);
					});
					drop.setValue(heroClass.bonusAreaId).onChange(async (val) => {
						heroClass.bonusAreaId = val;
						await this.plugin.store.save(this.plugin.data);
					});
				})
				.addButton((btn) => btn
					.setIcon('trash')
					.setTooltip(this.tr('Eliminar clase', 'Delete class'))
					.onClick(async () => {
						this.plugin.data.settings.heroClasses.splice(index, 1);
						await this.plugin.store.save(this.plugin.data);
						this.rerender();
					}));

			new Setting(panel)
				.setName(this.tr('Descripción', 'Description'))
				.setDesc(this.tr('¿Qué representa esta clase?', 'What does this class represent?'))
				.addText((text) => text
					.setValue(heroClass.description)
					.onChange(async (val) => {
						heroClass.description = val;
						await this.plugin.store.save(this.plugin.data);
					}));
		});

		new Setting(panel)
			.setName(this.tr('Nueva clase', 'New class'))
			.setDesc(this.tr('Añade una nueva especialización para el héroe.', 'Add a new specialization for the hero.'))
			.addButton((btn) => btn
				.setButtonText(this.tr('+ Añadir clase', '+ Add new class'))
				.onClick(async () => {
					const lang = getLang(this.plugin);
					this.plugin.data.settings.heroClasses.push({
						id: `class-${Date.now()}`,
						name: pick(lang, 'Nueva Clase', 'New class'),
						bonusAreaId: this.plugin.data.settings.lifeAreas[0]?.id || 'health',
						description: pick(lang, 'Describe tu clase aquí', 'Describe your class here'),
					});
					await this.plugin.store.save(this.plugin.data);
					this.rerender();
				}));
	}

	private renderProgressionPanel(panel: HTMLElement): void {
		this.renderPanelHeader(panel, this.tr('settings_progression'), this.tr('Controla el avance del héroe y la velocidad del sistema.', 'Control hero progression and system pacing.'));

		this.renderSubheading(panel, this.tr('settings_experience'));
		new Setting(panel)
			.setName(this.tr('XP por nivel', 'XP per level'))
			.setDesc(this.tr('Cuánta experiencia se necesita para alcanzar el siguiente nivel (100 - 2000).', 'How much experience is needed to reach the next level (100 - 2000).'))
			.addText((text) => text
				.setValue(String(this.plugin.data.settings.xpPerLevel || 500))
				.onChange(async (val) => {
					const num = this.parseBoundedInt(val, 100, 2000, 'XP por nivel', 'XP per level');
					if (num === null) return;
					this.plugin.data.settings.xpPerLevel = num;
					await this.plugin.store.save(this.plugin.data);
				}));

		this.renderSubheading(panel, this.tr('Subquests', 'Subquests'));
		new Setting(panel)
			.setName(this.tr('Autocompletar quest padre', 'Auto-complete parent quest'))
			.setDesc(this.tr(
				'Cuando todas las subquests activas se completan hoy, completa automáticamente la quest padre y aplica su recompensa.',
				'When all active subquests are completed today, automatically complete the parent quest and apply its reward.'
			))
			.addToggle((toggle) => toggle
				.setValue(this.plugin.data.settings.autoCompleteParentQuests)
				.onChange(async (val) => {
					this.plugin.data.settings.autoCompleteParentQuests = val;
					await this.plugin.store.save(this.plugin.data);
				}));
	}

	private renderEconomyPanel(panel: HTMLElement): void {
		this.renderPanelHeader(panel, this.tr('settings_economy'), this.tr('Configura cómo se generan las monedas y el equilibrio del sistema.', 'Configure how coins are generated and the system economy is balanced.'));

		this.renderSubheading(panel, this.tr('settings_core_system'));
		new Setting(panel)
			.setName(this.tr('Activar recompensas con monedas', 'Enable coin rewards'))
			.setDesc(this.tr('Sigue ganando monedas por niveles, rachas, badges y reviews.', 'Keep earning coins from levels, streaks, badges and reviews.'))
			.addToggle((toggle) => toggle
				.setValue(this.plugin.data.settings.coinsEnabled)
				.onChange(async (val) => {
					this.plugin.data.settings.coinsEnabled = val;
					await this.plugin.store.save(this.plugin.data);
					this.rerender();
				}));

		if (!this.plugin.data.settings.coinsEnabled) {
			panel.createEl('p', {
				text: this.tr('Las monedas están desactivadas. Actívalas para editar la economía.', 'Coins are disabled. Enable them to edit the economy.'),
				cls: 'setting-item-description',
			});
			return;
		}

		new Setting(panel)
			.setName(this.tr('Preset de recompensas', 'Reward preset'))
			.setDesc(this.tr('Aplica un perfil coherente antes de ajustar los valores manualmente.', 'Apply a coherent reward profile before fine tuning values manually.'))
			.addDropdown((drop) => drop
				.addOption('conservative', this.tr('Conservador', 'Conservative'))
				.addOption('balanced', this.tr('Equilibrado', 'Balanced'))
				.addOption('intense', this.tr('Intenso', 'Intense'))
				.setValue('balanced')
				.onChange(async (val) => {
					const preset = REWARD_PRESETS[val];
					if (!preset) return;
						this.plugin.data.settings.rewardSettings = structuredClone(preset);
					await this.plugin.store.save(this.plugin.data);
					new Notice(this.tr(`Preset aplicado: ${val}`, `Reward preset applied: ${val}`));
					this.rerender();
				}));

		new Setting(panel)
			.setName(this.tr('Notificaciones de monedas', 'Coin notifications'))
			.setDesc(this.tr('Muestra una notificación cada vez que ganes monedas.', 'Show a notification whenever you earn coins.'))
			.addToggle((toggle) => toggle
				.setValue(this.plugin.data.settings.rewardSettings.notificationsEnabled)
				.onChange(async (val) => {
					this.plugin.data.settings.rewardSettings.notificationsEnabled = val;
					await this.plugin.store.save(this.plugin.data);
				}));

		new Setting(panel)
			.setName(this.tr('Multiplicador global', 'Global multiplier'))
			.setDesc(this.tr('Factor global para recompensas de monedas (0.5x - 3.0x).', 'Global factor for coin rewards (0.5x - 3.0x).'))
			.addSlider((slider) => slider
				.setLimits(0.5, 3.0, 0.1)
				.setValue(this.plugin.data.settings.rewardSettings.multiplier)
								.onChange(async (val) => {
					this.plugin.data.settings.rewardSettings.multiplier = val;
					await this.plugin.store.save(this.plugin.data);
				}));

		this.renderSubheading(panel, this.tr('settings_primary_rewards'));
		new Setting(panel)
			.setName(this.tr('Subida de nivel', 'Level up'))
			.setDesc(this.tr('Monedas base más un factor de escalado por nivel.', 'Base coins plus scaling factor by level.'))
			.addText((text) => text
				.setPlaceholder(this.tr('Base', 'Base'))
				.setValue(String(this.plugin.data.settings.rewardSettings.levelUp.base))
				.onChange(async (val) => {
					const parsed = this.parseBoundedInt(val, 0, 500, 'Base por subida de nivel', 'Level-up base');
					if (parsed === null) return;
					this.plugin.data.settings.rewardSettings.levelUp.base = parsed;
					await this.plugin.store.save(this.plugin.data);
				}))
			.addText((text) => text
				.setPlaceholder(this.tr('Factor', 'Factor'))
				.setValue(String(this.plugin.data.settings.rewardSettings.levelUp.factor))
				.onChange(async (val) => {
					const parsed = this.parseBoundedInt(val, 0, 100, 'Factor por nivel', 'Level factor');
					if (parsed === null) return;
					this.plugin.data.settings.rewardSettings.levelUp.factor = parsed;
					await this.plugin.store.save(this.plugin.data);
				}));

		new Setting(panel)
			.setName(this.tr('Badges', 'Badges'))
			.setDesc(this.tr('Monedas ganadas por badges comunes y épicos.', 'Coins earned for common and epic badges.'))
			.addText((text) => text
				.setPlaceholder(this.tr('Común', 'Common'))
				.setValue(String(this.plugin.data.settings.rewardSettings.badges.common))
				.onChange(async (val) => {
					const parsed = this.parseBoundedInt(val, 0, 200, 'Badge común', 'Common badge');
					if (parsed === null) return;
					this.plugin.data.settings.rewardSettings.badges.common = parsed;
					await this.plugin.store.save(this.plugin.data);
				}))
			.addText((text) => text
				.setPlaceholder(this.tr('Épico', 'Epic'))
				.setValue(String(this.plugin.data.settings.rewardSettings.badges.epic))
				.onChange(async (val) => {
					const parsed = this.parseBoundedInt(val, 0, 500, 'Badge épico', 'Epic badge');
					if (parsed === null) return;
					this.plugin.data.settings.rewardSettings.badges.epic = parsed;
					await this.plugin.store.save(this.plugin.data);
				}));

		new Setting(panel)
			.setName(this.tr('Hitos de racha', 'Streak milestones'))
			.setDesc(this.tr('Monedas ganadas por rachas de 7 / 30 / 100 días.', 'Coins earned for 7 / 30 / 100 day streaks.'))
			.addText((text) => text
				.setPlaceholder('7d')
				.setValue(String(this.plugin.data.settings.rewardSettings.streakMilestones.streak7))
				.onChange(async (val) => {
					const parsed = this.parseBoundedInt(val, 0, 300, 'Racha 7 días', '7-day streak');
					if (parsed === null) return;
					this.plugin.data.settings.rewardSettings.streakMilestones.streak7 = parsed;
					await this.plugin.store.save(this.plugin.data);
				}))
			.addText((text) => text
				.setPlaceholder('30d')
				.setValue(String(this.plugin.data.settings.rewardSettings.streakMilestones.streak30))
				.onChange(async (val) => {
					const parsed = this.parseBoundedInt(val, 0, 700, 'Racha 30 días', '30-day streak');
					if (parsed === null) return;
					this.plugin.data.settings.rewardSettings.streakMilestones.streak30 = parsed;
					await this.plugin.store.save(this.plugin.data);
				}))
			.addText((text) => text
				.setPlaceholder('100d')
				.setValue(String(this.plugin.data.settings.rewardSettings.streakMilestones.streak100))
				.onChange(async (val) => {
					const parsed = this.parseBoundedInt(val, 0, 1500, 'Racha 100 días', '100-day streak');
					if (parsed === null) return;
					this.plugin.data.settings.rewardSettings.streakMilestones.streak100 = parsed;
					await this.plugin.store.save(this.plugin.data);
				}));

		this.renderSubheading(panel, this.tr('settings_fixed_rewards'));
		new Setting(panel)
			.setName(this.tr('Recompensas semanales', 'Weekly rewards'))
			.setDesc(this.tr('Monedas por review semanal, semana perfecta y quests épicas.', 'Coins for weekly review, perfect week and epic quests.'))
			.addText((text) => text
				.setPlaceholder(this.tr('Review', 'Review'))
				.setValue(String(this.plugin.data.settings.rewardSettings.weeklyReview))
				.onChange(async (val) => {
					const parsed = this.parseBoundedInt(val, 0, 300, 'Review semanal', 'Weekly review');
					if (parsed === null) return;
					this.plugin.data.settings.rewardSettings.weeklyReview = parsed;
					await this.plugin.store.save(this.plugin.data);
				}))
			.addText((text) => text
				.setPlaceholder(this.tr('Perfecta', 'Perfect'))
				.setValue(String(this.plugin.data.settings.rewardSettings.perfectWeek))
				.onChange(async (val) => {
					const parsed = this.parseBoundedInt(val, 0, 500, 'Semana perfecta', 'Perfect week');
					if (parsed === null) return;
					this.plugin.data.settings.rewardSettings.perfectWeek = parsed;
					await this.plugin.store.save(this.plugin.data);
				}))
			.addText((text) => text
				.setPlaceholder(this.tr('Quest épica', 'Epic quest'))
				.setValue(String(this.plugin.data.settings.rewardSettings.epicQuest))
				.onChange(async (val) => {
					const parsed = this.parseBoundedInt(val, 0, 200, 'Quest épica', 'Epic quest');
					if (parsed === null) return;
					this.plugin.data.settings.rewardSettings.epicQuest = parsed;
					await this.plugin.store.save(this.plugin.data);
				}));

		new Setting(panel)
			.setName(this.tr('Recompensas por pesaje', 'Weigh-in rewards'))
			.setDesc(this.tr('Monedas por pesajes semanales del add-on de salud.', 'Coins for weekly weigh-ins from the health add-on.'))
			.addText((text) => text
				.setPlaceholder(this.tr('Base', 'Base'))
				.setValue(String(this.plugin.data.settings.rewardSettings.weighIn.base))
				.onChange(async (val) => {
					const parsed = this.parseBoundedInt(val, 0, 200, 'Pesaje base', 'Base weigh-in');
					if (parsed === null) return;
					this.plugin.data.settings.rewardSettings.weighIn.base = parsed;
					await this.plugin.store.save(this.plugin.data);
				}))
			.addText((text) => text
				.setPlaceholder(this.tr('4+ semanas', '4+ weeks'))
				.setValue(String(this.plugin.data.settings.rewardSettings.weighIn.streak4))
				.onChange(async (val) => {
					const parsed = this.parseBoundedInt(val, 0, 300, 'Pesaje 4+ semanas', '4+ week weigh-in');
					if (parsed === null) return;
					this.plugin.data.settings.rewardSettings.weighIn.streak4 = parsed;
					await this.plugin.store.save(this.plugin.data);
				}))
			.addText((text) => text
				.setPlaceholder(this.tr('12+ semanas', '12+ weeks'))
				.setValue(String(this.plugin.data.settings.rewardSettings.weighIn.streak12))
				.onChange(async (val) => {
					const parsed = this.parseBoundedInt(val, 0, 500, 'Pesaje 12+ semanas', '12+ week weigh-in');
					if (parsed === null) return;
					this.plugin.data.settings.rewardSettings.weighIn.streak12 = parsed;
					await this.plugin.store.save(this.plugin.data);
				}));
	}

	private renderAddonsPanel(panel: HTMLElement): void {
		this.renderPanelHeader(panel, this.tr('Add-ons', 'Add-ons'), this.tr('Activa o desactiva módulos opcionales del sistema.', 'Enable or disable optional system modules.'));

		this.renderSubheading(panel, this.tr('settings_economy_shop'));
		new Setting(panel)
			.setName(this.tr('Add-on de tienda', 'Shop add-on'))
			.setDesc(this.tr('Muestra la tienda, los canjes y su interfaz.', 'Show the Hero Shop, reward redemption and shop UI.'))
			.addToggle((toggle) => toggle
				.setValue(this.plugin.data.settings.shopEnabled)
				.onChange(async (val) => {
					this.plugin.data.settings.shopEnabled = val;
					await this.plugin.store.save(this.plugin.data);
					this.rerender();
				}))
			.addExtraButton((btn) => btn
				.setIcon(this.plugin.data.settings.shopEnabled ? 'check-circle' : 'circle')
				.setTooltip(this.plugin.data.settings.shopEnabled ? this.tr('Activo', 'Active') : this.tr('Inactivo', 'Inactive')));

		if (this.plugin.data.settings.shopEnabled) {
			new Setting(panel)
				.setName(this.tr('Mostrar saldo en dashboard', 'Show balance in dashboard'))
				.setDesc(this.tr('Muestra tu saldo de monedas en la cabecera del héroe.', 'Display your coin balance in the hero header.'))
				.addToggle((toggle) => toggle
					.setValue(this.plugin.data.settings.showCoinsInDashboard)
					.onChange(async (val) => {
						this.plugin.data.settings.showCoinsInDashboard = val;
						await this.plugin.store.save(this.plugin.data);
					}));

			new Setting(panel)
				.setName(this.tr('Restaurar recompensas por defecto', 'Restore default rewards'))
				.setDesc(this.tr('Restaura las 8 recompensas iniciales sin borrar las personalizadas.', 'Restore the initial 8 rewards without deleting your custom ones.'))
				.addButton((btn) => btn
						.setButtonText(this.tr('Restaurar', 'Restore defaults'))
						.onClick(async () => {
							const defaults = (DEFAULT_DATA.shop || []).filter((reward) => reward.isDefault);
							this.plugin.data.shop = this.plugin.data.shop || [];
							defaults.forEach((reward: ShopReward) => {
								if (!this.plugin.data.shop!.some((current) => current.id === reward.id)) {
									this.plugin.data.shop!.push(reward);
								}
						});
						await this.plugin.store.save(this.plugin.data);
						new Notice(this.tr('Recompensas por defecto restauradas.', 'Default rewards restored.'));
					}));
		}

		this.renderSubheading(panel, this.tr('settings_health'));
		new Setting(panel)
			.setName(this.tr('Add-on de salud', 'Health add-on'))
			.setDesc(this.tr('Activa seguimiento corporal, presión arterial y medicaciones.', 'Enable body tracking, blood pressure and medications.'))
			.addToggle((toggle) => toggle
				.setValue(this.plugin.data.settings.healthEnabled || false)
				.onChange(async (val) => {
					this.plugin.data.settings.healthEnabled = val;
					if (this.plugin.data.health) this.plugin.data.health.enabled = val;
					await this.plugin.store.save(this.plugin.data);
					this.rerender();
				}))
			.addExtraButton((btn) => btn
				.setIcon(this.plugin.data.settings.healthEnabled ? 'check-circle' : 'circle')
				.setTooltip(this.plugin.data.settings.healthEnabled ? this.tr('Activo', 'Active') : this.tr('Inactivo', 'Inactive')));

		if (!this.plugin.data.settings.healthEnabled) {
			panel.createEl('p', {
				text: this.tr('El add-on de salud está desactivado.', 'The health add-on is disabled.'),
				cls: 'setting-item-description',
			});
			return;
		}

		panel.createEl('p', {
			text: this.tr('Activa solo los módulos que realmente usarás. Si peso está activo, conviene completar el perfil corporal.', 'Enable only the modules you will actually use. If weight is enabled, it is best to complete your body profile.'),
			cls: 'setting-item-description',
		});

		new Setting(panel)
			.setName(this.tr('Gestión de peso e IMC', 'Weight and BMI management'))
			.setDesc(this.tr('Perfil corporal, registros de peso, progreso e IMC.', 'Body profile, weight logs, progress and BMI.'))
			.addToggle((toggle) => toggle
				.setValue(this.plugin.data.settings.healthModules.weight)
				.onChange(async (val) => {
					this.plugin.data.settings.healthModules.weight = val;
					await this.plugin.store.save(this.plugin.data);
					this.rerender();
				}))
			.addExtraButton((btn) => btn
				.setIcon(this.plugin.data.settings.healthModules.weight ? 'check-circle' : 'circle'));

		new Setting(panel)
			.setName(this.tr('Presión arterial', 'Blood pressure'))
			.setDesc(this.tr('Historial y captura de lecturas sistólica/diastólica.', 'History and capture of systolic/diastolic readings.'))
			.addToggle((toggle) => toggle
				.setValue(this.plugin.data.settings.healthModules.bloodPressure)
				.onChange(async (val) => {
					this.plugin.data.settings.healthModules.bloodPressure = val;
					await this.plugin.store.save(this.plugin.data);
					this.rerender();
				}))
			.addExtraButton((btn) => btn
				.setIcon(this.plugin.data.settings.healthModules.bloodPressure ? 'check-circle' : 'circle'));

		new Setting(panel)
			.setName(this.tr('Medicaciones', 'Medications'))
			.setDesc(this.tr('Horarios, inventario y registro de tomas.', 'Schedules, inventory and intake log.'))
			.addToggle((toggle) => toggle
				.setValue(this.plugin.data.settings.healthModules.medications)
				.onChange(async (val) => {
					this.plugin.data.settings.healthModules.medications = val;
					await this.plugin.store.save(this.plugin.data);
					this.rerender();
				}))
			.addExtraButton((btn) => btn
				.setIcon(this.plugin.data.settings.healthModules.medications ? 'check-circle' : 'circle'));

		new Setting(panel)
			.setName(this.tr('Ver historial completo', 'Open full history'))
			.setDesc(this.tr('Abre la vista del add-on de salud.', 'Open the health add-on view.'))
			.addButton((btn) => btn
				.setButtonText(this.tr('Abrir', 'Open'))
				.onClick(() => {
					void executeObsidianCommand(this.app, `${this.plugin.manifest.id}:open-health`);
				}));

		if (this.plugin.data.settings.healthModules.weight && !this.plugin.data.health?.profile) {
			new Setting(panel)
					.setName(this.tr('Perfil corporal', 'Body profile'))
					.setDesc(this.tr('Configura el perfil inicial del seguimiento de peso.', 'Configure the initial profile for weight tracking.'))
					.addButton((btn) => btn
						.setButtonText(this.tr('Configurar', 'Configure'))
						.onClick(() => {
							new HealthSetupModal(this.app, this.plugin, false).open();
						}));
		}

		if (this.plugin.data.settings.healthModules.weight && this.plugin.data.health?.profile) {
			new Setting(panel)
				.setName(this.tr('Perfil corporal', 'Body profile'))
				.setDesc(this.tr('Edita el perfil y exporta el historial del peso.', 'Edit the profile and export weight history.'))
				.addButton((btn) => btn
					.setButtonText(this.tr('Editar perfil', 'Edit profile'))
					.onClick(() => {
						new HealthSetupModal(this.app, this.plugin, true).open();
					}))
				.addButton((btn) => btn
					.setButtonText(this.tr('Exportar CSV', 'Export CSV'))
					.onClick(async () => {
						const csv = exportHealthCSV(this.plugin.data.health!.entries, this.plugin.data.health!.profile!.weightUnit);
						await this.app.vault.adapter.mkdir('_LifeQuest/health').catch(() => null);
						await this.app.vault.adapter.write('_LifeQuest/health/historial.csv', csv);
						new Notice(this.tr('Historial CSV exportado en _LifeQuest/health/historial.csv', 'CSV history exported to _LifeQuest/health/historial.csv'));
					}));

			new Setting(panel)
					.setName(this.tr('Eliminar registros de peso', 'Delete weight entries'))
						.setDesc(this.tr('Zona peligrosa: borrará todos los registros de peso.', 'Danger zone: this will delete all weight entries.'))
						.addButton((btn) => {
							this.setDestructiveButton(btn);
							return btn
								.setButtonText(this.tr('Eliminar registros', 'Delete entries'))
								.onClick(() => {
									new ConfirmModal(
										this.app,
										this.tr('Eliminar registros de peso', 'Delete weight entries'),
										this.tr('Esta acción eliminará todos los registros de peso y no se puede deshacer.', 'This will delete all weight entries and cannot be undone.'),
										async () => {
											this.plugin.data.health!.entries = [];
											await this.plugin.store.save(this.plugin.data);
											new Notice(this.tr('Registros de salud eliminados.', 'Health records deleted.'));
											this.rerender();
										},
										this.tr('Eliminar', 'Delete'),
										this.tr('Cancelar', 'Cancel')
									).open();
								});
						});
		}
	}

	private renderDataPanel(panel: HTMLElement): void {
		this.renderPanelHeader(panel, this.tr('settings_data'), this.tr('Exporta o reinicia la información guardada por LifeQuest.', 'Export or reset the data stored by LifeQuest.'));

		new Setting(panel)
			.setName(this.tr('Exportar datos', 'Export data'))
			.setDesc(this.tr('Descarga tu progreso, configuración e historial en un archivo JSON.', 'Download your progress, settings and quest history as a JSON file.'))
			.addButton((btn) => btn
				.setButtonText(this.tr('Exportar JSON', 'Export JSON'))
				.onClick(() => {
					const dataStr = JSON.stringify(this.plugin.data, null, 2);
					const blob = new Blob([dataStr], { type: 'application/json' });
					const url = URL.createObjectURL(blob);
						const anchor = this.containerEl.ownerDocument.createElement('a');
					anchor.href = url;
					anchor.download = `lifequest-data-${moment().format('YYYY-MM-DD')}.json`;
					anchor.click();
					URL.revokeObjectURL(url);
					new Notice(this.tr('Datos exportados correctamente.', 'Data exported successfully.'));
				}));

		new Setting(panel)
				.setName(this.tr('Restablecer de fábrica', 'Factory reset'))
					.setDesc(this.tr('Borra todas las quests, XP, monedas y configuración. No se puede deshacer.', 'Erase all quests, XP, coins and settings. This cannot be undone.'))
					.addButton((btn) => {
						this.setDestructiveButton(btn);
						return btn
							.setButtonText(this.tr('Restablecer', 'Factory reset'))
							.onClick(() => {
								new ConfirmModal(
									this.app,
									this.tr('Restablecer de fábrica', 'Factory reset'),
									this.tr('Esto eliminará quests, XP, monedas y configuración.', 'This will delete quests, XP, coins, and settings.'),
									async () => {
										this.plugin.data = structuredClone(DEFAULT_DATA);
										await this.plugin.store.save(this.plugin.data);
										new Notice(this.tr('LifeQuest fue restaurado a valores de fábrica.', 'LifeQuest has been reset to factory defaults.'));
										this.rerender();
										this.plugin.getDashboardView()?.scheduleRefresh();
									},
									this.tr('Restablecer', 'Reset'),
									this.tr('Cancelar', 'Cancel')
								).open();
							});
					});
	}

	private renderAboutPanel(panel: HTMLElement): void {
		this.renderPanelHeader(panel, this.tr('settings_about'), this.tr('Información del plugin y referencias del proyecto.', 'Plugin information and project references.'));

		this.renderSubheading(panel, this.tr('settings_version'));
		new Setting(panel)
			.setName(this.tr('Versión actual', 'Current version'))
			.setDesc(this.tr('LifeQuest para Obsidian', 'LifeQuest for Obsidian'))
			.addText((text) => text.setValue(this.plugin.manifest.version).setDisabled(true));

		this.renderSubheading(panel, this.tr('settings_authorship'));
		panel.createEl('p', {
			text: this.tr('Sistema LifeQuest por Snifer.', 'LifeQuest system by Snifer.'),
			cls: 'setting-item-description',
		});
		panel.createEl('p', {
			text: this.tr('Plugin enfocado en gamificar hábitos, reviews y progreso personal dentro de Obsidian.', 'Plugin focused on gamifying habits, reviews and personal progress inside Obsidian.'),
			cls: 'setting-item-description',
		});

		new Setting(panel)
			.setName(this.tr('Onboarding inicial', 'Initial onboarding'))
			.setDesc(this.tr('Vuelve a abrir la guía de primera configuración del plugin.', 'Reopen the plugin first-run setup guide.'))
			.addButton((btn) => btn
				.setButtonText(this.tr('Abrir onboarding', 'Open onboarding'))
				.onClick(() => {
					this.plugin.openOnboarding(true);
				}));
	}

	private renderPanelHeader(panel: HTMLElement, title: string, description: string): void {
		const header = panel.createDiv({ cls: 'lq-settings-panel-header' });
		new Setting(header).setName(title).setHeading();
		header.createEl('p', { text: description, cls: 'lq-settings-panel-copy' });
	}

	private renderSubheading(panel: HTMLElement, text: string): void {
		new Setting(panel).setName(text).setHeading();
	}

	private getAddonBadge(): string {
		const enabled: string[] = [];
		if (this.plugin.data.settings.shopEnabled) enabled.push('tienda');
		if (this.plugin.data.settings.healthEnabled) enabled.push('salud');
		const lang = getLang(this.plugin);
		return enabled.length > 0
			? (lang === 'es' ? `${enabled.length} activos` : `${enabled.length} active`)
			: (lang === 'es' ? 'sin activos' : 'none active');
	}

}
