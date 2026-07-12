import { App, Notice } from 'obsidian';
import {
	LifequestData,
	DEFAULT_DATA,
	localizeDefaultHeroClasses,
	localizeDefaultLifeAreas,
	localizeDefaultShopRewards,
	localizeHeroNameIfDefault,
} from './types';
import { getLang, pick } from './i18n';

const DATA_FOLDER = '_LifeQuest';
const DATA_FILE = `${DATA_FOLDER}/data.json`;

function clampNumber(value: number, min: number, max: number, fallback: number): number {
	const safe = Number.isFinite(value) ? value : fallback;
	return Math.min(max, Math.max(min, safe));
}

function clampInt(value: number, min: number, max: number, fallback: number): number {
	return Math.round(clampNumber(value, min, max, fallback));
}

function cloneDefaultData(): LifequestData {
	return structuredClone(DEFAULT_DATA);
}

type LegacySettings = typeof DEFAULT_DATA.settings & {
	sourceUrl?: string;
	coinEarnNotifications?: boolean;
	coinMultiplier?: number;
	coinLevelUpBase?: number;
	coinLevelUpFactor?: number;
	coinBadgeCommon?: number;
	coinBadgeEpic?: number;
	coinMilestones?: {
		streak7?: number;
		streak30?: number;
		streak100?: number;
	};
};

type LegacyProfile = typeof DEFAULT_DATA.profile & {
	class?: string;
};

export function normalizeQuestHierarchy(data: LifequestData): void {
	const normalizedQuests = data.quests.map((quest, index) => ({
		...quest,
		parentQuestId: typeof quest.parentQuestId === 'string' && quest.parentQuestId.trim() ? quest.parentQuestId : null,
		sortOrder: Number.isFinite(quest.sortOrder) ? quest.sortOrder : index,
		isCollapsed: typeof quest.isCollapsed === 'boolean' ? quest.isCollapsed : false,
	}));
	const questById = new Map(normalizedQuests.map((quest) => [quest.id, quest]));

	for (const quest of normalizedQuests) {
		if (!quest.parentQuestId) {
			continue;
		}

		const parent = questById.get(quest.parentQuestId);
		const parentIsRoot = parent ? !parent.parentQuestId : false;
		const parentIsActive = parent ? parent.status !== 'retired' : false;
		const isValidParent = Boolean(parent) && parent?.id !== quest.id && parentIsRoot && parentIsActive;

		if (!isValidParent) {
			quest.parentQuestId = null;
		}
	}

	const roots = normalizedQuests
		.filter((quest) => !quest.parentQuestId)
		.sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt));

	roots.forEach((quest, index) => {
		quest.sortOrder = index;
	});

	const orderedQuests = [...roots];

	for (const root of roots) {
		const children = normalizedQuests
			.filter((quest) => quest.parentQuestId === root.id)
			.sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt));

		children.forEach((quest, index) => {
			quest.sortOrder = index;
			quest.isCollapsed = false;
		});

		orderedQuests.push(...children);
	}

	data.quests = orderedQuests;
}

