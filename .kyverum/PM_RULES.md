# PM_RULES.md — Reglas de gobierno operativo
> Estas son las "leyes" del proyecto. Todos los agentes DEBEN respetarlas.
> Si un agente intenta saltarse una regla, el orquestador lo bloquea.
> Instrucción: Ponlo en `.kyverum/PM_RULES.md`.

## Configuración operativa

| Regla | Valor | Significado |
|---|---|---|
| Tareas concurrentes máximas | 3 | No pueden haber más de 3 tareas "en progreso" al mismo tiempo |
| Requiere QA antes de deploy | Sí | Nada se publica sin que QA lo revise primero |
| Requiere handoff al cambiar de herramienta | Sí | Obligatorio registrar qué se hizo antes de cambiar de Cursor a Claude (o viceversa) |

## Reglas personalizadas

Estas reglas son de cumplimiento obligatorio para todos los agentes:

1. **Ningún agente puede modificar archivos fuera de su alcance sin aprobación.**
2. **Toda tarea P0 debe tener un responsable asignado antes de iniciar.**

## Cómo modificar estas reglas

Edita este archivo directamente. Agrega nuevas reglas como ítems numerados en la sección "Reglas personalizadas".

---
*Generado por Project Agent Orchestrator*
