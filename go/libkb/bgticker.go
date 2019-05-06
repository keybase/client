package libkb

import (
	"time"
)

const DefaultBgTickerWait = 5 * time.Second

type BgTicker struct {
	C          <-chan time.Time
	c          chan time.Time
	ticker     *time.Ticker
	resumeWait time.Duration
}

// This ticker wrap's Go's time.Ticker to wait a given time.Duration before
// firing. This is helpful to not overload the mobile apps when they are
// brought to the foreground and all have tasks that are ready to fire.

// NewBgTicker will panic if wait > duration as time.Ticker does with a
// negative duration.
func NewBgTicker(duration time.Duration) *BgTicker {
	return NewBgTickerWithWait(duration, DefaultBgTickerWait)
}

func NewBgTickerWithWait(duration time.Duration, wait time.Duration) *BgTicker {
	c := make(chan time.Time, 1)
	t := &BgTicker{
		C:          c,
		c:          c,
		ticker:     time.NewTicker(duration - wait),
		resumeWait: wait,
	}
	go t.tick()
	return t
}

func (t *BgTicker) tick() {
	for {
		select {
		case c := <-t.ticker.C:
			time.Sleep(t.resumeWait)
			t.c <- c
		}
	}
}

func (t *BgTicker) Stop() {
	t.ticker.Stop()
}
