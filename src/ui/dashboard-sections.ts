import { Notice } from 'obsidian';
import type LifequestPlugin from '../main';
import { Quest } from '../types';
import { 
	getStreakMultiplier, 
	getXPToNextLevel, 
	generateDayStats, 
} from '../engine';
import { pick, t } from '../i18n';
import { executeObsidianCommand } from '../command-api';
import { generateDailyNote } from '../daily-note';
import { ProfileEditorModal } from './profile-editor';
import { HealthSetupModal } from './health-setup';
import { calculateHealthMetrics, needsWeighIn } from '../core/health-engine';
import {
	buildQuestTree,
	getSubquestProgress,
	setAllRootCollapsed,
	type QuestListFilter,
} from '../core/quest-hierarchy';
import { getQuestStatusToday, setQuestStatusForToday, type QuestStatus } from '../core/quest-actions';
import { moment } from '../obsidian-moment';

type TranslationKey = Parameters<typeof t>[0];
type TranslationVars = Record<string, string | number>;
let dashboardQuestListFilter: QuestListFilter = 'all';
let dashboardShowCompleted = true;
let dashboardCompletedCollapsed = false;
let dashboardFailedCollapsed = false;

interface DashboardQuestRow {
	quest: Quest;
	depth: 0 | 1;
	hasChildren: boolean;
	isCollapsed: boolean;
	status: QuestStatus;
}

function todayStr(): string {
	return moment().format('YYYY-MM-DD');
}

function createTranslator(plugin: LifequestPlugin) {
	const lang = plugin.data.settings.language;
	function tr(key: TranslationKey, vars?: TranslationVars): string;
	function tr(esText: string, enText: string): string;
	function tr(first: string, second: TranslationVars | string = {}): string {
		if (typeof second === 'string') return pick(lang, first, second);
		return t(first as TranslationKey, lang, second);
	}
	return tr;
}

async function toggleQuestCollapse(plugin: LifequestPlugin, quest: Quest): Promise<void> {
	quest.isCollapsed = !quest.isCollapsed;
	quest.lastModifiedAt = moment().format('YYYY-MM-DD');
	await plugin.store.save(plugin.data);
	plugin.getDashboardView()?.scheduleRefresh();
}

async function setDashboardQuestCollapse(plugin: LifequestPlugin, collapsed: boolean): Promise<void> {
	const changed = setAllRootCollapsed(plugin.data.quests, collapsed);
	if (!changed) {
		return;
	}
	await plugin.store.save(plugin.data);
	plugin.getDashboardView()?.scheduleRefresh();
}

function getAreaOrderMap(plugin: LifequestPlugin): Map<string, number> {
	return new Map(plugin.data.settings.lifeAreas.map((area, index) => [area.id, index]));
}

function getPriorityRank(quest: Quest): number {
	const difficultyRank: Record<Quest['difficulty'], number> = {
		easy: 1,
		normal: 2,
		hard: 3,
		epic: 4,
	};

	return (difficultyRank[quest.difficulty] * 1000) + (quest.penalty * 10) + quest.xp;
}

function compareDashboardQuests(
	a: Quest,
	b: Quest,
	sortMode: LifequestPlugin['data']['settings']['dashboardQuestSort'],
	areaOrder: Map<string, number>
): number {
	switch (sortMode) {
		case 'priority':
			return getPriorityRank(b) - getPriorityRank(a) || b.xp - a.xp || a.title.localeCompare(b.title);
		case 'xp':
			return b.xp - a.xp || getPriorityRank(b) - getPriorityRank(a) || a.title.localeCompare(b.title);
		case 'area':
			return (areaOrder.get(a.area) ?? Number.MAX_SAFE_INTEGER) - (areaOrder.get(b.area) ?? Number.MAX_SAFE_INTEGER)
				|| b.xp - a.xp
				|| a.title.localeCompare(b.title);
		case 'manual':
		default:
			return a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt);
	}
}

