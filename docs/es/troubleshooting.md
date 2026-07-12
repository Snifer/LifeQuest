# Solución de problemas

[Índice](../README.md) · [English](../en/troubleshooting.md)

Si tienes algun problema revisa si alguna de las siguientes opciones lo soluciona si no procederas a crear el issue y reportarlo.

## El dashboard no abre

- Confirma que el plugin esté activado
- Ejecuta el comando del dashboard
- Recarga Obsidian si hace falta

## El bloque de daily note no aparece

- revisa `Daily note format`
- asegúrate de tener quests activas
- confirma que el nombre de la nota de hoy coincide con el formato configurado

## La sincronización de checkboxes no funciona

- conserva intacto el tag `#lq-...`
- evita borrar los marcadores del bloque gestionado
- regenera el bloque si quedó inconsistente
- si la quest está fuera de la daily note, revisa el **alcance de sincronización Markdown**
- si usás carpetas específicas, confirma que el archivo esté dentro de una de esas rutas
- el modo de toda la bóveda puede ser más pesado; normalmente es más seguro usar carpetas específicas

## La penalización no se aplicó desde Kanban u otra nota

- hoy eso es el comportamiento esperado
- las penalizaciones retroactivas del día anterior se evalúan solo desde el flujo de daily note
- la sincronización Markdown/Kanban maneja completados, pero no penalties retroactivas genéricas

## La tienda no abre

- activa recompensas con monedas
- activa el add-on de tienda

## La salud no abre

- activa el add-on de salud
- activa al menos un submódulo
- completa el perfil corporal si usarás seguimiento de peso

## Los datos se ven incorrectos

- revisa tus ajustes
- inspecciona `_LifeQuest/data.json`
- exporta datos antes de resetear

## Siguiente paso

Lee:

- [Preguntas frecuentes](faq.md)
- [Privacidad y funcionamiento local-first](privacy.md)
