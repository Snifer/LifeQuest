import { TFile, Notice, requestUrl } from 'obsidian';
import type LifequestPlugin from './main';
import { Quest, LifequestData, LogEntry } from './types';
import { moment } from './obsidian-moment';
import {
	calculateXP,
	calculateLevel,
	updateStreak,
	checkBadges,
	getLevelTitle,
	earnCoins,
	calculateCoinReward
} from './engine';
import { pick, t } from './i18n';
import { parseDailyMessageSource, pickDailyMessage, resolveDailyMessageSourceUrl } from './daily-message';

// ─── Constants ────────────────────────────────────────────────────────────────

const QUEST_BLOCK_START = '<!-- lifequest:start -->';
const QUEST_BLOCK_END   = '<!-- /lifequest -->';
const LEGACY_QUEST_BLOCK_START = '## Quests del día';
const MESSAGE_BLOCK_START = '<!-- lifequest-message:start -->';
const MESSAGE_BLOCK_END = '<!-- /lifequest-message -->';
const QUEST_TAG_REGEX   = /^[\t >*\-+0-9.)]*\[( |x|X)\].*?#lq-([a-f0-9-]+)\b.*$/gm;

type MarkdownSyncScope = LifequestData['settings']['markdownSyncScope'];
type PluginLanguage = LifequestData['settings']['language'];
const INTERNAL_EXCLUDED_FOLDERS = ['_LifeQuest'];

/** Default emoji per well-known area id, fallback to ⭐ */
const AREA_EMOJI: Record<string, string> = {
	health:        '🏃',
	work:          '💼',
	learning:      '📚',
	relationships: '🤝',
	finances:      '💰',
};

function areaEmoji(areaId: string): string {
	return AREA_EMOJI[areaId] ?? '⭐';
}

function getDailyQuestHeading(data: LifequestData): string {
	return (data.settings.language ?? 'en') === 'es' ? '## Quests del día' : '## Quests for today';
}

// ─── Quest block generation ───────────────────────────────────────────────────

function buildQuestLine(quest: Quest, isDone = false): string {
	const emoji = areaEmoji(quest.area);
	const check = isDone ? 'x' : ' ';
	return `- [${check}] ${emoji} ${quest.title} #lq-${quest.id}`;
}

function upsertManagedBlock(content: string, startMarker: string, endMarker: string, block: string | null, beforeMarker?: string): string {
	const startIdx = content.indexOf(startMarker);
	if (startIdx !== -1) {
		const endIdx = content.indexOf(endMarker, startIdx);
		if (endIdx !== -1) {
			const replacement = block ? `${block}\n` : '';
			return content.slice(0, startIdx) + replacement + content.slice(endIdx + endMarker.length).replace(/^\n+/, '\n');
		}
	}

	if (startMarker === QUEST_BLOCK_START) {
		const legacyStartIdx = content.indexOf(LEGACY_QUEST_BLOCK_START);
		if (legacyStartIdx !== -1) {
			const endIdx = content.indexOf(endMarker, legacyStartIdx);
			if (endIdx !== -1) {
				const replacement = block ? `${block}\n` : '';
				return content.slice(0, legacyStartIdx) + replacement + content.slice(endIdx + endMarker.length).replace(/^\n+/, '\n');
			}
		}
	}

	if (!block) return content;

	if (beforeMarker && content.includes(beforeMarker)) {
		const beforeIdx = content.indexOf(beforeMarker);
		return content.slice(0, beforeIdx) + `${block}\n\n` + content.slice(beforeIdx);
	}

	if (content.startsWith('---')) {
		const closingIdx = content.indexOf('\n---', 3);
		if (closingIdx !== -1) {
			const afterFront = closingIdx + 4;
			return content.slice(0, afterFront) + `\n\n${block}\n` + content.slice(afterFront);
		}
	}

	return content.length > 0 ? `${block}\n\n${content}` : block;
}

function renderDailyNoteTemplate(template: string, title: string, content: string, todayISO: string): string {
	const safeTemplate = template.trim().length > 0 ? template : '{title}\n{content}';
	return safeTemplate
		.split('{title}').join(title)
		.split('{content}').join(content)
		.split('{date}').join(todayISO);
}

