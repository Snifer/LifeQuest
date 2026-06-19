import {
	getStreakMultiplier,
	calculateXP,
	calculateLevel,
	getXPToNextLevel,
	updateStreak,
	generateInsights,
	suggestQuestAdjustment,
	checkBadges,
	calculateCoinReward,
	earnCoins,
	spendCoins,
	getClassBonus,
	generateDayStats,
	generateWeekStats,
	generateXPChartBuckets,
	getLevelTitle
} from '../src/engine';
import { Quest, QuestStat, StreakState, WeeklyStats, LogEntry, LifequestData, CoinState, ShopReward, WeightEntry } from '../src/types';

describe('engine.ts pure logic', () => {
	
	describe('getStreakMultiplier', () => {
		it('returns 1.0 for streaks < 7', () => {
			expect(getStreakMultiplier(0)).toBe(1.0);
			expect(getStreakMultiplier(6)).toBe(1.0);
		});
		it('returns 1.5 for streaks 7-29', () => {
			expect(getStreakMultiplier(7)).toBe(1.5);
			expect(getStreakMultiplier(29)).toBe(1.5);
		});
		it('returns 2.0 for streaks >= 30', () => {
			expect(getStreakMultiplier(30)).toBe(2.0);
			expect(getStreakMultiplier(100)).toBe(2.0);
		});
	});
	
	describe('getClassBonus', () => {
		const heroClasses = [{ id: 'explorer', name: 'Exp', bonusAreaId: 'learning', description: '' }];
		it('returns 20% bonus when class matches area', () => {
			const quest = { area: 'learning', xp: 50 } as Quest;
			expect(getClassBonus(quest, 'explorer', heroClasses)).toBe(10);
		});
		it('returns 0 when class does not match area', () => {
			const quest = { area: 'health', xp: 50 } as Quest;
			expect(getClassBonus(quest, 'explorer', heroClasses)).toBe(0);
		});
	});
	
	describe('calculateXP', () => {
		const data = {
			profile: { classId: 'explorer' },
			streak: { current: 0 },
			settings: {
				heroClasses: [{ id: 'explorer', name: 'Exp', bonusAreaId: 'learning', description: '' }]
			}
		} as unknown as LifequestData;

		it('applies basic XP calculation for completed quest without bonus', () => {
			const quest = { xp: 50, penalty: 10, area: 'health' } as Quest;
			expect(calculateXP(quest, true, data)).toBe(50);
		});

		it('applies class bonus correctly', () => {
			const quest = { xp: 50, penalty: 10, area: 'learning' } as Quest;
			expect(calculateXP(quest, true, data)).toBe(60); // 50 + 10 bonus
		});

		it('applies penalty for failed quest', () => {
			const quest = { xp: 50, penalty: 10, area: 'learning' } as Quest;
			expect(calculateXP(quest, false, data)).toBe(-10);
		});

		it('applies streak multipliers', () => {
			const quest = { xp: 50, penalty: 10, area: 'learning' } as Quest;
			
			const data10 = { ...data, streak: { current: 10 } } as unknown as LifequestData;
			expect(calculateXP(quest, true, data10)).toBe(90); // 60 base * 1.5
			
			const data30 = { ...data, streak: { current: 30 } } as unknown as LifequestData;
			expect(calculateXP(quest, true, data30)).toBe(120); // 60 base * 2.0
			
			expect(calculateXP(quest, false, data10)).toBe(-15); // -10 * 1.5
		});
	});
	
	describe('calculateLevel', () => {
		it('handles positive boundary cases', () => {
			expect(calculateLevel(0)).toBe(1);
			expect(calculateLevel(499)).toBe(1);
			expect(calculateLevel(500)).toBe(2);
			expect(calculateLevel(49500)).toBe(100);
			expect(calculateLevel(50000)).toBe(100);
		});
		it('handles negative xp gracefully', () => {
			expect(calculateLevel(-10)).toBe(1);
		});
	});

	describe('getXPToNextLevel', () => {
		it('handles boundary cases', () => {
			expect(getXPToNextLevel(0)).toBe(500);
			expect(getXPToNextLevel(250)).toBe(250);
			expect(getXPToNextLevel(499)).toBe(1);
			expect(getXPToNextLevel(500)).toBe(500); // Wait, level 2 started, full 500 next
			expect(getXPToNextLevel(49500)).toBe(0);
		});
		it('handles negative xp gracefully', () => {
			expect(getXPToNextLevel(-10)).toBe(500);
		});
	});

	describe('getLevelTitle', () => {
		it('returns correct titles', () => {
			expect(getLevelTitle(1)).toBe("Principiante");
			expect(getLevelTitle(3)).toBe("Aprendiz constante");
			expect(getLevelTitle(6)).toBe("Explorador enfocado");
			expect(getLevelTitle(10)).toBe("Maestro de hábitos");
			expect(getLevelTitle(15)).toBe("Guerrero del progreso");
			expect(getLevelTitle(25)).toBe("Arquitecto de sí mismo");
			expect(getLevelTitle(50)).toBe("Leyenda viviente");
			expect(getLevelTitle(100)).toBe("Trascendente");
		});
	});

	describe('updateStreak', () => {
		it('increments consecutive day', () => {
			const streak: StreakState = { current: 5, longest: 5, lastActiveDate: '2023-01-01' };
			const res = updateStreak(streak, '2023-01-02', true);
			expect(res.current).toBe(6);
			expect(res.longest).toBe(6);
			expect(res.lastActiveDate).toBe('2023-01-02');
		});

		it('resets for non-consecutive day', () => {
			const streak: StreakState = { current: 5, longest: 5, lastActiveDate: '2023-01-01' };
			const res = updateStreak(streak, '2023-01-03', true);
			expect(res.current).toBe(1);
			expect(res.longest).toBe(5);
			expect(res.lastActiveDate).toBe('2023-01-03');
		});

		it('no-op for same day', () => {
			const streak: StreakState = { current: 5, longest: 5, lastActiveDate: '2023-01-01' };
			const res = updateStreak(streak, '2023-01-01', true);
			expect(res.current).toBe(5);
		});

		it('resets when activity is false and elapsed', () => {
			const streak: StreakState = { current: 5, longest: 5, lastActiveDate: '2023-01-01' };
			const res = updateStreak(streak, '2023-01-03', false);
			expect(res.current).toBe(0);
		});

		it('ignores when activity is false but same day', () => {
			const streak: StreakState = { current: 5, longest: 5, lastActiveDate: '2023-01-01' };
			const res = updateStreak(streak, '2023-01-01', false);
			expect(res.current).toBe(5); // unchanged
		});
	});

	describe('suggestQuestAdjustment', () => {
		it('works for all 4 brackets', () => {
			expect(suggestQuestAdjustment({ successRate: 100 } as QuestStat, { successRate: 90 } as QuestStat)).toBe('increase_difficulty');
			expect(suggestQuestAdjustment({ successRate: 100 } as QuestStat, { successRate: 80 } as QuestStat)).toBe('maintain');
			expect(suggestQuestAdjustment({ successRate: 70 } as QuestStat, null)).toBe('maintain');
			expect(suggestQuestAdjustment({ successRate: 50 } as QuestStat, null)).toBe('review_goal');
			expect(suggestQuestAdjustment({ successRate: 30 } as QuestStat, null)).toBe('adjust_or_pause');
		});
	});

	describe('generateInsights', () => {
		it('detects best day', () => {
			const current = { xpByDay: [0, 0, 50, 0, 0, 0, 0], areaStats: [], questStats: [] } as unknown as WeeklyStats;
			const prev = { xpByDay: [0,0,0,0,0,0,0], areaStats: [], questStats: [] } as unknown as WeeklyStats;
			const streak = { current: 1 } as StreakState;
			
			const insights = generateInsights(current, prev, streak);
			expect(insights.some(i => i.type === 'best_day')).toBeTruthy();
		});

		it('detects declining area', () => {
			const current = { xpByDay: [0,0,0,0,0,0,0], areaStats: [{ areaId: 'a1', successRate: 50, name: 'A' }], questStats: [] } as unknown as WeeklyStats;
			const prev = { xpByDay: [0,0,0,0,0,0,0], areaStats: [{ areaId: 'a1', successRate: 80, name: 'A' }], questStats: [] } as unknown as WeeklyStats;
			const streak = { current: 1 } as StreakState;
			
			const insights = generateInsights(current, prev, streak);
			expect(insights.some(i => i.type === 'declining_area')).toBeTruthy();
		});

		it('detects streak milestones', () => {
			const current = { xpByDay: [0,0,0,0,0,0,0], areaStats: [], questStats: [] } as unknown as WeeklyStats;
			const prev = current;
			const streak = { current: 7 } as StreakState;
			
			const insights = generateInsights(current, prev, streak);
			expect(insights.some(i => i.type === 'streak_milestone')).toBeTruthy();
		});

		it('detects abandoned quest', () => {
			const current = { xpByDay: [0,0,0,0,0,0,0], areaStats: [], questStats: [{ questId: 'q1', successRate: 0, totalDays: 1, title: 'Q' }] } as unknown as WeeklyStats;
			const prev = { xpByDay: [0,0,0,0,0,0,0], areaStats: [], questStats: [{ questId: 'q1', successRate: 0, totalDays: 1, title: 'Q' }] } as unknown as WeeklyStats;
			const streak = { current: 1 } as StreakState;
			
			const insights = generateInsights(current, prev, streak);
			expect(insights.some(i => i.type === 'abandoned_quest')).toBeTruthy();
		});

		it('detects strong area', () => {
			const current = { xpByDay: [0,0,0,0,0,0,0], areaStats: [{ areaId: 'a1', successRate: 95, name: 'A' }], questStats: [] } as unknown as WeeklyStats;
			const prev = { xpByDay: [0,0,0,0,0,0,0], areaStats: [{ areaId: 'a1', successRate: 100, name: 'A' }], questStats: [] } as unknown as WeeklyStats;
			const streak = { current: 1 } as StreakState;
			
			const insights = generateInsights(current, prev, streak);
			expect(insights.some(i => i.type === 'strong_area')).toBeTruthy();
		});
	});

	describe('checkBadges', () => {
		it('grants new badges without duplicating', () => {
			const data = {
				settings: { language: 'es' },
				streak: { current: 30 },
				xp: { level: 10 },
				badges: [{ name: 'Racha de 7 días' }] // User already has 7 day badge
			} as unknown as LifequestData;

			const newBadges = checkBadges(data);
			expect(newBadges.some(b => b.name === 'Racha de 30 días')).toBeTruthy();
			expect(newBadges.some(b => b.name === 'Maestro de hábitos')).toBeTruthy();
			expect(newBadges.some(b => b.name === 'Racha de 7 días')).toBeFalsy(); // Already had it
			expect(newBadges.length).toBe(2);
		});
	});

	describe('generateDayStats', () => {
		it('calculates day stats correctly', () => {
			const logs = [
				{ timestamp: '2023-01-01T10:00:00Z', type: 'quest_completed', xp: 50 },
				{ timestamp: '2023-01-01T11:00:00Z', type: 'quest_failed', xp: -20 },
				{ timestamp: '2023-01-02T10:00:00Z', type: 'quest_completed', xp: 50 } // Other day
			] as LogEntry[];
			
			const stats = generateDayStats(logs, '2023-01-01');
			expect(stats.xpTotal).toBe(30);
			expect(stats.completed).toBe(1);
			expect(stats.failed).toBe(1);
			expect(stats.successRate).toBe(50);
		});
	});

	describe('generateWeekStats', () => {
		it('calculates week stats properly', () => {
			const weekStart = '2023-01-01'; // Sunday for ease, test logic takes 7 days starting here
			const quests = [
				{ id: 'q1', area: 'learning', title: 'Read' }
			] as Quest[];
			const logs = [
				{ timestamp: '2023-01-01T10:00:00Z', type: 'quest_completed', questId: 'q1', xp: 50 },
				{ timestamp: '2023-01-02T10:00:00Z', type: 'quest_failed', questId: 'q1', xp: -20 }
			] as LogEntry[];

			const stats = generateWeekStats(logs, quests, weekStart);
			expect(stats.xpTotal).toBe(30);
			expect(stats.completed).toBe(1);
			expect(stats.failed).toBe(1);
			expect(stats.successRate).toBe(50);
			expect(stats.xpByDay[0]).toBe(50);
			expect(stats.xpByDay[1]).toBe(-20);
			
			expect(stats.areaStats.length).toBe(1);
			expect(stats.areaStats[0]?.areaId).toBe('learning');
			expect(stats.areaStats[0]?.successRate).toBe(50);

			expect(stats.questStats.length).toBe(1);
			expect(stats.questStats[0]?.questId).toBe('q1');
			expect(stats.questStats[0]?.successRate).toBe(50);
		});
	});

	describe('generateXPChartBuckets', () => {
		const logs = [
			{ timestamp: '2024-06-10T10:00:00Z', type: 'quest_completed', xp: 40 },
			{ timestamp: '2024-06-11T10:00:00Z', type: 'quest_failed', xp: -20 },
			{ timestamp: '2024-06-15T10:00:00Z', type: 'quest_completed', xp: 10 },
			{ timestamp: '2024-06-02T10:00:00Z', type: 'quest_completed', xp: 25 },
			{ timestamp: '2024-05-20T10:00:00Z', type: 'quest_completed', xp: 15 },
		] as LogEntry[];

		it('builds week buckets using current ISO week', () => {
			const buckets = generateXPChartBuckets(logs, 'week', '2024-06-13');
			expect(buckets).toHaveLength(7);
			expect(buckets[0]).toMatchObject({ key: '2024-06-10', value: 40, state: 'past' });
			expect(buckets[1]).toMatchObject({ key: '2024-06-11', value: 0, state: 'past' });
			expect(buckets[3]).toMatchObject({ key: '2024-06-13', state: 'current' });
			expect(buckets[5]).toMatchObject({ key: '2024-06-15', value: 10, state: 'future' });
		});

		it('builds month buckets for the full current month', () => {
			const buckets = generateXPChartBuckets(logs, 'month', '2024-06-13');
			expect(buckets).toHaveLength(30);
			expect(buckets[1]).toMatchObject({ key: '2024-06-02', value: 25, state: 'past' });
			expect(buckets[9]).toMatchObject({ key: '2024-06-10', value: 40, state: 'past' });
			expect(buckets[12]).toMatchObject({ key: '2024-06-13', state: 'current' });
			expect(buckets[29]).toMatchObject({ key: '2024-06-30', state: 'future' });
		});

		it('builds all buckets grouped by month from first log to current month', () => {
			const buckets = generateXPChartBuckets(logs, 'all', '2024-06-13');
			expect(buckets).toEqual([
				{ key: '2024-05', value: 15, state: 'neutral' },
				{ key: '2024-06', value: 55, state: 'current' },
			]);
		});
	});

	// ── Shop & Coins Tests ───────────────────────────────────────────────────

	const baseSettings = {
		notificationsEnabled: true,
		multiplier: 1.0,
		levelUp: { base: 50, factor: 10 },
		badges: { common: 20, epic: 75 },
		streakMilestones: { streak7: 30, streak30: 100, streak100: 300 },
		weeklyReview: 15,
		perfectWeek: 40,
		epicQuest: 10,
		weighIn: { base: 10, streak4: 20, streak12: 30 },
	};

	describe('calculateCoinReward', () => {
		it('calculates level_up scaling correctly', () => {
			expect(calculateCoinReward('level_up', { level: 1 }, baseSettings)).toBe(50);
			expect(calculateCoinReward('level_up', { level: 10 }, baseSettings)).toBe(140);
			expect(calculateCoinReward('level_up', { level: 20 }, baseSettings)).toBe(240);
		});

		it('calculates streak_milestone correctly', () => {
			expect(calculateCoinReward('streak_milestone', { streakDays: 7 }, baseSettings)).toBe(30);
			expect(calculateCoinReward('streak_milestone', { streakDays: 30 }, baseSettings)).toBe(100);
			expect(calculateCoinReward('streak_milestone', { streakDays: 100 }, baseSettings)).toBe(300);
		});

		it('applies multiplier', () => {
			const doubleSettings = { ...baseSettings, multiplier: 2.0 };
			expect(calculateCoinReward('badge_common', {}, doubleSettings)).toBe(40);
		});
	});

	describe('earnCoins', () => {
		const empty: CoinState = { balance: 0, totalEarned: 0, totalSpent: 0, ledger: [] };

		it('increments balance and adds ledger entry', () => {
			const res = earnCoins(empty, 'badge_common', 'Test', {}, baseSettings);
			expect(res.balance).toBe(20);
			expect(res.totalEarned).toBe(20);
			expect(res.ledger).toHaveLength(1);
			expect(res.ledger[0]!.amount).toBe(20);
		});

		it('respects 200 entry limit (FIFO)', () => {
			let state = empty;
			for (let i = 0; i < 205; i++) {
				state = earnCoins(state, 'epic_quest', `Q${i}`, {}, baseSettings);
			}
			expect(state.ledger).toHaveLength(200);
			expect(state.ledger[0]!.label).toBe('Q204');
		});
	});

	describe('spendCoins', () => {
		const withBalance: CoinState = { balance: 100, totalEarned: 100, totalSpent: 0, ledger: [] };
		const reward: ShopReward = { id: 'r1', cost: 30, name: 'Coffee', emoji: '☕', category: 'bienestar', description: '', timesRedeemed: 0, maxRedemptions: 0, createdAt: '2026-01-01', isDefault: false };

		it('deducts balance and adds spend entry', () => {
			const res = spendCoins(withBalance, reward);
			expect(res.balance).toBe(70);
			expect(res.totalSpent).toBe(30);
			expect(res.ledger[0]!.amount).toBe(-30);
			expect(res.ledger[0]!.type).toBe('spend');
		});

		it('throws on insufficient balance', () => {
			const poor: CoinState = { ...withBalance, balance: 10 };
			expect(() => spendCoins(poor, reward)).toThrow('Saldo insuficiente');
		});
	});
});

