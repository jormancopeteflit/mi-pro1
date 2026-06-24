# Test Execution Guide

## Unit & Integration Tests (Jest)

All push notification and sync engine tests run with Jest (no device required).

```bash
# Run all tests
npx jest --testPathPattern="src/services/__tests__"

# Run with coverage
npx jest --testPathPattern="src/services/__tests__" --coverage

# Individual suites
npx jest src/services/__tests__/pushNotificationService.test.ts
npx jest src/services/__tests__/syncEngine.test.ts
npx jest src/services/__tests__/syncEngine.integration.test.ts
```

## Test Coverage Matrix

| Test Case | File | Description |
|-----------|------|-------------|
| TC-P-01 | pushNotificationService.test.ts | Token registration iOS |
| TC-P-02 | pushNotificationService.test.ts | Token registration Android |
| TC-P-03 | pushNotificationService.test.ts | Foreground message display |
| TC-P-04 | pushNotificationService.test.ts | Background handler registration |
| TC-P-05 | pushNotificationService.test.ts | Notification-open navigation |
| TC-P-06 | pushNotificationService.test.ts | Quit-state deep link |
| TC-P-07 | pushNotificationService.test.ts | Token refresh re-registration |
| TC-P-08 | pushNotificationService.test.ts | Token unregister on logout |
| TC-P-09 | pushNotificationService.test.ts | Android channels bootstrap |
| TC-P-10 | pushNotificationService.test.ts | Duplicate token suppression |
| TC-B01 | syncEngine.test.ts | Auto-sync on network reconnect |
| TC-B02 | syncEngine.test.ts | Timer accumulation/cancellation guard |
| TC-B03 | syncEngine.test.ts | Concurrent sync guard (_isSyncing) |
| TC-C01 | syncEngine.test.ts | Server-Wins conflict resolution |
| TC-C02 | syncEngine.test.ts | LWW conflict resolution |
| TC-D01 | syncEngine.test.ts | Successful operation flush |
| TC-D02 | syncEngine.test.ts | Non-retriable HTTP error discard |
| TC-D03 | syncEngine.test.ts | Max retries discard |
| INT-01 | syncEngine.integration.test.ts | Full offline→online cycle |
| INT-02 | syncEngine.integration.test.ts | Mixed success/conflict batch |

## Device Testing (iOS & Android)

### Prerequisites
- `google-services.json` (Android) in `android/app/`
- `GoogleService-Info.plist` (iOS) in `ios/<AppName>/`
- Physical device or simulator with push capability

### iOS
```bash
npx react-native run-ios --device "<Device Name>"
# Use Xcode → Capabilities → Push Notifications (enabled)
# Test with: xcrun simctl push <device-id> <bundle-id> payload.apns
```

### Android
```bash
npx react-native run-android --deviceId <device-serial>
# Test with Firebase Console → Cloud Messaging → Send test message
# Or: adb shell am broadcast -a com.google.android.c2dm.intent.RECEIVE ...
```

### APNs test payload (payload.apns)
```json
{
  "aps": {
    "alert": { "title": "Test", "body": "Push notification test" },
    "sound": "default"
  },
  "screen": "Details",
  "params": { "id": "123" }
}
```
