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
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	"github.com/keybase/clockwork"
	"github.com/keybase/go-codec/codec"
	"golang.org/x/net/context"
)

var errPushOrdererMissingLatestInboxVersion = errors.New("no latest inbox version")

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
	ibox := storage.NewInbox(g.G())
	vers, err := ibox.Version(ctx, uid)
	if err != nil {
		return 0, err
	}
	if vers == 0 {
		return 0, errPushOrdererMissingLatestInboxVersion
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
	go func(ctx context.Context) {
		for _, w := range waiters {
			select {
			case <-w.cb:
			case <-ctx.Done():
				g.Debug(ctx, "waitOnWaiters: context cancelled: waiter: %d target: %d", vers, w.vers)
			}
		}
		close(res)
	}(globals.BackgroundChatCtx(ctx, g.G()))
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
	go func(ctx context.Context) {
		defer close(res)
		g.Lock()
		var dur time.Duration
		vers, err := g.latestInboxVersion(ctx, uid)
		if err != nil {
			if newVers >= 2 {
				// If we fail to get the inbox version, then the general goal is to just simulate like
				// we are looking for the previous update to the one we just got (newVers). In order to do
				// this, we act like our previous inbox version was just missing the inbox version one less
				// than newVers. That means we are waiting for this single update (which probably isn't
				// coming, we usually get here if we miss the inbox cache on disk).
				vers = newVers - 2
			} else {
				vers = 0
			}
			g.Debug(ctx, "WaitForTurn: failed to get current inbox version: %s, proceeding with vers %d",
				err, vers)
		}
		// add extra time if we are multiple updates behind
		dur = time.Duration(newVers-vers-1) * time.Second
		if dur < 0 {
			dur = 0
		}
		// cap at a minute
		if dur > time.Minute {
			dur = time.Minute
		}

		deadline = deadline.Add(dur)
		waiters := g.addToWaitersLocked(ctx, uid, vers, newVers)
		g.Unlock()
		if len(waiters) == 0 {
			return
		}
		waitBegin := g.clock.Now()
		g.Debug(ctx,
			"WaitForTurn: out of order update received, waiting on %d updates: vers: %d newVers: %d dur: %v",
			len(waiters), vers, newVers, dur+time.Second)
		ctx, cancel := context.WithCancel(ctx)
		defer cancel()
		select {
		case <-g.waitOnWaiters(ctx, newVers, waiters):
			g.Debug(ctx, "WaitForTurn: cleared by earlier messages: vers: %d wait: %v", newVers,
				g.clock.Now().Sub(waitBegin))
		case <-g.clock.AfterTime(deadline):
			g.Debug(ctx, "WaitForTurn: timeout reached, charging forward: vers: %d wait: %v", newVers,
				g.clock.Now().Sub(waitBegin))
			g.Lock()
			g.cleanupAfterTimeoutLocked(uid, newVers)
			g.Unlock()
		}
	}(globals.BackgroundChatCtx(ctx, g.G()))
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

	// testing only
	testingIgnoreBroadcasts bool
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

func (g *PushHandler) TlfFinalize(ctx context.Context, m gregor.OutOfBandMessage) (err error) {
	defer g.Trace(ctx, func() error { return err }, "TlfFinalize")()
	if m.Body() == nil {
		return errors.New("gregor handler for chat.tlffinalize: nil message body")
	}
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, g.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, &identBreaks,
		g.identNotifier)

	var update chat1.TLFFinalizeUpdate
	reader := bytes.NewReader(m.Body().Bytes())
	dec := codec.NewDecoder(reader, &codec.MsgpackHandle{WriteExt: true})
	if err = dec.Decode(&update); err != nil {
		return err
	}
	uid := gregor1.UID(m.UID().Bytes())

	// Order updates based on inbox version of the update from the server
	cb := g.orderer.WaitForTurn(ctx, uid, update.InboxVers)
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
			g.Debug(ctx, "tlf finalize: unable to update inbox: %v", err.Error())
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
			topicType := chat1.TopicType_NONE
			if conv != nil {
				topicType = conv.GetTopicType()
			}
			g.G().ActivityNotifier.TLFFinalize(ctx, uid,
				convID, topicType, update.FinalizeInfo, g.presentUIItem(ctx, conv, uid))
		}
	}(globals.BackgroundChatCtx(ctx, g.G()))

	return nil
}

