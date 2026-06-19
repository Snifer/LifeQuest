import { Modal, Notice, moment } from 'obsidian';
import type LifequestPlugin from '../main';
import type { Profile } from '../types';
import { getStreakMultiplier, getXPToNextLevel, getLevelTitle } from '../engine';
import { getLang, pick } from '../i18n';

const ACCENT_COLORS = ['#7F77DD', '#E05A47', '#4ade80', '#fbbf24', '#60a5fa'];


export class ProfileEditorModal extends Modal {
	private plugin: LifequestPlugin;
	private draft: Profile;
	private previewEl!: HTMLElement;

	constructor(plugin: LifequestPlugin) {
		super(plugin.app);
		this.plugin = plugin;
		// Work on a deep clone so cancel truly discards
		this.draft = structuredClone(plugin.data.profile);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.addClass('lq-modal');

		contentEl.createEl('h2', { text: this.tr('Editar perfil', 'Edit profile') });

		const layout = contentEl.createDiv({ cls: 'lq-modal-layout' });
		const form   = layout.createDiv({ cls: 'lq-modal-form' });
		const preview = layout.createDiv({ cls: 'lq-modal-preview' });
		this.previewEl = preview;

		this.buildAvatarSection(form);
		this.buildNameSection(form);
		this.buildAccentSection(form);
		this.buildClassSection(form);
		this.buildToneSection(form);
		this.buildNotificationsSection(form);
		this.buildFooter(contentEl);
		this.updatePreview();
	}

	onClose(): void { this.contentEl.empty(); }

	private tr(esText: string, enText: string): string {
		return pick(getLang(this.plugin), esText, enText);
	}

	// ── Avatar ────────────────────────────────────────────────────────────────
	private buildAvatarSection(el: HTMLElement): void {
		const sec = this.section(el, this.tr('Avatar', 'Avatar'));
		const row = sec.createDiv({ cls: 'lq-form-row' });

		// Current avatar
		const preview = row.createDiv({ cls: 'lq-avatar-preview' });
		this.renderAvatarPreview(preview);

		const btns = row.createDiv({ cls: 'lq-form-col' });

		// Upload button
		const fileInput = btns.createEl('input');
		fileInput.type = 'file';
		fileInput.accept = 'image/*';
		fileInput.setCssProps({ display: 'none' });
		fileInput.addEventListener('change', () => {
			const file = fileInput.files?.[0];
			if (!file) return;
			if (file.size > 2 * 1024 * 1024) {
				new Notice(this.tr('La imagen debe pesar menos de 2 MB', 'Image must be under 2 MB'));
				return;
			}
			const reader = new FileReader();
			reader.addEventListener('load', () => {
				this.draft.avatarBase64 = typeof reader.result === 'string' ? reader.result : null;
				this.renderAvatarPreview(preview);
				this.updatePreview();
			});
			reader.readAsDataURL(file);
		});

		const uploadBtn = btns.createEl('button', { text: this.tr('📷 Subir foto', '📷 Upload photo'), cls: 'lq-btn lq-btn-secondary' });
		uploadBtn.addEventListener('click', () => fileInput.click());

		const removeBtn = btns.createEl('button', { text: this.tr('Quitar foto', 'Remove photo'), cls: 'lq-btn lq-btn-ghost' });
		removeBtn.addEventListener('click', () => {
			this.draft.avatarBase64 = null;
			this.renderAvatarPreview(preview);
			this.updatePreview();
		});
	}

	private renderAvatarPreview(el: HTMLElement): void {
		el.empty();
		if (this.draft.avatarBase64) {
			const img = el.createEl('img', { cls: 'lq-avatar lq-profile-avatar-preview-image' });
			img.src = this.draft.avatarBase64;
			img.setCssProps({ border: `3px solid ${this.draft.accentColor}` });
		} else {
			const ini = el.createDiv({ cls: 'lq-avatar-initials lq-profile-avatar-preview-initials' });
			ini.setCssProps({ background: this.draft.accentColor });
			ini.textContent = (this.draft.heroName || 'H').slice(0, 2).toUpperCase();
		}
	}

	// ── Name & Motto ──────────────────────────────────────────────────────────
	private buildNameSection(el: HTMLElement): void {
		const sec = this.section(el, this.tr('Identidad', 'Identity'));

		sec.createEl('label', { text: this.tr('Nombre del héroe', 'Hero name'), cls: 'lq-label' });
		const nameInput = sec.createEl('input', { cls: 'lq-input' });
		nameInput.type = 'text';
		nameInput.value = this.draft.heroName;
		nameInput.maxLength = 32;
		nameInput.placeholder = this.tr('Tu nombre de héroe', 'Your hero name');
		nameInput.addEventListener('input', () => {
			this.draft.heroName = nameInput.value;
			this.updatePreview();
		});

		sec.createEl('label', { text: this.tr('Lema', 'Motto'), cls: 'lq-label' });
		const mottoInput = sec.createEl('input', { cls: 'lq-input' });
		mottoInput.type = 'text';
		mottoInput.value = this.draft.motto;
		mottoInput.maxLength = 60;
		mottoInput.placeholder = this.tr('Tu lema personal', 'Your personal motto');
		mottoInput.addEventListener('input', () => {
			this.draft.motto = mottoInput.value;
			this.updatePreview();
		});
	}

