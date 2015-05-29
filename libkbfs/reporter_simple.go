package libkbfs

import (
	"fmt"
	"time"
)

// ReporterSimple only remembers the last reported error, in memory.
type ReporterSimple struct {
	lastError fmt.Stringer
	etime     time.Time
}

// Report implements the Reporter interface for ReporterSimple.
func (r *ReporterSimple) Report(level ReportingLevel, message fmt.Stringer) {
	if level >= RptE {
		r.lastError = message
		r.etime = time.Now()
	}
}

// LastError implements the Reporter interface for ReporterSimple.
func (r *ReporterSimple) LastError() (string, *time.Time) {
	if r.lastError == nil {
		return "", nil
	}
	return r.lastError.String(), &r.etime
}
