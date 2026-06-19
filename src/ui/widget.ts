import { MarkdownPostProcessorContext, MarkdownRenderChild } from 'obsidian';
import type LifequestPlugin from '../main';
import type { LifequestData } from '../types';
import { calculateHealthMetrics } from '../core/health-engine';
import { generateXPChartBuckets, getLevelTitle } from '../engine';
import { getLang, pick } from '../i18n';

type ObsidianCommandExecutor = {
  commands?: {
    executeCommandById(commandId: string): Promise<boolean>;
  };
};

export interface WidgetParams {
  show: string[];           // elementos a mostrar, en orden
  area: string | null;      // nombre del área filtrada
  quest: string | null;     // nombre o ID de quest
  theme: 'compact' | 'normal' | 'card';
  title: string | null;
  period: 'week' | 'month' | 'all';
}

/**
 * Parsea el contenido crudo del bloque de código en un objeto WidgetParams.
 * Las líneas que empiezan con # son comentarios y se ignoran.
 * Las claves son case-insensitive.
 */
export function parseWidgetParams(source: string): WidgetParams {
  const params: WidgetParams = {
    show: [],
    area: null,
    quest: null,
    theme: 'normal',
    title: null,
    period: 'week',
  };

  const lines = source.split('\n');
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim().toLowerCase();
    const value = line.slice(colonIdx + 1).trim();

    switch (key) {
      case 'show':
        params.show = value.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
        break;
      case 'area':
        params.area = value.toLowerCase();
        break;
      case 'quest':
        params.quest = value;
        break;
      case 'theme':
        if (['compact', 'normal', 'card'].includes(value)) {
          params.theme = value as WidgetParams['theme'];
        }
        break;
      case 'title':
        params.title = value;
        break;
      case 'period':
        if (['week', 'month', 'all'].includes(value)) {
          params.period = value as WidgetParams['period'];
        }
        break;
    }
  }

  // Si show está vacío, mostrar profile por defecto
  if (params.show.length === 0) {
    params.show = ['profile'];
  }

  return params;
}

/**
 * Renderiza el widget dentro del elemento contenedor `el`.
 * Esta función es llamada por registerMarkdownCodeBlockProcessor.
 * Limpia `el` y construye el HTML del widget desde cero.
 */
export function renderWidget(
  el: HTMLElement,
  params: WidgetParams,
  data: LifequestData
): void {
  el.empty();
  el.addClass('lq-widget-root');

  // Aplicar tema
  el.addClass(`lq-widget--${params.theme}`);

  // Contenedor interno
  const container = el.createDiv({ cls: 'lq-widget-container' });

  // Título opcional
  if (params.title) {
    container.createEl('div', {
      cls: 'lq-widget-title',
      text: params.title,
    });
  }

  // Renderizar cada elemento solicitado
  for (const element of params.show) {
    renderElement(container, element, params, data);
  }
}

function tr(data: LifequestData, esText: string, enText: string): string {
  return pick(getLang(data), esText, enText);
}

function executeWidgetCommand(commandId: string): void {
  const appWindow = window as Window & { app?: ObsidianCommandExecutor };
  void appWindow.app?.commands?.executeCommandById(commandId);
}

function renderElement(
  container: HTMLElement,
  element: string,
  params: WidgetParams,
  data: LifequestData
): void {
  switch (element) {
    case 'profile':          renderProfile(container, data); break;
    case 'xp-bar':          renderXPBar(container, data); break;
    case 'level':            renderXPBar(container, data); /* level uses xp-bar implicitly in this basic setup */ break;
    case 'streak':           renderStreak(container, data); break;
    case 'multiplier':       renderStreak(container, data); /* multiplier is part of streak display */ break;
    case 'quests-today':     renderQuestsToday(container, data); break;
    case 'area-progress':    renderAreaProgress(container, data, params.area); break;
    case 'weekly-chart':     renderWeeklyChart(container, data, params.period); break;
    case 'coins':            renderCoins(container, data); break;
    case 'weight':           renderWeight(container, data); break;
    case 'health-progress':  renderHealthProgress(container, data); break;
    case 'bmi':              renderWeight(container, data); /* bmi covered by weight */ break;
    case 'blood-pressure':
    case 'bp':               renderBloodPressure(container, data); break;
    default:
      container.createDiv({
        cls: 'lq-widget-error',
        text: tr(data, `Elemento desconocido: "${element}"`, `Unknown element: "${element}"`),
      });
  }
}

