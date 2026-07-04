import { Modal, Notice } from 'obsidian';
import type LifequestPlugin from '../main';
import { Quest } from '../types';
import { getLang, pick } from '../i18n';
import { ConfirmModal } from './confirm-modal';
import { moment } from '../obsidian-moment';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uuid(): string {
	return 'xxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
		const r = Math.random() * 16 | 0;
		return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
	});
}

type QuestDraft = Omit<Quest, 'createdAt' | 'lastModifiedAt'> & { createdAt?: string; lastModifiedAt?: string };

// ─── Main Modal ───────────────────────────────────────────────────────────────

export class QuestConfigModal extends Modal {
	private plugin: LifequestPlugin;
	private editingId: string | null = null;
	private draft: QuestDraft | null = null;
	private listEl!: HTMLElement;
	private formEl!: HTMLElement;

	constructor(plugin: LifequestPlugin, editQuestId?: string) {
		super(plugin.app);
		this.plugin  = plugin;
		this.editingId = editQuestId ?? null;
	}

	onOpen(): void {
		const { contentEl } = this;
		const lang = getLang(this.plugin);
		contentEl.addClass('lq-modal');
		contentEl.createEl('h2', { text: pick(lang, 'Configuración de quests', 'Quest configuration') });

		const layout = contentEl.createDiv({ cls: 'lq-quest-modal-layout' });
		this.listEl    = layout.createDiv({ cls: 'lq-quest-list-panel' });
		this.formEl    = layout.createDiv({ cls: 'lq-quest-form-panel' });

		this.renderList();

		if (this.editingId) {
			const q = this.plugin.data.quests.find(q => q.id === this.editingId);
			if (q) this.openForm(q);
		} else {
			this.openNewForm();
		}
	}

	onClose(): void { this.contentEl.empty(); }

	private tr(esText: string, enText: string): string {
		return pick(getLang(this.plugin), esText, enText);
	}

	private getDifficultyLabels(): Record<Quest['difficulty'], string> {
		return {
			easy: this.tr('🟢 Fácil', '🟢 Easy'),
			normal: this.tr('🟡 Normal', '🟡 Normal'),
			hard: this.tr('🔴 Difícil', '🔴 Hard'),
			epic: this.tr('⚡ Épica', '⚡ Epic'),
		};
	}

	private getFrequencyLabels(): Record<Quest['frequency'], string> {
		return {
			daily: this.tr('📅 Diaria', '📅 Daily'),
			weekly: this.tr('📆 Semanal', '📆 Weekly'),
			monthly: this.tr('🗓 Mensual', '🗓 Monthly'),
			free: this.tr('🎯 Libre', '🎯 Free'),
		};
	}

	private getReminderLabels(): Record<Quest['reminder'], string> {
		return {
			none: this.tr('Ninguno', 'None'),
			morning: this.tr('🌅 Mañana', '🌅 Morning'),
			evening: this.tr('🌙 Noche', '🌙 Evening'),
			custom: this.tr('⏰ Personalizado', '⏰ Custom'),
		};
	}

