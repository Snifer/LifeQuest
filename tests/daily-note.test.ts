import { buildQuestBlock } from '../src/daily-note';
import type { LifequestData, Quest } from '../src/types';
import { DEFAULT_DATA } from '../src/types';

function makeQuest(partial: Partial<Quest>): Quest {
	return {
		id: 'quest-1',
		title: 'Read 10 pages',
		area: 'learning',
		frequency: 'daily',
		xp: 20,
		penalty: 5,
		difficulty: 'easy',
		reminder: 'none',
		status: 'active',
		createdAt: '2026-06-20T00:00:00.000Z',
		lastModifiedAt: '2026-06-20T00:00:00.000Z',
		...partial,
	};
}

function makeData(): LifequestData {
	return structuredClone(DEFAULT_DATA);
}

describe('daily-note block generation', () => {
	it('renders the default template with localized title and content', () => {
		const data = makeData();
		data.settings.language = 'en';
		data.quests = [makeQuest({ id: 'quest-1' })];

		const block = buildQuestBlock(data, '2026-06-20');

		expect(block).toContain('<!-- lifequest:start -->');
		expect(block).toContain('## Quests for today');
		expect(block).toContain('#lq-quest-1');
		expect(block).toContain('Read 10 pages');
	});

	it('groups quests by area when enabled', () => {
		const data = makeData();
		data.settings.language = 'en';
		data.settings.dailyNoteGroupByArea = true;
		data.quests = [
			makeQuest({ id: 'quest-1', title: 'Read 10 pages', area: 'learning' }),
			makeQuest({ id: 'quest-2', title: 'Walk 20 min', area: 'health' }),
		];

		const block = buildQuestBlock(data, '2026-06-20');

		expect(block).toContain('### 📚 Learning');
		expect(block).toContain('### 🏃 Health');
	});

	it('uses a custom template when provided', () => {
		const data = makeData();
		data.settings.language = 'en';
		data.settings.dailyNoteTemplate = '> [!todo] {date}\n{title}\n\n{content}';
		data.quests = [makeQuest({ id: 'quest-1' })];

		const block = buildQuestBlock(data, '2026-06-20');

		expect(block).toContain('> [!todo] 2026-06-20');
		expect(block).toContain('## Quests for today');
		expect(block).toContain('#lq-quest-1');
	});

	it('omits completed quests when only pending mode is enabled', () => {
		const data = makeData();
		data.settings.language = 'en';
		data.settings.dailyNoteOnlyPending = true;
		data.quests = [
			makeQuest({ id: 'quest-1', title: 'Read 10 pages' }),
			makeQuest({ id: 'quest-2', title: 'Write summary' }),
		];
		data.activityLog.push({
			id: 'log-1',
			type: 'quest_completed',
			description: 'done',
			xp: 20,
			questId: 'quest-1',
			timestamp: '2026-06-20T10:00:00.000Z',
		});

		const block = buildQuestBlock(data, '2026-06-20');

		expect(block).not.toContain('#lq-quest-1');
		expect(block).toContain('#lq-quest-2');
	});
});