function buildDashboardQuestRows(plugin: LifequestPlugin): DashboardQuestRow[] {
	const activeQuests = plugin.data.quests.filter((quest) => quest.status === 'active');
	const areaOrder = getAreaOrderMap(plugin);
	const sortMode = plugin.data.settings.dashboardQuestSort;
	const rows: DashboardQuestRow[] = [];

	const roots = buildQuestTree(activeQuests, false)
		.sort((a, b) => compareDashboardQuests(a.quest, b.quest, sortMode, areaOrder));

	for (const root of roots) {
		const visibleChildren = [...root.children].sort((a, b) => compareDashboardQuests(a.quest, b.quest, sortMode, areaOrder));
		const isCollapsed = Boolean(root.quest.isCollapsed) && visibleChildren.length > 0;
		rows.push({
			quest: root.quest,
			depth: 0,
			hasChildren: visibleChildren.length > 0,
			isCollapsed,
			status: getQuestStatusToday(root.quest.id, plugin.data.activityLog),
		});

		if (dashboardQuestListFilter === 'roots' || isCollapsed) {
			continue;
		}

		for (const child of visibleChildren) {
			rows.push({
				quest: child.quest,
				depth: 1,
				hasChildren: false,
				isCollapsed: false,
				status: getQuestStatusToday(child.quest.id, plugin.data.activityLog),
			});
		}
	}

	return rows;
}

async function handleQuestAction(plugin: LifequestPlugin, quest: Quest, targetStatus: QuestStatus): Promise<void> {
	const changed = setQuestStatusForToday(plugin.data, quest, targetStatus, plugin.data.settings.language);
	if (!changed) {
		return;
	}
	await plugin.store.save(plugin.data);
	plugin.getDashboardView()?.scheduleRefresh();
}

