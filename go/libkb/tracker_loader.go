package libkb

import (
	"errors"
	"fmt"
	"sync"

	context "golang.org/x/net/context"
	"golang.org/x/sync/errgroup"
)

type TrackerLoader struct {
	Contextified
	sync.Mutex

	eg         errgroup.Group
	started    bool
	shutdownCh chan struct{}
	queueCh    chan struct{}
}

func NewTrackerLoader(g *GlobalContext) *TrackerLoader {
	l := &TrackerLoader{
		Contextified: NewContextified(g),
		shutdownCh:   make(chan struct{}),
		queueCh:      make(chan struct{}, 100),
	}
	g.PushShutdownHook(func() error {
		<-l.Shutdown(context.Background())
		return nil
	})
	return l
}

func (l *TrackerLoader) debug(ctx context.Context, msg string, args ...interface{}) {
	l.G().Log.CDebugf(ctx, "TrackerLoader: %s", fmt.Sprintf(msg, args...))
}

func (l *TrackerLoader) Run(ctx context.Context) {
	defer l.G().CTrace(ctx, "TrackerLoader.Run", func() error { return nil })()
	l.Lock()
	defer l.Unlock()
	if l.started {
		return
	}
	l.started = true
	l.shutdownCh = make(chan struct{})
	l.eg.Go(func() error { return l.loadLoop(l.shutdownCh) })
}

func (l *TrackerLoader) Shutdown(ctx context.Context) chan struct{} {
	defer l.G().CTrace(ctx, "TrackerLoader.Shutdown", func() error { return nil })()
	l.Lock()
	defer l.Unlock()
	ch := make(chan struct{})
	if l.started {
		close(l.shutdownCh)
		l.started = false
		go func() {
			l.eg.Wait()
			close(ch)
		}()
	} else {
		close(ch)
	}
	return ch
}

func (l *TrackerLoader) Queue(ctx context.Context) (err error) {
	defer l.G().CTrace(ctx, "TrackerLoader.Queue", func() error { return err })()
	select {
	case l.queueCh <- struct{}{}:
	default:
		return errors.New("queue full")
	}
	return nil
}

func (l *TrackerLoader) argsFromSyncer(syncer *Tracker2Syncer) (followers []string, followees []string) {
	res := syncer.Result()
	for _, u := range res.Users {
		if u.IsFollower {
			followers = append(followers, u.Username)
		}
		if u.IsFollowee {
			followees = append(followees, u.Username)
		}
	}
	return followers, followees
}

func (l *TrackerLoader) load(ctx context.Context) error {
	defer l.G().CTraceTimed(ctx, "TrackerLoader.load", func() error { return nil })()
	uid := l.G().ActiveDevice.UID()
	syncer := NewTracker2Syncer(l.G(), uid, true)
	mctx := NewMetaContext(ctx, l.G())

	// send up local copy first quickly
	if err := syncer.loadFromStorage(mctx, uid, false); err != nil {
		l.debug(ctx, "load: failed to load from local storage: %s", err)
	} else {
		// Notify with results
		followers, followees := l.argsFromSyncer(syncer)
		l.G().NotifyRouter.HandleTrackingInfo(uid, followers, followees)
	}

	// go get remote copy
	if err := syncer.syncFromServer(mctx, uid, false); err != nil {
		l.debug(ctx, "load: failed to load from server: %s", err)
		return err
	}
	followers, followees := l.argsFromSyncer(syncer)
	l.G().NotifyRouter.HandleTrackingInfo(uid, followers, followees)
	return nil
}

func (l *TrackerLoader) loadLoop(stopCh chan struct{}) error {
	ctx := context.Background()
	for {
		select {
		case <-l.queueCh:
			if err := l.load(ctx); err != nil {
				l.debug(ctx, "loadLoop: failed to load: %s", err)
			}
		case <-stopCh:
			return nil
		}
	}
}