export function sanitizeData(data: LifequestData): LifequestData {
	data.xp.total = Math.max(0, data.xp.total);
	const lang = data.settings.language ?? DEFAULT_DATA.settings.language;
	data.profile.heroName = localizeHeroNameIfDefault(data.profile.heroName, lang);
	data.settings.lifeAreas = localizeDefaultLifeAreas(data.settings.lifeAreas, lang);
	data.settings.heroClasses = localizeDefaultHeroClasses(data.settings.heroClasses, lang);
	if (data.shop) {
		data.shop = localizeDefaultShopRewards(data.shop, lang);
	}
	data.settings.xpPerLevel = clampInt(data.settings.xpPerLevel, 100, 2000, DEFAULT_DATA.settings.xpPerLevel);
	data.settings.rewardSettings.multiplier = clampNumber(data.settings.rewardSettings.multiplier, 0.5, 3.0, DEFAULT_DATA.settings.rewardSettings.multiplier);
	data.settings.rewardSettings.levelUp.base = clampInt(data.settings.rewardSettings.levelUp.base, 0, 500, DEFAULT_DATA.settings.rewardSettings.levelUp.base);
	data.settings.rewardSettings.levelUp.factor = clampInt(data.settings.rewardSettings.levelUp.factor, 0, 100, DEFAULT_DATA.settings.rewardSettings.levelUp.factor);
	data.settings.rewardSettings.badges.common = clampInt(data.settings.rewardSettings.badges.common, 0, 200, DEFAULT_DATA.settings.rewardSettings.badges.common);
	data.settings.rewardSettings.badges.epic = clampInt(data.settings.rewardSettings.badges.epic, 0, 500, DEFAULT_DATA.settings.rewardSettings.badges.epic);
	data.settings.rewardSettings.streakMilestones.streak7 = clampInt(data.settings.rewardSettings.streakMilestones.streak7, 0, 300, DEFAULT_DATA.settings.rewardSettings.streakMilestones.streak7);
	data.settings.rewardSettings.streakMilestones.streak30 = clampInt(data.settings.rewardSettings.streakMilestones.streak30, 0, 700, DEFAULT_DATA.settings.rewardSettings.streakMilestones.streak30);
	data.settings.rewardSettings.streakMilestones.streak100 = clampInt(data.settings.rewardSettings.streakMilestones.streak100, 0, 1500, DEFAULT_DATA.settings.rewardSettings.streakMilestones.streak100);
	data.settings.rewardSettings.weeklyReview = clampInt(data.settings.rewardSettings.weeklyReview, 0, 300, DEFAULT_DATA.settings.rewardSettings.weeklyReview);
	data.settings.rewardSettings.perfectWeek = clampInt(data.settings.rewardSettings.perfectWeek, 0, 500, DEFAULT_DATA.settings.rewardSettings.perfectWeek);
	data.settings.rewardSettings.epicQuest = clampInt(data.settings.rewardSettings.epicQuest, 0, 200, DEFAULT_DATA.settings.rewardSettings.epicQuest);
	data.settings.rewardSettings.weighIn.base = clampInt(data.settings.rewardSettings.weighIn.base, 0, 200, DEFAULT_DATA.settings.rewardSettings.weighIn.base);
	data.settings.rewardSettings.weighIn.streak4 = clampInt(data.settings.rewardSettings.weighIn.streak4, 0, 300, DEFAULT_DATA.settings.rewardSettings.weighIn.streak4);
	data.settings.rewardSettings.weighIn.streak12 = clampInt(data.settings.rewardSettings.weighIn.streak12, 0, 500, DEFAULT_DATA.settings.rewardSettings.weighIn.streak12);
	normalizeQuestHierarchy(data);
	return data;
}

class LifequestStore {
	private app: App;
	private saveTimeout: number | null = null;
	private currentData: LifequestData | null = null;
	public onDataChanged?: () => void;
	
	constructor(app: App) {
		this.app = app;
	}
	
	async ensureFolder(): Promise<void> {
		const exists = await this.app.vault.adapter.exists(DATA_FOLDER);
		if (!exists) {
			await this.app.vault.adapter.mkdir(DATA_FOLDER);
		}
	}
	
