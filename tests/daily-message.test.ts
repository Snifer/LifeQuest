import { normalizeGitHubRawUrl, parseDailyMessageSource, pickDailyMessage, resolveDailyMessageSourceUrl } from '../src/daily-message';

describe('daily-message helpers', () => {
	it('normalizes github blob URLs to raw URLs', () => {
		expect(
			normalizeGitHubRawUrl('https://github.com/acme/lifequest/blob/main/docs/messages.md')
		).toBe('https://raw.githubusercontent.com/acme/lifequest/main/docs/messages.md');
	});

	it('parses mixed daily message lines', () => {
		const entries = parseDailyMessageSource(`
# comment
001 | Keep going | Author One
- Breathe and continue | Author Two
003::Trust the process::Author Three
`);
		expect(entries).toHaveLength(3);
		expect(entries[0]).toEqual({ day: 1, text: 'Keep going', author: 'Author One' });
		expect(entries[1]).toEqual({ text: 'Breathe and continue', author: 'Author Two' });
		expect(entries[2]).toEqual({ day: 3, text: 'Trust the process', author: 'Author Three' });
	});

	it('picks exact day-of-year entries when available', () => {
		const entries = parseDailyMessageSource(`
001 | Day one | A
002 | Day two | B
`);
		expect(pickDailyMessage(entries, 'day_of_year', '2026-01-02')).toEqual({
			day: 2,
			text: 'Day two',
			author: 'B',
		});
	});

	it('picks deterministic daily random entries', () => {
		const entries = parseDailyMessageSource(`
One | A
Two | B
Three | C
`);
		const first = pickDailyMessage(entries, 'random_daily', '2026-05-30');
		const second = pickDailyMessage(entries, 'random_daily', '2026-05-30');
		expect(first).toEqual(second);
	});

	it('resolves source URL by active language with fallback', () => {
		expect(resolveDailyMessageSourceUrl({ es: 'https://example.com/es.txt', en: 'https://example.com/en.txt' }, 'es')).toBe('https://example.com/es.txt');
		expect(resolveDailyMessageSourceUrl({ es: '', en: 'https://example.com/en.txt' }, 'es')).toBe('https://example.com/en.txt');
	});
});
