import { Modal, App, Notice, Setting } from 'obsidian';
import type LifequestPlugin from '../main';
import { calculateBMI, getBMICategory, getNormalBMIWeightRange } from '../core/health-engine';
import type { HealthProfile, WeightEntry } from '../types';
import { executeObsidianCommand } from '../command-api';
import { getLang, pick, t } from '../i18n';

type TranslationKey = Parameters<typeof t>[0];
type TranslationVars = Record<string, string | number>;
type WeighInDay = NonNullable<HealthProfile['weighInDay']>;

export class HealthSetupModal extends Modal {
  plugin: LifequestPlugin;
  private step = 1;
  private draft: Partial<HealthProfile> = {};
  private currentWeightDraft = 0;
  private isEditMode = false;

  constructor(app: App, plugin: LifequestPlugin, isEditMode = false) {
    super(app);
    this.plugin = plugin;
    this.isEditMode = isEditMode;
    
    if (isEditMode && plugin.data.health?.profile) {
      this.draft = { ...plugin.data.health.profile };
      const entries = plugin.data.health.entries || [];
      if (entries.length > 0) {
        this.currentWeightDraft = entries[entries.length - 1]?.weightValue || 0;
      }
    } else {
      this.draft = {
        birthDate: '1990-01-01',
        biologicalSex: 'prefer_not_to_say',
        heightValue: 170,
        heightUnit: 'cm',
        weightUnit: 'kg',
        goalType: 'lose_weight',
        targetWeight: 70,
        targetDate: null,
        weeklyGoalKg: 0.5,
        weighInDay: 1,
        weighInReminder: true,
      };
    }
  }

  onOpen(): void {
    this.renderStep();
  }

  private tr(key: TranslationKey, vars?: TranslationVars): string;
  private tr(esText: string, enText: string): string;
  private tr(first: string, second: TranslationVars | string = {}): string {
    const lang = getLang(this.plugin);
    if (typeof second === 'string') return pick(lang, first, second);
    return t(first as TranslationKey, lang, second);
  }

  private renderStep(): void {
    this.contentEl.empty();
    
    this.contentEl.createEl('h2', { text: this.tr('health_setup_title', { step: this.step }) });

    switch (this.step) {
      case 1: this.renderStep1(); break;
      case 2: this.renderStep2(); break;
      case 3: this.renderStep3(); break;
      case 4: this.renderStep4(); break;
    }

    const btnContainer = this.contentEl.createDiv({ cls: 'modal-button-container lq-health-setup-actions' });
    
    if (this.step > 1) {
      const prevBtn = btnContainer.createEl('button', { text: this.tr('health_setup_previous') });
      prevBtn.onclick = () => this.prev();
    } else {
      btnContainer.createDiv(); // Espaciador
    }

    if (this.step < 4) {
      const nextBtn = btnContainer.createEl('button', { text: this.tr('health_setup_next'), cls: 'mod-cta' });
      nextBtn.onclick = () => this.next();
    } else {
      const startBtn = btnContainer.createEl('button', { text: this.isEditMode ? this.tr('health_setup_save_changes') : this.tr('health_setup_start'), cls: 'mod-cta' });
      startBtn.onclick = () => this.finish();
    }
  }

  private renderStep1(): void {
    new Setting(this.contentEl)
      .setName(this.tr('Fecha de nacimiento', 'Birth date'))
      .addText(text => text
        .setValue(this.draft.birthDate || '')
        .onChange(val => this.draft.birthDate = val)
      );

    new Setting(this.contentEl)
      .setName(this.tr('Sexo biológico', 'Biological sex'))
      .addDropdown(drop => drop
        .addOption('male', this.tr('Hombre', 'Male'))
        .addOption('female', this.tr('Mujer', 'Female'))
        .addOption('prefer_not_to_say', this.tr('Prefiero no decirlo', 'Prefer not to say'))
        .setValue(this.draft.biologicalSex || 'prefer_not_to_say')
        .onChange(val => this.draft.biologicalSex = val as HealthProfile['biologicalSex'])
      );

    new Setting(this.contentEl)
      .setName(this.tr('Altura', 'Height'))
      .addText(text => text
        .setValue(String(this.draft.heightValue || 170))
        .onChange(val => this.draft.heightValue = parseFloat(val))
      )
      .addDropdown(drop => drop
        .addOption('cm', 'Cm')
        .addOption('ft', 'Ft')
        .setValue(this.draft.heightUnit || 'cm')
        .onChange(val => this.draft.heightUnit = val as HealthProfile['heightUnit'])
      );

    new Setting(this.contentEl)
      .setName(this.tr('Unidad de peso', 'Weight unit'))
      .addDropdown(drop => drop
        .addOption('kg', 'Kg')
        .addOption('lb', 'Lb')
        .setValue(this.draft.weightUnit || 'kg')
        .onChange(val => this.draft.weightUnit = val as HealthProfile['weightUnit'])
      );
  }

