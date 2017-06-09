// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"testing"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/clockwork"
	"github.com/stretchr/testify/require"
)

// When stopped before RunEngine, the inner loop never runs.
func TestPerUserKeyBackgroundShutdownFirst(t *testing.T) {
	tc := SetupEngineTest(t, "pukup")
	defer tc.Cleanup()
	fakeClock := clockwork.NewFakeClockAt(time.Now())
	tc.G.SetClock(fakeClock)

	tc.Tp.UpgradePerUserKey = true

	advance := func(d time.Duration) {
		tc.G.Log.Debug("+ fakeClock#advance(%s) start: %s", d, fakeClock.Now())
		fakeClock.Advance(d)
		tc.G.Log.Debug("- fakeClock#adance(%s) end: %s", d, fakeClock.Now())
	}

	metaCh := make(chan string, 100)
	arg := &PerUserKeyBackgroundArgs{
		Settings:      PerUserKeyBackgroundDefaultSettings,
		testingMetaCh: metaCh,
	}
	eng := NewPerUserKeyBackground(tc.G, arg)
	ctx := &Context{
		LogUI: tc.G.UI.GetLogUI(),
	}

	// shut down before starting
	eng.Shutdown()

	err := RunEngine(eng, ctx)
	require.NoError(t, err)

	expectMeta(t, metaCh, "early-shutdown")

	advance(arg.Settings.Start)
	advance(arg.Settings.Interval)
	advance(arg.Settings.Interval)
	advance(arg.Settings.Interval)
	advance(arg.Settings.Interval)

	expectMeta(t, metaCh, "")
}

// When stopped before the Start wait time, the loop starts but a round never runs.
func TestPerUserKeyBackgroundShutdownSoon(t *testing.T) {
	tc := SetupEngineTest(t, "pukup")
	defer tc.Cleanup()
	fakeClock := clockwork.NewFakeClockAt(time.Now())
	tc.G.SetClock(fakeClock)

	tc.Tp.UpgradePerUserKey = true

	advance := func(d time.Duration) {
		tc.G.Log.Debug("+ fakeClock#advance(%s) start: %s", d, fakeClock.Now())
		fakeClock.Advance(d)
		tc.G.Log.Debug("- fakeClock#adance(%s) end: %s", d, fakeClock.Now())
	}

	metaCh := make(chan string, 100)
	roundResCh := make(chan error, 100)
	arg := &PerUserKeyBackgroundArgs{
		Settings:          PerUserKeyBackgroundDefaultSettings,
		testingMetaCh:     metaCh,
		testingRoundResCh: roundResCh,
	}
	eng := NewPerUserKeyBackground(tc.G, arg)
	ctx := &Context{
		LogUI: tc.G.UI.GetLogUI(),
	}
	err := RunEngine(eng, ctx)
	require.NoError(t, err)

	expectMeta(t, metaCh, "loop-start")

	advance(arg.Settings.Start - time.Second)

	eng.Shutdown()

	expectMeta(t, metaCh, "loop-exit")

	advance(arg.Settings.Interval)
	advance(arg.Settings.Interval)

	expectMeta(t, metaCh, "")
}