async function buildDailyMessageBlock(plugin: LifequestPlugin, todayISO: string): Promise<string | null> {
	const { dailyMessage, language } = plugin.data.settings;
	if (!dailyMessage.enabled) return null;
	const sourceUrl = resolveDailyMessageSourceUrl(dailyMessage.sourceUrls, language ?? 'es');
	if (!sourceUrl) return null;

	try {
		const response = await requestUrl({ url: sourceUrl, method: 'GET' });
		const entries = parseDailyMessageSource(response.text);
		const message = pickDailyMessage(entries, dailyMessage.mode, todayISO);
		if (!message) return null;
		const authorSuffix = message.author ? ` - ${message.author}` : '';
		return `${MESSAGE_BLOCK_START}\n>[!note] ${message.text}${authorSuffix}\n${MESSAGE_BLOCK_END}`;
	} catch (error) {
		console.error('[LifeQuest] daily message fetch error:', error);
		new Notice(
			language === 'es'
				? 'LifeQuest: No se pudo cargar la frase diaria desde GitHub.'
				: 'LifeQuest: Could not load the daily message from GitHub.',
			4000
		);
		return null;
	}
}

/**
 * Returns true if a quest should appear in today's daily note
 * based on its frequency.
 */
function shouldIncludeToday(quest: Quest, today: string): boolean {
	if (quest.status !== 'active') return false;

	const m = moment(today);
	switch (quest.frequency) {
		case 'daily':
			return true;
		case 'weekly':
			// Only inject on Mondays (is weekday 1)
			return m.isoWeekday() === 1;
		case 'monthly':
			// Only inject on the 1st of the month
			return m.date() === 1;
		case 'free':
			// Never auto-include in Daily Note (Manual only)
			return false;
		default:
			return true;
	}
}

type QuestBlockOptions = {
	groupByArea: boolean;
	onlyPending: boolean;
	template: string;
};

/**
 * Generates the quest block content (lines between markers).
 */
export function buildQuestBlock(data: LifequestData, today: string, options?: Partial<QuestBlockOptions>): string {
	const { quests, activityLog } = data;
	const settings: QuestBlockOptions = {
		groupByArea: data.settings.dailyNoteGroupByArea,
		onlyPending: data.settings.dailyNoteOnlyPending,
		template: data.settings.dailyNoteTemplate,
		...options,
	};
	const logsToday = activityLog.filter((l: LogEntry) =>
		l.timestamp.startsWith(today) &&
		l.type === 'quest_completed'
	);
	let todayQuests = quests.filter((q: Quest) => shouldIncludeToday(q, today));

	if (settings.onlyPending) {
		todayQuests = todayQuests.filter((quest) => !logsToday.some((log) => log.questId === quest.id));
	}

	const title = getDailyQuestHeading(data);
	if (todayQuests.length === 0) {
		const lang = data.settings.language ?? 'es';
		const emptyContent = renderDailyNoteTemplate(settings.template, title, t('daily_note_empty_block', lang), today);
		return `${QUEST_BLOCK_START}\n${emptyContent}\n${QUEST_BLOCK_END}`;
	}

	const renderQuest = (quest: Quest): string => {
		const isDone = logsToday.some((l: LogEntry) => l.questId === quest.id);
		return buildQuestLine(quest, isDone);
	};

	let blockContent = '';
	if (settings.groupByArea) {
		const areaOrder = new Map(data.settings.lifeAreas.map((lifeArea, index) => [lifeArea.id, index]));
		const grouped = new Map<string, Quest[]>();
		for (const quest of todayQuests) {
			const areaQuests = grouped.get(quest.area) ?? [];
			areaQuests.push(quest);
			grouped.set(quest.area, areaQuests);
		}
		blockContent = Array.from(grouped.entries())
			.sort((a, b) => (areaOrder.get(a[0]) ?? Number.MAX_SAFE_INTEGER) - (areaOrder.get(b[0]) ?? Number.MAX_SAFE_INTEGER))
			.map(([areaId, areaQuests]) => {
				const area = data.settings.lifeAreas.find((lifeArea) => lifeArea.id === areaId);
				const heading = `### ${areaEmoji(areaId)} ${area?.name ?? areaId}`;
				const lines = areaQuests.map(renderQuest).join('\n');
				return `${heading}\n${lines}`;
			})
			.join('\n\n');
	} else {
		blockContent = todayQuests.map(renderQuest).join('\n');
	}

	const rendered = renderDailyNoteTemplate(settings.template, title, blockContent, today);
	return `${QUEST_BLOCK_START}\n${rendered}\n${QUEST_BLOCK_END}`;
}

