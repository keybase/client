package ephemeral

import (
	"sync/atomic"
	"testing"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestKeygenLoopSeedsFromState(t *testing.T) {
	tc := libkb.SetupTest(t, "ephemeral", 2)
	defer tc.Cleanup()
	mctx := libkb.NewMetaContextForTest(tc)
	appState := tc.G.MobileAppState
	appState.Update(keybase1.MobileAppState_BACKGROUNDACTIVE)

	var runs atomic.Int32
	waiting := make(chan keybase1.MobileAppState, 10)
	stopCh := make(chan struct{})
	done := make(chan struct{})
	go func() {
		defer close(done)
		(&EKLib{}).keygenLoop(mctx, stopCh, nil,
			func() time.Duration { return 0 },
			func() { runs.Add(1) },
			func(state keybase1.MobileAppState) { waiting <- state })
	}()

	next := func(want keybase1.MobileAppState) {
		t.Helper()
		select {
		case got := <-waiting:
			require.Equal(t, want, got)
		case <-time.After(10 * time.Second):
			t.Fatal("keygen loop did not wait")
		}
	}

	// A background-active launch is not a transition into BACKGROUNDACTIVE.
	next(keybase1.MobileAppState_BACKGROUNDACTIVE)
	require.Zero(t, runs.Load())

	appState.Update(keybase1.MobileAppState_FOREGROUND)
	next(keybase1.MobileAppState_FOREGROUND)
	require.Zero(t, runs.Load())

	appState.Update(keybase1.MobileAppState_BACKGROUNDACTIVE)
	next(keybase1.MobileAppState_BACKGROUNDACTIVE)
	require.EqualValues(t, 1, runs.Load())

	close(stopCh)
	select {
	case <-done:
	case <-time.After(10 * time.Second):
		t.Fatal("keygen loop did not stop")
	}
}
