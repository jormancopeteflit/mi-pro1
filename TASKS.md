# TASKS — Backlog Priorizado

> **Convención de prioridad:** P0 = bloqueante / P1 = alta / P2 = media  
> **Estado inicial de todos los tickets:** 🔴 Pendiente  
> **Lecciones incorporadas de iteraciones anteriores:**
> - DEF-PUSH-01: No entregar tickets de QA sin implementación real del módulo probado.
> - DEF-02: Cancelar timers pendientes en reconexión; el flag `_isSyncing` no es suficiente.
> - DEF-03: Implementar una regla explícita de resolución de conflictos (Server-Wins, Client-Wins, LWW o Manual Merge) antes de marcar como listo cualquier caso E2E relacionado.

---

## ÉPICA A — Checklist de Lineamientos de Tiendas

### TASK-A01 · Mapear requisitos oficiales de App Store (Apple) y Google Play
**Prioridad:** P0  
**Responsable:** PM + QA Lead  
**Descripción:**  
Recopilar y documentar los requisitos vigentes de publicación de las dos tiendas principales (App Store Connect Review Guidelines y Google Play Policy Center). El documento debe cubrir: privacidad, permisos declarados, contenido, monetización, notificaciones push y comportamiento offline/sincronización.

**Criterios de aceptación:**
- [ ] Existe un documento `docs/store-guidelines-map.md` con al menos las secciones: Privacidad & Datos, Permisos, Notificaciones Push, Comportamiento en Red y Resolución de Conflictos de Datos.
- [ ] Cada ítem del documento referencia el artículo oficial de la tienda (URL + fecha de consulta).
- [ ] El documento diferencia claramente entre requisitos Apple y Google cuando difieren.
- [ ] Revisado y firmado (comentario de aprobación en PR) por al menos un miembro del equipo legal/compliance.

**Definición de Hecho (DoD):**  
PR mergeado con aprobación de QA Lead y representante legal. Documento accesible en el repositorio.

---

### TASK-A02 · Crear checklist operativa de lineamientos de tiendas
**Prioridad:** P0  
**Depende de:** TASK-A01  
**Responsable:** QA Lead  
**Descripción:**  
Convertir el mapa de requisitos (TASK-A01) en una checklist accionable que el equipo pueda ejecutar antes de cada release. Cada ítem debe ser binario (✅ / ❌) y asignable a un rol.

**Criterios de aceptación:**
- [ ] Existe el archivo `docs/store-release-checklist.md`.
- [ ] La checklist contiene **como mínimo** los siguientes bloques:
  - [ ] **Privacidad & Permisos:** declaración de uso de datos, permisos mínimos solicitados, `PrivacyInfo.xcprivacy` (iOS) y `Data Safety` (Android) actualizados.
  - [ ] **Notificaciones Push:** token FCM/APNs registrado y verificable en dispositivo real, canales de notificación declarados (Android 8+), deep-linking probado.
  - [ ] **Sincronización & Conflictos:** política de resolución de conflictos implementada y documentada (debe nombrar explícitamente la estrategia: Server-Wins, Client-Wins, LWW o Manual Merge). Sin estrategia documentada el ítem se marca ❌ automáticamente.
  - [ ] **Comportamiento Offline:** sincronización automática al recuperar red verificada; timers cancelados correctamente en reconexión intermitente (lección DEF-02).
  - [ ] **Metadatos de Tienda:** capturas de pantalla, descripción, clasificación de edad y notas de versión actualizados.
  - [ ] **Build & Firma:** bundle ID, versión, número de build únicos; certificados y perfiles de aprovisionamiento válidos y no expirados.
- [ ] Cada ítem tiene columnas: `Ítem`, `Rol responsable`, `Evidencia requerida`, `Estado`.
- [ ] La checklist se puede importar como issue template de GitHub o equivalente en la herramienta de gestión del proyecto.

**Definición de Hecho (DoD):**  
Checklist en repositorio, validada con un dry-run sobre el build candidato actual. Al menos 90 % de ítems ejecutables (los bloqueados deben tener ticket P0 abierto).

---

### TASK-A03 · Automatizar validaciones estáticas de la checklist (linting de metadatos)
**Prioridad:** P1  
**Depende de:** TASK-A02  
**Responsable:** Desarrollador  
**Descripción:**  
Implementar scripts que validen automáticamente los ítems técnicos de la checklist (bundle ID, versión, permisos declarados en manifiestos, existencia de archivos de privacidad).