/**
 * Creates or updates today's daily note, injecting the quest block
 * right after the YAML frontmatter (or at the top if none).
 */
export async function generateDailyNote(plugin: LifequestPlugin): Promise<void> {
	const { app, data } = plugin;
	const lang = data.settings.language ?? 'es';

	try {
		const fmt      = data.settings.dailyNoteFormat?.trim() || 'YYYY-MM-DD';
		const now      = moment();
		const today    = now.format(fmt);
		const todayISO = now.format('YYYY-MM-DD');
			const activeQuests = data.quests.filter(q => q.status === 'active');
			const todayQuests = data.quests.filter((quest) => shouldIncludeToday(quest, todayISO));
			const completedToday = data.activityLog.filter((log) =>
				log.timestamp.startsWith(todayISO) &&
				log.type === 'quest_completed'
			);
			if (activeQuests.length === 0) {
				new Notice(t('daily_note_no_quests', lang), 4000);
			}

		let file: TFile | null = null;
		const all = app.vault.getMarkdownFiles();
		file = all.find(f => f.basename === today) ?? null;

		if (!file) {
			try {
				file = await app.vault.create(`${today}.md`, '');
			} catch {
				new Notice(t('daily_note_create_error', lang, { file: `${today}.md` }), 5000);
				return;
			}
		}

		let content = await app.vault.read(file);
		const block = buildQuestBlock(data, todayISO);
		const messageBlock = await buildDailyMessageBlock(plugin, todayISO);

		content = upsertManagedBlock(content, QUEST_BLOCK_START, QUEST_BLOCK_END, block);
		content = upsertManagedBlock(content, MESSAGE_BLOCK_START, MESSAGE_BLOCK_END, messageBlock, QUEST_BLOCK_START);

		await app.vault.modify(file, content);
		await app.workspace.getLeaf(false).openFile(file);

		const questCount = data.settings.dailyNoteOnlyPending
			? todayQuests.filter((quest) => !completedToday.some((log) => log.questId === quest.id)).length
			: todayQuests.length;
		new Notice(
			questCount > 0
				? t('daily_note_injected', lang, { count: questCount })
				: t('daily_note_opened', lang),
			3000
		);

	} catch (err) {
		console.error('[LifeQuest] generateDailyNote error:', err);
		new Notice(t('daily_note_error', lang), 5000);
	}
}


// ─── Checkbox detection ───────────────────────────────────────────────────────

const prevState: Map<string, boolean> = new Map();
const modifyDebounces: Map<string, number> = new Map();

function buildQuestStateKey(filePath: string, questId: string): string {
	return `${filePath}::${questId}`;
}

function normalizeFolderPath(path: string): string {
	return path.trim().replace(/^\/+/, '').replace(/\/+$/, '');
}

function getNormalizedSyncFolders(data: LifequestData): string[] {
	return data.settings.markdownSyncFolders
		.map(normalizeFolderPath)
		.filter((path, index, arr) => path.length > 0 && arr.indexOf(path) === index);
}

function getNormalizedExcludedSyncFolders(data: LifequestData, configDir?: string): string[] {
	return [...INTERNAL_EXCLUDED_FOLDERS, configDir ?? '', ...data.settings.markdownSyncExcludedFolders]
		.map(normalizeFolderPath)
		.filter((path, index, arr) => path.length > 0 && arr.indexOf(path) === index);
}

function isInsideTrackedFolder(filePath: string, folders: string[]): boolean {
	return folders.some((folder) => filePath === folder || filePath.startsWith(`${folder}/`));
}

function isExcludedTrackedPath(filePath: string, data: LifequestData, configDir?: string): boolean {
	return isInsideTrackedFolder(filePath, getNormalizedExcludedSyncFolders(data, configDir));
}

