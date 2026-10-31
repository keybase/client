// The old lifecycle runner's aggregate (wdio.lifecycle.conf.ts). Its flows now run under the release
// gate (gate.test.ts: app-deep-links, app-push, app-lifecycle, chat-location), so it imports none;
// the runner and this file go with the other old runners.
export {}
