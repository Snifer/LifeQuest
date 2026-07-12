# Primeros pasos

[Índice](../README.md) · [English](../en/getting-started.md)

Esta guía te lleva desde la instalación hasta tu primer flujo útil con LifeQuest.

## Camino rápido

1. Instala y activa el plugin
2. Completa el onboarding
3. Abre el dashboard
4. Crea tu primera quest
5. Genera el bloque de la nota diaria
6. Opcional: activa sincronización Markdown por carpetas si usás Kanban

## Qué es LifeQuest

LifeQuest convierte la ejecución diaria en un sistema local estilo RPG con:

- quests
- XP y niveles
- rachas
- revisiones semanales
- widgets en notas
- add-ons opcionales de tienda y salud

## Instalación

### Instalación manual

1. Compila o descarga `main.js`, `manifest.json` y `styles.css`
2. Cópialos a:

   ```text
   .obsidian/plugins/lifequest/
   ```

3. Abre **Settings → Community plugins**
4. Activa **LifeQuest**

## Configuración inicial

En una instalación nueva, LifeQuest abre un onboarding para configurar:

- idioma
- nombre y lema del héroe
- áreas base de vida
- clase inicial
- formato de daily note
- add-ons opcionales

Puedes reabrir el onboarding después desde:

- los ajustes del plugin
- el comando de onboarding

## Vistas principales

### Dashboard

Úsalo como centro principal para ver:

- resumen del héroe
- resumen de hoy
- gráfico semanal
- áreas de vida
- actividad reciente
- acciones rápidas

### Revisión semanal

Úsala para revisar:

- XP ganada
- tasa de completado
- rendimiento por área
- rendimiento de quests
- insights y ajustes para la siguiente semana

## Flujo recomendado para empezar

1. Abre el dashboard
2. Crea 3 a 5 quests diarias simples
3. Genera las quests de hoy en la nota diaria
4. Márcalas durante el día
5. Revisa el dashboard por la noche
6. Completa la revisión semanal al final de la semana

## Almacenamiento por defecto

LifeQuest guarda sus datos localmente en:

- `_LifeQuest/data.json`
- `_LifeQuest/health/historial.csv` para exportaciones CSV de salud

## Siguiente paso

Lee:

- [Quests y progresión](quests-and-progression.md)
- [Daily notes](daily-notes.md)
- [Widgets](widgets.md)
