package libkbfs

import (
	"sync"
	"time"

	metrics "github.com/rcrowley/go-metrics"
)

// CountMeter counts ticks with a sliding window into the past.
type CountMeter struct {
	mtx      sync.RWMutex
	counters []int64
	overall  int64

	shutdownCh chan struct{}
}

var _ metrics.Meter = (*CountMeter)(nil)

func (m *CountMeter) tick() {
	m.mtx.Lock()
	defer m.mtx.Unlock()
	for i := len(m.counters) - 1; i > 0; i-- {
		m.counters[i] = m.counters[i-1]
	}
	m.counters[0] = 0
}

func (m *CountMeter) run() {
	ticker := time.NewTicker(time.Minute)
	for {
		select {
		case <-m.shutdownCh:
			return
		case <-ticker.C:
			m.tick()
		}
	}
}

// NewCountMeter returns a new CountMeter.
func NewCountMeter() *CountMeter {
	m := &CountMeter{
		counters:   make([]int64, 16),
		shutdownCh: make(chan struct{}),
	}
	go m.run()

	return m
}

// Count returns the overall count.
func (m *CountMeter) Count() int64 {
	m.mtx.RLock()
	defer m.mtx.RUnlock()
	return m.overall
}

// Mark ticks the counters.
func (m *CountMeter) Mark(i int64) {
	m.mtx.Lock()
	defer m.mtx.Unlock()
	m.counters[0] += i
	m.overall += i
}

func (m *CountMeter) rateN(n int) float64 {
	var count int64
	for i := 0; i < n; i++ {
		count += m.counters[i]
	}
	return float64(count)
}

func (m *CountMeter) rate1() float64 {
	return float64(m.counters[0])
}

func (m *CountMeter) rate5() float64 {
	return m.rateN(5)
}

func (m *CountMeter) rate15() float64 {
	return m.rateN(15)
}

func (m *CountMeter) rateMean() float64 {
	return float64(m.overall)
}

// Rate1 returns the number of ticks in the last 1 minute.
func (m *CountMeter) Rate1() float64 {
	m.mtx.RLock()
	defer m.mtx.RUnlock()
	return m.rate1()
}

// Rate5 returns the number of ticks in the last 5 minutes.
func (m *CountMeter) Rate5() float64 {
	m.mtx.RLock()
	defer m.mtx.RUnlock()
	return m.rate5()
}

// Rate15 returns the number of ticks in the last 15 minutes.
func (m *CountMeter) Rate15() float64 {
	m.mtx.RLock()
	defer m.mtx.RUnlock()
	return m.rate15()
}

// RateMean returns the overall count of ticks.
func (m *CountMeter) RateMean() float64 {
	m.mtx.RLock()
	defer m.mtx.RUnlock()
	return m.rateMean()
}

// Snapshot returns the snapshot in time of this CountMeter.
func (m *CountMeter) Snapshot() metrics.Meter {
	m.mtx.RLock()
	defer m.mtx.RUnlock()
	return &MeterSnapshot{
		m.overall,
		m.rate1(),
		m.rate5(),
		m.rate15(),
		m.rateMean(),
	}
}

// Shutdown shuts down this CountMeter.
func (m *CountMeter) Shutdown() <-chan struct{} {
	select {
	case <-m.shutdownCh:
	default:
		close(m.shutdownCh)
	}
	return m.shutdownCh
}
