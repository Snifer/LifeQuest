import { ItemView, WorkspaceLeaf, Notice } from 'obsidian';
import type LifequestPlugin from '../main';
import { spendCoins, canAffordReward } from '../engine';
import type { CoinEntry, RewardCategory, ShopReward } from '../types';
import { getLang, pick, t } from '../i18n';
import { ConfirmModal } from './confirm-modal';
import { moment } from '../obsidian-moment';

export const SHOP_VIEW_TYPE = 'lifequest-shop';

type TranslationKey = Parameters<typeof t>[0];
type TranslationVars = Record<string, string | number>;
type ShopTab = 'tienda' | 'ganar' | 'historial' | 'agregar';
const SHOP_REWARD_CATEGORIES: RewardCategory[] = ['bienestar', 'ocio', 'social', 'logros'];

export class ShopView extends ItemView {
	private plugin: LifequestPlugin;
	private activeCategory: RewardCategory | 'all' = 'all';
	private activeTab: ShopTab = 'tienda';
	private editingReward: ShopReward | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: LifequestPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	private tr(key: TranslationKey, vars?: TranslationVars): string;
	private tr(esText: string, enText: string): string;
	private tr(first: string, second: TranslationVars | string = {}): string {
		const lang = getLang(this.plugin);
		if (typeof second === 'string') return pick(lang, first, second);
		return t(first as TranslationKey, lang, second);
	}

	getViewType(): string { return SHOP_VIEW_TYPE; }
	getDisplayText(): string { return this.tr('shop_title'); }
	getIcon(): string { return 'shopping-bag'; }

	async onOpen(): Promise<void> {
		this.render();
	}

	render(): void {
		const root = this.contentEl;
		root.empty();
		root.addClass('lq-shop-root');

		if (!this.plugin.data.settings.coinsEnabled) {
			root.createDiv({ text: this.tr('shop_disabled_rewards') });
			return;
		}

		if (!this.plugin.data.settings.shopEnabled) {
			root.createDiv({ text: this.tr('shop_disabled_addon') });
			return;
		}

		this.renderCoinHeader(root);
		this.renderTabs(root);

		const contentArea = root.createDiv({ cls: 'lq-shop-content' });
		switch (this.activeTab) {
			case 'tienda':
				this.renderShopTab(contentArea);
				break;
			case 'ganar':
				this.renderEarnTab(contentArea);
				break;
			case 'historial':
				this.renderHistoryTab(contentArea);
				break;
			case 'agregar':
				this.renderAddRewardTab(contentArea);
				break;
		}
	}

	private renderCoinHeader(parent: HTMLElement): void {
		const coins = this.plugin.data.coins!;
		const header = parent.createDiv({ cls: 'lq-shop-header' });
		const titleWrap = header.createDiv();
		titleWrap.createEl('h1', { text: this.tr('shop_title') });
		titleWrap.createEl('p', { text: this.tr('shop_subtitle') });

		const balanceWrap = header.createDiv({ cls: 'lq-shop-balance-card' });
		balanceWrap.createDiv({ cls: 'lq-balance-val', text: `🪙 ${coins.balance}` });
		balanceWrap.createDiv({ cls: 'lq-balance-label', text: this.tr('shop_balance_available') });

		const stats = header.createDiv({ cls: 'lq-shop-stats' });
		stats.createSpan({ text: this.tr('shop_earned', { value: coins.totalEarned }) });
		stats.createSpan({ text: this.tr('shop_spent', { value: coins.totalSpent }) });
	}

	private renderTabs(parent: HTMLElement): void {
		const nav = parent.createDiv({ cls: 'lq-shop-nav' });
		const tabs: Array<[ShopTab, string]> = [
			['tienda', this.tr('shop_title')],
			['ganar', this.tr('shop_how_to_earn')],
			['historial', this.tr('shop_history')],
			['agregar', this.tr('shop_add')],
		];

		tabs.forEach(([id, label]) => {
			const btn = nav.createEl('button', { text: label, cls: 'lq-nav-btn' });
			if (this.activeTab === id) btn.classList.add('active');
			btn.addEventListener('click', () => {
				if (id !== 'agregar') this.editingReward = null;
				this.activeTab = id;
				this.render();
			});
		});
	}

