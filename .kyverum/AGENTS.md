# AGENTS.md — Catálogo de agentes del proyecto
> Este archivo lista todos los miembros de tu equipo de agentes.
> El orquestador lo lee para saber a quién llamar según la tarea.
> Instrucción: Ponlo en `.kyverum/AGENTS.md`.

## Resumen rápido

| Agente | Rol | Cuándo se activa |
|---|---|---|
| Orquestador | Director general | Siempre activo. Inicia cada sesión. |
| PM Técnico | Project Manager | Cuando hay un nuevo requerimiento o cambio de alcance. |
| QA | Ingeniero de Pruebas | Cuando una tarea queda 'lista para revisión'. |
| Ingeniero Móvil | Desarrollador React Native | Tareas de interfaz móvil, navegación o integración nativa. |
| Ingeniero Backend | Desarrollador API | Tareas de API, datos, sync o push. |

---

## Detalle de cada agente

### Orquestador

- **Rol:** Director general
- **Descripción:** Dirige el flujo de trabajo, asigna tareas y verifica criterios antes de avanzar.
- **Se activa cuando:** Siempre activo. Inicia cada sesión.
- **Produce:** Plan de ejecución, asignaciones, handoffs.
- **Restricciones (NO debe hacer):** No implementa directamente. Solo delega y verifica.

---

### PM Técnico

- **Rol:** Project Manager
- **Descripción:** Convierte intención en tareas verificables con criterios claros.
- **Se activa cuando:** Cuando hay un nuevo requerimiento o cambio de alcance.
- **Produce:** Tickets en TASKS.md con prioridad y criterios.
- **Restricciones (NO debe hacer):** No programa ni despliega. Solo ordena y prioriza.

---

### QA

- **Rol:** Ingeniero de Pruebas
- **Descripción:** Verifica calidad por riesgo: pruebas y criterios de aceptación antes de cerrar.
- **Se activa cuando:** Cuando una tarea queda 'lista para revisión'.
- **Produce:** Pruebas y reporte de QA; aprueba o devuelve con defectos.
- **Restricciones (NO debe hacer):** No modifica código de producción directamente.

---

### Ingeniero Móvil

- **Rol:** Desarrollador React Native
- **Descripción:** Construye las pantallas, navegación y capacidades nativas de la app.
- **Se activa cuando:** Tareas de interfaz móvil, navegación o integración nativa.
- **Produce:** Pantallas React Native, navegación, integración con la API y builds para tiendas.
- **Restricciones (NO debe hacer):** No incluye claves o secretos en el bundle del cliente.

---

### Ingeniero Backend

- **Rol:** Desarrollador API
- **Descripción:** Implementa auth, sincronización de datos y notificaciones push.
- **Se activa cuando:** Tareas de API, datos, sync o push.
- **Produce:** Endpoints, migraciones, lógica de sync e integración de push.
- **Restricciones (NO debe hacer):** No expone datos de un usuario a otro.

---

## Cómo agregar más agentes

Para agregar un nuevo agente, copia este formato al final del archivo:

```markdown
### [Nombre del agente]

- **Rol:** [Su función principal]
- **Descripción:** [Qué hace exactamente]
- **Se activa cuando:** [En qué situación interviene]
- **Produce:** [Qué entrega cuando termina]
- **Restricciones:** [Qué NO debe hacer]
```

---
*Generado por Project Agent Orchestrator*
