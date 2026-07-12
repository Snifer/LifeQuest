export interface LifequestData {
	version: string;
	profile: Profile;
	xp: XPState;
	streak: StreakState;
	quests: Quest[];
	badges: Badge[];
	activityLog: LogEntry[];
	weeklyReviews: Record<string, WeeklyReview>;
	coins?: CoinState;
	shop?: ShopReward[];
	health?: HealthState;
	markdownSyncState?: MarkdownSyncStateSnapshot;
	settings: PluginSettings;
	lastPenaltyCheck?: string; // ISO date
}

export interface Profile {
	heroName: string;
	motto: string;
	avatarBase64: string | null;
	accentColor: string; // hex, e.g. '#7F77DD'
	classId: string; // References PluginSettings.heroClasses.id
	classChangedAt: string | null; // ISO date
}

export interface XPState {
	total: number;
	level: number;
	todayGained: number;
	todayDate: string; // ISO date
}

export interface StreakState {
	current: number;
	longest: number;
	lastActiveDate: string; // ISO date
}

export interface Quest {
	id: string; // UUID v4
	parentQuestId?: string | null;
	sortOrder: number;
	isCollapsed?: boolean;
	title: string;
	area: string; // References LifeArea.id
	frequency: 'daily' | 'weekly' | 'monthly' | 'free';
	xp: number; // 5-100
	penalty: number; // 0-50
	difficulty: 'easy' | 'normal' | 'hard' | 'epic';
	reminder: 'none' | 'morning' | 'evening' | 'custom';
	reminderTime?: string; // HH:MM, if reminder is 'custom'
	note?: string; // max 80 chars
	status: 'active' | 'paused' | 'retired';
	createdAt: string; // ISO date
	pausedAt?: string; // ISO date
	lastModifiedAt: string; // ISO date
}

export interface Badge {
	id: string;
	name: string;
	description: string;
	xpBonus: number;
	unlockedAt: string; // ISO date
	type: 'unique' | 'repeatable';
}

export interface LogEntry {
	id: string; // UUID v4
	type: 'quest_completed' | 'quest_failed' | 'badge_unlocked' | 'level_up' | 'multiplier_activated';
	description: string;
	xp: number; // positive or negative
	questId?: string; // if type is related to a quest
	timestamp: string; // ISO date/time
}

export interface WeeklyReview {
	weekKey: string; // YYYY-WNN
	mood: 'agotado' | 'regular' | 'bien' | 'genial' | 'en llamas';
	wentWell: string;
	toImprove: string;
	intention: string;
	stats: WeeklyStats;
	insights: Insight[];
	generatedAt: string; // ISO date
}

export interface WeeklyStats {
	xpTotal: number;
	completed: number;
	failed: number;
	successRate: number; // 0-100
	xpByDay: number[]; // 7 elements, Mon-Sun
	areaStats: AreaStat[];
	questStats: QuestStat[];
}

export interface AreaStat {
	areaId: string;
	name: string;
	successRate: number; // 0-100
	delta: number; // percentage diff vs last week
}

export interface QuestStat {
	questId: string;
	title: string;
	completedDays: number;
	totalDays: number;
	successRate: number; // 0-100
	suggestion: AdjustmentSuggestion;
}

export type AdjustmentSuggestion = 'increase_difficulty' | 'maintain' | 'review_goal' | 'adjust_or_pause';

export interface Insight {
	type: 'best_day' | 'declining_area' | 'streak_milestone' | 'strong_area' | 'abandoned_quest';
	title: string;
	description: string;
}

// ── Shop & Coins ─────────────────────────────────────────────────────────────

export type RewardCategory = 'bienestar' | 'ocio' | 'social' | 'logros';

export interface ShopReward {
	id: string;
	name: string;
	description: string;
	emoji: string;
	category: RewardCategory;
	cost: number;
	timesRedeemed: number;
	maxRedemptions: number; // 0 = unlimited
	createdAt: string; // YYYY-MM-DD
	isDefault: boolean;
}

