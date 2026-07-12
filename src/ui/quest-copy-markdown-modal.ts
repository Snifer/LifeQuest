import { FuzzySuggestModal, Notice, type FuzzyMatch } from 'obsidian';
import type LifequestPlugin from '../main';
import type { Quest } from '../types';
import { getLang, pick } from '../i18n';
import { buildQuestMarkdownCheckbox, copyTextToClipboard } from '../core/quest-markdown';

export class QuestCopyMarkdownModal extends FuzzySuggestModal<Quest> {
	private plugin: LifequestPlugin;

	constructor(plugin: LifequestPlugin) {
		super(plugin.app);
		this.plugin = plugin;
		this.setPlaceholder(pick(getLang(plugin), 'Buscar quest para copiar en Markdown…', 'Search quest to copy as Markdown…'));
	}

	getItems(): Quest[] {
		return [...this.plugin.data.quests].sort((a, b) =>
			a.status.localeCompare(b.status) ||
			a.sortOrder - b.sortOrder ||
			a.title.localeCompare(b.title)
		);
	}

	getItemText(quest: Quest): string {
		return quest.title;
	}

	renderSuggestion(match: FuzzyMatch<Quest>, el: HTMLElement): void {
		const quest = match.item;
		const lang = getLang(this.plugin);
		const title = el.createDiv({ cls: 'lq-command-quest-title', text: quest.title });
		title.toggleClass('is-retired', quest.status === 'retired');

		el.createDiv({
			cls: 'lq-command-quest-subtitle',
			text: pick(
				lang,
				`${this.getStatusLabel(quest)} · ${quest.frequency} · ${buildQuestMarkdownCheckbox(quest.title, quest.id)}`,
				`${this.getStatusLabel(quest)} · ${quest.frequency} · ${buildQuestMarkdownCheckbox(quest.title, quest.id)}`
			),
		});
	}

	onChooseItem(quest: Quest): void {
		void (async () => {
			const copied = await copyTextToClipboard(buildQuestMarkdownCheckbox(quest.title, quest.id));
			new Notice(
				copied
					? pick(getLang(this.plugin), 'Checkbox Markdown copiado ✅', 'Markdown checkbox copied ✅')
					: pick(getLang(this.plugin), 'No se pudo copiar el checkbox.', 'Could not copy the checkbox.')
			);
		})();
	}

	private getStatusLabel(quest: Quest): string {
		const lang = getLang(this.plugin);
		switch (quest.status) {
			case 'paused':
				return pick(lang, 'Pausada', 'Paused');
			case 'retired':
				return pick(lang, 'Retirada', 'Retired');
			default:
				return pick(lang, 'Activa', 'Active');
		}
	}
}