// Shutting down after a few loop rounds should work.
// Also test that LoginRequired comes out when there is no user.
func TestPerUserKeyBackgroundShutdownMiddle(t *testing.T) {
	tc := SetupEngineTest(t, "pukup")
	defer tc.Cleanup()
	fakeClock := clockwork.NewFakeClockAt(time.Now())
	tc.G.SetClock(fakeClock)

	tc.Tp.UpgradePerUserKey = true

	advance := func(d time.Duration) {
		tc.G.Log.Debug("+ fakeClock#advance(%s) start: %s", d, fakeClock.Now())
		fakeClock.Advance(d)
		tc.G.Log.Debug("- fakeClock#adance(%s) end: %s", d, fakeClock.Now())
	}

	metaCh := make(chan string, 100)
	roundResCh := make(chan error, 100)
	arg := &PerUserKeyBackgroundArgs{
		Settings:          PerUserKeyBackgroundDefaultSettings,
		testingMetaCh:     metaCh,
		testingRoundResCh: roundResCh,
	}
	eng := NewPerUserKeyBackground(tc.G, arg)
	ctx := &Context{
		LogUI: tc.G.UI.GetLogUI(),
	}
	err := RunEngine(eng, ctx)
	require.NoError(t, err)

	expectMeta(t, metaCh, "loop-start")
	advance(arg.Settings.Start + time.Second)
	expectMeta(t, metaCh, "woke-start")

	n := 3
	for i := 0; i < n; i++ {
		t.Logf("check %v", i)
		select {
		case x := <-roundResCh:
			require.Equal(t, libkb.LoginRequiredError{}, x, "round result")
		case <-time.After(5 * time.Second):
			require.FailNow(t, "channel timed out")
		}
		if i < n-1 {
			advance(arg.Settings.Interval + time.Second)
			expectMeta(t, metaCh, "woke-interval")
			advance(arg.Settings.WakeUp + time.Second)
			expectMeta(t, metaCh, "woke-wakeup")
		}
	}

	eng.Shutdown()
	expectMeta(t, metaCh, "loop-exit")

	for i := 0; i < 2; i++ {
		advance(arg.Settings.Interval)
		select {
		case x := <-roundResCh:
			require.FailNow(t, "unexpected", x)
		default:
			// expected
		}
	}

	expectMeta(t, metaCh, "")
}

func TestPerUserKeyBackgroundUnnecessary(t *testing.T) {
	tc := SetupEngineTest(t, "pukup")
	defer tc.Cleanup()
	fakeClock := clockwork.NewFakeClockAt(time.Now())
	tc.G.SetClock(fakeClock)

	tc.Tp.UpgradePerUserKey = true

	_ = CreateAndSignupFakeUser(tc, "track")

	t.Logf("user already has per-user-key")
	checkPerUserKeyCount(&tc, 1)

	advance := func(d time.Duration) {
		tc.G.Log.Debug("+ fakeClock#advance(%s) start: %s", d, fakeClock.Now())
		fakeClock.Advance(d)
		tc.G.Log.Debug("- fakeClock#adance(%s) end: %s", d, fakeClock.Now())
	}

	metaCh := make(chan string, 100)
	arg := &PerUserKeyBackgroundArgs{
		Settings:      PerUserKeyBackgroundDefaultSettings,
		testingMetaCh: metaCh,
	}
	eng := NewPerUserKeyBackground(tc.G, arg)
	ctx := &Context{
		LogUI: tc.G.UI.GetLogUI(),
	}

	// shut down before starting
	eng.Shutdown()

	err := RunEngine(eng, ctx)
	require.NoError(t, err)

	expectMeta(t, metaCh, "early-shutdown")

	advance(arg.Settings.Start)
	advance(arg.Settings.Interval)
	advance(arg.Settings.Interval)
	advance(arg.Settings.Interval)
	advance(arg.Settings.Interval)

	expectMeta(t, metaCh, "")

	checkPerUserKeyCount(&tc, 1)
}

// The normal case of upgrading a user
func TestPerUserKeyBackgroundWork(t *testing.T) {
	tc := SetupEngineTest(t, "pukup")
	defer tc.Cleanup()
	fakeClock := clockwork.NewFakeClockAt(time.Now())
	tc.G.SetClock(fakeClock)

	tc.Tp.UpgradePerUserKey = false

	_ = CreateAndSignupFakeUser(tc, "track")

	tc.Tp.UpgradePerUserKey = true

	t.Logf("user has no per-user-key")
	checkPerUserKeyCount(&tc, 0)

	advance := func(d time.Duration) {
		tc.G.Log.Debug("+ fakeClock#advance(%s) start: %s", d, fakeClock.Now())
		fakeClock.Advance(d)
		tc.G.Log.Debug("- fakeClock#adance(%s) end: %s", d, fakeClock.Now())
	}

	metaCh := make(chan string, 100)
	roundResCh := make(chan error, 100)
	arg := &PerUserKeyBackgroundArgs{
		Settings:          PerUserKeyBackgroundDefaultSettings,
		testingMetaCh:     metaCh,
		testingRoundResCh: roundResCh,
	}
	eng := NewPerUserKeyBackground(tc.G, arg)
	ctx := &Context{
		LogUI: tc.G.UI.GetLogUI(),
	}

	err := RunEngine(eng, ctx)
	require.NoError(t, err)

	expectMeta(t, metaCh, "loop-start")
	advance(arg.Settings.Start + time.Second)
	expectMeta(t, metaCh, "woke-start")

	select {
	case x := <-roundResCh:
		require.Equal(t, nil, x, "round result")
	case <-time.After(5 * time.Second):
		require.FailNow(t, "channel timed out")
	}

	// second run that doesn't do anything
	advance(arg.Settings.Interval + time.Second)
	expectMeta(t, metaCh, "woke-interval")
	advance(arg.Settings.WakeUp + time.Second)
	expectMeta(t, metaCh, "woke-wakeup") // this line has flaked before (CORE-5410)
	select {
	case x := <-roundResCh:
		require.Equal(t, nil, x, "round result")
	case <-time.After(5 * time.Second):
		require.FailNow(t, "channel timed out")
	}

	checkPerUserKeyCount(&tc, 1)
	checkPerUserKeyCountLocal(&tc, 1)

	eng.Shutdown()
	expectMeta(t, metaCh, "loop-exit")
	expectMeta(t, metaCh, "")
}