function renderProfile(el: HTMLElement, data: LifequestData): void {
  const { profile, xp, streak } = data;
  const row = el.createDiv({ cls: 'lq-widget-profile-row' });

  // Avatar (40px)
  const avatar = row.createDiv({ cls: 'lq-widget-avatar' });
  avatar.setCssProps({ '--lq-widget-avatar-accent': profile.accentColor });
  if (profile.avatarBase64) {
    const img = avatar.createEl('img', { cls: 'lq-widget-avatar-image' });
    img.src = `data:image/jpeg;base64,${profile.avatarBase64}`;
  } else {
    const parts = profile.heroName.trim().split(' ');
    const initials = parts.length >= 2
      ? ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase()
      : profile.heroName.slice(0, 2).toUpperCase();
    avatar.textContent = initials;
  }

  // Info
  const info = row.createDiv({ cls: 'lq-widget-profile-info' });
  info.createEl('span', { cls: 'lq-widget-hero-name', text: profile.heroName });
  info.createEl('span', {
    cls: 'lq-widget-level-badge',
    text: tr(data, `Nivel ${xp.level} · ${getLevelTitle(xp.level)}`, `Level ${xp.level} · ${getLevelTitle(xp.level)}`),
  });
  info.createEl('span', {
    cls: 'lq-widget-streak-badge',
    text: tr(data, `🔥 ${streak.current} días`, `🔥 ${streak.current} days`),
  });
}

function renderXPBar(el: HTMLElement, data: LifequestData): void {
  const { xp, profile } = data;
  const xpInLevel = xp.total % 500;
  const percent = Math.round((xpInLevel / 500) * 100);

  const wrap = el.createDiv({ cls: 'lq-widget-xpbar-wrap' });

  // Etiqueta superior
  const label = wrap.createDiv({ cls: 'lq-widget-xpbar-label' });
  label.createEl('span', { text: tr(data, `XP · Nivel ${xp.level}`, `XP · Level ${xp.level}`) });
  label.createEl('span', { text: `${xpInLevel} / 500` });

  // Barra
  const track = wrap.createDiv({ cls: 'lq-widget-bar-track' });
  const fill = track.createDiv({ cls: 'lq-widget-bar-fill' });
  fill.setCssProps({ width: `${percent}%`, '--lq-widget-fill-accent': profile.accentColor });
}

function renderStreak(el: HTMLElement, data: LifequestData): void {
  const { streak } = data;
  const chip = el.createDiv({ cls: 'lq-widget-streak-chip' });

  chip.appendChild(createFlameIcon(data.profile.accentColor));

  chip.createEl('span', {
    cls: 'lq-widget-streak-number',
    text: String(streak.current),
  });
  chip.createEl('span', {
    cls: 'lq-widget-streak-label',
    text: streak.current === 1 ? tr(data, 'día', 'day') : tr(data, 'días', 'days'),
  });

  if (streak.current >= 7) {
    const mult = streak.current >= 30 ? '×2.0' : '×1.5';
    chip.createEl('span', {
      cls: 'lq-widget-multiplier-badge',
      text: tr(data, mult + ' XP activo', mult + ' XP active'),
    });
  }
}

function renderQuestsToday(el: HTMLElement, data: LifequestData): void {
  const today = new Date().toISOString().split('T')[0];
  const activeQuests = data.quests.filter(q => q.status === 'active' && q.frequency === 'daily');

  if (activeQuests.length === 0) {
    el.createDiv({
      cls: 'lq-widget-empty',
      text: tr(data, 'No tienes quests activas para hoy.', 'You have no active quests for today.'),
    });
    return;
  }

  const list = el.createDiv({ cls: 'lq-widget-quest-list' });

  for (const quest of activeQuests) {
    // Determinar estado desde activityLog del día de hoy
    const todayLog = data.activityLog.filter(
      log => log.timestamp.startsWith(today || '') && log.questId === quest.id
    );
    const isCompleted = todayLog.some(log => log.type === 'quest_completed');
    const isFailed = todayLog.some(log => log.type === 'quest_failed');

    const row = list.createDiv({ cls: 'lq-widget-quest-row' });
    if (isCompleted) row.addClass('lq-quest--completed');
    if (isFailed) row.addClass('lq-quest--failed');

    // Punto de color del área
    const area = data.settings.lifeAreas.find(a => a.id === quest.area);
    const dot = row.createDiv({ cls: 'lq-quest-dot' });
    if (area) dot.setCssProps({ '--lq-widget-dot-accent': area.color });

    row.createEl('span', { cls: 'lq-quest-title', text: quest.title });

    // Badge de estado
    if (isCompleted) {
      row.createEl('span', { cls: 'lq-badge lq-badge--success', text: `+${quest.xp} XP` });
    } else if (isFailed) {
      row.createEl('span', { cls: 'lq-badge lq-badge--danger', text: `−${quest.penalty} XP` });
    } else {
      row.createEl('span', { cls: 'lq-badge lq-badge--neutral', text: tr(data, 'pendiente', 'pending') });
    }
  }

  // Enlace a dashboard
  const link = el.createDiv({ cls: 'lq-widget-link' });
  link.createEl('a', { text: tr(data, 'abrir dashboard →', 'open dashboard →') });
  link.onclick = () => {
    executeWidgetCommand('lifequest:open-dashboard');
  };
}

