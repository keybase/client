package maps

import (
	"context"
	"sync"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"golang.org/x/sync/errgroup"
)

type locationTrack struct {
	stopCh   chan struct{}
	updateCh chan chat1.Coordinate

	convID  chat1.ConversationID
	msgID   chat1.MessageID
	watchID chat1.LocationWatchID
	endTime time.Time
}

type LiveLocationTracker struct {
	globals.Contextified
	utils.DebugLabeler
	sync.Mutex

	eg       errgroup.Group
	trackers []locationTrack
}

func NewLiveLocationTracker(g *globals.Context) *LiveLocationTracker {
	return &LiveLocationTracker{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "LiveLocationTracker", false),
	}
}

func (l *LiveLocationTracker) Start(ctx context.Context, uid gregor1.UID) {
	defer l.Trace(ctx, func() error { return nil }, "Stop")()
}

func (l *LiveLocationTracker) Stop(ctx context.Context) chan struct{} {
	defer l.Trace(ctx, func() error { return nil }, "Stop")()
	l.Lock()
	defer l.Unlock()
	ch := make(chan struct{})
	for _, t := range l.trackers {
		close(t.stopCh)
	}
	go func() {
		l.eg.Wait()
		close(ch)
	}()
	return ch
}

func (l *LiveLocationTracker) updateMapUnfurl(ctx context.Context, convID chat1.ConversationID,
	msgID chat1.MessageID, coord chat1.Coordinate) {
	defer l.Trace(ctx, func() error { return nil }, "updateMapUnfurl: convID: %s msgID: %d",
		convID, msgID)()

}

func (l *LiveLocationTracker) tracker(t locationTrack) error {
	ctx := context.Background()
	for {
		select {
		case coord := <-t.updateCh:
			l.updateMapUnfurl(ctx, t.convID, t.msgID, coord)
		case <-l.G().Clock().AfterTime(t.endTime):
			l.Debug(ctx, "tracker: live location complete: convID: %s msgID: %d watchID: %s", t.convID,
				t.msgID, t.watchID)
			return nil
		case <-t.stopCh:
			return nil
		}
	}
}

func (l *LiveLocationTracker) StartTracking(ctx context.Context, convID chat1.ConversationID,
	msgID chat1.MessageID, watchID chat1.LocationWatchID, endTime time.Time) {
	defer l.Trace(ctx, func() error { return nil }, "StartTracking")()
	l.Lock()
	defer l.Unlock()
	t := locationTrack{
		stopCh:   make(chan struct{}),
		updateCh: make(chan chat1.Coordinate, 10),
		convID:   convID,
		msgID:    msgID,
		watchID:  watchID,
		endTime:  endTime,
	}
	l.trackers = append(l.trackers, t)
	l.eg.Go(func() error { return l.tracker(t) })
}

func (l *LiveLocationTracker) LocationUpdate(ctx context.Context, coord chat1.Coordinate) {
	defer l.Trace(ctx, func() error { return nil }, "LocationUpdate")()
	l.Lock()
	defer l.Unlock()
	for _, t := range l.trackers {
		select {
		case t.updateCh <- coord:
		default:
			l.Debug(ctx, "LocationUpdate: failed to push coordinate, queue full")
		}
	}
}