func (g *PushHandler) TlfResolve(ctx context.Context, m gregor.OutOfBandMessage) (err error) {
	defer g.Trace(ctx, func() error { return err }, "TlfResolve")()
	if m.Body() == nil {
		return errors.New("gregor handler for chat.tlfresolve: nil message body")
	}
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, g.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, &identBreaks,
		g.identNotifier)

	var update chat1.TLFResolveUpdate
	reader := bytes.NewReader(m.Body().Bytes())
	dec := codec.NewDecoder(reader, &codec.MsgpackHandle{WriteExt: true})
	if err = dec.Decode(&update); err != nil {
		return err
	}
	uid := gregor1.UID(m.UID().Bytes())

	// Order updates based on inbox version of the update from the server
	cb := g.orderer.WaitForTurn(ctx, uid, update.InboxVers)
	go func(ctx context.Context) {
		defer g.Trace(ctx, func() error { return nil }, "TlfResolve(goroutine)")()
		<-cb
		g.Lock()
		defer g.Unlock()
		defer g.orderer.CompleteTurn(ctx, uid, update.InboxVers)
		// Get and localize the conversation to get the new tlfname.
		inbox, _, err := g.G().InboxSource.Read(ctx, uid, types.ConversationLocalizerBlocking,
			types.InboxSourceDataSourceAll, nil,
			&chat1.GetInboxLocalQuery{
				ConvIDs: []chat1.ConversationID{update.ConvID},
			}, nil)
		if err != nil {
			g.Debug(ctx, "resolve: unable to read conversation: %v", err.Error())
			return
		}
		if len(inbox.Convs) != 1 {
			g.Debug(ctx, "resolve: unable to find conversation, found: %d, expected 1", len(inbox.Convs))
			return
		}
		updateConv := inbox.Convs[0]

		resolveInfo := chat1.ConversationResolveInfo{
			NewTLFName: updateConv.Info.TlfName,
		}
		g.Debug(ctx, "TlfResolve: convID: %s new TLF name: %s", updateConv.GetConvID(),
			updateConv.Info.TlfName)
		g.G().ActivityNotifier.TLFResolve(ctx, uid,
			update.ConvID, updateConv.GetTopicType(), resolveInfo)
	}(globals.BackgroundChatCtx(ctx, g.G()))

	return nil
}

// squashChanMention will silence a chanMention if sent by a non-admin on a
// large (> chat1.MaxChanMentionConvSize member) team. The server drives this
// for mobile push notifications, client checks this for desktop notifications
func (g *PushHandler) squashChanMention(ctx context.Context, conv *chat1.ConversationLocal,
	mvalid chat1.MessageUnboxedValid) (bool, error) {
	// Verify the chanMention is for a TEAM that is larger than
	// MaxChanMentionConvSize
	if conv == nil ||
		conv.Info.MembersType != chat1.ConversationMembersType_TEAM ||
		len(conv.Info.Participants) < chat1.MaxChanMentionConvSize {
		return false, nil
	}
	teamID, err := keybase1.TeamIDFromString(mvalid.ClientHeader.Conv.Tlfid.String())
	if err != nil {
		return false, err
	}
	extG := g.G().ExternalG()
	team, err := teams.Load(ctx, extG, keybase1.LoadTeamArg{
		ID:     teamID,
		Public: mvalid.ClientHeader.TlfPublic,
	})
	if err != nil {
		return false, err
	}
	senderUID := keybase1.UID(mvalid.ClientHeader.Sender.String())
	upak, _, err := g.G().GetUPAKLoader().LoadV2(
		libkb.NewLoadUserByUIDArg(ctx, extG, senderUID))
	if err != nil {
		return false, err
	}
	uv := upak.Current.ToUserVersion()
	role, err := team.MemberRole(ctx, uv)
	if err != nil {
		return false, err
	}
	// if the sender is not an admin, large squash the mention.
	return !role.IsOrAbove(keybase1.TeamRole_ADMIN), nil
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
			g.Debug(ctx, "shouldDisplayDesktopNotification: failed to get message type: %v", err.Error())
			return false
		}
		apptype := keybase1.DeviceType_DESKTOP
		kind := chat1.NotificationKind_GENERIC
		if utils.IsNotifiableChatMessageType(typ, msg.Valid().AtMentions, msg.Valid().ChannelMention) {
			// Check to make sure this is an eligible reaction message
			if msg.GetMessageType() == chat1.MessageType_REACTION {
				g.Debug(ctx, "shouldDisplayDesktopNotification: checking reaction")
				supersedes, err := utils.GetSupersedes(msg)
				if err != nil || len(supersedes) == 0 {
					g.Debug(ctx, "shouldDisplayDesktopNotification: failed to get supersedes id from reaction, skipping: %v", err)
					return false
				}
				supersedesMsg, err := g.G().ConvSource.GetMessages(ctx, conv, uid, supersedes, nil)
				if err != nil || len(supersedesMsg) == 0 || !supersedesMsg[0].IsValid() {
					g.Debug(ctx, "shouldDisplayDesktopNotification: failed to get supersedes message from reaction, skipping: %v", err)
					return false
				}
				if !supersedesMsg[0].Valid().ClientHeader.Sender.Eq(uid) {
					g.Debug(ctx, "shouldDisplayDesktopNotification: skipping reaction post, not sender")
					return false
				}
			}

			// Check for generic hit on desktop right off and return true if we hit
			if conv.Notifications.Settings[apptype][kind] {
				return true
			}
			for _, at := range msg.Valid().AtMentions {
				if at.Eq(uid) {
					kind = chat1.NotificationKind_ATMENTION
					break
				}
			}
			chanMention := msg.Valid().ChannelMention
			notifyFromChanMention := false
			switch chanMention {
			case chat1.ChannelMention_HERE, chat1.ChannelMention_ALL:
				notifyFromChanMention = conv.Notifications.ChannelWide
				shouldSquash, err := g.squashChanMention(ctx, conv, msg.Valid())
				if err != nil {
					g.Debug(ctx, "shouldDisplayDesktopNotification: failed to squashChanMention: %v", err)
				}
				if shouldSquash {
					notifyFromChanMention = false
				}
			}
			return conv.Notifications.Settings[apptype][kind] || notifyFromChanMention
		}
	}
	return false
}

