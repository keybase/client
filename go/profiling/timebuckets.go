package profiling

import (
	"sync"
	"time"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/clockwork"
	"golang.org/x/net/context"
)

type ctxKeyType string

var ctxKey = ctxKeyType("timebuckets")

type TimeBuckets struct {
	sync.Mutex
	clock clockwork.Clock
	log   logger.Logger
	times map[string]time.Duration
}

func NewTimeBuckets(clock clockwork.Clock, log logger.Logger) *TimeBuckets {
	return &TimeBuckets{
		clock: clock,
		log:   log,
		times: make(map[string]time.Duration),
	}
}

func (t *TimeBuckets) Record(bucketName string) finFn {
	start := t.clock.Now()
	return func() {
		duration := t.clock.Since(start)
		t.Lock()
		defer t.Unlock()
		t.times[bucketName] += duration
	}
}

func (t *TimeBuckets) Get(bucketName string) time.Duration {
	t.Lock()
	defer t.Unlock()
	return t.times[bucketName]
}

func (t *TimeBuckets) Log(ctx context.Context, bucketName string) {
	t.log.CDebugf(ctx, "%s [time=%s]", bucketName, t.Get(bucketName))
}

type finFn func()

func WithTimeBuckets(ctx context.Context, clock clockwork.Clock, log logger.Logger) (context.Context, *TimeBuckets) {
	v, ok := ctx.Value(ctxKey).(*TimeBuckets)
	if ok && v != nil {
		return ctx, v
	}
	buckets := NewTimeBuckets(clock, log)
	ctx = context.WithValue(ctx, ctxKey, buckets)
	return ctx, buckets
}
