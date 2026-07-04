import { ItemView, WorkspaceLeaf, Notice } from 'obsidian';
import type LifequestPlugin from '../main';
import { generateWeekStats, generateInsights, earnCoins, calculateCoinReward } from '../engine';
import { WeeklyReview, WeeklyStats } from '../types';
import { getLang, pick, t } from '../i18n';
import { moment } from '../obsidian-moment';

export const VIEW_TYPE_WEEKLY_REVIEW = 'lifequest-weekly-review';
type TranslationKey = Parameters<typeof t>[0];
type TranslationVars = Record<string, string | number>;

export class WeeklyReviewView extends ItemView {
	private plugin: LifequestPlugin;
	private weekOffset = 0;
	private mood: WeeklyReview['mood'] = 'bien';
	private wentWell = '';
	private toImprove = '';
	private intention = '';

	constructor(leaf: WorkspaceLeaf, plugin: LifequestPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	private tr(key: TranslationKey, vars?: TranslationVars): string;
	private tr(esText: string, enText: string): string;
	private tr(first: string, second: TranslationVars | string = {}): string {
		const lang = getLang(this.plugin);
		if (typeof second === 'string') return pick(lang, first, second);
		return t(first as TranslationKey, lang, second);
	}

	getViewType(): string { return VIEW_TYPE_WEEKLY_REVIEW; }
	getDisplayText(): string { return this.tr('review_title'); }
	getIcon(): string { return 'bar-chart'; }

	async onOpen(): Promise<void> {
		this.render();
	}

	private getWeekRange(): { start: string, end: string, label: string } {
		const lang = getLang(this.plugin);
		const start = moment().locale(lang).startOf('isoWeek').add(this.weekOffset, 'weeks');
		const end   = start.clone().endOf('isoWeek');
		return {
			start: start.format('YYYY-MM-DD'),
			end:   end.format('YYYY-MM-DD'),
			label: `${start.format('D MMM')} – ${end.format('D MMM YYYY')}`
		};
	}

	private render(): void {
		const root = this.contentEl;
		root.empty();
		root.addClass('lifequest-dashboard'); // Reuse main dashboard container styles
		
		const { start, label } = this.getWeekRange();
		const prevStart = moment(start).subtract(1, 'week').format('YYYY-MM-DD');

		const stats = generateWeekStats(this.plugin.data.activityLog, this.plugin.data.quests, start);
		const prevStats = generateWeekStats(this.plugin.data.activityLog, this.plugin.data.quests, prevStart);
		const lang = getLang(this.plugin);
		const tr = (esText: string, enText: string) => this.tr(esText, enText);
		const insights = generateInsights(stats, prevStats, this.plugin.data.streak, lang);

		// Header
		const header = root.createDiv({ cls: 'lq-hero' });
		header.addClass('lq-review-header');

		const titleWrap = header.createDiv();
		const h2 = titleWrap.createEl('h2', { text: this.tr('review_title') });
		h2.addClass('lq-review-title');

		const p = titleWrap.createEl('p', { text: label, cls: 'lq-week-range' });
		p.addClass('lq-review-range');

		const nav = header.createDiv({ cls: 'lq-week-nav' });
		const prevBtn = nav.createEl('button', { text: '←', cls: 'lq-icon-btn' });
		prevBtn.addEventListener('click', () => { this.weekOffset--; this.render(); });
		
		const nextBtn = nav.createEl('button', { text: '→', cls: 'lq-icon-btn' });
		if (this.weekOffset >= 0) nextBtn.disabled = true;
		nextBtn.addEventListener('click', () => { this.weekOffset++; this.render(); });

		// Stats Grid
		const statsRow = root.createDiv({ cls: 'lq-chip-row' });
		this.renderStatChip(statsRow, `+${stats.xpTotal}`, this.tr('review_xp_total'));
		this.renderStatChip(statsRow, String(stats.completed), this.tr('review_completed'));
		this.renderStatChip(statsRow, String(stats.failed), this.tr('Fallidas', 'Failed'));
		this.renderStatChip(statsRow, `${stats.successRate}%`, this.tr('review_success_rate'));

		// Insights Section
		if (insights.length > 0) {
			root.createEl('h3', { text: this.tr('review_insights'), cls: 'lq-section-title' });
			const insightGrid = root.createDiv({ cls: 'lq-insight-grid' });
			insights.forEach(ins => {
				const card = insightGrid.createDiv({ cls: 'lq-insight-card' });
				card.createDiv({ cls: 'lq-insight-title', text: ins.title });
				card.createDiv({ cls: 'lq-insight-desc', text: ins.description });
			});
		}

		// Progress by Area
		const apTitle = root.createEl('h3', { text: this.tr('review_area_progress'), cls: 'lq-section-title' });
		apTitle.addClass('lq-review-section-title');
		const areaCard = root.createDiv({ cls: 'lq-card' });
		stats.areaStats.forEach(as => {
			const prevAs = prevStats.areaStats.find(p => p.areaId === as.areaId);
			const delta = prevAs ? as.successRate - prevAs.successRate : 0;
			
				const row = areaCard.createDiv({ cls: 'lq-area-row' });
				const area = this.plugin.data.settings.lifeAreas.find(a => a.id === as.areaId);
				
				const dot = row.createDiv({ cls: 'lq-area-dot' });
				dot.setCssProps({ background: area?.color ?? '#7F77DD' });
			
			const nameWrap = row.createDiv({ cls: 'lq-area-name' });
			nameWrap.createSpan({ text: area?.name ?? as.name });
			
			if (delta !== 0) {
				nameWrap.createSpan({ 
					text: delta > 0 ? ` (+${delta}%)` : ` (${delta}%)`,
					cls: `lq-delta ${delta > 0 ? 'up' : 'down'}` 
				});
			}

				const track = row.createDiv({ cls: 'lq-area-bar-track' });
				const fill  = track.createDiv({ cls: 'lq-area-bar-fill' });
				fill.setCssProps({ width: `${as.successRate}%`, background: area?.color ?? '#7F77DD' });
			
			row.createDiv({ cls: 'lq-area-pct', text: `${as.successRate}%` });
		});

		// Quest Performance Section
		const qpTitle = root.createEl('h3', { text: this.tr('review_quest_performance'), cls: 'lq-section-title' });
		qpTitle.addClass('lq-review-section-title');
		const questCard = root.createDiv({ cls: 'lq-card' });
		if (stats.questStats.length > 0) {
			stats.questStats.forEach(qs => {
				const row = questCard.createDiv({ cls: 'lq-quest-item lq-review-quest-row' });
				const q = this.plugin.data.quests.find(quest => quest.id === qs.questId);
				const area = this.plugin.data.settings.lifeAreas.find(a => a.id === q?.area);

				const dot = row.createDiv({ cls: 'lq-quest-dot' });
				dot.setCssProps({ background: area?.color ?? '#7F77DD' });

				const infoWrap = row.createDiv({ cls: 'lq-review-quest-info' });

				infoWrap.createDiv({ text: qs.title, cls: 'lq-review-quest-name' });

				infoWrap.createDiv({ 
					cls: 'lq-review-quest-sub',
					text: tr(`${qs.completedDays}/${qs.totalDays} días · ${qs.successRate}%`, `${qs.completedDays}/${qs.totalDays} days · ${qs.successRate}%`)
				});

				const suggestion = row.createDiv({ cls: 'lq-quest-status lq-review-suggestion' });
				const sugKeys: Record<string, string> = {
					increase_difficulty: tr('Subir dificultad', 'Increase difficulty'),
					maintain: tr('Mantener', 'Maintain'),
					review_goal: tr('Revisar meta', 'Review goal'),
					adjust_or_pause: tr('Ajustar/Pausar', 'Adjust/Pause')
				};
				suggestion.textContent = sugKeys[qs.suggestion] ?? qs.suggestion;
				suggestion.addClass(`lq-sug-${qs.suggestion}`);
			});
		} else {
			questCard.createDiv({ text: tr('No se registró actividad de quests esta semana.', 'No quest activity recorded for this week.'), cls: 'lq-empty' });
		}

		// Reflection Form
		const refTitle = root.createEl('h3', { text: this.tr('review_reflection'), cls: 'lq-section-title' });
		refTitle.addClass('lq-review-section-title');
		const reflectCard = root.createDiv({ cls: 'lq-card' });
		
		reflectCard.createEl('label', { text: this.tr('¿Cómo estuvo tu ánimo esta semana?', 'How was your mood this week?'), cls: 'lq-label' });
		const moodRow = reflectCard.createDiv({ cls: 'lq-mood-row' });
		const moods: Array<[WeeklyReview['mood'], string]> = [
			['agotado', '😫'], ['regular', '😐'], ['bien', '🙂'], ['genial', '😃'], ['en llamas', '🔥']
		];
		moods.forEach(([m, emoji]) => {
			const btn = moodRow.createEl('button', { text: emoji, cls: 'lq-mood-btn' });
			if (this.mood === m) btn.classList.add('active');
			btn.addEventListener('click', () => {
				moodRow.querySelectorAll('.lq-mood-btn').forEach(b => b.classList.remove('active'));
				btn.classList.add('active');
				this.mood = m;
			});
		});

		this.renderTextArea(reflectCard, this.tr('¿Qué salió bien?', 'What went well?'), this.tr('Lista tus logros...', 'List your wins...'), this.wentWell, (v) => this.wentWell = v);
		this.renderTextArea(reflectCard, this.tr('¿Qué mejorar?', 'What to improve?'), this.tr('¿Qué vas a cambiar?', 'What will you change?'), this.toImprove, (v) => this.toImprove = v);
		this.renderTextArea(reflectCard, this.tr('Intención para la próxima semana', 'Intention for next week'), this.tr('Una frase de enfoque...', 'One sentence focus...'), this.intention, (v) => this.intention = v);

		// Action Button
		const footer = root.createDiv({ cls: 'lq-review-footer' });
		const saveBtn = footer.createEl('button', { text: this.tr('review_complete_save'), cls: 'lq-btn lq-btn-primary' });
		saveBtn.addEventListener('click', () => {
			void this.saveReview(stats, label);
		});
	}

	private renderStatChip(parent: HTMLElement, val: string, lbl: string): void {
		const chip = parent.createDiv({ cls: 'lq-chip' });
		chip.createDiv({ cls: 'lq-chip-value', text: val });
		chip.createDiv({ cls: 'lq-chip-label', text: lbl });
	}

	private renderTextArea(parent: HTMLElement, label: string, placeholder: string, value: string, onChange: (v: string) => void): void {
		const lbl = parent.createEl('label', { text: label, cls: 'lq-label' });
		lbl.addClass('lq-review-label');
		const ta = parent.createEl('textarea', { cls: 'lq-textarea', attr: { placeholder } });
		ta.value = value;
		ta.addEventListener('input', () => onChange(ta.value));
	}

	private async saveReview(stats: WeeklyStats, label: string): Promise<void> {
		const weekKey = moment().startOf('isoWeek').add(this.weekOffset, 'weeks').format('YYYY-[W]WW');
		
		const review: WeeklyReview = {
			weekKey,
			mood: this.mood,
			wentWell: this.wentWell,
			toImprove: this.toImprove,
			intention: this.intention,
			stats,
			insights: [],
			generatedAt: new Date().toISOString()
		};

		this.plugin.data.weeklyReviews[weekKey] = review;

		// 🪙 Coins for Weekly Review
		if (this.plugin.data.settings.coinsEnabled && this.plugin.data.coins) {
			this.plugin.data.coins = earnCoins(
				this.plugin.data.coins, 
				'weekly_review', 
				this.tr(`Revisión ${weekKey}`, `Review ${weekKey}`), 
				{}, 
				this.plugin.data.settings.rewardSettings
			);
			
			if (stats.successRate === 100) {
				this.plugin.data.coins = earnCoins(
					this.plugin.data.coins, 
					'perfect_week', 
					this.tr('Semana perfecta', 'Perfect week'), 
					{}, 
					this.plugin.data.settings.rewardSettings
				);
				if (this.plugin.data.settings.rewardSettings.notificationsEnabled) {
					new Notice(this.tr(`🪙 +${calculateCoinReward('perfect_week', {}, this.plugin.data.settings.rewardSettings)} monedas (Semana perfecta)`, `🪙 +${calculateCoinReward('perfect_week', {}, this.plugin.data.settings.rewardSettings)} coins (Perfect week)`), 4000);
				}
			}
			
			if (this.plugin.data.settings.rewardSettings.notificationsEnabled) {
				new Notice(this.tr(`🪙 +${calculateCoinReward('weekly_review', {}, this.plugin.data.settings.rewardSettings)} monedas`, `🪙 +${calculateCoinReward('weekly_review', {}, this.plugin.data.settings.rewardSettings)} coins`), 3000);
			}
		}

		await this.plugin.store.save(this.plugin.data);

		const folder = '_LifeQuest/reviews';
		await this.plugin.store.ensureFolder();
		if (!await this.app.vault.adapter.exists(folder)) {
			await this.app.vault.createFolder(folder);
		}

		const filePath = `${folder}/${weekKey}.md`;
		const content = this.tr(
`# Revisión semanal — ${label}

## Resumen
- **XP ganada**: ${stats.xpTotal}
- **Quests completadas**: ${stats.completed}
- **Tasa de éxito**: ${stats.successRate}%

## Reflexión
- **Estado**: ${this.mood}
- **Qué salió bien**: ${this.wentWell || '_nada_'}
- **Qué mejorar**: ${this.toImprove || '_nada_'}
- **Intención**: ${this.intention || '_nada_'}

## Rendimiento por área
${stats.areaStats.map(as => `- **${as.name}**: ${as.successRate}%`).join('\n')}

---
_Generado por LifeQuest_`,
`# Weekly Review — ${label}

## Summary
- **XP gained**: ${stats.xpTotal}
- **Quests completed**: ${stats.completed}
- **Success rate**: ${stats.successRate}%

## Reflection
- **Mood**: ${this.mood}
- **What went well**: ${this.wentWell || '_none_'}
- **What to improve**: ${this.toImprove || '_none_'}
- **Intention**: ${this.intention || '_none_'}

## Area performance
${stats.areaStats.map(as => `- **${as.name}**: ${as.successRate}%`).join('\n')}

---
_Generated by LifeQuest_`);

		if (await this.app.vault.adapter.exists(filePath)) {
			await this.app.vault.adapter.write(filePath, content);
		} else {
			await this.app.vault.create(filePath, content);
		}

		new Notice(this.tr('Review semanal completada. Nota guardada en _LifeQuest/reviews/ 📊', 'Weekly review completed. Note saved to _LifeQuest/reviews/ 📊'));
		this.plugin.getDashboardView()?.scheduleRefresh();
	}
}