func (g *PushHandler) presentUIItem(ctx context.Context, conv *chat1.ConversationLocal, uid gregor1.UID) (res *chat1.InboxUIItem) {
	if conv != nil {
		return PresentConversationLocalWithFetchRetry(ctx, g.G(), uid, *conv)
	}
	return res
}

func (g *PushHandler) getSupersedesTarget(ctx context.Context, uid gregor1.UID,
	conv *chat1.ConversationLocal, msg chat1.MessageUnboxed) (res *chat1.UIMessage) {
	if !msg.IsValid() || conv == nil {
		return nil
	}
	switch msg.GetMessageType() {
	case chat1.MessageType_EDIT:
		targetMsgID := msg.Valid().MessageBody.Edit().MessageID
		msgs, err := g.G().ConvSource.GetMessages(ctx, conv, uid, []chat1.MessageID{targetMsgID}, nil)
		if err != nil {
			g.Debug(ctx, "getSupersedesTarget: failed to get message: %v", err)
			return nil
		}
		msgs, err = g.G().ConvSource.TransformSupersedes(ctx, conv, uid, msgs, nil, nil, nil)
		if err != nil || len(msgs) == 0 {
			g.Debug(ctx, "getSupersedesTarget: failed to get xform'd message: %v", err)
			return nil
		}
		uiMsg := utils.PresentMessageUnboxed(ctx, g.G(), msgs[0], uid, conv.GetConvID())
		return &uiMsg
	}
	return nil
}

func (g *PushHandler) getReplyMessage(ctx context.Context, uid gregor1.UID, conv *chat1.ConversationLocal,
	msg chat1.MessageUnboxed) (chat1.MessageUnboxed, error) {
	if conv == nil {
		return msg, nil
	}
	return NewReplyFiller(g.G()).FillSingle(ctx, uid, conv, msg)
}

