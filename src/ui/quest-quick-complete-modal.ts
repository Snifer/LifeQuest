import { FuzzySuggestModal, Notice, type FuzzyMatch } from 'obsidian';
import type LifequestPlugin from '../main';
import type { Quest } from '../types';
import { getLang, pick } from '../i18n';
import { getQuestStatusToday, setQuestStatusForToday } from '../core/quest-actions';

export class QuestQuickCompleteModal extends FuzzySuggestModal<Quest> {
	private plugin: LifequestPlugin;

	constructor(plugin: LifequestPlugin) {
		super(plugin.app);
		this.plugin = plugin;
		this.setPlaceholder(pick(getLang(plugin), 'Buscar quest para completar…', 'Search quest to complete…'));
	}

	getItems(): Quest[] {
		return this.plugin.data.quests
			.filter((quest) => quest.status === 'active' && getQuestStatusToday(quest.id, this.plugin.data.activityLog) !== 'done')
			.sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
	}

	getItemText(quest: Quest): string {
		return quest.title;
	}

	renderSuggestion(match: FuzzyMatch<Quest>, el: HTMLElement): void {
		const quest = match.item;
		const lang = getLang(this.plugin);
		el.createDiv({ cls: 'lq-command-quest-title', text: quest.title });
		el.createDiv({
			cls: 'lq-command-quest-subtitle',
			text: pick(
				lang,
				`${quest.frequency} · ${quest.xp} XP · ${this.getStatusLabel(quest)}`,
				`${quest.frequency} · ${quest.xp} XP · ${this.getStatusLabel(quest)}`
			),
		});
	}

	onChooseItem(quest: Quest): void {
		void (async () => {
			const changed = setQuestStatusForToday(this.plugin.data, quest, 'done', getLang(this.plugin));
			if (!changed) {
				new Notice(pick(getLang(this.plugin), 'Esa quest ya estaba completada hoy.', 'That quest was already completed today.'));
				return;
			}

			await this.plugin.store.save(this.plugin.data);
			this.plugin.getDashboardView()?.scheduleRefresh();
			new Notice(pick(getLang(this.plugin), 'Quest completada ✅', 'Quest completed ✅'));
		})();
	}

	private getStatusLabel(quest: Quest): string {
		const lang = getLang(this.plugin);
		const todayStatus = getQuestStatusToday(quest.id, this.plugin.data.activityLog);
		if (todayStatus === 'failed') {
			return pick(lang, 'Fallida hoy', 'Failed today');
		}
		return pick(lang, 'Pendiente', 'Pending');
	}
}
