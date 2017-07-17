// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"time"
)

// SimpleTimer keeps track of how long something is taking, like a network
// API call. Meant to be very simple.  It is not meant to be goroutine safe
// and should only be called from one Goroutine.
type SimpleTimer struct {
	total time.Duration
	start *time.Time
}

// Start the timer running, if it's not already started.
func (s *SimpleTimer) Start() {
	if s.start == nil {
		tmp := time.Now()
		s.start = &tmp
	}
}

// Stop the timer; panic if it hasn't been previously started.  Return
// the total duration spent in the timer.
func (s *SimpleTimer) Stop() time.Duration {
	if s.start != nil {
		s.total += time.Since(*s.start)
	} else {
		panic("SimpleTimer Stop()'ed without being started")
	}
	return s.GetTotal()
}

// GetTotal gets the total duration spent in the timer.
func (s *SimpleTimer) GetTotal() time.Duration {
	return s.total
}

// Reset the internal duration counter.
func (s *SimpleTimer) Reset() {
	s.total = 0
}

// ReportingTimer is an interface shared between ReportingTimerReal
// and ReportingTimerDummy, to allow for convenient disabling of timer features.
type ReportingTimer interface {
	Report(prefix string)
}

// ReportingTimerReal is a SimpleTimer that reports after the timing measurement
// is done.
type ReportingTimerReal struct {
	SimpleTimer
	Contextified
}

// NewReportingTimerReal returns an initialized reporting timer that
// actually reports timing information.
func NewReportingTimerReal(ctx Contextified) *ReportingTimerReal {
	return &ReportingTimerReal{Contextified: ctx}
}

// Report stops and resets the timer, then logs to Info what the duration was.
func (r *ReportingTimerReal) Report(prefix string) {
	dur := r.Stop()
	r.Reset()
	r.G().Log.Info("timer: %s [%d ms]", prefix, dur/time.Millisecond)
}

// ReportingTimerDummy fulfills the ReportingTimer interface but doesn't
// do anything when done.
type ReportingTimerDummy struct{}

// Report is a noop.
func (r ReportingTimerDummy) Report(prefix string) {}

// TimerSelector allows us to select which timers we want on.
type TimerSelector int

const (
	// TimerNone means Timers Disabled
	TimerNone TimerSelector = 0
	// TimerAPI enables API timers
	TimerAPI TimerSelector = 1 << iota
	// TimerXAPI enables External API timers
	TimerXAPI
	// TimerRPC enables RPC timers
	TimerRPC
)

// TimerSet is the set of currently active timers
type TimerSet struct {
	sel TimerSelector
	Contextified
}

// NewTimerSet looks into the given context for configuration information
// about how to set up timers.  It then returns the corresponding TimerSet.
func NewTimerSet(g *GlobalContext) *TimerSet {
	s := g.Env.GetTimers()
	sel := TimerNone
	for _, c := range s {
		switch c {
		case 'a':
			sel |= TimerAPI
		case 'x':
			sel |= TimerXAPI
		case 'r':
			sel |= TimerRPC

		}
	}
	return &TimerSet{sel: sel, Contextified: Contextified{g}}
}

// Start alloates and starts a new timer if the passed TimerSelector
// is currently enabled.  Otherwise, it just returns a Dummy timer.
func (s TimerSet) Start(sel TimerSelector) ReportingTimer {
	var ret ReportingTimer
	if s.sel&sel == sel {
		tmp := NewReportingTimerReal(s.Contextified)
		tmp.Start()
		ret = tmp
	} else {
		ret = ReportingTimerDummy{}
	}
	return ret
}
