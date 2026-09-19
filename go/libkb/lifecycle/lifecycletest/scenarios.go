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

// toForeground brings the app to the foreground: an iOS scene connects and
// becomes active, an Android process starts and resumes.
var toForeground = []Step{
	step(WillEnterForeground, ina),
	step(DidBecomeActive, fg),
}

// iosToBackgroundTask backgrounds a foreground app with a message still
// sending, which starts the background task.
var iosToBackgroundTask = []Step{
	step(WorkStarts, fg),
	step(WillResignActive, ina),
	step(DidEnterBackground, bga).flush().returns(true),
}

// Scenarios replays whole native event sequences. Consumers of the app state
// can play them with their own checks (see Play).
var Scenarios = []Scenario{
	{Name: "ios cold foreground launch", Platform: IOS, Steps: toForeground, Observed: states(bg, ina, fg)},
	{
		Name:     "ios background launch by silent push holds the app up for the push, then foreground",
		Platform: IOS,
		Steps: steps([]Step{
			step(PushWindowBegin, bga).returns(true),
			step(PushWindowEnd, bg).flush().returns(false),
			step(BackgroundTaskExpired, bg),
		}, toForeground),
		Observed: states(bg, bga, bg, ina, fg),
	},
	{
		Name:     "ios silent push while active holds nothing",
		Platform: IOS,
		Steps: steps(toForeground, []Step{
			step(PushWindowBegin, fg).returns(false),
			step(PushWindowEnd, fg).returns(false),
		}),
		Observed: states(bg, ina, fg),
	},
	{
		// iOS suspends the app once the push's completion handler runs.
		Name:     "ios silent push with a message still sending starts no background task",
		Platform: IOS,
		Steps: steps(toForeground, []Step{
			step(WillResignActive, ina),
			step(DidEnterBackground, bg).flush().returns(false),
			step(WorkStarts, bg),
			step(PushWindowBegin, bga).returns(true),
			step(PushWindowEnd, bg).flush().returns(false),
		}),
		Observed: states(bg, ina, fg, ina, bg, bga, bg),
	},
	{
		Name:     "ios background launch by BGAppRefresh, then foreground",
		Platform: IOS,
		Steps: steps([]Step{
			step(BackgroundSyncStart, bga).returns(true),
			step(BackgroundSyncTimerFires, bg).flush(),
		}, toForeground),
		Observed: states(bg, bga, bg, ina, fg),
	},
	{
		Name:     "ios home and return",
		Platform: IOS,
		Steps: steps(toForeground, []Step{
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
		Steps: steps(toForeground, []Step{
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
		Steps: steps(toForeground, []Step{
			step(WillResignActive, ina), step(DidBecomeActive, fg),
			step(WillResignActive, ina), step(DidBecomeActive, fg),
		}),
		Observed: states(bg, ina, fg, ina, fg, ina, fg),
	},
	{
		Name:     "ipad focus loss keeps things up",
		Platform: IOS,
		Steps: steps(toForeground, []Step{
			step(WillResignActive, ina), step(WillResignActive, ina), step(DidBecomeActive, fg),
			step(WillResignActive, ina), step(DidBecomeActive, fg), step(DidBecomeActive, fg),
		}),
		Observed: states(bg, ina, fg, ina, fg, ina, fg),
	},
	{
		Name:     "ios lock and unlock",
		Platform: IOS,
		Steps: steps(toForeground, []Step{
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
		Steps: steps(toForeground, []Step{
			step(BackgroundSyncStart, fg).returns(false),
			step(WillResignActive, ina),
			step(BackgroundSyncStart, ina).returns(false),
		}),
		Observed: states(bg, ina, fg, ina),
	},
	{
		Name:     "ios background task completes",
		Platform: IOS,
		Steps: steps(toForeground, iosToBackgroundTask, []Step{
			step(BackgroundTaskDelivered, bg).flush(),
			step(BackgroundTaskExpired, bg),
		}, toForeground),
		Observed: states(bg, ina, fg, ina, bga, bg, ina, fg),
	},
	{
		Name:     "ios background task fails",
		Platform: IOS,
		Steps:    steps(toForeground, iosToBackgroundTask, []Step{step(BackgroundTaskFails, bg).flush().warn()}),
		Observed: states(bg, ina, fg, ina, bga, bg),
	},
	{
		Name:     "ios background task runs out of time",
		Platform: IOS,
		Steps:    steps(toForeground, iosToBackgroundTask, []Step{step(BackgroundTaskTimesUp, bg).flush().warn()}),
		Observed: states(bg, ina, fg, ina, bga, bg),
	},
	{
		Name:     "ios background task expires",
		Platform: IOS,
		Steps: steps(toForeground, iosToBackgroundTask, []Step{
			step(BackgroundTaskExpired, bg).flush().warn(),
			step(BackgroundTaskWait, bg),
			step(BackgroundTaskExpired, bg),
		}),
		Observed: states(bg, ina, fg, ina, bga, bg),
	},
	{
		Name:     "ios background task expires after return to foreground",
		Platform: IOS,
		Steps: steps(toForeground, iosToBackgroundTask, []Step{
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
		Steps: steps(toForeground, iosToBackgroundTask, []Step{
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
		Steps: steps(toForeground, iosToBackgroundTask, []Step{
			step(WillEnterForeground, ina),
			step(BackgroundTaskDelivered, ina),
			step(DidBecomeActive, fg),
		}),
		Observed: states(bg, ina, fg, ina, bga, ina, fg),
	},
	{
		Name:     "ios live location across background",
		Platform: IOS,
		Steps: steps(toForeground, iosToBackgroundTask, []Step{
			step(BackgroundTaskDelivered, bg).flush(),
			// A location update wakes the app while tracking.
			step(LiveLocationAcquire, bga),
			// Tracking ends.
			step(LiveLocationRelease, bg).flush(),
			step(LiveLocationAcquire, bga),
			step(WillEnterForeground, ina),
			step(DidBecomeActive, fg),
			step(LiveLocationRelease, fg),
			// A hold taken in the foreground keeps the app running once it backgrounds.
			step(LiveLocationAcquire, fg),
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
		Steps: steps(toForeground, []Step{step(LiveLocationAcquire, fg)}, iosToBackgroundTask, []Step{
			step(BackgroundTaskExpired, bga).warn(),
			step(BackgroundTaskWait, bga),
			step(LiveLocationRelease, bg).flush(),
		}),
		Observed: states(bg, ina, fg, ina, bga, bg),
	},
	{
		Name:     "ios termination from the background",
		Platform: IOS,
		Steps: steps(toForeground, []Step{
			step(WillResignActive, ina),
			step(DidEnterBackground, bg).flush().returns(false),
			step(WillTerminate, bg).warn(),
		}),
		Observed: states(bg, ina, fg, ina, bg),
	},
	{
		Name:     "ios termination from the foreground",
		Platform: IOS,
		Steps:    steps(toForeground, []Step{step(WillTerminate, bg).flush().warn()}),
		Observed: states(bg, ina, fg, bg),
	},
	{
		Name:     "ios termination during a background task",
		Platform: IOS,
		Steps: steps(toForeground, iosToBackgroundTask, []Step{
			step(WillTerminate, bg).flush().warn(),
			step(BackgroundTaskWait, bg),
			step(BackgroundTaskExpired, bg),
		}),
		Observed: states(bg, ina, fg, ina, bga, bg),
	},
	{
		Name:     "ios termination ends live location's hold",
		Platform: IOS,
		Steps: steps(toForeground, []Step{
			step(LiveLocationAcquire, fg),
			step(WillResignActive, ina),
			step(DidEnterBackground, bga).flush().returns(false),
			step(WillTerminate, bg).flush().warn(),
			step(LiveLocationRelease, bg),
		}),
		Observed: states(bg, ina, fg, ina, bga, bg),
	},
	{Name: "android cold launch", Platform: Android, Steps: toForeground, Observed: states(bga, ina, fg)},
	{
		// Any first UI report ends the launch hold.
		Name:     "android cold launch straight to active",
		Platform: Android,
		Steps:    []Step{step(DidBecomeActive, fg)},
		Observed: states(bga, fg),
	},
	{
		Name:     "android process stop and start",
		Platform: Android,
		Steps: steps(toForeground, []Step{
			step(DidEnterBackground, bg).flush().returns(false),
		}, toForeground, []Step{
			step(WorkStarts, fg),
			step(DidEnterBackground, bga).flush().returns(true),
			step(WillEnterForeground, ina),
			step(DidBecomeActive, fg),
			step(BackgroundTaskWait, fg),
		}),
		Observed: states(bga, ina, fg, bg, ina, fg, bga, ina, fg),
	},
	{
		Name:     "android dialog, permission prompt or picker pause keeps the foreground",
		Platform: Android,
		Steps: steps(toForeground, []Step{
			step(Nothing, fg),
			step(PushWindowBegin, fg).returns(false),
			step(PushWindowEnd, fg).returns(false),
			// Back from the prompt: the process resumes without a start.
			step(DidBecomeActive, fg),
		}),
		Observed: states(bga, ina, fg),
	},
	{
		Name:     "android push window in the background",
		Platform: Android,
		Steps: steps(toForeground, []Step{
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
		Steps: steps(toForeground, []Step{
			step(DidEnterBackground, bg).flush().returns(false),
			step(PushWindowBegin, bga).returns(true),
			step(WillEnterForeground, ina),
			// No background task outside the background, even with work pending.
			step(WorkStarts, ina),
			step(PushWindowEnd, ina).returns(false),
			step(DidBecomeActive, fg),
			step(WorkStops, fg),
			step(PushWindowBegin, fg).returns(false),
			step(PushWindowEnd, fg).returns(false),
			step(DidEnterBackground, bg).flush().returns(false),
			step(PushWindowBegin, bga).returns(true),
		}, toForeground, []Step{
			step(DidEnterBackground, bga).flush().returns(false),
			step(PushWindowEnd, bg).flush().returns(false),
		}),
		Observed: states(bga, ina, fg, bg, bga, ina, fg, bg, bga, ina, fg, bga, bg),
	},
	{
		Name:     "android push window hands over to a background task",
		Platform: Android,
		Steps: steps(toForeground, []Step{
			step(DidEnterBackground, bg).flush().returns(false),
			step(PushWindowBegin, bga).returns(true),
			step(WorkStarts, bga),
			step(PushWindowEnd, bga).returns(true),
			step(BackgroundTaskDelivered, bg).flush(),
		}),
		Observed: states(bga, ina, fg, bg, bga, bg),
	},
	{
		Name:     "android overlapping push windows",
		Platform: Android,
		Steps: steps(toForeground, []Step{
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
		Steps: steps(toForeground, []Step{
			step(DidEnterBackground, bg).flush().returns(false),
			step(BackgroundSyncStart, bga).returns(true),
			step(PushWindowBegin, bga).returns(true),
			step(PushWindowEnd, bga).returns(false),
			step(BackgroundSyncTimerFires, bg).flush(),
		}),
		Observed: states(bga, ina, fg, bg, bga, bg),
	},
	{
		// A finishing activity reports willExit while the process lives on, so a
		// push can still open a window. The next exit ends its hold, and the
		// window's end then starts no task.
		Name:     "android termination",
		Platform: Android,
		Steps: steps(toForeground, []Step{
			step(WillTerminate, bg).flush().warn(),
			step(PushWindowBegin, bga).returns(true),
			step(WillTerminate, bg).flush().warn(),
			step(WorkStarts, bg),
			step(PushWindowEnd, bg).returns(false),
		}),
		Observed: states(bga, ina, fg, bg, bga, bg),
	},
}
