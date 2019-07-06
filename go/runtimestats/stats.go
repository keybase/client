package runtimestats

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/sync/errgroup"
)

type Runner struct {
	globals.Contextified
	sync.Mutex

	started bool
	stopCh  chan struct{}
	eg      errgroup.Group
}

func NewRunner(g *globals.Context) *Runner {
	return &Runner{
		Contextified: globals.NewContextified(g),
	}
}

func (r *Runner) debug(ctx context.Context, msg string, args ...interface{}) {
	r.G().Log.CDebugf(ctx, "RuntimeStats.Runner: %s", fmt.Sprintf(msg, args...))
}

func (r *Runner) Start(ctx context.Context) {
	defer r.G().CTrace(ctx, "Runner.Start", func() error { return nil })()
	r.Lock()
	defer r.Unlock()
	if r.started {
		return
	}
	r.stopCh = make(chan struct{})
	r.started = true
	r.eg.Go(func() error { return r.statsLoop(r.stopCh) })
	r.G().PushShutdownHook(func() error {
		<-r.Stop(context.Background())
		return nil
	})
}

func (r *Runner) Stop(ctx context.Context) chan struct{} {
	defer r.G().CTrace(ctx, "Runner.Stop", func() error { return nil })()
	r.Lock()
	defer r.Unlock()
	ch := make(chan struct{})
	if r.started {
		close(r.stopCh)
		r.started = false
		go func() {
			r.eg.Wait()
			close(ch)
		}()
	} else {
		close(ch)
	}
	return ch
}

func (r *Runner) statsLoop(stopCh chan struct{}) error {
	ctx := context.Background()
	for {
		select {
		case <-time.After(4 * time.Second):
			r.updateStats(ctx)
		case <-stopCh:
			return nil
		}
	}
}

func (r *Runner) updateStats(ctx context.Context) {
	stats := GetStats().Export()
	r.G().NotifyRouter.HandleRuntimeStatsUpdate(ctx, stats)
	r.debug(ctx, "update: %+v", stats)
}

type statsResult struct {
	TotalCPU      int
	TotalResident int64
}

func (r statsResult) Export() keybase1.RuntimeStats {
	return keybase1.RuntimeStats{
		Cpu:      fmt.Sprintf("%.2f%%", float64(r.TotalCPU)/100.0),
		Resident: utils.PresentBytes(r.TotalResident),
	}
}
