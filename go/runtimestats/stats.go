package runtimestats

import (
	"context"
	"sync"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/utils"
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

func (r *Runner) Start(ctx context.Context) {
	defer r.G().CTrace(ctx, "Start", func() error { return nil })()
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
	defer r.G().CTrace(ctx, "Stop", func() error { return nil })()
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
	for {
		select {
		case <-time.After(4 * time.Second):
			r.updateStats()
		case <-stopCh:
			return nil
		}
	}
}

func (r *Runner) updateStats() {
	stats := GetStats()
	r.G().Log.Debug("STATS: CPU: %.2f%% RES: %s", float64(stats.TotalCPU)/100.0,
		utils.PresentBytes(stats.TotalResident))
}

type statsResult struct {
	TotalCPU      int
	TotalResident int64
}
