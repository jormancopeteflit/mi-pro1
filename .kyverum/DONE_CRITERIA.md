# DONE_CRITERIA.md — Definición de terminado
> Este archivo define qué debe cumplirse para marcar una tarea como "terminada".
> El QA y el PM lo usan para verificar antes de cerrar cualquier tarea.
> Sin esto, los agentes dicen "ya terminé" sin verificar calidad.
> Instrucción: Ponlo en `.kyverum/DONE_CRITERIA.md`.

## ¿Cómo se usa?
Cuando un agente dice "terminé la tarea", el orquestador verifica esta lista:
- Si es una feature nueva → revisa la sección "Feature"
- Si es un bugfix → revisa la sección "Bugfix"
- Si es un refactor → revisa la sección "Refactor"

Solo se marca como terminada si TODOS los criterios de la categoría se cumplen.

---

## Feature (funcionalidad nueva)

- [ ] Código implementado y compilando sin errores
- [ ] Pruebas unitarias pasando
- [ ] Revisión de código aprobada
- [ ] Documentación actualizada

## Bugfix (corrección de error)

- [ ] Bug reproducido y confirmado
- [ ] Fix implementado
- [ ] Prueba de regresión agregada
- [ ] Verificado en ambiente de staging

## Refactor (mejora interna)

- [ ] Comportamiento externo sin cambios
- [ ] Pruebas existentes pasando
- [ ] Mejora medible documentada

---

## Cómo agregar criterios

Agrega nuevos ítems como `- [ ] [Tu criterio]` en la categoría correspondiente.

---
*Generado por Project Agent Orchestrator*
