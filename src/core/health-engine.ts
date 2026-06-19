import type { WeightUnit, HeightUnit, WeightEntry, HealthProfile, HealthMetrics, BMICategory, RewardSettings } from '../types';

function startOfWeek(date: Date): Date {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() + diff);
  return copy;
}

function getWeekKey(date: Date): string {
  return startOfWeek(date).toISOString().split('T')[0] || '';
}

function normalizeWeighInDay(day: number): number {
  if (day < 0 || day > 6) return 1;
  return day;
}

/** Convierte peso a kg independientemente de la unidad de entrada */
export function toKg(value: number, unit: WeightUnit): number {
  return unit === 'lb' ? value * 0.453592 : value;
}

/** Convierte kg a la unidad de destino */
export function fromKg(kg: number, unit: WeightUnit): number {
  return unit === 'lb' ? kg / 0.453592 : kg;
}

/** Convierte altura a cm independientemente de la unidad de entrada */
export function toCm(value: number, unit: HeightUnit): number {
  return unit === 'ft' ? value * 30.48 : value;
}

/**
 * Calcula el IMC (Índice de Masa Corporal).
 * weight en kg, height en cm. Retorna número redondeado a 1 decimal.
 */
export function calculateBMI(weightKg: number, heightCm: number): number {
  if (heightCm <= 0 || weightKg <= 0) return 0;
  const heightM = heightCm / 100;
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
}

/** Clasifica el IMC según los rangos estándar de la OMS */
export function getBMICategory(bmi: number): BMICategory {
  if (bmi < 18.5) return 'underweight';
  if (bmi < 25)   return 'normal_range';
  if (bmi < 30)   return 'overweight';
  if (bmi < 35)   return 'obese_class_1';
  if (bmi < 40)   return 'obese_class_2';
  return 'obese_class_3';
}

/**
 * Peso ideal aproximado según la fórmula de Devine (referencia, no prescripción).
 * No se muestra como "deberías pesar X" — solo como referencia informativa.
 * heightCm: altura en cm. sex: 'male' | 'female' | 'prefer_not_to_say'
 */
export function getDevineReferenceWeight(
  heightCm: number,
  sex: HealthProfile['biologicalSex']
): number | null {
  if (sex === 'prefer_not_to_say') return null;
  const inchesOver5Feet = Math.max(0, (heightCm / 2.54) - 60);
  const base = sex === 'male' ? 50 : 45.5;
  return Math.round((base + 2.3 * inchesOver5Feet) * 10) / 10;
}

/**
 * Rango de peso que corresponde a IMC 18.5–24.9 para la altura dada.
 * Retorna {min, max} en kg. Solo informativo — no es una prescripción.
 */
export function getNormalBMIWeightRange(
  heightCm: number
): { min: number; max: number } {
  const hM = heightCm / 100;
  return {
    min: Math.round(18.5 * hM * hM * 10) / 10,
    max: Math.round(24.9 * hM * hM * 10) / 10,
  };
}

/**
 * Calcula el promedio de cambio de peso por semana usando las últimas N entradas.
 * Usa regresión lineal simple para suavizar fluctuaciones.
 * Retorna kg/semana (negativo = pérdida, positivo = ganancia).
 * Retorna null si hay menos de 2 entradas.
 */
export function calculateWeeklyTrend(
  entries: WeightEntry[],
  unit: WeightUnit,
  lookbackWeeks = 4
): number | null {
  if (entries.length < 2) return null;
  const sorted = [...entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const lastDate = new Date(sorted[sorted.length - 1]!.date);
  const cutoff = new Date(lastDate);
  cutoff.setDate(cutoff.getDate() - lookbackWeeks * 7);
  const recent = sorted.filter((entry) => new Date(entry.date).getTime() >= cutoff.getTime());
  if (recent.length < 2) return null;

  const n = recent.length;
  const firstDate = new Date(recent[0]!.date);
  const xs = recent.map((entry) => (new Date(entry.date).getTime() - firstDate.getTime()) / (7 * 24 * 3600 * 1000));
  const ys = recent.map((entry) => toKg(entry.weightValue, unit));

  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((acc, x, i) => acc + x * ys[i]!, 0);
  const sumX2 = xs.reduce((acc, x) => acc + x * x, 0);

  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) return null;
  const slope = (n * sumXY - sumX * sumY) / denominator;
  return Math.round(slope * 100) / 100;
}

/**
 * Proyecta en cuántas semanas se llegará a la meta dado el ritmo actual.
 * Retorna null si no hay tendencia o si la tendencia va en dirección contraria.
 */
export function projectWeeksToGoal(
  currentWeightKg: number,
  targetWeightKg: number,
  weeklyTrendKg: number | null
): number | null {
  if (weeklyTrendKg === null || weeklyTrendKg === 0) return null;

  const diff = targetWeightKg - currentWeightKg;
  // Si la tendencia va en dirección contraria a la meta: no proyectar
  if ((diff < 0 && weeklyTrendKg > 0) || (diff > 0 && weeklyTrendKg < 0)) return null;

  const weeks = Math.abs(diff / weeklyTrendKg);
  return Math.ceil(weeks);
}

