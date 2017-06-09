package chat

import (
	"bytes"
	"encoding/hex"
	"errors"
	"fmt"
	"sync"
	"time"

	"strings"

	"github.com/keybase/client/go/badges"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/pager"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/gregor"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/clockwork"
	"github.com/keybase/go-codec/codec"
	"golang.org/x/net/context"
)

type messageWaiterEntry struct {
	vers chat1.InboxVers
	cb   chan struct{}
}

type gregorMessageOrderer struct {
	globals.Contextified
	utils.DebugLabeler
	sync.Mutex

	clock   clockwork.Clock
	waiters map[string][]messageWaiterEntry
}

func newGregorMessageOrderer(g *globals.Context) *gregorMessageOrderer {
	return &gregorMessageOrderer{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g, "gregorMessageOrderer", false),
		waiters:      make(map[string][]messageWaiterEntry),
		clock:        clockwork.NewRealClock(),
	}
}

func (g *gregorMessageOrderer) msgKey(uid gregor1.UID, vers chat1.InboxVers) string {
	return fmt.Sprintf("%s:%d", uid, vers)
}

func (g *gregorMessageOrderer) isUIDKey(key string, uid gregor1.UID) bool {
	toks := strings.Split(key, ":")
	return toks[0] == uid.String()
}

func (g *gregorMessageOrderer) latestInboxVersion(ctx context.Context, uid gregor1.UID) (chat1.InboxVers, error) {
	ibox := storage.NewInbox(g.G(), uid)
	vers, err := ibox.Version(ctx)
	if err != nil {
		return 0, err
	}
	return vers, nil
}

func (g *gregorMessageOrderer) addToWaitersLocked(ctx context.Context, uid gregor1.UID, storedVers,
	msgVers chat1.InboxVers) (res []messageWaiterEntry) {
	for i := storedVers + 1; i < msgVers; i++ {
		entry := messageWaiterEntry{
			vers: msgVers,
			cb:   make(chan struct{}),
		}
		res = append(res, entry)
		key := g.msgKey(uid, i)
		g.waiters[key] = append(g.waiters[key], entry)
	}
	return res
}

func (g *gregorMessageOrderer) waitOnWaiters(ctx context.Context, vers chat1.InboxVers,
	waiters []messageWaiterEntry) (res chan struct{}) {
	res = make(chan struct{})
	go func() {
		for _, w := range waiters {
			select {
			case <-w.cb:
			case <-ctx.Done():
				g.Debug(ctx, "waitOnWaiters: context cancelled: waiter: %d target: %d", vers, w.vers)
			}
		}
		close(res)
	}()
	return res
}

func (g *gregorMessageOrderer) cleanupAfterTimeoutLocked(uid gregor1.UID, vers chat1.InboxVers) {
	for k, v := range g.waiters {
		if g.isUIDKey(k, uid) {
			var newv []messageWaiterEntry
			for _, w := range v {
				if w.vers != vers {
					newv = append(newv, w)
				}
			}
			if len(newv) == 0 {
				delete(g.waiters, k)
			} else {
				g.waiters[k] = newv
			}
		}
	}
}

func (g *gregorMessageOrderer) WaitForTurn(ctx context.Context, uid gregor1.UID,
	newVers chat1.InboxVers) (res chan struct{}) {
	res = make(chan struct{})
	// Grab latest inbox version if we can
	vers, err := g.latestInboxVersion(ctx, uid)
	if err != nil {
		g.Debug(ctx, "WaitForTurn: failed to get current inbox version: %s", err.Error())
		close(res)
		return res
	}

	// Check for an in-order update
	if newVers <= vers+1 {
		close(res)
		return
	}

	// Out of order update, we are going to wait a fixed amount of time for the correctly
	// ordered update
	deadline := g.clock.Now().Add(time.Second)
	go func() {
		g.Lock()
		waiters := g.addToWaitersLocked(ctx, uid, vers, newVers)
		g.Unlock()
		g.Debug(ctx, "WaitForTurn: out of order update received, waiting on %d updates: vers: %d newVers: %d", len(waiters), vers, newVers)
		ctx, cancel := context.WithCancel(ctx)
		defer cancel()
		select {
		case <-g.waitOnWaiters(ctx, newVers, waiters):
			g.Debug(ctx, "WaitForTurn: cleared by earlier messages: vers: %d", newVers)
		case <-g.clock.AfterTime(deadline):
			g.Debug(ctx, "WaitForTurn: timeout reached, charging forward: vers: %d", newVers)
			g.Lock()
			g.cleanupAfterTimeoutLocked(uid, newVers)
			g.Unlock()
		}
		close(res)
	}()
	return res
}

