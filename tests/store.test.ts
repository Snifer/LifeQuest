import { sanitizeData } from '../src/store';
import { DEFAULT_DATA, type LifequestData, type Quest } from '../src/types';

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
		note: partial.note,
		status: partial.status ?? 'active',
		createdAt: partial.createdAt ?? '2026-07-12',
		lastModifiedAt: partial.lastModifiedAt ?? '2026-07-12',
	};
}

function makeData(quests: Quest[]): LifequestData {
	return {
		...structuredClone(DEFAULT_DATA),
		quests,
	};
}

describe('store hierarchy migration', () => {
	it('fills missing hierarchy fields for legacy quests', () => {
		const legacyQuest = {
			id: 'legacy-root',
			title: 'Legacy root',
			area: 'work',
			frequency: 'daily',
			xp: 20,
			penalty: 5,
			difficulty: 'normal',
			reminder: 'none',
			status: 'active',
			createdAt: '2026-07-10',
			lastModifiedAt: '2026-07-10',
		} as Quest;

		const data = makeData([legacyQuest]);
		const sanitized = sanitizeData(data);

		expect(sanitized.quests[0]).toMatchObject({
			id: 'legacy-root',
			parentQuestId: null,
			sortOrder: 0,
			isCollapsed: false,
		});
	});

	it('keeps only one nesting level and clears invalid parents', () => {
		const root = makeQuest({ id: 'root', title: 'Root', sortOrder: 2 });
		const child = makeQuest({ id: 'child', title: 'Child', parentQuestId: 'root', sortOrder: 1 });
		const grandchild = makeQuest({ id: 'grandchild', title: 'Grandchild', parentQuestId: 'child', sortOrder: 0 });
		const orphan = makeQuest({ id: 'orphan', title: 'Orphan', parentQuestId: 'missing', sortOrder: 4 });
		const selfLinked = makeQuest({ id: 'self', title: 'Self', parentQuestId: 'self', sortOrder: 3 });

		const sanitized = sanitizeData(makeData([grandchild, orphan, child, selfLinked, root]));

		expect(sanitized.quests.map((quest) => quest.id)).toEqual([
			'grandchild',
			'root',
			'self',
			'orphan',
			'child',
		]);
		expect(sanitized.quests.find((quest) => quest.id === 'child')).toMatchObject({
			parentQuestId: 'root',
			sortOrder: 0,
			isCollapsed: false,
		});
		expect(sanitized.quests.find((quest) => quest.id === 'grandchild')).toMatchObject({
			parentQuestId: null,
			sortOrder: 0,
		});
		expect(sanitized.quests.find((quest) => quest.id === 'orphan')).toMatchObject({
			parentQuestId: null,
		});
		expect(sanitized.quests.find((quest) => quest.id === 'self')).toMatchObject({
			parentQuestId: null,
		});
	});

	it('prevents retired quests from remaining as parents', () => {
		const retiredParent = makeQuest({ id: 'retired-parent', status: 'retired', isCollapsed: true });
		const child = makeQuest({ id: 'child', parentQuestId: 'retired-parent', sortOrder: 4 });

		const sanitized = sanitizeData(makeData([child, retiredParent]));

		expect(sanitized.quests.find((quest) => quest.id === 'child')).toMatchObject({
			parentQuestId: null,
			sortOrder: 1,
		});
		expect(sanitized.quests.find((quest) => quest.id === 'retired-parent')).toMatchObject({
			parentQuestId: null,
			sortOrder: 0,
			isCollapsed: true,
		});
	});
});