// Test upgrading after running for a while and then logging in.
func TestPerUserKeyBackgroundLoginLate(t *testing.T) {
	tc := SetupEngineTest(t, "pukup")
	defer tc.Cleanup()
	fakeClock := clockwork.NewFakeClockAt(time.Now())
	tc.G.SetClock(fakeClock)

	tc.Tp.UpgradePerUserKey = true

	t.Logf("user has no per-user-key")

	advance := func(d time.Duration) {
		tc.G.Log.Debug("+ fakeClock#advance(%s) start: %s", d, fakeClock.Now())
		fakeClock.Advance(d)
		tc.G.Log.Debug("- fakeClock#adance(%s) end: %s", d, fakeClock.Now())
	}

	metaCh := make(chan string, 100)
	roundResCh := make(chan error, 100)
	arg := &PerUserKeyBackgroundArgs{
		Settings:          PerUserKeyBackgroundDefaultSettings,
		testingMetaCh:     metaCh,
		testingRoundResCh: roundResCh,
	}
	eng := NewPerUserKeyBackground(tc.G, arg)
	ctx := &Context{
		LogUI: tc.G.UI.GetLogUI(),
	}

	err := RunEngine(eng, ctx)
	require.NoError(t, err)

	expectMeta(t, metaCh, "loop-start")
	advance(arg.Settings.Start + time.Second)
	expectMeta(t, metaCh, "woke-start")

	t.Logf("run once while not logged in")
	select {
	case x := <-roundResCh:
		require.Equal(t, libkb.LoginRequiredError{}, x, "round result")
	case <-time.After(5 * time.Second):
		require.FailNow(t, "channel timed out")
	}

	t.Logf("sign up and in")
	tc.Tp.UpgradePerUserKey = false
	_ = CreateAndSignupFakeUser(tc, "track")
	checkPerUserKeyCount(&tc, 0)

	tc.Tp.UpgradePerUserKey = true

	t.Logf("second run upgrades the user")
	advance(arg.Settings.Interval + time.Second)
	expectMeta(t, metaCh, "woke-interval")
	advance(arg.Settings.WakeUp + time.Second)
	expectMeta(t, metaCh, "woke-wakeup")
	select {
	case x := <-roundResCh:
		require.Equal(t, nil, x, "round result")
	case <-time.After(5 * time.Second):
		require.FailNow(t, "channel timed out")
	}

	checkPerUserKeyCount(&tc, 1)
	checkPerUserKeyCountLocal(&tc, 1)

	eng.Shutdown()
	expectMeta(t, metaCh, "loop-exit")
	expectMeta(t, metaCh, "")
}

func expectMeta(t *testing.T, metaCh <-chan string, s string) {
	t.Logf("expect meta: %q", s)
	if s == "" {
		// assert that there is nothing on the channel
		// this can false-happy because it doesn't wait for the channel
		select {
		case x := <-metaCh:
			require.FailNow(t, "unexpected", x)
		default:
			// expected
		}
	} else {
		select {
		case x := <-metaCh:
			require.Equal(t, s, x)
		case <-time.After(5 * time.Second):
			require.FailNow(t, "channel timed out")
		}
	}
}
