import { Modal, Notice } from 'obsidian';
import type LifequestPlugin from '../main';
import {
	localizeDefaultHeroClasses,
	localizeDefaultLifeAreas,
	localizeDefaultShopRewards,
	localizeHeroNameIfDefault,
	type HeroClass,
	type LifeArea,
	type PluginSettings,
} from '../types';
import { pick } from '../i18n';

const ACCENT_COLORS = ['#7F77DD', '#E05A47', '#4ade80', '#fbbf24', '#60a5fa'];

type OnboardingDraft = {
	language: PluginSettings['language'];
	heroName: string;
	motto: string;
	selectedAreaIds: string[];
	classId: string;
	accentColor: string;
	dailyNoteFormat: string;
	xpPerLevel: number;
	shopEnabled: boolean;
	showCoinsInDashboard: boolean;
	healthEnabled: boolean;
};

export class OnboardingModal extends Modal {
	private readonly plugin: LifequestPlugin;
	private readonly forceOpen: boolean;
	private step = 0;
	private readonly draft: OnboardingDraft;

	constructor(plugin: LifequestPlugin, forceOpen = false) {
		super(plugin.app);
		this.plugin = plugin;
		this.forceOpen = forceOpen;
			this.draft = {
				language: plugin.data.settings.language,
				heroName: plugin.data.profile.heroName,
				motto: plugin.data.profile.motto,
				selectedAreaIds: plugin.data.settings.lifeAreas.map((lifeArea) => lifeArea.id),
				classId: plugin.data.profile.classId,
			accentColor: plugin.data.profile.accentColor,
			dailyNoteFormat: plugin.data.settings.dailyNoteFormat,
			xpPerLevel: plugin.data.settings.xpPerLevel,
			shopEnabled: plugin.data.settings.shopEnabled,
			showCoinsInDashboard: plugin.data.settings.showCoinsInDashboard,
			healthEnabled: plugin.data.settings.healthEnabled,
		};
	}

	onOpen(): void {
		this.modalEl.addClass('lq-onboarding-modal-host');
		this.render();
	}

	onClose(): void {
		this.modalEl.removeClass('lq-onboarding-modal-host');
		this.contentEl.empty();
	}

	private tr(esText: string, enText: string): string {
		return pick(this.draft.language, esText, enText);
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('lq-modal', 'lq-onboarding-modal');

		contentEl.createEl('h2', { text: this.tr('Bienvenido a LifeQuest', 'Welcome to LifeQuest') });
		contentEl.createEl('p', {
			cls: 'lq-onboarding-lead',
			text: this.tr(
				'Configura lo esencial para empezar rápido. Podrás cambiar todo más adelante desde los ajustes.',
				'Set up the essentials to get started quickly. You can change everything later from settings.'
			),
		});

		this.renderProgress(contentEl);

		const body = contentEl.createDiv({ cls: 'lq-onboarding-body' });
		switch (this.step) {
			case 0:
				this.renderWelcomeStep(body);
				break;
			case 1:
				this.renderHeroStep(body);
				break;
			case 2:
				this.renderSystemStep(body);
				break;
			case 3:
				this.renderSummaryStep(body);
				break;
		}

		this.renderFooter(contentEl);
	}

	private renderProgress(container: HTMLElement): void {
		const wrap = container.createDiv({ cls: 'lq-onboarding-progress' });
		const labels = [
			this.tr('Inicio', 'Start'),
			this.tr('Héroe', 'Hero'),
			this.tr('Sistema', 'System'),
			this.tr('Finalizar', 'Finish'),
		];
		labels.forEach((label, index) => {
			const pill = wrap.createDiv({ cls: 'lq-onboarding-step' });
			if (index === this.step) pill.addClass('is-active');
			if (index < this.step) pill.addClass('is-complete');
			pill.createSpan({ cls: 'lq-onboarding-step-index', text: String(index + 1) });
			pill.createSpan({ cls: 'lq-onboarding-step-label', text: label });
		});
	}