	private getCategoryLabel(category: RewardCategory): string {
		switch (category) {
			case 'bienestar':
				return this.tr('Bienestar', 'Wellness');
			case 'ocio':
				return this.tr('Ocio', 'Leisure');
			case 'social':
				return this.tr('Social', 'Social');
			case 'logros':
				return this.tr('Logros', 'Milestones');
		}
	}

	private renderShopTab(parent: HTMLElement): void {
		const { data } = this.plugin;
		const filters = parent.createDiv({ cls: 'lq-shop-filters' });
		const categories: Array<RewardCategory | 'all'> = ['all', 'bienestar', 'ocio', 'social', 'logros'];

		categories.forEach((category) => {
			const btn = filters.createEl('button', {
				text: category === 'all' ? this.tr('shop_all') : this.getCategoryLabel(category),
				cls: 'lq-filter-pill',
			});
			if (this.activeCategory === category) btn.classList.add('active');
			btn.addEventListener('click', () => {
				this.activeCategory = category;
				this.render();
			});
		});

		const grid = parent.createDiv({ cls: 'lq-shop-grid' });
		const filtered = (data.shop || []).filter((reward) => this.activeCategory === 'all' || reward.category === this.activeCategory);

		filtered.forEach((reward) => {
			const card = grid.createDiv({ cls: 'lq-reward-card' });
			card.createDiv({ cls: `lq-reward-icon cat-${reward.category}`, text: reward.emoji });

			const info = card.createDiv({ cls: 'lq-reward-info' });
			info.createDiv({ cls: 'lq-reward-name', text: reward.name });
			info.createDiv({ cls: 'lq-reward-desc', text: reward.description });

			const footer = card.createDiv({ cls: 'lq-reward-footer' });
			footer.createSpan({ cls: 'lq-reward-cat', text: this.getCategoryLabel(reward.category) });
			footer.createSpan({ cls: 'lq-reward-cost', text: `🪙 ${reward.cost}` });

			const actions = card.createDiv({ cls: 'lq-reward-actions' });
			const canBuy = canAffordReward(data.coins!, reward);
			const isExhausted = reward.maxRedemptions > 0 && reward.timesRedeemed >= reward.maxRedemptions;

			const buyBtn = actions.createEl('button', {
				text: isExhausted
					? this.tr('shop_sold_out')
					: (canBuy ? this.tr('shop_redeem') : this.tr('shop_short', { value: reward.cost - data.coins!.balance })),
				cls: `lq-btn lq-redeem-btn ${canBuy && !isExhausted ? 'active' : 'disabled'}`,
			});

			if (canBuy && !isExhausted) {
				buyBtn.addEventListener('click', () => {
					void this.redeemReward(reward);
				});
			} else {
				buyBtn.disabled = true;
			}

			if (reward.maxRedemptions > 0) {
				const limitInfo = card.createDiv({
					cls: 'lq-reward-limit',
					text: this.tr('shop_redemptions', { used: reward.timesRedeemed, max: reward.maxRedemptions }),
				});
				if (isExhausted) limitInfo.addClass('is-exhausted');
			}

			const editControls = card.createDiv({ cls: 'lq-reward-controls' });
			const editBtn = editControls.createEl('button', { text: '✏️', cls: 'lq-icon-btn' });
			editBtn.addEventListener('click', () => {
				this.editingReward = reward;
				this.activeTab = 'agregar';
				this.render();
			});

			const delBtn = editControls.createEl('button', { text: '🗑️', cls: 'lq-icon-btn' });
			delBtn.addEventListener('click', () => {
				new ConfirmModal(
					this.app,
					this.tr('Eliminar recompensa', 'Delete reward'),
					this.tr(`¿Eliminar recompensa "${reward.name}"?`, `Delete reward "${reward.name}"?`),
					async () => {
						this.plugin.data.shop = (this.plugin.data.shop || []).filter((item) => item.id !== reward.id);
						await this.plugin.store.save(this.plugin.data);
						this.render();
					},
					this.tr('Eliminar', 'Delete'),
					this.tr('Cancelar', 'Cancel')
				).open();
			});
		});
	}

