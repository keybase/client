package avatars

import (
	"runtime"
	"strings"
	"testing"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/stretchr/testify/require"
)

// avatarsPackagePrefix is matched against goroutine-dump call frames, not
// "created by" lines, so this only counts goroutines currently executing
// somewhere in this package - not ones merely spawned from it (e.g. the
// lru cleaner) and not the test's own goroutine.
const avatarsPackagePrefix = "github.com/keybase/client/go/avatars."

// countAvatarsPackageGoroutines returns the number of goroutines whose stack
// has a call frame in this package, excluding the goroutine running the test
// itself (identified by a testing.tRunner frame). It looks at call frames
// only, never "created by" lines, so it can't be defeated by renaming or
// inlining a leaked goroutine's function - only by it actually exiting.
func countAvatarsPackageGoroutines() int {
	buf := make([]byte, 1<<20)
	for {
		n := runtime.Stack(buf, true)
		if n < len(buf) {
			return parseAvatarsPackageGoroutines(string(buf[:n]))
		}
		buf = make([]byte, 2*len(buf))
	}
}

func parseAvatarsPackageGoroutines(dump string) int {
	count := 0
	for _, block := range strings.Split(strings.TrimRight(dump, "\n"), "\n\n") {
		if !strings.HasPrefix(block, "goroutine ") {
			continue
		}
		if strings.Contains(block, "testing.tRunner") {
			continue // the goroutine running this test (and its t.Run tree)
		}
		lines := strings.Split(block, "\n")
		for _, line := range lines[1:] {
			// Call frames have no leading whitespace; the file:line under
			// them does, and so does a "created by ..." parent pointer.
			if strings.HasPrefix(line, "\t") || strings.HasPrefix(line, "created by ") || line == "" {
				continue
			}
			if strings.Contains(line, avatarsPackagePrefix) {
				count++
				break
			}
		}
	}
	return count
}

// StartBackgroundTasks/StopBackgroundTasks should leave no goroutine behind:
// Stop is supposed to be the mirror image of Start. The leak signal is
// scoped to goroutines with a live call frame in this package rather than a
// raw process-wide runtime.NumGoroutine() count, so it isn't tripped by
// harness goroutines whose lifetimes this test doesn't control (the test
// context's own background loop, an async-cancelled lru cleaner, etc.), and
// it isn't defeated by renaming or inlining the monitor loop.
func TestAvatarMonitorExitsOnStop(t *testing.T) {
	tc := libkb.SetupTest(t, "avatars", 1)
	defer tc.Cleanup()
	m := libkb.NewMetaContextForTest(tc)

	full := NewFullCachingSource(tc.G, time.Hour, 10)
	full.tempDir = t.TempDir()
	var s libkb.AvatarLoaderSource = full

	// Warm up lazily started goroutines before taking the baseline, so only
	// leaks from the Start/Stop cycles below count against it.
	s.StartBackgroundTasks(m)
	s.StopBackgroundTasks(m)
	time.Sleep(100 * time.Millisecond)
	baseline := countAvatarsPackageGoroutines()

	const cycles = 5
	for range cycles {
		s.StartBackgroundTasks(m)
		s.StopBackgroundTasks(m)
	}

	// Poll rather than use require.Eventually's msgAndArgs for the final
	// count: those args are evaluated once, immediately, before the polling
	// loop runs, so a trailing count there would be stale by the time the
	// loop actually finishes.
	deadline := time.Now().Add(10 * time.Second)
	current := countAvatarsPackageGoroutines()
	for current > baseline && time.Now().Before(deadline) {
		time.Sleep(10 * time.Millisecond)
		current = countAvatarsPackageGoroutines()
	}
	require.LessOrEqual(t, current, baseline,
		"goroutines leaked across %d Start/Stop cycles: baseline=%d current=%d", cycles, baseline, current)
}