	private renderWelcomeStep(container: HTMLElement): void {
		const grid = container.createDiv({ cls: 'lq-onboarding-grid' });
		const card = grid.createDiv({ cls: 'lq-card lq-onboarding-card' });
		card.createEl('h3', { text: this.tr('Qué hace LifeQuest', 'What LifeQuest does') });
		card.createEl('p', {
			text: this.tr(
				'Convierte tu progreso diario en un sistema RPG local con quests, XP, rachas, reviews y add-ons opcionales.',
				'Turn your daily progress into a local RPG-style system with quests, XP, streaks, reviews, and optional add-ons.'
			),
		});
		const list = card.createEl('ul', { cls: 'lq-onboarding-list' });
		[
			this.tr('Todo se guarda localmente dentro del vault.', 'Everything is stored locally inside your vault.'),
			this.tr('La nota diaria puede sincronizar quests completadas.', 'Your daily note can sync completed quests.'),
			this.tr('La tienda y salud son módulos opcionales.', 'Shop and health are optional modules.'),
		].forEach((item) => list.createEl('li', { text: item }));

		const langCard = grid.createDiv({ cls: 'lq-card lq-onboarding-card' });
		langCard.createEl('h3', { text: this.tr('Idioma inicial', 'Starting language') });
		langCard.createEl('p', {
			text: this.tr(
				'Elige el idioma base para la interfaz y los mensajes del sistema.',
				'Choose the base language for the interface and system messages.'
			),
		});
		const langRow = langCard.createDiv({ cls: 'lq-tone-row' });
		[
			{ id: 'en', label: 'English' },
			{ id: 'es', label: 'Español' },
		].forEach((option) => {
			const btn = langRow.createEl('button', { text: option.label, cls: 'lq-tone-btn' });
			if (this.draft.language === option.id) btn.addClass('active');
			btn.addEventListener('click', () => {
				this.draft.language = option.id as PluginSettings['language'];
				this.render();
			});
		});
	}

	private renderHeroStep(container: HTMLElement): void {
		const section = container.createDiv({ cls: 'lq-form-section' });

		section.createEl('label', { text: this.tr('Nombre del héroe', 'Hero name'), cls: 'lq-label' });
		const nameInput = section.createEl('input', { cls: 'lq-input' });
		nameInput.type = 'text';
		nameInput.maxLength = 32;
		nameInput.value = this.draft.heroName;
		nameInput.placeholder = this.tr('Tu nombre de héroe', 'Your hero name');
		nameInput.addEventListener('input', () => {
			this.draft.heroName = nameInput.value;
		});

		section.createEl('label', { text: this.tr('Lema', 'Motto'), cls: 'lq-label' });
		const mottoInput = section.createEl('input', { cls: 'lq-input' });
		mottoInput.type = 'text';
		mottoInput.maxLength = 60;
		mottoInput.value = this.draft.motto;
		mottoInput.placeholder = this.tr('Tu lema personal', 'Your personal motto');
		mottoInput.addEventListener('input', () => {
			this.draft.motto = mottoInput.value;
		});

		const areasSection = container.createDiv({ cls: 'lq-form-section' });
		areasSection.createEl('p', { text: this.tr('Áreas base', 'Base life areas'), cls: 'lq-section-title' });
		areasSection.createEl('p', {
			text: this.tr(
				'Elige las áreas principales con las que quieres comenzar.',
				'Choose the main life areas you want to start with.'
			),
			cls: 'lq-settings-subtitle',
		});
		const areaGrid = areasSection.createDiv({ cls: 'lq-onboarding-area-grid' });
		this.plugin.data.settings.lifeAreas.forEach((lifeArea) => {
			const pill = areaGrid.createEl('button', {
				text: lifeArea.name,
				cls: 'lq-onboarding-area-pill',
			});
			pill.type = 'button';
			pill.setCssProps({ '--lq-area-accent': lifeArea.color });
			if (this.draft.selectedAreaIds.includes(lifeArea.id)) pill.addClass('is-active');
			pill.addEventListener('click', () => {
				this.toggleArea(lifeArea);
			});
		});

		const classSection = container.createDiv({ cls: 'lq-form-section' });
		classSection.createEl('p', { text: this.tr('Clase inicial', 'Starting class'), cls: 'lq-section-title' });
		const availableClasses = this.availableHeroClasses();
		if (availableClasses.length === 0) {
			classSection.createEl('p', {
				text: this.tr(
					'Selecciona al menos un área compatible con una clase para continuar.',
					'Select at least one area that matches a hero class to continue.'
				),
				cls: 'lq-settings-subtitle',
			});
		}
		availableClasses.forEach((heroClass) => {
			const card = classSection.createDiv({ cls: 'lq-class-card' });
			if (this.draft.classId === heroClass.id) card.addClass('active');
			card.createDiv({ cls: 'lq-class-icon', text: '🛡' });
			const meta = card.createDiv();
			meta.createDiv({ cls: 'lq-class-name', text: heroClass.name });
			meta.createDiv({
				cls: 'lq-class-area',
				text: this.describeHeroClass(heroClass),
			});
			card.addEventListener('click', () => {
				this.draft.classId = heroClass.id;
				this.render();
			});
		});

		const accent = container.createDiv({ cls: 'lq-form-section' });
		accent.createEl('p', { text: this.tr('Color de acento', 'Accent color'), cls: 'lq-section-title' });
		const colorRow = accent.createDiv({ cls: 'lq-color-row' });
		ACCENT_COLORS.forEach((color) => {
			const pill = colorRow.createDiv({ cls: 'lq-color-pill' });
			pill.setCssProps({ background: color });
			if (this.draft.accentColor === color) pill.addClass('active');
			pill.addEventListener('click', () => {
				this.draft.accentColor = color;
				this.render();
			});
		});
	}

