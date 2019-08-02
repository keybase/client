package maps

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/clockwork"
	"golang.org/x/sync/errgroup"
)

type LiveLocationTracker struct {
	globals.Contextified
	utils.DebugLabeler
	sync.Mutex

	clock          clockwork.Clock
	storage        *trackStorage
	updateInterval time.Duration
	uid            gregor1.UID
	eg             errgroup.Group
	trackers       map[types.LiveLocationKey]*locationTrack
	lastCoord      chat1.Coordinate
	maxCoords      int

	// testing only
	TestingCoordsAddedCh chan struct{}
}

func NewLiveLocationTracker(g *globals.Context) *LiveLocationTracker {
	return &LiveLocationTracker{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "LiveLocationTracker", false),

		storage:        newTrackStorage(g),
		trackers:       make(map[types.LiveLocationKey]*locationTrack),
		updateInterval: 30 * time.Second,
		maxCoords:      500,
		clock:          clockwork.NewRealClock(),
	}
}

func (l *LiveLocationTracker) Start(ctx context.Context, uid gregor1.UID) {
	defer l.Trace(ctx, func() error { return nil }, "Start")()
	l.Lock()
	defer l.Unlock()
	l.uid = uid
	// bring back any trackers that we have stored. This is most relavent when being woken
	// up on iOS due to a location update. THe app might need to recreate all of its trackers
	// if the app had been killed.
	l.restoreLocked(ctx)
}

