import { setQuestStatusForToday, getQuestStatusToday } from '../src/core/quest-actions';
import type { LifequestData, Quest } from '../src/types';
import { DEFAULT_DATA } from '../src/types';

function makeQuest(partial: Partial<Quest>): Quest {
	return {
		id: partial.id ?? `quest-${Math.random().toString(36).slice(2)}`,
		parentQuestId: partial.parentQuestId ?? null,
		sortOrder: partial.sortOrder ?? 0,
		isCollapsed: partial.isCollapsed ?? false,
		title: partial.title ?? 'Quest',
		area: partial.area ?? 'work',
		frequency: partial.frequency ?? 'daily',
		xp: partial.xp ?? 10,
		penalty: partial.penalty ?? 5,
		difficulty: partial.difficulty ?? 'normal',
		reminder: partial.reminder ?? 'none',
		reminderTime: partial.reminderTime,
		note: partial.note,
		status: partial.status ?? 'active',
		createdAt: partial.createdAt ?? '2026-07-12',
		lastModifiedAt: partial.lastModifiedAt ?? '2026-07-12',
	};
}

function makeData(): LifequestData {
	const data = structuredClone(DEFAULT_DATA);
	data.settings.language = 'en';
	data.xp.todayDate = '2026-07-12';
	data.xp.todayGained = 0;
	data.xp.total = 0;
	data.xp.level = 1;
	return data;
}

describe('quest manual actions', () => {
	beforeEach(() => {
		jest.useFakeTimers().setSystemTime(new Date('2026-07-12T12:00:00.000Z'));
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it('marks a quest as completed and logs XP for today', () => {
		const data = makeData();
		const quest = makeQuest({ id: 'quest-a', xp: 20 });
		data.quests = [quest];

		expect(setQuestStatusForToday(data, quest, 'done', 'en')).toBe(true);
		expect(getQuestStatusToday(quest.id, data.activityLog, '2026-07-12')).toBe('done');
		expect(data.activityLog).toHaveLength(1);
		expect(data.activityLog[0]?.type).toBe('quest_completed');
		expect(data.xp.total).toBeGreaterThan(0);
	});

	it('can fail and then reset a quest back to pending', () => {
		const data = makeData();
		const quest = makeQuest({ id: 'quest-b', penalty: 10 });
		data.quests = [quest];

		expect(setQuestStatusForToday(data, quest, 'failed', 'en')).toBe(true);
		expect(getQuestStatusToday(quest.id, data.activityLog, '2026-07-12')).toBe('failed');

		expect(setQuestStatusForToday(data, quest, 'pending', 'en')).toBe(true);
		expect(getQuestStatusToday(quest.id, data.activityLog, '2026-07-12')).toBe('pending');
		expect(data.activityLog).toHaveLength(0);
	});

	it('auto-completes the parent when all subquests are done and removes it when a child is reset', () => {
		const data = makeData();
		data.settings.autoCompleteParentQuests = true;

		const parent = makeQuest({ id: 'root', title: 'Parent', xp: 30 });
		const childA = makeQuest({ id: 'child-a', parentQuestId: 'root', title: 'Child A', xp: 10 });
		const childB = makeQuest({ id: 'child-b', parentQuestId: 'root', title: 'Child B', xp: 10 });
		data.quests = [parent, childA, childB];

		setQuestStatusForToday(data, childA, 'done', 'en');
		expect(getQuestStatusToday(parent.id, data.activityLog, '2026-07-12')).toBe('pending');

		setQuestStatusForToday(data, childB, 'done', 'en');
		expect(getQuestStatusToday(parent.id, data.activityLog, '2026-07-12')).toBe('done');
		expect(data.activityLog.some((log) => log.questId === parent.id && log.description.includes('Auto parent'))).toBe(true);

		setQuestStatusForToday(data, childB, 'pending', 'en');
		expect(getQuestStatusToday(parent.id, data.activityLog, '2026-07-12')).toBe('pending');
		expect(data.activityLog.some((log) => log.questId === parent.id && log.description.includes('Auto parent'))).toBe(false);
	});
});
