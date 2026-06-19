import { 
	LifequestData, Quest, StreakState, Badge, LogEntry, 
	WeeklyStats, Insight, AdjustmentSuggestion, QuestStat, AreaStat, HeroClass,
	CoinState, CoinEarnReason, ShopReward, CoinEntry, RewardSettings
} from './types';
import { t, SupportedLanguage } from './i18n';

// XP functions
export function getStreakMultiplier(streakDays: number): 1.0 | 1.5 | 2.0 {
	if (streakDays < 7) return 1.0;
	if (streakDays < 30) return 1.5;
	return 2.0;
}

export function getClassBonus(quest: Quest, classId: string, heroClasses: HeroClass[]): number {
	const hClass = heroClasses.find(c => c.id === classId);
	if (hClass && hClass.bonusAreaId === quest.area) {
		return Math.round(quest.xp * 0.20);
	}
	return 0;
}

export function calculateXP(quest: Quest, completed: boolean, data: LifequestData): number {
	const base = completed ? quest.xp : -quest.penalty;
	const bonus = completed ? getClassBonus(quest, data.profile.classId, data.settings.heroClasses) : 0;
	const multiplier = getStreakMultiplier(data.streak.current);
	return Math.round((base + bonus) * multiplier);
}

/**
 * Calcula el nivel basado en el XP acumulado.
 * Nivel = 1 + floor(XP / xpPerLevel)
 */
export function calculateLevel(totalXP: number, xpPerLevel = 500): number {
	if (totalXP <= 0) return 1;
	const lvl = 1 + Math.floor(totalXP / xpPerLevel);
	return Math.min(lvl, 100); // Cap at 100
}

/**
 * Calcula cuánto XP falta para el siguiente nivel.
 */
export function getXPToNextLevel(totalXP: number, xpPerLevel = 500): number {
	if (totalXP < 0) return xpPerLevel;
	if (calculateLevel(totalXP, xpPerLevel) >= 100) return 0;
	
	const progress = totalXP % xpPerLevel;
	return progress === 0 ? xpPerLevel : xpPerLevel - progress;
}

export function getLevelTitle(level: number, lang: SupportedLanguage = 'es'): string {
	if (level <= 2) return t('level_1', lang);
	if (level <= 5) return t('level_3', lang);
	if (level <= 9) return t('level_6', lang);
	if (level <= 14) return t('level_10', lang);
	if (level <= 24) return t('level_15', lang);
	if (level <= 49) return t('level_25', lang);
	if (level <= 99) return t('level_50', lang);
	return t('level_100', lang);
}

// Streak functions
export function getYesterday(dateISO: string): string {
	const date = new Date(dateISO);
	date.setDate(date.getDate() - 1);
	// Non-null assertion safe: toISOString always returns a valid string
	return date.toISOString().split('T')[0] as string;
}

export function updateStreak(streak: StreakState, today: string, hadActivity: boolean): StreakState {
	const yesterday = getYesterday(today);

	if (hadActivity) {
		if (streak.lastActiveDate === yesterday) {
			const newCurrent = streak.current + 1;
			return {
				current: newCurrent,
				longest: Math.max(streak.longest, newCurrent),
				lastActiveDate: today
			};
		} else if (streak.lastActiveDate !== today) {
			return {
				current: 1,
				longest: Math.max(streak.longest, 1),
				lastActiveDate: today
			};
		}
		return { ...streak };
	} else {
		if (streak.lastActiveDate < yesterday) {
			return { ...streak, current: 0 };
		}
		return { ...streak };
	}
}

// Stats & Insights
export function generateDayStats(logs: LogEntry[], date: string) {
	const dayLogs = logs.filter(l => l.timestamp.startsWith(date));
	let xpTotal = 0;
	let completed = 0;
	let failed = 0;

	for (const log of dayLogs) {
		xpTotal += log.xp;
		if (log.type === 'quest_completed') completed++;
		if (log.type === 'quest_failed') failed++;
	}

	const total = completed + failed;
	const successRate = total === 0 ? 0 : Math.round((completed / total) * 100);
	return { xpTotal, completed, failed, successRate };
}

export interface XPChartBucket {
	key: string;
	value: number;
	state: 'past' | 'current' | 'future' | 'neutral';
}

function parseDateOnly(dateISO: string): Date {
	const [year, month, day] = dateISO.split('-').map(Number);
	return new Date(year || 1970, (month || 1) - 1, day || 1, 12, 0, 0, 0);
}

