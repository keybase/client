package libkb

import (
	"runtime"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

const chWait = 5 * time.Second

func TestBgTicker(t *testing.T) {
	duration := 2 * time.Millisecond
	wait := time.Millisecond
	start := time.Now()
	ticker := NewBgTickerWithWait(duration, wait)

	// Test tick
	for i := range 5 {
		select {
		case <-ticker.C:
			if i == 0 {
				require.GreaterOrEqual(t, time.Since(start), wait, "time.Since(start) %v", time.Since(start))
			}
		case <-time.After(chWait):
			require.Fail(t, "ticker did not fire")
		}
	}
}

// libkbFramePrefix is matched against goroutine-dump call frames, not
// "created by" lines, so only goroutines currently executing BgTicker code
// (a BgTicker method, or a closure inside its constructors) are counted.
const libkbFramePrefix = "github.com/keybase/client/go/libkb."

// countBgTickerGoroutines returns the number of goroutines with a live call
// frame in BgTicker code, excluding the goroutine running the test
// itself (identified by a testing.tRunner frame). Unlike
// runtime.NumGoroutine, it isn't moved by unrelated goroutines elsewhere in
// the process.
func countBgTickerGoroutines() int {
	buf := make([]byte, 1<<20)
	for {
		n := runtime.Stack(buf, true)
		if n < len(buf) {
			return parseBgTickerGoroutines(string(buf[:n]))
		}
		buf = make([]byte, 2*len(buf))
	}
}

func parseBgTickerGoroutines(dump string) int {
	count := 0
	for _, block := range strings.Split(strings.TrimRight(dump, "\n"), "\n\n") {
		if !strings.HasPrefix(block, "goroutine ") || strings.Contains(block, "testing.tRunner") {
			continue
		}
		lines := strings.Split(block, "\n")
		for _, line := range lines[1:] {
			// Call frames have no leading whitespace; the file:line under
			// them does, and so does a "created by ..." parent pointer.
			if strings.HasPrefix(line, "\t") || strings.HasPrefix(line, "created by ") || line == "" {
				continue
			}
			if strings.HasPrefix(line, libkbFramePrefix) && strings.Contains(line, "BgTicker") {
				count++
				break
			}
		}
	}
	return count
}

// Stop ends the tick goroutine whether it waits for a tick, waits out the
// resume wait, or is blocked handing a tick to a reader that went away.
func TestBgTickerStopEndsGoroutine(t *testing.T) {
	baseline := countBgTickerGoroutines()
	var tickers []*BgTicker
	for i := range 30 {
		switch i % 3 {
		case 0:
			tickers = append(tickers, NewBgTickerWithWait(time.Hour, time.Millisecond))
		case 1:
			tickers = append(tickers, NewBgTickerWithWait(time.Hour+time.Millisecond, time.Hour))
		default:
			ticker := NewBgTickerWithWait(2*time.Millisecond, time.Millisecond)
			// fill C, so the next tick blocks on the send
			<-ticker.C
			tickers = append(tickers, ticker)
		}
	}
	time.Sleep(50 * time.Millisecond)
	for _, ticker := range tickers {
		ticker.Stop()
		ticker.Stop()
	}
	current := countBgTickerGoroutines()
	for deadline := time.Now().Add(10 * time.Second); current > baseline && time.Now().Before(deadline); current = countBgTickerGoroutines() {
		time.Sleep(10 * time.Millisecond)
	}
	require.LessOrEqual(t, current, baseline, "leaked tick goroutines: baseline=%d current=%d", baseline, current)
}