/** Calcula la fecha proyectada de llegada a la meta */
export function projectArrivalDate(weeksToGoal: number | null): string | null {
  if (weeksToGoal === null) return null;
  const date = new Date();
  date.setDate(date.getDate() + weeksToGoal * 7);
  return date.toISOString().split('T')[0] || null;
}

/**
 * Calcula el porcentaje de progreso hacia la meta (0–100).
 * Para lose_weight: 100% = llegó al target.
 * Para gain_weight: idem pero en sentido contrario.
 * Para maintain: 100% si la variación es < 2kg del target.
 */
export function calculateProgressPercent(
  startKg: number,
  currentKg: number,
  targetKg: number,
  goalType: HealthProfile['goalType']
): number {
  if (goalType === 'maintain' || goalType === 'body_recomp') {
    const diff = Math.abs(currentKg - targetKg);
    return Math.round(Math.max(0, Math.min(100, (1 - diff / 5) * 100)));
  }

  const totalDiff = Math.abs(targetKg - startKg);
  if (totalDiff === 0) return 100;

  const achieved = Math.abs(currentKg - startKg);
  return Math.round(Math.min(100, (achieved / totalDiff) * 100));
}

/**
 * Calcula todas las métricas de salud a partir del estado actual.
 * Esta función es la única que el UI debe llamar — no calcular nada en la vista.
 */
export function calculateHealthMetrics(
  profile: HealthProfile,
  entries: WeightEntry[]
): HealthMetrics | null {
  if (entries.length === 0) return null;

  const heightCm = toCm(profile.heightValue, profile.heightUnit);
  const latest = entries[entries.length - 1]!;
  const first = entries[0]!;

  const currentKg = toKg(latest.weightValue, profile.weightUnit);
  const startKg = toKg(first.weightValue, profile.weightUnit);
  const targetKg = toKg(profile.targetWeight, profile.weightUnit);

  const bmi = calculateBMI(currentKg, heightCm);
  const weeklyTrend = calculateWeeklyTrend(entries, profile.weightUnit);
  const weeksToGoal = projectWeeksToGoal(currentKg, targetKg, weeklyTrend);

  const now = new Date();
  const sorted = [...entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const uniqueWeeks = Array.from(new Set(sorted.map((entry) => getWeekKey(new Date(entry.date)))));
  let streak = 0;
  let cursor = startOfWeek(now);
  while (true) {
    const key = cursor.toISOString().split('T')[0] || '';
    if (!uniqueWeeks.includes(key)) break;
    streak++;
    cursor.setDate(cursor.getDate() - 7);
  }
  const firstWeek = startOfWeek(new Date(first.date));
  const totalWeeksTracked = Math.max(1, Math.floor((startOfWeek(now).getTime() - firstWeek.getTime()) / (7 * 24 * 3600 * 1000)) + 1);

  return {
    currentWeight: latest.weightValue,
    startWeight: first.weightValue,
    targetWeight: profile.targetWeight,
    bmi,
    bmiCategory: getBMICategory(bmi),
    totalChange: Math.round((latest.weightValue - first.weightValue) * 10) / 10,
    weeklyTrend: weeklyTrend || 0,
    progressPercent: calculateProgressPercent(startKg, currentKg, targetKg, profile.goalType),
    weeksToGoal,
    projectedArrivalDate: projectArrivalDate(weeksToGoal),
    streak,
    totalWeighIns: entries.length,
    missedWeighIns: Math.max(0, totalWeeksTracked - uniqueWeeks.length),
  };
}

/**
 * XP que otorga un registro de peso semanal.
 * Se integra con engine.ts existente — llamar calculateXP normal más este bonus.
 */
export function getWeighInXP(streak: number): number {
  const base = 20;                               // base siempre
  const streakBonus = Math.min(streak * 5, 50); // hasta +50 XP por racha
  return base + streakBonus;
}

/** Monedas por registrar el peso semanal */
export function getWeighInCoins(streak: number, rewardSettings: RewardSettings): number {
  if (streak >= 12) return rewardSettings.weighIn.streak12;
  if (streak >= 4)  return rewardSettings.weighIn.streak4;
  return rewardSettings.weighIn.base;
}

/** Verifica si el usuario necesita registrar su peso esta semana */
export function needsWeighIn(entries: WeightEntry[], weighInDay: number, referenceDate: Date = new Date()): boolean {
  const normalizedDay = normalizeWeighInDay(weighInDay);
  if (referenceDate.getDay() < normalizedDay) return false;

  const currentWeekKey = getWeekKey(referenceDate);
  return !entries.some((entry) => getWeekKey(new Date(entry.date)) === currentWeekKey);
}
