# WORKFLOW.md — Ciclo de vida del proyecto (de inicio a fin)
> Este archivo define **cómo se trabaja como un equipo real**: las fases del proyecto,
> quién lidera cada una y la **compuerta** que hay que cumplir para avanzar.
> El orquestador NO permite saltar de una fase a la siguiente sin pasar su compuerta (Definition of Done).
> Instrucción: ponlo en `.kyverum/WORKFLOW.md`.

## Principio de garantía
Cada fase tiene **criterios de entrada (DoR)** y una **compuerta de salida (DoD)**. Una fase solo se
considera completa cuando TODOS los ítems de su DoD están verificados y registrados en `STATE.md`.
Sin eso, el orquestador bloquea el avance y escala al usuario.

## Fase 1 · Descubrimiento

- **Líder:** Producto / PM
- **Objetivo:** Entender el problema, los usuarios y el objetivo de negocio antes de construir.
- **Entrada (DoR):**
  - Existe una idea o necesidad expresada por el usuario
- **Compuerta de salida (DoD) — obligatoria:**
  - [ ] Problema y usuarios objetivo definidos
  - [ ] Objetivo de negocio y métricas de éxito claras
  - [ ] Alcance inicial y fuera-de-alcance acordados
- **Entregables:** PROJECT_CONTEXT.md actualizado, Lista de supuestos y riesgos
- **Handoff a:** Requisitos

---

## Fase 2 · Requisitos

- **Líder:** Producto / PM
- **Objetivo:** Convertir la intención en requisitos verificables.
- **Entrada (DoR):**
  - Descubrimiento aprobado
- **Compuerta de salida (DoD) — obligatoria:**
  - [ ] Historias/funcionalidades con criterios de aceptación claros
  - [ ] Prioridad asignada (P0–P3)
  - [ ] Cada requisito es testeable
- **Entregables:** TASKS.md con criterios de aceptación, Alcance acordado
- **Handoff a:** Arquitectura

---

## Fase 3 · Arquitectura

- **Líder:** Arquitecto
- **Objetivo:** Definir cómo se construye: decisiones, contratos y riesgos.
- **Entrada (DoR):**
  - Requisitos con criterios de aceptación
- **Compuerta de salida (DoD) — obligatoria:**
  - [ ] Decisiones técnicas registradas (ADR) con su porqué
  - [ ] Contratos/datos/integraciones definidos
  - [ ] Riesgos técnicos identificados con mitigación
- **Entregables:** ADRs, Esquema de datos / contratos de API
- **Handoff a:** Planificación

---

## Fase 4 · Planificación

- **Líder:** PM / Delivery
- **Objetivo:** Ordenar el trabajo en un backlog ejecutable.
- **Entrada (DoR):**
  - Arquitectura aprobada
- **Compuerta de salida (DoD) — obligatoria:**
  - [ ] Backlog priorizado y estimado
  - [ ] Dependencias y secuencia claras
  - [ ] Cada tarea cumple Definition of Ready (clara, con criterios, asignada)
- **Entregables:** TASKS.md priorizado, Plan de ejecución
- **Handoff a:** Implementación

---

## Fase 5 · Implementación

- **Líder:** Ingeniería
- **Objetivo:** Construir la funcionalidad cumpliendo convenciones.
- **Entrada (DoR):**
  - Tarea lista (DoR) y sin bloqueos
- **Compuerta de salida (DoD) — obligatoria:**
  - [ ] Código implementado y compila sin errores
  - [ ] Sigue convenciones del proyecto
  - [ ] Cambios en un PR o conjunto revisable
- **Entregables:** Código, PR listo para revisión
- **Handoff a:** Pruebas / QA

---

## Fase 6 · Pruebas / QA

- **Líder:** QA
- **Objetivo:** Garantizar calidad por riesgo, no por opinión.
- **Entrada (DoR):**
  - Implementación lista en PR
- **Compuerta de salida (DoD) — obligatoria:**
  - [ ] Pruebas automatizadas para las rutas críticas
  - [ ] Todos los criterios de aceptación verificados
  - [ ] Sin defectos S0/S1 abiertos
- **Entregables:** Tests, Reporte de QA
- **Handoff a:** Revisión

---

## Fase 7 · Revisión / Seguridad

- **Líder:** Revisor / Seguridad
- **Objetivo:** Revisar código y superficie de ataque antes de liberar.
- **Entrada (DoR):**
  - QA aprobado
- **Compuerta de salida (DoD) — obligatoria:**
  - [ ] Revisión de código aprobada
  - [ ] Sin vulnerabilidades críticas conocidas
  - [ ] Secretos y permisos verificados
- **Entregables:** Aprobación de revisión, Checklist de seguridad
- **Handoff a:** Deploy

---

## Fase 8 · Deploy / CI-CD

- **Líder:** DevOps / SRE
- **Objetivo:** Liberar de forma segura y reversible.
- **Entrada (DoR):**
  - Revisión y seguridad aprobadas
- **Compuerta de salida (DoD) — obligatoria:**
  - [ ] Build/CI en verde
  - [ ] Despliegue realizado y smoke test OK
  - [ ] Plan de rollback listo
- **Entregables:** Release desplegado, Pipeline CI/CD
- **Handoff a:** Documentación

---

## Fase 9 · Documentación

- **Líder:** Docs
- **Objetivo:** Dejar el proyecto usable y mantenible.
- **Entrada (DoR):**
  - Funcionalidad desplegada
- **Compuerta de salida (DoD) — obligatoria:**
  - [ ] README/uso actualizado
  - [ ] Changelog y notas de versión
  - [ ] Runbook operativo si aplica
- **Entregables:** Documentación, Changelog
- **Handoff a:** Operación / Cierre

---

## Fase 10 · Operación / Cierre

- **Líder:** Equipo
- **Objetivo:** Operar, medir y cerrar con aprendizaje.
- **Entrada (DoR):**
  - Release documentado
- **Compuerta de salida (DoD) — obligatoria:**
  - [ ] Métricas/observabilidad en su sitio
  - [ ] Handoff de cierre registrado
  - [ ] Retro/postmortem con acciones
- **Entregables:** Métricas, Postmortem / retro
- **Handoff a:** (fin del ciclo / siguiente iteración)

---

*Generado por Project Agent Orchestrator*
