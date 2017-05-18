// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"runtime"
	"sync"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/tlf"
)

// ReporterSimple remembers the last maxErrors errors, or all errors
// if maxErrors < 1.
type ReporterSimple struct {
	clock          Clock
	maxErrors      int
	currErrorIndex int
	filledOnce     bool
	// errors is a circular buffer when maxErrors >= 1
	errors []ReportedError
	lock   sync.RWMutex // protects everything
}

// NewReporterSimple creates a new ReporterSimple.
func NewReporterSimple(clock Clock, maxErrors int) *ReporterSimple {
	rs := &ReporterSimple{
		clock:          clock,
		maxErrors:      maxErrors,
		currErrorIndex: -1,
	}

	if maxErrors >= 1 {
		rs.errors = make([]ReportedError, maxErrors)
	}

	return rs
}

// ReportErr implements the Reporter interface for ReporterSimple.
func (r *ReporterSimple) ReportErr(ctx context.Context,
	_ CanonicalTlfName, _ tlf.Type, _ ErrorModeType, err error) {
	r.lock.Lock()
	defer r.lock.Unlock()

	stack := make([]uintptr, 20)
	n := runtime.Callers(2, stack)
	re := ReportedError{
		Time:  r.clock.Now(),
		Error: err,
		Stack: stack[:n],
	}
	r.currErrorIndex++
	if r.maxErrors < 1 {
		r.errors = append(r.errors, re)
	} else {
		if r.currErrorIndex == r.maxErrors {
			r.currErrorIndex = 0
			r.filledOnce = true
		}
		r.errors[r.currErrorIndex] = re
	}

}

// AllKnownErrors implements the Reporter interface for ReporterSimple.
func (r *ReporterSimple) AllKnownErrors() []ReportedError {
	r.lock.RLock()
	defer r.lock.RUnlock()

	if !r.filledOnce {
		// deep copy since r.errors shouldn't be read without the lock.
		errors := make([]ReportedError, r.currErrorIndex+1)
		copy(errors, r.errors[:r.currErrorIndex+1])
		return errors
	}

	errors := make([]ReportedError, r.maxErrors)
	s := r.currErrorIndex + 1
	t := r.maxErrors - s
	copy(errors[:t], r.errors[s:])
	copy(errors[t:], r.errors[:s])
	return errors
}

// Notify implements the Reporter interface for ReporterSimple.
func (r *ReporterSimple) Notify(_ context.Context, _ *keybase1.FSNotification) {
	// ignore notifications
}

// NotifySyncStatus implements the Reporter interface for ReporterSimple.
func (r *ReporterSimple) NotifySyncStatus(_ context.Context,
	_ *keybase1.FSPathSyncStatus) {
	// ignore notifications
}

// Shutdown implements the Reporter interface for ReporterSimple.
func (r *ReporterSimple) Shutdown() {

}
