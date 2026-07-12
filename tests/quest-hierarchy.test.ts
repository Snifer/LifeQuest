import {
	buildQuestTree,
	canBecomeChild,
	createSubquestDraft,
	flattenVisibleQuests,
	getParentAutoCompleteCandidate,
	getRootQuests,
	getSubquests,
	getSubquestProgress,
	reorderQuest,
	type FlattenedQuestRow,
} from '../src/core/quest-hierarchy';
import type { LogEntry, Quest } from '../src/types';

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

function rowIds(rows: FlattenedQuestRow[]): string[] {
	return rows.map((row) => row.quest.id);
}

function makeLog(partial: Partial<LogEntry>): LogEntry {
	return {
		id: partial.id ?? `log-${Math.random().toString(36).slice(2)}`,
		type: partial.type ?? 'quest_completed',
		description: partial.description ?? 'log',
		xp: partial.xp ?? 10,
		questId: partial.questId,
		timestamp: partial.timestamp ?? '2026-07-12T10:00:00.000Z',
	};
}

describe('quest hierarchy helpers', () => {
	it('returns ordered root quests only', () => {
		const quests = [
			makeQuest({ id: 'child', parentQuestId: 'root-b', sortOrder: 1 }),
			makeQuest({ id: 'root-c', sortOrder: 3, createdAt: '2026-07-12' }),
			makeQuest({ id: 'root-a', sortOrder: 0, createdAt: '2026-07-10' }),
			makeQuest({ id: 'root-b', sortOrder: 1, createdAt: '2026-07-11' }),
		];

		expect(getRootQuests(quests).map((quest) => quest.id)).toEqual(['root-a', 'root-b', 'root-c']);
	});

	it('returns ordered subquests for a given parent', () => {
		const quests = [
			makeQuest({ id: 'b', parentQuestId: 'root', sortOrder: 2, createdAt: '2026-07-12' }),
			makeQuest({ id: 'root', sortOrder: 0 }),
			makeQuest({ id: 'a', parentQuestId: 'root', sortOrder: 0, createdAt: '2026-07-10' }),
			makeQuest({ id: 'c', parentQuestId: 'other', sortOrder: 0 }),
			makeQuest({ id: 'a-2', parentQuestId: 'root', sortOrder: 0, createdAt: '2026-07-11' }),
		];

		expect(getSubquests('root', quests).map((quest) => quest.id)).toEqual(['a', 'a-2', 'b']);
	});

	it('builds a one-level quest tree', () => {
		const quests = [
			makeQuest({ id: 'child-a', parentQuestId: 'root-a', sortOrder: 1 }),
			makeQuest({ id: 'root-b', sortOrder: 1 }),
			makeQuest({ id: 'child-b', parentQuestId: 'root-a', sortOrder: 0 }),
			makeQuest({ id: 'root-a', sortOrder: 0 }),
		];

		const tree = buildQuestTree(quests);

		expect(tree).toHaveLength(2);
		expect(tree[0]?.quest.id).toBe('root-a');
		expect(tree[0]?.children.map((child) => child.quest.id)).toEqual(['child-b', 'child-a']);
		expect(tree[1]?.quest.id).toBe('root-b');
		expect(tree[1]?.children).toHaveLength(0);
	});

	it('flattens only visible quests when roots are collapsed', () => {
		const quests = [
			makeQuest({ id: 'root-a', sortOrder: 0, isCollapsed: true }),
			makeQuest({ id: 'child-a1', parentQuestId: 'root-a', sortOrder: 0 }),
			makeQuest({ id: 'root-b', sortOrder: 1, isCollapsed: false }),
			makeQuest({ id: 'child-b1', parentQuestId: 'root-b', sortOrder: 0 }),
		];

		const rows = flattenVisibleQuests(quests);

		expect(rowIds(rows)).toEqual(['root-a', 'root-b', 'child-b1']);
		expect(rows[0]).toMatchObject({ depth: 0, hasChildren: true, isCollapsed: true });
		expect(rows[2]).toMatchObject({ depth: 1, hasChildren: false, isCollapsed: false });
	});

	it('filters retired quests from the visible hierarchy by default', () => {
		const quests = [
			makeQuest({ id: 'root', sortOrder: 0 }),
			makeQuest({ id: 'child-active', parentQuestId: 'root', sortOrder: 0 }),
			makeQuest({ id: 'child-retired', parentQuestId: 'root', sortOrder: 1, status: 'retired' }),
		];

		expect(rowIds(flattenVisibleQuests(quests))).toEqual(['root', 'child-active']);
	});

	it('allows only valid root parents in canBecomeChild', () => {
		const root = makeQuest({ id: 'root', parentQuestId: null, status: 'active' });
		const child = makeQuest({ id: 'child', parentQuestId: null, status: 'active' });
		const retiredParent = makeQuest({ id: 'retired', status: 'retired' });
		const nestedParent = makeQuest({ id: 'nested', parentQuestId: 'root', status: 'active' });

		expect(canBecomeChild(root, child)).toBe(true);
		expect(canBecomeChild(root, root)).toBe(false);
		expect(canBecomeChild(retiredParent, child)).toBe(false);
		expect(canBecomeChild(nestedParent, child)).toBe(false);
		expect(canBecomeChild(root, nestedParent)).toBe(false);
	});

	it('creates a subquest draft inheriting parent defaults and next sibling order', () => {
		const parent = makeQuest({
			id: 'root',
			area: 'learning',
			frequency: 'weekly',
			xp: 35,
			penalty: 15,
			difficulty: 'hard',
			reminder: 'custom',
			reminderTime: '08:30',
		});
		const quests = [
			parent,
			makeQuest({ id: 'child-a', parentQuestId: 'root', sortOrder: 0 }),
			makeQuest({ id: 'child-b', parentQuestId: 'root', sortOrder: 1 }),
		];

		const draft = createSubquestDraft(parent, quests, {
			id: 'draft-child',
			today: '2026-07-12',
		});

		expect(draft).toMatchObject({
			id: 'draft-child',
			parentQuestId: 'root',
			sortOrder: 2,
			area: 'learning',
			frequency: 'weekly',
			xp: 35,
			penalty: 15,
			difficulty: 'hard',
			reminder: 'custom',
			reminderTime: '08:30',
			status: 'active',
			createdAt: '2026-07-12',
			lastModifiedAt: '2026-07-12',
		});
	});

	it('reorders root quests within the root level only', () => {
		const quests = [
			makeQuest({ id: 'root-a', sortOrder: 0 }),
			makeQuest({ id: 'root-b', sortOrder: 1 }),
			makeQuest({ id: 'root-c', sortOrder: 2 }),
			makeQuest({ id: 'child-a', parentQuestId: 'root-a', sortOrder: 0 }),
		];

		expect(reorderQuest(quests, 'root-b', 'up')).toBe(true);
		expect(getRootQuests(quests).map((quest) => quest.id)).toEqual(['root-b', 'root-a', 'root-c']);
		expect(getSubquests('root-a', quests).map((quest) => quest.id)).toEqual(['child-a']);
	});

	it('reorders subquests only inside the same parent', () => {
		const quests = [
			makeQuest({ id: 'root', sortOrder: 0 }),
			makeQuest({ id: 'child-a', parentQuestId: 'root', sortOrder: 0 }),
			makeQuest({ id: 'child-b', parentQuestId: 'root', sortOrder: 1 }),
			makeQuest({ id: 'child-c', parentQuestId: 'root', sortOrder: 2 }),
			makeQuest({ id: 'other-root', sortOrder: 1 }),
			makeQuest({ id: 'other-child', parentQuestId: 'other-root', sortOrder: 0 }),
		];

		expect(reorderQuest(quests, 'child-b', 'down')).toBe(true);
		expect(getSubquests('root', quests).map((quest) => quest.id)).toEqual(['child-a', 'child-c', 'child-b']);
		expect(getSubquests('other-root', quests).map((quest) => quest.id)).toEqual(['other-child']);
	});

	it('does not reorder when already at the boundary', () => {
		const quests = [
			makeQuest({ id: 'root-a', sortOrder: 0 }),
			makeQuest({ id: 'root-b', sortOrder: 1 }),
		];

		expect(reorderQuest(quests, 'root-a', 'up')).toBe(false);
		expect(reorderQuest(quests, 'root-b', 'down')).toBe(false);
		expect(getRootQuests(quests).map((quest) => quest.id)).toEqual(['root-a', 'root-b']);
	});

	it('calculates subquest progress for a parent on a given day', () => {
		const quests = [
			makeQuest({ id: 'root' }),
			makeQuest({ id: 'child-a', parentQuestId: 'root' }),
			makeQuest({ id: 'child-b', parentQuestId: 'root' }),
			makeQuest({ id: 'child-c', parentQuestId: 'root', status: 'paused' }),
		];
		const logs = [
			makeLog({ questId: 'child-a', timestamp: '2026-07-12T08:00:00.000Z' }),
			makeLog({ questId: 'child-c', timestamp: '2026-07-12T09:00:00.000Z' }),
		];

		expect(getSubquestProgress('root', quests, logs, '2026-07-12')).toEqual({
			completed: 1,
			total: 2,
			allCompleted: false,
		});
	});

	it('returns the parent as auto-complete candidate when all active subquests are done', () => {
		const quests = [
			makeQuest({ id: 'root' }),
			makeQuest({ id: 'child-a', parentQuestId: 'root' }),
			makeQuest({ id: 'child-b', parentQuestId: 'root' }),
		];
		const logs = [
			makeLog({ questId: 'child-a', timestamp: '2026-07-12T08:00:00.000Z' }),
			makeLog({ questId: 'child-b', timestamp: '2026-07-12T09:00:00.000Z' }),
		];

		expect(getParentAutoCompleteCandidate(quests[1]!, quests, logs, '2026-07-12')?.id).toBe('root');
	});
});
