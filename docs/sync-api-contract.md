# Sync API Contract

## Base URL
`https://<host>/`

## Authentication
All endpoints (except `/auth/*`) require:
```
Authorization: Bearer <JWT>
```
JWT payload: `{ sub: userId, deviceId }`

---

## Auth

### POST /auth/register
**Body:** `{ email, password, deviceId }`  
**201:** `{ token, userId }`  
**400:** missing fields  
**409:** email already taken

### POST /auth/login
**Body:** `{ email, password, deviceId }`  
**200:** `{ token, userId }`  
**401:** invalid credentials

---

## Sync

### GET /sync/cursor
**200:** `{ cursor: ISO8601 }` — last acknowledged server timestamp for this device.

### GET /sync/pull
**Query params:**
- `cursor` (ISO8601, default `1970-01-01T00:00:00Z`)
- `limit` (integer 1–500, default 200)

**200:**
```json
{
  "items": [ServerItem],
  "nextCursor": "ISO8601",
  "hasMore": false
}
```

**ServerItem:**
```json
{
  "id": "uuid",
  "userId": "uuid",
  "title": "string",
  "body": "string | null",
  "version": 3,
  "updatedAt": "ISO8601",
  "deletedAt": "ISO8601 | null",
  "serverUpdatedAt": "ISO8601"
}
```

### POST /sync/push
**Body:**
```json
{
  "operations": [
    {
      "operationId": "uuid",
      "type": "upsert" | "delete",
      "itemId": "uuid",
      "payload": {
        "title": "string",
        "body": "string | null",
        "updatedAt": "ISO8601"
      },
      "clientVersion": 2
    }
  ]
}
```

**200:**
```json
{
  "results": [
    {
      "operationId": "uuid",
      "itemId": "uuid",
      "status": "ok" | "conflict_resolved" | "skipped",
      "resolution": "lww_server" | "lww_client" | "server_wins" | "delete_wins",
      "serverItem": ServerItem
    }
  ]
}
```

### Conflict Resolution Rules

| Scenario | Rule | Result |
|---|---|---|
| `clientVersion == serverVersion` | No conflict | Client write accepted |
| `clientUpdatedAt > serverUpdatedAt` | LWW — client newer | `lww_client` — client wins |
| `clientUpdatedAt < serverUpdatedAt` | LWW — server newer | `lww_server` — server wins |
| `clientUpdatedAt == serverUpdatedAt` | Tie-break | `server_wins` |
| `type == delete`, version mismatch | Delete-wins | `delete_wins` |

**HTTP 409 is never returned.** Conflicts are resolved deterministically in-request and reported via `status: conflict_resolved`.

---

## Push Notifications

### POST /push/token
**Body:** `{ token: string, platform: "fcm" | "apns" }`  
**204:** token stored / refreshed

### DELETE /push/token
**204:** token deactivated for this device

---

## Security
- All data queries are scoped by `userId` extracted from the JWT (never from request body).
- A user can never read or write another user's data (TC-ISO-01).
