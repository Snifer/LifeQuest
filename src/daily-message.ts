import type { DailyMessageMode } from './types';
import type { SupportedLanguage } from './i18n';

export interface DailyMessageEntry {
	day?: number;
	text: string;
	author?: string;
}

export function normalizeGitHubRawUrl(url: string): string {
	const trimmed = url.trim();
	const blobMatch = trimmed.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/);
	if (blobMatch) {
		const [, owner, repo, branch, path] = blobMatch;
		return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
	}
	return trimmed;
}

export function resolveDailyMessageSourceUrl(
	sourceUrls: { es: string; en: string },
	lang: SupportedLanguage
): string {
	const preferred = sourceUrls[lang]?.trim();
	if (preferred) return normalizeGitHubRawUrl(preferred);
	const fallback = lang === 'es' ? sourceUrls.en?.trim() : sourceUrls.es?.trim();
	return fallback ? normalizeGitHubRawUrl(fallback) : '';
}

export function parseDailyMessageSource(content: string): DailyMessageEntry[] {
	const entries: DailyMessageEntry[] = [];
	const lines = content.split(/\r?\n/);

	for (const rawLine of lines) {
		const line = rawLine.trim();
		if (!line || line.startsWith('#')) continue;

		const normalized = line.replace(/^[-*]\s+/, '');
		let day: number | undefined;
		let text = '';
		let author = '';

		if (normalized.includes('|')) {
			const parts = normalized.split('|').map((part) => part.trim()).filter(Boolean);
			if (parts.length === 0) continue;
			if (/^\d{1,3}$/.test(parts[0] || '')) {
				day = parseInt(parts.shift() || '', 10);
			}
			text = parts.shift() || '';
			author = parts.join(' | ');
		} else if (normalized.includes('::')) {
			const parts = normalized.split('::').map((part) => part.trim()).filter(Boolean);
			if (parts.length === 0) continue;
			if (/^\d{1,3}$/.test(parts[0] || '')) {
				day = parseInt(parts.shift() || '', 10);
			}
			text = parts.shift() || '';
			author = parts.join(' :: ');
		} else {
			text = normalized;
		}

		if (!text) continue;
		if (typeof day === 'number' && (day < 1 || day > 366)) continue;
		entries.push({ day, text, author: author || undefined });
	}

	return entries;
}

function getDayOfYear(dateISO: string): number {
	const date = new Date(`${dateISO}T12:00:00`);
	const start = new Date(date.getFullYear(), 0, 0);
	const diff = date.getTime() - start.getTime();
	return Math.floor(diff / 86400000);
}

function hashString(value: string): number {
	let hash = 0;
	for (let i = 0; i < value.length; i++) {
		hash = ((hash << 5) - hash) + value.charCodeAt(i);
		hash |= 0;
	}
	return Math.abs(hash);
}

export function pickDailyMessage(entries: DailyMessageEntry[], mode: DailyMessageMode, dateISO: string): DailyMessageEntry | null {
	if (entries.length === 0) return null;

	if (mode === 'day_of_year') {
		const dayOfYear = getDayOfYear(dateISO);
		const exact = entries.find((entry) => entry.day === dayOfYear);
		if (exact) return exact;
	}

	const pool = entries.filter((entry) => !entry.day || mode === 'day_of_year');
	if (pool.length === 0) return null;
	const index = hashString(`${mode}:${dateISO}`) % pool.length;
	return pool[index] || null;
}
