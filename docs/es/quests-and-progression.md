# Quests y progresión

[Índice](../README.md) · [English](../en/quests-and-progression.md)

Esta guía explica cómo funcionan las quests, la XP, los niveles, las rachas, las insignias y las clases en LifeQuest.

## Camino rápido

1. Crea una quest
2. Asígnala a un área de vida
3. Complétala, márcala como fallida o reseteala desde el dashboard, o complétala desde la nota diaria
4. Observa cómo cambian XP, rachas y recompensas

## Tipos de quests

LifeQuest soporta estas frecuencias:

- `daily`
- `weekly`
- `monthly`
- `free`

### Uso recomendado

| Frecuencia | Buen caso de uso |
|---|---|
| Daily | hábitos y ejecución repetida |
| Weekly | compromisos semanales más grandes |
| Monthly | hitos o revisiones |
| Free | tareas manuales o flexibles |

## Campos de una quest

Cada quest puede incluir:

- título
- área de vida
- dificultad
- recompensa de XP
- penalización
- recordatorio
- nota opcional
- estado

## Subquests

LifeQuest ahora soporta **un nivel de subquests**.

Comportamiento actual:

- una quest root puede contener subquests
- cada subquest tiene su propia XP, penalización, recordatorio y dificultad
- las subquests se pueden colapsar o expandir bajo su quest padre
- las subquests se pueden reordenar entre siblings desde el modal de quests
- la quest padre puede seguir siendo manual o autocompletarse cuando todas las subquests activas están hechas, según ajustes
- las vistas jerárquicas pueden cambiar a modo solo roots y expandir o colapsar todas las roots de una vez

Limitación importante:

- en esta primera iteración solo se soporta un nivel de anidación

## Copiar una quest a Markdown o Kanban

LifeQuest ahora te deja copiar referencias de quest directamente desde la UI:

- **Copiar tag** → `#lq-<id>`
- **Copiar checkbox Markdown** → `- [ ] Título de la quest #lq-<id>`
- **Command Palette** → `LifeQuest: Copy quest as Markdown`

Usa el checkbox Markdown completo cuando quieras el camino más rápido hacia Kanban o cualquier nota normal. El flujo por Command Palette sirve cuando quieres encontrar una quest rápido sin abrir el modal de configuración.

## Flujo diario desde el dashboard

El dashboard ahora soporta un loop más rápido:

- quests pendientes, completadas y fallidas se muestran en secciones separadas
- las completadas se pueden ocultar y las secciones de completadas o fallidas se pueden colapsar
- cada fila tiene botones explícitos para completar, fallar o resetear
- las acciones rápidas incluyen nueva quest, completar rápido y copiar Markdown
- el orden del dashboard puede seguir modo manual, prioridad, XP o área

Nota actual sobre el orden por prioridad:

- por ahora la prioridad se infiere a partir de dificultad, penalización y XP

## Dificultad

La dificultad afecta cómo se siente la quest dentro del sistema y puede influir en lógica de recompensas relacionada.

Usa:

- easy para hábitos de baja fricción
- normal para trabajo base
- hard para esfuerzo relevante
- epic para acciones raras y de alto valor

## XP y niveles

Completar quests da XP.

Fallar o dejar pasar quests puede aplicar penalizaciones.

La progresión de niveles depende de:

- XP total
- `XP per level` en ajustes

## Rachas

Las rachas aumentan cuando mantienes actividad diaria.

Sirven para:

- feedback de progreso
- ritmo motivacional
- lógica opcional de recompensas

## Clases y áreas de vida

Tu clase de héroe da un bonus a un área de vida.

Ejemplos:

- health
- work
- learning
- relationships
- finances

Las clases y áreas trabajan juntas para reflejar tus prioridades.

## Insignias

LifeQuest desbloquea insignias para algunos hitos, por ejemplo:

- hitos de racha
- hitos de nivel

Las insignias también pueden dar XP extra.

## Consejos para diseñar buenas quests

- usa títulos cortos y claros
- evita tareas vagas como “trabajar más”
- prefiere acciones visibles
- empieza más fácil de lo que crees
- usa penalizaciones con cuidado

## Siguiente paso

Lee:

- [Daily notes](daily-notes.md)
- [Revisión semanal](weekly-review.md)
