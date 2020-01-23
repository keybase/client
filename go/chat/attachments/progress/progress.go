package progress

import (
	"time"

	"github.com/keybase/client/go/chat/types"
)

// desktop requested 1 update per second:
const durationBetweenUpdates = 1 * time.Second

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
	percent := (100 * p.complete) / p.total
	if percent <= p.lastReport {
		return
	}
	now := time.Now()
	if now.Sub(p.lastReportTime) < p.updateDuration {
		return
	}

	if p.progress != nil {
		p.progress(p.complete, p.total)
	}

	p.lastReport = percent
	p.lastReportTime = now
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