function renderAreaProgress(
  el: HTMLElement,
  data: LifequestData,
  areaFilter: string | null
): void {
  let areas = data.settings.lifeAreas;
  if (areaFilter) {
    areas = areas.filter(a => a.name.toLowerCase() === areaFilter);
    if (areas.length === 0) {
      el.createDiv({
        cls: 'lq-widget-error',
        text: tr(data, `Área "${areaFilter}" no encontrada.`, `Area "${areaFilter}" not found.`),
      });
      return;
    }
  }

  const list = el.createDiv({ cls: 'lq-widget-area-list' });
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  for (const area of areas) {
    const areaQuests = data.quests.filter(q => q.status === 'active' && q.area === area.id);
    if (areaQuests.length === 0) continue;

    // Calcular tasa de éxito últimos 7 días
    const recentLogs = data.activityLog.filter(log => {
      const areaQuest = areaQuests.find(q => q.id === log.questId);
      return areaQuest && new Date(log.timestamp) >= sevenDaysAgo;
    });
    const completed = recentLogs.filter(l => l.type === 'quest_completed').length;
    const total = areaQuests.length * 7;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

    const row = list.createDiv({ cls: 'lq-widget-area-row' });

    const label = row.createDiv({ cls: 'lq-widget-area-label' });
    const dot = label.createDiv({ cls: 'lq-area-dot' });
    dot.setCssProps({ '--lq-widget-dot-accent': area.color });
    label.createEl('span', { text: area.name });

    const track = row.createDiv({ cls: 'lq-widget-bar-track' });
    const fill = track.createDiv({ cls: 'lq-widget-bar-fill' });
    fill.setCssProps({ width: `${pct}%`, '--lq-widget-fill-accent': area.color });

    row.createEl('span', { cls: 'lq-widget-area-pct', text: `${pct}%` });
  }
}

function renderCoins(el: HTMLElement, data: LifequestData): void {
  if (!data.coins || !data.settings.coinsEnabled || !data.settings.shopEnabled) {
    el.createDiv({
      cls: 'lq-widget-disabled',
      text: tr(data, 'El add-on de tienda no está habilitado.', 'The shop add-on is not enabled.'),
    });
    return;
  }

  const chip = el.createDiv({ cls: 'lq-widget-coins-chip' });
  chip.createEl('span', { cls: 'lq-coins-icon', text: '🪙' });
  chip.createEl('span', {
    cls: 'lq-coins-value',
    text: data.coins.balance.toLocaleString(),
  });
  chip.createEl('span', { cls: 'lq-coins-label', text: tr(data, 'monedas disponibles', 'available coins') });

  const link = el.createDiv({ cls: 'lq-widget-link' });
  link.createEl('a', { text: tr(data, 'abrir tienda →', 'open shop →') });
  link.onclick = () => {
    executeWidgetCommand('lifequest:open-shop');
  };
}

