package chat

type ProgressReporter func(bytesCompleted, bytesTotal int)

type progressWriter struct {
	complete   int
	total      int
	lastReport int
	progress   ProgressReporter
}

func newProgressWriter(p ProgressReporter, size int) *progressWriter {
	return &progressWriter{progress: p, total: size}
}

func (p *progressWriter) Write(data []byte) (n int, err error) {
	n = len(data)
	p.complete += n
	percent := (100 * p.complete) / p.total
	if percent > p.lastReport {
		if p.progress != nil {
			p.progress(p.complete, p.total)
		}
		p.lastReport = percent
	}
	return n, nil
}
