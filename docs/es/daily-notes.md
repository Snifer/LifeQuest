# Daily notes

[Índice](../README.md) · [English](../en/daily-notes.md)

Esta guía explica cómo LifeQuest genera y sincroniza el bloque de la nota diaria.

## Camino rápido

1. Define el formato de tu daily note en ajustes
2. Crea quests activas
3. Ejecuta **Generate today’s quests in daily note**
4. Marca los ítems en la nota
5. Deja que LifeQuest sincronice el progreso

## Qué genera el plugin

LifeQuest inserta un bloque gestionado en la nota de hoy.

Ese bloque puede incluir:

- un encabezado
- checkboxes de quests
- agrupación opcional por área
- mensaje motivacional opcional encima del bloque

## Configuración soportada

### Formato de daily note

Controla cómo LifeQuest identifica la nota de hoy.

Ejemplo:

```text
YYYY-MM-DD
```

### Plantilla del bloque diario

Puedes personalizar la plantilla usando:

- `{title}`
- `{content}`
- `{date}`

Ejemplo:

```text
{title}

{content}
```

Ejemplo con callout:

```text
> [!todo] {date}
> Focus for today

{content}
```

### Agrupar quests por área

Cuando está activo, LifeQuest divide el bloque en secciones como:

```text
### 📚 Aprendizaje
- [ ] Leer 10 páginas #lq-...
```

### Insertar solo quests pendientes

Cuando está activo, al regenerar el bloque se ocultan las quests ya completadas hoy.

Es útil si vuelves a construir la nota más tarde y solo quieres ver lo que falta.

## Sincronización

LifeQuest lee el estado de los checkboxes del bloque generado y sincroniza:

- quests completadas
- quests falladas o revertidas
- cambios de XP
- actualizaciones de racha
- notices y logs relacionados

## Edición manual

Puedes editar el texto visible de la quest, pero conserva el tag de LifeQuest:

```text
#lq-quest-id
```

Ese tag es lo que permite que LifeQuest siga sincronizando correctamente esa línea.

Si eliminas el tag, el plugin ya no podrá mapear esa línea a la quest real.

## Qué pasa con quests no completadas

LifeQuest revisa el día anterior y puede aplicar penalizaciones por quests incompletas cuando corresponde.

## Consejos

- conserva intacto el tag generado
- evita duplicar manualmente el mismo bloque gestionado
- usa agrupación si tu nota se vuelve larga
- usa el modo de solo pendientes si regeneras con frecuencia

## Siguiente paso

Lee:

- [Widgets](widgets.md)
- [Solución de problemas](troubleshooting.md)
