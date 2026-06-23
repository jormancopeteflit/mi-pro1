# HANDOFF.md — Registro de traspasos entre herramientas
> Un "handoff" es un pase de estafeta. Se crea CADA VEZ que cambias de herramienta
> (ej: de Cursor a Claude, de Claude a Antigravity, etc.).
> Sin esto, cada vez que cambias de herramienta pierdes todo el contexto.
> Instrucción: Ponlo en `.kyverum/HANDOFF.md` y actualízalo cada vez que cambies de herramienta.

## ¿Cómo crear un handoff?

Cuando termines de trabajar en una herramienta y vayas a cambiar a otra, agrega una entrada con este formato:

```markdown
## Handoff [fecha y hora]

**De:** [Herramienta donde trabajaste] → **A:** [Herramienta donde vas a continuar]

**Qué hice:**
- [Lista de lo que completaste]

**Archivos modificados:**
- [Lista de archivos que tocaste]

**Qué debe hacer el siguiente:**
- [Lista de lo que falta por hacer]

**Estado actual:**
- [Qué funciona y qué no]
```

---

## Registro de handoffs

_No hay handoffs registrados aún. Se crearán cuando cambies de herramienta durante el trabajo._

### Ejemplo:

## Handoff 2026-06-08 14:30

**De:** Cursor → **A:** Claude

**Qué hice:**
- Implementé la página de login
- Conecté con la API de autenticación

**Archivos modificados:**
- src/pages/Login.tsx
- src/lib/auth.ts

**Qué debe hacer el siguiente:**
- Revisar la lógica de tokens
- Agregar manejo de errores

**Estado actual:**
- Login funciona con credenciales correctas
- Falta manejar errores de red