	// ── Accent Color ──────────────────────────────────────────────────────────
	private buildAccentSection(el: HTMLElement): void {
		const sec = this.section(el, this.tr('Color de acento', 'Accent color'));
		const row = sec.createDiv({ cls: 'lq-color-row' });

		ACCENT_COLORS.forEach(color => {
			const pill = row.createDiv({ cls: 'lq-color-pill' });
			pill.setCssProps({ background: color });
			if (this.draft.accentColor === color) pill.classList.add('active');
			pill.addEventListener('click', () => {
				row.querySelectorAll('.lq-color-pill').forEach(p => p.classList.remove('active'));
				pill.classList.add('active');
				this.draft.accentColor = color;
				this.updatePreview();
			});
		});
	}

	// ── Class ─────────────────────────────────────────────────────────────────
	private buildClassSection(el: HTMLElement): void {
		const sec = this.section(el, this.tr('Clase', 'Class'));

		const changed  = this.plugin.data.profile.classChangedAt;
		const daysSince = changed
			? moment().diff(moment(changed), 'days')
			: 9999;
		const locked = daysSince < 30;
		const daysLeft = 30 - daysSince;

		this.plugin.data.settings.heroClasses.forEach(hClass => {
			const card  = sec.createDiv({ cls: 'lq-class-card' });
			const isActive = this.draft.classId === hClass.id;
			const isDisabled = locked && this.plugin.data.profile.classId !== hClass.id;

			if (isActive) card.classList.add('active');
			if (isDisabled) {
				card.classList.add('disabled');
				card.title = this.tr(`Cambio de clase bloqueado por ${daysLeft} día${daysLeft !== 1 ? 's' : ''} más`, `Class change locked for ${daysLeft} more day${daysLeft !== 1 ? 's' : ''}`);
			}

			const icon = card.createDiv({ cls: 'lq-class-icon' });
			icon.textContent = '🛡'; // Fallback icon or you could add icons to HeroClass too
			const name = card.createDiv({ cls: 'lq-class-name' });
			name.textContent = hClass.name;
			const area = card.createDiv({ cls: 'lq-class-area' });
			const targetArea = this.plugin.data.settings.lifeAreas.find(a => a.id === hClass.bonusAreaId);
			area.textContent = this.tr(`+20% XP en ${targetArea?.name || 'Área'}`, `+20% XP in ${targetArea?.name || 'Area'}`);

			if (!isDisabled) {
				card.addEventListener('click', () => {
					sec.querySelectorAll('.lq-class-card').forEach(c => c.classList.remove('active'));
					card.classList.add('active');
					this.draft.classId = hClass.id;
					this.updatePreview();
				});
			}
		});
	}

	// ── Tone ──────────────────────────────────────────────────────────────────
	private buildToneSection(el: HTMLElement): void {
		const sec = this.section(el, this.tr('Tono de mensajes', 'Message tone'));
		const tones: Array<[string, string]> = [
			['motivating', this.tr('🔥 Motivador', '🔥 Motivating')],
			['neutral',    this.tr('😐 Neutral', '😐 Neutral')],
			['stoic',      this.tr('🗿 Estoico', '🗿 Stoic')],
			['humorous',   this.tr('😄 Humorístico', '😄 Humorous')],
		];
		const row = sec.createDiv({ cls: 'lq-tone-row' });
		tones.forEach(([val, label]) => {
			const btn = row.createEl('button', { text: label, cls: 'lq-tone-btn' });
			if (this.plugin.data.settings.messagesTone === val) btn.classList.add('active');
			btn.addEventListener('click', () => {
				row.querySelectorAll('.lq-tone-btn').forEach(b => b.classList.remove('active'));
				btn.classList.add('active');
				this.plugin.data.settings.messagesTone = val as typeof this.plugin.data.settings.messagesTone;
			});
		});
	}