**Criterios de aceptación:**
- [ ] Script `scripts/validate-store-checklist.sh` (o equivalente Node/Python) ejecutable en CI.
- [ ] El script valida: versión semver válida, `versionCode` > build anterior, permisos en `AndroidManifest.xml` ⊆ conjunto aprobado, existencia de `PrivacyInfo.xcprivacy`.
- [ ] El script retorna exit code 0 solo si todos los ítems automatizables pasan.
- [ ] Resultado del script incluido en el reporte de release como artefacto.

**Definición de Hecho (DoD):**  
Script ejecutado en pipeline CI/CD sin errores sobre el build candidato.

---

## ÉPICA B — Suite de Pruebas E2E del Build Candidato

> ⚠️ **Restricción crítica (lección iteraciones anteriores):** Ningún ticket de esta épica puede marcarse como DONE si existe un defecto S0/S1 abierto (equivalente a DEF-PUSH-01, DEF-02, DEF-03). La suite debe ejecutarse sobre implementación real, no mocks de módulo completo.

### TASK-B01 · Auditar estado actual de la implementación antes de ejecutar E2E
**Prioridad:** P0  
**Responsable:** QA Lead + Tech Lead  
**Descripción:**  
Antes de ejecutar la suite, verificar que los defectos críticos de iteraciones anteriores están corregidos. Esta tarea es la puerta de entrada (gate) para TASK-B02.

**Criterios de aceptación:**
- [ ] **DEF-PUSH-01 cerrado:** Existe implementación real de registro de token FCM/APNs, handlers de mensajes push (`onMessage`, `setBackgroundMessageHandler`, `getInitialNotification`), deep-linking y configuración de canales. Verificable en el código fuente (referencias a `messaging()`, `getToken()`, etc.).
- [ ] **DEF-02 cerrado:** El mecanismo de reconexión cancela timers pendientes (`clearTimeout` / `clearInterval`) antes de lanzar nuevos. El flag `_isSyncing` coexiste con cancelación explícita. Verificable en `syncEngine.ts` o equivalente.
- [ ] **DEF-03 cerrado:** Existe al menos una regla de resolución de conflictos implementada en código (Server-Wins, Client-Wins, LWW o Manual Merge). HTTP 409 **no** se reintenta ciegamente; se aplica la regla antes de cualquier reintento. Verificable en `syncEngine.ts`.
- [ ] Reporte de auditoría `docs/pre-e2e-audit.md` creado con estado (CERRADO / ABIERTO) de cada defecto.
- [ ] Si algún defecto permanece ABIERTO, se crea ticket P0 bloqueante y la suite E2E **no se ejecuta** hasta su cierre.

**Definición de Hecho (DoD):**  
Reporte de auditoría aprobado por Tech Lead. Todos los defectos críticos en estado CERRADO.

---

### TASK-B02 · Definir y documentar matriz de casos E2E
**Prioridad:** P0  
**Depende de:** TASK-B01 (aprobado)  
**Responsable:** QA Lead  
**Descripción:**  
Documentar la matriz completa de casos E2E que se ejecutarán sobre el build candidato, con estado ejecutable confirmado.

**Criterios de aceptación:**
- [ ] Existe `docs/e2e-test-matrix.md` con columnas: `ID`, `Descripción`, `Precondiciones`, `Pasos`, `Resultado esperado`, `Estado (EJECUTABLE / BLOQUEADO)`, `Defecto bloqueante (si aplica)`.
- [ ] La matriz cubre **obligatoriamente** las rutas críticas:
  - [ ] CRUD de sincronización offline → online (TC-B01, TC-B02, TC-B03).
  - [ ] Resolución de conflictos HTTP 409 con la estrategia implementada (TC-C01, TC-C02).
  - [ ] Reconexión intermitente sin acumulación de timers (TC-B01/DEF-02).
  - [ ] Registro y recepción de notificaciones push en dispositivo real (TC-P-*).
  - [ ] Deep-linking desde notificación push (TC-D02).
- [ ] **100 % de los casos marcados como EJECUTABLE** tienen precondiciones satisfechas por la implementación real.
- [ ] 0 casos marcados como BLOQUEADO en el momento de ejecución (si los hay, la suite no inicia).

**Definición de Hecho (DoD):**  
Matriz aprobada por QA Lead. Ratio ejecutable = 100 %.

---