	private renderSystemStep(container: HTMLElement): void {
		const section = container.createDiv({ cls: 'lq-form-section' });
		section.createEl('label', { text: this.tr('Formato de daily note', 'Daily note format'), cls: 'lq-label' });
		const dateInput = section.createEl('input', { cls: 'lq-input' });
		dateInput.type = 'text';
		dateInput.value = this.draft.dailyNoteFormat;
			dateInput.placeholder = this.tr('Formato YYYY-MM-DD', 'Format: YYYY-MM-DD');
		dateInput.addEventListener('input', () => {
			this.draft.dailyNoteFormat = dateInput.value.trim();
		});

		section.createEl('label', { text: this.tr('XP por nivel', 'XP per level'), cls: 'lq-label' });
		const xpInput = section.createEl('input', { cls: 'lq-input' });
		xpInput.type = 'number';
		xpInput.min = '100';
		xpInput.max = '2000';
		xpInput.step = '50';
		xpInput.value = String(this.draft.xpPerLevel);
		xpInput.addEventListener('input', () => {
			this.draft.xpPerLevel = Number.parseInt(xpInput.value, 10) || this.draft.xpPerLevel;
		});

		const addons = container.createDiv({ cls: 'lq-form-section' });
		addons.createEl('p', { text: this.tr('Add-ons iniciales', 'Starting add-ons'), cls: 'lq-section-title' });
		this.makeToggle(
			addons,
			this.tr('Activar tienda', 'Enable shop'),
			this.tr('Canjea recompensas usando monedas.', 'Redeem rewards using coins.'),
			this.draft.shopEnabled,
			(value) => {
				this.draft.shopEnabled = value;
				if (!value) this.draft.showCoinsInDashboard = false;
				this.render();
			}
		);
		if (this.draft.shopEnabled) {
			this.makeToggle(
				addons,
				this.tr('Mostrar monedas en dashboard', 'Show coins in dashboard'),
				this.tr('Añade el saldo a la cabecera principal.', 'Add the balance to the main header.'),
				this.draft.showCoinsInDashboard,
				(value) => {
					this.draft.showCoinsInDashboard = value;
				}
			);
		}
		this.makeToggle(
			addons,
			this.tr('Activar salud', 'Enable health'),
			this.tr('Habilita el seguimiento corporal y de salud.', 'Enable body and health tracking.'),
			this.draft.healthEnabled,
			(value) => {
				this.draft.healthEnabled = value;
			}
		);
	}