export type CoinEarnReason =
	| 'level_up'
	| 'badge_common'
	| 'badge_epic'
	| 'perfect_week'
	| 'streak_milestone'
	| 'weekly_review'
	| 'epic_quest';

export type CoinSpendReason = 'redeem_reward';

export interface CoinEntry {
	id: string;
	type: 'earn' | 'spend';
	amount: number;
	reason: CoinEarnReason | CoinSpendReason;
	label: string;
	rewardId?: string;
	timestamp: string; // ISO
}

export interface CoinState {
	balance: number;
	totalEarned: number;
	totalSpent: number;
	ledger: CoinEntry[];
}

export interface LifeArea {
	id: string;
	name: string;
	color: string; // hex
}

export interface HeroClass {
	id: string;
	name: string;
	bonusAreaId: string; // The LifeArea.id that gets 20% bonus
	description: string;
}

export interface RewardSettings {
	notificationsEnabled: boolean;
	multiplier: number;
	levelUp: {
		base: number;
		factor: number;
	};
	badges: {
		common: number;
		epic: number;
	};
	streakMilestones: {
		streak7: number;
		streak30: number;
		streak100: number;
	};
	weeklyReview: number;
	perfectWeek: number;
	epicQuest: number;
	weighIn: {
		base: number;
		streak4: number;
		streak12: number;
	};
}

export type DailyMessageMode = 'random_daily' | 'day_of_year';

export interface DailyMessageSettings {
	enabled: boolean;
	mode: DailyMessageMode;
	sourceUrls: {
		es: string;
		en: string;
	};
}

export interface MarkdownSyncStateSnapshot {
	fileStates: Record<string, boolean>;
	updatedAt: string;
}

export interface PluginSettings {
	language: 'en' | 'es';
	onboardingCompleted: boolean;
	messagesTone: 'motivating' | 'neutral' | 'stoic' | 'humorous';
	eveningReminder: boolean;
	streakAlert: boolean;
	lifeAreas: LifeArea[];
	heroClasses: HeroClass[];
	dailyNoteFormat: string;
	dailyNoteTemplate: string;
	dailyNoteGroupByArea: boolean;
	dailyNoteOnlyPending: boolean;
	markdownSyncScope: 'daily-note' | 'folders' | 'vault';
	markdownSyncFolders: string[];
	markdownSyncExcludedFolders: string[];
	dailyMessage: DailyMessageSettings;
	coinsEnabled: boolean;
	shopEnabled: boolean;
	showCoinsInDashboard: boolean;
	rewardSettings: RewardSettings;
	xpPerLevel: number;
	autoCompleteParentQuests: boolean;
	healthEnabled: boolean;
	healthModules: {
		weight: boolean;
		bloodPressure: boolean;
		medications: boolean;
	};
}

type LocalizedDefaultsLanguage = 'en' | 'es';

const DEFAULT_HERO_NAMES: Record<LocalizedDefaultsLanguage, string> = {
	en: 'Hero',
	es: 'Héroe',
};

const DEFAULT_LIFE_AREAS: Record<LocalizedDefaultsLanguage, LifeArea[]> = {
	en: [
		{ id: 'health', name: 'Health', color: '#E05A47' },
		{ id: 'work', name: 'Work', color: '#478EE0' },
		{ id: 'learning', name: 'Learning', color: '#E0B347' },
		{ id: 'relationships', name: 'Relationships', color: '#9A47E0' },
		{ id: 'finances', name: 'Finances', color: '#47E082' },
	],
	es: [
		{ id: 'health', name: 'Salud', color: '#E05A47' },
		{ id: 'work', name: 'Trabajo', color: '#478EE0' },
		{ id: 'learning', name: 'Aprendizaje', color: '#E0B347' },
		{ id: 'relationships', name: 'Relaciones', color: '#9A47E0' },
		{ id: 'finances', name: 'Finanzas', color: '#47E082' },
	],
};