import {
  calculateBMI, getBMICategory, calculateWeeklyTrend,
  calculateProgressPercent, getWeighInXP, toKg, toCm, needsWeighIn
} from '../src/core/health-engine';
describe('calculateBMI', () => {
  it('calcula IMC correctamente', () => {
    expect(calculateBMI(70, 175)).toBe(22.9);
    expect(calculateBMI(90, 170)).toBe(31.1);
  });
  it('retorna 0 si altura o peso es 0', () => {
    expect(calculateBMI(0, 170)).toBe(0);
    expect(calculateBMI(70, 0)).toBe(0);
  });
});

describe('getBMICategory', () => {
  it('clasifica correctamente todos los rangos', () => {
    expect(getBMICategory(17)).toBe('underweight');
    expect(getBMICategory(22)).toBe('normal_range');
    expect(getBMICategory(27)).toBe('overweight');
    expect(getBMICategory(32)).toBe('obese_class_1');
    expect(getBMICategory(37)).toBe('obese_class_2');
    expect(getBMICategory(42)).toBe('obese_class_3');
  });
  it('maneja límites exactos', () => {
    expect(getBMICategory(18.5)).toBe('normal_range');
    expect(getBMICategory(25)).toBe('overweight');
    expect(getBMICategory(30)).toBe('obese_class_1');
  });
});

