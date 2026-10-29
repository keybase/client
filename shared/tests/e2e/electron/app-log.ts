// The dev app's log: launch-app.mts writes it, and the fixtures, connect helpers and the release
// watchdog read their tails from the same place.
export const appLogPath = () => process.env['KB_E2E_APP_LOG'] ?? '/tmp/chat-e2e-electron.log'
