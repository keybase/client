// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"testing"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/clockwork"
	"github.com/stretchr/testify/require"
)

func TestPerUserKeyUpkeepBackgroundUnnecessary(t *testing.T) {
	tc := SetupEngineTest(t, "pukup")
	defer tc.Cleanup()
	fakeClock := clockwork.NewFakeClockAt(time.Now())
	tc.G.SetClock(fakeClock)

	fu := CreateAndSignupFakeUser(tc, "pukup")

	t.Logf("user has a per-user-key")
	startingSeqno := getUserSeqno(&tc, fu.UID())

	advance := func(d time.Duration) {
		tc.G.Log.Debug("+ fakeClock#advance(%s) start: %s", d, fakeClock.Now())
		fakeClock.Advance(d)
		tc.G.Log.Debug("- fakeClock#adance(%s) end: %s", d, fakeClock.Now())
	}

	metaCh := make(chan string, 100)
	roundResCh := make(chan error, 100)
	arg := &PerUserKeyUpgradeBackgroundArgs{
		testingMetaCh:     metaCh,
		testingRoundResCh: roundResCh,
	}
	eng := NewPerUserKeyUpgradeBackground(tc.G, arg)
	ctx := &Context{
		LogUI: tc.G.UI.GetLogUI(),
	}

	err := RunEngine(eng, ctx)
	require.NoError(t, err)

	expectMeta(t, metaCh, "loop-start")
	advance(PerUserKeyUpgradeBackgroundSettings.Start + time.Second)
	expectMeta(t, metaCh, "woke-start")

	// first run doesn't do anything
	select {
	case x := <-roundResCh:
		require.Equal(t, nil, x, "round result")
	case <-time.After(5 * time.Second):
		require.FailNow(t, "channel timed out")
	}
	expectMeta(t, metaCh, "loop-round-complete")

	checkPerUserKeyCount(&tc, 1)
	checkUserSeqno(&tc, fu.UID(), startingSeqno)

	eng.Shutdown()
	expectMeta(t, metaCh, "loop-exit")
	expectMeta(t, metaCh, "")
}

// The useful case of rolling the key after a deprovision.
func TestPerUserKeyUpkeepBackgroundWork(t *testing.T) {
	tc := SetupEngineTest(t, "pukup")
	defer tc.Cleanup()
	fakeClock := clockwork.NewFakeClockAt(time.Now())
	tc.G.SetClock(fakeClock)

	fu := CreateAndSignupFakeUser(tc, "pukup")

	// Get a second device which will deprovision itself.
	tc2 := SetupEngineTest(t, "login")
	defer tc2.Cleanup()

	t.Logf("provision second device")
	tcY, cleanup := provisionNewDeviceKex(&tc, fu)
	defer cleanup()

	t.Logf("second device deprovisions itself")
	{
		eng := NewDeprovisionEngine(tcY.G, fu.Username, true /* doRevoke */)
		ctx := &Context{
			LogUI:    tcY.G.UI.GetLogUI(),
			SecretUI: fu.NewSecretUI(),
		}
		err := RunEngine(eng, ctx)
		require.NoError(t, err, "deprovision")
	}

	preUpkeepSeqno := getUserSeqno(&tc, fu.UID())

	t.Logf("load self to bust the upak cache")
	// Upkeep hits the cache. It's ok that upkeep doesn't notice a deprovision
	// right away. Bust the upak cache as a way of simulating time passing
	// for the sake of this test.
	loadArg := libkb.NewLoadUserArgBase(tc.G).
		WithUID(fu.UID()).
		WithSelf(true).
		WithForcePoll(). // <-
		WithPublicKeyOptional()
	_, _, err := tc.G.GetUPAKLoader().LoadV2(*loadArg)
	require.NoError(t, err)

	advance := func(d time.Duration) {
		tc.G.Log.Debug("+ fakeClock#advance(%s) start: %s", d, fakeClock.Now())
		fakeClock.Advance(d)
		tc.G.Log.Debug("- fakeClock#adance(%s) end: %s", d, fakeClock.Now())
	}

	metaCh := make(chan string, 100)
	roundResCh := make(chan error, 100)
	arg := &PerUserKeyUpkeepBackgroundArgs{
		testingMetaCh:     metaCh,
		testingRoundResCh: roundResCh,
	}
	eng := NewPerUserKeyUpkeepBackground(tc.G, arg)
	ctx := &Context{
		LogUI: tc.G.UI.GetLogUI(),
	}

	err = RunEngine(eng, ctx)
	require.NoError(t, err)

	expectMeta(t, metaCh, "loop-start")
	advance(PerUserKeyUpkeepBackgroundSettings.Start + time.Second)
	expectMeta(t, metaCh, "woke-start")

	select {
	case x := <-roundResCh:
		require.Equal(t, nil, x, "round result")
	case <-time.After(5 * time.Second):
		require.FailNow(t, "channel timed out")
	}
	expectMeta(t, metaCh, "loop-round-complete")

	checkUserSeqno(&tc, fu.UID(), preUpkeepSeqno+keybase1.Seqno(1))

	// second run that doesn't do anything
	advance(PerUserKeyUpkeepBackgroundSettings.Interval + time.Second)
	expectMeta(t, metaCh, "woke-interval")
	advance(PerUserKeyUpkeepBackgroundSettings.WakeUp + time.Second)
	expectMeta(t, metaCh, "woke-wakeup") // this line has flaked before (CORE-5410)
	select {
	case x := <-roundResCh:
		require.Equal(t, nil, x, "round result")
	case <-time.After(5 * time.Second):
		require.FailNow(t, "channel timed out")
	}
	expectMeta(t, metaCh, "loop-round-complete")
	checkUserSeqno(&tc, fu.UID(), preUpkeepSeqno+keybase1.Seqno(1))

	checkPerUserKeyCount(&tc, 3)
	checkPerUserKeyCountLocal(&tc, 3)

	eng.Shutdown()
	expectMeta(t, metaCh, "loop-exit")
	expectMeta(t, metaCh, "")
}