describe('calculateWeeklyTrend', () => {
  it('retorna null con menos de 2 entradas', () => {
    expect(calculateWeeklyTrend([], 'kg')).toBeNull();
    expect(calculateWeeklyTrend([{ weightValue: 80 } as unknown as WeightEntry], 'kg')).toBeNull();
  });
  it('calcula tendencia negativa (pérdida)', () => {
    const entries = [
      { weightValue: 80, date: '2026-01-01' },
      { weightValue: 79.5, date: '2026-01-08' },
      { weightValue: 79, date: '2026-01-15' },
      { weightValue: 78.5, date: '2026-01-22' },
    ] as WeightEntry[];
    const trend = calculateWeeklyTrend(entries, 'kg');
    expect(trend).toBeLessThan(0);
  });
});

describe('needsWeighIn', () => {
  it('no pide registro antes del día configurado', () => {
    expect(needsWeighIn([], 3, new Date('2026-06-01T12:00:00Z'))).toBe(false);
  });

  it('pide registro cuando llegó el día y no hay entrada semanal', () => {
    expect(needsWeighIn([], 1, new Date('2026-06-01T12:00:00Z'))).toBe(true);
  });

  it('no pide registro si ya existe una entrada en la semana actual', () => {
    const entries = [{ weightValue: 80, date: '2026-06-01T10:00:00Z' }] as WeightEntry[];
    expect(needsWeighIn(entries, 1, new Date('2026-06-03T12:00:00Z'))).toBe(false);
  });
});