func (g *PushHandler) Activity(ctx context.Context, m gregor.OutOfBandMessage) (err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, g.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, &identBreaks,
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
	if err = dec.Decode(&gm); err != nil {
		g.Debug(ctx, "chat activity: failed to decode into generic payload: %v", err)
		return err
	}
	convID := gm.ConvID
	g.Debug(ctx, "chat activity: action %s vers: %d convID: %s", gm.Action, gm.InboxVers, convID)

	// Order updates based on inbox version of the update from the server
	cb := g.orderer.WaitForTurn(ctx, uid, gm.InboxVers)
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
			if err = dec.Decode(&nm); err != nil {
				g.Debug(ctx, "chat activity: error decoding newMessage: %v", err)
				return
			}
			g.Debug(ctx, "chat activity: newMessage: convID: %s sender: %s msgID: %d typ: %v",
				nm.ConvID, nm.Message.ClientHeader.Sender, nm.Message.GetMessageID(),
				nm.Message.GetMessageType())
			if nm.Message.ClientHeader.OutboxID != nil {
				g.Debug(ctx, "chat activity: newMessage: outboxID: %s",
					hex.EncodeToString(*nm.Message.ClientHeader.OutboxID))
			} else {
				g.Debug(ctx, "chat activity: newMessage: outboxID is empty")
			}

			// Coin flip manager can completely handle the incoming message
			if g.G().CoinFlipManager.MaybeInjectFlipMessage(ctx, nm.Message, nm.InboxVers, uid, nm.ConvID,
				nm.TopicType) {
				g.Debug(ctx, "chat activity: flip message handled, early out")
				return
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
				if err := g.G().InboxSource.UpdateInboxVersion(ctx, uid, nm.InboxVers); err != nil {
					g.Debug(ctx, "chat activity: failed to update inbox version: %s", err)
				}
				return
			}

			decmsg, appended, pushErr := g.G().ConvSource.Push(ctx, nm.ConvID, gregor1.UID(uid), nm.Message)
			if pushErr != nil {
				g.Debug(ctx, "chat activity: unable to push message: %v", pushErr)
			}
			if conv, err = g.G().InboxSource.NewMessage(ctx, uid, nm.InboxVers, nm.ConvID,
				nm.Message, nm.MaxMsgs); err != nil {
				g.Debug(ctx, "chat activity: unable to update inbox: %v", err)
			}
			// Add on reply information if we have it
			if pushErr == nil {
				decmsg, pushErr = g.getReplyMessage(ctx, uid, conv, decmsg)
				if pushErr != nil {
					g.Debug(ctx, "chat activity: failed to get reply for push: %s", err)
				}
			}

			// If we have no error on this message, then notify the frontend
			if pushErr == nil {
				// Make a pagination object so client can use it in GetThreadLocal
				pmsgs := []pager.Message{nm.Message}
				pager := pager.NewThreadPager()
				page, err := pager.MakePage(pmsgs, 1, 0)
				if err != nil {
					g.Debug(ctx, "chat activity: error making page: %v", err)
				}

				desktopNotification := g.shouldDisplayDesktopNotification(ctx, uid, conv, decmsg)
				notificationSnippet := ""
				if desktopNotification {
					plaintextDesktopDisabled, err := getPlaintextDesktopDisabled(ctx, g.G())
					if err != nil {
						g.Debug(ctx, "chat activity: unable to get app notification settings: %v defaulting to disable plaintext", err)
					}
					notificationSnippet = utils.GetDesktopNotificationSnippet(conv,
						g.G().Env.GetUsername().String(), &decmsg, plaintextDesktopDisabled)
				}
				activity = new(chat1.ChatActivity)
				*activity = chat1.NewChatActivityWithIncomingMessage(chat1.IncomingMessage{
					Message:                    utils.PresentMessageUnboxed(ctx, g.G(), decmsg, uid, nm.ConvID),
					ModifiedMessage:            g.getSupersedesTarget(ctx, uid, conv, decmsg),
					ConvID:                     nm.ConvID,
					Conv:                       g.presentUIItem(ctx, conv, uid),
					DisplayDesktopNotification: desktopNotification,
					DesktopNotificationSnippet: notificationSnippet,
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
			if err = dec.Decode(&nm); err != nil {
				g.Debug(ctx, "chat activity: error decoding: %v", err)
				return
			}
			g.Debug(ctx, "chat activity: readMessage: convID: %s msgID: %d", nm.ConvID, nm.MsgID)

			uid := m.UID().Bytes()
			if conv, err = g.G().InboxSource.ReadMessage(ctx, uid, nm.InboxVers, nm.ConvID, nm.MsgID); err != nil {
				g.Debug(ctx, "chat activity: unable to update inbox: %v", err)
			}
			activity = new(chat1.ChatActivity)
			*activity = chat1.NewChatActivityWithReadMessage(chat1.ReadMessageInfo{
				MsgID:  nm.MsgID,
				ConvID: nm.ConvID,
				Conv:   g.presentUIItem(ctx, conv, uid),
			})
		case types.ActionSetStatus:
			var nm chat1.SetStatusPayload
			if err = dec.Decode(&nm); err != nil {
				g.Debug(ctx, "chat activity: error decoding: %v", err)
				return
			}
			g.Debug(ctx, "chat activity: setStatus: convID: %s status: %d", nm.ConvID, nm.Status)

			uid := m.UID().Bytes()
			if conv, err = g.G().InboxSource.SetStatus(ctx, uid, nm.InboxVers, nm.ConvID, nm.Status); err != nil {
				g.Debug(ctx, "chat activity: unable to update inbox: %v", err)
			}
			activity = new(chat1.ChatActivity)
			*activity = chat1.NewChatActivityWithSetStatus(chat1.SetStatusInfo{
				ConvID: nm.ConvID,
				Status: nm.Status,
				Conv:   g.presentUIItem(ctx, conv, uid),
			})
		case types.ActionSetAppNotificationSettings:
			var nm chat1.SetAppNotificationSettingsPayload
			if err = dec.Decode(&nm); err != nil {
				g.Debug(ctx, "chat activity: error decoding: %v", err)
				return
			}
			g.Debug(ctx, "chat activity: setAppNotificationSettings: convID: %s num settings: %d",
				nm.ConvID, len(nm.Settings.Settings))

			uid := m.UID().Bytes()
			if _, err = g.G().InboxSource.SetAppNotificationSettings(ctx, uid, nm.InboxVers,
				nm.ConvID, nm.Settings); err != nil {
				g.Debug(ctx, "chat activity: unable to update inbox: %v", err)
			}
			info := chat1.SetAppNotificationSettingsInfo{
				ConvID:   nm.ConvID,
				Settings: nm.Settings,
			}
			activity = new(chat1.ChatActivity)
			*activity = chat1.NewChatActivityWithSetAppNotificationSettings(info)
		case types.ActionNewConversation:
			var nm chat1.NewConversationPayload
			if err = dec.Decode(&nm); err != nil {
				g.Debug(ctx, "chat activity: error decoding: %v", err)
				return
			}
			g.Debug(ctx, "chat activity: newConversation: convID: %s ", nm.ConvID)

			uid := m.UID().Bytes()

			// If the topic type is not CHAT or KBFSFILEEDIT, skip the
			// localization step
			var inbox types.Inbox
			switch nm.TopicType {
			case chat1.TopicType_CHAT, chat1.TopicType_KBFSFILEEDIT:
				if inbox, _, err = g.G().InboxSource.Read(ctx, uid, types.ConversationLocalizerBlocking,
					types.InboxSourceDataSourceRemoteOnly,
					nil, &chat1.GetInboxLocalQuery{
						ConvIDs:      []chat1.ConversationID{nm.ConvID},
						MemberStatus: chat1.AllConversationMemberStatuses(),
					}, nil); err != nil {
					g.Debug(ctx, "chat activity: unable to read conversation: %v", err)
					return
				}
			default:
				if inbox, err = g.G().InboxSource.ReadUnverified(ctx, uid,
					types.InboxSourceDataSourceRemoteOnly,
					&chat1.GetInboxQuery{
						ConvIDs:      []chat1.ConversationID{nm.ConvID},
						MemberStatus: chat1.AllConversationMemberStatuses(),
					}, nil); err != nil {
					g.Debug(ctx, "chat activity: unable to read unverified conversation: %v", err)
					return
				}
			}

			if len(inbox.ConvsUnverified) != 1 {
				g.Debug(ctx, "chat activity: unable to find conversation, found: %d, expected 1", len(inbox.Convs))
				return
			}

			updateConv := inbox.ConvsUnverified[0].Conv
			if err = g.G().InboxSource.NewConversation(ctx, uid, nm.InboxVers, updateConv); err != nil {
				g.Debug(ctx, "chat activity: unable to update inbox: %v", err)
			}
			switch memberStatus := updateConv.ReaderInfo.Status; memberStatus {
			case chat1.ConversationMemberStatus_LEFT, chat1.ConversationMemberStatus_NEVER_JOINED:
				g.Debug(ctx, "chat activity: newConversation: suppressing ChatActivity, membersStatus: %v", memberStatus)
			default:
				var conv *chat1.ConversationLocal
				if len(inbox.Convs) == 1 {
					conv = &inbox.Convs[0]
				}
				activity = new(chat1.ChatActivity)
				*activity = chat1.NewChatActivityWithNewConversation(chat1.NewConversationInfo{
					Conv:   g.presentUIItem(ctx, conv, uid),
					ConvID: updateConv.GetConvID(),
				})
			}
		case types.ActionTeamType:
			var nm chat1.TeamTypePayload
			if err = dec.Decode(&nm); err != nil {
				g.Debug(ctx, "chat activity: error decoding: %v", err)
				return
			}
			g.Debug(ctx, "chat activity: team type: convID: %s ", nm.ConvID)

			uid := m.UID().Bytes()
			if conv, err = g.G().InboxSource.TeamTypeChanged(ctx, uid, nm.InboxVers, nm.ConvID, nm.TeamType); err != nil {
				g.Debug(ctx, "chat activity: unable to update inbox: %v", err)
			}
			activity = new(chat1.ChatActivity)
			*activity = chat1.NewChatActivityWithTeamtype(chat1.TeamTypeInfo{
				ConvID:   nm.ConvID,
				TeamType: nm.TeamType,
				Conv:     g.presentUIItem(ctx, conv, uid),
			})
		case types.ActionExpunge:
			var nm chat1.ExpungePayload
			if err = dec.Decode(&nm); err != nil {
				g.Debug(ctx, "chat activity: error decoding: %v", err)
				return
			}
			g.Debug(ctx, "chat activity: expunge: convID: %s expunge: %v",
				nm.ConvID, nm.Expunge)
			uid := m.UID().Bytes()
			if err = g.G().ConvSource.Expunge(ctx, nm.ConvID, uid, nm.Expunge); err != nil {
				g.Debug(ctx, "chat activity: unable to update conv: %v", err)
			}
			if _, err = g.G().InboxSource.Expunge(ctx, uid, nm.InboxVers, nm.ConvID, nm.Expunge, nm.MaxMsgs); err != nil {
				g.Debug(ctx, "chat activity: unable to update inbox: %v", err)
			}
		default:
			g.Debug(ctx, "unhandled chat.activity action %q", action)
			return
		}
		if g.badger != nil && gm.UnreadUpdate != nil {
			g.badger.PushChatUpdate(ctx, *gm.UnreadUpdate, gm.InboxVers)
		}
		if activity != nil {
			g.notifyNewChatActivity(ctx, m.UID().(gregor1.UID), gm.TopicType, activity)
		} else {
			g.Debug(ctx, "chat activity: skipping notify, activity is nil")
		}
	}(globals.BackgroundChatCtx(ctx, g.G()))
	return nil
}

func (g *PushHandler) notifyNewChatActivity(ctx context.Context, uid gregor1.UID,
	topicType chat1.TopicType, activity *chat1.ChatActivity) {
	g.G().ActivityNotifier.Activity(ctx, uid, topicType, activity, chat1.ChatActivitySource_REMOTE)
}

func (g *PushHandler) notifyJoinChannel(ctx context.Context, uid gregor1.UID,
	conv chat1.ConversationLocal) {
	g.G().ActivityNotifier.JoinedConversation(ctx, uid, conv.GetConvID(),
		conv.GetTopicType(), g.presentUIItem(ctx, &conv, uid))
}

func (g *PushHandler) notifyLeftChannel(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID, topicType chat1.TopicType) {
	g.G().ActivityNotifier.LeftConversation(ctx, uid, convID, topicType)
}

func (g *PushHandler) notifyReset(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID, topicType chat1.TopicType) {
	g.G().ActivityNotifier.ResetConversation(ctx, uid, convID, topicType)
}

func (g *PushHandler) notifyMembersUpdate(ctx context.Context, uid gregor1.UID,
	membersRes types.MembershipUpdateRes) {
	// Build a map of uid -> username for this update
	var uids []keybase1.UID
	for _, uid := range membersRes.AllOtherUsers() {
		uids = append(uids, keybase1.UID(uid.String()))
	}
	uidMap := make(map[string]string)
	packages, err := g.G().UIDMapper.MapUIDsToUsernamePackages(ctx, g.G(), uids, 0, 0, false)
	if err == nil {
		for index, p := range packages {
			uidMap[uids[index].String()] = p.NormalizedUsername.String()
		}
	} else {
		g.Debug(ctx, "notifyMembersUpdate: failed to get usernames, not sending them: %v", err)
	}
	convMap := make(map[string][]chat1.MemberInfo)
	addStatus := func(status chat1.ConversationMemberStatus, l []chat1.ConversationMember) {
		for _, cm := range l {
			if cm.TopicType != chat1.TopicType_CHAT {
				continue
			}
			if _, ok := convMap[cm.ConvID.String()]; !ok {
				convMap[cm.ConvID.String()] = []chat1.MemberInfo{}
			}
			if uname, ok := uidMap[cm.Uid.String()]; ok {
				convMap[cm.ConvID.String()] = append(convMap[cm.ConvID.String()], chat1.MemberInfo{
					Member: uname,
					Status: status,
				})
			}
		}
	}
	addStatus(chat1.ConversationMemberStatus_ACTIVE, membersRes.OthersJoinedConvs)
	addStatus(chat1.ConversationMemberStatus_RESET, membersRes.OthersResetConvs)
	addStatus(chat1.ConversationMemberStatus_REMOVED, membersRes.OthersRemovedConvs)
	for strConvID, memberInfo := range convMap {
		bConvID, _ := hex.DecodeString(strConvID)
		convID := chat1.ConversationID(bConvID)
		activity := chat1.NewChatActivityWithMembersUpdate(chat1.MembersUpdateInfo{
			ConvID:  convID,
			Members: memberInfo,
		})
		g.notifyNewChatActivity(ctx, uid, chat1.TopicType_CHAT, &activity)
	}
}

func (g *PushHandler) notifyConversationsUpdate(ctx context.Context, uid gregor1.UID,
	updates []chat1.ConversationUpdate) {
	var supdate []chat1.ConversationStaleUpdate
	for _, update := range updates {
		supdate = append(supdate, chat1.ConversationStaleUpdate{
			ConvID:     update.ConvID,
			UpdateType: chat1.StaleUpdateType_CLEAR,
		})
	}
	g.G().Syncer.SendChatStaleNotifications(ctx, uid, supdate, true)
}

func (g *PushHandler) Typing(ctx context.Context, m gregor.OutOfBandMessage) (err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, g.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, &identBreaks,
		g.identNotifier)
	defer g.Trace(ctx, func() error { return err }, "Typing")()
	if m.Body() == nil {
		return errors.New("gregor handler for typing: nil message body")
	}

	var update chat1.RemoteUserTypingUpdate
	reader := bytes.NewReader(m.Body().Bytes())
	dec := codec.NewDecoder(reader, &codec.MsgpackHandle{WriteExt: true})
	if err = dec.Decode(&update); err != nil {
		return err
	}

	// Lookup username and device name
	kuid := keybase1.UID(update.Uid.String())
	kdid := keybase1.DeviceID(update.DeviceID.String())
	user, device, dtype, err := g.G().GetUPAKLoader().LookupUsernameAndDevice(ctx, kuid, kdid)
	if err != nil {
		g.Debug(ctx, "Typing: failed to lookup username/device: msg: %v", err)
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
	ctx = globals.ChatCtx(ctx, g.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, &identBreaks,
		g.identNotifier)
	defer g.Trace(ctx, func() error { return err }, "UpgradeKBFSToImpteam")()
	if m.Body() == nil {
		return errors.New("gregor handler for upgrade KBFS: nil message body")
	}

	var update chat1.KBFSImpteamUpgradeUpdate
	reader := bytes.NewReader(m.Body().Bytes())
	dec := codec.NewDecoder(reader, &codec.MsgpackHandle{WriteExt: true})
	if err = dec.Decode(&update); err != nil {
		return err
	}
	uid := gregor1.UID(m.UID().Bytes())

	// Order updates based on inbox version of the update from the server
	cb := g.orderer.WaitForTurn(ctx, uid, update.InboxVers)
	go func(ctx context.Context) (err error) {
		defer g.Trace(ctx, func() error { return err }, "UpgradeKBFSToImpteam(goroutine)")()
		<-cb
		g.Lock()
		defer g.Unlock()
		defer g.orderer.CompleteTurn(ctx, uid, update.InboxVers)

		if _, err = g.G().InboxSource.UpgradeKBFSToImpteam(ctx, uid, update.InboxVers,
			update.ConvID); err != nil {
			g.Debug(ctx, "UpgradeKBFSToImpteam: failed to update KBFS upgrade: %v", err)
			return err
		}

		// Just blow away anything we have locally, there might be unboxing errors in here during the
		// transition.
		if err = g.G().ConvSource.Clear(ctx, update.ConvID, uid); err != nil {
			g.Debug(ctx, "UpgradeKBFSToImpteam: failed to clear convsource: %v", err)
		}
		g.G().ActivityNotifier.KBFSToImpteamUpgrade(ctx, uid, update.ConvID, update.TopicType)
		return nil
	}(globals.BackgroundChatCtx(ctx, g.G()))

	return nil
}

func (g *PushHandler) MembershipUpdate(ctx context.Context, m gregor.OutOfBandMessage) (err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, g.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, &identBreaks,
		g.identNotifier)
	defer g.Trace(ctx, func() error { return err }, "MembershipUpdate")()
	if m.Body() == nil {
		return errors.New("gregor handler for membership update: nil message body")
	}

	var update chat1.UpdateConversationMembership
	reader := bytes.NewReader(m.Body().Bytes())
	dec := codec.NewDecoder(reader, &codec.MsgpackHandle{WriteExt: true})
	if err = dec.Decode(&update); err != nil {
		return err
	}
	uid := gregor1.UID(m.UID().Bytes())

	// Order updates based on inbox version of the update from the server
	cb := g.orderer.WaitForTurn(ctx, uid, update.InboxVers)
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
			g.Debug(ctx, "MembershipUpdate: failed to update membership on inbox: %v", err)
			return err
		}

		// Send out notifications
		for _, c := range updateRes.UserJoinedConvs {
			g.notifyJoinChannel(ctx, uid, c)
		}
		for _, c := range updateRes.UserRemovedConvs {
			g.notifyLeftChannel(ctx, uid, c.ConvID, c.TopicType)
		}
		for _, c := range updateRes.UserResetConvs {
			g.notifyReset(ctx, uid, c.ConvID, c.TopicType)
		}
		g.notifyMembersUpdate(ctx, uid, updateRes)

		// Fire off badger updates
		if g.badger != nil {
			if update.UnreadUpdate != nil {
				g.badger.PushChatUpdate(ctx, *update.UnreadUpdate, update.InboxVers)
			}
			for _, upd := range update.UnreadUpdates {
				g.badger.PushChatUpdate(ctx, upd, update.InboxVers)
			}
		}

		return nil
	}(globals.BackgroundChatCtx(ctx, g.G()))

	return nil
}

