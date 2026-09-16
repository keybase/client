// Copyright 2026 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// Package lifecycletest replays native lifecycle event sequences against a
// lifecycle.Controller and records what an app-state consumer observes. It
// doesn't import libkb, so libkb's own tests can use it too.
package lifecycletest

import (
	"sync"
	"testing"
	"time"

	"github.com/keybase/client/go/protocol/keybase1"
)

// Source is what an app-state consumer watches; *libkb.MobileAppState
// implements it.
type Source interface {
	State() keybase1.MobileAppState
	NextUpdate(lastState keybase1.MobileAppState) <-chan struct{}
}

// Recorder watches a Source the way consumers do: it seeds from State() and
// wakes on NextUpdate. Like any consumer it can miss a state that is replaced
// before it wakes, so call Sync at quiescent points to observe every change.
type Recorder struct {
	src    Source
	mu     sync.Mutex
	states []keybase1.MobileAppState
	stop   chan struct{}
	done   chan struct{}
}

func NewRecorder(src Source) *Recorder {
	r := &Recorder{
		src:  src,
		stop: make(chan struct{}),
		done: make(chan struct{}),
	}
	state := src.State()
	r.states = []keybase1.MobileAppState{state}
	go r.loop(state)
	return r
}

func (r *Recorder) loop(state keybase1.MobileAppState) {
	defer close(r.done)
	for {
		select {
		case <-r.src.NextUpdate(state):
		case <-r.stop:
			return
		}
		state = r.src.State()
		r.mu.Lock()
		if r.states[len(r.states)-1] != state {
			r.states = append(r.states, state)
		}
		r.mu.Unlock()
	}
}

// Stop ends the recording and waits for the watcher goroutine to exit.
func (r *Recorder) Stop() {
	select {
	case <-r.stop:
	default:
		close(r.stop)
	}
	<-r.done
}

// States returns the observed states, starting with the seed. Consecutive
// entries always differ.
func (r *Recorder) States() []keybase1.MobileAppState {
	r.mu.Lock()
	defer r.mu.Unlock()
	return append([]keybase1.MobileAppState(nil), r.states...)
}

func (r *Recorder) Last() keybase1.MobileAppState {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.states[len(r.states)-1]
}

// Teardowns counts observed entries into BACKGROUND after the seed: the only
// state in which network and servers go down.
func (r *Recorder) Teardowns() int {
	n := 0
	for _, s := range r.States()[1:] {
		if s == keybase1.MobileAppState_BACKGROUND {
			n++
		}
	}
	return n
}

// Sync waits until the recorder has observed the source's current state.
// Only meaningful while nothing else is updating the state.
func (r *Recorder) Sync(t testing.TB) {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for r.Last() != r.src.State() {
		if time.Now().After(deadline) {
			t.Fatalf("recorder stuck at %v, state is %v", r.Last(), r.src.State())
		}
		time.Sleep(time.Millisecond)
	}
}
