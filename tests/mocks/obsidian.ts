export class TFile {}

export class App {}

export class Notice {
	message: string;
	timeout?: number;

	constructor(message: string, timeout?: number) {
		this.message = message;
		this.timeout = timeout;
	}
}

type MomentLike = {
	format: (pattern?: string) => string;
	isoWeekday: () => number;
	date: () => number;
	subtract: (amount: number, unit: string) => MomentLike;
	startOf: (unit: string) => MomentLike;
	endOf: (unit: string) => MomentLike;
	diff: (other: MomentLike | string, unit: string) => number;
	toISOString: () => string;
};

function createMoment(input?: string | Date): MomentLike {
	const date = input instanceof Date ? new Date(input) : new Date(input ?? Date.now());

	const api: MomentLike = {
		format(pattern = 'YYYY-MM-DD') {
			const year = date.getFullYear();
			const month = String(date.getMonth() + 1).padStart(2, '0');
			const day = String(date.getDate()).padStart(2, '0');
			if (pattern === 'YYYY-MM-DD') return `${year}-${month}-${day}`;
			return `${year}-${month}-${day}`;
		},
		isoWeekday() {
			const day = date.getDay();
			return day === 0 ? 7 : day;
		},
		date() {
			return date.getDate();
		},
		subtract(amount: number, unit: string) {
			const next = new Date(date);
			if (unit === 'day' || unit === 'days') {
				next.setDate(next.getDate() - amount);
			}
			return createMoment(next);
		},
		startOf(unit: string) {
			const next = new Date(date);
			if (unit === 'day') {
				next.setHours(0, 0, 0, 0);
			}
			return createMoment(next);
		},
		endOf(unit: string) {
			const next = new Date(date);
			if (unit === 'day') {
				next.setHours(23, 59, 59, 999);
			}
			return createMoment(next);
		},
		diff(other: MomentLike | string, unit: string) {
			const otherDate = typeof other === 'string' ? new Date(other) : new Date(other.toISOString());
			const ms = date.getTime() - otherDate.getTime();
			if (unit === 'days') {
				return Math.floor(ms / (1000 * 60 * 60 * 24));
			}
			return ms;
		},
		toISOString() {
			return date.toISOString();
		},
	};

	return api;
}

export function moment(input?: string | Date): MomentLike {
	return createMoment(input);
}

export async function requestUrl(): Promise<{ text: string }> {
	return { text: '' };
}