func (g *PushHandler) ConversationsUpdate(ctx context.Context, m gregor.OutOfBandMessage) (err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, g.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, &identBreaks,
		g.identNotifier)
	defer g.Trace(ctx, func() error { return err }, "ConversationsUpdate")()
	if m.Body() == nil {
		return errors.New("gregor handler for conversations update: nil message body")
	}

	var update chat1.UpdateConversations
	reader := bytes.NewReader(m.Body().Bytes())
	dec := codec.NewDecoder(reader, &codec.MsgpackHandle{WriteExt: true})
	if err = dec.Decode(&update); err != nil {
		return err
	}
	uid := gregor1.UID(m.UID().Bytes())

	// Order updates based on inbox version of the update from the server
	cb := g.orderer.WaitForTurn(ctx, uid, update.InboxVers)
	go func(ctx context.Context) (err error) {
		defer g.Trace(ctx, func() error { return err }, "ConversationsUpdate(goroutine)")()
		<-cb
		g.Lock()
		defer g.Unlock()
		defer g.orderer.CompleteTurn(ctx, uid, update.InboxVers)

		// Write out changes to local storage
		if err := g.G().InboxSource.ConversationsUpdate(ctx, uid, update.InboxVers, update.ConvUpdates); err != nil {
			g.Debug(ctx, "ConversationsUpdate: failed to update membership on inbox: %v", err)
			return err
		}

		// Send out notifications
		g.notifyConversationsUpdate(ctx, uid, update.ConvUpdates)
		return nil
	}(globals.BackgroundChatCtx(ctx, g.G()))

	return nil
}