func (g *gregorMessageOrderer) CompleteTurn(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers) {
	g.Lock()
	defer g.Unlock()
	key := g.msgKey(uid, vers)
	waiters := g.waiters[key]
	if len(waiters) > 0 {
		g.Debug(ctx, "CompleteTurn: clearing %d messages on vers %d", len(waiters), vers)
	}
	for _, w := range waiters {
		close(w.cb)
	}
	delete(g.waiters, key)
}

func (g *gregorMessageOrderer) SetClock(clock clockwork.Clock) {
	g.clock = clock
}

type PushHandler struct {
	globals.Contextified
	utils.DebugLabeler
	sync.Mutex

	badger        *badges.Badger
	identNotifier *IdentifyNotifier
	orderer       *gregorMessageOrderer
	typingMonitor *TypingMonitor
}

func NewPushHandler(g *globals.Context) *PushHandler {
	return &PushHandler{
		Contextified:  globals.NewContextified(g),
		DebugLabeler:  utils.NewDebugLabeler(g, "PushHandler", false),
		identNotifier: NewIdentifyNotifier(g),
		orderer:       newGregorMessageOrderer(g),
		typingMonitor: NewTypingMonitor(g),
	}
}

func (g *PushHandler) SetBadger(badger *badges.Badger) {
	g.badger = badger
}

func (g *PushHandler) SetClock(clock clockwork.Clock) {
	g.orderer.SetClock(clock)
}

func (g *PushHandler) shouldSendNotifications() bool {
	return g.G().AppState.State() == keybase1.AppState_FOREGROUND
}

func (g *PushHandler) TlfFinalize(ctx context.Context, m gregor.OutOfBandMessage) (err error) {
	defer g.Trace(ctx, func() error { return err }, "TlfFinalize")()
	if m.Body() == nil {
		return errors.New("gregor handler for chat.tlffinalize: nil message body")
	}

	var update chat1.TLFFinalizeUpdate
	reader := bytes.NewReader(m.Body().Bytes())
	dec := codec.NewDecoder(reader, &codec.MsgpackHandle{WriteExt: true})
	err = dec.Decode(&update)
	if err != nil {
		return err
	}
	uid := gregor1.UID(m.UID().Bytes())

	// Order updates based on inbox version of the update from the server
	cb := g.orderer.WaitForTurn(ctx, uid, update.InboxVers)
	bctx := BackgroundContext(ctx, g.G())
	go func(ctx context.Context) {
		defer g.Trace(ctx, func() error { return err }, "TlfFinalize(goroutine)")()
		<-cb
		g.Lock()
		defer g.Unlock()
		defer g.orderer.CompleteTurn(ctx, uid, update.InboxVers)

		// Update inbox
		var convs []chat1.ConversationLocal
		if convs, err = g.G().InboxSource.TlfFinalize(ctx, m.UID().Bytes(), update.InboxVers,
			update.ConvIDs, update.FinalizeInfo); err != nil {
			g.Debug(ctx, "tlf finalize: unable to update inbox: %s", err.Error())
		}
		convMap := make(map[string]chat1.ConversationLocal)
		for _, conv := range convs {
			convMap[conv.GetConvID().String()] = conv
		}

		// Send notify for each conversation ID
		for _, convID := range update.ConvIDs {
			var conv *chat1.ConversationLocal
			if mapConv, ok := convMap[convID.String()]; ok {
				conv = &mapConv
			} else {
				conv = nil
			}

			if conv.GetTopicType() == chat1.TopicType_CHAT {
				if g.shouldSendNotifications() {
					g.G().NotifyRouter.HandleChatTLFFinalize(ctx, keybase1.UID(uid.String()),
						convID, update.FinalizeInfo, conv)
				} else {
					g.G().Syncer.SendChatStaleNotifications(ctx, uid,
						[]chat1.ConversationID{convID}, false)
				}
			}
		}
	}(bctx)

	return nil
}