	async load(): Promise<LifequestData> {
		await this.ensureFolder();
		
			const exists = await this.app.vault.adapter.exists(DATA_FILE);
			if (!exists) {
				this.currentData = cloneDefaultData();
				await this.save(this.currentData, true);
				return this.currentData;
			}
		
		try {
			const content = await this.app.vault.adapter.read(DATA_FILE);
			const data = JSON.parse(content) as LifequestData;
			
			// Simple version check/migration stub
				if (data.version !== DEFAULT_DATA.version) {
					console.debug(`LifeQuest: Migrating data from version ${data.version} to ${DEFAULT_DATA.version}`);
					data.version = DEFAULT_DATA.version;
				}
			
			// Fill in any missing default collections
			if (!data.quests) data.quests = [];
			if (!data.badges) data.badges = [];
			if (!data.activityLog) data.activityLog = [];
			if (!data.weeklyReviews) data.weeklyReviews = {};

			// Migrate Settings
			if (!data.settings) data.settings = { ...DEFAULT_DATA.settings };
			if (typeof data.settings.onboardingCompleted !== 'boolean') {
				data.settings.onboardingCompleted = true;
			}
			if (typeof data.settings.dailyNoteTemplate !== 'string' || data.settings.dailyNoteTemplate.trim() === '') {
				data.settings.dailyNoteTemplate = DEFAULT_DATA.settings.dailyNoteTemplate;
			}
			if (typeof data.settings.dailyNoteGroupByArea !== 'boolean') {
				data.settings.dailyNoteGroupByArea = DEFAULT_DATA.settings.dailyNoteGroupByArea;
			}
			if (typeof data.settings.dailyNoteOnlyPending !== 'boolean') {
				data.settings.dailyNoteOnlyPending = DEFAULT_DATA.settings.dailyNoteOnlyPending;
			}
			if (
				data.settings.markdownSyncScope !== 'daily-note' &&
				data.settings.markdownSyncScope !== 'folders' &&
				data.settings.markdownSyncScope !== 'vault'
			) {
				data.settings.markdownSyncScope = DEFAULT_DATA.settings.markdownSyncScope;
			}
			if (!Array.isArray(data.settings.markdownSyncFolders)) {
				data.settings.markdownSyncFolders = [...DEFAULT_DATA.settings.markdownSyncFolders];
			}
			if (!Array.isArray(data.settings.markdownSyncExcludedFolders)) {
				data.settings.markdownSyncExcludedFolders = [...DEFAULT_DATA.settings.markdownSyncExcludedFolders];
			}
			if (!data.settings.dailyMessage) {
				data.settings.dailyMessage = { ...DEFAULT_DATA.settings.dailyMessage };
			} else {
					const legacyDailyMessage = data.settings.dailyMessage as typeof data.settings.dailyMessage & { sourceUrl?: string };
				data.settings.dailyMessage = {
					...DEFAULT_DATA.settings.dailyMessage,
					...data.settings.dailyMessage,
					sourceUrls: {
						...DEFAULT_DATA.settings.dailyMessage.sourceUrls,
						...data.settings.dailyMessage.sourceUrls,
					},
				};
				if (legacyDailyMessage.sourceUrl && !data.settings.dailyMessage.sourceUrls.es && !data.settings.dailyMessage.sourceUrls.en) {
					data.settings.dailyMessage.sourceUrls.es = legacyDailyMessage.sourceUrl;
					data.settings.dailyMessage.sourceUrls.en = legacyDailyMessage.sourceUrl;
				}
			}
			if (typeof data.settings.shopEnabled !== 'boolean') {
				data.settings.shopEnabled = DEFAULT_DATA.settings.shopEnabled;
			}
				const legacySettings = data.settings as LegacySettings;
			if (!data.settings.rewardSettings) {
				data.settings.rewardSettings = {
					notificationsEnabled: legacySettings.coinEarnNotifications ?? DEFAULT_DATA.settings.rewardSettings.notificationsEnabled,
					multiplier: legacySettings.coinMultiplier ?? DEFAULT_DATA.settings.rewardSettings.multiplier,
					levelUp: {
						base: legacySettings.coinLevelUpBase ?? DEFAULT_DATA.settings.rewardSettings.levelUp.base,
						factor: legacySettings.coinLevelUpFactor ?? DEFAULT_DATA.settings.rewardSettings.levelUp.factor,
					},
					badges: {
						common: legacySettings.coinBadgeCommon ?? DEFAULT_DATA.settings.rewardSettings.badges.common,
						epic: legacySettings.coinBadgeEpic ?? DEFAULT_DATA.settings.rewardSettings.badges.epic,
					},
					streakMilestones: {
						streak7: legacySettings.coinMilestones?.streak7 ?? DEFAULT_DATA.settings.rewardSettings.streakMilestones.streak7,
						streak30: legacySettings.coinMilestones?.streak30 ?? DEFAULT_DATA.settings.rewardSettings.streakMilestones.streak30,
						streak100: legacySettings.coinMilestones?.streak100 ?? DEFAULT_DATA.settings.rewardSettings.streakMilestones.streak100,
					},
					weeklyReview: DEFAULT_DATA.settings.rewardSettings.weeklyReview,
					perfectWeek: DEFAULT_DATA.settings.rewardSettings.perfectWeek,
					epicQuest: DEFAULT_DATA.settings.rewardSettings.epicQuest,
					weighIn: { ...DEFAULT_DATA.settings.rewardSettings.weighIn },
				};
			} else {
				data.settings.rewardSettings = {
					...DEFAULT_DATA.settings.rewardSettings,
					...data.settings.rewardSettings,
					levelUp: {
						...DEFAULT_DATA.settings.rewardSettings.levelUp,
						...data.settings.rewardSettings.levelUp,
					},
					badges: {
						...DEFAULT_DATA.settings.rewardSettings.badges,
						...data.settings.rewardSettings.badges,
					},
					streakMilestones: {
						...DEFAULT_DATA.settings.rewardSettings.streakMilestones,
						...data.settings.rewardSettings.streakMilestones,
					},
					weighIn: {
						...DEFAULT_DATA.settings.rewardSettings.weighIn,
						...data.settings.rewardSettings.weighIn,
					},
				};
			}
			if (!data.settings.healthModules) {
				data.settings.healthModules = { ...DEFAULT_DATA.settings.healthModules };
			} else {
				data.settings.healthModules = {
					...DEFAULT_DATA.settings.healthModules,
					...data.settings.healthModules,
				};
			}
			if (!data.settings.heroClasses || data.settings.heroClasses.length === 0) {
				data.settings.heroClasses = [ ...DEFAULT_DATA.settings.heroClasses ];
			}
			if (!data.settings.lifeAreas || data.settings.lifeAreas.length === 0) {
				data.settings.lifeAreas = [ ...DEFAULT_DATA.settings.lifeAreas ];
			}

			// Migrate Profile
			if (!data.profile) data.profile = { ...DEFAULT_DATA.profile };
			const legacyProfile = data.profile as LegacyProfile;
			if (!legacyProfile.classId && legacyProfile.class) {
				data.profile.classId = legacyProfile.class;
			}
			if (!data.profile.classId) data.profile.classId = 'explorer';
			if (!data.markdownSyncState) {
				data.markdownSyncState = structuredClone(DEFAULT_DATA.markdownSyncState);
			} else {
				data.markdownSyncState = {
					fileStates: typeof data.markdownSyncState.fileStates === 'object' && data.markdownSyncState.fileStates
						? data.markdownSyncState.fileStates
						: {},
					updatedAt: typeof data.markdownSyncState.updatedAt === 'string'
						? data.markdownSyncState.updatedAt
						: DEFAULT_DATA.markdownSyncState?.updatedAt ?? new Date(0).toISOString(),
				};
			}
			
			this.currentData = sanitizeData(data);
			return this.currentData;
		} catch (error) {
			console.error("LifeQuest: Failed to parse data.json", error);
			
			const dateStr = new Date().toISOString().split('T')[0];
			const backupFile = `${DATA_FOLDER}/data.backup.${dateStr}.json`;
			
			const content = await this.app.vault.adapter.read(DATA_FILE);
			await this.app.vault.adapter.write(backupFile, content);
			
			const lang = getLang(this.currentData ?? DEFAULT_DATA);
			new Notice(pick(lang, 'LifeQuest: Error de datos. Se creó un respaldo.', 'LifeQuest: Data error. Backup created.'));
			
			this.currentData = cloneDefaultData();
			await this.save(this.currentData, true);
			return this.currentData;
		}
	}
	