const DEFAULT_HERO_CLASSES: Record<LocalizedDefaultsLanguage, HeroClass[]> = {
	en: [
		{ id: 'explorer', name: 'Explorer', bonusAreaId: 'learning', description: 'Bonus in Learning' },
		{ id: 'warrior', name: 'Warrior', bonusAreaId: 'health', description: 'Bonus in Health' },
		{ id: 'artisan', name: 'Artisan', bonusAreaId: 'work', description: 'Bonus in Work' },
		{ id: 'diplomat', name: 'Diplomat', bonusAreaId: 'relationships', description: 'Bonus in Relationships' },
	],
	es: [
		{ id: 'explorer', name: 'Explorador', bonusAreaId: 'learning', description: 'Bono en Aprendizaje' },
		{ id: 'warrior', name: 'Guerrero', bonusAreaId: 'health', description: 'Bono en Salud' },
		{ id: 'artisan', name: 'Artesano', bonusAreaId: 'work', description: 'Bono en Trabajo' },
		{ id: 'diplomat', name: 'Diplomático', bonusAreaId: 'relationships', description: 'Bono en Relaciones' },
	],
};

const DEFAULT_SHOP_REWARDS: Record<LocalizedDefaultsLanguage, ShopReward[]> = {
	en: [
		{ id: 'default-1', name: 'Watch an episode guilt-free', description: 'One hour of a show just for yourself', emoji: '🎬', category: 'ocio', cost: 30, timesRedeemed: 0, maxRedemptions: 0, createdAt: '2024-01-01', isDefault: true },
		{ id: 'default-2', name: 'Special coffee from the café', description: 'The one I love but do not always buy', emoji: '☕', category: 'bienestar', cost: 50, timesRedeemed: 0, maxRedemptions: 0, createdAt: '2024-01-01', isDefault: true },
		{ id: 'default-3', name: 'Video game afternoon (2h)', description: 'No clock-watching, just enjoy it', emoji: '🎮', category: 'ocio', cost: 80, timesRedeemed: 0, maxRedemptions: 0, createdAt: '2024-01-01', isDefault: true },
		{ id: 'default-4', name: 'Order delivery food', description: 'No cooking that day', emoji: '🍕', category: 'ocio', cost: 120, timesRedeemed: 0, maxRedemptions: 0, createdAt: '2024-01-01', isDefault: true },
		{ id: 'default-5', name: 'Bath with music', description: 'A full relaxation ritual', emoji: '🛁', category: 'bienestar', cost: 40, timesRedeemed: 0, maxRedemptions: 0, createdAt: '2024-01-01', isDefault: true },
		{ id: 'default-6', name: 'A free day with no schedule', description: 'No goals, no quests, just exist', emoji: '🏖️', category: 'logros', cost: 200, timesRedeemed: 0, maxRedemptions: 0, createdAt: '2024-01-01', isDefault: true },
		{ id: 'default-7', name: 'New book or movie', description: 'Buy something I wanted for a while', emoji: '📚', category: 'ocio', cost: 70, timesRedeemed: 0, maxRedemptions: 0, createdAt: '2024-01-01', isDefault: true },
		{ id: 'default-8', name: 'Hangout with friends', description: 'Plan a night out', emoji: '🎉', category: 'social', cost: 150, timesRedeemed: 0, maxRedemptions: 0, createdAt: '2024-01-01', isDefault: true },
	],
	es: [
		{ id: 'default-1', name: 'Ver un episodio sin culpa', description: 'Una hora de serie contigo mismo', emoji: '🎬', category: 'ocio', cost: 30, timesRedeemed: 0, maxRedemptions: 0, createdAt: '2024-01-01', isDefault: true },
		{ id: 'default-2', name: 'Café especial de la cafetería', description: 'El que me gusta pero no compro siempre', emoji: '☕', category: 'bienestar', cost: 50, timesRedeemed: 0, maxRedemptions: 0, createdAt: '2024-01-01', isDefault: true },
		{ id: 'default-3', name: 'Tarde de videojuegos (2h)', description: 'Sin mirar el reloj, solo disfrute', emoji: '🎮', category: 'ocio', cost: 80, timesRedeemed: 0, maxRedemptions: 0, createdAt: '2024-01-01', isDefault: true },
		{ id: 'default-4', name: 'Pedir comida a domicilio', description: 'Sin cocinar ese día', emoji: '🍕', category: 'ocio', cost: 120, timesRedeemed: 0, maxRedemptions: 0, createdAt: '2024-01-01', isDefault: true },
		{ id: 'default-5', name: 'Baño de tina con música', description: 'Ritual de relajación completo', emoji: '🛁', category: 'bienestar', cost: 40, timesRedeemed: 0, maxRedemptions: 0, createdAt: '2024-01-01', isDefault: true },
		{ id: 'default-6', name: 'Día libre sin agenda', description: 'Sin metas, sin quests, solo existir', emoji: '🏖️', category: 'logros', cost: 200, timesRedeemed: 0, maxRedemptions: 0, createdAt: '2024-01-01', isDefault: true },
		{ id: 'default-7', name: 'Nuevo libro o película', description: 'Comprar algo que quería hace tiempo', emoji: '📚', category: 'ocio', cost: 70, timesRedeemed: 0, maxRedemptions: 0, createdAt: '2024-01-01', isDefault: true },
		{ id: 'default-8', name: 'Salida con amigos', description: 'Planear una noche de salida', emoji: '🎉', category: 'social', cost: 150, timesRedeemed: 0, maxRedemptions: 0, createdAt: '2024-01-01', isDefault: true },
	],
};

