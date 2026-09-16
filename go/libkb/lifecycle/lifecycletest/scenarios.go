// Copyright 2026 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package lifecycletest

import "github.com/keybase/client/go/protocol/keybase1"

const (
	fg  = keybase1.MobileAppState_FOREGROUND
	bg  = keybase1.MobileAppState_BACKGROUND
	bga = keybase1.MobileAppState_BACKGROUNDACTIVE
	ina = keybase1.MobileAppState_INACTIVE
)

func step(do Action, want keybase1.MobileAppState, gen int) Step {
	return Step{Do: do, Want: want, Gen: gen}
}

func (s Step) flush() Step {
	s.Flush = true
	return s
}

func (s Step) warn() Step {
	s.Warn = true
	return s
}

func (s Step) returns(b bool) Step {
	if b {
		s.Returns = ReturnTrue
	} else {
		s.Returns = ReturnFalse
	}
	return s
}

func (s Step) slot(n int) Step {
	s.Slot = n
	return s
}

func steps(parts ...[]Step) []Step {
	var all []Step
	for _, p := range parts {
		all = append(all, p...)
	}
	return all
}

func states(s ...keybase1.MobileAppState) []keybase1.MobileAppState { return s }

// iosLaunch brings a freshly started iOS service (BACKGROUND) to the
// foreground: the scene connects and becomes active.
var iosLaunch = []Step{
	step(WillEnterForeground, bga, 1),
	step(DidBecomeActive, fg, 1),
}

// iosToBackgroundTask backgrounds a foreground app with a message still
// sending, and starts the background task.
var iosToBackgroundTask = []Step{
	step(WorkStarts, fg, 0),
	step(WillResignActive, ina, 1),
	step(DidEnterBackground, bga, 1).flush().returns(true),
	step(BackgroundTaskStart, bga, 0).returns(true),
}

var androidLaunch = []Step{
	step(DidBecomeActive, fg, 1),
}