	// ── Quest List Panel ──────────────────────────────────────────────────────
	private renderList(): void {
		const el = this.listEl;
		el.empty();
		const lang = getLang(this.plugin);
		const frequencyLabels = this.getFrequencyLabels();

		el.createEl('h3', { text: pick(lang, 'Quests', 'Quests'), cls: 'lq-section-title' });

		const activeQuests = this.plugin.data.quests.filter(q => q.status !== 'retired');

		if (activeQuests.length === 0) {
			const empty = el.createDiv({ cls: 'lq-empty' });
			empty.textContent = pick(lang, 'Aún no hay quests. Crea la primera →', 'No quests yet. Create your first one →');
		}

			activeQuests.forEach(quest => {
			const row = el.createDiv({ cls: 'lq-quest-list-row' });
			const area = this.plugin.data.settings.lifeAreas.find(a => a.id === quest.area);

			const dot = row.createDiv({ cls: 'lq-quest-dot' });
			dot.setCssProps({ background: area?.color ?? '#7F77DD' });

			const info = row.createDiv({ cls: 'lq-quest-list-info' });
			const title = info.createDiv({ cls: 'lq-quest-list-title' });
			title.textContent = quest.title;
			const sub = info.createDiv({ cls: 'lq-quest-list-sub' });
			sub.textContent = `${frequencyLabels[quest.frequency]} · ${quest.xp} XP`;

			const actions = row.createDiv({ cls: 'lq-quest-list-actions' });

			// Edit
			const editBtn = actions.createEl('button', { cls: 'lq-icon-btn', attr: { title: pick(lang, 'Editar', 'Edit') } });
			editBtn.textContent = '✏';
			editBtn.addEventListener('click', () => this.openForm(quest));

			// Pause / Resume
			if (quest.status === 'active') {
				const pauseBtn = actions.createEl('button', { cls: 'lq-icon-btn', attr: { title: pick(lang, 'Pausar', 'Pause') } });
				pauseBtn.textContent = '⏸';
				pauseBtn.addEventListener('click', () => {
					void (async () => {
					quest.status    = 'paused';
					quest.pausedAt  = moment().format('YYYY-MM-DD');
					quest.lastModifiedAt = moment().format('YYYY-MM-DD');
					await this.plugin.store.save(this.plugin.data);
					this.renderList();
					})();
				});
			} else if (quest.status === 'paused') {
				const resumeBtn = actions.createEl('button', { cls: 'lq-icon-btn', attr: { title: pick(lang, 'Reanudar', 'Resume') } });
				resumeBtn.textContent = '▶';
				resumeBtn.addEventListener('click', () => {
					void (async () => {
					quest.status = 'active';
					quest.lastModifiedAt = moment().format('YYYY-MM-DD');
					await this.plugin.store.save(this.plugin.data);
					this.renderList();
					})();
				});
			}

			// Retire
			const retireBtn = actions.createEl('button', { cls: 'lq-icon-btn danger', attr: { title: pick(lang, 'Retirar', 'Retire') } });
			retireBtn.textContent = '🗑';
			retireBtn.addEventListener('click', () => {
				new ConfirmModal(
					this.app,
					pick(lang, 'Retirar quest', 'Retire quest'),
					pick(lang, `¿Retirar quest "${quest.title}"? El historial se conserva.`, `Retire quest "${quest.title}"? History is preserved.`),
					async () => {
						quest.status = 'retired';
						quest.lastModifiedAt = moment().format('YYYY-MM-DD');
						await this.plugin.store.save(this.plugin.data);
						this.renderList();
						this.formEl.empty();
					},
					pick(lang, 'Retirar', 'Retire'),
					pick(lang, 'Cancelar', 'Cancel')
				).open();
			});
		});

		// Global stats footer
		const footer = el.createDiv({ cls: 'lq-quest-list-footer' });
		const total  = activeQuests.length;
		const maxXPDay = activeQuests
			.filter(q => q.status === 'active' && q.frequency === 'daily')
			.reduce((s, q) => s + q.xp, 0);
		const riskDay  = activeQuests
			.filter(q => q.status === 'active' && q.frequency === 'daily')
			.reduce((s, q) => s + q.penalty, 0);
		footer.createEl('span', { text: pick(lang, `${total} quests`, `${total} quests`) });
		footer.createEl('span', { text: pick(lang, `↑ ${maxXPDay} XP/día`, `↑ ${maxXPDay} XP/day`) });
		footer.createEl('span', { text: pick(lang, `↓ ${riskDay} riesgo/día`, `↓ ${riskDay} risk/day`) });

		// New quest button
		const newBtn = el.createEl('button', { text: pick(lang, '+ Nueva quest', '+ New quest'), cls: 'lq-btn lq-btn-primary' });
		newBtn.addClass('lq-quest-list-new-btn');
		newBtn.addEventListener('click', () => this.openNewForm());
	}

	// ── Quest Form ────────────────────────────────────────────────────────────
	private openNewForm(): void {
		const today = moment().format('YYYY-MM-DD');
		this.editingId = null;
		this.draft = {
			id:         uuid(),
			title:      '',
			area:       this.plugin.data.settings.lifeAreas[0]?.id ?? 'health',
			frequency:  'daily',
			xp:         20,
			penalty:    10,
			difficulty: 'normal',
			reminder:   'none',
			note:       '',
			status:     'active',
			createdAt:  today,
			lastModifiedAt: today
		};
		this.renderForm();
	}

	private openForm(quest: Quest): void {
		this.editingId = quest.id;
		this.draft = { ...quest };
		this.renderForm();
	}