	// ── Notifications ─────────────────────────────────────────────────────────
	private buildNotificationsSection(el: HTMLElement): void {
		const sec = this.section(el, this.tr('Notificaciones', 'Notifications'));

		const makeToggle = (label: string, current: boolean, onChange: (v: boolean) => void) => {
			const rowEl = sec.createDiv({ cls: 'lq-toggle-row' });
			const lbl   = rowEl.createEl('span');
			lbl.textContent = label;
			const toggle = rowEl.createEl('input');
			toggle.type = 'checkbox';
			toggle.checked = current;
			toggle.classList.add('lq-toggle');
			toggle.addEventListener('change', () => onChange(toggle.checked));
		};

		makeToggle(this.tr('Recordatorio vespertino', 'Evening reminder'), this.plugin.data.settings.eveningReminder,
			v => { this.plugin.data.settings.eveningReminder = v; });
		makeToggle(this.tr('Alerta de racha', 'Streak alert'), this.plugin.data.settings.streakAlert,
			v => { this.plugin.data.settings.streakAlert = v; });
	}

	// ── Live Preview ──────────────────────────────────────────────────────────
	private updatePreview(): void {
		const el = this.previewEl;
		el.empty();

		el.createEl('p', { text: this.tr('Vista previa', 'Preview'), cls: 'lq-label' });

		const card = el.createDiv({ cls: 'lq-card lq-hero' });
		card.style.setProperty('--lq-user-accent', this.draft.accentColor);
		card.addClass('lq-profile-preview-card');

		// Avatar
		if (this.draft.avatarBase64) {
			const img = card.createEl('img', { cls: 'lq-profile-preview-avatar' });
			img.src = this.draft.avatarBase64;
			img.setCssProps({ border: `3px solid ${this.draft.accentColor}` });
		} else {
			const ini = card.createDiv({ cls: 'lq-profile-preview-initials' });
			ini.setCssProps({ background: this.draft.accentColor });
			ini.textContent = (this.draft.heroName || 'H').slice(0, 2).toUpperCase();
		}

		const info = card.createDiv();
		const name = info.createEl('div');
		name.addClass('lq-profile-preview-name');
		name.textContent = this.draft.heroName || this.tr('Héroe', 'Hero');

		const meta = info.createDiv();
		meta.addClass('lq-profile-preview-meta');
		const { xp }  = this.plugin.data;
		const mult     = getStreakMultiplier(this.plugin.data.streak.current);
		const title    = getLevelTitle(xp.level, this.plugin.data.settings.language);
		meta.textContent = this.tr(`Nivel ${xp.level} · ${title} · ×${mult.toFixed(1)}`, `Lvl ${xp.level} · ${title} · ×${mult.toFixed(1)}`);

		if (this.draft.motto) {
			const motto = info.createEl('div');
			motto.addClass('lq-profile-preview-motto');
			motto.textContent = `"${this.draft.motto}"`;
		}

		// XP bar mini
		const needed   = getXPToNextLevel(xp.total);
		const pct      = Math.round(((500 - needed) / 500) * 100);
		const track    = el.createDiv({ cls: 'lq-profile-preview-track' });
		const fill = track.createDiv();
		fill.addClass('lq-profile-preview-fill');
		fill.setCssProps({ width: `${pct}%`, background: `linear-gradient(90deg,${this.draft.accentColor},#a78bfa)` });

		const xpLbl = el.createDiv();
		xpLbl.addClass('lq-profile-preview-xp');
		xpLbl.textContent = this.tr(`${500 - needed} / 500 XP para nivel ${xp.level + 1}`, `${500 - needed} / 500 XP to Lvl ${xp.level + 1}`);
	}

	// ── Footer ────────────────────────────────────────────────────────────────
	private buildFooter(el: HTMLElement): void {
		const footer = el.createDiv({ cls: 'lq-modal-footer' });

		const cancel = footer.createEl('button', { text: this.tr('Cancelar', 'Cancel'), cls: 'lq-btn lq-btn-ghost' });
		cancel.addEventListener('click', () => this.close());

		const save = footer.createEl('button', { text: this.tr('Guardar cambios', 'Save changes'), cls: 'lq-btn lq-btn-primary' });
		save.addEventListener('click', () => {
			void (async () => {
				if (!this.draft.heroName.trim()) {
					new Notice(this.tr('El nombre del héroe no puede estar vacío', 'Hero name cannot be empty'));
					return;
				}
				const prevClassId  = this.plugin.data.profile.classId;
				const classChanged = this.draft.classId !== prevClassId;

				this.plugin.data.profile = {
					...this.draft,
					classChangedAt: classChanged ? moment().format('YYYY-MM-DD') : this.plugin.data.profile.classChangedAt
				};

				await this.plugin.store.save(this.plugin.data);
				this.plugin.getDashboardView()?.scheduleRefresh();
				new Notice(this.tr('Perfil guardado ✅', 'Profile saved ✅'));
				this.close();
			})();
		});
	}

	// ── Helpers ───────────────────────────────────────────────────────────────
	private section(parent: HTMLElement, title: string): HTMLElement {
		const sec = parent.createDiv({ cls: 'lq-form-section' });
		const h   = sec.createEl('h3', { cls: 'lq-section-title' });
		h.textContent = title;
		return sec;
	}
}