function formatDateOnly(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

function formatMonthKey(date: Date): string {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function startOfISOWeek(date: Date): Date {
	const copy = new Date(date);
	const day = copy.getDay() || 7;
	copy.setDate(copy.getDate() - day + 1);
	copy.setHours(12, 0, 0, 0);
	return copy;
}

function addDays(date: Date, days: number): Date {
	const copy = new Date(date);
	copy.setDate(copy.getDate() + days);
	return copy;
}

function addMonths(date: Date, months: number): Date {
	const copy = new Date(date);
	copy.setMonth(copy.getMonth() + months, 1);
	return copy;
}

export function generateXPChartBuckets(
	logs: LogEntry[],
	period: 'week' | 'month' | 'all',
	referenceDateISO = formatDateOnly(new Date())
): XPChartBucket[] {
	const referenceDate = parseDateOnly(referenceDateISO);

	if (period === 'week') {
		const start = startOfISOWeek(referenceDate);
		const todayIndex = (referenceDate.getDay() || 7) - 1;
		return Array.from({ length: 7 }, (_, index) => {
			const day = addDays(start, index);
			const key = formatDateOnly(day);
			return {
				key,
				value: Math.max(0, generateDayStats(logs, key).xpTotal),
				state: index < todayIndex ? 'past' : index === todayIndex ? 'current' : 'future',
			};
		});
	}

	if (period === 'month') {
		const year = referenceDate.getFullYear();
		const month = referenceDate.getMonth();
		const lastDay = new Date(year, month + 1, 0).getDate();
		const todayDay = referenceDate.getDate();
		return Array.from({ length: lastDay }, (_, index) => {
			const dayNumber = index + 1;
			const day = new Date(year, month, dayNumber, 12, 0, 0, 0);
			const key = formatDateOnly(day);
			return {
				key,
				value: Math.max(0, generateDayStats(logs, key).xpTotal),
				state: dayNumber < todayDay ? 'past' : dayNumber === todayDay ? 'current' : 'future',
			};
		});
	}

	const monthTotals = new Map<string, number>();
	for (const log of logs) {
		const key = log.timestamp.slice(0, 7);
		monthTotals.set(key, (monthTotals.get(key) || 0) + log.xp);
	}

	const earliestLog = logs
		.map((log) => log.timestamp.slice(0, 10))
		.sort()[0];
	const start = earliestLog ? parseDateOnly(`${earliestLog.slice(0, 7)}-01`) : new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1, 12, 0, 0, 0);
	const end = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1, 12, 0, 0, 0);

	const buckets: XPChartBucket[] = [];
	for (let cursor = new Date(start); cursor <= end; cursor = addMonths(cursor, 1)) {
		const key = formatMonthKey(cursor);
		buckets.push({
			key,
			value: Math.max(0, monthTotals.get(key) || 0),
			state: key === formatMonthKey(end) ? 'current' : 'neutral',
		});
	}

	return buckets;
}

export function suggestQuestAdjustment(questStat: QuestStat, prevWeekStat: QuestStat | null): AdjustmentSuggestion {
	const current = questStat.successRate;
	const prev = prevWeekStat ? prevWeekStat.successRate : current;
	if (current === 100 && prev >= 90) return 'increase_difficulty';
	if (current >= 67) return 'maintain';
	if (current >= 40) return 'review_goal';
	return 'adjust_or_pause';
}