export function shouldTrackMarkdownFile(
	filePath: string,
	fileBasename: string,
	data: LifequestData,
	todayBasename: string,
	configDir?: string
): boolean {
	const scope: MarkdownSyncScope = data.settings.markdownSyncScope ?? 'daily-note';
	if (!filePath.toLowerCase().endsWith('.md')) return false;
	if (isExcludedTrackedPath(filePath, data, configDir)) return false;

	switch (scope) {
		case 'vault':
			return true;
		case 'folders':
			return isInsideTrackedFolder(filePath, getNormalizedSyncFolders(data));
		case 'daily-note':
		default:
			return fileBasename === todayBasename;
	}
}

export function parseQuestStatesFromContent(content: string): Map<string, boolean> {
	const result  = new Map<string, boolean>();
	let match: RegExpExecArray | null;

	QUEST_TAG_REGEX.lastIndex = 0;
	while ((match = QUEST_TAG_REGEX.exec(content)) !== null) {
		const done    = match[1]?.toLowerCase() === 'x';
		const questId = match[2];
		if (questId) result.set(questId, done);
	}

	return result;
}

function restoreTrackedQuestState(data: LifequestData): void {
	prevState.clear();
	const snapshot = data.markdownSyncState?.fileStates ?? {};
	for (const [stateKey, value] of Object.entries(snapshot)) {
		prevState.set(stateKey, value);
	}
}

function persistTrackedQuestState(data: LifequestData, trackedFiles?: TFile[]): boolean {
	const trackedPaths = trackedFiles ? new Set(trackedFiles.map((file) => file.path)) : null;
	const nextState: Record<string, boolean> = {};

	for (const [stateKey, value] of prevState.entries()) {
		if (trackedPaths) {
			const separatorIndex = stateKey.indexOf('::');
			const filePath = separatorIndex === -1 ? '' : stateKey.slice(0, separatorIndex);
			if (!trackedPaths.has(filePath)) continue;
		}
		nextState[stateKey] = value;
	}

	const currentState = data.markdownSyncState?.fileStates ?? {};
	const currentKeys = Object.keys(currentState).sort();
	const nextKeys = Object.keys(nextState).sort();
	const changed = currentKeys.length !== nextKeys.length ||
		currentKeys.some((key, index) => key !== nextKeys[index] || currentState[key] !== nextState[key]);

	if (changed || !data.markdownSyncState) {
		data.markdownSyncState = {
			fileStates: nextState,
			updatedAt: new Date().toISOString()
		};
	}

	return changed;
}

async function parseQuestStates(plugin: LifequestPlugin, file: TFile): Promise<Map<string, boolean>> {
	const content = await plugin.app.vault.read(file);
	return parseQuestStatesFromContent(content);
}

function hasQuestOutcomeLoggedToday(data: LifequestData, questId: string, today: string): boolean {
	return data.activityLog.some((log) =>
		log.questId === questId &&
		(log.type === 'quest_completed' || log.type === 'quest_failed') &&
		log.timestamp.startsWith(today)
	);
}

function applyLevelUpRewards(data: LifequestData, lang: PluginLanguage, prevLevel: number): void {
	if (data.xp.level <= prevLevel) return;

	const title = getLevelTitle(data.xp.level, lang);
	new Notice(t('daily_note_level_up_notice', lang, { label: t('level_up', lang), level: data.xp.level, title }), 5000);
	data.activityLog.push({
		id:          `log-${Date.now()}-lvl`,
		type:        'level_up',
		description: t('daily_note_level_up_log', lang, { label: t('level_up', lang), level: data.xp.level, title }),
		xp:          0,
		timestamp:   new Date().toISOString()
	});

	if (data.settings.coinsEnabled && data.coins) {
		data.coins = earnCoins(
			data.coins,
			'level_up',
			pick(lang, `Nivel ${data.xp.level}`, `Level ${data.xp.level}`),
			{ level: data.xp.level },
			data.settings.rewardSettings
		);
		if (data.settings.rewardSettings.notificationsEnabled) {
			new Notice(t('daily_note_coins_level_up', lang, { amount: calculateCoinReward('level_up', { level: data.xp.level }, data.settings.rewardSettings) }), 3000);
		}
	}
}