func (g *PushHandler) SetConvRetention(ctx context.Context, m gregor.OutOfBandMessage) (err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, g.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, &identBreaks,
		g.identNotifier)
	defer g.Trace(ctx, func() error { return err }, "SetConvRetention")()
	if m.Body() == nil {
		return errors.New("gregor handler for SetConvRetention update: nil message body")
	}

	var update chat1.SetConvRetentionUpdate
	reader := bytes.NewReader(m.Body().Bytes())
	dec := codec.NewDecoder(reader, &codec.MsgpackHandle{WriteExt: true})
	if err = dec.Decode(&update); err != nil {
		return err
	}
	uid := gregor1.UID(m.UID().Bytes())

	// Order updates based on inbox version of the update from the server
	cb := g.orderer.WaitForTurn(ctx, uid, update.InboxVers)
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
			g.Debug(ctx, "SetConvRetention: unable to update inbox: %v", err)
			return
		}
		if conv == nil {
			return
		}
		// Send notify for the conv
		g.G().ActivityNotifier.SetConvRetention(ctx, uid,
			conv.GetConvID(), conv.GetTopicType(), g.presentUIItem(ctx, conv, uid))
	}(globals.BackgroundChatCtx(ctx, g.G()))

	return nil
}

func (g *PushHandler) SetTeamRetention(ctx context.Context, m gregor.OutOfBandMessage) (err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, g.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, &identBreaks,
		g.identNotifier)
	defer g.Trace(ctx, func() error { return err }, "SetTeamRetention")()
	if m.Body() == nil {
		return errors.New("gregor handler for SetTeamRetention update: nil message body")
	}

	var update chat1.SetTeamRetentionUpdate
	reader := bytes.NewReader(m.Body().Bytes())
	dec := codec.NewDecoder(reader, &codec.MsgpackHandle{WriteExt: true})
	if err = dec.Decode(&update); err != nil {
		return err
	}
	uid := gregor1.UID(m.UID().Bytes())

	// Order updates based on inbox version of the update from the server
	cb := g.orderer.WaitForTurn(ctx, uid, update.InboxVers)
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
			g.Debug(ctx, "SetTeamRetention: unable to update inbox: %v", err)
			return
		}
		if len(convs) == 0 {
			g.Debug(ctx, "SetTeamRetention: no local convs affected")
			return
		}
		// Send notify for each conversation ID
		convUIItems := make(map[chat1.TopicType][]chat1.InboxUIItem)
		for _, conv := range convs {
			uiItem := g.presentUIItem(ctx, &conv, uid)
			if uiItem != nil {
				convUIItems[uiItem.TopicType] = append(convUIItems[uiItem.TopicType], *uiItem)
			}
		}
		for topicType, items := range convUIItems {
			g.G().ActivityNotifier.SetTeamRetention(ctx, uid, update.TeamID, topicType, items)
		}
	}(globals.BackgroundChatCtx(ctx, g.G()))

	return nil
}

