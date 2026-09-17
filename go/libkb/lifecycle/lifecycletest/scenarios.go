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

func step(do Action, want keybase1.MobileAppState) Step { return Step{Do: do, Want: want} }

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
	step(WillEnterForeground, ina),
	step(DidBecomeActive, fg),
}

// iosToBackgroundTask backgrounds a foreground app with a message still
// sending, and starts the background task.
var iosToBackgroundTask = []Step{
	step(WorkStarts, fg),
	step(WillResignActive, ina),
	step(DidEnterBackground, bga).flush().returns(true),
	step(BackgroundTaskStart, bga).returns(true),
}

// androidStart is the process lifecycle's start and resume.
var androidStart = []Step{
	step(WillEnterForeground, ina),
	step(DidBecomeActive, fg),
}

// androidLaunch starts the UI in a fresh process (BACKGROUNDACTIVE until the first report).
var androidLaunch = androidStart

// Scenarios replays whole native event sequences. Consumers of the app state
// can play them with their own checks (see Play).
var Scenarios = []Scenario{
	{Name: "ios cold foreground launch", Platform: IOS, Steps: iosLaunch, Observed: states(bg, ina, fg)},
	{
		Name:     "ios background launch by silent push stays in the background, then foreground",
		Platform: IOS,
		Steps:    steps([]Step{step(Nothing, bg), step(BackgroundTaskExpired, bg)}, iosLaunch),
		Observed: states(bg, ina, fg),
	},
	{
		Name:     "ios background launch by BGAppRefresh, then foreground",
		Platform: IOS,
		Steps: steps([]Step{
			step(BackgroundSyncStart, bga).returns(true),
			step(BackgroundSyncTimerFires, bg).flush(),
		}, iosLaunch),
		Observed: states(bg, bga, bg, ina, fg),
	},
	{
		Name:     "ios home and return",
		Platform: IOS,
		Steps: steps(iosLaunch, []Step{
			step(WillResignActive, ina),
			step(DidEnterBackground, bg).flush().returns(false),
			step(WillEnterForeground, ina),
			step(DidBecomeActive, fg),
		}),
		Observed: states(bg, ina, fg, ina, bg, ina, fg),
	},
	{
		Name:     "ios quick background and foreground cycles with duplicate events",
		Platform: IOS,
		Steps: steps(iosLaunch, []Step{
			step(WillResignActive, ina),
			step(WillResignActive, ina),
			step(DidEnterBackground, bg).flush().returns(false),
			step(DidEnterBackground, bg).returns(false),
			step(WillEnterForeground, ina),
			step(WillEnterForeground, ina),
			step(DidBecomeActive, fg),
			step(DidBecomeActive, fg),
			// Backgrounding abandoned before didEnterBackground.
			step(WillResignActive, ina),
			step(DidBecomeActive, fg),
			step(WillResignActive, ina),
			step(DidEnterBackground, bg).flush().returns(false),
			step(WillEnterForeground, ina),
			step(DidBecomeActive, fg),
		}),
		Observed: states(bg, ina, fg, ina, bg, ina, fg, ina, fg, ina, bg, ina, fg),
	},
	{
		Name:     "ios control center or system alert keeps things up",
		Platform: IOS,
		Steps: steps(iosLaunch, []Step{
			step(WillResignActive, ina), step(DidBecomeActive, fg),
			step(WillResignActive, ina), step(DidBecomeActive, fg),
		}),
		Observed: states(bg, ina, fg, ina, fg, ina, fg),
	},
	{
		Name:     "ipad focus loss keeps things up",
		Platform: IOS,
		Steps: steps(iosLaunch, []Step{
			step(WillResignActive, ina), step(WillResignActive, ina), step(DidBecomeActive, fg),
			step(WillResignActive, ina), step(DidBecomeActive, fg), step(DidBecomeActive, fg),
		}),
		Observed: states(bg, ina, fg, ina, fg, ina, fg),
	},
	{
		Name:     "ios lock and unlock",
		Platform: IOS,
		Steps: steps(iosLaunch, []Step{
			step(WillResignActive, ina),
			step(DidEnterBackground, bg).flush().returns(false),
			step(WillEnterForeground, ina),
			step(DidBecomeActive, fg),
		}),
		Observed: states(bg, ina, fg, ina, bg, ina, fg),
	},
	{
		// Leaving the background ends the sync's hold, so the sync returns at once.
		Name:     "ios BackgroundSync window racing willEnterForeground and didBecomeActive",
		Platform: IOS,
		Steps: []Step{
			step(BackgroundSyncStart, bga).returns(true),
			step(WillEnterForeground, ina),
			step(DidBecomeActive, fg),
			step(BackgroundSyncWait, fg),
		},
		Observed: states(bg, bga, ina, fg),
	},
	{
		Name:     "ios slow didBecomeActive after the BackgroundSync window ends",
		Platform: IOS,
		Steps: []Step{
			step(BackgroundSyncStart, bga).returns(true),
			step(WillEnterForeground, ina),
			step(BackgroundSyncTimerFires, ina),
			step(DidBecomeActive, fg),
		},
		Observed: states(bg, bga, ina, fg),
	},
	{
		Name:     "ios BackgroundSync skips outside the background",
		Platform: IOS,
		Steps: steps(iosLaunch, []Step{
			step(BackgroundSyncStart, fg).returns(false),
			step(WillResignActive, ina),
			step(BackgroundSyncStart, ina).returns(false),
		}),
		Observed: states(bg, ina, fg, ina),
	},
	{
		Name:     "ios background task completes",
		Platform: IOS,
		Steps: steps(iosLaunch, iosToBackgroundTask, []Step{
			step(BackgroundTaskDelivered, bg).flush(),
			step(BackgroundTaskExpired, bg),
		}, iosLaunch),
		Observed: states(bg, ina, fg, ina, bga, bg, ina, fg),
	},
	{
		Name:     "ios background task fails",
		Platform: IOS,
		Steps:    steps(iosLaunch, iosToBackgroundTask, []Step{step(BackgroundTaskFails, bg).flush().warn()}),
		Observed: states(bg, ina, fg, ina, bga, bg),
	},
	{
		Name:     "ios background task runs out of time",
		Platform: IOS,
		Steps:    steps(iosLaunch, iosToBackgroundTask, []Step{step(BackgroundTaskTimesUp, bg).flush().warn()}),
		Observed: states(bg, ina, fg, ina, bga, bg),
	},
	{
		Name:     "ios background task expires",
		Platform: IOS,
		Steps: steps(iosLaunch, iosToBackgroundTask, []Step{
			step(BackgroundTaskExpired, bg).flush().warn(),
			step(BackgroundTaskWait, bg),
			step(BackgroundTaskExpired, bg),
		}),
		Observed: states(bg, ina, fg, ina, bga, bg),
	},
	{
		Name:     "ios background task expires after return to foreground",
		Platform: IOS,
		Steps: steps(iosLaunch, iosToBackgroundTask, []Step{
			step(WillEnterForeground, ina),
			step(DidBecomeActive, fg),
			step(BackgroundTaskWait, fg),
			step(BackgroundTaskExpired, fg),
		}),
		Observed: states(bg, ina, fg, ina, bga, ina, fg),
	},
	{
		Name:     "ios background task expires between willEnterForeground and didBecomeActive",
		Platform: IOS,
		Steps: steps(iosLaunch, iosToBackgroundTask, []Step{
			step(WillEnterForeground, ina),
			step(BackgroundTaskExpired, ina),
			step(BackgroundTaskDelivered, ina),
			step(DidBecomeActive, fg),
		}),
		Observed: states(bg, ina, fg, ina, bga, ina, fg),
	},
	{
		// Leaving the background ended the task's hold; finishing later changes nothing.
		Name:     "ios background task finishes after willEnterForeground",
		Platform: IOS,
		Steps: steps(iosLaunch, iosToBackgroundTask, []Step{
			step(WillEnterForeground, ina),
			step(BackgroundTaskDelivered, ina),
			step(DidBecomeActive, fg),
		}),
		Observed: states(bg, ina, fg, ina, bga, ina, fg),
	},
	{
		Name:     "ios background task superseded before it starts",
		Platform: IOS,
		Steps: steps(iosLaunch, []Step{
			step(WorkStarts, fg),
			step(WillResignActive, ina),
			step(DidEnterBackground, bga).flush().returns(true),
			step(WillEnterForeground, ina),
			// Returning false means it exited without polling deliveries.
			step(BackgroundTaskStart, ina).returns(false),
			step(DidBecomeActive, fg),
		}),
		Observed: states(bg, ina, fg, ina, bga, ina, fg),
	},
	{
		Name:     "ios live location across background",
		Platform: IOS,
		Steps: steps(iosLaunch, iosToBackgroundTask, []Step{
			step(BackgroundTaskDelivered, bg).flush(),
			// A location update wakes the app while tracking.
			step(LiveLocationClaim, bga),
			step(LiveLocationClaim, bga),
			// Tracking ends.
			step(LiveLocationRelease, bg).flush(),
			step(LiveLocationRelease, bg),
			step(LiveLocationClaim, bga),
			step(WillEnterForeground, ina),
			step(DidBecomeActive, fg),
			step(LiveLocationRelease, fg),
			// A claim in the foreground keeps the app running once it backgrounds.
			step(LiveLocationClaim, fg),
			step(WorkStops, fg),
			step(WillResignActive, ina),
			step(DidEnterBackground, bga).flush().returns(false),
			step(LiveLocationRelease, bg).flush(),
		}),
		Observed: states(bg, ina, fg, ina, bga, bg, bga, bg, bga, ina, fg, ina, bga, bg),
	},
	{
		Name:     "ios background task expiration keeps live location running",
		Platform: IOS,
		Steps: steps(iosLaunch, []Step{step(LiveLocationClaim, fg)}, iosToBackgroundTask, []Step{
			step(BackgroundTaskExpired, bga).warn(),
			step(BackgroundTaskWait, bga),
			step(LiveLocationRelease, bg).flush(),
		}),
		Observed: states(bg, ina, fg, ina, bga, bg),
	},
	{
		Name:     "ios termination from the background",
		Platform: IOS,
		Steps: steps(iosLaunch, []Step{
			step(WillResignActive, ina),
			step(DidEnterBackground, bg).flush().returns(false),
			step(WillTerminate, bg).warn(),
		}),
		Observed: states(bg, ina, fg, ina, bg),
	},
	{
		Name:     "ios termination from the foreground",
		Platform: IOS,
		Steps:    steps(iosLaunch, []Step{step(WillTerminate, bg).flush().warn()}),
		Observed: states(bg, ina, fg, bg),
	},
	{
		Name:     "ios termination during a background task",
		Platform: IOS,
		Steps: steps(iosLaunch, iosToBackgroundTask, []Step{
			step(WillTerminate, bg).flush().warn(),
			step(BackgroundTaskWait, bg),
			step(BackgroundTaskExpired, bg),
		}),
		Observed: states(bg, ina, fg, ina, bga, bg),
	},
	{
		Name:     "ios termination ends live location's hold",
		Platform: IOS,
		Steps: steps(iosLaunch, []Step{
			step(LiveLocationClaim, fg),
			step(WillResignActive, ina),
			step(DidEnterBackground, bga).flush().returns(false),
			step(WillTerminate, bg).flush().warn(),
			step(LiveLocationRelease, bg),
		}),
		Observed: states(bg, ina, fg, ina, bga, bg),
	},
	{Name: "android cold launch", Platform: Android, Steps: androidLaunch, Observed: states(bga, ina, fg)},
	{
		Name:     "android process stop and start",
		Platform: Android,
		Steps: steps(androidLaunch, []Step{
			step(DidEnterBackground, bg).flush().returns(false),
		}, androidStart, []Step{
			step(WorkStarts, fg),
			step(DidEnterBackground, bga).flush().returns(true),
			step(BackgroundTaskStart, bga).returns(true),
			step(WillEnterForeground, ina),
			step(DidBecomeActive, fg),
			step(BackgroundTaskWait, fg),
		}),
		Observed: states(bga, ina, fg, bg, ina, fg, bga, ina, fg),
	},
	{
		Name:     "android dialog, permission prompt or picker pause keeps the foreground",
		Platform: Android,
		Steps: steps(androidLaunch, []Step{
			step(Nothing, fg),
			step(PushWindowBegin, fg).returns(false),
			step(PushWindowEnd, fg).returns(false),
			// Back from the prompt: the process resumes without a start.
			step(DidBecomeActive, fg),
		}),
		Observed: states(bga, ina, fg),
	},
	{
		Name:     "android background task without a window",
		Platform: Android,
		Steps: []Step{
			step(WorkStarts, bga),
			// Cold start holds the app up, but no background task hold was opened.
			step(BackgroundTaskStart, bga).returns(false),
		},
		Observed: states(bga),
	},
	{
		Name:     "android push window in the background",
		Platform: Android,
		Steps: steps(androidLaunch, []Step{
			step(DidEnterBackground, bg).flush().returns(false),
			step(PushWindowBegin, bga).returns(true),
			step(PushWindowEnd, bg).flush().returns(false),
		}),
		Observed: states(bga, ina, fg, bg, bga, bg),
	},
	{
		// A process started without UI reports the background before the push window opens.
		Name:     "android push at cold start",
		Platform: Android,
		Steps: []Step{
			step(DidEnterBackground, bg).flush().returns(false),
			step(PushWindowBegin, bga).returns(true),
			step(PushWindowEnd, bg).flush().returns(false),
		},
		Observed: states(bga, bg, bga, bg),
	},
	{
		// The push window's hold lasts until its own end, whatever the process does meanwhile.
		Name:     "android push window racing process start",
		Platform: Android,
		Steps: steps(androidLaunch, []Step{
			step(DidEnterBackground, bg).flush().returns(false),
			step(PushWindowBegin, bga).returns(true),
			step(WillEnterForeground, ina),
			step(PushWindowEnd, ina).returns(false),
			step(DidBecomeActive, fg),
			step(PushWindowBegin, fg).returns(false),
			step(PushWindowEnd, fg).returns(false),
			step(DidEnterBackground, bg).flush().returns(false),
			step(PushWindowBegin, bga).returns(true),
		}, androidStart, []Step{
			step(DidEnterBackground, bga).flush().returns(false),
			step(PushWindowEnd, bg).flush().returns(false),
		}),
		Observed: states(bga, ina, fg, bg, bga, ina, fg, bg, bga, ina, fg, bga, bg),
	},
	{
		Name:     "android push window hands over to a background task",
		Platform: Android,
		Steps: steps(androidLaunch, []Step{
			step(DidEnterBackground, bg).flush().returns(false),
			step(PushWindowBegin, bga).returns(true),
			step(WorkStarts, bga),
			step(PushWindowEnd, bga).returns(true),
			step(BackgroundTaskStart, bga).returns(true),
			step(BackgroundTaskDelivered, bg).flush(),
		}),
		Observed: states(bga, ina, fg, bg, bga, bg),
	},
	{
		Name:     "android overlapping push windows",
		Platform: Android,
		Steps: steps(androidLaunch, []Step{
			step(DidEnterBackground, bg).flush().returns(false),
			step(PushWindowBegin, bga).slot(0).returns(true),
			step(PushWindowBegin, bga).slot(1).returns(true),
			step(PushWindowEnd, bga).slot(0).returns(false),
			step(PushWindowEnd, bg).slot(1).flush().returns(false),
		}),
		Observed: states(bga, ina, fg, bg, bga, bg),
	},
	{
		// BackgroundSyncWorker doesn't init Go, so it only syncs in a process where
		// something else did; a push (or quick reply) cold start already reported
		// the background.
		Name:     "android WorkManager BackgroundSync after a push cold start",
		Platform: Android,
		Steps: []Step{
			step(DidEnterBackground, bg).flush().returns(false),
			step(PushWindowBegin, bga).returns(true),
			step(PushWindowEnd, bg).flush().returns(false),
			step(BackgroundSyncStart, bga).returns(true),
			step(BackgroundSyncTimerFires, bg).flush(),
		},
		Observed: states(bga, bg, bga, bg, bga, bg),
	},
	{
		Name:     "android UI starts during a WorkManager sync after a push cold start",
		Platform: Android,
		Steps: []Step{
			step(DidEnterBackground, bg).flush().returns(false),
			step(PushWindowBegin, bga).returns(true),
			step(PushWindowEnd, bg).flush().returns(false),
			step(BackgroundSyncStart, bga).returns(true),
			step(WillEnterForeground, ina),
			step(DidBecomeActive, fg),
			step(BackgroundSyncWait, fg),
		},
		Observed: states(bga, bg, bga, bg, bga, ina, fg),
	},
	{
		// The sync keeps its hold after the push window ends.
		Name:     "android WorkManager BackgroundSync racing a push window",
		Platform: Android,
		Steps: steps(androidLaunch, []Step{
			step(DidEnterBackground, bg).flush().returns(false),
			step(BackgroundSyncStart, bga).returns(true),
			step(PushWindowBegin, bga).returns(true),
			step(PushWindowEnd, bga).returns(false),
			step(BackgroundSyncTimerFires, bg).flush(),
		}),
		Observed: states(bga, ina, fg, bg, bga, bg),
	},
	{
		Name:     "android termination",
		Platform: Android,
		Steps:    steps(androidLaunch, []Step{step(WillTerminate, bg).flush().warn()}),
		Observed: states(bga, ina, fg, bg),
	},
}