function applyEpicQuestReward(data: LifequestData, quest: Quest, isDone: boolean, lang: PluginLanguage): void {
	if (!(isDone && quest.difficulty === 'epic' && data.settings.coinsEnabled && data.coins)) return;

	data.coins = earnCoins(data.coins, 'epic_quest', quest.title, {}, data.settings.rewardSettings);
	if (data.settings.rewardSettings.notificationsEnabled) {
		new Notice(t('daily_note_coins_epic', lang, { amount: calculateCoinReward('epic_quest', {}, data.settings.rewardSettings) }), 2000);
	}
}

function applyBadgeRewards(data: LifequestData, lang: PluginLanguage): void {
	const newBadges = checkBadges(data);
	for (const badge of newBadges) {
		data.badges.push(badge);
		data.activityLog.push({
			id:          `log-${Date.now()}-badge`,
			type:        'badge_unlocked',
			description: `🏅 ${badge.name}`,
			xp:          badge.xpBonus,
			timestamp:   new Date().toISOString()
		});
		new Notice(t('daily_note_badge_notice', lang, { label: t('badge_unlocked', lang), name: badge.name }), 4000);

		if (data.settings.coinsEnabled && data.coins) {
			const reason = badge.description.toLowerCase().includes('epic') ? 'badge_epic' : 'badge_common';
			data.coins = earnCoins(data.coins, reason, badge.name, {}, data.settings.rewardSettings);
		}
	}
}

function applyStreakMilestoneRewards(data: LifequestData, lang: PluginLanguage, oldStreak: number): void {
	if (!(data.settings.coinsEnabled && data.coins && data.streak.current > oldStreak)) return;

	const days = data.streak.current;
	if (days === 7 || days === 30 || days === 100) {
		data.coins = earnCoins(
			data.coins,
			'streak_milestone',
			pick(lang, `${days} días`, `${days} days`),
			{ streakDays: days },
			data.settings.rewardSettings
		);
		if (data.settings.rewardSettings.notificationsEnabled) {
			new Notice(t('daily_note_coins_streak', lang, { amount: calculateCoinReward('streak_milestone', { streakDays: days }, data.settings.rewardSettings) }), 4000);
		}
	}
}

function applyQuestOutcome(
	data: LifequestData,
	quest: Quest,
	questId: string,
	isDone: boolean,
	lang: PluginLanguage,
	description: string
): boolean {
	const today = moment().format('YYYY-MM-DD');
	if (hasQuestOutcomeLoggedToday(data, questId, today)) return false;

	const xpDelta   = calculateXP(quest, isDone, data);
	const prevLevel = calculateLevel(data.xp.total, data.settings.xpPerLevel);

	data.xp.total = Math.max(0, data.xp.total + xpDelta);
	data.xp.todayGained += xpDelta;
	data.xp.level = calculateLevel(data.xp.total, data.settings.xpPerLevel);

	data.activityLog.push({
		id:          `log-${Date.now()}-${Math.random().toString(36).slice(2)}`,
		type:        isDone ? 'quest_completed' : 'quest_failed',
		description,
		xp:          xpDelta,
		questId,
		timestamp:   new Date().toISOString()
	});

	const xpLabel = xpDelta >= 0 ? `+${xpDelta} XP` : `${xpDelta} XP`;
	const statusText = isDone ? t('quest_completed', lang) : t('quest_failed', lang);
	new Notice(t('daily_note_status_xp', lang, { status: statusText, quest: quest.title, xp: xpLabel }), 3000);

	applyLevelUpRewards(data, lang, prevLevel);
	applyEpicQuestReward(data, quest, isDone, lang);

	return true;
}