func (g *PushHandler) SetConvSettings(ctx context.Context, m gregor.OutOfBandMessage) (err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = globals.ChatCtx(ctx, g.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, &identBreaks,
		g.identNotifier)
	defer g.Trace(ctx, func() error { return err }, "SetConvSettings")()
	if m.Body() == nil {
		return errors.New("gregor handler for SetConvSettings update: nil message body")
	}

	var update chat1.SetConvSettingsUpdate
	reader := bytes.NewReader(m.Body().Bytes())
	dec := codec.NewDecoder(reader, &codec.MsgpackHandle{WriteExt: true})
	if err = dec.Decode(&update); err != nil {
		return err
	}
	uid := gregor1.UID(m.UID().Bytes())

	// Order updates based on inbox version of the update from the server
	cb := g.orderer.WaitForTurn(ctx, uid, update.InboxVers)
	go func(ctx context.Context) {
		defer g.Trace(ctx, func() error { return err }, "SetConvSettings(goroutine)")()
		<-cb
		g.Lock()
		defer g.Unlock()
		defer g.orderer.CompleteTurn(ctx, uid, update.InboxVers)

		// Update inbox
		conv, err := g.G().InboxSource.SetConvSettings(ctx, m.UID().Bytes(), update.InboxVers,
			update.ConvID, update.ConvSettings)
		if err != nil {
			g.Debug(ctx, "SetConvSettings: unable to update inbox: %v", err)
			return
		}
		if conv == nil {
			return
		}
		// Send notify for the conv
		g.G().ActivityNotifier.SetConvSettings(ctx, uid,
			conv.GetConvID(), conv.GetTopicType(), g.presentUIItem(ctx, conv, uid))
	}(globals.BackgroundChatCtx(ctx, g.G()))

	return nil
}