func (g *PushHandler) TlfResolve(ctx context.Context, m gregor.OutOfBandMessage) (err error) {
	defer g.Trace(ctx, func() error { return err }, "TlfResolve")()
	if m.Body() == nil {
		return errors.New("gregor handler for chat.tlfresolve: nil message body")
	}

	var update chat1.TLFResolveUpdate
	reader := bytes.NewReader(m.Body().Bytes())
	dec := codec.NewDecoder(reader, &codec.MsgpackHandle{WriteExt: true})
	err = dec.Decode(&update)
	if err != nil {
		return err
	}
	uid := gregor1.UID(m.UID().Bytes())

	// Order updates based on inbox version of the update from the server
	cb := g.orderer.WaitForTurn(ctx, uid, update.InboxVers)
	bctx := BackgroundContext(ctx, g.G())
	go func(ctx context.Context) {
		defer g.Trace(ctx, func() error { return nil }, "TlfResolve(goroutine)")()
		<-cb
		g.Lock()
		defer g.Unlock()
		defer g.orderer.CompleteTurn(ctx, uid, update.InboxVers)
		// Get and localize the conversation to get the new tlfname.
		inbox, _, err := g.G().InboxSource.Read(ctx, uid, nil, true, &chat1.GetInboxLocalQuery{
			ConvIDs: []chat1.ConversationID{update.ConvID},
		}, nil)
		if err != nil {
			g.Debug(ctx, "resolve: unable to read conversation: %s", err.Error())
			return
		}
		if len(inbox.Convs) != 1 {
			g.Debug(ctx, "resolve: unable to find conversation")
			return
		}
		updateConv := inbox.Convs[0]

		resolveInfo := chat1.ConversationResolveInfo{
			NewTLFName: updateConv.Info.TlfName,
		}

		if updateConv.GetTopicType() == chat1.TopicType_CHAT {
			if g.shouldSendNotifications() {
				g.G().NotifyRouter.HandleChatTLFResolve(ctx, keybase1.UID(uid.String()),
					update.ConvID, resolveInfo)
			} else {
				g.G().Syncer.SendChatStaleNotifications(ctx, uid,
					[]chat1.ConversationID{update.ConvID}, false)
			}
		}
	}(bctx)

	return nil
}

