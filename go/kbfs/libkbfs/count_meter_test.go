package libkbfs

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestCountMeter(t *testing.T) {
	m := NewCountMeter()
	// Shutdown the meter so we manually control its ticks.
	m.Shutdown()

	var count1 float64
	var count5 float64
	var count15 float64
	var countMean float64

	for i := 0; i < 100; i++ {
		count1 = 0
		if i > 4 {
			count5 -= float64(((i - 5) * 4) + 10)
		}
		if i > 14 {
			count15 -= float64(((i - 15) * 4) + 10)
		}
		f := float64((i * 4) + 10)
		count1 += f
		count5 += f
		count15 += f
		countMean += f
		for j := 1; j < 5; j++ {
			m.Mark(int64(i + j))
		}
		s := m.Snapshot()
		require.Equal(t, count1, m.Rate1(), "Invalid Rate1 for i=%d", i)
		require.Equal(t, count5, m.Rate5(), "Invalid Rate5 for i=%d", i)
		require.Equal(t, count15, m.Rate15(), "Invalid Rate15 for i=%d", i)
		require.Equal(t, countMean, m.RateMean(), "Invalid RateMean for i=%d", i)
		require.Equal(t, int64(countMean), m.Count(), "Invalid Count for i=%d", i)
		require.Equal(t, s.Rate1(), m.Rate1())
		require.Equal(t, s.Rate5(), m.Rate5())
		require.Equal(t, s.Rate15(), m.Rate15())
		require.Equal(t, s.RateMean(), m.RateMean())
		require.Equal(t, s.Count(), m.Count())
		m.tick()
	}
}
