package attachments

import (
	"time"

	"github.com/keybase/client/go/chat/types"
)

// desktop requested 1 update per second:
const durationBetweenUpdates = 1 * time.Second

type progressWriter struct {
	complete       int64
	total          int64
	lastReport     int64
	lastReportTime time.Time
	progress       types.ProgressReporter
}

func newProgressWriter(p types.ProgressReporter, size int64) *progressWriter {
	pw := &progressWriter{progress: p, total: size}
	pw.initialReport()
	return pw
}

func (p *progressWriter) Write(data []byte) (n int, err error) {
	n = len(data)
	p.complete += int64(n)
	p.report()
	return n, nil
}

func (p *progressWriter) Update(n int) {
	p.complete += int64(n)
	p.report()
}

func (p *progressWriter) report() {
	percent := (100 * p.complete) / p.total
	if percent <= p.lastReport {
		return
	}
	now := time.Now()
	if now.Sub(p.lastReportTime) < durationBetweenUpdates {
		return
	}

	if p.progress != nil {
		p.progress(p.complete, p.total)
	}

	p.lastReport = percent
	p.lastReportTime = now
}

// send 0% progress
func (p *progressWriter) initialReport() {
	if p.progress == nil {
		return
	}

	p.progress(0, p.total)
}

func (p *progressWriter) Finish() {
	if p.progress == nil {
		return
	}
	p.progress(p.total, p.total)
}
