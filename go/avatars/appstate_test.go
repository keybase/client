package avatars

import (
	"bytes"
	"runtime"
	"testing"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/stretchr/testify/require"
)

// countMonitorAppStateGoroutines returns the number of goroutines currently
// parked inside monitorAppState, read from a full goroutine dump.
func countMonitorAppStateGoroutines() int {
	buf := make([]byte, 1<<20)
	for {
		n := runtime.Stack(buf, true)
		if n < len(buf) {
			return bytes.Count(buf[:n], []byte(".monitorAppState("))
		}
		buf = make([]byte, 2*len(buf))
	}
}

// StartBackgroundTasks/StopBackgroundTasks should leave no monitorAppState
// goroutine behind: Stop is supposed to be the mirror image of Start.
func TestAvatarMonitorExitsOnStop(t *testing.T) {
	tc := libkb.SetupTest(t, "avatars", 1)
	defer tc.Cleanup()
	m := libkb.NewMetaContextForTest(tc)

	full := NewFullCachingSource(tc.G, time.Hour, 10)
	full.tempDir = t.TempDir()
	var s libkb.AvatarLoaderSource = full

	for range 5 {
		s.StartBackgroundTasks(m)
		s.StopBackgroundTasks(m)
	}
	// give the monitorAppState goroutines a beat to actually park on their
	// blocking receive before we count them.
	time.Sleep(100 * time.Millisecond)

	require.Zero(t, countMonitorAppStateGoroutines(), "monitorAppState goroutines leaked across Start/Stop")
}