	private renderSummaryStep(container: HTMLElement): void {
		const card = container.createDiv({ cls: 'lq-card lq-onboarding-card' });
		card.createEl('h3', { text: this.tr('Resumen inicial', 'Starting summary') });
		const list = card.createEl('ul', { cls: 'lq-onboarding-list' });
		[
			`${this.tr('Idioma', 'Language')}: ${this.draft.language === 'es' ? 'Español' : 'English'}`,
			`${this.tr('Héroe', 'Hero')}: ${this.draft.heroName || this.tr('Sin nombre aún', 'No name yet')}`,
			`${this.tr('Áreas', 'Areas')}: ${this.selectedAreas().map((area) => area.name).join(', ') || '—'}`,
			`${this.tr('Clase', 'Class')}: ${this.currentClass()?.name ?? '—'}`,
			`${this.tr('Formato diario', 'Daily format')}: ${this.draft.dailyNoteFormat}`,
			`${this.tr('Tienda', 'Shop')}: ${this.draft.shopEnabled ? this.tr('Activa', 'Enabled') : this.tr('Desactivada', 'Disabled')}`,
			`${this.tr('Salud', 'Health')}: ${this.draft.healthEnabled ? this.tr('Activa', 'Enabled') : this.tr('Desactivada', 'Disabled')}`,
		].forEach((item) => list.createEl('li', { text: item }));

		const tip = container.createDiv({ cls: 'lq-onboarding-tip' });
		tip.createEl('strong', { text: this.tr('Siguiente paso:', 'Next step:') });
		tip.createSpan({
			text: ` ${this.tr(
				'abrir el dashboard, crear tu primera quest y ajustar el resto desde Settings → LifeQuest.',
				'open the dashboard, create your first quest, and fine-tune the rest from Settings → LifeQuest.'
			)}`,
		});
	}

	private renderFooter(container: HTMLElement): void {
		const footer = container.createDiv({ cls: 'lq-modal-footer' });

		if (this.step === 0 && !this.forceOpen) {
			const skipBtn = footer.createEl('button', {
				text: this.tr('Usar valores por defecto', 'Use defaults'),
				cls: 'lq-btn lq-btn-ghost',
			});
			skipBtn.addEventListener('click', () => {
				void this.completeOnboarding(false);
			});
		}

		if (this.step > 0) {
			const prevBtn = footer.createEl('button', {
				text: this.tr('Anterior', 'Previous'),
				cls: 'lq-btn lq-btn-ghost',
			});
			prevBtn.addEventListener('click', () => {
				this.step -= 1;
				this.render();
			});
		}

		const primary = footer.createEl('button', {
			text: this.step === 3 ? this.tr('Guardar y abrir dashboard', 'Save and open dashboard') : this.tr('Continuar', 'Continue'),
			cls: 'lq-btn lq-btn-primary',
		});
		primary.addEventListener('click', () => {
			if (this.step === 3) {
				void this.completeOnboarding(true);
				return;
			}
			if (!this.validateStep()) return;
			this.step += 1;
			this.render();
		});
	}

	private validateStep(): boolean {
		if (this.step === 1) {
			if (!this.draft.heroName.trim()) {
				new Notice(this.tr('Escribe un nombre para tu héroe.', 'Enter a name for your hero.'));
				return false;
			}
			if (this.draft.selectedAreaIds.length === 0) {
				new Notice(this.tr('Selecciona al menos un área de vida.', 'Select at least one life area.'));
				return false;
			}
			if (this.availableHeroClasses().length === 0) {
				new Notice(this.tr('Selecciona al menos un área compatible con una clase.', 'Select at least one area that supports a hero class.'));
				return false;
			}
		}
		if (this.step === 2) {
			if (!this.draft.dailyNoteFormat.trim()) {
				new Notice(this.tr('Define un formato para la daily note.', 'Set a format for the daily note.'));
				return false;
			}
			if (!Number.isFinite(this.draft.xpPerLevel) || this.draft.xpPerLevel < 100 || this.draft.xpPerLevel > 2000) {
				new Notice(this.tr('Usa un valor de XP por nivel entre 100 y 2000.', 'Use an XP per level value between 100 and 2000.'));
				return false;
			}
		}
		return true;
	}

	private async completeOnboarding(applyDraft: boolean): Promise<void> {
		if (applyDraft) {
			this.applyDraft();
		}
		this.plugin.data.settings.onboardingCompleted = true;
		await this.plugin.store.save(this.plugin.data);
		this.close();
		await this.plugin.openDashboard();
		new Notice(this.tr('LifeQuest está listo para usarse.', 'LifeQuest is ready to use.'));
	}