func (g *PushHandler) Activity(ctx context.Context, m gregor.OutOfBandMessage) (err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = Context(ctx, g.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, &identBreaks,
		g.identNotifier)
	defer g.Trace(ctx, func() error { return err }, "Activity")()
	if m.Body() == nil {
		return errors.New("gregor handler for chat.activity: nil message body")
	}

	// Decode into generic form
	var gm chat1.GenericPayload
	uid := m.UID().Bytes()
	reader := bytes.NewReader(m.Body().Bytes())
	dec := codec.NewDecoder(reader, &codec.MsgpackHandle{WriteExt: true})
	err = dec.Decode(&gm)
	if err != nil {
		g.Debug(ctx, "chat activity: failed to decode into generic payload: %s", err.Error())
		return err
	}
	convID := gm.ConvID
	g.Debug(ctx, "chat activity: action %s vers: %d convID: %s", gm.Action, gm.InboxVers, convID)

	// Order updates based on inbox version of the update from the server
	cb := g.orderer.WaitForTurn(ctx, uid, gm.InboxVers)
	bctx := BackgroundContext(ctx, g.G())
	go func(ctx context.Context) {
		defer g.Trace(ctx, func() error { return nil }, "Activity(goroutine)")()
		<-cb
		g.Lock()
		defer g.Unlock()
		defer g.orderer.CompleteTurn(ctx, uid, gm.InboxVers)

		var activity chat1.ChatActivity
		var err error
		var conv *chat1.ConversationLocal
		action := gm.Action
		reader.Reset(m.Body().Bytes())
		switch action {
		case "newMessage":
			var nm chat1.NewMessagePayload
			err = dec.Decode(&nm)
			if err != nil {
				g.Debug(ctx, "chat activity: error decoding newMessage: %s", err.Error())
				return
			}

			g.Debug(ctx, "chat activity: newMessage: convID: %s sender: %s",
				nm.ConvID, nm.Message.ClientHeader.Sender)
			if nm.Message.ClientHeader.OutboxID != nil {
				g.Debug(ctx, "chat activity: newMessage: outboxID: %s",
					hex.EncodeToString(*nm.Message.ClientHeader.OutboxID))
			} else {
				g.Debug(ctx, "chat activity: newMessage: outboxID is empty")
			}

			// Update typing status to stopped
			g.typingMonitor.Update(ctx, chat1.TyperInfo{
				Uid:      keybase1.UID(nm.Message.ClientHeader.Sender.String()),
				DeviceID: keybase1.DeviceID(nm.Message.ClientHeader.SenderDevice.String()),
			}, convID, false)

			decmsg, appended, pushErr := g.G().ConvSource.Push(ctx, nm.ConvID, gregor1.UID(uid), nm.Message)
			if pushErr != nil {
				g.Debug(ctx, "chat activity: unable to push message: %s", pushErr.Error())
			}
			if conv, err = g.G().InboxSource.NewMessage(ctx, uid, nm.InboxVers, nm.ConvID, nm.Message); err != nil {
				g.Debug(ctx, "chat activity: unable to update inbox: %s", err.Error())
			}

			// If we have no error on this message, then notify the frontend
			if pushErr == nil {
				// Make a pagination object so client can use it in GetThreadLocal
				pmsgs := []pager.Message{nm.Message}
				pager := pager.NewThreadPager()
				page, err := pager.MakePage(pmsgs, 1)
				if err != nil {
					g.Debug(ctx, "chat activity: error making page: %s", err.Error())
				}
				activity = chat1.NewChatActivityWithIncomingMessage(chat1.IncomingMessage{
					Message:    decmsg,
					ConvID:     nm.ConvID,
					Conv:       conv,
					Pagination: page,
				})
			}

			// If this message was not "appended", meaning there is a hole between what we have in cache,
			// and this message, then we send out a notification that this thread should be considered
			// stale.
			// We also get here if we had an error unboxing the messages, it could be a temporal thing
			// so the frontend should reload.
			if !appended || pushErr != nil {
				if !appended {
					g.Debug(ctx, "chat activity: newMessage: non-append message, alerting")
				}
				if pushErr != nil {
					g.Debug(ctx, "chat activity: newMessage: push error, alerting")
				}
				g.G().Syncer.SendChatStaleNotifications(ctx, m.UID().Bytes(),
					[]chat1.ConversationID{nm.ConvID}, true)
			}

			if g.badger != nil && nm.UnreadUpdate != nil {
				g.badger.PushChatUpdate(*nm.UnreadUpdate, nm.InboxVers)
			}
		case "readMessage":
			var nm chat1.ReadMessagePayload
			err = dec.Decode(&nm)
			if err != nil {
				g.Debug(ctx, "chat activity: error decoding: %s", err.Error())
				return
			}
			g.Debug(ctx, "chat activity: readMessage: convID: %s msgID: %d",
				nm.ConvID, nm.MsgID)

			uid := m.UID().Bytes()
			if conv, err = g.G().InboxSource.ReadMessage(ctx, uid, nm.InboxVers, nm.ConvID, nm.MsgID); err != nil {
				g.Debug(ctx, "chat activity: unable to update inbox: %s", err.Error())
			}

			activity = chat1.NewChatActivityWithReadMessage(chat1.ReadMessageInfo{
				MsgID:  nm.MsgID,
				ConvID: nm.ConvID,
				Conv:   conv,
			})

			if g.badger != nil && nm.UnreadUpdate != nil {
				g.badger.PushChatUpdate(*nm.UnreadUpdate, nm.InboxVers)
			}
		case "setStatus":
			var nm chat1.SetStatusPayload
			err = dec.Decode(&nm)
			if err != nil {
				g.Debug(ctx, "chat activity: error decoding: %s", err.Error())
				return
			}
			g.Debug(ctx, "chat activity: setStatus: convID: %s status: %d",
				nm.ConvID, nm.Status)

			uid := m.UID().Bytes()
			if conv, err = g.G().InboxSource.SetStatus(ctx, uid, nm.InboxVers, nm.ConvID, nm.Status); err != nil {
				g.Debug(ctx, "chat activity: unable to update inbox: %s", err.Error())
			}
			activity = chat1.NewChatActivityWithSetStatus(chat1.SetStatusInfo{
				ConvID: nm.ConvID,
				Status: nm.Status,
				Conv:   conv,
			})

			if g.badger != nil && nm.UnreadUpdate != nil {
				g.badger.PushChatUpdate(*nm.UnreadUpdate, nm.InboxVers)
			}
		case "newConversation":
			var nm chat1.NewConversationPayload
			err = dec.Decode(&nm)
			if err != nil {
				g.Debug(ctx, "chat activity: error decoding: %s", err.Error())
				return
			}
			g.Debug(ctx, "chat activity: newConversation: convID: %s ", nm.ConvID)

			uid := m.UID().Bytes()

			// We need to get this conversation and then localize it
			var inbox chat1.Inbox
			if inbox, _, err = g.G().InboxSource.Read(ctx, uid, nil, false, &chat1.GetInboxLocalQuery{
				ConvIDs: []chat1.ConversationID{nm.ConvID},
			}, nil); err != nil {
				g.Debug(ctx, "chat activity: unable to read conversation: %s", err.Error())
				return
			}
			if len(inbox.Convs) != 1 {
				g.Debug(ctx, "chat activity: unable to find conversation")
				return
			}
			updateConv := inbox.ConvsUnverified[0]
			if err = g.G().InboxSource.NewConversation(ctx, uid, nm.InboxVers, updateConv); err != nil {
				g.Debug(ctx, "chat activity: unable to update inbox: %s", err.Error())
			}
			conv = &inbox.Convs[0]

			activity = chat1.NewChatActivityWithNewConversation(chat1.NewConversationInfo{
				Conv: *conv,
			})

			if g.badger != nil && nm.UnreadUpdate != nil {
				g.badger.PushChatUpdate(*nm.UnreadUpdate, nm.InboxVers)
			}
		default:
			g.Debug(ctx, "unhandled chat.activity action %q", action)
		}

		g.notifyNewChatActivity(ctx, m.UID(), convID, conv, &activity)
	}(bctx)
	return nil
}