// ── 4.1 Hero Profile ──────────────────────────────────────────────────────────
export function renderHero(plugin: LifequestPlugin, el: HTMLElement): void {
	const { data } = plugin;
	const { profile, xp, streak, badges, settings } = data;
	const tr = createTranslator(plugin);

	const card = el.createDiv({ cls: 'lq-card lq-hero' });
	card.style.setProperty('--lq-user-accent', profile.accentColor);

	// Avatar
	const avatarWrap = card.createDiv({ cls: 'lq-avatar-wrap' });
	if (profile.avatarBase64) {
		const img = avatarWrap.createEl('img', { cls: 'lq-avatar' });
		img.src = profile.avatarBase64;
	} else {
		const initials = avatarWrap.createDiv({ cls: 'lq-avatar-initials' });
		initials.setCssProps({ background: profile.accentColor });
		initials.textContent = (profile.heroName || 'H').slice(0, 2).toUpperCase();
	}
	const overlay = avatarWrap.createDiv({ cls: 'lq-avatar-overlay' });
	overlay.textContent = tr('ui_change_photo');

	// Hidden file input for avatar upload
	const fileInput = el.createEl('input');
	fileInput.type = 'file';
	fileInput.accept = 'image/*';
	fileInput.setCssProps({ display: 'none' });
	fileInput.addEventListener('change', () => {
		void (async () => {
		const file = fileInput.files?.[0];
		if (!file) return;
		if (file.size > 2 * 1024 * 1024) {
			new Notice(tr('LifeQuest: La imagen debe pesar menos de 2 MB', 'LifeQuest: Image must be under 2 MB'));
			return;
		}
		const reader = new FileReader();
		reader.addEventListener('load', () => {
			data.profile.avatarBase64 = typeof reader.result === 'string' ? reader.result : null;
			void plugin.store.save(data);
		});
		reader.readAsDataURL(file);
		})();
	});
	avatarWrap.addEventListener('click', () => fileInput.click());

	// Info
	const info = card.createDiv({ cls: 'lq-hero-info' });
	const name = info.createEl('h2', { cls: 'lq-hero-name' });
	name.textContent = profile.heroName || tr('ui_hero');

	// Badge pills row
	const pillRow = info.createDiv({ cls: 'lq-badges-row' });

	const hClass = settings.heroClasses?.find(c => c.id === profile.classId);
	const className = hClass ? hClass.name : tr('ui_adventurer');

	const lvlPill = pillRow.createDiv({ cls: 'lq-badge-pill accent' });
	lvlPill.textContent = `⚔ ${className} Lvl ${xp.level}`;

	const streakPill = pillRow.createDiv({ cls: 'lq-badge-pill streak' });
	streakPill.textContent = `🔥 ${streak.current}d`;

	const mult = getStreakMultiplier(streak.current);
	const multPill = pillRow.createDiv({ cls: 'lq-badge-pill multiplier' });
	multPill.textContent = `×${mult.toFixed(1)}`;

	if (data.settings.coinsEnabled && data.settings.shopEnabled && data.settings.showCoinsInDashboard && data.coins) {
		const coinPill = pillRow.createDiv({ cls: 'lq-badge-pill coins' });
		coinPill.textContent = `🪙 ${data.coins.balance}`;
		coinPill.addClass('lq-clickable');
		coinPill.addEventListener('click', () => {
			void executeObsidianCommand(plugin.app, `${plugin.manifest.id}:open-shop`);
		});
	}

	// XP bar
	const xpPerLevel = data.settings.xpPerLevel || 500;
	const needed = getXPToNextLevel(data.xp.total, xpPerLevel);
	const progress = xpPerLevel - needed;
	const pct = Math.round((progress / xpPerLevel) * 100);

	const xpRow = info.createDiv({ cls: 'lq-xp-row' });
	const track = xpRow.createDiv({ cls: 'lq-xp-bar-track' });
	const fill  = track.createDiv({ cls: 'lq-xp-bar-fill' });
	fill.setCssProps({ width: `${pct}%` });
	const xpLabel = xpRow.createDiv({ cls: 'lq-xp-label' });
	xpLabel.textContent = `${progress} / ${xpPerLevel} XP`;

	// Unlocked badges strip
	if (badges.length > 0) {
		const badgeStrip = info.createDiv({ cls: 'lq-badges-row' });
		badges.slice(-4).forEach(b => {
			const pill = badgeStrip.createSpan({ cls: 'lq-unlocked-badge' });
			pill.textContent = `🏅 ${b.name}`;
		});
	}

	// Edit profile button
	const editProfileBtn = card.createEl('button', { cls: 'lq-btn lq-btn-ghost lq-edit-profile-btn', attr: { title: tr('ui_edit_profile') } });
	editProfileBtn.textContent = '⚙';
	editProfileBtn.addEventListener('click', () => {
		new ProfileEditorModal(plugin).open();
	});
}

