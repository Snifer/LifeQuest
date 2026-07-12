# LifeQuest

<p align="center">
  <a href="https://obsidian.md/plugins"><img src="https://img.shields.io/badge/Obsidian-Plugin-7C3AED?logo=obsidian" alt="Obsidian Plugin"></a>
  <a href="https://github.com/Snifer/LifeQuest/releases"><img src="https://img.shields.io/github/v/release/Snifer/LifeQuest?label=version" alt="Latest release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green.svg" alt="MIT License"></a>
  <img src="https://img.shields.io/github/downloads/Snifer/LifeQuest/total?logo=github" alt="GitHub Downloads">
  <a href="https://ko-fi.com/bastiondeldino"><img src="https://img.shields.io/badge/Ko--fi-Buy%20me%20a%20coffee-ff5f5f?logo=ko-fi&logoColor=white" alt="Ko-fi"></a>
</p>

[English](README.md) | [Español](README-es.md)

LifeQuest es un plugin para Obsidian que convierte la ejecución diaria en un sistema local de progresión estilo RPG. Combina quests, XP, rachas, revisiones semanales, widgets embebibles y add-ons opcionales para economía y seguimiento de salud.

LifeQuest comenzó como un plugin personal construido alrededor de mi propio flujo de trabajo. Lo estoy compartiendo porque creo que también puede ser útil para otras personas. Si ves formas de mejorarlo, no dudes en abrir un issue, sugerir cambios o pedir nuevas funciones para que podamos seguir puliéndolo con el tiempo. Si quieres conocer más de mis proyectos relacionados con productividad, puedes encontrarlos en mi canal de YouTube: [youtube.com/c/sniferl4bs](https://youtube.com/c/sniferl4bs).

## Qué hace el plugin

### Sistema principal
- Perfil de héroe con nombre, lema, avatar, color de acento y clase.
- Áreas de vida personalizadas con colores.
- Sistema de quests con frecuencias `daily`, `weekly`, `monthly` y `free`.
- Dificultad, recompensa de XP, penalización, recordatorios y notas por quest.
- Progresión de XP con XP por nivel configurable.
- Seguimiento de rachas con multiplicadores y registro de actividad.
- Vista de revisión semanal con estadísticas, tendencias, insights y preguntas de reflexión.
- Vista de dashboard con resumen del héroe, resumen de hoy, gráfico semanal, áreas de vida, registro de actividad y acciones rápidas.

### Integración con daily notes
- Genera un bloque de quests dentro de la daily note usando el formato de fecha configurado.
- Soporta una plantilla configurable del bloque usando los placeholders `{title}`, `{content}` y `{date}`.
- Puede agrupar quests por área de vida dentro del bloque generado.
- Puede insertar solo quests pendientes al regenerar el bloque diario.
- Analiza checkboxes de Markdown con tags `#lq-...` y sincroniza el estado de completado de vuelta en LifeQuest.
- Puede monitorear solo la daily note, carpetas específicas o toda la bóveda para la sincronización Markdown.
- Aplica penalizaciones del día anterior solo a través del flujo de daily note.
- Soporta un mensaje motivacional diario opcional encima del bloque generado.

### Sincronización Markdown de quests
- Cualquier checkbox Markdown que conserve un tag de LifeQuest como `#lq-d23a-...` puede sincronizar completados.
- Esto funciona con daily notes, tarjetas de Kanban y otros flujos basados en Markdown.
- Puedes copiar el tag o un checkbox Markdown completo directamente desde la UI de la quest.
- En bóvedas grandes, lo recomendado es usar **carpetas específicas** en lugar de **toda la bóveda**.
- También puedes definir **carpetas excluidas** para ignorar archivos de archive, templates o datos internos del plugin.
- Limitación: las penalizaciones del día anterior **todavía no** se derivan de archivos Markdown genéricos; siguen dependiendo de la daily note.

### Widgets
LifeQuest registra un procesador de bloques de código Markdown para bloques ````lifequest````, por lo que puedes incrustar widgets en cualquier nota.

Elementos de widget soportados:
- `profile`
- `xp-bar`
- `level`
- `streak`
- `multiplier`
- `quests-today`
- `area-progress`
- `weekly-chart`
- `coins`
- `weight`
- `health-progress`
- `bmi`
- `blood-pressure` / `bp`

Ejemplo:

```lifequest
show: profile, xp-bar, streak, quests-today
theme: card
title: Estado de hoy
```

## Sistema de add-ons

LifeQuest separa la funcionalidad opcional en add-ons expuestos en **Settings → LifeQuest → Add-ons**.

### Add-on de tienda
- Habilita la vista Hero Shop.
- Permite canjear recompensas usando monedas.
- Incluye recompensas de monedas configurables para subidas de nivel, insignias, hitos de racha, revisiones semanales, semanas perfectas, quests épicas y pesajes de salud.
- Puede mostrar el balance de monedas directamente en el encabezado del dashboard.
- Puede restaurar el catálogo de recompensas por defecto sin borrar las recompensas personalizadas.

Dependencias y comportamiento:
- La economía en sí está controlada por `coinsEnabled`.
- La UI de tienda está controlada por `shopEnabled`.
- Si las recompensas con monedas están desactivadas, los comandos de tienda se bloquean incluso si el add-on de tienda está habilitado.

### Add-on de salud
- Habilita la vista de seguimiento de salud.
- Submódulos internos modulares:
  - Seguimiento de peso e IMC
  - Registro de presión arterial
  - Medicamentos y registro de tomas
- Incluye un flujo de configuración de perfil corporal para el módulo de peso.
- Puede exportar el historial de peso a `_LifeQuest/health/historial.csv`.
- Programa un recordatorio de pesaje cuando el perfil tiene recordatorios habilitados.

Dependencias y comportamiento:
- El add-on está controlado por `healthEnabled`.
- Cada submódulo se activa de forma independiente mediante `healthModules`.
- Los widgets y comandos de peso requieren que primero se configure el perfil corporal.

## Comandos

El plugin registra actualmente estos comandos:
- `LifeQuest: Open dashboard`
- `LifeQuest: New quest`
- `LifeQuest: Weekly review`
- `LifeQuest: Generate today's quests in daily note`
- `LifeQuest: Edit profile`
- `LifeQuest: Open hero shop`
- `LifeQuest: Health tracking`
- `LifeQuest: Log today's weight`

## Datos almacenados

LifeQuest guarda sus datos localmente dentro del vault:
- Archivo principal de datos: `_LifeQuest/data.json`
- Exportación CSV de salud: `_LifeQuest/health/historial.csv`

El plugin es local-first. La única función relacionada con red presente actualmente es la fuente remota opcional para mensajes motivacionales diarios, configurada explícitamente por el usuario.

## Vistas e interfaz

Vistas personalizadas implementadas actualmente:
- Dashboard
- Weekly review
- Shop
- Health tracker

Flujos adicionales de UI:
- Modal de edición de perfil
- Modal de configuración de quests
- Modal de configuración de salud
- Panel de ajustes con secciones laterales para interfaz, héroe, progresión, economía, add-ons, datos y acerca de

## Instalación

### Instalación manual
1. Compila o descarga `main.js`, `manifest.json` y `styles.css`.
2. Cópialos dentro de tu vault en `.obsidian/plugins/lifequest/`.
3. Abre **Settings → Community plugins**.
4. Activa **LifeQuest**.

## Desarrollo

Requisitos:
- Node.js 18+
- npm

Comandos:
- `npm install`
- `npm run dev`
- `npm run build`
- `npm test -- --runInBand`
- `npm run lint`

## Notas de implementación actuales

- El plugin está dividido en módulos dentro de `src/`, con `main.ts` actuando como punto de entrada del ciclo de vida.
- Los tests actualmente cubren el motor y la lógica de análisis/selección de mensajes diarios.
- El widget `weekly-chart` soporta `period: week`, `period: month` y `period: all`.
- La sincronización Markdown de quests soporta monitoreo por alcance desde ajustes: daily note, carpetas específicas o toda la bóveda.

## Licencia

MIT
