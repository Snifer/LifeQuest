import { moment, Notice } from 'obsidian';
import type LifequestPlugin from '../main';
import { LogEntry, Quest } from '../types';
import { 
	getStreakMultiplier, 
	getXPToNextLevel, 
	generateDayStats, 
	calculateXP, 
	calculateLevel, 
	updateStreak, 
	checkBadges, 
	getLevelTitle, 
	earnCoins, 
	calculateCoinReward 
} from '../engine';
import { pick, t } from '../i18n';
import { executeObsidianCommand } from '../command-api';
import { generateDailyNote } from '../daily-note';
import { ProfileEditorModal } from './profile-editor';
import { HealthSetupModal } from './health-setup';
import { calculateHealthMetrics, needsWeighIn } from '../core/health-engine';

type QuestStatus = 'done' | 'failed' | 'pending';
type TranslationKey = Parameters<typeof t>[0];
type TranslationVars = Record<string, string | number>;

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

function questStatusToday(quest: Quest, logs: LogEntry[]): QuestStatus {
	const today = todayStr();
	const todayLogs = logs.filter(l => l.questId === quest.id && l.timestamp.startsWith(today));
	if (todayLogs.some(l => l.type === 'quest_completed')) return 'done';
	if (todayLogs.some(l => l.type === 'quest_failed'))    return 'failed';
	return 'pending';
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
	title.textContent = moment().format('dddd, D MMMM');

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

	// Quest list (active quests only)
	const activeQuests = data.quests.filter(q => q.status === 'active');
	const injectedAny = activeQuests.length > 0;

	if (!injectedAny) {
		const empty = card.createDiv({ cls: 'lq-empty' });
		empty.textContent = tr('ui_no_active_quests_today');
		return;
	}

	activeQuests.forEach(quest => {
		const status = questStatusToday(quest, data.activityLog);
		const item = card.createDiv({ cls: `lq-quest-item ${status}` });
		item.addClass('lq-clickable');

		// Colour dot by area
		const area = data.settings.lifeAreas.find(a => a.id === quest.area);
		const dot = item.createDiv({ cls: 'lq-quest-dot' });
		dot.setCssProps({ background: area?.color ?? '#7F77DD' });

		const titleEl = item.createDiv({ cls: 'lq-quest-title' });
		titleEl.textContent = quest.title;

		const xpEl = item.createDiv({ cls: 'lq-quest-xp' });
		xpEl.textContent = `${quest.xp} XP`;

		const badge = item.createDiv({ cls: `lq-quest-status ${status}` });
		badge.textContent = status === 'done' ? '✓' : status === 'failed' ? '❌' : '...';

		item.addEventListener('click', () => {
			void toggleQuestStatus(plugin, quest, status);
		});
	});
}

async function toggleQuestStatus(plugin: LifequestPlugin, quest: Quest, currentStatus: QuestStatus) {
	const { data, store } = plugin;
	const { Notice } = await import('obsidian');

	const today = moment().format('YYYY-MM-DD');
	
	// Determine next status: pending -> done -> failed -> pending
	let newStatus: QuestStatus;
	if (currentStatus === 'pending') newStatus = 'done';
	else if (currentStatus === 'done') newStatus = 'failed';
	else newStatus = 'pending';

	// 1. Remove previous logs for this quest today to "undo" before applying new
	const todayLogs = data.activityLog.filter(l => l.questId === quest.id && l.timestamp.startsWith(today));
	let xpToRevert = 0;
	todayLogs.forEach(l => { xpToRevert += l.xp; });
	
	data.activityLog = data.activityLog.filter(l => !(l.questId === quest.id && l.timestamp.startsWith(today)));
	data.xp.total = Math.max(0, data.xp.total - xpToRevert);
	if (data.xp.todayDate === today) {
		data.xp.todayGained = Math.max(0, data.xp.todayGained - xpToRevert);
	}

	// 2. Apply new status if not pending
	if (newStatus !== 'pending') {
		const isDone = newStatus === 'done';
		const xpDelta = calculateXP(quest, isDone, data);
		const prevLevel = calculateLevel(data.xp.total, data.settings.xpPerLevel);

		data.xp.total += xpDelta;
		if (data.xp.todayDate === today) {
			data.xp.todayGained += xpDelta;
		} else {
			data.xp.todayGained = xpDelta;
			data.xp.todayDate = today;
		}
		data.xp.level = calculateLevel(data.xp.total, data.settings.xpPerLevel);

		data.activityLog.push({
			id: `man-${Date.now()}-${quest.id}`,
			type: isDone ? 'quest_completed' : 'quest_failed',
			description: `${isDone ? '✅' : '❌'} ${quest.title} (Manual)`,
			xp: xpDelta,
			questId: quest.id,
			timestamp: new Date().toISOString()
		});

		if (data.xp.level > prevLevel) {
			const title = getLevelTitle(data.xp.level, data.settings.language);
			new Notice(t('daily_note_level_up_notice', data.settings.language, { level: data.xp.level, title }));

			// 🪙 Coins for Level Up
			if (data.settings.coinsEnabled && data.coins) {
				data.coins = earnCoins(data.coins, 'level_up', `Nivel ${data.xp.level}`, { level: data.xp.level }, data.settings.rewardSettings);
				if (data.settings.rewardSettings.notificationsEnabled) {
					new Notice(t('daily_note_coins_level_up', data.settings.language, {
						coins: calculateCoinReward('level_up', { level: data.xp.level }, data.settings.rewardSettings),
					}), 3000);
				}
			}
		}

		// 🪙 Coins for Epic Quest
		if (isDone && quest.difficulty === 'epic' && data.settings.coinsEnabled && data.coins) {
			data.coins = earnCoins(data.coins, 'epic_quest', quest.title, {}, data.settings.rewardSettings);
		}
	}

	// 3. Update Streak
	const hasActivityToday = data.activityLog.some(l => 
		l.timestamp.startsWith(today) && (l.type === 'quest_completed')
	);
	data.streak = updateStreak(data.streak, today, hasActivityToday);

	// 4. Badges
	const newBadges = checkBadges(data);
	newBadges.forEach(b => {
		data.badges.push(b);
		new Notice(t('daily_note_badge_notice', data.settings.language, { name: b.name }));
	});

	await store.save(data);
	plugin.getDashboardView()?.scheduleRefresh();
}

// ── 4.3 Weekly XP Chart ───────────────────────────────────────────────────────
export function renderWeeklyChart(plugin: LifequestPlugin, el: HTMLElement): void {
	const { data } = plugin;
	const today    = moment();
	const weekStart = today.clone().startOf('isoWeek');
	const tr = createTranslator(plugin);

	const shortDays = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
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
			['📊', tr('ui_weekly_review'), () => onCommand('weekly-review')],
		];

		if (plugin.data.settings.coinsEnabled && plugin.data.settings.shopEnabled) {
			actions.splice(2, 0, ['🛍️', tr('ui_shop'), () => onCommand('open-shop')]);
		}
		if (plugin.data.settings.healthEnabled) {
			const needsSetup = plugin.data.settings.healthModules.weight && !plugin.data.health?.profile;
			actions.push([
				'⚕️',
				needsSetup ? tr('Configurar salud', 'Set up health') : tr('Salud', 'Health'),
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
