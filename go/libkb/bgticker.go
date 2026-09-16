package libkb

import (
	"sync"
	"time"
)

const DefaultBgTickerWait = 5 * time.Second

type BgTicker struct {
	C          <-chan time.Time
	c          chan time.Time
	ticker     *time.Ticker
	resumeWait time.Duration
	done       chan struct{}
	stopOnce   sync.Once
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
		done:       make(chan struct{}),
	}
	go t.tick()
	return t
}

// tick ends on Stop: a stopped time.Ticker never closes its channel, and
// nobody may be left to read C.
func (t *BgTicker) tick() {
	for {
		var c time.Time
		select {
		case c = <-t.ticker.C:
		case <-t.done:
			return
		}
		wait := time.NewTimer(RandomJitter(t.resumeWait))
		select {
		case <-wait.C:
		case <-t.done:
			wait.Stop()
			return
		}
		select {
		case t.c <- c:
		case <-t.done:
			return
		}
	}
}

func (t *BgTicker) Stop() {
	t.ticker.Stop()
	t.stopOnce.Do(func() { close(t.done) })
}
