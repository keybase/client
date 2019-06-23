package maps

import (
	"context"
	"crypto/sha1"
	"encoding/hex"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/storage"
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
	endTime            time.Time
	coords             []chat1.Coordinate
	getCurrentPosition bool
}

func (t *locationTrack) drain() {
	for {
		select {
		case coord := <-t.updateCh:
			t.coords = append(t.coords, coord)
		default:
			return
		}
	}
}

func (t *locationTrack) key() types.LiveLocationKey {
	hash := sha1.Sum([]byte(fmt.Sprintf("%s:%d", t.convID, t.msgID)))
	return types.LiveLocationKey(hex.EncodeToString(hash[:]))
}

func (t *locationTrack) toDisk() diskLocationTrack {
	return diskLocationTrack{
		ConvID:             t.convID,
		MsgID:              t.msgID,
		EndTime:            gregor1.ToTime(t.endTime),
		Coords:             t.coords,
		GetCurrentPosition: t.getCurrentPosition,
	}
}

func newLocationTrack(convID chat1.ConversationID, msgID chat1.MessageID,
	endTime time.Time, getCurrentPosition bool) *locationTrack {
	return &locationTrack{
		stopCh:             make(chan struct{}),
		updateCh:           make(chan chat1.Coordinate, 50),
		convID:             convID,
		msgID:              msgID,
		endTime:            endTime,
		getCurrentPosition: getCurrentPosition,
	}
}

func newLocationTrackFromDisk(d diskLocationTrack) *locationTrack {
	t := newLocationTrack(d.ConvID, d.MsgID, gregor1.FromTime(d.EndTime), d.GetCurrentPosition)
	t.coords = d.Coords
	return t
}

type LiveLocationTracker struct {
	globals.Contextified
	utils.DebugLabeler
	sync.Mutex

	storage        *trackStorage
	updateInterval time.Duration
	uid            gregor1.UID
	eg             errgroup.Group
	trackers       map[types.LiveLocationKey]*locationTrack
	lastCoord      chat1.Coordinate
}

func NewLiveLocationTracker(g *globals.Context) *LiveLocationTracker {
	return &LiveLocationTracker{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "LiveLocationTracker", false),

		storage:        newTrackStorage(g),
		trackers:       make(map[types.LiveLocationKey]*locationTrack),
		updateInterval: 30 * time.Second,
	}
}