	private renderEarnTab(parent: HTMLElement): void {
		const list = parent.createDiv({ cls: 'lq-earn-list' });
		const rewards = this.plugin.data.settings.rewardSettings;
		const reasons: Array<{ label: string; value: string }> = [
			{ label: this.tr('Subir de nivel', 'Level up'), value: `${rewards.levelUp.base}+` },
			{ label: this.tr('Semana perfecta (100%)', 'Perfect week (100%)'), value: String(rewards.perfectWeek) },
			{ label: this.tr('Hito de racha (7, 30, 100 días)', 'Streak milestone (7, 30, 100 days)'), value: `${rewards.streakMilestones.streak7} - ${rewards.streakMilestones.streak100}` },
			{ label: this.tr('Badge épico', 'Epic badge'), value: String(rewards.badges.epic) },
			{ label: this.tr('Badge común', 'Common badge'), value: String(rewards.badges.common) },
			{ label: this.tr('Completar revisión semanal', 'Complete weekly review'), value: String(rewards.weeklyReview) },
			{ label: this.tr('Completar quest épica', 'Complete epic quest'), value: String(rewards.epicQuest) },
		];

		reasons.forEach((item) => {
			const row = list.createDiv({ cls: 'lq-earn-row' });
			row.createDiv({ cls: 'lq-earn-label', text: item.label });
			row.createDiv({ cls: 'lq-earn-val', text: `🪙 ${item.value}` });
		});

		parent.createEl('p', {
			text: this.tr('Las monedas son tu saldo disponible. El XP mide tu historial permanente y nunca baja. Son economías independientes.', 'Coins are your spendable balance. XP measures permanent history and never decreases. They are independent economies.'),
			cls: 'lq-shop-note',
		});
	}

	private renderHistoryTab(parent: HTMLElement): void {
		const ledger: CoinEntry[] = this.plugin.data.coins?.ledger || [];
		const list = parent.createDiv({ cls: 'lq-history-list' });

		if (ledger.length === 0) {
			list.createDiv({ text: this.tr('shop_no_transactions'), cls: 'lq-empty' });
			return;
		}

		ledger.slice(0, 50).forEach((entry) => {
			const row = list.createDiv({ cls: 'lq-history-row' });
			row.createDiv({ cls: `lq-history-dot ${entry.type}` });

			const info = row.createDiv({ cls: 'lq-history-info' });
			info.createDiv({ cls: 'lq-history-label', text: entry.label });
			const relativeDate: string = moment(entry.timestamp).locale(getLang(this.plugin)).fromNow();
			info.createDiv({ cls: 'lq-history-date', text: relativeDate });

			row.createDiv({
				cls: `lq-history-val ${entry.type}`,
				text: `${entry.amount > 0 ? '+' : ''}${entry.amount}`,
			});
		});
	}

