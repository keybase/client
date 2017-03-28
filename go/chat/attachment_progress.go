package chat

import "time"

// desktop requested 1 update per second:
const durationBetweenUpdates = 1 * time.Second

type ProgressReporter func(bytesCompleted, bytesTotal int)

type progressWriter struct {
	complete       int
	total          int
	lastReport     int
	lastReportTime time.Time
	progress       ProgressReporter
}

func newProgressWriter(p ProgressReporter, size int) *progressWriter {
	return &progressWriter{progress: p, total: size}
}

func (p *progressWriter) Write(data []byte) (n int, err error) {
	n = len(data)
	p.complete += n
	p.report()
	return n, nil
}

func (p *progressWriter) Update(n int) {
	p.complete += n
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

func (p *progressWriter) Finish() {
	if p.progress == nil {
		return
	}
	p.progress(p.total, p.total)
}
