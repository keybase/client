package libkb

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

const chWait = 5 * time.Second

func TestBgTicker(t *testing.T) {
	duration := 2 * time.Millisecond
	start := time.Now()
	ticker := NewBgTickerWithWait(duration, time.Millisecond)

	// Test tick
	for i := 0; i < 5; i++ {
		select {
		case <-ticker.C:
			if i == 0 {
				require.True(t, time.Now().Sub(start) >= duration)
			}
		case <-time.After(chWait):
			require.Fail(t, "ticker did not fire")
		}
	}
}