  private renderStep2(): void {
    const setting = new Setting(this.contentEl)
      .setName(this.tr('Peso actual', 'Current weight'))
      .setDesc(this.tr('Tu peso inicial para el seguimiento', 'Your starting weight for tracking'))
      .addText(text => text
        .setValue(String(this.currentWeightDraft || 70))
        .onChange(val => {
          this.currentWeightDraft = parseFloat(val);
          this.updateBMIDisplay(setting.descEl);
        })
      );
    this.updateBMIDisplay(setting.descEl);
  }

  private updateBMIDisplay(el: HTMLElement): void {
    if (!this.draft.heightValue || !this.currentWeightDraft) return;
    const heightCm = this.draft.heightUnit === 'ft' ? this.draft.heightValue * 30.48 : this.draft.heightValue;
    const weightKg = this.draft.weightUnit === 'lb' ? this.currentWeightDraft * 0.453592 : this.currentWeightDraft;
    const bmi = calculateBMI(weightKg, heightCm);
    const category = getBMICategory(bmi);
    
    // Convert to readable
    const categoryNames: Record<ReturnType<typeof getBMICategory>, string> = {
      underweight: this.tr('Bajo peso', 'Underweight'),
      normal_range: this.tr('Rango normal', 'Normal range'),
      overweight: this.tr('Sobrepeso', 'Overweight'),
      obese_class_1: this.tr('Obesidad I', 'Obesity I'),
      obese_class_2: this.tr('Obesidad II', 'Obesity II'),
      obese_class_3: this.tr('Obesidad III', 'Obesity III')
    };

    const range = getNormalBMIWeightRange(heightCm);
    const wUnit = this.draft.weightUnit || 'kg';
    const minW = wUnit === 'lb' ? range.min / 0.453592 : range.min;
    const maxW = wUnit === 'lb' ? range.max / 0.453592 : range.max;

    el.empty();
    el.createEl('br');
    el.createSpan({ text: `${this.tr('IMC estimado', 'Estimated BMI')}: ` });
    el.createEl('strong', { text: String(bmi) });
    el.createSpan({ text: ` (${categoryNames[category]})` });
    el.createEl('br');
    el.createSpan({
      text: `${this.tr('Rango normal para tu altura', 'Normal range for your height')}: ${Math.round(minW)} - ${Math.round(maxW)} ${wUnit} (${this.tr('Referencia OMS', 'WHO reference')})`
    });
  }