func (g *PushHandler) SubteamRename(ctx context.Context, m gregor.OutOfBandMessage) (err error) {
	defer g.Trace(ctx, func() error { return err }, "SubteamRename")()
	if m.Body() == nil {
		return errors.New("gregor handler for chat.subteamRename: nil message body")
	}

	var update chat1.SubteamRenameUpdate
	reader := bytes.NewReader(m.Body().Bytes())
	dec := codec.NewDecoder(reader, &codec.MsgpackHandle{WriteExt: true})
	if err = dec.Decode(&update); err != nil {
		return err
	}
	uid := gregor1.UID(m.UID().Bytes())

	// Order updates based on inbox version of the update from the server
	cb := g.orderer.WaitForTurn(ctx, uid, update.InboxVers)
	go func(ctx context.Context) {
		defer g.Trace(ctx, func() error { return nil }, "SubteamRename(goroutine)")()
		<-cb
		g.Lock()
		defer g.Unlock()
		defer g.orderer.CompleteTurn(ctx, uid, update.InboxVers)
		// Update inbox and get conversations
		convs, err := g.G().InboxSource.SubteamRename(ctx, uid, update.InboxVers, update.ConvIDs)
		if err != nil {
			g.Debug(ctx, "SubteamRename: unable to read conversation: %v", err)
			return
		}
		if len(convs) != len(update.ConvIDs) {
			g.Debug(ctx, "SubteamRename: unable to find all conversations")
		}

		convUIItems := make(map[chat1.TopicType][]chat1.InboxUIItem)
		convIDs := make(map[chat1.TopicType][]chat1.ConversationID)
		tlfIDs := make(map[string]struct{})
		for _, conv := range convs {
			tlfIDs[conv.Info.Triple.Tlfid.String()] = struct{}{}
			uiItem := g.presentUIItem(ctx, &conv, uid)
			if uiItem != nil {
				convUIItems[uiItem.TopicType] = append(convUIItems[uiItem.TopicType], *uiItem)
				convIDs[uiItem.TopicType] = append(convIDs[uiItem.TopicType], conv.GetConvID())
			}
		}

		// force refresh any affected teams
		m := libkb.NewMetaContext(ctx, g.G().ExternalG())
		for tlfID := range tlfIDs {
			teamID, err := keybase1.TeamIDFromString(tlfID)
			if err != nil {
				g.Debug(ctx, "SubteamRename: unable to get teamID: %v", err)
				continue
			}

			_, err = m.G().GetFastTeamLoader().Load(m, keybase1.FastTeamLoadArg{
				ID:           teamID,
				Public:       teamID.IsPublic(),
				ForceRefresh: true,
			})
			if err != nil {
				g.Debug(ctx, "SubteamRename: unable to force-refresh team: %v", err)
				continue
			}
		}
		for topicType, items := range convUIItems {
			cids := convIDs[topicType]
			g.G().ActivityNotifier.SubteamRename(ctx, uid, cids, topicType, items)
		}
	}(globals.BackgroundChatCtx(ctx, g.G()))

	return nil
}

func (g *PushHandler) HandleOobm(ctx context.Context, obm gregor.OutOfBandMessage) (bool, error) {
	if g.testingIgnoreBroadcasts {
		return false, errors.New("ignoring broadcasts for tests")
	}
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
	case types.PushConvRetention:
		return true, g.SetConvRetention(ctx, obm)
	case types.PushTeamRetention:
		return true, g.SetTeamRetention(ctx, obm)
	case types.PushConvSettings:
		return true, g.SetConvSettings(ctx, obm)
	case types.PushKBFSUpgrade:
		return true, g.UpgradeKBFSToImpteam(ctx, obm)
	case types.PushSubteamRename:
		return true, g.SubteamRename(ctx, obm)
	case types.PushConversationsUpdate:
		return true, g.ConversationsUpdate(ctx, obm)
	}

	return false, nil
}