export function generateWeekStats(logs: LogEntry[], quests: Quest[], weekStart: string): WeeklyStats {
	const startDate = new Date(weekStart);

	const xpByDay: number[] = [0, 0, 0, 0, 0, 0, 0];
	let completed = 0;
	let failed = 0;
	let xpTotal = 0;

	const dates: string[] = [];
	for (let i = 0; i < 7; i++) {
		const d = new Date(startDate);
		d.setDate(d.getDate() + i);
		const iso = d.toISOString().split('T')[0];
		dates.push(iso as string);
	}

	const weekLogs = logs.filter(log => dates.some(d => log.timestamp.startsWith(d)));

	for (const log of weekLogs) {
		xpTotal += log.xp;
		if (log.type === 'quest_completed') completed++;
		if (log.type === 'quest_failed') failed++;

		const idx = dates.findIndex(d => log.timestamp.startsWith(d));
		if (idx !== -1) {
			xpByDay[idx] = (xpByDay[idx] ?? 0) + log.xp;
		}
	}

	const total = completed + failed;
	const successRate = total === 0 ? 0 : Math.round((completed / total) * 100);

	const areaCompletions: Record<string, { c: number; f: number }> = {};
	const questCompletions: Record<string, { c: number; f: number }> = {};

	for (const log of weekLogs) {
		if ((log.type === 'quest_completed' || log.type === 'quest_failed') && log.questId) {
			const q = quests.find(q => q.id === log.questId);
			if (q) {
				if (!areaCompletions[q.area]) areaCompletions[q.area] = { c: 0, f: 0 };
				if (!questCompletions[q.id]) questCompletions[q.id] = { c: 0, f: 0 };

				const ac = areaCompletions[q.area] ?? { c: 0, f: 0 };
				const qc = questCompletions[q.id] ?? { c: 0, f: 0 };

				if (log.type === 'quest_completed') {
					ac.c++;
					qc.c++;
				} else {
					ac.f++;
					qc.f++;
				}
				areaCompletions[q.area] = ac;
				questCompletions[q.id] = qc;
			}
		}
	}

	const areaStats: AreaStat[] = Object.keys(areaCompletions).map(areaId => {
		const entry = areaCompletions[areaId] ?? { c: 0, f: 0 };
		const c = entry.c;
		const f = entry.f;
		const r = (c + f) === 0 ? 0 : Math.round((c / (c + f)) * 100);
		return { areaId, name: areaId, successRate: r, delta: 0 };
	});

	const questStats: QuestStat[] = Object.keys(questCompletions).map(questId => {
		const q = quests.find(q => q.id === questId);
		const entry = questCompletions[questId] ?? { c: 0, f: 0 };
		const c = entry.c;
		const f = entry.f;
		const totalDays = c + f;
		const r = totalDays === 0 ? 0 : Math.round((c / totalDays) * 100);

		const stat: QuestStat = {
			questId,
			title: q ? q.title : 'Unknown',
			completedDays: c,
			totalDays,
			successRate: r,
			suggestion: 'maintain'
		};
		stat.suggestion = suggestQuestAdjustment(stat, null);
		return stat;
	});

	return { xpTotal, completed, failed, successRate, xpByDay, areaStats, questStats };
}

export function generateInsights(current: WeeklyStats, prev: WeeklyStats, streak: StreakState, lang: SupportedLanguage = 'es'): Insight[] {
	const insights: Insight[] = [];

	// Best day
	const maxXP = Math.max(...current.xpByDay);
	const maxIndex = current.xpByDay.indexOf(maxXP);
	if (maxXP > 0 && maxIndex !== -1) {
		const dayNames = [
			t('day_0', lang), t('day_1', lang), t('day_2', lang),
			t('day_3', lang), t('day_4', lang), t('day_5', lang), t('day_6', lang)
		];
		insights.push({
			type: 'best_day',
			title: t('insight_best_day_title', lang, { day: dayNames[maxIndex] ?? '' }),
			description: t('insight_best_day_desc', lang, { xp: maxXP })
		});
	}

	// Declining area
	let maxDecline = 0;
	let decliningArea: AreaStat | null = null;
	for (const a1 of current.areaStats) {
		const a2 = prev.areaStats.find(a => a.areaId === a1.areaId);
		if (a2) {
			a1.delta = a1.successRate - a2.successRate;
			if (a1.delta < maxDecline) {
				maxDecline = a1.delta;
				decliningArea = a1;
			}
		}
	}
	if (decliningArea && maxDecline <= -15) {
		insights.push({
			type: 'declining_area',
			title: t('insight_declining_area_title', lang, { area: decliningArea.name }),
			description: t('insight_declining_area_desc', lang, { delta: Math.abs(maxDecline) })
		});
	}

	// Streak milestone
	if (streak.current === 7 || streak.current === 30 || streak.current === 100) {
		insights.push({
			type: 'streak_milestone',
			title: t('insight_streak_milestone_title', lang, { days: streak.current }),
			description: t('insight_streak_milestone_desc', lang)
		});
	}

	// Abandoned quest
	for (const qs of current.questStats) {
		const prevQs = prev.questStats.find(q => q.questId === qs.questId);
		if (qs.successRate === 0 && prevQs && prevQs.successRate === 0 && qs.totalDays > 0) {
			insights.push({
				type: 'abandoned_quest',
				title: t('insight_abandoned_quest_title', lang, { quest: qs.title }),
				description: t('insight_abandoned_quest_desc', lang)
			});
			break;
		}
	}

	// Strong area
	for (const a1 of current.areaStats) {
		const a2 = prev.areaStats.find(a => a.areaId === a1.areaId);
		if (a1.successRate >= 90 && a2 && a2.successRate >= 90) {
			insights.push({
				type: 'strong_area',
				title: t('insight_strong_area_title', lang, { area: a1.name }),
				description: t('insight_strong_area_desc', lang)
			});
			break;
		}
	}

	return insights.slice(0, 5);
}