  private renderStep3(): void {
    new Setting(this.contentEl)
      .setName(this.tr('Tipo de meta', 'Goal type'))
      .addDropdown(drop => drop
        .addOption('lose_weight', this.tr('Perder peso', 'Lose weight'))
        .addOption('gain_weight', this.tr('Ganar peso/masa', 'Gain weight/mass'))
        .addOption('maintain', this.tr('Mantenimiento', 'Maintain'))
        .addOption('body_recomp', this.tr('Recomposición corporal', 'Body recomposition'))
        .setValue(this.draft.goalType || 'lose_weight')
        .onChange(val => {
          this.draft.goalType = val as HealthProfile['goalType'];
          this.renderStep();
        })
      );

    if (this.draft.goalType !== 'maintain') {
      new Setting(this.contentEl)
        .setName(this.tr('Peso objetivo', 'Target weight'))
        .addText(text => text
          .setValue(String(this.draft.targetWeight || 70))
          .onChange(val => this.draft.targetWeight = parseFloat(val))
        );
        
      new Setting(this.contentEl)
        .setName(this.tr('Ritmo semanal', 'Weekly pace'))
        .addDropdown(drop => drop
          .addOption('0.25', this.tr('0.25 kg/sem', '0.25 kg/week'))
          .addOption('0.5', this.tr('0.50 kg/sem', '0.50 kg/week'))
          .addOption('0.75', this.tr('0.75 kg/sem', '0.75 kg/week'))
          .addOption('1.0', this.tr('1.00 kg/sem', '1.00 kg/week'))
          .setValue(String(this.draft.weeklyGoalKg || 0.5))
          .onChange(val => this.draft.weeklyGoalKg = parseFloat(val))
        );

      new Setting(this.contentEl)
        .setName(this.tr('Fecha objetivo (opcional)', 'Target date (optional)'))
        .addText(text => text
          .setValue(this.draft.targetDate || '')
          .onChange(val => this.draft.targetDate = val)
        );
    } else {
      this.draft.targetWeight = this.currentWeightDraft;
    }
  }

  private renderStep4(): void {
    new Setting(this.contentEl)
      .setName(this.tr('Día de pesaje', 'Weigh-in day'))
      .setDesc(this.tr('El día de la semana que prefieres registrar tu peso', 'The day of the week you prefer to log your weight'))
      .addDropdown(drop => drop
        .addOption('1', this.tr('Lunes', 'Monday'))
        .addOption('2', this.tr('Martes', 'Tuesday'))
        .addOption('3', this.tr('Miércoles', 'Wednesday'))
        .addOption('4', this.tr('Jueves', 'Thursday'))
        .addOption('5', this.tr('Viernes', 'Friday'))
        .addOption('6', this.tr('Sábado', 'Saturday'))
        .addOption('0', this.tr('Domingo', 'Sunday'))
        .setValue(String(this.draft.weighInDay || 1))
        .onChange(val => this.draft.weighInDay = this.parseWeighInDay(val))
      );

    new Setting(this.contentEl)
      .setName(this.tr('Activar recordatorio', 'Enable reminder'))
      .addToggle(toggle => toggle
        .setValue(this.draft.weighInReminder ?? true)
        .onChange(val => this.draft.weighInReminder = val)
      );

    const summary = this.contentEl.createDiv({ cls: 'lq-setup-summary lq-health-setup-summary' });
    summary.createEl('strong', { text: `${this.tr('Resumen', 'Summary')}:` });
    summary.createEl('br');
    summary.createSpan({
      text: `${this.tr('Meta', 'Goal')}: ${this.draft.goalType} ${this.tr('hasta', 'to')} ${this.draft.targetWeight} ${this.draft.weightUnit}`
    });
    summary.createEl('br');
    summary.createSpan({
      text: `${this.tr('Registro semanal', 'Weekly check-in')}: ${[
        this.tr('Domingo', 'Sunday'),
        this.tr('Lunes', 'Monday'),
        this.tr('Martes', 'Tuesday'),
        this.tr('Miércoles', 'Wednesday'),
        this.tr('Jueves', 'Thursday'),
        this.tr('Viernes', 'Friday'),
        this.tr('Sábado', 'Saturday')
      ][this.draft.weighInDay || 1]}`
    });
  }