// ── 4.2 Today's Summary ───────────────────────────────────────────────────────
export function renderTodaySummary(plugin: LifequestPlugin, el: HTMLElement): void {
	const { data } = plugin;
	const today = todayStr();
	const dayStats = generateDayStats(data.activityLog, today);
	const tr = createTranslator(plugin);

	const card = el.createDiv({ cls: 'lq-card' });
	const title = card.createEl('p', { cls: 'lq-card-title' });
	title.textContent = moment().locale(data.settings.language).format('dddd, D MMMM');

	const toolbar = card.createDiv({ cls: 'lq-quest-toolbar' });
	const allBtn = toolbar.createEl('button', { text: tr('Todas', 'All'), cls: 'lq-btn lq-btn-ghost lq-toolbar-btn' });
	const rootsBtn = toolbar.createEl('button', { text: tr('Solo roots', 'Roots only'), cls: 'lq-btn lq-btn-ghost lq-toolbar-btn' });
	const completedBtn = toolbar.createEl('button', {
		text: dashboardShowCompleted ? tr('Ocultar completadas', 'Hide completed') : tr('Mostrar completadas', 'Show completed'),
		cls: 'lq-btn lq-btn-ghost lq-toolbar-btn',
	});
	const collapseBtn = toolbar.createEl('button', { text: tr('Colapsar todo', 'Collapse all'), cls: 'lq-btn lq-btn-ghost lq-toolbar-btn' });
	const expandBtn = toolbar.createEl('button', { text: tr('Expandir todo', 'Expand all'), cls: 'lq-btn lq-btn-ghost lq-toolbar-btn' });
	const compactBtn = toolbar.createEl('button', {
		text: data.settings.dashboardCompactMode ? tr('Modo cómodo', 'Comfort mode') : tr('Modo compacto', 'Compact mode'),
		cls: 'lq-btn lq-btn-ghost lq-toolbar-btn',
	});
	const sortWrap = toolbar.createDiv({ cls: 'lq-toolbar-select-wrap' });
	sortWrap.createSpan({ cls: 'lq-toolbar-select-label', text: tr('Orden', 'Sort') });
	const sortSelect = sortWrap.createEl('select', { cls: 'lq-toolbar-select' });
	[
		['manual', tr('Manual', 'Manual')],
		['priority', tr('Prioridad', 'Priority')],
		['xp', 'XP'],
		['area', tr('Área', 'Area')],
	].forEach(([value, label]) => {
		sortSelect.createEl('option', { value, text: label });
	});
	sortSelect.value = data.settings.dashboardQuestSort;
	if (dashboardQuestListFilter === 'all') allBtn.addClass('is-active');
	if (dashboardQuestListFilter === 'roots') rootsBtn.addClass('is-active');
	allBtn.addEventListener('click', () => {
		dashboardQuestListFilter = 'all';
		plugin.getDashboardView()?.scheduleRefresh();
	});
	rootsBtn.addEventListener('click', () => {
		dashboardQuestListFilter = 'roots';
		plugin.getDashboardView()?.scheduleRefresh();
	});
	completedBtn.addEventListener('click', () => {
		dashboardShowCompleted = !dashboardShowCompleted;
		plugin.getDashboardView()?.scheduleRefresh();
	});
	collapseBtn.addEventListener('click', () => { void setDashboardQuestCollapse(plugin, true); });
	expandBtn.addEventListener('click', () => { void setDashboardQuestCollapse(plugin, false); });
	compactBtn.addEventListener('click', () => {
		void (async () => {
			plugin.data.settings.dashboardCompactMode = !plugin.data.settings.dashboardCompactMode;
			await plugin.store.save(plugin.data);
			plugin.getDashboardView()?.scheduleRefresh();
		})();
	});
	sortSelect.addEventListener('change', () => {
		void (async () => {
			plugin.data.settings.dashboardQuestSort = sortSelect.value as LifequestPlugin['data']['settings']['dashboardQuestSort'];
			await plugin.store.save(plugin.data);
			plugin.getDashboardView()?.scheduleRefresh();
		})();
	});

	// Stat chips
	const chipRow = card.createDiv({ cls: 'lq-chip-row' });
	const chips: Array<[string, string]> = [
		[`+${dayStats.xpTotal}`, tr('ui_xp_today')],
		[String(dayStats.completed), tr('ui_done')],
		[String(dayStats.failed), tr('ui_failed')],
		[`${dayStats.successRate}%`, tr('ui_rate')],
	];
	chips.forEach(([val, lbl]) => {
		const chip = chipRow.createDiv({ cls: 'lq-chip' });
		const chipVal = chip.createDiv({ cls: 'lq-chip-value' });
		chipVal.textContent = val;
		const chipLbl = chip.createDiv({ cls: 'lq-chip-label' });
		chipLbl.textContent = lbl;
	});

	const visibleRows = buildDashboardQuestRows(plugin);

	if (visibleRows.length === 0) {
		const empty = card.createDiv({ cls: 'lq-empty' });
		empty.textContent = tr('ui_no_active_quests_today');
		return;
	}

	const pendingRows = visibleRows.filter((row) => row.status === 'pending');
	const doneRows = dashboardShowCompleted ? visibleRows.filter((row) => row.status === 'done') : [];
	const failedRows = visibleRows.filter((row) => row.status === 'failed');

	const renderSection = (
		label: string,
		rows: DashboardQuestRow[],
		collapsed: boolean,
		onToggleCollapse?: () => void
	): void => {
		if (rows.length === 0) {
			return;
		}

		const section = card.createDiv({ cls: 'lq-quest-section' });
		const header = section.createDiv({ cls: 'lq-quest-section-header' });
		const titleWrap = header.createDiv({ cls: 'lq-quest-section-title-wrap' });
		titleWrap.createEl('h4', { cls: 'lq-quest-section-title', text: label });
		titleWrap.createSpan({ cls: 'lq-quest-section-count', text: String(rows.length) });

		if (onToggleCollapse) {
			const toggleBtn = header.createEl('button', {
				cls: 'lq-btn lq-btn-ghost lq-quest-section-toggle',
				text: collapsed ? tr('Expandir', 'Expand') : tr('Colapsar', 'Collapse'),
			});
			toggleBtn.addEventListener('click', onToggleCollapse);
		}

		if (collapsed) {
			return;
		}

		rows.forEach(({ quest, depth, hasChildren, isCollapsed, status }) => {
			const item = section.createDiv({ cls: `lq-quest-item ${status}` });
			if (data.settings.dashboardCompactMode) {
				item.addClass('compact');
			}
			if (depth === 1) {
				item.addClass('subquest');
			}

			const lead = item.createDiv({ cls: 'lq-quest-item-lead' });
			if (depth === 1) {
				lead.createDiv({ cls: 'lq-quest-indent' });
			}
			if (depth === 0 && hasChildren) {
				const caret = lead.createEl('button', { cls: 'lq-quest-caret', attr: { title: tr('Mostrar u ocultar subquests', 'Toggle subquests') } });
				caret.textContent = isCollapsed ? '▸' : '▾';
				caret.addEventListener('click', (event) => {
					event.stopPropagation();
					void toggleQuestCollapse(plugin, quest);
				});
			} else {
				lead.createDiv({ cls: 'lq-quest-caret-placeholder' });
			}

			const area = data.settings.lifeAreas.find((item) => item.id === quest.area);
			const dot = item.createDiv({ cls: 'lq-quest-dot' });
			dot.setCssProps({ background: area?.color ?? '#7F77DD' });

			const rowTitleWrap = item.createDiv({ cls: 'lq-quest-title-wrap' });
			const titleEl = rowTitleWrap.createDiv({ cls: 'lq-quest-title' });
			titleEl.textContent = quest.title;
			if (!quest.parentQuestId && hasChildren) {
				const progress = getSubquestProgress(quest.id, data.quests, data.activityLog, today);
				const progressBadge = rowTitleWrap.createDiv({ cls: 'lq-subquest-progress-badge' });
				progressBadge.textContent = `${progress.completed}/${progress.total}`;
				if (progress.allCompleted) {
					progressBadge.addClass('is-complete');
				}
			}

			const xpEl = item.createDiv({ cls: 'lq-quest-xp' });
			xpEl.textContent = `${quest.xp} XP`;

			const actions = item.createDiv({ cls: 'lq-quest-action-group' });
			const actionDefs: Array<[QuestStatus, string, string]> = [
				['done', '✓', tr('Marcar completada', 'Mark completed')],
				['failed', '✕', tr('Marcar fallida', 'Mark failed')],
				['pending', '↺', tr('Resetear a pendiente', 'Reset to pending')],
			];

			actionDefs.forEach(([targetStatus, icon, labelText]) => {
				const actionBtn = actions.createEl('button', {
					cls: `lq-quest-action-btn ${targetStatus} ${status === targetStatus ? 'is-active' : ''}`,
					attr: { title: labelText, 'aria-label': labelText },
				});
				actionBtn.textContent = icon;
				actionBtn.disabled = status === targetStatus;
				actionBtn.addEventListener('click', (event) => {
					event.stopPropagation();
					void handleQuestAction(plugin, quest, targetStatus);
				});
			});
		});
	};

	renderSection(tr('Pendientes', 'Pending'), pendingRows, false);
	renderSection(
		tr('Completadas', 'Completed'),
		doneRows,
		dashboardCompletedCollapsed,
		() => {
			dashboardCompletedCollapsed = !dashboardCompletedCollapsed;
			plugin.getDashboardView()?.scheduleRefresh();
		}
	);
	renderSection(
		tr('Fallidas', 'Failed'),
		failedRows,
		dashboardFailedCollapsed,
		() => {
			dashboardFailedCollapsed = !dashboardFailedCollapsed;
			plugin.getDashboardView()?.scheduleRefresh();
		}
	);
}