async function processQuestDiff(
	plugin: LifequestPlugin,
	file: TFile,
	current: Map<string, boolean>
): Promise<void> {
	const { data, store } = plugin;
	const lang   = data.settings.language ?? 'es';
	const today  = moment().format('YYYY-MM-DD');
	let   dirty  = false;

	if (data.xp.todayDate !== today) {
		data.xp.todayGained = 0;
		data.xp.todayDate   = today;
	}

	for (const [questId, isDone] of current) {
		const stateKey = buildQuestStateKey(file.path, questId);
		const wasDone = prevState.get(stateKey);
		
		// If it's a new quest matching (discovery), don't trigger anything unless it was already marked as done
		if (wasDone === undefined && isDone === false) {
			prevState.set(stateKey, false);
			continue;
		}

		if (wasDone === isDone) continue;

		const quest = data.quests.find(q => q.id === questId);
		if (!quest) continue;

		dirty = applyQuestOutcome(data, quest, questId, isDone, lang, `${isDone ? '✅' : '❌'} ${quest.title}`) || dirty;
	}

	// Update in-memory state
	for (const [questId, isDone] of current) {
		prevState.set(buildQuestStateKey(file.path, questId), isDone);
	}

	const snapshotChanged = persistTrackedQuestState(data);
	if (!dirty) {
		if (snapshotChanged) {
			await store.save(data);
		}
		return;
	}

	// Proper Streak Update: Streak only increments if at least one quest is completed today
	const hadActivity = Array.from(current.values()).some(v => v === true);
	const oldStreak = data.streak.current;
	data.streak = updateStreak(data.streak, today, hadActivity);
	applyStreakMilestoneRewards(data, lang, oldStreak);

	// Badge check
	applyBadgeRewards(data, lang);

	persistTrackedQuestState(data);
	await store.save(data);
	
	// Explicitly refresh dashboard if open
	plugin.getDashboardView()?.scheduleRefresh();
}

function getTrackedMarkdownFiles(plugin: LifequestPlugin): TFile[] {
	const fmt = plugin.data.settings.dailyNoteFormat?.trim() || 'YYYY-MM-DD';
		const todayStr = moment().format(fmt);

	return plugin.app.vault
		.getMarkdownFiles()
		.filter((file) => shouldTrackMarkdownFile(file.path, file.basename, plugin.data, todayStr, plugin.app.vault.configDir));
}

export async function refreshTrackedQuestState(plugin: LifequestPlugin): Promise<void> {
	restoreTrackedQuestState(plugin.data);
	await syncTrackedQuestFiles(plugin);
}

export function initDailyNoteIntegration(plugin: LifequestPlugin): void {
	restoreTrackedQuestState(plugin.data);

	// Check for penalties from yesterday (Failed at midnight)
	void checkPreviousDayPenalties(plugin);

	// Startup sync for tracked markdown files (detects checks made while plugin was off)
	void syncTrackedQuestFiles(plugin);

	plugin.registerEvent(
		plugin.app.vault.on('modify', (file) => {
			if (!(file instanceof TFile)) return;
			const fmt      = plugin.data.settings.dailyNoteFormat?.trim() || 'YYYY-MM-DD';
			const todayStr = moment().format(fmt);
			if (!shouldTrackMarkdownFile(file.path, file.basename, plugin.data, todayStr, plugin.app.vault.configDir)) return;

			const existingDebounce = modifyDebounces.get(file.path);
			if (existingDebounce) window.clearTimeout(existingDebounce);
			const timeoutId = window.setTimeout(() => {
				modifyDebounces.delete(file.path);
				void (async () => {
					const current = await parseQuestStates(plugin, file);
					await processQuestDiff(plugin, file, current);
				})();
			}, 500);
			modifyDebounces.set(file.path, timeoutId);
		})
	);
}

/**
 * Scans today's daily note and compares with logs.
 * Awards XP for any completed quest that hasn't been logged yet today.
 */
