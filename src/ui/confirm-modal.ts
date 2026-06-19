import { App, Modal, Setting } from 'obsidian';

export class ConfirmModal extends Modal {
	private readonly titleText: string;
	private readonly messageText: string;
	private readonly confirmLabel: string;
	private readonly cancelLabel: string;
	private readonly onConfirm: () => void | Promise<void>;

	constructor(
		app: App,
		titleText: string,
		messageText: string,
		onConfirm: () => void | Promise<void>,
		confirmLabel = 'Confirm',
		cancelLabel = 'Cancel'
	) {
		super(app);
		this.titleText = titleText;
		this.messageText = messageText;
		this.onConfirm = onConfirm;
		this.confirmLabel = confirmLabel;
		this.cancelLabel = cancelLabel;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		new Setting(contentEl).setName(this.titleText).setHeading();
		contentEl.createEl('p', { text: this.messageText, cls: 'setting-item-description' });

		const actions = contentEl.createDiv({ cls: 'lq-confirm-actions' });
		const cancelBtn = actions.createEl('button', { text: this.cancelLabel, cls: 'mod-cta' });
		cancelBtn.addEventListener('click', () => this.close());

		const confirmBtn = actions.createEl('button', { text: this.confirmLabel, cls: 'mod-warning' });
		confirmBtn.addEventListener('click', () => {
			void Promise.resolve(this.onConfirm()).finally(() => this.close());
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