### TASK-B03 · Ejecutar suite E2E en dispositivos reales y emuladores
**Prioridad:** P0  
**Depende de:** TASK-B02 (aprobado)  
**Responsable:** QA Engineer  
**Descripción:**  
Ejecutar la suite E2E definida en TASK-B02 sobre el build candidato en al menos un dispositivo físico iOS, un dispositivo físico Android y sus emuladores/simuladores correspondientes.

**Criterios de aceptación:**
- [ ] Suite ejecutada en: iPhone físico (iOS ≥ 16), dispositivo Android físico (API ≥ 30), simulador iOS, emulador Android.
- [ ] **Tasa de paso ≥ 95 %** sobre el total de casos EJECUTABLE de la matriz.
- [ ] 0 defectos S0 (crash, pérdida de datos, bloqueo permanente) sin ticket abierto.
- [ ] 0 defectos S1 (flujo crítico roto) sin ticket abierto con fecha de corrección asignada.
- [ ] Reporte de ejecución `docs/e2e-execution-report.md` generado automáticamente o manualmente con: fecha, dispositivos, versión de build, resumen pass/fail por caso, capturas/logs de fallos.
- [ ] Los casos TC-C01 y TC-C02 validan que HTTP 409 activa la regla de resolución implementada, **no** un retry ciego (verificación explícita de DEF-03).
- [ ] Los casos TC-B01/TC-B02 validan que al recuperar red no se acumulan timers (verificación explícita de DEF-02).
- [ ] Los casos TC-P-* se ejecutan en dispositivo físico con conectividad real a FCM/APNs.

**Definición de Hecho (DoD):**  
Reporte de ejecución publicado como artefacto del pipeline o adjunto al PR de release. Aprobado por QA Lead y Tech Lead.

---

### TASK-B04 · Configurar ejecución automatizada de E2E en CI (regresión continua)
**Prioridad:** P1  
**Depende de:** TASK-B03  
**Responsable:** Desarrollador + QA Engineer  
**Descripción:**  
Integrar la suite E2E en el pipeline CI/CD para que se ejecute automáticamente en cada PR hacia `main`/`release`.

**Criterios de aceptación:**
- [ ] Pipeline ejecuta suite E2E contra emuladores en cada PR hacia ramas protegidas.
- [ ] El pipeline falla (bloquea merge) si la tasa de paso cae por debajo del 95 %.
- [ ] Artefactos (reporte + capturas de fallos) publicados automáticamente.
- [ ] Los casos de push que requieren dispositivo físico están marcados como `@skip-ci` con ejecución manual documentada en `docs/manual-test-runbook.md`.

**Definición de Hecho (DoD):**  
Al menos una ejecución exitosa del pipeline CI con la suite integrada, evidenciada por log público.

---

## ÉPICA C — Revisión de Seguridad y Privacidad

### TASK-C01 · Inventario de datos personales y flujos de datos
**Prioridad:** P0  
**Responsable:** Tech Lead + Legal/Compliance  
**Descripción:**  
Documentar qué datos personales recopila la aplicación, cómo se almacenan, transmiten y eliminan.

**Criterios de aceptación:**
- [ ] Existe `docs/data-inventory.md` con tabla: `Dato`, `Origen`, `Almacenamiento (local/remoto)`, `Cifrado en reposo`, `Cifrado en tránsito`, `Tiempo de retención`, `Base legal`.
- [ ] Tokens FCM/APNs incluidos en el inventario con su política de retención.
- [ ] Datos de sincronización offline (operaciones pendientes en cola) incluidos con nivel de sensibilidad.
- [ ] Revisado por representante legal.

**Definición de Hecho (DoD):**  
Documento mergeado con aprobación de legal. Sin datos personales fuera del inventario.

---

### TASK-C02 · Revisión de seguridad estática (SAST) del código
**Prioridad:** P0  
**Responsable:** Desarrollador Senior / Security Engineer  
**Descripción:**  
Ejecutar análisis estático de seguridad sobre el código fuente y remediar hallazgos críticos y altos.

**Criterios de aceptación:**
- [ ] Herramienta SAST ejecutada (p. ej. Semgrep, Snyk, Bandit o equivalente aprobado por el equipo).
- [ ] 0 hallazgos de severidad CRÍTICA sin remediar al momento del release.
- [ ] 0 hallazgos de severidad ALTA sin remediar o excepción documentada y aprobada.
- [ ] Hallazgos MEDIOS con ticket abierto y fecha de corrección ≤ siguiente sprint.
- [ ] Revisión específica de: almacenamiento de tokens (no en logs ni en texto plano), comunicaciones HTTP (solo HTTPS), manejo de errores que no exponga datos sensibles en respuestas de error.
- [ ] Reporte SAST `docs/sast-report.md` publicado como artefacto.

