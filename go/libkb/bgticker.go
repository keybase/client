package libkb

import (
	"context"
	"time"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/clockwork"
)

const (
	stateIdle = iota
	stateActive
	stateExpired
)

const defaultResumeWait = time.Second

type BgTicker struct {
	Contextified

	C          <-chan time.Time
	c          chan time.Time
	duration   time.Duration
	state      int
	startedAt  time.Time
	resumeWait time.Duration
	t          *time.Timer
	fn         func()

	// For testing
	clock      clockwork.Clock
	appStateCh chan struct{}
}

func NewBgTicker(g *GlobalContext, d time.Duration) *BgTicker {
	c := make(chan time.Time, 1)
	t := &BgTicker{
		Contextified: NewContextified(g),
		duration:     d,
		C:            c,
		c:            c,
		resumeWait:   defaultResumeWait,
		clock:        clockwork.NewRealClock(),
	}

	t.fn = func() {
		t.c <- t.clock.Now()
		t.t = time.AfterFunc(t.duration, t.fn)
	}
	go t.monitorAppState()
	return t
}

func (t *BgTicker) SetClock(clock clockwork.Clock) {
	t.clock = clock
}

// Pause pauses current timer until Start method is be called.
// Next Start call will wait rest of duration + resumeWait.
func (t *BgTicker) Pause() bool {
	if t.state != stateActive {
		return false
	}
	if !t.t.Stop() {
		t.state = stateExpired
		return false
	}
	t.state = stateIdle
	dur := time.Now().Sub(t.startedAt)
	t.duration = t.duration - dur + t.resumeWait
	return true
}

// Start starts BgTicker that will send the current time on its channel after
// at least duration d.
func (t *BgTicker) Start() bool {
	if t.state != stateIdle {
		return false
	}
	t.startedAt = t.clock.Now()
	t.state = stateActive
	t.t = time.AfterFunc(t.duration, t.fn)
	return true
}

// Stop prevents the BgTicker from firing. It returns true if the call stops
// the timer, false if the timer has already expired or been stopped.
// Stop does not close the channel, to prevent a read from the channel
// succeeding incorrectly.
func (t *BgTicker) Stop() bool {
	if t.state != stateActive {
		return false
	}
	t.startedAt = t.clock.Now()
	t.state = stateExpired
	t.t.Stop()
	return true
}

// Monitor the AppState and pause the ticker if the app goes to the background.
func (t *BgTicker) monitorAppState() {
	ctx := context.Background()
	paused := false
	t.G().Log.CDebugf(ctx, "monitorAppState: starting up")
	state := keybase1.AppState_FOREGROUND
	for {
		state = <-t.G().AppState.NextUpdate(&state)
		switch state {
		case keybase1.AppState_FOREGROUND:
			t.G().Log.CDebugf(ctx, "monitorAppState: foregrounded")
			// Only resume if we had paused earlier (frontend can spam us with these)
			if paused {
				t.G().Log.CDebugf(ctx, "monitorAppState: resuming ticker")
				t.Start()
				paused = false
			}
		case keybase1.AppState_BACKGROUND:
			t.G().Log.CDebugf(ctx, "monitorAppState: backgrounded, pausing ticker")
			if !paused {
				t.Pause()
				paused = true
			}
		}
		if t.appStateCh != nil {
			t.appStateCh <- struct{}{}
		}
	}
}
