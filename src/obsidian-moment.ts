import { moment as obsidianMoment } from 'obsidian';

type MomentUnit = 'day' | 'days' | 'week' | 'weeks' | 'month' | 'months' | 'isoWeek';

export interface MomentLike {
	format(pattern: string): string;
	locale(locale: string): MomentLike;
	fromNow(): string;
	isoWeekday(): number;
	date(): number;
	diff(input: string | Date | MomentLike, unit?: string): number;
	add(amount: number, unit: MomentUnit): MomentLike;
	subtract(amount: number, unit: MomentUnit): MomentLike;
	startOf(unit: 'day' | 'isoWeek'): MomentLike;
	endOf(unit: 'day' | 'isoWeek'): MomentLike;
	clone(): MomentLike;
	toISOString(): string;
}

type MomentFactory = (input?: string | Date) => MomentLike;

const momentFactory = obsidianMoment as unknown as MomentFactory;

export function moment(input?: string | Date): MomentLike {
	return momentFactory(input);
}