**Definición de Hecho (DoD):**  
Reporte aprobado por Security Engineer o Tech Lead. 0 hallazgos CRÍTICOS/ALTOS abiertos.

---

### TASK-C03 · Verificar cumplimiento de privacidad en plataformas (App Store & Play)
**Prioridad:** P0  
**Depende de:** TASK-C01, TASK-A02  
**Responsable:** QA Lead + Legal  
**Descripción:**  
Cruzar el inventario de datos (TASK-C01) con los requisitos de declaración de privacidad de cada tienda y verificar que la app los cumple.

**Criterios de aceptación:**
- [ ] **iOS:** `PrivacyInfo.xcprivacy` existe, lista todas las APIs de privacidad usadas con motivo aprobado, y coincide con el inventario de datos.
- [ ] **Android:** Formulario `Data Safety` en Google Play Console completo y coherente con el inventario de datos.
- [ ] Política de privacidad pública actualizada, accesible desde la app y desde la ficha de tienda.
- [ ] Ningún permiso declarado en manifiestos que no esté en el inventario de datos.
- [ ] Revisión de NSUsageDescription (iOS) para cada permiso solicitado: descripción clara y no genérica.
- [ ] Checklist TASK-A02 actualizada con resultados de esta verificación.

**Definición de Hecho (DoD):**  
Verificación documentada en `docs/privacy-compliance-check.md`, aprobada por QA Lead y legal.

---

### TASK-C04 · Pruebas de seguridad dinámicas (DAST) — superficie de red
**Prioridad:** P1  
**Depende de:** TASK-B01 (defectos críticos cerrados)  
**Responsable:** Security Engineer / QA Engineer  
**Descripción:**  
Verificar en tiempo de ejecución que la aplicación no expone datos sensibles en tráfico de red ni acepta certificados no válidos.

**Criterios de aceptación:**
- [ ] Prueba de certificate pinning (si aplica) o verificación de que la app rechaza certificados autofirmados en producción.
- [ ] Intercepción de tráfico (p. ej. con proxy MITM en dispositivo de prueba) confirma: 0 datos personales en texto plano, tokens no expuestos en headers de forma innecesaria.
- [ ] Respuestas de error de la API no incluyen stack traces ni datos de infraestructura.
- [ ] Resultados documentados en `docs/dast-report.md`.

**Definición de Hecho (DoD):**  
Reporte DAST aprobado por Security Engineer. 0 hallazgos críticos abiertos.

---

## Resumen de Prioridades y Dependencias

| ID | Épica | Prioridad | Depende de | Estado |
|----|-------|-----------|------------|--------|
| TASK-A01 | Checklist Tiendas | P0 | — | 🔴 Pendiente |
| TASK-A02 | Checklist Tiendas | P0 | A01 | 🔴 Pendiente |
| TASK-A03 | Checklist Tiendas | P1 | A02 | 🔴 Pendiente |
| TASK-B01 | E2E Suite | P0 | — | 🔴 Pendiente |
| TASK-B02 | E2E Suite | P0 | B01 | 🔴 Pendiente |
| TASK-B03 | E2E Suite | P0 | B02 | 🔴 Pendiente |
| TASK-B04 | E2E Suite | P1 | B03 | 🔴 Pendiente |
| TASK-C01 | Seguridad & Privacidad | P0 | — | 🔴 Pendiente |
| TASK-C02 | Seguridad & Privacidad | P0 | — | 🔴 Pendiente |
| TASK-C03 | Seguridad & Privacidad | P0 | C01, A02 | 🔴 Pendiente |
| TASK-C04 | Seguridad & Privacidad | P1 | B01 | 🔴 Pendiente |

---

## Reglas del Quality Gate de Release

Un build candidato **NO puede avanzar a publicación** si alguna de las siguientes condiciones se cumple:

1. Cualquier ticket P0 en estado distinto a DONE.
2. Reporte E2E con tasa de paso < 95 % o con casos marcados como BLOQUEADO.
3. Defecto DEF-PUSH-01, DEF-02 o DEF-03 en estado ABIERTO.
4. Reporte SAST con hallazgos CRÍTICOS o ALTOS sin remediar.
5. `PrivacyInfo.xcprivacy` o formulario `Data Safety` incompletos o incoherentes con el inventario.
6. Checklist de tiendas (TASK-A02) con ítems ❌ sin ticket P0 abierto.
