import type { LogEntry, Quest } from '../types';

export interface QuestTreeNode {
	quest: Quest;
	children: QuestTreeNode[];
}

export interface FlattenedQuestRow {
	quest: Quest;
	depth: 0 | 1;
	hasChildren: boolean;
	isCollapsed: boolean;
}

export interface CreateSubquestDraftOptions {
	id: string;
	today: string;
	area?: string;
}

export type ReorderDirection = 'up' | 'down';
export type QuestListFilter = 'all' | 'roots';

export interface SubquestProgress {
	completed: number;
	total: number;
	allCompleted: boolean;
}

function sortQuests(quests: Quest[]): Quest[] {
	return [...quests].sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt));
}

export function getRootQuests(quests: Quest[], includeRetired = true): Quest[] {
	return sortQuests(
		quests.filter((quest) => !quest.parentQuestId && (includeRetired || quest.status !== 'retired'))
	);
}

export function getSubquests(parentId: string, quests: Quest[], includeRetired = true): Quest[] {
	return sortQuests(
		quests.filter((quest) => quest.parentQuestId === parentId && (includeRetired || quest.status !== 'retired'))
	);
}

export function buildQuestTree(quests: Quest[], includeRetired = true): QuestTreeNode[] {
	return getRootQuests(quests, includeRetired).map((quest) => ({
		quest,
		children: getSubquests(quest.id, quests, includeRetired).map((child) => ({
			quest: child,
			children: [],
		})),
	}));
}

export function flattenVisibleQuests(quests: Quest[], includeRetired = false): FlattenedQuestRow[] {
	const rows: FlattenedQuestRow[] = [];

	for (const node of buildQuestTree(quests, includeRetired)) {
		const visibleChildren = node.children.filter((child) => includeRetired || child.quest.status !== 'retired');
		const isCollapsed = Boolean(node.quest.isCollapsed) && visibleChildren.length > 0;

		rows.push({
			quest: node.quest,
			depth: 0,
			hasChildren: visibleChildren.length > 0,
			isCollapsed,
		});

		if (isCollapsed) {
			continue;
		}

		for (const child of visibleChildren) {
			rows.push({
				quest: child.quest,
				depth: 1,
				hasChildren: false,
				isCollapsed: false,
			});
		}
	}

	return rows;
}

export function canBecomeChild(parent: Quest, candidate: Quest): boolean {
	if (parent.id === candidate.id) {
		return false;
	}

	if (parent.status === 'retired' || parent.parentQuestId) {
		return false;
	}

	if (candidate.parentQuestId) {
		return false;
	}

	return true;
}

export function createSubquestDraft(parent: Quest, quests: Quest[], options: CreateSubquestDraftOptions): Quest {
	const siblingCount = getSubquests(parent.id, quests, true).length;

	return {
		id: options.id,
		parentQuestId: parent.id,
		sortOrder: siblingCount,
		isCollapsed: false,
		title: '',
		area: options.area ?? parent.area,
		frequency: parent.frequency,
		xp: parent.xp,
		penalty: parent.penalty,
		difficulty: parent.difficulty,
		reminder: parent.reminder,
		reminderTime: parent.reminderTime,
		note: '',
		status: 'active',
		createdAt: options.today,
		lastModifiedAt: options.today,
	};
}

export function reorderQuest(quests: Quest[], questId: string, direction: ReorderDirection): boolean {
	const target = quests.find((quest) => quest.id === questId);
	if (!target) {
		return false;
	}

	const siblings = target.parentQuestId
		? getSubquests(target.parentQuestId, quests, true)
		: getRootQuests(quests, true);
	const currentIndex = siblings.findIndex((quest) => quest.id === questId);
	if (currentIndex === -1) {
		return false;
	}

	const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
	if (swapIndex < 0 || swapIndex >= siblings.length) {
		return false;
	}

	const sibling = siblings[swapIndex];
	if (!sibling) {
		return false;
	}

	const originalOrder = target.sortOrder;
	target.sortOrder = sibling.sortOrder;
	sibling.sortOrder = originalOrder;

	const normalizedSiblings = sortQuests(siblings);
	normalizedSiblings.forEach((quest, index) => {
		quest.sortOrder = index;
	});

	return true;
}

export function getSubquestProgress(parentQuestId: string, quests: Quest[], logs: LogEntry[], dayPrefix: string): SubquestProgress {
	const subquests = getSubquests(parentQuestId, quests, false).filter((quest) => quest.status === 'active');
	const completed = subquests.filter((quest) =>
		logs.some((log) =>
			log.questId === quest.id &&
			log.type === 'quest_completed' &&
			log.timestamp.startsWith(dayPrefix)
		)
	).length;

	return {
		completed,
		total: subquests.length,
		allCompleted: subquests.length > 0 && completed === subquests.length,
	};
}

export function getParentAutoCompleteCandidate(quest: Quest, quests: Quest[], logs: LogEntry[], dayPrefix: string): Quest | null {
	if (!quest.parentQuestId) {
		return null;
	}

	const parent = quests.find((item) => item.id === quest.parentQuestId);
	if (!parent || parent.status !== 'active') {
		return null;
	}

	const progress = getSubquestProgress(parent.id, quests, logs, dayPrefix);
	return progress.allCompleted ? parent : null;
}

export function setAllRootCollapsed(quests: Quest[], collapsed: boolean): boolean {
	let changed = false;
	for (const quest of quests) {
		if (quest.parentQuestId) {
			continue;
		}
		if (quest.isCollapsed !== collapsed) {
			quest.isCollapsed = collapsed;
			changed = true;
		}
	}
	return changed;
}
