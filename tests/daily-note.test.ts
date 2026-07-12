import { TFile } from 'obsidian';
import { buildQuestBlock, parseQuestStatesFromContent, shouldTrackMarkdownFile, syncTrackedQuestFiles } from '../src/daily-note';
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

function makeFile(path: string): TFile & { path: string; basename: string } {
	const parts = path.split('/');
	const name = parts[parts.length - 1] ?? path;
	const basename = name.replace(/\.md$/i, '');
	return Object.assign(new TFile(), { path, basename });
}

function makePlugin(data: LifequestData, files: Array<{ file: TFile & { path: string; basename: string }; content: string }>) {
	const contentByPath = new Map(files.map(({ file, content }) => [file.path, content]));
	const save = jest.fn(async () => undefined);
	const scheduleRefresh = jest.fn();

	return {
		data,
		app: {
			vault: {
				getMarkdownFiles: () => files.map(({ file }) => file),
				read: async (file: TFile & { path: string }) => contentByPath.get(file.path) ?? '',
			},
		},
		store: {
			save,
		},
		getDashboardView: () => ({ scheduleRefresh }),
		__save: save,
		__scheduleRefresh: scheduleRefresh,
	} as const;
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

describe('markdown quest sync helpers', () => {
	it('parses markdown checkboxes with LifeQuest ids', () => {
		const states = parseQuestStatesFromContent([
			'- [ ] Read 10 pages #lq-d23a-6cfb-4945-afe3-ecd6ea596e0c',
			'- [x] Ship feature #lq-a23a-6cfb-4945-afe3-ecd6ea596e0c',
			'Random line',
		].join('\n'));

		expect(states.get('d23a-6cfb-4945-afe3-ecd6ea596e0c')).toBe(false);
		expect(states.get('a23a-6cfb-4945-afe3-ecd6ea596e0c')).toBe(true);
		expect(states.size).toBe(2);
	});

	it('tracks only the daily note when scope is daily-note', () => {
		const data = makeData();
		data.settings.markdownSyncScope = 'daily-note';

		expect(shouldTrackMarkdownFile('2026-06-20.md', '2026-06-20', data, '2026-06-20')).toBe(true);
		expect(shouldTrackMarkdownFile('Projects/Board.md', 'Board', data, '2026-06-20')).toBe(false);
	});

	it('tracks only selected folders when scope is folders', () => {
		const data = makeData();
		data.settings.markdownSyncScope = 'folders';
		data.settings.markdownSyncFolders = ['Projects', '/Kanban/Work/'];

		expect(shouldTrackMarkdownFile('Projects/Board.md', 'Board', data, '2026-06-20')).toBe(true);
		expect(shouldTrackMarkdownFile('Kanban/Work/Sprint.md', 'Sprint', data, '2026-06-20')).toBe(true);
		expect(shouldTrackMarkdownFile('Archive/Old.md', 'Old', data, '2026-06-20')).toBe(false);
	});

	it('tracks any markdown file when scope is vault', () => {
		const data = makeData();
		data.settings.markdownSyncScope = 'vault';

		expect(shouldTrackMarkdownFile('Projects/Board.md', 'Board', data, '2026-06-20')).toBe(true);
	});

	it('respects excluded folders when tracking markdown files', () => {
		const data = makeData();
		data.settings.markdownSyncScope = 'vault';
		data.settings.markdownSyncExcludedFolders = ['Archive', 'Templates'];

		expect(shouldTrackMarkdownFile('Projects/Board.md', 'Board', data, '2026-06-20')).toBe(true);
		expect(shouldTrackMarkdownFile('Archive/Old.md', 'Old', data, '2026-06-20')).toBe(false);
		expect(shouldTrackMarkdownFile('Templates/Daily.md', 'Daily', data, '2026-06-20')).toBe(false);
		expect(shouldTrackMarkdownFile('_LifeQuest/internal.md', 'internal', data, '2026-06-20')).toBe(false);
	});
});

describe('tracked markdown startup sync', () => {
	beforeEach(() => {
		jest.useFakeTimers();
		jest.setSystemTime(new Date('2026-07-12T12:00:00.000Z'));
	});

	afterEach(() => {
		jest.useRealTimers();
		jest.restoreAllMocks();
	});

	it('applies the same reward pipeline during startup sync', async () => {
		const data = makeData();
		data.settings.language = 'en';
		data.settings.markdownSyncScope = 'folders';
		data.settings.markdownSyncFolders = ['Projects'];
		data.streak.current = 6;
		data.streak.longest = 6;
		data.streak.lastActiveDate = '2026-07-11';
		data.xp.total = 490;
		data.xp.level = 1;
		data.xp.todayDate = '2026-07-11';
		data.coins = { balance: 0, totalEarned: 0, totalSpent: 0, ledger: [] };
		data.quests = [
			makeQuest({
				id: 'd23a-6cfb-4945-afe3-ecd6ea596e0c',
				title: 'Epic build',
				area: 'learning',
				xp: 20,
				difficulty: 'epic',
			}),
		];

		const plugin = makePlugin(data, [
			{
				file: makeFile('Projects/Board.md'),
				content: '- [x] Epic build #lq-d23a-6cfb-4945-afe3-ecd6ea596e0c',
			},
		]);

		await syncTrackedQuestFiles(plugin as never);

		expect(data.activityLog.some((entry) => entry.type === 'quest_completed' && entry.questId === 'd23a-6cfb-4945-afe3-ecd6ea596e0c')).toBe(true);
		expect(data.activityLog.some((entry) => entry.type === 'level_up')).toBe(true);
		expect(data.activityLog.some((entry) => entry.type === 'badge_unlocked')).toBe(true);
		expect(data.streak.current).toBe(7);
		expect(data.xp.level).toBe(2);
		expect(data.coins?.balance).toBeGreaterThan(0);
		expect(data.markdownSyncState?.fileStates['Projects/Board.md::d23a-6cfb-4945-afe3-ecd6ea596e0c']).toBe(true);
		expect(plugin.__save).toHaveBeenCalled();
		expect(plugin.__scheduleRefresh).toHaveBeenCalled();
	});

	it('does not duplicate rewards when the same quest appears checked in multiple files', async () => {
		const data = makeData();
		data.settings.language = 'en';
		data.settings.markdownSyncScope = 'folders';
		data.settings.markdownSyncFolders = ['Projects', 'Kanban'];
		data.quests = [
			makeQuest({
				id: 'd23a-6cfb-4945-afe3-ecd6ea596e0c',
				title: 'Shared quest',
				xp: 20,
			}),
		];

		const plugin = makePlugin(data, [
			{
				file: makeFile('Projects/Board.md'),
				content: '- [x] Shared quest #lq-d23a-6cfb-4945-afe3-ecd6ea596e0c',
			},
			{
				file: makeFile('Kanban/Sprint.md'),
				content: '- [x] Shared quest #lq-d23a-6cfb-4945-afe3-ecd6ea596e0c',
			},
		]);

		await syncTrackedQuestFiles(plugin as never);

		const completions = data.activityLog.filter((entry) => entry.type === 'quest_completed' && entry.questId === 'd23a-6cfb-4945-afe3-ecd6ea596e0c');
		expect(completions).toHaveLength(1);
		expect(data.xp.total).toBe(24);
		expect(data.markdownSyncState?.fileStates['Projects/Board.md::d23a-6cfb-4945-afe3-ecd6ea596e0c']).toBe(true);
		expect(data.markdownSyncState?.fileStates['Kanban/Sprint.md::d23a-6cfb-4945-afe3-ecd6ea596e0c']).toBe(true);
	});

	it('treats any checked source as the winning state during startup conflicts', async () => {
		const data = makeData();
		data.settings.language = 'en';
		data.settings.markdownSyncScope = 'folders';
		data.settings.markdownSyncFolders = ['Projects', 'Kanban'];
		data.quests = [
			makeQuest({
				id: 'd23a-6cfb-4945-afe3-ecd6ea596e0c',
				title: 'Conflict quest',
			}),
		];

		const plugin = makePlugin(data, [
			{
				file: makeFile('Projects/Board.md'),
				content: '- [ ] Conflict quest #lq-d23a-6cfb-4945-afe3-ecd6ea596e0c',
			},
			{
				file: makeFile('Kanban/Sprint.md'),
				content: '- [x] Conflict quest #lq-d23a-6cfb-4945-afe3-ecd6ea596e0c',
			},
		]);

		await syncTrackedQuestFiles(plugin as never);

		const completions = data.activityLog.filter((entry) => entry.type === 'quest_completed' && entry.questId === 'd23a-6cfb-4945-afe3-ecd6ea596e0c');
		expect(completions).toHaveLength(1);
		expect(data.markdownSyncState?.fileStates['Projects/Board.md::d23a-6cfb-4945-afe3-ecd6ea596e0c']).toBe(false);
		expect(data.markdownSyncState?.fileStates['Kanban/Sprint.md::d23a-6cfb-4945-afe3-ecd6ea596e0c']).toBe(true);
	});

	it('persists snapshot state even when no reward is applied', async () => {
		const data = makeData();
		data.settings.language = 'en';
		data.settings.markdownSyncScope = 'folders';
		data.settings.markdownSyncFolders = ['Projects'];
		data.quests = [
			makeQuest({
				id: 'd23a-6cfb-4945-afe3-ecd6ea596e0c',
				title: 'Unchecked quest',
			}),
		];

		const plugin = makePlugin(data, [
			{
				file: makeFile('Projects/Board.md'),
				content: '- [ ] Unchecked quest #lq-d23a-6cfb-4945-afe3-ecd6ea596e0c',
			},
		]);

		await syncTrackedQuestFiles(plugin as never);

		expect(data.activityLog).toHaveLength(0);
		expect(data.markdownSyncState?.fileStates['Projects/Board.md::d23a-6cfb-4945-afe3-ecd6ea596e0c']).toBe(false);
		expect(plugin.__save).toHaveBeenCalled();
	});
});
