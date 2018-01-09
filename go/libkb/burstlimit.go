package libkb

import "time"

// BurstLimiter is a rate limiter that allows bursts of requests.
type BurstLimiter struct {
	g         *GlobalContext
	limiter   chan time.Time
	burstSize int
	duration  time.Duration
	ticker    *time.Ticker
}

// NewBurstLimiter creates a BurstLimiter that can have burstSize bursts
// of requests but limits the overall request rate to one request per
// duration.
//
// For example, NewBurstLimiter(5, 12 * time.Minute) will allow a burst
// of 5 requests, but will limit the number of requests to 5 per hour.
func NewBurstLimiter(g *GlobalContext, burstSize int, duration time.Duration) *BurstLimiter {
	b := &BurstLimiter{
		g:         g,
		limiter:   make(chan time.Time, burstSize),
		burstSize: burstSize,
		duration:  duration,
	}

	b.start()

	return b
}

// Wait for d amount of time for an opportunity to make a request.
// If Wait returns true, it's ok to make the request.  If Wait returns
// false, it's not ok.
func (b *BurstLimiter) Wait(d time.Duration) (ok bool) {
	select {
	case <-b.limiter:
		b.g.Log.Debug("BurstLimiter: got request from limiter")
		return true
	case <-time.After(d * CITimeMultiplier(b.g)):
		b.g.Log.Debug("BurstLimiter: timed out getting request from limiter")
		return false
	}
}

// WaitShort is a convenience function to wait for a short amount of time.
func (b *BurstLimiter) WaitShort() (ok bool) {
	return b.Wait(5 * time.Millisecond)
}

func (b *BurstLimiter) Stop() {
	b.ticker.Stop()
}

func (b *BurstLimiter) start() {
	for i := 0; i < b.burstSize; i++ {
		b.limiter <- time.Now()
	}
	b.ticker = time.NewTicker(b.duration)
	go b.tick()
}

func (b *BurstLimiter) tick() {
	for t := range b.ticker.C {
		b.limiter <- t
		b.g.Log.Debug("BurstLimiter: added %v to limiter", t)
	}
}
