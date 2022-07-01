package libkbfs

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/base64"
	"fmt"
	"runtime/pprof"
	"sync"
	"sync/atomic"
	"time"

	"github.com/keybase/client/go/logger"
	"golang.org/x/time/rate"
)

type ctxTimeTracker struct {
	ctx       context.Context
	expiresAt time.Time

	done int32
}

func (c *ctxTimeTracker) markDone() {
	atomic.StoreInt32(&c.done, 1)
}

func (c *ctxTimeTracker) isDone() bool {
	return atomic.LoadInt32(&c.done) == 1
}

func (c *ctxTimeTracker) isExpired(clock Clock) bool {
	return clock.Now().After(c.expiresAt)
}

type ctxTimeTrackerListNode struct {
	tracker *ctxTimeTracker
	next    *ctxTimeTrackerListNode
}

type ctxTimeTrackerList struct {
	front *ctxTimeTrackerListNode
	tail  *ctxTimeTrackerListNode
}

func (c *ctxTimeTrackerList) peekFront() (t *ctxTimeTracker) {
	if c.front == nil {
		return nil
	}
	return c.front.tracker
}

func (c *ctxTimeTrackerList) popFront() (t *ctxTimeTracker) {
	if c.front == nil {
		return nil
	}
	t = c.front.tracker
	c.front = c.front.next
	if c.front == nil {
		// last one!
		c.tail = nil
	}
	return t
}

func (c *ctxTimeTrackerList) append(t *ctxTimeTracker) {
	newNode := &ctxTimeTrackerListNode{
		tracker: t,
	}
	if c.tail != nil {
		c.tail.next = newNode
	}
	c.tail = newNode
	if c.front == nil {
		c.front = newNode
	}
}

// ImpatientDebugDumper dumps all running goroutines if an operation takes
// longer than a preset value. User of this type should call Begin() with a
// context associated with an operation, and call the returned function when
// the operation is done. If the operation finishes within the preset duration,
// nothing is dumped into log. Despite being impatient, it tries not to pollute
// the log too much by rate limit goroutine dumping based on
// impatientDebugDumperDumpMinInterval (at most 1 per minute).
type ImpatientDebugDumper struct {
	config Config
	log    logger.Logger
	dumpIn time.Duration

	ticker         *time.Ticker
	limiter        *rate.Limiter
	shutdownFunc   func()
	shutdownDoneCh chan struct{}

	lock                         sync.Mutex
	chronologicalTimeTrackerList *ctxTimeTrackerList
}

const impatientDebugDumperCheckInterval = time.Second
const impatientDebugDumperDumpMinInterval = time.Minute // 1 dump per min max

// NewImpatientDebugDumper creates a new *ImpatientDebugDumper, which logs with
// a logger made by config.MakeLogger("IGD"), and dumps goroutines if an
// operation takes longer than dumpIn.
func NewImpatientDebugDumper(config Config, dumpIn time.Duration) *ImpatientDebugDumper {
	ctx, cancel := context.WithCancel(context.Background())
	d := &ImpatientDebugDumper{
		config: config,
		log:    config.MakeLogger("IGD"),
		dumpIn: dumpIn,
		ticker: time.NewTicker(impatientDebugDumperCheckInterval),
		limiter: rate.NewLimiter(
			rate.Every(impatientDebugDumperDumpMinInterval), 1),
		shutdownFunc:                 cancel,
		shutdownDoneCh:               make(chan struct{}),
		chronologicalTimeTrackerList: &ctxTimeTrackerList{},
	}
	go d.dumpLoop(ctx.Done())
	return d
}

