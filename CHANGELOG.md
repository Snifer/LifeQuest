# Changelog

## 1.0.0

Primera release estable de LifeQuest para Obsidian.

### Añadido

- Sistema principal de quests con XP, niveles, streaks, badges y panel de progreso.
- Nota diaria con inyección de quests y sincronización de checkboxes.
- Review semanal con estadísticas e insights.
- Economía con monedas, tienda y recompensas configurables.
- Add-on de salud con peso, presión arterial y medicaciones.
- Internacionalización base para español e inglés.

### Mejorado

- Configuración reorganizada por paneles.
- Salud y tienda tratadas como add-ons opcionales.
- Recompensas centralizadas en `rewardSettings`.
- Mayor coherencia de interfaz y mensajes en `es/en`.

### Corregido

- Consistencia de fechas en la nota diaria y en la sincronización de quests.
- Cálculo de `getXPToNextLevel` en el nivel máximo.
- Reglas de weigh-in semanales para que respeten la semana actual y el día configurado.
- Tendencia de peso calculada con fechas reales y unidades consistentes.
- Validaciones de economía, salud y configuración para evitar estados incoherentes.