  private validate(): boolean {
    if (this.step === 1) {
      if (!this.draft.birthDate || !this.draft.heightValue || this.draft.heightValue < 50 || this.draft.heightValue > 300) {
        new Notice(this.tr('Por favor, ingresa datos válidos para continuar.', 'Please enter valid data to continue.'));
        return false;
      }
    } else if (this.step === 2) {
      if (!this.currentWeightDraft || this.currentWeightDraft < 20 || this.currentWeightDraft > 500) {
        new Notice(this.tr('Por favor, ingresa un peso válido (20-500).', 'Please enter a valid weight (20-500).'));
        return false;
      }
    } else if (this.step === 3) {
      if (this.draft.goalType !== 'maintain') {
        if (!this.draft.targetWeight || this.draft.targetWeight < 20 || this.draft.targetWeight > 500) {
          new Notice(this.tr('Por favor ingresa un peso objetivo válido (20-500).', 'Please enter a valid target weight (20-500).'));
          return false;
        }
        if (!this.draft.targetWeight || this.draft.targetWeight === this.currentWeightDraft) {
          new Notice(this.tr('Por favor ingresa un peso objetivo diferente a tu peso actual.', 'Please enter a target weight different from your current weight.'));
          return false;
        }
        if (this.draft.goalType === 'lose_weight' && this.draft.targetWeight > this.currentWeightDraft) {
           new Notice(this.tr('Para perder peso, el objetivo debe ser menor al actual.', 'To lose weight, the goal must be lower than your current weight.'));
           return false;
        }
        if (this.draft.goalType === 'gain_weight' && this.draft.targetWeight < this.currentWeightDraft) {
           new Notice(this.tr('Para ganar peso, el objetivo debe ser mayor al actual.', 'To gain weight, the goal must be higher than your current weight.'));
           return false;
        }
      }
    }
    return true;
  }

  private next(): void {
    if (this.validate()) {
      this.step++;
      this.renderStep();
    }
  }

  private prev(): void {
    if (this.step > 1) {
      this.step--;
      this.renderStep();
    }
  }

  private async finish() {
    if (!this.validate()) return;
    
    this.draft.setupCompletedAt = new Date().toISOString();
    
    const profile = this.buildProfile();
    if (!this.plugin.data.health) {
      this.plugin.data.health = { enabled: true, profile: null, entries: [], bpEntries: [], medications: [], medLogs: [] };
    }
    const health = this.plugin.data.health;
    health.enabled = true;
    health.profile = profile;

    if (!this.isEditMode || health.entries.length === 0) {
      const heightCm = this.draft.heightUnit === 'ft' ? (this.draft.heightValue || 170) * 30.48 : (this.draft.heightValue || 170);
      const weightKg = this.draft.weightUnit === 'lb' ? this.currentWeightDraft * 0.453592 : this.currentWeightDraft;
      
      const newEntry: WeightEntry = {
        id: `we-${Date.now()}`,
        date: new Date().toISOString(),
        weightValue: this.currentWeightDraft,
        weekNumber: 1, // simplified
        year: new Date().getFullYear(),
        note: this.tr('Peso inicial', 'Starting weight'),
        bmi: calculateBMI(weightKg, heightCm)
      };
      health.entries.push(newEntry);
    }

    await this.plugin.store.save(this.plugin.data);
    new Notice(this.tr('Perfil de salud configurado. +50 XP', 'Health profile configured. +50 XP'));
    
    // Opcional: regalar XP de configuration
    this.plugin.data.xp.total += 50;
    await this.plugin.store.save(this.plugin.data);
    
    void executeObsidianCommand(this.app, `${this.plugin.manifest.id}:open-health`);
    this.close();
  }

  private parseWeighInDay(raw: string): WeighInDay {
    const value = parseInt(raw, 10);
    if (value >= 0 && value <= 6) return value as WeighInDay;
    return 1;
  }

  private buildProfile(): HealthProfile {
    return {
      birthDate: this.draft.birthDate || '1990-01-01',
      biologicalSex: this.draft.biologicalSex || 'prefer_not_to_say',
      heightValue: this.draft.heightValue || 170,
      heightUnit: this.draft.heightUnit || 'cm',
      weightUnit: this.draft.weightUnit || 'kg',
      goalType: this.draft.goalType || 'lose_weight',
      targetWeight: this.draft.targetWeight || this.currentWeightDraft || 70,
      targetDate: this.draft.targetDate || null,
      weeklyGoalKg: this.draft.weeklyGoalKg || 0.5,
      weighInDay: this.draft.weighInDay ?? 1,
      weighInReminder: this.draft.weighInReminder ?? true,
      setupCompletedAt: this.draft.setupCompletedAt || new Date().toISOString(),
    };
  }
}