// ── 4.3 Weekly XP Chart ───────────────────────────────────────────────────────
export function renderWeeklyChart(plugin: LifequestPlugin, el: HTMLElement): void {
	const { data } = plugin;
	const today    = moment();
	const weekStart = today.clone().startOf('isoWeek');
	const tr = createTranslator(plugin);

	const shortDays = [
		tr('Lun', 'Mon'),
		tr('Mar', 'Tue'),
		tr('Mié', 'Wed'),
		tr('Jue', 'Thu'),
		tr('Vie', 'Fri'),
		tr('Sáb', 'Sat'),
		tr('Dom', 'Sun'),
	];
	const xpByDay = [0, 0, 0, 0, 0, 0, 0];

	for (let i = 0; i < 7; i++) {
		const dayStr = weekStart.clone().add(i, 'days').format('YYYY-MM-DD');
		const stats  = generateDayStats(data.activityLog, dayStr);
		xpByDay[i]   = Math.max(0, stats.xpTotal);
	}

	const maxXP = Math.max(...xpByDay, 1);
	const todayIndex = today.isoWeekday() - 1; // 0 = Mon

	const card = el.createDiv({ cls: 'lq-card' });
	const titleEl = card.createEl('p', { cls: 'lq-card-title' });
	titleEl.textContent = tr('ui_weekly_xp');

	const chart = card.createDiv({ cls: 'lq-chart' });

	xpByDay.forEach((xp, i) => {
		const col = chart.createDiv({ cls: 'lq-chart-col' });
		const wrap = col.createDiv({ cls: 'lq-chart-bar-wrap' });
		const bar  = wrap.createDiv({ cls: 'lq-chart-bar' });

		const heightPct = maxXP > 0 ? Math.round((xp / maxXP) * 100) : 0;
		bar.setCssProps({ height: `${heightPct}%` });

		if (i === todayIndex) bar.classList.add('today');
		else if (i < todayIndex) bar.classList.add('past');
		else bar.classList.add('future');

		const day = col.createDiv({ cls: 'lq-chart-day' });
		day.textContent = shortDays[i] ?? '';
	});

	const footer = card.createDiv({ cls: 'lq-chart-footer' });
	const weekTotal = xpByDay.reduce((a, b) => a + b, 0);
	footer.textContent = tr('ui_week_total', { xp: weekTotal });
}

