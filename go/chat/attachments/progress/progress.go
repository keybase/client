package progress

import (
	"time"

	"github.com/keybase/client/go/chat/types"
)

// desktop requested 1 update per second:
const durationBetweenUpdates = 1 * time.Second
const maxDurationBetweenUpdates = 1 * time.Second

type ProgressWriter struct {
	complete       int64
	total          int64
	lastReport     int64
	lastReportTime time.Time
	updateDuration time.Duration
	progress       types.ProgressReporter
}

func NewProgressWriter(p types.ProgressReporter, size int64) *ProgressWriter {
	return NewProgressWriterWithUpdateDuration(p, size, durationBetweenUpdates)
}

func NewProgressWriterWithUpdateDuration(p types.ProgressReporter, size int64, ud time.Duration) *ProgressWriter {
	pw := &ProgressWriter{progress: p, total: size, updateDuration: ud}
	pw.initialReport()
	return pw
}

func (p *ProgressWriter) Write(data []byte) (n int, err error) {
	n = len(data)
	p.complete += int64(n)
	p.report()
	return n, nil
}

func (p *ProgressWriter) Update(n int) {
	p.complete += int64(n)
	p.report()
}

func (p *ProgressWriter) report() {
	now := time.Now()
	dur := now.Sub(p.lastReportTime)

	// if it has been longer than maxDurationBetweenUpdates,
	// then send an update regardless
	if dur >= maxDurationBetweenUpdates {
		p.notify(now)
		return
	}

	// if the percentage hasn't changed, then don't update.
	if p.percent() <= p.lastReport {
		return
	}

	// if it has been less than p.updateDuration since last
	// report, then don't do anything.
	if dur < p.updateDuration {
		return
	}

	p.notify(now)
}

func (p *ProgressWriter) notify(now time.Time) {
	if p.progress != nil {
		p.progress(p.complete, p.total)
	}
	p.lastReport = p.percent()
	p.lastReportTime = now
}

func (p *ProgressWriter) percent() int64 {
	if p.total == 0 {
		return 0
	}
	return (100 * p.complete) / p.total
}

// send 0% progress
func (p *ProgressWriter) initialReport() {
	if p.progress == nil {
		return
	}

	p.progress(0, p.total)
}

func (p *ProgressWriter) Finish() {
	if p.progress == nil {
		return
	}
	p.progress(p.total, p.total)
}
