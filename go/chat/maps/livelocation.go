package maps

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"golang.org/x/sync/errgroup"
)

type locationTrack struct {
	stopCh   chan struct{}
	updateCh chan chat1.Coordinate

	convID             chat1.ConversationID
	msgID              chat1.MessageID
	watchID            chat1.LocationWatchID
	endTime            time.Time
	coords             []chat1.Coordinate
	getCurrentPosition bool
}

type LiveLocationTracker struct {
	globals.Contextified
	utils.DebugLabeler
	sync.Mutex

	uid       gregor1.UID
	eg        errgroup.Group
	trackers  map[chat1.LocationWatchID]*locationTrack
	lastCoord chat1.Coordinate
}

func NewLiveLocationTracker(g *globals.Context) *LiveLocationTracker {
	return &LiveLocationTracker{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "LiveLocationTracker", false),
		trackers:     make(map[chat1.LocationWatchID]*locationTrack),
	}
}

func (l *LiveLocationTracker) Start(ctx context.Context, uid gregor1.UID) {
	defer l.Trace(ctx, func() error { return nil }, "Stop")()
	l.Lock()
	defer l.Unlock()
	l.uid = uid
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

type nullChatUI struct {
	libkb.ChatUI
}

func (n nullChatUI) ChatWatchPosition(context.Context) (chat1.LocationWatchID, error) {
	return chat1.LocationWatchID(0), errors.New("no chat UI")
}

func (n nullChatUI) ChatClearWatch(context.Context, chat1.LocationWatchID) error {
	return nil
}

func (l *LiveLocationTracker) getChatUI(ctx context.Context) libkb.ChatUI {
	ui, err := l.G().UIRouter.GetChatUI()
	if err != nil || ui == nil {
		l.Debug(ctx, "getChatUI: no chat UI found: err: %s", err)
		return nullChatUI{}
	}
	return ui
}

func (l *LiveLocationTracker) updateMapUnfurl(ctx context.Context, convID chat1.ConversationID,
	msgID chat1.MessageID, watchID chat1.LocationWatchID, coords []chat1.Coordinate) (err error) {
	ctx = globals.ChatCtx(ctx, l.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, nil)
	defer l.Trace(ctx, func() error { return err }, "updateMapUnfurl: watchID: %d", watchID)()
	msg, err := l.G().ChatHelper.GetMessage(ctx, l.uid, convID, msgID, true, nil)
	if err != nil {
		return err
	}
	if !msg.IsValid() {
		return errors.New("invalid message")
	}
	mvalid := msg.Valid()
	if len(mvalid.Unfurls) > 1 {
		return fmt.Errorf("wrong number of unfurls: %d", len(mvalid.Unfurls))
	}
	if len(coords) == 0 {
		if !l.lastCoord.IsZero() {
			coords = append(coords, l.lastCoord)
		} else {
			return errors.New("no coordinates")
		}
	}
	first := coords[0]
	conv, err := utils.GetVerifiedConv(ctx, l.G(), l.uid, convID, types.InboxSourceDataSourceAll)
	if err != nil {
		return err
	}
	for unfurlMsgID := range mvalid.Unfurls {
		// delete the old unfurl first to make way for the new
		if err := l.G().ChatHelper.DeleteMsg(ctx, convID, conv.Info.TlfName, unfurlMsgID); err != nil {
			return err
		}
		break
	}
	// put in a fake new message with the first coord and a pointer to get all coords from here
	body := fmt.Sprintf("https://%s/?lat=%f&lon=%f&acc=%f&watchID=%d&cb=%s", types.MapsDomain,
		first.Lat, first.Lon, first.Accuracy, watchID, libkb.RandStringB64(3))
	mvalid.MessageBody = chat1.NewMessageBodyWithText(chat1.MessageText{
		Body: body,
	})
	l.G().Unfurler.UnfurlAndSend(ctx, l.uid, convID, chat1.NewMessageUnboxedWithValid(mvalid))
	return nil
}

func (l *LiveLocationTracker) tracker(t *locationTrack) error {
	ctx := context.Background()
	defer func() {
		l.getChatUI(ctx).ChatClearWatch(ctx, t.watchID)
		l.Lock()
		defer l.Unlock()
		delete(l.trackers, t.watchID)
	}()
	if !t.getCurrentPosition {
		if !l.lastCoord.IsZero() {
			t.coords = append(t.coords, l.lastCoord)
		}
		l.updateMapUnfurl(ctx, t.convID, t.msgID, t.watchID, t.coords)
	}
	for {
		select {
		case coord := <-t.updateCh:
			t.coords = append(t.coords, coord)
			if !t.getCurrentPosition {
				l.updateMapUnfurl(ctx, t.convID, t.msgID, t.watchID, t.coords)
			}
		case <-l.G().Clock().AfterTime(t.endTime):
			l.Debug(ctx, "tracker: live location complete: watchID: %s", t.watchID)
			if t.getCurrentPosition {
				l.updateMapUnfurl(ctx, t.convID, t.msgID, t.watchID, t.coords)
			}
			return nil
		case <-t.stopCh:
			return nil
		}
	}
}

func (l *LiveLocationTracker) GetCurrentPosition(ctx context.Context, convID chat1.ConversationID,
	msgID chat1.MessageID) {
	defer l.Trace(ctx, func() error { return nil }, "GetCurrentPosition")()
	watchID, err := l.getChatUI(ctx).ChatWatchPosition(ctx)
	if err != nil {
		l.Debug(ctx, "GetCurrentPosition: unable to watch position: %s", err)
		return
	}
	l.Lock()
	defer l.Unlock()
	t := &locationTrack{
		stopCh:             make(chan struct{}),
		updateCh:           make(chan chat1.Coordinate, 10),
		convID:             convID,
		msgID:              msgID,
		watchID:            watchID,
		endTime:            time.Now().Add(5 * time.Second),
		getCurrentPosition: true,
	}
	l.trackers[watchID] = t
	l.eg.Go(func() error { return l.tracker(t) })
}

func (l *LiveLocationTracker) StartTracking(ctx context.Context, convID chat1.ConversationID,
	msgID chat1.MessageID, endTime time.Time) {
	defer l.Trace(ctx, func() error { return nil }, "StartTracking")()
	watchID, err := l.getChatUI(ctx).ChatWatchPosition(ctx)
	if err != nil {
		l.Debug(ctx, "StartTracking: unable to watch position: %s", err)
		return
	}
	l.Lock()
	defer l.Unlock()
	t := &locationTrack{
		stopCh:   make(chan struct{}),
		updateCh: make(chan chat1.Coordinate, 50),
		convID:   convID,
		msgID:    msgID,
		watchID:  watchID,
		endTime:  endTime,
	}
	l.trackers[watchID] = t
	l.eg.Go(func() error { return l.tracker(t) })
}

func (l *LiveLocationTracker) LocationUpdate(ctx context.Context, coord chat1.Coordinate) {
	defer l.Trace(ctx, func() error { return nil }, "LocationUpdate")()
	l.Lock()
	defer l.Unlock()
	if l.lastCoord.Eq(coord) {
		l.Debug(ctx, "LocationUpdate: ignoring dup coordinate")
		return
	}
	l.lastCoord = coord
	for _, t := range l.trackers {
		select {
		case t.updateCh <- coord:
		default:
			l.Debug(ctx, "LocationUpdate: failed to push coordinate, queue full")
		}
	}
}

func (l *LiveLocationTracker) GetCoordinates(ctx context.Context, watchID chat1.LocationWatchID) (res []chat1.Coordinate) {
	defer l.Trace(ctx, func() error { return nil }, "GetCoordinates")()
	l.Lock()
	defer l.Unlock()
	if t, ok := l.trackers[watchID]; ok {
		// TODO: sample these
		res = t.coords
	}
	if len(res) == 0 {
		res = append(res, l.lastCoord)
	}
	return res
}
