import { Plugin, Events, MarkdownPostProcessorContext, Notice } from 'obsidian';
import { LifequestData } from './types';
import { initStore, getStore } from './store';
import { LifequestSettingTab } from './settings';
import { registerCommands } from './commands/index';
import { initDailyNoteIntegration } from './daily-note';
import { WeeklyReviewView, VIEW_TYPE_WEEKLY_REVIEW } from './ui/review-view';
import { DashboardView, VIEW_TYPE_DASHBOARD } from './ui/dashboard';
import { ShopView, SHOP_VIEW_TYPE } from './ui/shop';
import { HealthTrackerView, HEALTH_VIEW_TYPE } from './ui/health-tracker';
import { OnboardingModal } from './ui/onboarding';
import { parseWidgetParams, renderWidget, registerWidgetAutoRefresh } from './ui/widget';
import { needsWeighIn } from './core/health-engine';
import { getLang, pick } from './i18n';

export default class LifequestPlugin extends Plugin {
	data!: LifequestData;
	store!: ReturnType<typeof getStore>;
	events: Events = new Events();

	async onload() {
		this.store = initStore(this.app);
		this.data  = await this.store.load();

		// Register dashboard view
		this.registerView(
			VIEW_TYPE_DASHBOARD,
			(leaf) => new DashboardView(leaf, this)
		);

		this.registerView(
			VIEW_TYPE_WEEKLY_REVIEW,
			(leaf) => new WeeklyReviewView(leaf, this)
		);

		this.registerView(
			SHOP_VIEW_TYPE,
			(leaf) => new ShopView(leaf, this)
		);

		this.registerView(
			HEALTH_VIEW_TYPE,
			(leaf) => new HealthTrackerView(leaf, this)
		);

		this.registerMarkdownCodeBlockProcessor(
			'lifequest',
			(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
				const params = parseWidgetParams(source);
				renderWidget(el, params, this.data);
				registerWidgetAutoRefresh(el, params, this, ctx);
			}
		);

		this.addSettingTab(new LifequestSettingTab(this.app, this));

		this.addRibbonIcon('sword', pick(getLang(this), 'LifeQuest: Abrir panel', 'LifeQuest: Open dashboard'), () => {
			void this.openDashboard();
		});

		registerCommands(this);
		initDailyNoteIntegration(this);

		// Auto-refresh dashboard on any file change (debounced inside DashboardView)
		this.registerEvent(
			this.app.vault.on('modify', () => {
				this.getDashboardView()?.scheduleRefresh();
			})
		);
		
		this.store.onDataChanged = () => this.events.trigger('data-changed');

		if (
			this.data.health?.enabled &&
			this.data.settings.healthModules.weight &&
			this.data.health.profile?.weighInReminder
		) {
			this.scheduleWeighInReminder();
		}

		if (!this.data.settings.onboardingCompleted) {
			this.app.workspace.onLayoutReady(() => {
				window.setTimeout(() => {
					if (!this.data.settings.onboardingCompleted) {
						new OnboardingModal(this).open();
					}
				}, 150);
			});
		}
	}

	private scheduleWeighInReminder() {
		const health = this.data.health;
		const profile = health?.profile;
		if (!profile || !health) return;
		const now = new Date();
		const targetDay = profile.weighInDay;

		const daysUntilWeighIn = (targetDay - now.getDay() + 7) % 7;
		const nextWeighIn = new Date(now);
		nextWeighIn.setDate(now.getDate() + (daysUntilWeighIn === 0 && now.getHours() >= 9 ? 7 : daysUntilWeighIn));
		nextWeighIn.setHours(9, 0, 0, 0);

		const msUntil = nextWeighIn.getTime() - now.getTime();

		const timeoutId = window.setTimeout(() => {
			if (needsWeighIn(health.entries, profile.weighInDay, new Date())) {
				const lang = getLang(this);
				new Notice(pick(lang, '⚖️ LifeQuest: Es tu día de registro de peso. Abre el seguimiento de salud para registrar.', '⚖️ LifeQuest: It is your weigh-in day. Open health tracking to log it.'), 8000);
			}
		}, msUntil);

		this.registerInterval(timeoutId);
	}

	onunload() {
		if (this.store) {
			void this.store.flush();
		}
	}

	async openDashboard(): Promise<void> {
		const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_DASHBOARD);
		if (existing.length > 0 && existing[0]) {
			void this.app.workspace.revealLeaf(existing[0]);
			return;
		}
		const leaf = this.app.workspace.getRightLeaf(false);
		await leaf?.setViewState({ type: VIEW_TYPE_DASHBOARD, active: true });
		if (leaf) {
			void this.app.workspace.revealLeaf(leaf);
		}
	}

	async openWeeklyReview(): Promise<void> {
		const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_WEEKLY_REVIEW);
		if (existing.length > 0 && existing[0]) {
			void this.app.workspace.revealLeaf(existing[0]);
			return;
		}
		const leaf = this.app.workspace.getLeaf('split', 'vertical');
		await leaf?.setViewState({ type: VIEW_TYPE_WEEKLY_REVIEW, active: true });
		if (leaf) {
			void this.app.workspace.revealLeaf(leaf);
		}
	}

	getDashboardView(): DashboardView | null {
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_DASHBOARD);
		return leaves[0]?.view instanceof DashboardView ? leaves[0].view : null;
	}

	openOnboarding(forceOpen = true): void {
		new OnboardingModal(this, forceOpen).open();
	}
}