// UUID helper (no Node crypto — compatible with browser/mobile)
function uuid(): string {
	return 'xxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
		const r = Math.random() * 16 | 0;
		const v = c === 'x' ? r : (r & 0x3 | 0x8);
		return v.toString(16);
	});
}

export function checkBadges(data: LifequestData): Badge[] {
	const unlocked: Badge[] = [];
	const today = new Date().toISOString().split('T')[0] as string;
	const lang: SupportedLanguage = data.settings?.language ?? 'es';

	const hasBadge = (name: string) => data.badges.some(b => b.name === name);

	if (data.streak.current >= 7 && !hasBadge(t('badge_streak_7_name', lang))) {
		unlocked.push({ id: uuid(), name: t('badge_streak_7_name', lang), description: t('badge_streak_7_desc', lang), xpBonus: 30, unlockedAt: today, type: 'unique' });
	}
	if (data.streak.current >= 30 && !hasBadge(t('badge_streak_30_name', lang))) {
		unlocked.push({ id: uuid(), name: t('badge_streak_30_name', lang), description: t('badge_streak_30_desc', lang), xpBonus: 100, unlockedAt: today, type: 'unique' });
	}
	if (data.streak.current >= 100 && !hasBadge(t('badge_streak_100_name', lang))) {
		unlocked.push({ id: uuid(), name: t('badge_streak_100_name', lang), description: t('badge_streak_100_desc', lang), xpBonus: 500, unlockedAt: today, type: 'unique' });
	}
	if (data.xp.level >= 10 && !hasBadge(t('badge_level_10_name', lang))) {
		unlocked.push({ id: uuid(), name: t('badge_level_10_name', lang), description: t('badge_level_10_desc', lang), xpBonus: 200, unlockedAt: today, type: 'unique' });
	}

	return unlocked;
}
// ── Shop & Coins Logic ────────────────────────────────────────────────────────

export function calculateCoinReward(
	reason: CoinEarnReason,
	context: { level?: number; streakDays?: number } = {},
	settings: RewardSettings
): number {
	let baseAmount = 0;
	
	switch (reason) {
		case 'level_up':
			baseAmount = settings.levelUp.base + ((context.level ?? 1) - 1) * settings.levelUp.factor;
			break;
			case 'perfect_week':
				baseAmount = settings.perfectWeek;
				break;
			case 'streak_milestone': {
				const days = context.streakDays ?? 0;
				if (days >= 100) baseAmount = settings.streakMilestones.streak100;
				else if (days >= 30) baseAmount = settings.streakMilestones.streak30;
				else baseAmount = settings.streakMilestones.streak7;
				break;
			}
			case 'badge_epic':
				baseAmount = settings.badges.epic;
				break;
		case 'badge_common':
			baseAmount = settings.badges.common;
			break;
		case 'weekly_review':
			baseAmount = settings.weeklyReview;
			break;
		case 'epic_quest':
			baseAmount = settings.epicQuest;
			break;
	}
	
	return Math.round(baseAmount * settings.multiplier);
}

export function earnCoins(
	coinState: CoinState,
	reason: CoinEarnReason,
	label: string,
	context: { level?: number; streakDays?: number } = {},
	settings: RewardSettings
): CoinState {
	const amount = calculateCoinReward(reason, context, settings);
	if (amount <= 0) return coinState;

	const entry: CoinEntry = {
		id: `coin-${Date.now()}-${Math.random().toString(36).slice(2)}`,
		type: 'earn',
		amount,
		reason,
		label,
		timestamp: new Date().toISOString(),
	};

	const ledger = [entry, ...coinState.ledger].slice(0, 200);

	return {
		balance: coinState.balance + amount,
		totalEarned: coinState.totalEarned + amount,
		totalSpent: coinState.totalSpent,
		ledger,
	};
}

export function spendCoins(
	coinState: CoinState,
	reward: ShopReward
): CoinState {
	if (coinState.balance < reward.cost) {
		throw new Error(`Saldo insuficiente: ${coinState.balance} < ${reward.cost}`);
	}

	const entry: CoinEntry = {
		id: `spend-${Date.now()}-${reward.id}`,
		type: 'spend',
		amount: -reward.cost,
		reason: 'redeem_reward',
		label: reward.name,
		rewardId: reward.id,
		timestamp: new Date().toISOString(),
	};

	const ledger = [entry, ...coinState.ledger].slice(0, 200);

	return {
		balance: coinState.balance - reward.cost,
		totalEarned: coinState.totalEarned,
		totalSpent: coinState.totalSpent + reward.cost,
		ledger,
	};
}

export function canAffordReward(coinState: CoinState, reward: ShopReward): boolean {
	return coinState.balance >= reward.cost;
}