describe('calculateProgressPercent', () => {
  it('calcula 0% al inicio', () => {
    expect(calculateProgressPercent(80, 80, 72, 'lose_weight')).toBe(0);
  });
  it('calcula 50% a mitad de camino', () => {
    expect(calculateProgressPercent(80, 76, 72, 'lose_weight')).toBe(50);
  });
  it('calcula 100% al llegar a la meta', () => {
    expect(calculateProgressPercent(80, 72, 72, 'lose_weight')).toBe(100);
  });
  it('no supera 100%', () => {
    expect(calculateProgressPercent(80, 70, 72, 'lose_weight')).toBe(100);
  });
});

describe('getWeighInXP', () => {
  it('da XP base sin racha', () => {
    expect(getWeighInXP(0)).toBe(20);
    expect(getWeighInXP(1)).toBe(25);
  });
  it('el bonus de racha no supera 50', () => {
    expect(getWeighInXP(100)).toBe(70); // 20 + min(500, 50) = 70
  });
});

describe('conversiones de unidades', () => {
  it('convierte lb a kg', () => {
    expect(toKg(154, 'lb')).toBeCloseTo(69.85, 1);
  });
  it('convierte ft a cm', () => {
    expect(toCm(5.9, 'ft')).toBeCloseTo(179.8, 0);
  });
});
