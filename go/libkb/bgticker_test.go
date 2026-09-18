package libkb

import (
	"runtime"
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

// Stop ends the tick goroutine whether it waits for a tick, waits out the
// resume wait, or is blocked handing a tick to a reader that went away.
func TestBgTickerStopEndsGoroutine(t *testing.T) {
	baseline := runtime.NumGoroutine()
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
	deadline := time.Now().Add(10 * time.Second)
	for runtime.NumGoroutine() > baseline && time.Now().Before(deadline) {
		time.Sleep(10 * time.Millisecond)
	}
	require.LessOrEqual(t, runtime.NumGoroutine(), baseline, "leaked tick goroutines")
}