export function getDefaultHeroName(lang: LocalizedDefaultsLanguage): string {
	return DEFAULT_HERO_NAMES[lang];
}

export function getDefaultLifeAreas(lang: LocalizedDefaultsLanguage): LifeArea[] {
	return DEFAULT_LIFE_AREAS[lang].map((area) => ({ ...area }));
}

export function getDefaultHeroClasses(lang: LocalizedDefaultsLanguage): HeroClass[] {
	return DEFAULT_HERO_CLASSES[lang].map((heroClass) => ({ ...heroClass }));
}

export function getDefaultShopRewards(lang: LocalizedDefaultsLanguage): ShopReward[] {
	return DEFAULT_SHOP_REWARDS[lang].map((reward) => ({ ...reward }));
}

export function localizeHeroNameIfDefault(heroName: string, lang: LocalizedDefaultsLanguage): string {
	return Object.values(DEFAULT_HERO_NAMES).includes(heroName) ? getDefaultHeroName(lang) : heroName;
}

export function localizeDefaultLifeAreas(areas: LifeArea[], lang: LocalizedDefaultsLanguage): LifeArea[] {
	const defaultsByLang = Object.values(DEFAULT_LIFE_AREAS).flat();
	const defaultsById = new Map(getDefaultLifeAreas(lang).map((area) => [area.id, area]));

	return areas.map((area) => {
		const target = defaultsById.get(area.id);
		if (!target) return area;
		const isDefaultName = defaultsByLang.some((defaultArea) => defaultArea.id === area.id && defaultArea.name === area.name);
		return isDefaultName ? { ...area, name: target.name, color: target.color } : area;
	});
}

