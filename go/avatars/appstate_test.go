package avatars

import (
	"runtime"
	"testing"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/stretchr/testify/require"
)

// StartBackgroundTasks/StopBackgroundTasks should leave no goroutine behind:
// Stop is supposed to be the mirror image of Start. This is checked by
// goroutine count rather than by naming the leaked goroutine's function, so
// it can't be defeated by renaming or inlining the monitor loop.
func TestAvatarMonitorExitsOnStop(t *testing.T) {
	tc := libkb.SetupTest(t, "avatars", 1)
	defer tc.Cleanup()
	m := libkb.NewMetaContextForTest(tc)

	full := NewFullCachingSource(tc.G, time.Hour, 10)
	full.tempDir = t.TempDir()
	var s libkb.AvatarLoaderSource = full

	// Warm up lazily started goroutines (e.g. one-time package/runtime
	// initialization) before taking the baseline, so only leaks from
	// repeated Start/Stop cycles count against it.
	s.StartBackgroundTasks(m)
	s.StopBackgroundTasks(m)
	time.Sleep(100 * time.Millisecond)
	baseline := runtime.NumGoroutine()

	const cycles = 5
	for range cycles {
		s.StartBackgroundTasks(m)
		s.StopBackgroundTasks(m)
	}

	require.Eventually(t, func() bool {
		return runtime.NumGoroutine() <= baseline
	}, 10*time.Second, 10*time.Millisecond,
		"goroutines leaked across %d Start/Stop cycles: baseline=%d current=%d", cycles, baseline, runtime.NumGoroutine())
}
