import { ItemView, WorkspaceLeaf, Notice } from 'obsidian';
import type LifequestPlugin from '../main';
import { calculateHealthMetrics, needsWeighIn, calculateBMI, getWeighInXP, getWeighInCoins, getNormalBMIWeightRange } from '../core/health-engine';
import type { WeightEntry, WeightUnit, BloodPressureEntry, HealthMetrics, HealthProfile } from '../types';
import { getLang, pick, t } from '../i18n';
import { ConfirmModal } from './confirm-modal';

export const HEALTH_VIEW_TYPE = 'lifequest-health';
type TranslationKey = Parameters<typeof t>[0];
type TranslationVars = Record<string, string | number>;
type HealthTabId = 'peso' | 'presion' | 'meds';

export class HealthTrackerView extends ItemView {
  plugin: LifequestPlugin;
  private activeTab: HealthTabId = 'peso';

  constructor(leaf: WorkspaceLeaf, plugin: LifequestPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string { return HEALTH_VIEW_TYPE; }
  getDisplayText(): string { return this.tr('health_tracking'); }
  getIcon(): string { return 'heart'; }

  private tr(key: TranslationKey, vars?: TranslationVars): string;
  private tr(esText: string, enText: string): string;
  private tr(first: string, second: TranslationVars | string = {}): string {
    const lang = getLang(this.plugin);
    if (typeof second === 'string') return pick(lang, first, second);
    return t(first as TranslationKey, lang, second);
  }

  private getGoalTypeLabel(goalType: HealthProfile['goalType']): string {
    switch (goalType) {
      case 'lose_weight':
        return this.tr('Perder peso', 'Lose weight');
      case 'gain_weight':
        return this.tr('Ganar peso/masa', 'Gain weight/mass');
      case 'maintain':
        return this.tr('Mantenimiento', 'Maintain');
      case 'body_recomp':
        return this.tr('Recomposición corporal', 'Body recomposition');
    }
  }

  async onOpen(): Promise<void> {
    this.render();
  }

  render(): void {
    const root = this.contentEl;
    root.empty();
    root.addClass('lifequest-dashboard'); // borrow some styling
    root.addClass('lq-health-tracker');

    if (!this.plugin.data.health?.enabled || !this.plugin.data.settings.healthEnabled) {
      root.createEl('div', { text: this.tr('health_addon_disabled') });
      return;
    }

    const enabledTabs = this.getEnabledTabs();
    if (enabledTabs.length === 0) {
      root.createEl('div', { text: this.tr('health_no_modules') });
      return;
    }

    if (!enabledTabs.some((tab) => tab.id === this.activeTab)) {
      this.activeTab = enabledTabs[0]!.id;
    }

    this.renderTabs(root);

    const contentArea = root.createDiv({ cls: 'lq-health-content' });

    if (this.activeTab === 'peso') {
      this.renderWeightTab(contentArea);
    } else if (this.activeTab === 'presion') {
      this.renderBloodPressureTab(contentArea);
    } else if (this.activeTab === 'meds') {
      this.renderMedsTab(contentArea);
    }
  }

  private getEnabledTabs(): Array<{ id: HealthTabId; label: string }> {
    const modules = this.plugin.data.settings.healthModules;
    const tabs: Array<{ id: HealthTabId; label: string }> = [];

    if (modules.weight) tabs.push({ id: 'peso', label: this.tr('health_scale_weight') });
    if (modules.bloodPressure) tabs.push({ id: 'presion', label: this.tr('health_blood_pressure') });
    if (modules.medications) tabs.push({ id: 'meds', label: this.tr('health_medications') });

    return tabs;
  }

  private renderTabs(parent: HTMLElement): void {
    const nav = parent.createDiv({ cls: 'lq-health-tabs' });
    const tabs = this.getEnabledTabs();

    tabs.forEach((tab) => {
      const btn = nav.createEl('button', { text: tab.label, cls: 'lq-health-tab-btn' });
      if (this.activeTab === tab.id) btn.addClass('is-active');
      btn.onclick = () => {
        this.activeTab = tab.id;
        this.render();
      };
    });
  }

  private renderWeightTab(contentArea: HTMLElement) {
    if (!this.plugin.data.health?.profile) {
      contentArea.createEl('div', { text: this.tr('health_setup_profile') });
      return;
    }

    const { profile, entries } = this.plugin.data.health;
    if (!profile) {
      contentArea.createEl('div', { text: this.tr('health_setup_profile') });
      return;
    }
    const metrics = calculateHealthMetrics(profile, entries);

    if (!metrics) {
      contentArea.createEl('div', { text: this.tr('health_not_enough_data') });
      this.renderWeighInSection(contentArea, profile, []);
      return;
    }

    this.renderHeaderSection(contentArea, profile, metrics);
    this.renderWeighInSection(contentArea, profile, entries, metrics);
    this.renderChartSection(contentArea, entries);
    this.renderBMISection(contentArea, profile, metrics);
    this.renderStatsSection(contentArea, metrics);
    this.renderHistorySection(contentArea, entries);
  }

  private renderHeaderSection(root: HTMLElement, profile: HealthProfile, metrics: HealthMetrics): void {
    const card = root.createDiv({ cls: 'lq-card' });
    card.createEl('p', { cls: 'lq-card-title', text: `${this.tr('health_tracking')} · ${this.tr('health_goal')}: ${this.getGoalTypeLabel(profile.goalType)}` });

    const cGroup = card.createDiv({ cls: 'lq-health-chip-group' });
    const stats = [
      [`${metrics.currentWeight} ${profile.weightUnit}`, this.tr('health_current')],
      [`${metrics.bmi}`, this.tr('IMC', 'BMI')],
      [`${metrics.totalChange > 0 ? '+' : ''}${metrics.totalChange} ${profile.weightUnit}`, this.tr('health_since_start')]
    ];

    stats.forEach(([val, lbl]) => {
      const chip = cGroup.createDiv({ cls: 'lq-chip' });
      chip.createDiv({ cls: 'lq-chip-value', text: val });
      chip.createDiv({ cls: 'lq-chip-label', text: lbl });
    });

    const progRow = card.createDiv({ cls: 'lq-xp-row' });
    const progLabel = progRow.createDiv({ cls: 'lq-xp-label' });
    progLabel.textContent = this.tr(`Progreso hacia ${profile.targetWeight} ${profile.weightUnit}: ${metrics.progressPercent}%`, `Progress toward ${profile.targetWeight} ${profile.weightUnit}: ${metrics.progressPercent}%`);

    const track = progRow.createDiv({ cls: 'lq-xp-bar-track' });
    const fill = track.createDiv({ cls: 'lq-xp-bar-fill' });
    fill.setCssProps({
      width: `${Math.min(100, Math.max(0, metrics.progressPercent))}%`,
      background: this.plugin.data.profile.accentColor
    });

    if (metrics.weeklyTrend !== null) {
      card.createDiv({ cls: 'lq-health-meta', text: this.tr(`Tendencia: ${metrics.weeklyTrend} kg/sem · Proyección: ${metrics.weeksToGoal ? metrics.weeksToGoal + ' semanas' : 'N/D'}`, `Trend: ${metrics.weeklyTrend} kg/week · Projection: ${metrics.weeksToGoal ? metrics.weeksToGoal + ' weeks' : 'N/A'}`) });
      if (metrics.projectedArrivalDate) {
        card.createDiv({ cls: 'lq-health-meta', text: this.tr(`Llegarías aproximadamente el ${metrics.projectedArrivalDate}`, `You would arrive around ${metrics.projectedArrivalDate}`) });
      }
    }
    
    if (metrics.progressPercent >= 100) {
      card.createDiv({ cls: 'lq-health-success', text: this.tr('🎉 Meta alcanzada', '🎉 Goal reached') });
    }
  }

  private renderWeighInSection(root: HTMLElement, profile: HealthProfile, entries: WeightEntry[], metrics?: HealthMetrics): void {
    const card = root.createDiv({ cls: 'lq-card' });
    card.createEl('p', { cls: 'lq-card-title', text: this.tr('health_weekly_log') });
    const getWeekStart = (date: Date) => {
      const copy = new Date(date);
      const day = copy.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      copy.setHours(0, 0, 0, 0);
      copy.setDate(copy.getDate() + diff);
      return copy.toISOString().split('T')[0] || '';
    };

    if (entries.length > 0) {
      const last = entries[entries.length - 1];
      const days = Math.floor((new Date().getTime() - new Date(last?.date || '').getTime()) / (1000 * 3600 * 24));
      card.createDiv({ cls: 'lq-health-meta lq-health-meta-gap', text: this.tr(`Último registro: hace ${days} días (${last?.date?.split('T')[0]})`, `Last entry: ${days} days ago (${last?.date?.split('T')[0]})`) });
    }

    const isWeighInNeeded = needsWeighIn(entries, profile.weighInDay, new Date());
    if (!isWeighInNeeded) {
       card.createDiv({ cls: 'lq-health-muted lq-health-meta-gap', text: this.tr('Ya registraste tu peso esta semana. Puedes agregar históricos sin recompensa extra.', 'You already logged your weight this week. You can add historical entries without extra rewards.') });
    }

    const form = card.createDiv({ cls: 'lq-health-form' });
    
    const row1 = form.createDiv({ cls: 'lq-health-form-row' });
    row1.createSpan({ text: this.tr('Fecha:', 'Date:') });
    const dateInput = row1.createEl('input', { type: 'date', cls: 'lq-health-input-date' });
    dateInput.value = new Date().toISOString().split('T')[0] || '';

    row1.createSpan({ text: this.tr('Peso:', 'Weight:') });
    const input = row1.createEl('input', { type: 'number', cls: 'lq-health-input-number', attr: { placeholder: this.tr('ej. 75.5', 'e.g. 75.5') } });
    row1.createSpan({ text: profile.weightUnit });
    
    const row2 = form.createDiv({ cls: 'lq-health-form-row' });
    row2.createSpan({ text: this.tr('Nota:', 'Note:') });
    const noteInput = row2.createEl('input', { type: 'text', cls: 'lq-health-input-flex', attr: { placeholder: this.tr('ej. post vacaciones', 'e.g. after vacation') } });

    const btn = form.createEl('button', { text: this.tr('Registrar', 'Log entry'), cls: 'mod-cta' });

    const streak = metrics?.streak || 0;
    const xpReward = isWeighInNeeded ? getWeighInXP(streak) : 0;
    const coinReward = isWeighInNeeded ? getWeighInCoins(streak, this.plugin.data.settings.rewardSettings) : 0;

    if (isWeighInNeeded) {
        form.createDiv({ cls: 'lq-health-reward-note', text: this.tr(`⚡ Registrar otorga +${xpReward} XP y +${coinReward} monedas (racha ${streak} semanas)`, `⚡ Logging grants +${xpReward} XP and +${coinReward} coins (${streak} week streak)`)});
    }

    btn.onclick = async () => {
       const val = parseFloat(input.value);
       if (isNaN(val) || val < 20 || val > 500) {
         new Notice(this.tr('health_invalid_weight'));
         return;
       }
       const hCm = profile.heightUnit === 'ft' ? profile.heightValue * 30.48 : profile.heightValue;
       const valKg = profile.weightUnit === 'lb' ? val * 0.453592 : val;
       
       let entryDate = new Date().toISOString();
       if (dateInput.value) {
         const parts = dateInput.value.split('-').map(Number);
         const selectedDate = new Date();
         selectedDate.setFullYear(parts[0] || 2000, (parts[1] || 1) - 1, parts[2] || 1);
         entryDate = selectedDate.toISOString(); 
       }
       const rewardEligible = isWeighInNeeded && getWeekStart(new Date(entryDate)) === getWeekStart(new Date());
       const xpRewardFinal = rewardEligible ? getWeighInXP(streak) : 0;
       const coinRewardFinal = rewardEligible ? getWeighInCoins(streak, this.plugin.data.settings.rewardSettings) : 0;

       const entry: WeightEntry = {
         id: `we-${Date.now()}`,
         date: entryDate,
         weightValue: val,
         weekNumber: 1,
         year: new Date(entryDate).getFullYear(),
         note: noteInput.value || '',
         bmi: calculateBMI(valKg, hCm)
       };

       const health = this.plugin.data.health;
       if (!health) return;
       health.entries.push(entry);
       health.entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
       
       if (rewardEligible) {
           this.plugin.data.xp.total += xpRewardFinal;
           
           if (this.plugin.data.settings.coinsEnabled && this.plugin.data.coins) {
               this.plugin.data.coins.balance += coinRewardFinal;
               this.plugin.data.coins.totalEarned += coinRewardFinal;
           }
           
           this.plugin.data.activityLog.push({
               id: `we-${Date.now()}`,
               type: 'quest_completed',
               description: this.tr(`Peso registrado: ${val} ${profile.weightUnit} (IMC ${entry.bmi})`, `Weight logged: ${val} ${profile.weightUnit} (BMI ${entry.bmi})`),
               xp: xpRewardFinal,
               timestamp: new Date().toISOString()
           });
           new Notice(this.tr('health_weight_logged', { xp: xpRewardFinal, coins: coinRewardFinal }));
       } else {
           new Notice(this.tr('health_history_saved'));
       }

       await this.plugin.store.save(this.plugin.data);
       this.render();
    };
  }

  private renderChartSection(root: HTMLElement, entries: WeightEntry[]): void {
    const card = root.createDiv({ cls: 'lq-card' });
    card.createEl('p', { cls: 'lq-card-title', text: this.tr('health_weight_trend') });
    if (entries.length < 2) {
      card.createDiv({ cls: 'lq-health-muted', text: this.tr('health_need_two_entries') });
      return;
    }
    
    card.createDiv({ cls: 'lq-health-chart-placeholder' });
    card.createDiv({ cls: 'lq-health-chart-caption', text: this.tr('health_chart_placeholder') });
  }

  private renderBMISection(root: HTMLElement, profile: HealthProfile, metrics: HealthMetrics): void {
    const card = root.createDiv({ cls: 'lq-card' });
    card.createEl('p', { cls: 'lq-card-title', text: this.tr('health_bmi_title') });

    const hCm = profile.heightUnit === 'ft' ? profile.heightValue * 30.48 : profile.heightValue;
    const range = getNormalBMIWeightRange(hCm);
    const minW = profile.weightUnit === 'lb' ? range.min / 0.453592 : range.min;
    const maxW = profile.weightUnit === 'lb' ? range.max / 0.453592 : range.max;

    card.createDiv({ cls: 'lq-health-meta-gap', text: this.tr('health_bmi_current', { bmi: metrics.bmi }) });
    
    card.createDiv({ cls: 'lq-health-bmi-scale' });
    card.createDiv({ cls: 'lq-health-muted', text: this.tr('health_height_context', { value: profile.heightValue, unit: profile.heightUnit }) });
    card.createDiv({ cls: 'lq-health-strong', text: this.tr('health_normal_range_corresponds', { min: minW.toFixed(1), max: maxW.toFixed(1), unit: profile.weightUnit }) });
    card.createDiv({ cls: 'lq-health-caption', text: this.tr('health_info_reference') });
  }

  private renderStatsSection(root: HTMLElement, metrics: HealthMetrics): void {
    const card = root.createDiv({ cls: 'lq-card' });
    card.createEl('p', { cls: 'lq-card-title', text: this.tr('health_logging_consistency') });
    
    const chipRow = card.createDiv({ cls: 'lq-chip-row' });
    
    const stats = [
      [`${metrics.streak} ${pick(getLang(this.plugin), 'sem', 'wk')}`, this.tr('health_streak')],
      [`${metrics.totalWeighIns}`, this.tr('health_entries')],
      [`${metrics.missedWeighIns}`, this.tr('health_missed')],
    ];

    stats.forEach(([val, lbl]) => {
      const chip = chipRow.createDiv({ cls: 'lq-chip' });
      chip.createDiv({ cls: 'lq-chip-value', text: val });
      chip.createDiv({ cls: 'lq-chip-label', text: lbl });
    });
  }

  private renderHistorySection(root: HTMLElement, entries: WeightEntry[]): void {
    const card = root.createDiv({ cls: 'lq-card' });
    card.createEl('p', { cls: 'lq-card-title', text: this.tr('health_entry_history') });

    const table = card.createEl('table', { cls: 'lq-health-table' });
    const header = table.createEl('tr');
    [this.tr('Fecha', 'Date'), this.tr('Peso', 'Weight'), this.tr('IMC', 'BMI'), this.tr('Nota', 'Note'), ''].forEach(h => header.createEl('th', { text: h }));

    [...entries].reverse().forEach((e, i) => {
        const tr = table.createEl('tr');
        tr.createEl('td', { text: e.date.split('T')[0] || '' });
        tr.createEl('td', { text: e.weightValue.toString() });
        tr.createEl('td', { text: e.bmi.toString() });
        tr.createEl('td', { text: e.note });
        const delTd = tr.createEl('td');
        const delBtn = delTd.createEl('button', { text: '🗑️', cls: 'lq-health-icon-btn' });
        delBtn.onclick = async () => {
            new ConfirmModal(
              this.app,
              this.tr('Eliminar registro', 'Delete entry'),
              this.tr('health_delete_entry'),
              async () => {
                const idx = this.plugin.data.health?.entries.findIndex(x => x.id === e.id) ?? -1;
                if (idx > -1 && this.plugin.data.health) {
                  this.plugin.data.health.entries.splice(idx, 1);
                  await this.plugin.store.save(this.plugin.data);
                  this.render();
                }
              },
              this.tr('Eliminar', 'Delete'),
              this.tr('Cancelar', 'Cancel')
            ).open();
        };
    });
  }

  private renderBloodPressureTab(parent: HTMLElement): void {
     const card = parent.createDiv({ cls: 'lq-card' });
     card.createEl('p', { cls: 'lq-card-title', text: this.tr('health_daily_bp_log') });

     const form = card.createDiv({ cls: 'lq-health-form' });
     
     const r1 = form.createDiv({ cls: 'lq-health-form-row' });
     r1.createSpan({ text: this.tr('health_date') });
     const dateInput = r1.createEl('input', { type: 'date' });
     dateInput.value = new Date().toISOString().split('T')[0] || '';

     const r2 = form.createDiv({ cls: 'lq-health-form-row' });
     r2.createSpan({ text: this.tr('health_systolic') });
     const sysInput = r2.createEl('input', { type: 'number', cls: 'lq-health-input-small', attr: { placeholder: '120' } });
     r2.createSpan({ text: this.tr('health_diastolic') });
     const diaInput = r2.createEl('input', { type: 'number', cls: 'lq-health-input-small', attr: { placeholder: '80' } });
     r2.createSpan({ text: this.tr('health_pulse') });
     const pulseInput = r2.createEl('input', { type: 'number', cls: 'lq-health-input-small', attr: { placeholder: '70' } });

     const r3 = form.createDiv({ cls: 'lq-health-form-row' });
     r3.createSpan({ text: this.tr('health_note') });
     const noteInput = r3.createEl('input', { type: 'text', cls: 'lq-health-input-flex' });

     const btn = form.createEl('button', { text: this.tr('health_save_reading'), cls: 'mod-cta' });
     btn.onclick = async () => {
       const sys = parseInt(sysInput.value);
       const dia = parseInt(diaInput.value);
       if(isNaN(sys) || isNaN(dia)) {
         new Notice(this.tr('health_bp_required'));
         return;
       }
       if (sys < 60 || sys > 260 || dia < 40 || dia > 180 || dia >= sys) {
         new Notice(this.tr('Valores de presión fuera de rango o incoherentes.', 'Blood pressure values are out of range or inconsistent.'));
         return;
       }

       let entryDate = new Date().toISOString();
       if (dateInput.value) {
         const parts = dateInput.value.split('-').map(Number);
         const selectedDate = new Date();
         selectedDate.setFullYear(parts[0] || 2000, (parts[1] || 1) - 1, parts[2] || 1);
         entryDate = selectedDate.toISOString(); 
       }

       const bp: BloodPressureEntry = {
         id: `bp-${Date.now()}`,
         date: entryDate,
         systolic: sys,
         diastolic: dia,
         pulse: parseInt(pulseInput.value) || undefined,
         note: noteInput.value
       };

       if (!this.plugin.data.health) return;
       this.plugin.data.health.bpEntries = this.plugin.data.health.bpEntries || [];
       this.plugin.data.health.bpEntries.push(bp);
       this.plugin.data.health.bpEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
       await this.plugin.store.save(this.plugin.data);
       new Notice(this.tr('health_bp_saved'));
       this.render();
     };

     const hist = parent.createDiv({ cls: 'lq-card lq-health-top-gap' });
     hist.createEl('p', { cls: 'lq-card-title', text: this.tr('health_bp_history') });
     const table = hist.createEl('table', { cls: 'lq-health-table' });
     const header = table.createEl('tr');
     [this.tr('Fecha', 'Date'), 'SYS', 'DIA', this.tr('Pulso', 'Pulse'), this.tr('Nota', 'Note'), ''].forEach(h => header.createEl('th', { text: h }));

     const bps = this.plugin.data.health!.bpEntries || [];
     [...bps].reverse().forEach(b => {
         const tr = table.createEl('tr');
         tr.createEl('td', { text: b.date.split('T')[0] || '' });
         
         const sysTd = tr.createEl('td', { text: b.systolic.toString(), cls: 'lq-health-bp-sys' });
         if (b.systolic >= 140) sysTd.addClass('is-high');
         else if (b.systolic >= 130) sysTd.addClass('is-elevated');
         else if (b.systolic <= 90) sysTd.addClass('is-low');

         tr.createEl('td', { text: b.diastolic.toString() });
         tr.createEl('td', { text: b.pulse ? b.pulse.toString() : '-' });
         tr.createEl('td', { text: b.note || '' });
         
         const delTd = tr.createEl('td');
         const delBtn = delTd.createEl('button', { text: '🗑️', cls: 'lq-health-icon-btn' });
         delBtn.onclick = async () => {
             new ConfirmModal(
               this.app,
               this.tr('Eliminar lectura', 'Delete reading'),
               this.tr('health_delete_reading'),
               async () => {
                 if (!this.plugin.data.health) return;
                 this.plugin.data.health.bpEntries = this.plugin.data.health.bpEntries.filter(x => x.id !== b.id);
                 await this.plugin.store.save(this.plugin.data);
                 this.render();
               },
               this.tr('Eliminar', 'Delete'),
               this.tr('Cancelar', 'Cancel')
             ).open();
         };
     });
  }

  private renderMedsTab(parent: HTMLElement): void {
    const headerRow = parent.createDiv({ cls: 'lq-health-header-row' });
    headerRow.createEl('p', { cls: 'lq-card-title lq-health-header-title', text: this.tr('health_inventory_schedules') });
    const addBtn = headerRow.createEl('button', { text: this.tr('health_new_medication') });

    addBtn.onclick = () => this.renderMedForm(parent);

    const meds = this.plugin.data.health!.medications || [];

    if (meds.length === 0) {
      parent.createEl('p', { text: this.tr('health_no_medications'), cls: 'lq-health-muted' });
      return;
    }

    const grid = parent.createDiv({ cls: 'lq-health-meds-grid' });

    meds.forEach(med => {
      const card = grid.createDiv({ cls: 'lq-card lq-health-med-card' });
      
      const top = card.createDiv({ cls: 'lq-health-med-top' });
      top.createDiv({ text: med.name, cls: 'lq-health-med-name' });
      
      const invContainer = top.createDiv({ cls: 'lq-health-med-inventory' });
      if (med.inventory <= 5) invContainer.addClass('is-low');
      
      const invInput = invContainer.createEl('input', { type: 'number', cls: 'lq-health-med-inventory-input' });
      invInput.value = med.inventory.toString();
      invInput.onchange = async () => {
          med.inventory = Math.max(0, parseInt(invInput.value) || 0);
          await this.plugin.store.save(this.plugin.data);
          this.render();
      };
      invContainer.createSpan({ text: this.tr('health_available_short'), cls: 'lq-health-med-inventory-label' });

      card.createDiv({ text: this.tr('health_dosage', { value: med.dosage }), cls: 'lq-health-med-meta' });
      card.createDiv({ text: this.tr('health_schedule', { value: med.schedule }), cls: 'lq-health-med-meta lq-health-med-meta-grow' });

      const actions = card.createDiv({ cls: 'lq-health-med-actions' });
      
      const takeBtn = actions.createEl('button', { text: this.tr('health_take_dose'), cls: 'mod-cta lq-health-med-take' });
      if (med.inventory <= 0) takeBtn.disabled = true;
      takeBtn.onclick = async () => {
        if (med.inventory <= 0) return;
        med.inventory--;
        if (!this.plugin.data.health) return;
        this.plugin.data.health.medLogs = this.plugin.data.health.medLogs || [];
        this.plugin.data.health.medLogs.push({
          id: `mlog-${Date.now()}`,
          medId: med.id,
          timestamp: new Date().toISOString()
        });
        await this.plugin.store.save(this.plugin.data);
        new Notice(this.tr('health_med_taken', { name: med.name, count: med.inventory }));
        this.render();
      };

      const delBtn = actions.createEl('button', { text: '🗑️', cls: 'lq-health-icon-btn lq-health-med-delete' });
      delBtn.onclick = async () => {
        new ConfirmModal(
          this.app,
          this.tr('Eliminar medicamento', 'Delete medication'),
          this.tr('health_delete_medication', { name: med.name }),
          async () => {
            if (!this.plugin.data.health) return;
            this.plugin.data.health.medications = meds.filter(m => m.id !== med.id);
            this.plugin.data.health.medLogs = (this.plugin.data.health.medLogs || []).filter(l => l.medId !== med.id);
            await this.plugin.store.save(this.plugin.data);
            this.render();
          },
          this.tr('Eliminar', 'Delete'),
          this.tr('Cancelar', 'Cancel')
        ).open();
      };
    });
  }

  private renderMedForm(parent: HTMLElement): void {
    parent.empty();
    const card = parent.createDiv({ cls: 'lq-card' });
    card.createEl('p', { cls: 'lq-card-title', text: this.tr('health_register_medication') });

    const form = card.createDiv({ cls: 'lq-health-med-form' });

    form.createSpan({ text: this.tr('health_med_name') });
    const nameIn = form.createEl('input', { type: 'text', attr: { placeholder: this.tr('health_med_name_placeholder') } });

    form.createSpan({ text: this.tr('health_dose_per_intake') });
    const doseIn = form.createEl('input', { type: 'text', attr: { placeholder: this.tr('health_dose_placeholder') } });

    form.createSpan({ text: this.tr('health_schedule_desc') });
    const schedIn = form.createEl('input', { type: 'text', attr: { placeholder: this.tr('health_schedule_placeholder') } });

    form.createSpan({ text: this.tr('health_initial_inventory') });
    const invIn = form.createEl('input', { type: 'number', attr: { placeholder: this.tr('30', '30') } });

    const btnRow = form.createDiv({ cls: 'lq-health-med-form-actions' });
    const save = btnRow.createEl('button', { text: this.tr('Guardar', 'Save'), cls: 'mod-cta' });
    const cancel = btnRow.createEl('button', { text: this.tr('Cancelar', 'Cancel') });

    cancel.onclick = () => this.render();
    save.onclick = async () => {
      if (!nameIn.value.trim()) {
        new Notice(this.tr('health_name_required'));
        return;
      }
      if ((parseInt(invIn.value) || 0) < 0) {
        new Notice(this.tr('El inventario no puede ser negativo.', 'Inventory cannot be negative.'));
        return;
      }
      if (!this.plugin.data.health) return;
      this.plugin.data.health.medications = this.plugin.data.health.medications || [];
      this.plugin.data.health.medications.push({
        id: `med-${Date.now()}`,
        name: nameIn.value.trim(),
        dosage: doseIn.value.trim(),
        schedule: schedIn.value.trim(),
        inventory: parseInt(invIn.value) || 0,
        isActive: true
      });
      await this.plugin.store.save(this.plugin.data);
      new Notice(this.tr('health_med_added'));
      this.render();
    };
  }
}

export function exportHealthCSV(entries: WeightEntry[], weightUnit: WeightUnit): string {
  const header = `fecha,peso_${weightUnit},imc,cambio_${weightUnit},nota`;
  const rows = entries.map((e, i) => {
    const prev = i > 0 ? entries[i - 1]!.weightValue : e.weightValue;
    const change = Math.round((e.weightValue - prev) * 10) / 10;
    return `${e.date.split('T')[0]},${e.weightValue},${e.bmi},${change},"${e.note}"`;
  });
  return [header, ...rows].join('\n');
}