func (g *PushHandler) notifyNewChatActivity(ctx context.Context, uid gregor.UID,
	convID chat1.ConversationID, conv *chat1.ConversationLocal, activity *chat1.ChatActivity) error {
	kbUID, err := keybase1.UIDFromString(hex.EncodeToString(uid.Bytes()))
	if err != nil {
		return err
	}
	// Don't send any notifications for non-chat topic types
	if conv != nil && conv.GetTopicType() != chat1.TopicType_CHAT {
		return nil
	}
	if g.shouldSendNotifications() {
		g.G().NotifyRouter.HandleNewChatActivity(ctx, kbUID, activity)
	} else {
		// If we are not in send notifications mode, then just label this conversation
		// as stale, and we can reload the thread.
		g.G().Syncer.SendChatStaleNotifications(ctx, uid.(gregor1.UID),
			[]chat1.ConversationID{convID}, false)
	}

	return nil
}

func (g *PushHandler) Typing(ctx context.Context, m gregor.OutOfBandMessage) (err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = Context(ctx, g.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, &identBreaks,
		g.identNotifier)
	defer g.Trace(ctx, func() error { return err }, "Typing")()
	if m.Body() == nil {
		return errors.New("gregor handler for typing: nil message body")
	}

	var update chat1.RemoteUserTypingUpdate
	reader := bytes.NewReader(m.Body().Bytes())
	dec := codec.NewDecoder(reader, &codec.MsgpackHandle{WriteExt: true})
	err = dec.Decode(&update)
	if err != nil {
		return err
	}

	// Lookup username and device name
	kuid := keybase1.UID(update.Uid.String())
	kdid := keybase1.DeviceID(update.DeviceID.String())
	user, device, dtype, err := g.G().GetUPAKLoader().LookupUsernameAndDevice(ctx, kuid, kdid)
	if err != nil {
		g.Debug(ctx, "Typing: failed to lookup username/device: msg: %s", err.Error())
		return err
	}

	// Fire off update with all relevant info
	g.typingMonitor.Update(ctx, chat1.TyperInfo{
		Uid:        kuid,
		DeviceID:   kdid,
		Username:   user.String(),
		DeviceName: device,
		DeviceType: dtype,
	}, update.ConvID, update.Typing)
	return nil
}