// ── 4.4 Life Areas ────────────────────────────────────────────────────────────
export function renderLifeAreas(plugin: LifequestPlugin, el: HTMLElement): void {
	const { data } = plugin;
	const tr = createTranslator(plugin);

	// Helper for Health Card
	const renderHealthCard = () => {
		if (!data.health?.enabled || !data.settings.healthEnabled || !data.settings.healthModules.weight) return;

		const healthCard = el.createDiv({ cls: 'lq-card' });
		
		const headerRow = healthCard.createDiv({ cls: 'lq-health-card-header' });
		headerRow.createEl('p', { cls: 'lq-card-title lq-health-card-title', text: tr('ui_health_body_tracking') });
		const dBtn = headerRow.createEl('a', { text: tr('ui_view_details'), cls: 'lq-health-card-link' });
		dBtn.onclick = () => {
			void executeObsidianCommand(plugin.app, `${plugin.manifest.id}:open-health`);
		};

		if (!data.health.profile) {
			const setupBtn = healthCard.createEl('button', { text: tr('ui_setup_health_tracking'), cls: 'lq-btn lq-btn-primary lq-health-card-spacer' });
			setupBtn.onclick = () => {
				new HealthSetupModal(plugin.app, plugin).open();
			};
			return;
		}

		if (data.health.entries.length === 0) {
			healthCard.createDiv({ cls: 'lq-health-card-empty', text: tr('ui_no_health_entries') });
			return;
		}

		const metrics = calculateHealthMetrics(data.health.profile, data.health.entries);
		if (!metrics) return;

		healthCard.createDiv({
			cls: 'lq-health-card-metrics',
			text: tr(
				`Peso: ${metrics.currentWeight} ${data.health.profile.weightUnit} · IMC: ${metrics.bmi} · Meta: ${data.health.profile.targetWeight} ${data.health.profile.weightUnit}`,
				`Weight: ${metrics.currentWeight} ${data.health.profile.weightUnit} · BMI: ${metrics.bmi} · Goal: ${data.health.profile.targetWeight} ${data.health.profile.weightUnit}`
			)
		});

		const xpRow = healthCard.createDiv({ cls: 'lq-xp-row lq-health-card-xp-row' });
		const xpLabel = xpRow.createDiv({ cls: 'lq-xp-label' });
		xpLabel.textContent = tr('ui_progress', { percent: metrics.progressPercent });

		const track = xpRow.createDiv({ cls: 'lq-xp-bar-track' });
		const fill  = track.createDiv({ cls: 'lq-xp-bar-fill' });
		fill.setCssProps({ width: `${metrics.progressPercent}%`, background: data.profile.accentColor });

		if (metrics.weeklyTrend !== null) {
			healthCard.createDiv({
				cls: 'lq-health-card-trend',
				text: tr(
					`Tendencia: ${metrics.weeklyTrend} kg/sem · Proyección: ${metrics.weeksToGoal ? metrics.weeksToGoal + ' semanas' : 'N/D'}`,
					`Trend: ${metrics.weeklyTrend} kg/week · Projection: ${metrics.weeksToGoal ? metrics.weeksToGoal + ' weeks' : 'N/A'}`
				)
			});
		}

		if (needsWeighIn(data.health.entries, data.health.profile.weighInDay)) {
			const warnBox = healthCard.createDiv({ cls: 'lq-health-card-warning' });
			warnBox.createSpan({ text: `⚠ ${tr('ui_log_now')}` });
			const logBtn = warnBox.createEl('button', { text: tr('ui_log_now') });
			logBtn.onclick = () => {
				void executeObsidianCommand(plugin.app, `${plugin.manifest.id}:log-weight`);
			};
		}
	};
	
	renderHealthCard();

	const weekStart = moment().startOf('isoWeek').format('YYYY-MM-DD');

	// Compute area completion rates from this week's logs
	const areaRates: Record<string, { c: number; total: number }> = {};
	data.settings.lifeAreas.forEach(a => { areaRates[a.id] = { c: 0, total: 0 }; });

	const weekLogs = data.activityLog.filter(l =>
		l.timestamp >= weekStart &&
		(l.type === 'quest_completed' || l.type === 'quest_failed') &&
		l.questId
	);

	weekLogs.forEach(l => {
		const quest = data.quests.find(q => q.id === l.questId);
		if (!quest) return;
		const ar = areaRates[quest.area];
		if (!ar) return;
		ar.total++;
		if (l.type === 'quest_completed') ar.c++;
	});

	const card = el.createDiv({ cls: 'lq-card' });
	const titleEl = card.createEl('p', { cls: 'lq-card-title' });
	titleEl.textContent = tr('ui_life_areas_week');

	data.settings.lifeAreas.forEach(area => {
		const stats = areaRates[area.id];
		const pct = stats && stats.total > 0 ? Math.round((stats.c / stats.total) * 100) : 0;

		const row = card.createDiv({ cls: 'lq-area-row' });
		const dot  = row.createDiv({ cls: 'lq-area-dot' });
		dot.setCssProps({ background: area.color });
		const nameEl = row.createDiv({ cls: 'lq-area-name' });
		nameEl.textContent = area.name;
		const track  = row.createDiv({ cls: 'lq-area-bar-track' });
		const fill   = track.createDiv({ cls: 'lq-area-bar-fill' });
		fill.setCssProps({ width: `${pct}%`, background: area.color });
		const pctEl  = row.createDiv({ cls: 'lq-area-pct' });
		pctEl.textContent = `${pct}%`;
	});
}