func (l *LiveLocationTracker) Stop(ctx context.Context) chan struct{} {
	defer l.Trace(ctx, func() error { return nil }, "Stop")()
	l.Lock()
	defer l.Unlock()
	ch := make(chan struct{})
	for _, t := range l.trackers {
		t.Stop()
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
	if len(trackers) == 0 {
		return
	}
	l.Debug(ctx, "restoreLocked: restored %d trackers", len(trackers))
	l.trackers = make(map[types.LiveLocationKey]*locationTrack)
	for _, t := range trackers {
		if t.IsStopped() {
			continue
		}
		l.trackers[t.Key()] = t
		l.eg.Go(func() error { return l.tracker(t) })
	}
}

type nullChatUI struct {
	libkb.ChatUI
}

func (n nullChatUI) ChatWatchPosition(context.Context, chat1.ConversationID) (chat1.LocationWatchID, error) {
	return chat1.LocationWatchID(0), errors.New("no chat UI")
}

func (n nullChatUI) ChatClearWatch(context.Context, chat1.LocationWatchID) error {
	return nil
}

func (n nullChatUI) ChatCommandStatus(context.Context, chat1.ConversationID, string,
	chat1.UICommandStatusDisplayTyp, []chat1.UICommandStatusActionTyp) error {
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

func (l *LiveLocationTracker) updateMapUnfurl(ctx context.Context, t *locationTrack, done bool) (err error) {
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
	trackerCoords := t.GetCoords()
	if len(trackerCoords) == 0 {
		if !l.lastCoord.IsZero() {
			coords = []chat1.Coordinate{l.lastCoord}
		} else {
			return errors.New("no coordinates")
		}
	} else {
		coords = trackerCoords
	}
	last := coords[len(coords)-1]
	conv, err := utils.GetVerifiedConv(ctx, l.G(), l.uid, t.convID, types.InboxSourceDataSourceAll)
	if err != nil {
		return err
	}

	// Prefetch the next unfurl, and then delete any others. We do the prefetch so that there isn't
	// a large lag after we delete the unfurl and when we post the next one. We link back to the
	// tracker in the URL so we can get all the coordinates in the scraper. The cb param
	// makes it so the unfurler doesn't think it has already unfurled this URL and skips it.
	body := fmt.Sprintf("https://%s/?lat=%f&lon=%f&acc=%f&cb=%s&done=%v", types.MapsDomain,
		last.Lat, last.Lon, last.Accuracy, libkb.RandStringB64(3), done)
	if !t.getCurrentPosition {
		body += fmt.Sprintf("&livekey=%s", t.Key())
	}
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
		l.Debug(ctx, "updateMapUnfurl: timed out waiting for unfurl callback, charging...")
	}
	l.G().NotifyRouter.RemoveListener(listenerID)
	return nil
}

func (l *LiveLocationTracker) startWatch(ctx context.Context, convID chat1.ConversationID) (watchID chat1.LocationWatchID, err error) {
	// try this a couple times in case we are starting fresh and the UI isn't ready yet
	maxWatchAttempts := 20
	watchAttempts := 0
	for {
		if watchID, err = l.getChatUI(ctx).ChatWatchPosition(ctx, convID); err != nil {
			l.Debug(ctx, "startWatch: unable to watch position: attempt: %d msg: %s", watchAttempts, err)
			if watchAttempts > maxWatchAttempts {
				return 0, err
			}
		} else {
			break
		}
		maxWatchAttempts++
		time.Sleep(time.Second)
	}
	return watchID, nil
}

func (l *LiveLocationTracker) tracker(t *locationTrack) error {
	ctx := context.Background()
	// check to see if we are being asked to start a tracker that is already expired
	if t.endTime.Before(l.clock.Now()) {
		return errors.New("tracker from the past")
	}

	// start up the OS watch routine
	watchID, err := l.startWatch(ctx, t.convID)
	if err != nil {
		return err
	}
	defer func() {
		// drop everything when our live location ends
		l.getChatUI(ctx).ChatClearWatch(ctx, watchID)
		l.Lock()
		defer l.Unlock()
		delete(l.trackers, t.Key())
		l.saveLocked(ctx)
	}()

	if !t.getCurrentPosition {
		// if this is a live location request, just put whatever the last coord is on the screen, makes it
		// feel more live
		if !l.lastCoord.IsZero() {
			t.updateCh <- l.lastCoord
		}
	}
	firstUpdate := true
	shouldUpdate := false
	nextUpdate := l.clock.Now().Add(l.updateInterval)
	for {
		select {
		case coord := <-t.updateCh:
			var added int
			if !t.getCurrentPosition {
				added = t.Drain(coord)
				shouldUpdate = true
				l.Debug(ctx, "tracker[%v]: got coords", watchID)
				if firstUpdate {
					l.Debug(ctx, "tracker[%v]: updating due to live location first update", watchID)
					l.updateMapUnfurl(ctx, t, false)
				}
				firstUpdate = false
			} else {
				added = 1
				t.SetCoords([]chat1.Coordinate{coord})
			}
			l.Lock()
			l.saveLocked(ctx)
			l.Unlock()
			l.Debug(ctx, "tracker[%v]: added %d coords", watchID, added)
			if l.TestingCoordsAddedCh != nil {
				for i := 0; i < added; i++ {
					l.TestingCoordsAddedCh <- struct{}{}
				}
			}
		case <-l.clock.AfterTime(nextUpdate):
			// we update the map unfurl on a timer so we don't spam delete and recreate it
			if shouldUpdate {
				// drain anything in the buffer if we are being updated and posting at the same time
				t.Drain(chat1.Coordinate{})
				l.Debug(ctx, "tracker[%v]: updating due to next update", watchID)
				l.updateMapUnfurl(ctx, t, false)
				shouldUpdate = false
			}
			nextUpdate = l.clock.Now().Add(l.updateInterval)
		case <-l.clock.AfterTime(t.endTime):
			l.Debug(ctx, "tracker[%v]: live location complete, updating", watchID)
			t.Drain(chat1.Coordinate{})
			l.updateMapUnfurl(ctx, t, true)
			return nil
		case <-t.stopCh:
			l.Debug(ctx, "tracker[%v]: stopped, updating with done status", watchID)
			l.updateMapUnfurl(ctx, t, true)
			return nil
		}
	}
}

func (l *LiveLocationTracker) GetCurrentPosition(ctx context.Context, convID chat1.ConversationID,
	msgID chat1.MessageID) {
	defer l.Trace(ctx, func() error { return nil }, "GetCurrentPosition")()
	l.Lock()
	defer l.Unlock()
	// start up a live location tracker for a small amount of time to make sure we get a good
	// coordinate
	t := newLocationTrack(convID, msgID, l.clock.Now().Add(4*time.Second), true, l.maxCoords, false)
	l.trackers[t.Key()] = t
	l.saveLocked(ctx)
	l.eg.Go(func() error { return l.tracker(t) })
}

func (l *LiveLocationTracker) StartTracking(ctx context.Context, convID chat1.ConversationID,
	msgID chat1.MessageID, endTime time.Time) {
	defer l.Trace(ctx, func() error { return nil }, "StartTracking")()
	l.Lock()
	defer l.Unlock()
	t := newLocationTrack(convID, msgID, endTime, false, l.maxCoords, false)
	l.trackers[t.Key()] = t
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
		res = t.GetCoords()
	}
	if len(res) == 0 {
		res = append(res, l.lastCoord)
	}
	return res
}

func (l *LiveLocationTracker) StopAllTracking(ctx context.Context) {
	defer l.Trace(ctx, func() error { return nil }, "StopAllTracking")()
	l.Lock()
	defer l.Unlock()
	for _, t := range l.trackers {
		t.Stop()
	}
	l.saveLocked(ctx)
}

func (l *LiveLocationTracker) SetClock(clock clockwork.Clock) {
	l.clock = clock
}
