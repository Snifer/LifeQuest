import { ItemView, WorkspaceLeaf } from 'obsidian';
import type LifequestPlugin from '../main';
import { executeObsidianCommand } from '../command-api';
import {
	renderHero,
	renderTodaySummary,
	renderWeeklyChart,
	renderLifeAreas,
	renderActivityLog,
	renderQuickActions,
} from './dashboard-sections';

export const VIEW_TYPE_DASHBOARD = 'lifequest-dashboard';

export class DashboardView extends ItemView {
	private plugin: LifequestPlugin;
	private refreshTimeout: ReturnType<typeof setTimeout> | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: LifequestPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string  { return VIEW_TYPE_DASHBOARD; }
	getDisplayText(): string { return 'Dashboard'; }
	getIcon(): string { return 'sword'; }

	async onOpen(): Promise<void> {
		this.render();
	}

	async onClose(): Promise<void> {
		if (this.refreshTimeout) clearTimeout(this.refreshTimeout);
	}

	/** Debounced refresh — called from vault modify listener */
	scheduleRefresh(): void {
		if (this.refreshTimeout) clearTimeout(this.refreshTimeout);
		this.refreshTimeout = setTimeout(() => {
			this.refreshTimeout = null;
			this.render();
		}, 200);
	}

	private render(): void {
		const root = this.contentEl;
		root.empty();
		root.addClass('lifequest-dashboard');
		root.style.setProperty('--lq-user-accent', this.plugin.data.profile.accentColor);

		renderHero(this.plugin, root);
		renderTodaySummary(this.plugin, root);
		renderWeeklyChart(this.plugin, root);
		renderLifeAreas(this.plugin, root);
		renderActivityLog(this.plugin, root);
		renderQuickActions(this.plugin, root, (cmdId) => {
			void executeObsidianCommand(this.app, `${this.plugin.manifest.id}:${cmdId}`);
		});
	}
}