// ── 4.5 Activity Log ──────────────────────────────────────────────────────────
export function renderActivityLog(plugin: LifequestPlugin, el: HTMLElement): void {
	const { data } = plugin;
	const tr = createTranslator(plugin);
	const last10 = [...data.activityLog].reverse().slice(0, 10);

	const card = el.createDiv({ cls: 'lq-card' });
	const titleEl = card.createEl('p', { cls: 'lq-card-title' });
	titleEl.textContent = tr('ui_recent_activity');

	if (last10.length === 0) {
		const empty = card.createDiv({ cls: 'lq-empty' });
		empty.textContent = tr('ui_no_activity_yet');
		return;
	}

	const typeIcon: Record<string, string> = {
		quest_completed:      '✅',
		quest_failed:         '❌',
		badge_unlocked:       '🏅',
		level_up:             '🎉',
		multiplier_activated: '⚡',
	};

	last10.forEach(log => {
		const row   = card.createDiv({ cls: 'lq-log-item' });
		const icon  = row.createDiv({ cls: 'lq-log-icon' });
		icon.textContent = typeIcon[log.type] ?? '📝';
		const desc  = row.createDiv({ cls: 'lq-log-desc' });
		desc.textContent = log.description;
		if (log.xp !== 0) {
			const xpEl = row.createDiv({ cls: `lq-log-xp ${log.xp > 0 ? 'positive' : 'negative'}` });
			xpEl.textContent = log.xp > 0 ? `+${log.xp}` : String(log.xp);
		}
		const ts   = row.createDiv({ cls: 'lq-log-ts' });
		ts.textContent = moment(log.timestamp).format('HH:mm');
	});
}

