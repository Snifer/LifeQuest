import { Notice } from 'obsidian';
import type { LifequestData, LogEntry, Quest } from '../types';
import {
	calculateCoinReward,
	calculateLevel,
	calculateXP,
	checkBadges,
	earnCoins,
	getLevelTitle,
	updateStreak,
} from '../engine';
import { pick, t } from '../i18n';
import { getParentAutoCompleteCandidate } from './quest-hierarchy';
import { moment } from '../obsidian-moment';

export type QuestStatus = 'done' | 'failed' | 'pending';

type PluginLanguage = LifequestData['settings']['language'];

function isQuestOutcomeLog(log: LogEntry): boolean {
	return log.type === 'quest_completed' || log.type === 'quest_failed';
}

function isAutoParentLog(log: LogEntry): boolean {
	return log.id.startsWith('auto-parent-') || log.description.includes('(Auto parent)') || log.description.includes('(Auto padre)');
}

export function getQuestStatusToday(questId: string, logs: LogEntry[], dayPrefix = moment().format('YYYY-MM-DD')): QuestStatus {
	const todayLogs = logs.filter((log) => log.questId === questId && log.timestamp.startsWith(dayPrefix));
	if (todayLogs.some((log) => log.type === 'quest_completed')) return 'done';
	if (todayLogs.some((log) => log.type === 'quest_failed')) return 'failed';
	return 'pending';
}

function removeQuestOutcomeLogs(
	data: LifequestData,
	questId: string,
	dayPrefix: string,
	mode: 'all' | 'auto-parent-only' = 'all'
): number {
	let xpToRevert = 0;

	data.activityLog = data.activityLog.filter((log) => {
		const shouldMatch =
			log.questId === questId &&
			log.timestamp.startsWith(dayPrefix) &&
			isQuestOutcomeLog(log) &&
			(mode === 'all' || isAutoParentLog(log));

		if (!shouldMatch) {
			return true;
		}

		xpToRevert += log.xp;
		return false;
	});

	data.xp.total = Math.max(0, data.xp.total - xpToRevert);
	if (data.xp.todayDate === dayPrefix) {
		data.xp.todayGained = Math.max(0, data.xp.todayGained - xpToRevert);
	}

	return xpToRevert;
}

function applyLevelUpRewards(data: LifequestData, lang: PluginLanguage, previousLevel: number): void {
	if (data.xp.level <= previousLevel) return;

	const title = getLevelTitle(data.xp.level, lang);
	new Notice(t('daily_note_level_up_notice', lang, { level: data.xp.level, title }));

	if (!(data.settings.coinsEnabled && data.coins)) return;

	data.coins = earnCoins(
		data.coins,
		'level_up',
		pick(lang, `Nivel ${data.xp.level}`, `Level ${data.xp.level}`),
		{ level: data.xp.level },
		data.settings.rewardSettings
	);

	if (data.settings.rewardSettings.notificationsEnabled) {
		new Notice(t('daily_note_coins_level_up', lang, {
			coins: calculateCoinReward('level_up', { level: data.xp.level }, data.settings.rewardSettings),
		}), 3000);
	}
}

function applyEpicQuestReward(data: LifequestData, quest: Quest): void {
	if (!(data.settings.coinsEnabled && data.coins)) return;
	if (quest.difficulty !== 'epic') return;

	data.coins = earnCoins(data.coins, 'epic_quest', quest.title, {}, data.settings.rewardSettings);
}

function applyQuestOutcome(
	data: LifequestData,
	quest: Quest,
	targetStatus: Exclude<QuestStatus, 'pending'>,
	lang: PluginLanguage,
	description: string,
	idPrefix = 'man'
): void {
	const isDone = targetStatus === 'done';
	const xpDelta = calculateXP(quest, isDone, data);
	const previousLevel = calculateLevel(data.xp.total, data.settings.xpPerLevel);

	data.xp.total = Math.max(0, data.xp.total + xpDelta);
	if (data.xp.todayDate === todayStr()) {
		data.xp.todayGained += xpDelta;
	} else {
		data.xp.todayDate = todayStr();
		data.xp.todayGained = xpDelta;
	}
	data.xp.level = calculateLevel(data.xp.total, data.settings.xpPerLevel);

	data.activityLog.push({
		id: `${idPrefix}-${Date.now()}-${quest.id}`,
		type: isDone ? 'quest_completed' : 'quest_failed',
		description,
		xp: xpDelta,
		questId: quest.id,
		timestamp: new Date().toISOString(),
	});

	applyLevelUpRewards(data, lang, previousLevel);
	if (isDone) {
		applyEpicQuestReward(data, quest);
	}
}

function syncParentAutoCompletion(data: LifequestData, quest: Quest, lang: PluginLanguage): void {
	if (!data.settings.autoCompleteParentQuests || !quest.parentQuestId) {
		return;
	}

	const dayPrefix = todayStr();
	const parent = data.quests.find((item) => item.id === quest.parentQuestId);
	if (!parent || parent.status !== 'active') {
		return;
	}

	const parentStatus = getQuestStatusToday(parent.id, data.activityLog, dayPrefix);
	const hasAutoParentLog = data.activityLog.some((log) =>
		log.questId === parent.id &&
		log.type === 'quest_completed' &&
		log.timestamp.startsWith(dayPrefix) &&
		isAutoParentLog(log)
	);

	if (parentStatus === 'done' && !hasAutoParentLog) {
		return;
	}

	if (parentStatus === 'failed') {
		return;
	}

	const eligibleParent = getParentAutoCompleteCandidate(quest, data.quests, data.activityLog, dayPrefix);
	if (!eligibleParent) {
		if (hasAutoParentLog) {
			removeQuestOutcomeLogs(data, parent.id, dayPrefix, 'auto-parent-only');
		}
		return;
	}

	if (parentStatus === 'pending') {
		applyQuestOutcome(
			data,
			parent,
			'done',
			lang,
			`${pick(lang, '✅', '✅')} ${parent.title} (${pick(lang, 'Auto padre', 'Auto parent')})`,
			'auto-parent'
		);
	}
}

function applyBadges(data: LifequestData, lang: PluginLanguage): void {
	const newBadges = checkBadges(data);
	newBadges.forEach((badge) => {
		data.badges.push(badge);
		new Notice(t('daily_note_badge_notice', lang, { name: badge.name }));
	});
}

function todayStr(): string {
	return moment().format('YYYY-MM-DD');
}

export function setQuestStatusForToday(
	data: LifequestData,
	quest: Quest,
	targetStatus: QuestStatus,
	lang: PluginLanguage
): boolean {
	const dayPrefix = todayStr();
	const currentStatus = getQuestStatusToday(quest.id, data.activityLog, dayPrefix);

	if (currentStatus === targetStatus) {
		return false;
	}

	if (data.xp.todayDate !== dayPrefix) {
		data.xp.todayDate = dayPrefix;
		data.xp.todayGained = 0;
	}

	removeQuestOutcomeLogs(data, quest.id, dayPrefix);

	if (targetStatus !== 'pending') {
		applyQuestOutcome(
			data,
			quest,
			targetStatus,
			lang,
			`${targetStatus === 'done' ? '✅' : '❌'} ${quest.title} (Manual)`
		);
	}

	syncParentAutoCompletion(data, quest, lang);

	const hasCompletedQuestToday = data.activityLog.some((log) =>
		log.timestamp.startsWith(dayPrefix) && log.type === 'quest_completed'
	);
	data.streak = updateStreak(data.streak, dayPrefix, hasCompletedQuestToday);
	applyBadges(data, lang);

	return true;
}
