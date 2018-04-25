package libkb

import (
	"testing"
	"time"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/clockwork"
	"github.com/stretchr/testify/require"
)

const chWait = 5 * time.Second

func setupBgTickerTest(t *testing.T) (TestContext, *BgTicker, clockwork.FakeClock) {
	tc := SetupTest(t, "ticker", 1)
	fc := clockwork.NewFakeClock()
	ticker := NewBgTicker(tc.G, time.Second)
	ticker.SetClock(fc)
	return tc, ticker, fc
}

func TestBgTickerStart(t *testing.T) {
	_, ticker, clock := setupBgTickerTest(t)

	start := clock.Now()
	require.True(t, ticker.Start())
	clock.Advance(ticker.duration)

	// Test tick
	for i := 0; i < 5; i++ {
		select {
		case <-ticker.C:
			require.True(t, clock.Now().Sub(start) >= ticker.duration)
			clock.Advance(ticker.duration)
		case <-time.After(chWait):
			require.Fail(t, "ticker did not fire")
		}
	}
}

func TestBgTickerStop(t *testing.T) {
	_, ticker, clock := setupBgTickerTest(t)

	require.True(t, ticker.Start())
	require.True(t, ticker.Stop())
	clock.Advance(time.Second * 2)

	select {
	case <-ticker.C:
		require.Fail(t, "stop is not working")
	case <-time.After(ticker.duration):
	}
}

func TestBgTickerPause(t *testing.T) {
	_, ticker, clock := setupBgTickerTest(t)

	start := clock.Now()
	require.True(t, ticker.Start())
	clock.Advance(time.Microsecond * 500)

	require.True(t, ticker.Pause())
	clock.Advance(time.Second)

	require.True(t, ticker.Start())
	clock.Advance(time.Second)

	select {
	case <-ticker.C:
		require.True(t, clock.Now().Sub(start) >= ticker.duration)
	case <-time.After(chWait):
		require.Fail(t, "ticker did not fire")
	}
}

func TestBgTickerBackgroundStateChanges(t *testing.T) {
	tc, ticker, clock := setupBgTickerTest(t)

	appStateCh := make(chan struct{})
	ticker.appStateCh = appStateCh

	start := clock.Now()
	require.True(t, ticker.Start())

	tc.G.AppState.Update(keybase1.AppState_FOREGROUND)
	select {
	case <-appStateCh:
		require.Fail(t, "app state")
	default:
	}
	require.Equal(t, ticker.state, stateActive)

	// Set the background state and assert that we are paused
	tc.G.AppState.Update(keybase1.AppState_BACKGROUND)
	select {
	case <-appStateCh:
	case <-time.After(chWait):
		require.Fail(t, "no app state")
	}
	require.Equal(t, ticker.state, stateIdle)
	clock.Advance(time.Second)

	tc.G.AppState.Update(keybase1.AppState_FOREGROUND)
	select {
	case <-appStateCh:
	case <-time.After(chWait):
		require.Fail(t, "no app state")
	}
	require.Equal(t, ticker.state, stateActive)
	clock.Advance(time.Second)

	select {
	case <-ticker.C:
		require.True(t, clock.Now().Sub(start) >= ticker.duration)
	case <-time.After(chWait):
		require.Fail(t, "ticker did not fire")
	}
}