// NewImpatientDebugDumperForForcedDumps creates a new
// *ImpatientDebugDumper, just as above, though without launching any
// background goroutines or allowing the user to begin any
// time-tracked tasks.  `ForceDump` is the only way to obtain a dump
// from a dumper constructed with this function.
func NewImpatientDebugDumperForForcedDumps(config Config) *ImpatientDebugDumper {
	return &ImpatientDebugDumper{
		config: config,
		log:    config.MakeLogger("IGD"),
		limiter: rate.NewLimiter(
			rate.Every(impatientDebugDumperDumpMinInterval), 1),
	}
}

func (d *ImpatientDebugDumper) dump(ctx context.Context) {
	if !d.limiter.Allow() {
		// Use a limiter to avoid dumping too much into log accidently.
		return
	}
	buf := &bytes.Buffer{}
	base64er := base64.NewEncoder(base64.StdEncoding, buf)
	gzipper := gzip.NewWriter(base64er)
	for _, p := range pprof.Profiles() {
		fmt.Fprintf(gzipper,
			"\n======== START Profile: %s ========\n\n", p.Name())
		_ = p.WriteTo(gzipper, 2)
		fmt.Fprintf(gzipper,
			"\n======== END   Profile: %s ========\n\n", p.Name())
	}
	gzipper.Close()
	base64er.Close()
	d.log.CDebugf(ctx,
		"Operation exceeded max wait time. dump>gzip>base64: %q "+
			"Pipe the quoted content into ` | base64 -d | gzip -d ` "+
			"to read as a Homosapien.", buf.String())
}

// ForceDump dumps all debug info to the log, if it hasn't done so
// recently according to the rate-limiter.
func (d *ImpatientDebugDumper) ForceDump(ctx context.Context) {
	d.dump(ctx)
}

func (d *ImpatientDebugDumper) dumpTick() {
	d.lock.Lock()
	defer d.lock.Unlock()
	for {
		// In each iteration we deal with the front of list:
		//  1) If list is empty, we just return and wait for the next tick;
		//  2) If front is done, pop front from the list, and continue into
		//     next iteration to check next one;
		//  3) If front is not done but expired, dump routines (if rate limiter
		//     permits), pop front from the list, and continue into next
		//     iteration to check next one;
		//  4) If front is not done yet nor expired, just return and wait for
		//     next tick when we check again.
		//
		// Since we either move on or return, there's no risk of infinite
		// looping here.
		t := d.chronologicalTimeTrackerList.peekFront()
		if t == nil {
			return
		}
		if t.isDone() {
			// This operation is done, so just move on.
			d.chronologicalTimeTrackerList.popFront()
			continue
		}
		if t.isExpired(d.config.Clock()) {
			// This operation isn't done, and it has expired. So dump debug
			// information and move on.
			d.dump(t.ctx)
			d.chronologicalTimeTrackerList.popFront()
			continue
		}
		// This operation isn't done yet, but it also hasn't expired. So
		// just return and wait for next tick and check again.
		return
	}
}

func (d *ImpatientDebugDumper) dumpLoop(shutdownCh <-chan struct{}) {
	defer close(d.shutdownDoneCh)
	for {
		select {
		case <-d.ticker.C:
			d.dumpTick()
		case <-shutdownCh:
			d.ticker.Stop()
			d.log.Debug("shutdown")
			return
		}
	}
}

// Begin causes d to start tracking time for ctx. The returned function should
// be called once the associated operation is done, likely in a defer
// statement.
func (d *ImpatientDebugDumper) Begin(ctx context.Context) (done func()) {
	if d.chronologicalTimeTrackerList == nil {
		return nil
	}
	tracker := &ctxTimeTracker{
		ctx:       ctx,
		expiresAt: d.config.Clock().Now().Add(d.dumpIn),
	}
	d.lock.Lock()
	defer d.lock.Unlock()
	d.chronologicalTimeTrackerList.append(tracker)
	return tracker.markDone
}

// Shutdown shuts down d idempotently.
func (d *ImpatientDebugDumper) Shutdown() {
	if d.shutdownFunc != nil {
		d.shutdownFunc()
		<-d.shutdownDoneCh
	}
}
