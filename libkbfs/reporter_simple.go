package libkbfs

import (
	"fmt"
	"sync"
	"time"
)

// ReporterSimple remembers the last maxErrors errors, or all errors
// if maxErrors < 1.
type ReporterSimple struct {
	maxErrors      int
	currErrorIndex int
	filledOnce     bool
	// errors is a circular buffer when maxErrors >= 1
	errors []ReportedError
	lock   sync.RWMutex // protects everything
}

// NewReporterSimple creates a new ReporterSimple.
func NewReporterSimple(maxErrors int) *ReporterSimple {
	rs := &ReporterSimple{
		maxErrors:      maxErrors,
		currErrorIndex: -1,
	}

	if maxErrors >= 1 {
		rs.errors = make([]ReportedError, maxErrors)
	}

	return rs
}

// Report implements the Reporter interface for ReporterSimple.
func (r *ReporterSimple) Report(level ReportingLevel, message fmt.Stringer) {
	r.lock.Lock()
	defer r.lock.Unlock()

	if level >= RptE {
		re := ReportedError{
			Level: level,
			Time:  time.Now(),
			Error: message,
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