// Scenarios replays whole native event sequences. Consumers of the app state
// can play them with their own checks (see Play).
var Scenarios = []Scenario{
	{
		Name:     "ios cold foreground launch",
		Platform: IOS,
		Steps:    iosLaunch,
		Observed: states(bg, bga, fg),
	},
	{
		Name:     "ios background launch by silent push stays in the background, then foreground",
		Platform: IOS,
		Steps: steps([]Step{
			step(Nothing, bg, 0),
			step(BackgroundTaskExpired, bg, 0),
		}, iosLaunch),
		Observed: states(bg, bga, fg),
	},
	{
		Name:     "ios background launch by BGAppRefresh, then foreground",
		Platform: IOS,
		Steps: steps([]Step{
			step(BackgroundSyncStart, bga, 1).returns(true),
			step(BackgroundSyncTimerFires, bg, 1).flush(),
		}, iosLaunch),
		Observed: states(bg, bga, bg, bga, fg),
	},
	{
		Name:     "ios home and return",
		Platform: IOS,
		Steps: steps(iosLaunch, []Step{
			step(WillResignActive, ina, 1),
			step(DidEnterBackground, bg, 1).flush().returns(false),
			step(WillEnterForeground, bga, 1),
			step(DidBecomeActive, fg, 1),
		}),
		Observed: states(bg, bga, fg, ina, bg, bga, fg),
	},
	{
		Name:     "ios quick background and foreground cycles with duplicate events",
		Platform: IOS,
		Steps: steps(iosLaunch, []Step{
			step(WillResignActive, ina, 1),
			step(WillResignActive, ina, 1),
			step(DidEnterBackground, bg, 1).flush().returns(false),
			step(DidEnterBackground, bg, 1).returns(false),
			step(WillEnterForeground, bga, 1),
			step(WillEnterForeground, bga, 1),
			step(DidBecomeActive, fg, 1),
			step(DidBecomeActive, fg, 1),
			// Backgrounding abandoned before didEnterBackground.
			step(WillResignActive, ina, 1),
			step(DidBecomeActive, fg, 1),
			step(WillResignActive, ina, 1),
			step(DidEnterBackground, bg, 1).flush().returns(false),
			step(WillEnterForeground, bga, 1),
			step(DidBecomeActive, fg, 1),
		}),
		Observed: states(bg, bga, fg, ina, bg, bga, fg, ina, fg, ina, bg, bga, fg),
	},
	{
		Name:     "ios control center or system alert keeps things up",
		Platform: IOS,
		Steps: steps(iosLaunch, []Step{
			step(WillResignActive, ina, 1),
			step(DidBecomeActive, fg, 1),
			step(WillResignActive, ina, 1),
			step(DidBecomeActive, fg, 1),
		}),
		Observed: states(bg, bga, fg, ina, fg, ina, fg),
	},
	{
		Name:     "ipad focus loss keeps things up",
		Platform: IOS,
		Steps: steps(iosLaunch, []Step{
			step(WillResignActive, ina, 1),
			step(WillResignActive, ina, 1),
			step(DidBecomeActive, fg, 1),
			step(WillResignActive, ina, 1),
			step(DidBecomeActive, fg, 1),
			step(DidBecomeActive, fg, 1),
		}),
		Observed: states(bg, bga, fg, ina, fg, ina, fg),
	},
	{
		Name:     "ios lock and unlock",
		Platform: IOS,
		Steps: steps(iosLaunch, []Step{
			step(WillResignActive, ina, 1),
			step(DidEnterBackground, bg, 1).flush().returns(false),
			step(WillEnterForeground, bga, 1),
			step(DidBecomeActive, fg, 1),
		}),
		Observed: states(bg, bga, fg, ina, bg, bga, fg),
	},
	{
		Name:     "ios BackgroundSync window racing willEnterForeground and didBecomeActive",
		Platform: IOS,
		Steps: []Step{
			step(BackgroundSyncStart, bga, 1).returns(true),
			step(WillEnterForeground, bga, 1),
			step(DidBecomeActive, fg, 1),
			step(BackgroundSyncWait, fg, 0),
		},
		Observed: states(bg, bga, fg),
	},
	{
		Name:     "ios slow didBecomeActive after the BackgroundSync window ends",
		Platform: IOS,
		Steps: []Step{
			step(BackgroundSyncStart, bga, 1).returns(true),
			step(WillEnterForeground, bga, 1),
			step(BackgroundSyncTimerFires, bga, 0),
			step(DidBecomeActive, fg, 1),
		},
		Observed: states(bg, bga, fg),
	},
	{
		Name:     "ios BackgroundSync skips outside the background",
		Platform: IOS,
		Steps: steps(iosLaunch, []Step{
			step(BackgroundSyncStart, fg, 0).returns(false),
			step(WillResignActive, ina, 1),
			step(BackgroundSyncStart, ina, 0).returns(false),
		}),
		Observed: states(bg, bga, fg, ina),
	},
	{
		Name:     "ios background task completes",
		Platform: IOS,
		Steps: steps(iosLaunch, iosToBackgroundTask, []Step{
			step(BackgroundTaskDelivered, bg, 1).flush(),
			step(BackgroundTaskExpired, bg, 0),
		}, iosLaunch),
		Observed: states(bg, bga, fg, ina, bga, bg, bga, fg),
	},
	{
		Name:     "ios background task fails",
		Platform: IOS,
		Steps: steps(iosLaunch, iosToBackgroundTask, []Step{
			step(BackgroundTaskFails, bg, 1).flush().warn(),
		}),
		Observed: states(bg, bga, fg, ina, bga, bg),
	},
	{
		Name:     "ios background task runs out of time",
		Platform: IOS,
		Steps: steps(iosLaunch, iosToBackgroundTask, []Step{
			step(BackgroundTaskTimesUp, bg, 1).flush().warn(),
		}),
		Observed: states(bg, bga, fg, ina, bga, bg),
	},
	{
		Name:     "ios background task expires",
		Platform: IOS,
		Steps: steps(iosLaunch, iosToBackgroundTask, []Step{
			step(BackgroundTaskExpired, bg, 1).flush().warn(),
			step(BackgroundTaskWait, bg, 0),
			step(BackgroundTaskExpired, bg, 0),
		}),
		Observed: states(bg, bga, fg, ina, bga, bg),
	},
	{
		Name:     "ios background task expires after return to foreground",
		Platform: IOS,
		Steps: steps(iosLaunch, iosToBackgroundTask, []Step{
			step(WillEnterForeground, bga, 1),
			step(DidBecomeActive, fg, 1),
			step(BackgroundTaskWait, fg, 0),
			step(BackgroundTaskExpired, fg, 0),
		}),
		Observed: states(bg, bga, fg, ina, bga, fg),
	},
	{
		Name:     "ios background task expires between willEnterForeground and didBecomeActive",
		Platform: IOS,
		Steps: steps(iosLaunch, iosToBackgroundTask, []Step{
			step(WillEnterForeground, bga, 1),
			step(BackgroundTaskExpired, bga, 0),
			// The same-value update doesn't wake the task; it finishes
			// later and leaves the state alone.
			step(BackgroundTaskDelivered, bga, 0),
			step(DidBecomeActive, fg, 1),
		}),
		Observed: states(bg, bga, fg, ina, bga, fg),
	},
	{
		Name:     "ios background task finishes after willEnterForeground",
		Platform: IOS,
		Steps: steps(iosLaunch, iosToBackgroundTask, []Step{
			step(WillEnterForeground, bga, 1),
			// The same-value update doesn't wake the task; when it finishes,
			// the window is no longer current, so it leaves the state alone.
			step(BackgroundTaskDelivered, bga, 0),
			step(DidBecomeActive, fg, 1),
		}),
		Observed: states(bg, bga, fg, ina, bga, fg),
	},
	{
		Name:     "ios background task superseded before it starts",
		Platform: IOS,
		Steps: steps(iosLaunch, []Step{
			step(WorkStarts, fg, 0),
			step(WillResignActive, ina, 1),
			step(DidEnterBackground, bga, 1).flush().returns(true),
			step(WillEnterForeground, bga, 1),
			// Returning false means it exited without polling deliveries.
			step(BackgroundTaskStart, bga, 0).returns(false),
			step(DidBecomeActive, fg, 1),
		}),
		Observed: states(bg, bga, fg, ina, bga, fg),
	},
	{
		Name:     "ios live location across background",
		Platform: IOS,
		Steps: steps(iosLaunch, iosToBackgroundTask, []Step{
			step(BackgroundTaskDelivered, bg, 1).flush(),
			// A location update wakes the app while tracking.
			step(LiveLocationClaim, bga, 1),
			step(LiveLocationClaim, bga, 0),
			// Tracking ends.
			step(LiveLocationRelease, bg, 1).flush(),
			step(LiveLocationRelease, bg, 0),
			step(LiveLocationClaim, bga, 1),
			step(WillEnterForeground, bga, 1),
			step(DidBecomeActive, fg, 1),
			step(LiveLocationRelease, fg, 0),
			// Claims only from BACKGROUND.
			step(LiveLocationClaim, fg, 0),
		}),
		Observed: states(bg, bga, fg, ina, bga, bg, bga, bg, bga, fg),
	},
	{
		Name:     "ios termination from the background",
		Platform: IOS,
		Steps: steps(iosLaunch, []Step{
			step(WillResignActive, ina, 1),
			step(DidEnterBackground, bg, 1).flush().returns(false),
			step(WillTerminate, bg, 1).warn(),
		}),
		Observed: states(bg, bga, fg, ina, bg),
	},
	{
		Name:     "ios termination from the foreground",
		Platform: IOS,
		Steps: steps(iosLaunch, []Step{
			step(WillTerminate, bg, 1).flush().warn(),
		}),
		Observed: states(bg, bga, fg, bg),
	},
	{
		Name:     "ios termination during a background task",
		Platform: IOS,
		Steps: steps(iosLaunch, iosToBackgroundTask, []Step{
			step(WillTerminate, bg, 1).flush().warn(),
			step(BackgroundTaskWait, bg, 0),
			step(BackgroundTaskExpired, bg, 0),
		}),
		Observed: states(bg, bga, fg, ina, bga, bg),
	},
	{
		Name:     "android cold launch",
		Platform: Android,
		Steps:    androidLaunch,
		Observed: states(bga, fg),
	},
	{
		Name:     "android process stop and start",
		Platform: Android,
		Steps: steps(androidLaunch, []Step{
			step(DidEnterBackground, bg, 1).flush().returns(false),
			step(DidBecomeActive, fg, 1),
			step(WorkStarts, fg, 0),
			step(DidEnterBackground, bga, 1).flush().returns(true),
			step(BackgroundTaskStart, bga, 0).returns(true),
			step(DidBecomeActive, fg, 1),
			step(BackgroundTaskWait, fg, 0),
		}),
		Observed: states(bga, fg, bg, fg, bga, fg),
	},
	{
		Name:     "android dialog or picker pause keeps the foreground",
		Platform: Android,
		Steps: steps(androidLaunch, []Step{
			step(Nothing, fg, 0),
			step(PushWindowBegin, fg, 0).returns(false),
			step(PushWindowEnd, fg, 0).returns(false),
			step(Nothing, fg, 0),
		}),
		Observed: states(bga, fg),
	},
	{
		Name:     "android background task without a window",
		Platform: Android,
		Steps: []Step{
			step(WorkStarts, bga, 0),
			// Cold start is BACKGROUNDACTIVE, but no window was opened.
			step(BackgroundTaskStart, bga, 0).returns(false),
		},
		Observed: states(bga),
	},
	{
		Name:     "android push window in the background",
		Platform: Android,
		Steps: steps(androidLaunch, []Step{
			step(DidEnterBackground, bg, 1).flush().returns(false),
			step(PushWindowBegin, bga, 1).returns(true),
			step(PushWindowEnd, bg, 1).flush().returns(false),
		}),
		Observed: states(bga, fg, bg, bga, bg),
	},
	{
		Name:     "android push at cold start",
		Platform: Android,
		Steps: []Step{
			step(PushWindowBegin, bga, 1).returns(true),
			step(PushWindowEnd, bg, 1).flush().returns(false),
		},
		Observed: states(bga, bg),
	},
	{
		Name:     "android push window racing process start",
		Platform: Android,
		Steps: steps(androidLaunch, []Step{
			step(DidEnterBackground, bg, 1).flush().returns(false),
			step(PushWindowBegin, bga, 1).returns(true),
			step(DidBecomeActive, fg, 1),
			step(PushWindowEnd, fg, 0).returns(false),
			// Foreground and back to the background while the push is
			// handled: the value matches, but the window isn't the push's.
			step(PushWindowBegin, fg, 0).returns(false),
			step(DidEnterBackground, bg, 1).flush().returns(false),
			step(PushWindowBegin, bga, 1).returns(true),
			step(DidBecomeActive, fg, 1),
			step(DidEnterBackground, bg, 1).flush().returns(false),
			step(PushWindowEnd, bg, 0).returns(false),
		}),
		Observed: states(bga, fg, bg, bga, fg, bg, bga, fg, bg),
	},
	{
		Name:     "android push window hands over to a background task",
		Platform: Android,
		Steps: steps(androidLaunch, []Step{
			step(DidEnterBackground, bg, 1).flush().returns(false),
			step(PushWindowBegin, bga, 1).returns(true),
			step(WorkStarts, bga, 0),
			step(PushWindowEnd, bga, 1).returns(true),
			step(BackgroundTaskStart, bga, 0).returns(true),
			step(BackgroundTaskDelivered, bg, 1).flush(),
		}),
		Observed: states(bga, fg, bg, bga, bg),
	},
	{
		Name:     "android overlapping push windows",
		Platform: Android,
		Steps: steps(androidLaunch, []Step{
			step(DidEnterBackground, bg, 1).flush().returns(false),
			step(PushWindowBegin, bga, 1).slot(0).returns(true),
			step(PushWindowBegin, bga, 1).slot(1).returns(true),
			step(PushWindowEnd, bga, 0).slot(0).returns(false),
			step(PushWindowEnd, bg, 1).slot(1).flush().returns(false),
		}),
		Observed: states(bga, fg, bg, bga, bg),
	},
	{
		// Current behavior, pinned until Task 9 revisits it: Android starts in
		// BACKGROUNDACTIVE, so a WorkManager cold start skips the sync and
		// nothing moves the state to BACKGROUND.
		Name:     "android WorkManager BackgroundSync at cold start skips (current behavior)",
		Platform: Android,
		Steps: []Step{
			step(BackgroundSyncStart, bga, 0).returns(false),
		},
		Observed: states(bga),
	},
	{
		Name:     "android WorkManager BackgroundSync racing a push window",
		Platform: Android,
		Steps: steps(androidLaunch, []Step{
			step(DidEnterBackground, bg, 1).flush().returns(false),
			step(BackgroundSyncStart, bga, 1).returns(true),
			step(PushWindowBegin, bga, 1).returns(true),
			step(PushWindowEnd, bg, 1).flush().returns(false),
			step(BackgroundSyncWait, bg, 0),
		}),
		Observed: states(bga, fg, bg, bga, bg),
	},
	{
		Name:     "android termination",
		Platform: Android,
		Steps: steps(androidLaunch, []Step{
			step(WillTerminate, bg, 1).flush().warn(),
		}),
		Observed: states(bga, fg, bg),
	},
}
