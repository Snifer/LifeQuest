# Widgets

[Índice](../README.md) · [English](../en/widgets.md)

Los widgets te permiten incrustar vistas vivas de LifeQuest dentro de cualquier nota usando un bloque de código markdown.

## Camino rápido

1. Crea un bloque de código con `lifequest`
2. Define `show`
3. Opcionalmente define `theme`, `title` o `period`
4. Previsualiza la nota

## Sintaxis

```lifequest
show: profile, xp-bar, streak
theme: card
title: Hoy
```

## Elementos soportados

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
- `blood-pressure`
- `bp`

## Parámetros comunes

| Parámetro | Uso |
|---|---|
| `show` | Qué widgets renderizar |
| `theme` | Estilo visual |
| `title` | Título opcional |
| `period` | Usado por widgets temporales como `weekly-chart` |

## Ejemplo: resumen del héroe

```lifequest
show: profile, level, xp-bar, streak
theme: card
title: Hero snapshot
```

## Ejemplo: gráfico mensual

```lifequest
show: weekly-chart
period: month
theme: card
title: XP this month
```

## Notas

- los widgets se actualizan a partir de los datos del plugin
- algunos widgets de salud requieren el add-on de salud y un perfil configurado
- los widgets de monedas requieren que la economía/tienda esté activa

## Siguiente paso

Lee:

- [Primeros pasos](getting-started.md)
- [Add-on de salud](health-addon.md)
