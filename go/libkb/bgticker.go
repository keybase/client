package libkb

import (
	"time"
)

type BgTicker struct {
	C          <-chan time.Time
	c          chan time.Time
	ticker     *time.Ticker
	resumeWait time.Duration
}

func NewBgTicker(duration time.Duration, wait time.Duration) *BgTicker {
	return NewBgTickerWithWait(duration, 10*time.Second)
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
