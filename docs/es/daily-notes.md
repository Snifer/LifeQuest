# Daily notes

[Índice](../README.md) · [English](../en/daily-notes.md)

Esta guía explica cómo LifeQuest genera el bloque de la nota diaria y cómo funciona la sincronización Markdown más allá de la daily note.

## Camino rápido

1. Define el formato de tu daily note en ajustes
2. Crea quests activas
3. Ejecuta **Generate today’s quests in daily note**
4. Marca los ítems en la nota
5. Deja que LifeQuest sincronice el progreso

Para Kanban u otros flujos Markdown:

1. Copia un checkbox Markdown desde la UI de la quest, o conserva el tag `#lq-...` en la línea
2. Define el **alcance de sincronización Markdown** en ajustes
3. Prefiere **carpetas específicas** si no quieres revisar toda la bóveda
4. Agrega **carpetas excluidas** para archive, templates o zonas que no deberían afectar la sync

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

## Alcance de sincronización Markdown

LifeQuest puede monitorear checkboxes de quests de tres formas:

| Alcance | Qué monitorea | Recomendado para |
|---------|----------------|------------------|
| Solo daily note | El archivo de la nota diaria de hoy | Flujo por defecto |
| Carpetas específicas | Archivos Markdown dentro de carpetas elegidas | Tableros Kanban, notas de proyectos |
| Toda la bóveda | Todos los archivos Markdown del vault | Configuraciones avanzadas |

Si usás Kanban, el mejor balance normalmente es **carpetas específicas**.

### Carpetas excluidas

Usa carpetas excluidas cuando quieras mantener la sync Markdown activa pero necesites ignorar zonas como:

- archive
- templates
- notas importadas
- carpetas internas del plugin

LifeQuest ya evita rutas internas como `_LifeQuest` y `.obsidian`, y encima de eso puedes sumar tus propias exclusiones.

## Formato Markdown soportado

La sincronización funciona cuando la línea del checkbox conserva el tag de la quest:

```text
- [ ] Build feature #lq-d23a-6cfb-4945-afe3-ecd6ea596e0c
- [x] Build feature #lq-d23a-6cfb-4945-afe3-ecd6ea596e0c
```

Eso significa:

- el checkbox debe ser Markdown válido
- el tag `#lq-...` debe seguir en la misma línea
- el texto visible puede cambiar

Funciona con:

- daily notes
- tarjetas Kanban que guarden checklist en Markdown
- notas normales de proyecto

## Edición manual

Puedes editar el texto visible de la quest, pero conserva el tag de LifeQuest:

```text
#lq-quest-id
```

Ese tag es lo que permite que LifeQuest siga sincronizando correctamente esa línea.

Si eliminas el tag, el plugin ya no podrá mapear esa línea a la quest real.

## Qué pasa con quests no completadas

LifeQuest revisa el día anterior y puede aplicar penalizaciones por quests incompletas cuando corresponde.

Limitación importante:

- las penalizaciones retroactivas del día anterior hoy salen del flujo de **daily note**
- la sincronización Markdown genérica se usa para completados, no para penalties retroactivas
- todavía no existe un modo de penalties multiarchivo

Por qué existe esta limitación:

- una tarjeta Kanban o nota de proyecto puede permanecer abierta muchos días
- un checkbox sin marcar en esos archivos no significa de forma confiable “falló ayer”
- usar Markdown genérico para penalties generaría castigos incorrectos

## Consejos

- conserva intacto el tag generado
- evita duplicar manualmente el mismo bloque gestionado
- usa agrupación si tu nota se vuelve larga
- usa el modo de solo pendientes si regeneras con frecuencia
- en bóvedas grandes, prefiere carpetas específicas antes que toda la bóveda
- agrega carpetas excluidas si tu vault tiene áreas de archive o templates

## Siguiente paso

Lee:

- [Widgets](widgets.md)
- [Solución de problemas](troubleshooting.md)
