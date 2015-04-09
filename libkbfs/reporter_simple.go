package libkbfs

import (
	"fmt"
	"time"
)

type ReporterSimple struct {
	lastError fmt.Stringer
	etime     time.Time
}

func (r *ReporterSimple) Report(level ReportingLevel, message fmt.Stringer) {
	if level >= RptE {
		r.lastError = message
		r.etime = time.Now()
	}
}

func (r *ReporterSimple) LastError() (string, *time.Time) {
	if r.lastError == nil {
		return "", nil
	} else {
		return r.lastError.String(), &r.etime
	}
}