export function localizeDefaultHeroClasses(heroClasses: HeroClass[], lang: LocalizedDefaultsLanguage): HeroClass[] {
	const defaultsByLang = Object.values(DEFAULT_HERO_CLASSES).flat();
	const defaultsById = new Map(getDefaultHeroClasses(lang).map((heroClass) => [heroClass.id, heroClass]));

	return heroClasses.map((heroClass) => {
		const target = defaultsById.get(heroClass.id);
		if (!target) return heroClass;
		const isDefaultCopy = defaultsByLang.some((defaultClass) =>
			defaultClass.id === heroClass.id &&
			defaultClass.name === heroClass.name &&
			defaultClass.description === heroClass.description
		);
		return isDefaultCopy ? { ...heroClass, name: target.name, description: target.description } : heroClass;
	});
}

export function localizeDefaultShopRewards(rewards: ShopReward[], lang: LocalizedDefaultsLanguage): ShopReward[] {
	const defaultsByLang = Object.values(DEFAULT_SHOP_REWARDS).flat();
	const defaultsById = new Map(getDefaultShopRewards(lang).map((reward) => [reward.id, reward]));

	return rewards.map((reward) => {
		const target = defaultsById.get(reward.id);
		if (!target || !reward.isDefault) return reward;
		const isDefaultCopy = defaultsByLang.some((defaultReward) =>
			defaultReward.id === reward.id &&
			defaultReward.name === reward.name &&
			defaultReward.description === reward.description
		);
		return isDefaultCopy ? { ...reward, name: target.name, description: target.description } : reward;
	});
}

export const DEFAULT_DATA: LifequestData = {
	version: "1.0.3",
	profile: {
		heroName: getDefaultHeroName('en'),
		motto: "",
		avatarBase64: null,
		accentColor: "#7F77DD",
		classId: "explorer",
		classChangedAt: null
	},
	xp: {
		total: 0,
		level: 1,
		todayGained: 0,
		todayDate: "1970-01-01"
	},
	streak: {
		current: 0,
		longest: 0,
		lastActiveDate: "1970-01-01"
	},
	quests: [],
	badges: [],
	activityLog: [],
	weeklyReviews: {},
	settings: {
		language: "en",
		onboardingCompleted: false,
		messagesTone: "motivating",
		eveningReminder: true,
		streakAlert: true,
		dailyNoteFormat: "YYYY-MM-DD",
		dailyNoteTemplate: "{title}\n{content}",
		dailyNoteGroupByArea: false,
		dailyNoteOnlyPending: false,
		markdownSyncScope: 'daily-note',
		markdownSyncFolders: [],
		markdownSyncExcludedFolders: [],
		dailyMessage: {
			enabled: false,
			mode: "random_daily",
			sourceUrls: {
				es: "",
				en: "",
			},
		},
		coinsEnabled: true,
		shopEnabled: false,
		showCoinsInDashboard: false,
		rewardSettings: {
			notificationsEnabled: true,
			multiplier: 1.0,
			levelUp: { base: 50, factor: 10 },
			badges: { common: 20, epic: 75 },
			streakMilestones: { streak7: 30, streak30: 100, streak100: 300 },
			weeklyReview: 15,
			perfectWeek: 40,
			epicQuest: 10,
			weighIn: { base: 10, streak4: 20, streak12: 30 },
		},
		xpPerLevel: 500,
		autoCompleteParentQuests: false,
		healthEnabled: false,
		healthModules: {
			weight: true,
			bloodPressure: true,
			medications: true,
		},
		lifeAreas: getDefaultLifeAreas('en'),
		heroClasses: getDefaultHeroClasses('en')
	},
	markdownSyncState: {
		fileStates: {},
		updatedAt: "1970-01-01T00:00:00.000Z"
	},
	health: {
		enabled: false,
		profile: null,
		entries: [],
		bpEntries: [],
		medications: [],
		medLogs: []
	},
	coins: {
		balance: 0,
		totalEarned: 0,
		totalSpent: 0,
		ledger: [],
	},
	shop: getDefaultShopRewards('en')
};

// ─── MÓDULO DE SALUD ──────────────────────────────────────────────

// Unidades de medida soportadas
export type WeightUnit = 'kg' | 'lb';
export type HeightUnit = 'cm' | 'ft';