export async function syncTrackedQuestFiles(plugin: LifequestPlugin) {
	const { data } = plugin;
	const todayISO = moment().format('YYYY-MM-DD');
	const trackedFiles = getTrackedMarkdownFiles(plugin);
	if (trackedFiles.length === 0) {
		const snapshotChanged = persistTrackedQuestState(data, trackedFiles);
		if (snapshotChanged) {
			await plugin.store.save(data);
		}
		return;
	}

	const completedQuestIds = new Set<string>();
	for (const file of trackedFiles) {
		const states = await parseQuestStates(plugin, file);
		for (const [questId, isDone] of states) {
			prevState.set(buildQuestStateKey(file.path, questId), isDone);
			if (isDone) completedQuestIds.add(questId);
		}
	}

	if (completedQuestIds.size === 0) {
		const snapshotChanged = persistTrackedQuestState(data, trackedFiles);
		if (snapshotChanged) {
			await plugin.store.save(data);
		}
		return;
	}

	const logsToday = data.activityLog.filter(l => l.timestamp.startsWith(todayISO));
	let awardedCount = 0;
	let dirty = false;

	for (const questId of completedQuestIds) {
		const alreadyLogged = logsToday.some(l => l.questId === questId && l.type === 'quest_completed');
		if (!alreadyLogged) {
			const quest = data.quests.find(q => q.id === questId);
			if (quest) {
				if (data.xp.todayDate !== todayISO) {
					data.xp.todayGained = 0;
					data.xp.todayDate = todayISO;
				}

				const applied = applyQuestOutcome(
					data,
					quest,
					questId,
					true,
					data.settings.language ?? 'es',
					t('daily_note_synced_desc', data.settings.language ?? 'es', { quest: quest.title })
				);
				if (applied) {
					awardedCount++;
					dirty = true;
				}
			}
		}
	}

	if (dirty) {
		const oldStreak = data.streak.current;
		data.streak = updateStreak(data.streak, todayISO, true);
		applyStreakMilestoneRewards(data, data.settings.language ?? 'es', oldStreak);
		applyBadgeRewards(data, data.settings.language ?? 'es');
	}

	if (awardedCount > 0) {
		const lang = data.settings.language ?? 'es';
		new Notice(t('daily_note_synced', lang, { count: awardedCount }), 4000);
	}

	const snapshotChanged = persistTrackedQuestState(data, trackedFiles);
	if (awardedCount > 0 || snapshotChanged) {
		await plugin.store.save(data);
		plugin.getDashboardView()?.scheduleRefresh();
	}
}

async function checkPreviousDayPenalties(plugin: LifequestPlugin) {
	const { data, store } = plugin;
	const todayStr = moment().format('YYYY-MM-DD');
	if (data.lastPenaltyCheck === todayStr) return; 

	const yesterdayDate = moment().subtract(1, 'day');
	const yesterdayFmt  = yesterdayDate.format(data.settings.dailyNoteFormat || 'YYYY-MM-DD');
	
	const file = plugin.app.vault.getMarkdownFiles().find(f => f.basename === yesterdayFmt);
	if (!file) {
		data.lastPenaltyCheck = todayStr;
		await store.save(data);
		return;
	}

	const states = await parseQuestStates(plugin, file);
	let dirty = false;
	const lang = data.settings.language ?? 'es';

	const yesterdayStart = yesterdayDate.startOf('day').toISOString();
	const yesterdayEnd   = yesterdayDate.endOf('day').toISOString();

	for (const [questId, isDone] of states) {
		if (!isDone) {
			const quest = data.quests.find(q => q.id === questId);
			if (quest && quest.penalty > 0) {
				const alreadyRecorded = data.activityLog.some(l => 
					l.questId === questId && 
					(l.type === 'quest_failed' || l.type === 'quest_completed') &&
					l.timestamp >= yesterdayStart && l.timestamp <= yesterdayEnd
				);

				if (!alreadyRecorded) {
					// Apply penalty as defined in engine (negating penalty)
					const xpDelta = -quest.penalty; 
					data.xp.total = Math.max(0, data.xp.total + xpDelta);
					
					data.activityLog.push({
						id:          `penalty-${Date.now()}-${questId}`,
						type:        'quest_failed',
						description: `❌ ${quest.title} (${t('quest_failed', lang)})`,
						xp:          xpDelta,
						questId,
						timestamp:   yesterdayDate.endOf('day').toISOString()
					});
					dirty = true;
				}
			}
		}
	}

	data.lastPenaltyCheck = todayStr;
	if (dirty) {
		new Notice(t('daily_note_penalties_applied', lang), 6000);
		await store.save(data);
		plugin.getDashboardView()?.scheduleRefresh();
	} else {
		await store.save(data);
	}
}
