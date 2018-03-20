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
	"github.com/keybase/client/go/chat/types"
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
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "gregorMessageOrderer", false),
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
	// Out of order update, we are going to wait a fixed amount of time for the correctly
	// ordered update
	deadline := g.clock.Now().Add(time.Second)
	go func() {
		defer close(res)
		g.Lock()
		vers, err := g.latestInboxVersion(ctx, uid)
		if err != nil {
			g.Debug(ctx, "WaitForTurn: failed to get current inbox version: %s", err.Error())
			vers = newVers - 1
		}
		waiters := g.addToWaitersLocked(ctx, uid, vers, newVers)
		g.Unlock()
		if len(waiters) == 0 {
			return
		}
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
	identNotifier types.IdentifyNotifier
	orderer       *gregorMessageOrderer
	typingMonitor *TypingMonitor
}

func NewPushHandler(g *globals.Context) *PushHandler {
	p := &PushHandler{
		Contextified:  globals.NewContextified(g),
		DebugLabeler:  utils.NewDebugLabeler(g.GetLog(), "PushHandler", false),
		identNotifier: NewCachingIdentifyNotifier(g),
		orderer:       newGregorMessageOrderer(g),
		typingMonitor: NewTypingMonitor(g),
	}
	p.identNotifier.ResetOnGUIConnect()
	return p
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
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = Context(ctx, g.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, &identBreaks,
		g.identNotifier)

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

			if conv == nil || conv.GetTopicType() == chat1.TopicType_CHAT {
				if g.shouldSendNotifications() {
					g.G().NotifyRouter.HandleChatTLFFinalize(ctx, keybase1.UID(uid.String()),
						convID, update.FinalizeInfo, g.presentUIItem(conv))
				} else {
					supdate := []chat1.ConversationStaleUpdate{chat1.ConversationStaleUpdate{
						ConvID:     convID,
						UpdateType: chat1.StaleUpdateType_CLEAR,
					}}
					g.G().Syncer.SendChatStaleNotifications(ctx, uid, supdate, false)
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
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = Context(ctx, g.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, &identBreaks,
		g.identNotifier)

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
		g.Debug(ctx, "TlfResolve: convID: %s new TLF name: %s", updateConv.GetConvID(),
			updateConv.Info.TlfName)

		if updateConv.GetTopicType() == chat1.TopicType_CHAT {
			if g.shouldSendNotifications() {
				g.G().NotifyRouter.HandleChatTLFResolve(ctx, keybase1.UID(uid.String()),
					update.ConvID, resolveInfo)
			} else {
				supdate := []chat1.ConversationStaleUpdate{chat1.ConversationStaleUpdate{
					ConvID:     update.ConvID,
					UpdateType: chat1.StaleUpdateType_CLEAR,
				}}
				g.G().Syncer.SendChatStaleNotifications(ctx, uid, supdate, false)
			}
		}
	}(bctx)

	return nil
}

func (g *PushHandler) shouldDisplayDesktopNotification(ctx context.Context,
	uid gregor1.UID, conv *chat1.ConversationLocal, msg chat1.MessageUnboxed) bool {
	if conv == nil || conv.Notifications == nil {
		return false
	}
	if !utils.GetConversationStatusBehavior(conv.Info.Status).DesktopNotifications {
		return false
	}
	if msg.IsValid() {
		// No notifications for our own messages
		if msg.Valid().ClientHeader.Sender.Eq(uid) {
			return false
		}
		body := msg.Valid().MessageBody
		typ, err := body.MessageType()
		if err != nil {
			g.Debug(ctx, "shouldDisplayDesktopNotification: failed to get message type: %s", err.Error())
			return false
		}
		apptype := keybase1.DeviceType_DESKTOP
		kind := chat1.NotificationKind_GENERIC
		switch typ {
		case chat1.MessageType_TEXT, chat1.MessageType_SYSTEM:
			for _, at := range msg.Valid().AtMentions {
				if at.Eq(uid) {
					kind = chat1.NotificationKind_ATMENTION
					break
				}
			}
			chanMention := msg.Valid().ChannelMention
			notifyFromChanMention := false
			if chanMention == chat1.ChannelMention_HERE || chanMention == chat1.ChannelMention_ALL {
				notifyFromChanMention = conv.Notifications.ChannelWide
			}
			return conv.Notifications.Settings[apptype][kind] || notifyFromChanMention
		case chat1.MessageType_ATTACHMENT:
			return conv.Notifications.Settings[apptype][kind]
		default:
			return false
		}
	}
	return false
}

func (g *PushHandler) presentUIItem(conv *chat1.ConversationLocal) (res *chat1.InboxUIItem) {
	if conv != nil {
		pc := utils.PresentConversationLocal(*conv)
		res = &pc
	}
	return res
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

		var activity *chat1.ChatActivity
		var err error
		var conv *chat1.ConversationLocal
		action := gm.Action
		reader.Reset(m.Body().Bytes())
		switch action {
		case types.ActionNewMessage:
			var nm chat1.NewMessagePayload
			err = dec.Decode(&nm)
			if err != nil {
				g.Debug(ctx, "chat activity: error decoding newMessage: %s", err.Error())
				return
			}
			g.Debug(ctx, "chat activity: newMessage: convID: %s sender: %s msgID: %d",
				nm.ConvID, nm.Message.ClientHeader.Sender, nm.Message.GetMessageID())
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

			// Check for a leave message from ourselves and just bail out if it is
			if nm.Message.GetMessageType() == chat1.MessageType_LEAVE &&
				nm.Message.ClientHeader.Sender.Eq(uid) {
				g.Debug(ctx, "chat activity: ignoring leave message from oursevles")
				return
			}

			decmsg, appended, pushErr := g.G().ConvSource.Push(ctx, nm.ConvID, gregor1.UID(uid), nm.Message)
			if pushErr != nil {
				g.Debug(ctx, "chat activity: unable to push message: %s", pushErr.Error())
			}
			if conv, err = g.G().InboxSource.NewMessage(ctx, uid, nm.InboxVers, nm.ConvID, nm.Message,
				nm.MaxMsgs); err != nil {
				g.Debug(ctx, "chat activity: unable to update inbox: %s", err.Error())
			}

			// If we have no error on this message, then notify the frontend
			if pushErr == nil {
				// Make a pagination object so client can use it in GetThreadLocal
				pmsgs := []pager.Message{nm.Message}
				pager := pager.NewThreadPager()
				page, err := pager.MakePage(pmsgs, 1, 0)
				if err != nil {
					g.Debug(ctx, "chat activity: error making page: %s", err.Error())
				}
				desktopNotification := g.shouldDisplayDesktopNotification(ctx, uid, conv, decmsg)
				activity = new(chat1.ChatActivity)
				*activity = chat1.NewChatActivityWithIncomingMessage(chat1.IncomingMessage{
					Message: utils.PresentMessageUnboxed(ctx, decmsg, uid, g.G().TeamChannelSource),
					ConvID:  nm.ConvID,
					Conv:    g.presentUIItem(conv),
					DisplayDesktopNotification: desktopNotification,
					Pagination:                 utils.PresentPagination(page),
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
				supdate := []chat1.ConversationStaleUpdate{chat1.ConversationStaleUpdate{
					ConvID:     nm.ConvID,
					UpdateType: chat1.StaleUpdateType_CLEAR,
				}}
				g.G().Syncer.SendChatStaleNotifications(ctx, m.UID().Bytes(), supdate, true)
			}
		case types.ActionReadMessage:
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
			activity = new(chat1.ChatActivity)
			*activity = chat1.NewChatActivityWithReadMessage(chat1.ReadMessageInfo{
				MsgID:  nm.MsgID,
				ConvID: nm.ConvID,
				Conv:   g.presentUIItem(conv),
			})
		case types.ActionSetStatus:
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
			activity = new(chat1.ChatActivity)
			*activity = chat1.NewChatActivityWithSetStatus(chat1.SetStatusInfo{
				ConvID: nm.ConvID,
				Status: nm.Status,
				Conv:   g.presentUIItem(conv),
			})
		case types.ActionSetAppNotificationSettings:
			var nm chat1.SetAppNotificationSettingsPayload
			err = dec.Decode(&nm)
			if err != nil {
				g.Debug(ctx, "chat activity: error decoding: %s", err.Error())
				return
			}
			g.Debug(ctx, "chat activity: setAppNotificationSettings: convID: %s num settings: %d",
				nm.ConvID, len(nm.Settings.Settings))

			uid := m.UID().Bytes()
			if _, err = g.G().InboxSource.SetAppNotificationSettings(ctx, uid, nm.InboxVers,
				nm.ConvID, nm.Settings); err != nil {
				g.Debug(ctx, "chat activity: unable to update inbox: %s", err.Error())
			}
			info := chat1.SetAppNotificationSettingsInfo{
				ConvID:   nm.ConvID,
				Settings: nm.Settings,
			}
			activity = new(chat1.ChatActivity)
			*activity = chat1.NewChatActivityWithSetAppNotificationSettings(info)
		case types.ActionNewConversation:
			var nm chat1.NewConversationPayload
			err = dec.Decode(&nm)
			if err != nil {
				g.Debug(ctx, "chat activity: error decoding: %s", err.Error())
				return
			}
			g.Debug(ctx, "chat activity: newConversation: convID: %s ", nm.ConvID)

			uid := m.UID().Bytes()

			// We need to get this conversation and then localize it
			var inbox types.Inbox
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
			updateConv := inbox.ConvsUnverified[0].Conv
			if err = g.G().InboxSource.NewConversation(ctx, uid, nm.InboxVers, updateConv); err != nil {
				g.Debug(ctx, "chat activity: unable to update inbox: %s", err.Error())
			}
			conv = &inbox.Convs[0]

			activity = new(chat1.ChatActivity)
			*activity = chat1.NewChatActivityWithNewConversation(chat1.NewConversationInfo{
				Conv: *g.presentUIItem(conv),
			})
		case types.ActionTeamType:
			var nm chat1.TeamTypePayload
			err = dec.Decode(&nm)
			if err != nil {
				g.Debug(ctx, "chat activity: error decoding: %s", err.Error())
				return
			}
			g.Debug(ctx, "chat activity: team type: convID: %s ", nm.ConvID)

			uid := m.UID().Bytes()
			if conv, err = g.G().InboxSource.TeamTypeChanged(ctx, uid, nm.InboxVers, nm.ConvID, nm.TeamType); err != nil {
				g.Debug(ctx, "chat activity: unable to update inbox: %s", err.Error())
			}
			activity = new(chat1.ChatActivity)
			*activity = chat1.NewChatActivityWithTeamtype(chat1.TeamTypeInfo{
				ConvID:   nm.ConvID,
				TeamType: nm.TeamType,
				Conv:     g.presentUIItem(conv),
			})
		case types.ActionExpunge:
			var nm chat1.ExpungePayload
			err = dec.Decode(&nm)
			if err != nil {
				g.Debug(ctx, "chat activity: error decoding: %s", err.Error())
				return
			}
			g.Debug(ctx, "chat activity: expunge: convID: %s expunge: %v",
				nm.ConvID, nm.Expunge)
			uid := m.UID().Bytes()
			if err = g.G().ConvSource.Expunge(ctx, nm.ConvID, uid, nm.Expunge); err != nil {
				g.Debug(ctx, "chat activity: unable to update conv: %s", err.Error())
			}
			if conv, err = g.G().InboxSource.Expunge(ctx, uid, nm.InboxVers, nm.ConvID, nm.Expunge, nm.MaxMsgs); err != nil {
				g.Debug(ctx, "chat activity: unable to update inbox: %s", err.Error())
			}
		default:
			g.Debug(ctx, "unhandled chat.activity action %q", action)
			return
		}
		if g.badger != nil && gm.UnreadUpdate != nil {
			g.badger.PushChatUpdate(*gm.UnreadUpdate, gm.InboxVers)
		}
		if activity != nil {
			g.notifyNewChatActivity(ctx, m.UID(), convID, conv, activity)
		}
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
		supdate := []chat1.ConversationStaleUpdate{chat1.ConversationStaleUpdate{
			ConvID:     convID,
			UpdateType: chat1.StaleUpdateType_NEWACTIVITY,
		}}
		g.G().Syncer.SendChatStaleNotifications(ctx, uid.(gregor1.UID), supdate, false)
	}

	return nil
}

func (g *PushHandler) notifyJoinChannel(ctx context.Context, uid gregor1.UID,
	conv chat1.ConversationLocal) {

	kuid := keybase1.UID(uid.String())
	if g.shouldSendNotifications() {
		g.G().NotifyRouter.HandleChatJoinedConversation(ctx, kuid, *g.presentUIItem(&conv))
	} else {
		supdate := []chat1.ConversationStaleUpdate{chat1.ConversationStaleUpdate{
			ConvID:     conv.GetConvID(),
			UpdateType: chat1.StaleUpdateType_NEWACTIVITY,
		}}
		g.G().Syncer.SendChatStaleNotifications(ctx, uid, supdate, false)
	}
}

func (g *PushHandler) notifyLeftChannel(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID) {

	kuid := keybase1.UID(uid.String())
	if g.shouldSendNotifications() {
		g.G().NotifyRouter.HandleChatLeftConversation(ctx, kuid, convID)
	} else {
		supdate := []chat1.ConversationStaleUpdate{chat1.ConversationStaleUpdate{
			ConvID:     convID,
			UpdateType: chat1.StaleUpdateType_NEWACTIVITY,
		}}
		g.G().Syncer.SendChatStaleNotifications(ctx, uid, supdate, false)
	}
}

func (g *PushHandler) notifyReset(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID) {

	kuid := keybase1.UID(uid.String())
	if g.shouldSendNotifications() {
		g.G().NotifyRouter.HandleChatResetConversation(ctx, kuid, convID)
	} else {
		supdate := []chat1.ConversationStaleUpdate{chat1.ConversationStaleUpdate{
			ConvID:     convID,
			UpdateType: chat1.StaleUpdateType_NEWACTIVITY,
		}}
		g.G().Syncer.SendChatStaleNotifications(ctx, uid, supdate, false)
	}
}

func (g *PushHandler) notifyMembersUpdate(ctx context.Context, uid gregor1.UID,
	member chat1.ConversationMember, status chat1.ConversationMemberStatus) {

	unameFailed := false
	name, err := g.G().GetUPAKLoader().LookupUsername(ctx, keybase1.UID(member.Uid.String()))
	if err != nil {
		g.Debug(ctx, "notifyMembersUpdate: failed to lookup username for: %s msg: %s", member.Uid,
			err.Error())
		unameFailed = true
	}

	if !unameFailed {
		activity := chat1.NewChatActivityWithMembersUpdate(chat1.MembersUpdateInfo{
			ConvID: member.ConvID,
			Member: name.String(),
			Status: status,
		})
		g.notifyNewChatActivity(ctx, uid, member.ConvID, nil, &activity)
	} else {
		supdate := []chat1.ConversationStaleUpdate{chat1.ConversationStaleUpdate{
			ConvID:     member.ConvID,
			UpdateType: chat1.StaleUpdateType_NEWACTIVITY,
		}}
		g.G().Syncer.SendChatStaleNotifications(ctx, uid, supdate, false)
	}
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

func (g *PushHandler) UpgradeKBFSToImpteam(ctx context.Context, m gregor.OutOfBandMessage) (err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = Context(ctx, g.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, &identBreaks,
		g.identNotifier)
	defer g.Trace(ctx, func() error { return err }, "UpgradeKBFSToImpteam")()
	if m.Body() == nil {
		return errors.New("gregor handler for upgrade KBFS: nil message body")
	}

	var update chat1.KBFSImpteamUpgradeUpdate
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
	go func(ctx context.Context) (err error) {
		defer g.Trace(ctx, func() error { return err }, "UpgradeKBFSToImpteam(goroutine)")()
		<-cb
		g.Lock()
		defer g.Unlock()
		defer g.orderer.CompleteTurn(ctx, uid, update.InboxVers)

		if _, err = g.G().InboxSource.UpgradeKBFSToImpteam(ctx, uid, update.InboxVers,
			update.ConvID); err != nil {
			g.Debug(ctx, "UpgradeKBFSToImpteam: failed to update KBFS upgrade: %s", err)
			return err
		}

		// Just blow away anything we have locally, there might be unboxing errors in here during the
		// transition.
		if err = g.G().ConvSource.Clear(update.ConvID, uid); err != nil {
			g.Debug(ctx, "UpgradeKBFSToImpteam: failed to clear convsource: %s", err)
		}

		g.G().NotifyRouter.HandleChatKBFSToImpteamUpgrade(ctx, keybase1.UID(uid.String()), update.ConvID)

		return nil
	}(bctx)

	return nil
}

func (g *PushHandler) MembershipUpdate(ctx context.Context, m gregor.OutOfBandMessage) (err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = Context(ctx, g.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, &identBreaks,
		g.identNotifier)
	defer g.Trace(ctx, func() error { return err }, "MembershipUpdate")()
	if m.Body() == nil {
		return errors.New("gregor handler for membership update: nil message body")
	}

	var update chat1.UpdateConversationMembership
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
	go func(ctx context.Context) (err error) {
		defer g.Trace(ctx, func() error { return err }, "MembershipUpdate(goroutine)")()
		<-cb
		g.Lock()
		defer g.Unlock()
		defer g.orderer.CompleteTurn(ctx, uid, update.InboxVers)

		// Write out changes to local storage
		updateRes, err := g.G().InboxSource.MembershipUpdate(ctx, uid, update.InboxVers, update.Joined,
			update.Removed, update.Reset, update.Previewed)
		if err != nil {
			g.Debug(ctx, "MembershipUpdate: failed to update membership on inbox: %s", err.Error())
			return err
		}

		// Send out notifications
		for _, c := range updateRes.UserJoinedConvs {
			g.notifyJoinChannel(ctx, uid, c)
		}
		for _, c := range updateRes.UserRemovedConvs {
			g.notifyLeftChannel(ctx, uid, c)
		}
		for _, c := range updateRes.UserResetConvs {
			g.notifyReset(ctx, uid, c)
		}
		for _, cm := range updateRes.OthersJoinedConvs {
			g.notifyMembersUpdate(ctx, uid, cm, chat1.ConversationMemberStatus_ACTIVE)
		}
		for _, cm := range updateRes.OthersRemovedConvs {
			g.notifyMembersUpdate(ctx, uid, cm, chat1.ConversationMemberStatus_REMOVED)
		}
		for _, cm := range updateRes.OthersResetConvs {
			g.notifyMembersUpdate(ctx, uid, cm, chat1.ConversationMemberStatus_RESET)
		}

		// Fire off badger updates
		if g.badger != nil {
			if update.UnreadUpdate != nil {
				g.badger.PushChatUpdate(*update.UnreadUpdate, update.InboxVers)
			}
			for _, upd := range update.UnreadUpdates {
				g.badger.PushChatUpdate(upd, update.InboxVers)
			}
		}

		return nil
	}(bctx)

	return nil
}

func (g *PushHandler) TeamChannels(ctx context.Context, m gregor.OutOfBandMessage) (err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = Context(ctx, g.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, &identBreaks,
		g.identNotifier)
	defer g.Trace(ctx, func() error { return err }, "TeamChannels")()
	if m.Body() == nil {
		return errors.New("gregor handler for team channels update: nil message body")
	}

	var update chat1.TeamChannelUpdate
	reader := bytes.NewReader(m.Body().Bytes())
	dec := codec.NewDecoder(reader, &codec.MsgpackHandle{WriteExt: true})
	err = dec.Decode(&update)
	if err != nil {
		return err
	}

	g.G().TeamChannelSource.ChannelsChanged(ctx, update.TeamID)

	return nil
}

func (g *PushHandler) SetConvRetention(ctx context.Context, m gregor.OutOfBandMessage) (err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = Context(ctx, g.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, &identBreaks,
		g.identNotifier)
	defer g.Trace(ctx, func() error { return err }, "SetConvRetention")()
	if m.Body() == nil {
		return errors.New("gregor handler for SetConvRetention update: nil message body")
	}

	var update chat1.SetConvRetentionUpdate
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
		defer g.Trace(ctx, func() error { return err }, "SetConvRetention(goroutine)")()
		<-cb
		g.Lock()
		defer g.Unlock()
		defer g.orderer.CompleteTurn(ctx, uid, update.InboxVers)

		// Update inbox
		conv, err := g.G().InboxSource.SetConvRetention(ctx, m.UID().Bytes(), update.InboxVers,
			update.ConvID, update.Policy)
		if err != nil {
			g.Debug(ctx, "SetConvRetention: unable to update inbox: %s", err.Error())
			return
		}
		if conv == nil {
			return
		}
		// Send notify for the conv
		if conv.GetTopicType() == chat1.TopicType_CHAT {
			if g.shouldSendNotifications() {
				g.G().NotifyRouter.HandleChatSetConvRetention(ctx, keybase1.UID(uid.String()),
					conv.GetConvID(), g.presentUIItem(conv))
			} else {
				supdate := []chat1.ConversationStaleUpdate{chat1.ConversationStaleUpdate{
					ConvID:     conv.GetConvID(),
					UpdateType: chat1.StaleUpdateType_CLEAR,
				}}
				g.G().Syncer.SendChatStaleNotifications(ctx, uid, supdate, false)
			}
		}
	}(bctx)

	return nil
}

func (g *PushHandler) SetTeamRetention(ctx context.Context, m gregor.OutOfBandMessage) (err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = Context(ctx, g.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, &identBreaks,
		g.identNotifier)
	defer g.Trace(ctx, func() error { return err }, "SetTeamRetention")()
	if m.Body() == nil {
		return errors.New("gregor handler for SetTeamRetention update: nil message body")
	}

	var update chat1.SetTeamRetentionUpdate
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
		defer g.Trace(ctx, func() error { return err }, "SetTeamRetention(goroutine)")()
		<-cb
		g.Lock()
		defer g.Unlock()
		defer g.orderer.CompleteTurn(ctx, uid, update.InboxVers)

		// Update inbox
		var convs []chat1.ConversationLocal
		if convs, err = g.G().InboxSource.SetTeamRetention(ctx, m.UID().Bytes(), update.InboxVers,
			update.TeamID, update.Policy); err != nil {
			g.Debug(ctx, "SetTeamRetention: unable to update inbox: %s", err.Error())
			return
		}
		if len(convs) == 0 {
			g.Debug(ctx, "SetTeamRetention: no local convs affected")
			return
		}
		// Send notify for each conversation ID
		var convUIItems []chat1.InboxUIItem
		var staleUpdates []chat1.ConversationStaleUpdate
		for _, conv := range convs {
			if conv.GetTopicType() == chat1.TopicType_CHAT {
				convUIItems = append(convUIItems, *g.presentUIItem(&conv))
				staleUpdates = append(staleUpdates, chat1.ConversationStaleUpdate{
					ConvID:     conv.GetConvID(),
					UpdateType: chat1.StaleUpdateType_CLEAR,
				})
			}
		}

		if g.shouldSendNotifications() {
			g.G().NotifyRouter.HandleChatSetTeamRetention(ctx, keybase1.UID(uid.String()), update.TeamID, convUIItems)
		} else {
			g.G().Syncer.SendChatStaleNotifications(ctx, uid, staleUpdates, false)
		}

	}(bctx)

	return nil
}

func (g *PushHandler) HandleOobm(ctx context.Context, obm gregor.OutOfBandMessage) (bool, error) {
	if obm.System() == nil {
		return false, errors.New("nil system in out of band message")
	}

	switch obm.System().String() {
	case types.PushActivity:
		return true, g.Activity(ctx, obm)
	case types.PushTLFFinalize:
		return true, g.TlfFinalize(ctx, obm)
	case types.PushTLFResolve:
		return true, g.TlfResolve(ctx, obm)
	case types.PushTyping:
		return true, g.Typing(ctx, obm)
	case types.PushMembershipUpdate:
		return true, g.MembershipUpdate(ctx, obm)
	case types.PushTeamChannels:
		return true, g.TeamChannels(ctx, obm)
	case types.PushConvRetention:
		return true, g.SetConvRetention(ctx, obm)
	case types.PushTeamRetention:
		return true, g.SetTeamRetention(ctx, obm)
	case types.PushKBFSUpgrade:
		return true, g.UpgradeKBFSToImpteam(ctx, obm)
	}

	return false, nil
}
