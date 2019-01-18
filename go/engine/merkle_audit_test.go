// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"testing"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/clockwork"
	"github.com/stretchr/testify/require"
)

func TestMerkleAuditWork(t *testing.T) {
	tc := SetupEngineTest(t, "merkleaudit")
	defer tc.Cleanup()

	tc.G.Env.Test.ServerURI = libkb.ProductionServerURI
	tc.G.ConfigureAPI()

	fakeClock := clockwork.NewFakeClockAt(time.Now())
	tc.G.SetClock(fakeClock)

	advance := func(d time.Duration) {
		tc.G.Log.Debug("+ fakeClock#advance(%s) start: %s", d, fakeClock.Now())
		fakeClock.Advance(d)
		tc.G.Log.Debug("- fakeClock#adance(%s) end: %s", d, fakeClock.Now())
	}

	metaCh := make(chan string, 100)
	roundResCh := make(chan error, 100)
	arg := &MerkleAuditArgs{
		testingMetaCh:     metaCh,
		testingRoundResCh: roundResCh,
	}
	eng := NewMerkleAudit(tc.G, arg)
	eng.task.args.Settings.StartStagger = 0 // Disable stagger for deterministic testing
	m := NewMetaContextForTest(tc)
	err := RunEngine2(m, eng)
	require.NoError(t, err)

	// Run a manual root fetch
	_, err = tc.G.MerkleClient.FetchRootFromServer(m, time.Hour)
	require.NoError(t, err)

	expectMeta(t, metaCh, "loop-start")
	advance(MerkleAuditSettings.Start + time.Second)
	expectMeta(t, metaCh, "woke-start")

	// first run doesn't do anything
	select {
	case x := <-roundResCh:
		require.Equal(t, nil, x, "round result")
	case <-time.After(30 * time.Second):
		require.FailNow(t, "channel timed out")
	}
	expectMeta(t, metaCh, "loop-round-complete")

	eng.Shutdown()
	expectMeta(t, metaCh, "loop-exit")
	expectMeta(t, metaCh, "")
}