func (l *LiveLocationTracker) Start(ctx context.Context, uid gregor1.UID) {
	defer l.Trace(ctx, func() error { return nil }, "Start")()
	l.Lock()
	defer l.Unlock()
	l.uid = uid
	l.restoreLocked(ctx)
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

func (l *LiveLocationTracker) ActivelyTracking(ctx context.Context) bool {
	l.Lock()
	defer l.Unlock()
	return len(l.trackers) > 0
}

func (l *LiveLocationTracker) saveLocked(ctx context.Context) {
	var trackers []*locationTrack
	for _, t := range l.trackers {
		trackers = append(trackers, t)
	}
	if err := l.storage.Save(ctx, trackers); err != nil {
		l.Debug(ctx, "save: failed to save: %s", err)
	}
}

func (l *LiveLocationTracker) restoreLocked(ctx context.Context) {
	trackers, err := l.storage.Restore(ctx)
	if err != nil {
		l.Debug(ctx, "restoreLocked: failed to read, skipping: %s", err)
		return
	}
	for _, t := range trackers {
		l.trackers[t.key()] = t
		l.eg.Go(func() error { return l.tracker(t) })
	}
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

type unfurlNotifyListener struct {
	globals.Contextified
	utils.DebugLabeler
	libkb.NoopNotifyListener

	outboxID chat1.OutboxID
	doneCh   chan struct{}
}

func newUnfurlNotifyListener(g *globals.Context, outboxID chat1.OutboxID, doneCh chan struct{}) *unfurlNotifyListener {
	return &unfurlNotifyListener{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "maps.unfurlNotifyListener", false),
		outboxID:     outboxID,
		doneCh:       doneCh,
	}
}

func (n *unfurlNotifyListener) NewChatActivity(uid keybase1.UID, activity chat1.ChatActivity,
	source chat1.ChatActivitySource) {
	ctx := context.Background()
	st, err := activity.ActivityType()
	if err != nil {
		n.Debug(ctx, "NewChatActivity: failed to get type: %s", err)
		return
	}
	switch st {
	case chat1.ChatActivityType_INCOMING_MESSAGE:
		msg := activity.IncomingMessage().Message
		if msg.IsOutbox() {
			return
		}
		if n.outboxID.Eq(msg.GetOutboxID()) {
			n.doneCh <- struct{}{}
		}
	case chat1.ChatActivityType_FAILED_MESSAGE:
		recs := activity.FailedMessage().OutboxRecords
		for _, r := range recs {
			if n.outboxID.Eq(&r.OutboxID) {
				n.doneCh <- struct{}{}
				break
			}
		}
	}
}

func (l *LiveLocationTracker) updateMapUnfurl(ctx context.Context, t *locationTrack) (err error) {
	ctx = globals.ChatCtx(ctx, l.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, nil)
	defer l.Trace(ctx, func() error { return err }, "updateMapUnfurl")()
	msg, err := l.G().ChatHelper.GetMessage(ctx, l.uid, t.convID, t.msgID, true, nil)
	if err != nil {
		return err
	}
	if !msg.IsValid() {
		return errors.New("invalid message")
	}
	mvalid := msg.Valid()
	var coords []chat1.Coordinate
	if len(t.coords) == 0 {
		if !l.lastCoord.IsZero() {
			coords = []chat1.Coordinate{l.lastCoord}
		} else {
			return errors.New("no coordinates")
		}
	} else {
		coords = t.coords
	}
	first := coords[0]
	conv, err := utils.GetVerifiedConv(ctx, l.G(), l.uid, t.convID, types.InboxSourceDataSourceAll)
	if err != nil {
		return err
	}

	// Prefetch the next unfurl, and then delete any others. We do the prefetch so that there isn't
	// a large lag after we delete the unfurl and when we post the next one. We link back to the
	// tracker in the URL so we can get all the coordinates in the scraper. The cb param
	// makes it so the unfurler doesn't think it has already unfurled this URL and skips it.
	body := fmt.Sprintf("https://%s/?lat=%f&lon=%f&acc=%f&livekey=%s&cb=%s", types.MapsDomain,
		first.Lat, first.Lon, first.Accuracy, t.key(), libkb.RandStringB64(3))
	l.G().Unfurler.Prefetch(ctx, l.uid, t.convID, body)
	for unfurlMsgID := range mvalid.Unfurls {
		// delete the old unfurl first to make way for the new
		if err := l.G().ChatHelper.DeleteMsg(ctx, t.convID, conv.Info.TlfName, unfurlMsgID); err != nil {
			return err
		}
	}

	// Create a new unfurl on the new URL, and wait for it to complete before charging forward. This way
	// we won't get into a state with multiple unfurls in the thread
	mvalid.MessageBody = chat1.NewMessageBodyWithText(chat1.MessageText{
		Body: body,
	})
	newMsg := chat1.NewMessageUnboxedWithValid(mvalid)
	unfurlDoneCh := make(chan struct{}, 10)
	outboxID := storage.GetOutboxIDFromURL(body, t.convID, newMsg)
	listenerID := l.G().NotifyRouter.AddListener(newUnfurlNotifyListener(l.G(), outboxID, unfurlDoneCh))
	l.G().Unfurler.UnfurlAndSend(ctx, l.uid, t.convID, newMsg)
	select {
	case <-unfurlDoneCh:
	case <-time.After(time.Minute):
		l.Debug(ctx, "updateMapUnfurl: timed out waiting for unfurl callbaack, charging...")
	}
	l.G().NotifyRouter.RemoveListener(listenerID)
	return nil
}

func (l *LiveLocationTracker) tracker(t *locationTrack) error {
	ctx := context.Background()
	watchID, err := l.getChatUI(ctx).ChatWatchPosition(ctx)
	if err != nil {
		l.Debug(ctx, "tracker: unable to watch position: %s", err)
		return err
	}
	defer func() {
		l.getChatUI(ctx).ChatClearWatch(ctx, watchID)
		l.Lock()
		defer l.Unlock()
		delete(l.trackers, t.key())
		l.saveLocked(ctx)
	}()
	if !t.getCurrentPosition {
		if !l.lastCoord.IsZero() {
			t.coords = append(t.coords, l.lastCoord)
		}
		l.updateMapUnfurl(ctx, t)
	}

	firstUpdate := true
	shouldUpdate := false
	nextUpdate := l.G().Clock().Now().Add(l.updateInterval)
	for {
		select {
		case coord := <-t.updateCh:
			if !t.getCurrentPosition {
				t.coords = append(t.coords, coord)
				t.drain()
				shouldUpdate = true
				if firstUpdate {
					l.updateMapUnfurl(ctx, t)
				}
				firstUpdate = false
			} else {
				t.coords = []chat1.Coordinate{coord}
			}
			l.Lock()
			l.saveLocked(ctx)
			l.Unlock()
		case <-l.G().Clock().AfterTime(nextUpdate):
			if shouldUpdate {
				l.updateMapUnfurl(ctx, t)
				shouldUpdate = false
			}
			nextUpdate = l.G().Clock().Now().Add(l.updateInterval)
		case <-l.G().Clock().AfterTime(t.endTime):
			l.Debug(ctx, "tracker: live location complete: watchID: %s", watchID)
			if t.getCurrentPosition || shouldUpdate {
				l.updateMapUnfurl(ctx, t)
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
	l.Lock()
	defer l.Unlock()
	t := newLocationTrack(convID, msgID, time.Now().Add(5*time.Second), true)
	l.trackers[t.key()] = t
	l.saveLocked(ctx)
	l.eg.Go(func() error { return l.tracker(t) })
}

func (l *LiveLocationTracker) StartTracking(ctx context.Context, convID chat1.ConversationID,
	msgID chat1.MessageID, endTime time.Time) {
	defer l.Trace(ctx, func() error { return nil }, "StartTracking")()
	l.Lock()
	defer l.Unlock()
	t := newLocationTrack(convID, msgID, endTime, false)
	l.trackers[t.key()] = t
	l.saveLocked(ctx)
	l.eg.Go(func() error { return l.tracker(t) })
}

func (l *LiveLocationTracker) LocationUpdate(ctx context.Context, coord chat1.Coordinate) {
	defer l.Trace(ctx, func() error { return nil }, "LocationUpdate")()
	l.Lock()
	defer l.Unlock()
	if l.G().IsMobileAppType() {
		// if the app is woken up as the result of a location update, and we think we are currently
		// backgrounded, then go ahead and mark us as background active so that we can get
		// location updates out
		l.G().MobileAppState.UpdateWithCheck(keybase1.MobileAppState_BACKGROUNDACTIVE,
			func(curState keybase1.MobileAppState) bool {
				return curState == keybase1.MobileAppState_BACKGROUND
			})
	}
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

func (l *LiveLocationTracker) GetCoordinates(ctx context.Context, key types.LiveLocationKey) (res []chat1.Coordinate) {
	defer l.Trace(ctx, func() error { return nil }, "GetCoordinates")()
	l.Lock()
	defer l.Unlock()
	if t, ok := l.trackers[key]; ok {
		// TODO: sample these
		res = t.coords
	}
	if len(res) == 0 {
		res = append(res, l.lastCoord)
	}
	return res
}
