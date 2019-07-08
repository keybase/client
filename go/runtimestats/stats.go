package runtimestats

import (
	"context"
	"fmt"
	"runtime"
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
	if !r.G().Env.GetRuntimeStatsEnabled() {
		r.debug(ctx, "not starting, not enabled in env")
		return
	}
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
	r.updateStats(ctx)
	for {
		select {
		case <-time.After(4 * time.Second):
			r.updateStats(ctx)
		case <-stopCh:
			r.G().NotifyRouter.HandleRuntimeStatsUpdate(ctx, nil)
			return nil
		}
	}
}

func (r *Runner) updateStats(ctx context.Context) {
	var memstats runtime.MemStats
	stats := getStats().Export()
	runtime.ReadMemStats(&memstats)
	stats.Goheap = utils.PresentBytes(int64(memstats.HeapAlloc))
	stats.Goheapsys = utils.PresentBytes(int64(memstats.HeapSys))
	stats.Goreleased = utils.PresentBytes(int64(memstats.HeapReleased))
	stats.ConvLoaderActive = r.G().ConvLoader.IsActivelyLoading()
	stats.SelectiveSyncActive = r.G().Indexer.IsActivelySyncing()
	r.G().NotifyRouter.HandleRuntimeStatsUpdate(ctx, &stats)
	r.debug(ctx, "update: %+v", stats)
}

type statsResult struct {
	TotalCPU      int
	TotalResident int64
	TotalVirtual  int64
	TotalFree     int64
}

func (r statsResult) Export() keybase1.RuntimeStats {
	return keybase1.RuntimeStats{
		Cpu:              fmt.Sprintf("%.2f%%", float64(r.TotalCPU)/100.0),
		Resident:         utils.PresentBytes(r.TotalResident),
		Virt:             utils.PresentBytes(r.TotalVirtual),
		Free:             utils.PresentBytes(r.TotalFree),
		CpuSeverity:      r.cpuSeverity(),
		ResidentSeverity: r.residentSeverity(),
	}
}

func (r statsResult) cpuSeverity() keybase1.StatsSeverityLevel {
	if r.TotalCPU >= 10000 {
		return keybase1.StatsSeverityLevel_SEVERE
	} else if r.TotalCPU >= 6000 {
		return keybase1.StatsSeverityLevel_WARNING
	} else {
		return keybase1.StatsSeverityLevel_NORMAL
	}
}

func (r statsResult) residentSeverity() keybase1.StatsSeverityLevel {
	val := r.TotalResident / 1e6
	if val >= 900 {
		return keybase1.StatsSeverityLevel_SEVERE
	} else if val >= 700 {
		return keybase1.StatsSeverityLevel_WARNING
	} else {
		return keybase1.StatsSeverityLevel_NORMAL
	}
}
