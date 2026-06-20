# Privacidad y funcionamiento local-first

[Índice](../README.md) · [English](../en/privacy.md)

LifeQuest está diseñado para funcionar localmente dentro de tu vault.

## Qué guarda el plugin

El plugin guarda:

- datos del héroe/perfil
- quests
- XP y rachas
- revisiones semanales
- datos opcionales de tienda
- datos opcionales de salud
- ajustes

## Dónde guarda los datos

Almacenamiento principal:

- `_LifeQuest/data.json`

Exportación CSV opcional de salud:

- `_LifeQuest/health/historial.csv`

## Comportamiento de red

Por defecto, LifeQuest no necesita un servicio remoto.

La función actualmente opcional relacionada con red es:

- fuente remota de mensaje motivacional diario

Si no configuras esa función, el plugin se mantiene totalmente local en su flujo principal.

## Qué no hace

- no requiere una cuenta en la nube
- no sube el contenido del vault como parte del sistema principal
- no ejecuta código remoto

## Recomendación

Si la privacidad es importante para tu flujo, deja desactivada la fuente diaria remota salvo que realmente quieras usarla.