	save(data: LifequestData, immediate = false): Promise<void> {
		this.currentData = data;
		
		return new Promise((resolve) => {
			if (this.saveTimeout !== null) {
				window.clearTimeout(this.saveTimeout);
			}
			
			const performSave = async () => {
				await this.ensureFolder();
				
				// Apply invariants
				sanitizeData(data);
				if (data.activityLog.length > 500) {
					// Keep the 500 most recent
					data.activityLog = data.activityLog.slice(-500);
				}
				
				await this.app.vault.adapter.write(DATA_FILE, JSON.stringify(data, null, 2));
				this.onDataChanged?.();
				this.saveTimeout = null;
				resolve();
			};
			
			if (immediate) {
				void performSave();
			} else {
				this.saveTimeout = window.setTimeout(() => {
					void performSave();
				}, 300);
			}
		});
	}
	
	// Flush any pending saves
	async flush(): Promise<void> {
		if (this.saveTimeout !== null && this.currentData) {
			window.clearTimeout(this.saveTimeout);
			this.saveTimeout = null;
			
			await this.ensureFolder();
			sanitizeData(this.currentData);
			if (this.currentData.activityLog.length > 500) {
				this.currentData.activityLog = this.currentData.activityLog.slice(-500);
			}
			await this.app.vault.adapter.write(DATA_FILE, JSON.stringify(this.currentData, null, 2));
		}
	}
}

let instance: LifequestStore | null = null;

export function initStore(app: App): LifequestStore {
	instance = new LifequestStore(app);
	return instance;
}

export function getStore(): LifequestStore {
	if (!instance) {
		throw new Error("LifequestStore not initialized. Call initStore(app) first.");
	}
	return instance;
}
