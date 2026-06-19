import { TFile, Notice, moment, requestUrl } from 'obsidian';
import type LifequestPlugin from './main';
import { Quest, LifequestData, LogEntry } from './types';
import {
	calculateXP,
	calculateLevel,
	updateStreak,
	checkBadges,
	getLevelTitle,
	earnCoins,
	calculateCoinReward
} from './engine';
import { t } from './i18n';
import { parseDailyMessageSource, pickDailyMessage, resolveDailyMessageSourceUrl } from './daily-message';

// ─── Constants ────────────────────────────────────────────────────────────────

const QUEST_BLOCK_START = '## Quests del día';
const QUEST_BLOCK_END   = '<!-- /lifequest -->';
const MESSAGE_BLOCK_START = '<!-- lifequest-message:start -->';
const MESSAGE_BLOCK_END = '<!-- /lifequest-message -->';
const QUEST_TAG_REGEX   = /- \[( |x)\] .+ #lq-([a-f0-9-]+)/g;

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

/**
 * Generates the quest block content (lines between markers).
 */
function buildQuestBlock(data: LifequestData, today: string): string {
	const { quests, activityLog } = data;
	const todayQuests = quests.filter((q: Quest) => shouldIncludeToday(q, today));

	if (todayQuests.length === 0) {
		const lang = data.settings.language ?? 'es';
		return `${QUEST_BLOCK_START}\n${t('daily_note_empty_block', lang)}\n${QUEST_BLOCK_END}`;
	}

	const logsToday = activityLog.filter((l: LogEntry) => 
		l.timestamp.startsWith(today) && 
		l.type === 'quest_completed'
	);

	const lines = todayQuests.map((q: Quest) => {
		const isDone = logsToday.some((l: LogEntry) => l.questId === q.id);
		return buildQuestLine(q, isDone);
	}).join('\n');

	return `${QUEST_BLOCK_START}\n${lines}\n${QUEST_BLOCK_END}`;
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

		const questCount = activeQuests.length;
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
let modifyDebounce: ReturnType<typeof setTimeout> | null = null;

async function parseQuestStates(plugin: LifequestPlugin, file: TFile): Promise<Map<string, boolean>> {
	const content = await plugin.app.vault.read(file);
	const result  = new Map<string, boolean>();
	let match: RegExpExecArray | null;

	QUEST_TAG_REGEX.lastIndex = 0;
	while ((match = QUEST_TAG_REGEX.exec(content)) !== null) {
		const done    = match[1] === 'x';
		const questId = match[2];
		if (questId) result.set(questId, done);
	}
	return result;
}

async function processQuestDiff(
	plugin: LifequestPlugin,
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
		const wasDone = prevState.get(questId);
		
		// If it's a new quest matching (discovery), don't trigger anything unless it was already marked as done
		if (wasDone === undefined && isDone === false) {
			prevState.set(questId, false);
			continue;
		}

		if (wasDone === isDone) continue;

		const quest = data.quests.find(q => q.id === questId);
		if (!quest) continue;

		const xpDelta   = calculateXP(quest, isDone, data);
		const prevLevel = calculateLevel(data.xp.total, data.settings.xpPerLevel);
		
		data.xp.total      = Math.max(0, data.xp.total + xpDelta);
		data.xp.todayGained += xpDelta;
		data.xp.level       = calculateLevel(data.xp.total, data.settings.xpPerLevel);

		data.activityLog.push({
			id:          `log-${Date.now()}-${Math.random().toString(36).slice(2)}`,
			type:        isDone ? 'quest_completed' : 'quest_failed',
			description: `${isDone ? '✅' : '❌'} ${quest.title}`,
			xp:          xpDelta,
			questId,
			timestamp:   new Date().toISOString()
		});

		const xpLabel = xpDelta >= 0 ? `+${xpDelta} XP` : `${xpDelta} XP`;
		const statusText = isDone ? t('quest_completed', lang) : t('quest_failed', lang);
		new Notice(t('daily_note_status_xp', lang, { status: statusText, quest: quest.title, xp: xpLabel }), 3000);

		if (data.xp.level > prevLevel) {
			const title = getLevelTitle(data.xp.level, lang);
			new Notice(t('daily_note_level_up_notice', lang, { label: t('level_up', lang), level: data.xp.level, title }), 5000);
			data.activityLog.push({
				id:          `log-${Date.now()}-lvl`,
				type:        'level_up',
				description: t('daily_note_level_up_log', lang, { label: t('level_up', lang), level: data.xp.level, title }),
				xp:          0,
				timestamp:   new Date().toISOString()
			});

			// 🪙 Coins for Level Up
			if (data.settings.coinsEnabled && data.coins) {
				data.coins = earnCoins(data.coins, 'level_up', `Nivel ${data.xp.level}`, { level: data.xp.level }, data.settings.rewardSettings);
				if (data.settings.rewardSettings.notificationsEnabled) {
					new Notice(t('daily_note_coins_level_up', lang, { amount: calculateCoinReward('level_up', { level: data.xp.level }, data.settings.rewardSettings) }), 3000);
				}
			}
		}

		// 🪙 Coins for Epic Quest
		if (isDone && quest.difficulty === 'epic' && data.settings.coinsEnabled && data.coins) {
			data.coins = earnCoins(data.coins, 'epic_quest', quest.title, {}, data.settings.rewardSettings);
			if (data.settings.rewardSettings.notificationsEnabled) {
				new Notice(t('daily_note_coins_epic', lang, { amount: calculateCoinReward('epic_quest', {}, data.settings.rewardSettings) }), 2000);
			}
		}
		dirty = true;
	}

	// Update in-memory state
	for (const [k, v] of current) prevState.set(k, v);

	if (!dirty) return;

	// Proper Streak Update: Streak only increments if at least one quest is completed today
	const hadActivity = Array.from(current.values()).some(v => v === true);
	const oldStreak = data.streak.current;
	data.streak = updateStreak(data.streak, today, hadActivity);

	// 🪙 Coins for Streak Milestone (7, 30, 100)
	if (data.settings.coinsEnabled && data.streak.current > oldStreak && data.coins) {
		const days = data.streak.current;
		if (days === 7 || days === 30 || days === 100) {
			data.coins = earnCoins(data.coins, 'streak_milestone', `${days} días`, { streakDays: days }, data.settings.rewardSettings);
			if (data.settings.rewardSettings.notificationsEnabled) {
				new Notice(t('daily_note_coins_streak', lang, { amount: calculateCoinReward('streak_milestone', { streakDays: days }, data.settings.rewardSettings) }), 4000);
			}
		}
	}

	// Badge check
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

		// 🪙 Coins for Badges
		if (data.settings.coinsEnabled && data.coins) {
			const reason = badge.description.toLowerCase().includes('epic') ? 'badge_epic' : 'badge_common';
			data.coins = earnCoins(data.coins, reason, badge.name, {}, data.settings.rewardSettings);
		}
	}

	await store.save(data);
	
	// Explicitly refresh dashboard if open
	plugin.getDashboardView()?.scheduleRefresh();
}