function renderWeeklyChart(
  el: HTMLElement,
  data: LifequestData,
  period: WidgetParams['period']
): void {
  const today = new Date();
  const referenceDateISO = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');

  const buckets = generateXPChartBuckets(data.activityLog, period, referenceDateISO);
  if (buckets.length === 0) {
    el.createDiv({
      cls: 'lq-widget-empty',
      text: tr(data, 'Aún no hay actividad para mostrar.', 'There is no activity to display yet.'),
    });
    return;
  }

  const densityClass = getChartDensityClass(buckets.length);
  const chart = el.createDiv({ cls: `lq-widget-chart ${densityClass}` });
  const maxXP = Math.max(...buckets.map((bucket) => bucket.value), 1);

  buckets.forEach((bucket, index) => {
    const col = chart.createDiv({ cls: 'lq-widget-chart-col' });
    const wrap = col.createDiv({ cls: 'lq-widget-chart-bar-wrap' });
    const bar = wrap.createDiv({ cls: 'lq-widget-chart-bar' });
    const heightPct = Math.round((bucket.value / maxXP) * 100);
    bar.setCssProps({ height: `${heightPct}%` });
    bar.addClass(`is-${bucket.state}`);
    const fullLabel = formatChartLabel(bucket.key, period, data, 'full');
    const shortLabel = formatChartLabel(bucket.key, period, data, 'short');
    bar.setAttribute('aria-label', `${fullLabel}: ${bucket.value} XP`);
    bar.setAttribute('title', `${fullLabel}: ${bucket.value} XP`);

    if (shouldRenderChartLabel(index, buckets.length, period, bucket.state)) {
      col.createEl('span', {
        cls: 'lq-widget-chart-label',
        text: shortLabel,
        attr: { title: fullLabel },
      });
    } else {
      col.createDiv({ cls: 'lq-widget-chart-label-spacer' });
    }
  });

  const total = buckets.reduce((sum, bucket) => sum + bucket.value, 0);
  el.createDiv({
    cls: 'lq-widget-chart-footer',
    text: tr(
      data,
      period === 'all' ? `XP acumulado visible: ${total}` : `XP del periodo: ${total}`,
      period === 'all' ? `Visible cumulative XP: ${total}` : `Period XP: ${total}`
    ),
  });
}

function formatChartLabel(
  key: string,
  period: WidgetParams['period'],
  data: LifequestData,
  mode: 'short' | 'full' = 'short'
): string {
  const locale = getLang(data) === 'es' ? 'es-ES' : 'en-US';

  if (period === 'week') {
    const date = new Date(`${key}T12:00:00`);
    if (mode === 'full') {
      return new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'short' }).format(date);
    }
    return new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date).slice(0, 3);
  }

  if (period === 'month') {
    const date = new Date(`${key}T12:00:00`);
    if (mode === 'full') {
      return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' }).format(date);
    }
    return String(parseInt(key.slice(-2), 10));
  }

  const [year, month] = key.split('-').map(Number);
  const date = new Date(year || 1970, (month || 1) - 1, 1, 12, 0, 0, 0);
  const monthLabel = new Intl.DateTimeFormat(locale, { month: mode === 'full' ? 'long' : 'short' }).format(date);
  return `${monthLabel} ${String((year || 1970)).slice(-2)}`;
}

function shouldRenderChartLabel(
  index: number,
  total: number,
  period: WidgetParams['period'],
  state: 'past' | 'current' | 'future' | 'neutral'
): boolean {
  if (total <= 8) return true;

  if (period === 'month') {
    if (state === 'current') return true;
    if (index === 0 || index === total - 1) return true;
    return index % 5 === 4;
  }

  if (period === 'all') {
    if (state === 'current') return true;
    if (index === 0 || index === total - 1) return true;

    const step = total <= 12 ? 3 : total <= 24 ? 6 : 12;
    return index % step === 0;
  }

  return true;
}

function getChartDensityClass(total: number): string {
  if (total >= 24) return 'is-dense';
  if (total >= 12) return 'is-medium';
  return 'is-regular';
}

function renderWeight(el: HTMLElement, data: LifequestData): void {
  if (!data.settings.healthEnabled || !data.settings.healthModules.weight || !data.health?.enabled || !data.health.profile) {
    el.createDiv({
      cls: 'lq-widget-disabled',
      text: tr(data, 'El submódulo de peso no está habilitado.', 'The weight submodule is not enabled.'),
    });
    return;
  }

  const entries = data.health.entries;
  if (entries.length === 0) {
    el.createDiv({ cls: 'lq-widget-empty', text: tr(data, 'Aún no tienes registros de peso.', 'You do not have weight entries yet.') });
    return;
  }

  const latest = entries[entries.length - 1];
  const profile = data.health.profile;
  const chip = el.createDiv({ cls: 'lq-widget-weight-chip' });

  chip.createEl('span', {
    cls: 'lq-weight-value',
    text: `${latest?.weightValue} ${profile.weightUnit}`,
  });
  chip.createEl('span', {
    cls: 'lq-weight-bmi',
    text: tr(data, `IMC ${latest?.bmi}`, `BMI ${latest?.bmi}`),
  });

  const link = el.createDiv({ cls: 'lq-widget-link' });
  link.createEl('a', { text: tr(data, 'ver seguimiento →', 'view tracking →') });
  link.onclick = () => {
    executeWidgetCommand('lifequest:open-health');
  };
}