// Tipo de meta corporal
export type BodyGoalType =
  | 'lose_weight'      // pérdida de peso
  | 'gain_weight'      // ganancia de peso / masa
  | 'maintain'         // mantenimiento
  | 'body_recomp';     // recomposición corporal (perder grasa, ganar músculo)

// Configuración inicial del perfil de salud
export interface HealthProfile {
  // Datos biométricos base
  birthDate: string;           // ISO date YYYY-MM-DD — para calcular edad
  biologicalSex: 'male' | 'female' | 'prefer_not_to_say';
  heightValue: number;         // en la unidad de heightUnit
  heightUnit: HeightUnit;
  weightUnit: WeightUnit;

  // Meta
  goalType: BodyGoalType;
  targetWeight: number;        // en weightUnit — la meta que el usuario define
  targetDate: string | null;   // ISO date — fecha objetivo (opcional)
  weeklyGoalKg: number;        // ritmo semanal deseado: 0.25 | 0.5 | 0.75 | 1.0 kg/semana

  // Configuración de registro
  weighInDay: 0 | 1 | 2 | 3 | 4 | 5 | 6;  // día de la semana (0=Dom, 1=Lun, …)
  weighInReminder: boolean;
  setupCompletedAt: string;    // ISO date — fecha en que completó el setup
}

// Un registro de peso individual
export interface WeightEntry {
  id: string;                  // UUID v4
  date: string;                // ISO date del día del registro
  weightValue: number;         // en la unidad de healthProfile.weightUnit
  weekNumber: number;          // semana ISO (1–53)
  year: number;
  note: string;                // opcional, max 80 chars
  bmi: number;                 // calculado y guardado en el momento del registro
}

// Registro diario de presión arterial
export interface BloodPressureEntry {
  id: string;
  date: string;       // ISO timestamp
  systolic: number;
  diastolic: number;
  pulse?: number;
  note?: string;
}

// Control de Medicamentos
export interface Medication {
  id: string;
  name: string;
  dosage: string;     // ej. "1 tableta"
  schedule: string;   // ej. "08:00, 20:00"
  inventory: number;  // cantidad real restante en pastillero/caja
  isActive: boolean;
}

export interface MedicationLog {
  id: string;
  medId: string;
  timestamp: string;  // ISO cuando se tomó
}

// Métricas calculadas (nunca persistidas — siempre recalculadas)
export interface HealthMetrics {
  currentWeight: number;       // último peso registrado
  startWeight: number;         // primer peso registrado
  targetWeight: number;        // de healthProfile
  bmi: number;                 // IMC actual
  bmiCategory: BMICategory;
  totalChange: number;         // cambio total desde el inicio (puede ser negativo)
  weeklyTrend: number;         // promedio de cambio/semana últimas 4 semanas
  progressPercent: number;     // 0–100% hacia la meta
  weeksToGoal: number | null;  // proyección — null si no hay tendencia suficiente
  projectedArrivalDate: string | null; // ISO date proyectada — null si no calculable
  streak: number;              // semanas consecutivas de registro
  totalWeighIns: number;
  missedWeighIns: number;      // semanas sin registro desde el inicio
}

// Categorías de IMC
export type BMICategory =
  | 'underweight'        // < 18.5
  | 'normal_range'       // 18.5 – 24.9
  | 'overweight'         // 25 – 29.9
  | 'obese_class_1'      // 30 – 34.9
  | 'obese_class_2'      // 35 – 39.9
  | 'obese_class_3';     // ≥ 40

// Estado completo del módulo de salud en data.json
export interface HealthState {
  enabled: boolean;            // false hasta que el usuario complete el setup
  profile: HealthProfile | null;
  entries: WeightEntry[];      // orden cronológico ascendente
  bpEntries: BloodPressureEntry[];
  medications: Medication[];
  medLogs: MedicationLog[];
}