export function initDailyNoteIntegration(plugin: LifequestPlugin): void {
	// Check for penalties from yesterday (Failed at midnight)
	void checkPreviousDayPenalties(plugin);

	// Startup Sync for today's note (detects checks made while plugin was off)
	void syncTodayQuests(plugin);

	plugin.registerEvent(
		plugin.app.vault.on('modify', (file) => {
			if (!(file instanceof TFile)) return;
			const fmt      = plugin.data.settings.dailyNoteFormat?.trim() || 'YYYY-MM-DD';
			const todayStr = moment().format(fmt);
			if (file.basename !== todayStr) return;

			if (modifyDebounce) clearTimeout(modifyDebounce);
			modifyDebounce = setTimeout(() => {
				modifyDebounce = null;
				void (async () => {
					const current = await parseQuestStates(plugin, file);
					await processQuestDiff(plugin, current);
				})();
			}, 500);
		})
	);
}

/**
 * Scans today's daily note and compares with logs.
 * Awards XP for any completed quest that hasn't been logged yet today.
 */
async function syncTodayQuests(plugin: LifequestPlugin) {
	const { data, app } = plugin;
	const fmt = data.settings.dailyNoteFormat || 'YYYY-MM-DD';
	const today = moment().format(fmt);
	const todayISO = moment().format('YYYY-MM-DD');
	
	const file = app.vault.getMarkdownFiles().find(f => f.basename === today);
	if (!file) return;

	const states = await parseQuestStates(plugin, file);
	
	// Populate prevState to prevent double-processing in the modify listener
	for (const [k, v] of states) prevState.set(k, v);

	const completedInFile = Array.from(states.entries()).filter(([, done]) => done);
	if (completedInFile.length === 0) return;

	const logsToday = data.activityLog.filter(l => l.timestamp.startsWith(todayISO));
	let awardedCount = 0;

	for (const [questId] of completedInFile) {
		const alreadyLogged = logsToday.some(l => l.questId === questId && l.type === 'quest_completed');
		if (!alreadyLogged) {
			const quest = data.quests.find(q => q.id === questId);
			if (quest) {
				const xpDelta = calculateXP(quest, true, data);
				data.xp.total += xpDelta;
				if (data.xp.todayDate === todayISO) {
					data.xp.todayGained += xpDelta;
				} else {
					data.xp.todayGained = xpDelta;
					data.xp.todayDate = todayISO;
				}
				
				data.activityLog.push({
					id: `sync-${Date.now()}-${questId}`,
					type: 'quest_completed',
					description: t('daily_note_synced_desc', data.settings.language ?? 'es', { quest: quest.title }),
					xp: xpDelta,
					questId,
					timestamp: new Date().toISOString()
				});
				awardedCount++;
			}
		}
	}

	if (awardedCount > 0) {
		const lang = data.settings.language ?? 'es';
		new Notice(t('daily_note_synced', lang, { count: awardedCount }), 4000);
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
