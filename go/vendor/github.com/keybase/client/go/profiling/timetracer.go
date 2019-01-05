package profiling

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/clockwork"
)

type TimeTracer interface {
	Stage(format string, args ...interface{})
	Finish()
}

type TimeTracerImpl struct {
	sync.Mutex
	ctx    context.Context
	log    logger.Logger
	clock  clockwork.Clock
	label  string
	stage  string
	staged bool      // whether any stages were used
	start  time.Time // when the tracer started
	prev   time.Time // when the active stage started
}

func NewTimeTracer(ctx context.Context, log logger.Logger, clock clockwork.Clock, label string) TimeTracer {
	now := clock.Now()
	log.CDebugf(ctx, "+ %s", label)
	return &TimeTracerImpl{
		ctx:    ctx,
		log:    log,
		clock:  clock,
		label:  label,
		stage:  "init",
		staged: false,
		start:  now,
		prev:   now,
	}
}

func (t *TimeTracerImpl) finishStage() {
	t.log.CDebugf(t.ctx, "| %s:%s [time=%s]", t.label, t.stage, t.clock.Since(t.prev))
}

func (t *TimeTracerImpl) Stage(format string, args ...interface{}) {
	t.Lock()
	defer t.Unlock()
	t.finishStage()
	t.stage = fmt.Sprintf(format, args...)
	t.prev = t.clock.Now()
	t.staged = true
}

func (t *TimeTracerImpl) Finish() {
	t.Lock()
	defer t.Unlock()
	if t.staged {
		t.finishStage()
	}
	t.log.CDebugf(t.ctx, "- %s [time=%s]", t.label, t.clock.Since(t.start))
}

type SilentTimeTracer struct{}

func NewSilentTimeTracer() *SilentTimeTracer {
	return &SilentTimeTracer{}
}

func (t *SilentTimeTracer) Stage(format string, args ...interface{}) {}

func (t *SilentTimeTracer) Finish() {}