// ── 4.6 Quick Actions ─────────────────────────────────────────────────────────
export function renderQuickActions(
	plugin: LifequestPlugin,
	el: HTMLElement,
	onCommand: (id: string) => void
): void {
	const tr = createTranslator(plugin);
	const card = el.createDiv({ cls: 'lq-card' });
	const titleEl = card.createEl('p', { cls: 'lq-card-title' });
	titleEl.textContent = tr('ui_quick_actions');

	const row = card.createDiv({ cls: 'lq-actions-row' });

		const actions: Array<[string, string, () => void]> = [
			['📝', tr('ui_daily_note'), () => void generateDailyNote(plugin)],
			['⚔', tr('ui_new_quest'),  () => onCommand('new-quest')],
			['✅', tr('Completar quest', 'Complete quest'), () => onCommand('quick-complete-quest')],
			['📊', tr('ui_weekly_review'), () => onCommand('weekly-review')],
		];

		if (plugin.data.settings.markdownSyncScope !== 'daily-note') {
			actions.splice(3, 0, ['📋', tr('Copiar Markdown', 'Copy Markdown'), () => onCommand('copy-quest-markdown')]);
		}

		if (plugin.data.settings.coinsEnabled && plugin.data.settings.shopEnabled) {
			actions.splice(2, 0, ['🛍️', tr('ui_shop'), () => onCommand('open-shop')]);
		}
		if (plugin.data.settings.healthEnabled) {
			const needsSetup = plugin.data.settings.healthModules.weight && !plugin.data.health?.profile;
			actions.push([
				'⚕️',
				needsSetup ? tr('ui_setup_health_tracking') : tr('health_tracking'),
				() => onCommand('open-health'),
			]);
		}

	actions.forEach(([icon, label, handler]) => {
		const btn = row.createDiv({ cls: 'lq-action-btn' });
		const iconEl = btn.createDiv({ cls: 'lq-action-icon' });
		iconEl.textContent = icon;
		const lblEl = btn.createDiv();
		lblEl.textContent = label;
		btn.addEventListener('click', handler);
	});
}