function renderBloodPressure(el: HTMLElement, data: LifequestData): void {
  if (!data.settings.healthEnabled || !data.settings.healthModules.bloodPressure || !data.health?.enabled || !data.health.bpEntries || data.health.bpEntries.length === 0) {
    el.createDiv({
      cls: 'lq-widget-disabled',
      text: tr(data, 'No hay registros de presión arterial recientes.', 'There are no recent blood pressure entries.'),
    });
    return;
  }

  const entries = data.health.bpEntries;
  const latest = entries[entries.length - 1]!;
  const chip = el.createDiv({ cls: 'lq-widget-weight-chip' });
  
  // Reutilizamos las clases de peso para mantener el estilo
  chip.createEl('span', {
    cls: 'lq-weight-value',
    text: `🫀 ${latest.systolic} / ${latest.diastolic}`,
  });
  
  if (latest.pulse) {
    chip.createEl('span', {
      cls: 'lq-weight-bmi lq-weight-bmi--offset'
      ,
      text: tr(data, `· ${latest.pulse} lpm`, `· ${latest.pulse} bpm`)
    });
  }

  const link = el.createDiv({ cls: 'lq-widget-link' });
  link.createEl('a', { text: tr(data, 'ver historial →', 'view history →') });
  link.onclick = () => {
    executeWidgetCommand('lifequest:open-health');
  };
}

function renderHealthProgress(el: HTMLElement, data: LifequestData): void {
  if (!data.settings.healthEnabled || !data.settings.healthModules.weight || !data.health?.enabled || !data.health.profile || data.health.entries.length === 0) {
    el.createDiv({ cls: 'lq-widget-disabled', text: tr(data, 'Sin datos de salud.', 'No health data.') });
    return;
  }

  // Importar calculateHealthMetrics desde health-engine (importado al inicio del archivo)
  const metrics = calculateHealthMetrics(data.health.profile, data.health.entries);
  if (!metrics) return;

  const wrap = el.createDiv({ cls: 'lq-widget-health-wrap' });

  const labelRow = wrap.createDiv({ cls: 'lq-widget-health-label' });
  labelRow.createEl('span', { text: tr(data, 'Meta de salud', 'Health goal') });
  labelRow.createEl('span', { text: `${metrics.progressPercent}%` });

  const track = wrap.createDiv({ cls: 'lq-widget-bar-track' });
  const fill = track.createDiv({ cls: 'lq-widget-bar-fill' });
  fill.setCssProps({ width: `${metrics.progressPercent}%`, '--lq-widget-fill-accent': data.profile.accentColor });

  if (metrics.projectedArrivalDate) {
    wrap.createEl('div', {
      cls: 'lq-widget-projection',
      text: tr(data, `Proyección: ${metrics.projectedArrivalDate}`, `Projection: ${metrics.projectedArrivalDate}`),
    });
  }
}

/**
 * Registra el widget para actualizarse automáticamente cuando data.json cambia.
 * Se llama desde el processor de Obsidian. El ctx permite acceder al archivo actual.
 */
export function registerWidgetAutoRefresh(
  el: HTMLElement,
  params: WidgetParams,
  plugin: LifequestPlugin,
  ctx: MarkdownPostProcessorContext
): void {
  // Suscribirse al evento de cambio de datos del plugin
  // El plugin expone un EventEmitter interno 'data-changed'
  const handler = () => {
    if (el.isConnected) {  // Solo re-renderizar si el elemento sigue en el DOM
      renderWidget(el, params, plugin.data);
    }
  };

  plugin.events.on('data-changed', handler);

  // Limpiar el listener cuando el bloque de código se desmonte
  // Obsidian llama a esto automáticamente al cerrar la nota
  class WidgetAutoRefreshChild extends MarkdownRenderChild {
    override onload(): void {}
    override onunload(): void {
      plugin.events.off('data-changed', handler);
    }
  }

  ctx.addChild(new WidgetAutoRefreshChild(el));
}

function createFlameIcon(accentColor: string): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', '14');
  svg.setAttribute('height', '18');
  svg.setAttribute('viewBox', '0 0 14 18');
  svg.setAttribute('fill', 'none');

  const outer = document.createElementNS(ns, 'path');
  outer.setAttribute('d', 'M7 0C7 0 13 6.3 13 10.5C13 14.1 10.3 17 7 17C3.7 17 1 14.1 1 10.5C1 6.3 7 0 7 0Z');
  outer.setAttribute('fill', accentColor);
  outer.setAttribute('opacity', '0.9');

  const inner = document.createElementNS(ns, 'path');
  inner.setAttribute('d', 'M7 6C7 6 10 9 10 11.5C10 13.4 8.7 15 7 15C5.3 15 4 13.4 4 11.5C4 9 7 6 7 6Z');
  inner.setAttribute('fill', '#FAEEDA');

  svg.append(outer, inner);
  return svg;
}