	private renderAddRewardTab(parent: HTMLElement): void {
		const form = parent.createDiv({ cls: 'lq-shop-form' });
		const isEdit = this.editingReward !== null;
		form.createEl('h3', { text: isEdit ? this.tr('shop_edit_reward') : this.tr('shop_new_reward') });

		const nameInput = form.createEl('input', {
			attr: { type: 'text', placeholder: this.tr('Nombre (ej: Ir al cine)', 'Name (e.g. Go to the movies)'), maxlength: '48' },
		});
		nameInput.value = this.editingReward?.name || '';

		const descInput = form.createEl('input', {
			attr: { type: 'text', placeholder: this.tr('Descripción (ej: En la función de los martes)', 'Description (e.g. Tuesday showing)'), maxlength: '60' },
		});
		descInput.value = this.editingReward?.description || '';

		const catSelect = form.createEl('select');
		SHOP_REWARD_CATEGORIES.forEach((category) => {
			const opt = catSelect.createEl('option', { text: this.getCategoryLabel(category), value: category });
			if (isEdit) {
				opt.selected = category === this.editingReward?.category;
			} else {
				opt.selected = category === 'ocio';
			}
		});

		const costRow = form.createDiv({ cls: 'lq-form-row' });
		costRow.createSpan({ text: this.tr('shop_cost') });
		const costInput = costRow.createEl('input', { attr: { type: 'range', min: '10', max: '500', step: '10' } });
		costInput.value = String(this.editingReward?.cost || 50);
		const costVal = costRow.createSpan({ text: ` 🪙 ${costInput.value}` });
		costInput.addEventListener('input', () => {
			costVal.textContent = ` 🪙 ${costInput.value}`;
		});

		const limitRow = form.createDiv({ cls: 'lq-form-row' });
		limitRow.createSpan({ text: this.tr('shop_limit') });
		const limitInput = limitRow.createEl('input', { cls: 'lq-shop-limit-input', attr: { type: 'number', min: '0', placeholder: '0' } });
		limitInput.value = String(this.editingReward?.maxRedemptions || 0);

		const emojiRow = form.createDiv({ cls: 'lq-emoji-grid' });
		const emojis = ['🎮', '☕', '🍿', '🍣', '🏖️', '🧘', '🛍️', '📚', '🍷', '😴'];
		let selectedEmoji = this.editingReward?.emoji || emojis[0]!;

		emojis.forEach((emoji) => {
			const btn = emojiRow.createDiv({ cls: 'lq-emoji-item', text: emoji });
			if (emoji === selectedEmoji) btn.classList.add('active');
			btn.addEventListener('click', () => {
				emojiRow.querySelectorAll('.lq-emoji-item').forEach((item) => item.classList.remove('active'));
				btn.classList.add('active');
				selectedEmoji = emoji;
			});
		});

		const saveBtn = form.createEl('button', {
			text: isEdit ? this.tr('Guardar cambios', 'Save changes') : this.tr('Guardar recompensa', 'Save reward'),
			cls: 'lq-btn lq-btn-primary lq-shop-save-btn',
		});
		saveBtn.addEventListener('click', () => {
				void this.saveReward({
					isEdit,
					name: nameInput.value.trim(),
					description: descInput.value.trim(),
					selectedEmoji,
					category: this.parseRewardCategory(catSelect.value),
					cost: parseInt(costInput.value, 10),
					maxRedemptions: parseInt(limitInput.value, 10) || 0,
				});
			});
	}

	private parseRewardCategory(value: string): RewardCategory {
		return SHOP_REWARD_CATEGORIES.find((category) => category === value) ?? 'ocio';
	}

	private async redeemReward(reward: ShopReward): Promise<void> {
		const coins = this.plugin.data.coins;
		if (!coins) return;
		this.plugin.data.coins = spendCoins(coins, reward);
		reward.timesRedeemed++;
		await this.plugin.store.save(this.plugin.data);
		const balance = this.plugin.data.coins?.balance ?? 0;
		new Notice(this.tr(`🎁 "${reward.name}" canjeada · Quedan ${balance} monedas`, `🎁 "${reward.name}" redeemed · ${balance} coins left`));
		this.render();
	}

	private async saveReward(input: {
		isEdit: boolean;
		name: string;
		description: string;
		selectedEmoji: string;
		category: RewardCategory;
		cost: number;
		maxRedemptions: number;
	}): Promise<void> {
		if (!input.name || input.name.length < 3) {
			new Notice(this.tr('shop_name_min'));
			return;
		}

		if (input.isEdit && this.editingReward) {
			this.editingReward.name = input.name;
			this.editingReward.description = input.description;
			this.editingReward.emoji = input.selectedEmoji;
			this.editingReward.category = input.category;
			this.editingReward.cost = input.cost;
			this.editingReward.maxRedemptions = input.maxRedemptions;
			this.editingReward.isDefault = false;
		} else {
			const newReward: ShopReward = {
				id: `custom-${Date.now()}`,
				name: input.name,
				description: input.description,
				emoji: input.selectedEmoji,
				category: input.category,
				cost: input.cost,
				timesRedeemed: 0,
				maxRedemptions: input.maxRedemptions,
				createdAt: moment().format('YYYY-MM-DD'),
				isDefault: false,
			};
			this.plugin.data.shop = this.plugin.data.shop || [];
			this.plugin.data.shop.push(newReward);
		}

		await this.plugin.store.save(this.plugin.data);
		new Notice(input.isEdit ? this.tr('shop_reward_updated') : this.tr('shop_reward_saved'));
		this.editingReward = null;
		this.activeTab = 'tienda';
		this.render();
	}
}