	private applyDraft(): void {
		this.plugin.data.settings.language = this.draft.language;
		this.plugin.data.profile.heroName = localizeHeroNameIfDefault(
			this.draft.heroName.trim() || this.plugin.data.profile.heroName,
			this.draft.language
		);
		this.plugin.data.profile.motto = this.draft.motto.trim();
		const localizedAreas = localizeDefaultLifeAreas(this.plugin.data.settings.lifeAreas, this.draft.language);
		const selectedAreas = localizedAreas.filter((lifeArea) => this.draft.selectedAreaIds.includes(lifeArea.id));
		this.plugin.data.settings.lifeAreas = selectedAreas;
		const localizedHeroClasses = localizeDefaultHeroClasses(this.plugin.data.settings.heroClasses, this.draft.language);
		this.plugin.data.settings.heroClasses = localizedHeroClasses.filter((heroClass) =>
			selectedAreas.some((lifeArea) => lifeArea.id === heroClass.bonusAreaId)
		);
		if (!this.plugin.data.settings.heroClasses.some((heroClass) => heroClass.id === this.draft.classId)) {
			this.draft.classId = this.plugin.data.settings.heroClasses[0]?.id ?? this.draft.classId;
		}
		this.plugin.data.profile.classId = this.draft.classId;
		this.plugin.data.profile.accentColor = this.draft.accentColor;
		this.plugin.data.settings.dailyNoteFormat = this.draft.dailyNoteFormat.trim() || this.plugin.data.settings.dailyNoteFormat;
		this.plugin.data.settings.xpPerLevel = this.draft.xpPerLevel;
		this.plugin.data.settings.shopEnabled = this.draft.shopEnabled;
		this.plugin.data.settings.showCoinsInDashboard = this.draft.shopEnabled && this.draft.showCoinsInDashboard;
		this.plugin.data.settings.healthEnabled = this.draft.healthEnabled;
		if (this.plugin.data.shop) {
			this.plugin.data.shop = localizeDefaultShopRewards(this.plugin.data.shop, this.draft.language);
		}
		if (this.plugin.data.health) {
			this.plugin.data.health.enabled = this.draft.healthEnabled;
		}
	}

	private currentClass(): HeroClass | undefined {
		return this.availableHeroClasses().find((heroClass) => heroClass.id === this.draft.classId);
	}

	private describeHeroClass(heroClass: HeroClass): string {
		const area = this.selectedAreas().find((lifeArea) => lifeArea.id === heroClass.bonusAreaId)
			?? this.plugin.data.settings.lifeAreas.find((lifeArea) => lifeArea.id === heroClass.bonusAreaId);
		return this.tr(`+20% XP en ${area?.name ?? 'un área'}`, `+20% XP in ${area?.name ?? 'one area'}`);
	}

	private selectedAreas(): LifeArea[] {
		return this.plugin.data.settings.lifeAreas.filter((lifeArea) => this.draft.selectedAreaIds.includes(lifeArea.id));
	}

	private availableHeroClasses(): HeroClass[] {
		return this.plugin.data.settings.heroClasses.filter((heroClass) =>
			this.draft.selectedAreaIds.includes(heroClass.bonusAreaId)
		);
	}

	private toggleArea(lifeArea: LifeArea): void {
		if (this.draft.selectedAreaIds.includes(lifeArea.id)) {
			this.draft.selectedAreaIds = this.draft.selectedAreaIds.filter((areaId) => areaId !== lifeArea.id);
		} else {
			this.draft.selectedAreaIds = [...this.draft.selectedAreaIds, lifeArea.id];
		}
		if (!this.availableHeroClasses().some((heroClass) => heroClass.id === this.draft.classId)) {
			this.draft.classId = this.availableHeroClasses()[0]?.id ?? this.draft.classId;
		}
		this.render();
	}

	private makeToggle(
		container: HTMLElement,
		label: string,
		description: string,
		value: boolean,
		onChange: (value: boolean) => void,
	): void {
		const wrap = container.createDiv({ cls: 'lq-onboarding-toggle' });
		const copy = wrap.createDiv();
		copy.createEl('strong', { text: label });
		copy.createEl('p', { text: description });
		const toggle = wrap.createEl('input', { cls: 'lq-toggle' });
		toggle.type = 'checkbox';
		toggle.checked = value;
		toggle.addEventListener('change', () => onChange(toggle.checked));
	}
}
