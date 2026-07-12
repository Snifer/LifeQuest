export function buildQuestTag(questId: string): string {
	return `#lq-${questId}`;
}

export function buildQuestMarkdownCheckbox(questTitle: string, questId: string): string {
	return `- [ ] ${questTitle.trim()} ${buildQuestTag(questId)}`.trim();
}

export async function copyTextToClipboard(value: string): Promise<boolean> {
	try {
		if (navigator.clipboard?.writeText) {
			await navigator.clipboard.writeText(value);
			return true;
		}
	} catch {
		return false;
	}

	return false;
}
