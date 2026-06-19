import { en } from './en';
import { es } from './es';

const dictionaries = { en, es };

export type SupportedLanguage = keyof typeof dictionaries;
type LanguageCarrier =
	| SupportedLanguage
	| { settings?: { language?: SupportedLanguage } }
	| { data?: { settings?: { language?: SupportedLanguage } } };

export function t(key: keyof typeof en, lang: SupportedLanguage, vars: Record<string, string | number> = {}): string {
    let str = dictionaries[lang]?.[key] || dictionaries['en'][key] || key;
    
    for (const [varName, varValue] of Object.entries(vars)) {
        str = str.replace(`{${varName}}`, String(varValue));
    }
    
    return str;
}

export function getLang(source?: LanguageCarrier): SupportedLanguage {
	if (!source) return 'en';
	if (typeof source === 'string') return source;
	const carrier = source as { data?: { settings?: { language?: SupportedLanguage } }; settings?: { language?: SupportedLanguage } };
	if (carrier.data) return carrier.data.settings?.language ?? 'en';
	return carrier.settings?.language ?? 'en';
}

export function pick(lang: SupportedLanguage, esText: string, enText: string): string {
	return lang === 'es' ? esText : enText;
}
