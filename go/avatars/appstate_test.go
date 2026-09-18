package avatars

import (
	"runtime"
	"testing"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

// waitFlusher waits until f's watcher has acted on the current state and is
// waiting for the next change.
func waitFlusher(t *testing.T, f *backgroundFlusher) {
	t.Helper()
	require.Eventually(t, func() bool {
		f.mu.Lock()
		w := f.watcher
		f.mu.Unlock()
		if w == nil {
			return false
		}
		_, caughtUp := w.CaughtUp()
		return caughtUp
	}, 10*time.Second, time.Millisecond, "watcher did not catch up")
}

func flushes(f *backgroundFlusher) int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.flushes
}

type bgSource interface {
	libkb.AvatarLoaderSource
	flusher() *backgroundFlusher
}

func (c *FullCachingSource) flusher() *backgroundFlusher { return &c.bgFlusher }
func (c *URLCachingSource) flusher() *backgroundFlusher  { return &c.bgFlusher }

func forEachSource(t *testing.T, f func(t *testing.T, tc libkb.TestContext, s bgSource)) {
	sources := map[string]func(t *testing.T, g *libkb.GlobalContext) bgSource{
		"full": func(t *testing.T, g *libkb.GlobalContext) bgSource {
			s := NewFullCachingSource(g, time.Hour, 10)
			s.tempDir = t.TempDir()
			return s
		},
		"url": func(_ *testing.T, _ *libkb.GlobalContext) bgSource {
			return NewURLCachingSource(time.Hour, 10)
		},
	}
	for name, mk := range sources {
		t.Run(name, func(t *testing.T) {
			tc := libkb.SetupTest(t, "avatars", 1)
			defer tc.Cleanup()
			f(t, tc, mk(t, tc.G))
		})
	}
}

func TestAvatarsFlushSeedsFromState(t *testing.T) {
	forEachSource(t, func(t *testing.T, tc libkb.TestContext, s bgSource) {
		m := libkb.NewMetaContextForTest(tc)
		tc.G.MobileAppState.Update(keybase1.MobileAppState_BACKGROUND)
		s.StartBackgroundTasks(m)
		defer s.StopBackgroundTasks(m)
		waitFlusher(t, s.flusher())
		require.Equal(t, 0, flushes(s.flusher()), "flushed without a transition into BACKGROUND")

		for _, next := range []keybase1.MobileAppState{
			keybase1.MobileAppState_FOREGROUND,
			keybase1.MobileAppState_INACTIVE,
			keybase1.MobileAppState_BACKGROUND,
		} {
			tc.G.MobileAppState.Update(next)
			waitFlusher(t, s.flusher())
		}
		require.Equal(t, 1, flushes(s.flusher()))
	})
}

func TestAvatarsMonitorExitsOnStop(t *testing.T) {
	forEachSource(t, func(t *testing.T, tc libkb.TestContext, s bgSource) {
		m := libkb.NewMetaContextForTest(tc)
		// Warm up lazily started goroutines before taking the baseline.
		s.StartBackgroundTasks(m)
		s.StopBackgroundTasks(m)
		baseline := runtime.NumGoroutine()

		const cycles = 50
		for range cycles {
			s.StartBackgroundTasks(m)
			waitFlusher(t, s.flusher())
			s.StopBackgroundTasks(m)
		}
		require.Eventually(t, func() bool {
			return runtime.NumGoroutine() < baseline+cycles/2
		}, 10*time.Second, 10*time.Millisecond, "goroutines leaked across Start/Stop")
	})
}

// Start/Stop racing app-state changes neither deadlocks nor leaks.
func TestAvatarsMonitorStress(t *testing.T) {
	forEachSource(t, func(t *testing.T, tc libkb.TestContext, s bgSource) {
		m := libkb.NewMetaContextForTest(tc)
		baseline := runtime.NumGoroutine()
		done := make(chan struct{})
		go func() {
			defer close(done)
			states := []keybase1.MobileAppState{
				keybase1.MobileAppState_FOREGROUND,
				keybase1.MobileAppState_INACTIVE,
				keybase1.MobileAppState_BACKGROUND,
				keybase1.MobileAppState_BACKGROUNDACTIVE,
			}
			for i := range 400 {
				tc.G.MobileAppState.Update(states[i%len(states)])
			}
		}()
		for range 100 {
			s.StartBackgroundTasks(m)
			s.StopBackgroundTasks(m)
		}
		<-done
		require.Eventually(t, func() bool {
			return runtime.NumGoroutine() < baseline+10
		}, 10*time.Second, 10*time.Millisecond, "goroutines leaked")
	})
}