	private renderForm(): void {
		const el = this.formEl;
		el.empty();
		if (!this.draft) return;

		const d = this.draft;
		const isNew = !this.editingId;
		const frequencyLabels = this.getFrequencyLabels();
		const difficultyLabels = this.getDifficultyLabels();
		const reminderLabels = this.getReminderLabels();

		el.createEl('h3', { text: isNew ? this.tr('Nueva quest', 'New quest') : this.tr('Editar quest', 'Edit quest'), cls: 'lq-section-title' });

		// Title
		el.createEl('label', { text: this.tr('Título *', 'Title *'), cls: 'lq-label' });
		const titleInput = el.createEl('input', { cls: 'lq-input' });
		titleInput.placeholder = this.tr('Título de la quest', 'Quest title');
		titleInput.value = d.title;
		titleInput.maxLength = 60;
		titleInput.addEventListener('input', () => { d.title = titleInput.value; this.updatePreviewRow(previewRow); });

		// Area pills
		el.createEl('label', { text: this.tr('Área de vida', 'Life area'), cls: 'lq-label' });
		const areaRow = el.createDiv({ cls: 'lq-tone-row' });
		this.plugin.data.settings.lifeAreas.forEach(area => {
			const pill = areaRow.createEl('button', { text: area.name, cls: 'lq-tone-btn' });
			pill.setCssProps({ borderColor: area.color });
			if (d.area === area.id) { pill.classList.add('active'); pill.setCssProps({ background: `${area.color}33` }); }
			pill.addEventListener('click', () => {
				areaRow.querySelectorAll('.lq-tone-btn').forEach((button) => {
					button.classList.remove('active');
					(button as HTMLElement).setCssProps({ background: '' });
				});
				pill.classList.add('active');
				pill.setCssProps({ background: `${area.color}33` });
				d.area = area.id;
				this.updatePreviewRow(previewRow);
			});
		});

		// Frequency
		el.createEl('label', { text: this.tr('Frecuencia', 'Frequency'), cls: 'lq-label' });
		const freqRow = el.createDiv({ cls: 'lq-tone-row' });
		(Object.keys(frequencyLabels) as Quest['frequency'][]).forEach(f => {
			const btn = freqRow.createEl('button', { text: frequencyLabels[f], cls: 'lq-tone-btn' });
			if (d.frequency === f) btn.classList.add('active');
			btn.addEventListener('click', () => {
				freqRow.querySelectorAll('.lq-tone-btn').forEach(b => b.classList.remove('active'));
				btn.classList.add('active');
				d.frequency = f;
			});
		});

		// XP slider
		el.createEl('label', { text: this.tr(`Recompensa XP: ${d.xp}`, `XP Reward: ${d.xp}`), cls: 'lq-label', attr: { id: 'lq-xp-label' } });
		const xpSlider = el.createEl('input', { cls: 'lq-slider' });
		xpSlider.type = 'range'; xpSlider.min = '5'; xpSlider.max = '100'; xpSlider.step = '5';
		xpSlider.value = String(d.xp);
		xpSlider.addEventListener('input', () => {
			d.xp = Number(xpSlider.value);
			const xpLabel = el.querySelector('#lq-xp-label');
			if (xpLabel instanceof HTMLElement) xpLabel.textContent = this.tr(`Recompensa XP: ${d.xp}`, `XP Reward: ${d.xp}`);
			this.updatePreviewRow(previewRow);
		});

		// Penalty slider
		el.createEl('label', { text: this.tr(`Penalización: ${d.penalty}`, `Penalty: ${d.penalty}`), cls: 'lq-label', attr: { id: 'lq-pen-label' } });
		const penSlider = el.createEl('input', { cls: 'lq-slider' });
		penSlider.type = 'range'; penSlider.min = '0'; penSlider.max = '50'; penSlider.step = '5';
		penSlider.value = String(d.penalty);
		penSlider.addEventListener('input', () => {
			d.penalty = Number(penSlider.value);
			const penaltyLabel = el.querySelector('#lq-pen-label');
			if (penaltyLabel instanceof HTMLElement) penaltyLabel.textContent = this.tr(`Penalización: ${d.penalty}`, `Penalty: ${d.penalty}`);
		});

		// Difficulty
		el.createEl('label', { text: this.tr('Dificultad', 'Difficulty'), cls: 'lq-label' });
		const diffRow = el.createDiv({ cls: 'lq-tone-row' });
		(Object.keys(difficultyLabels) as Quest['difficulty'][]).forEach(diff => {
			const btn = diffRow.createEl('button', { text: difficultyLabels[diff], cls: 'lq-tone-btn' });
			if (d.difficulty === diff) btn.classList.add('active');
			btn.addEventListener('click', () => {
				diffRow.querySelectorAll('.lq-tone-btn').forEach(b => b.classList.remove('active'));
				btn.classList.add('active');
				d.difficulty = diff;
			});
		});

		// Reminder
		el.createEl('label', { text: this.tr('Recordatorio', 'Reminder'), cls: 'lq-label' });
		const remSelect = el.createEl('select', { cls: 'lq-input' });
		(Object.keys(reminderLabels) as Quest['reminder'][]).forEach(r => {
			const opt = remSelect.createEl('option', { text: reminderLabels[r], value: r });
			if (d.reminder === r) opt.selected = true;
		});
		remSelect.addEventListener('change', () => { d.reminder = remSelect.value as Quest['reminder']; });

		// Note
		el.createEl('label', { text: this.tr('Nota (opcional)', 'Note (optional)'), cls: 'lq-label' });
		const noteInput = el.createEl('input', { cls: 'lq-input' });
		noteInput.placeholder = this.tr('Nota corta (máx. 80 caracteres)', 'Short note (max 80 chars)');
		noteInput.maxLength = 80;
		noteInput.value = d.note ?? '';
		noteInput.addEventListener('input', () => { d.note = noteInput.value; });

		// Live preview row
		const previewRow = el.createDiv({ cls: 'lq-quest-preview-row lq-card' });
		this.updatePreviewRow(previewRow);

		// Footer
		const footer = el.createDiv({ cls: 'lq-modal-footer' });
		const cancelBtn = footer.createEl('button', { text: this.tr('Cancelar', 'Cancel'), cls: 'lq-btn lq-btn-ghost' });
		cancelBtn.addEventListener('click', () => { this.formEl.empty(); });

		const saveBtn = footer.createEl('button', { text: isNew ? this.tr('Crear quest', 'Create quest') : this.tr('Guardar quest', 'Save quest'), cls: 'lq-btn lq-btn-primary' });
		saveBtn.addEventListener('click', () => {
			void (async () => {
			if (!d.title.trim()) { new Notice(this.tr('El título de la quest es obligatorio', 'Quest title is required')); return; }
			if (d.xp < 5 || d.xp > 100) { new Notice(this.tr('Los puntos de recompensa deben estar entre 5 y 100', 'Reward points must be between 5 and 100')); return; }

			const now = moment().format('YYYY-MM-DD');
			if (isNew) {
				const newQuest: Quest = {
					...d,
					createdAt: now,
					lastModifiedAt: now
				};
				this.plugin.data.quests.push(newQuest);
			} else {
				const idx = this.plugin.data.quests.findIndex(q => q.id === d.id);
				if (idx !== -1) {
					this.plugin.data.quests[idx] = {
						...d,
						createdAt: d.createdAt ?? now,
						lastModifiedAt: now,
					};
				}
			}

			await this.plugin.store.save(this.plugin.data);
			this.plugin.getDashboardView()?.scheduleRefresh();
			new Notice(isNew ? this.tr('Quest creada ✅', 'Quest created ✅') : this.tr('Quest actualizada ✅', 'Quest updated ✅'));
			this.renderList();
			this.formEl.empty();
			})();
		});
	}

	private updatePreviewRow(el: HTMLElement): void {
		if (!this.draft) return;
		el.empty();
		const d = this.draft;
		const area = this.plugin.data.settings.lifeAreas.find(a => a.id === d.area);

		el.addClass('lq-quest-preview-layout');
		const dot = el.createDiv({ cls: 'lq-quest-dot' });
		dot.setCssProps({ background: area?.color ?? '#7F77DD' });
		const title = el.createDiv({ cls: 'lq-quest-title' });
		title.textContent = d.title || this.tr('Título de la quest…', 'Quest title…');
		const xpBadge = el.createDiv({ cls: 'lq-badge-pill accent' });
		xpBadge.textContent = `+${d.xp} XP`;
		const penBadge = el.createDiv({ cls: 'lq-badge-pill lq-quest-preview-penalty' });
		penBadge.textContent = `-${d.penalty}`;
		const diffBadge = el.createDiv({ cls: 'lq-badge-pill' });
		diffBadge.textContent = this.getDifficultyLabels()[d.difficulty];
	}
}
