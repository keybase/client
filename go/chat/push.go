package chat

import (
	"bytes"
	"context"
	"encoding/hex"
	"errors"
	"fmt"
	"sync"
	"time"

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
)

type messageWaiterEntry struct {
	vers chat1.InboxVers
	cb   chan struct{}
}

type gregorMessageOrderer struct {
	globals.Contextified
	utils.DebugLabeler
	sync.Mutex

	clock clockwork.Clock
	//TODO: parameterize by uid
	waiters map[chat1.InboxVers][]messageWaiterEntry
}

func newGregorMessageOrderer(g *globals.Context) *gregorMessageOrderer {
	return &gregorMessageOrderer{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g, "gregorMessageOrderer", false),
		waiters:      make(map[chat1.InboxVers][]messageWaiterEntry),
		clock:        clockwork.NewRealClock(),
	}
}

func (g *gregorMessageOrderer) latestInboxVersion(ctx context.Context, uid gregor1.UID) (chat1.InboxVers, error) {
	ibox := storage.NewInbox(g.G(), uid)
	vers, err := ibox.Version(ctx)
	if err != nil {
		return 0, err
	}
	return vers, nil
}

func (g *gregorMessageOrderer) addToWaitersLocked(ctx context.Context, storedVers,
	msgVers chat1.InboxVers) (res []messageWaiterEntry) {
	for i := storedVers + 1; i < msgVers; i++ {
		entry := messageWaiterEntry{
			vers: msgVers,
			cb:   make(chan struct{}),
		}
		res = append(res, entry)
		g.waiters[i] = append(g.waiters[i], entry)
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

func (g *gregorMessageOrderer) WaitForTurn(ctx context.Context, uid gregor1.UID,
	payload chat1.GenericPayload) (res chan struct{}) {
	res = make(chan struct{})
	// Grab latest inbox version if we can
	vers, err := g.latestInboxVersion(ctx, uid)
	if err != nil {
		g.Debug(ctx, "WaitForTurn: failed to get current inbox version: %s", err.Error())
		close(res)
		return res
	}

	newVers := payload.InboxVers
	// Check for an in-order update
	if newVers <= vers+1 {
		close(res)
		return
	}

	// Out of order update, we are going to wait a fixed amount of time for the correctly
	// ordered update
	go func() {
		g.Lock()
		waiters := g.addToWaitersLocked(ctx, vers, newVers)
		g.Unlock()
		g.Debug(ctx, "WaitForTurn: out of order update received, waiting on %d updates: vers: %d newVers: %d", len(waiters), vers, newVers)
		wctx, cancel := context.WithCancel(ctx)
		defer cancel()
		select {
		case <-g.waitOnWaiters(wctx, newVers, waiters):
			g.Debug(ctx, "WaitForTurn: cleared by earlier messages: vers: %d", newVers)
		case <-g.clock.After(time.Second):
			g.Debug(ctx, "WaitForTurn: timeout reached, charging forward: vers: %d", newVers)
		}
		close(res)
	}()
	return res
}

func (g *gregorMessageOrderer) CompleteTurn(ctx context.Context, vers chat1.InboxVers) {
	g.Lock()
	defer g.Unlock()
	waiters := g.waiters[vers]
	for _, w := range waiters {
		close(w.cb)
	}
	delete(g.waiters, vers)
}

func (g *gregorMessageOrderer) SetClock(clock clockwork.Clock) {
	g.clock = clock
}

type PushHandler struct {
	globals.Contextified
	utils.DebugLabeler
	sync.Mutex

	identNotifier *IdentifyNotifier
	orderer       *gregorMessageOrderer
}

func NewPushHandler(g *globals.Context) *PushHandler {
	return &PushHandler{
		Contextified:  globals.NewContextified(g),
		DebugLabeler:  utils.NewDebugLabeler(g, "PushHandler", false),
		identNotifier: NewIdentifyNotifier(g),
		orderer:       newGregorMessageOrderer(g),
	}
}

func (g *PushHandler) SetClock(clock clockwork.Clock) {
	g.orderer.SetClock(clock)
}

// TODO hook uper to orderer
func (g *PushHandler) TlfFinalize(ctx context.Context, m gregor.OutOfBandMessage) error {
	g.Lock()
	defer g.Unlock()
	if m.Body() == nil {
		return errors.New("gregor handler for chat.tlffinalize: nil message body")
	}

	g.Debug(ctx, "tlf finalize received")

	var update chat1.TLFFinalizeUpdate
	reader := bytes.NewReader(m.Body().Bytes())
	dec := codec.NewDecoder(reader, &codec.MsgpackHandle{WriteExt: true})
	err := dec.Decode(&update)
	if err != nil {
		return err
	}

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
	uid := m.UID().String()
	for _, convID := range update.ConvIDs {
		var conv *chat1.ConversationLocal
		if mapConv, ok := convMap[convID.String()]; ok {
			conv = &mapConv
		} else {
			conv = nil
		}

		g.G().NotifyRouter.HandleChatTLFFinalize(context.Background(), keybase1.UID(uid), convID, update.FinalizeInfo, conv)

	}

	return nil
}

// TODO hook uper to orderer
func (g *PushHandler) TlfResolve(ctx context.Context, m gregor.OutOfBandMessage) error {
	g.Lock()
	defer g.Unlock()
	if m.Body() == nil {
		return errors.New("gregor handler for chat.tlfresolve: nil message body")
	}

	g.Debug(ctx, "tlf resolve received")

	var update chat1.TLFResolveUpdate
	reader := bytes.NewReader(m.Body().Bytes())
	dec := codec.NewDecoder(reader, &codec.MsgpackHandle{WriteExt: true})
	err := dec.Decode(&update)
	if err != nil {
		return err
	}

	uid := m.UID().String()

	// Get and localize the conversation to get the new tlfname.
	inbox, _, err := g.G().InboxSource.Read(ctx, m.UID().Bytes(), nil, true, &chat1.GetInboxLocalQuery{
		ConvIDs: []chat1.ConversationID{update.ConvID},
	}, nil)
	if err != nil {
		g.Debug(ctx, "resolve: unable to read conversation: %s", err.Error())
		return err
	}
	if len(inbox.Convs) != 1 {
		g.Debug(ctx, "resolve: unable to find conversation")
		return fmt.Errorf("unable to find conversation")
	}
	updateConv := inbox.Convs[0]

	resolveInfo := chat1.ConversationResolveInfo{
		NewTLFName: updateConv.Info.TlfName,
	}

	g.G().NotifyRouter.HandleChatTLFResolve(context.Background(), keybase1.UID(uid), update.ConvID, resolveInfo)

	return nil
}

func (g *PushHandler) Activity(ctx context.Context, m gregor.OutOfBandMessage, badger *badges.Badger) (err error) {
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = Context(ctx, g.G().GetEnv(), keybase1.TLFIdentifyBehavior_CHAT_GUI, &identBreaks,
		g.identNotifier)
	defer g.Trace(ctx, func() error { return err }, "Activity")()
	if m.Body() == nil {
		return errors.New("gregor handler for chat.activity: nil message body")
	}

	// Decode into generic form
	var activity chat1.ChatActivity
	var gm chat1.GenericPayload
	uid := m.UID().Bytes()
	reader := bytes.NewReader(m.Body().Bytes())
	dec := codec.NewDecoder(reader, &codec.MsgpackHandle{WriteExt: true})
	err = dec.Decode(&gm)
	if err != nil {
		g.Debug(ctx, "chat activity: failed to decode into generic payload: %s", err.Error())
		return err
	}
	g.Debug(ctx, "chat activity: action %s vers: %d", gm.Action, gm.InboxVers)

	// Order updates based on inbox version of the update from the server
	cb := g.orderer.WaitForTurn(ctx, uid, gm)
	bctx := BackgroundContext(ctx, g.G().GetEnv())
	go func() {
		ctx := bctx
		<-cb
		g.Lock()
		defer g.Unlock()
		defer g.orderer.CompleteTurn(ctx, gm.InboxVers)

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

			var conv *chat1.ConversationLocal
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
				g.G().Syncer.SendChatStaleNotifications(context.Background(), m.UID().Bytes(),
					[]chat1.ConversationID{nm.ConvID}, true)
			}

			if badger != nil && nm.UnreadUpdate != nil {
				badger.PushChatUpdate(*nm.UnreadUpdate, nm.InboxVers)
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

			var conv *chat1.ConversationLocal
			uid := m.UID().Bytes()
			if conv, err = g.G().InboxSource.ReadMessage(ctx, uid, nm.InboxVers, nm.ConvID, nm.MsgID); err != nil {
				g.Debug(ctx, "chat activity: unable to update inbox: %s", err.Error())
			}

			activity = chat1.NewChatActivityWithReadMessage(chat1.ReadMessageInfo{
				MsgID:  nm.MsgID,
				ConvID: nm.ConvID,
				Conv:   conv,
			})

			if badger != nil && nm.UnreadUpdate != nil {
				badger.PushChatUpdate(*nm.UnreadUpdate, nm.InboxVers)
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

			var conv *chat1.ConversationLocal
			uid := m.UID().Bytes()
			if conv, err = g.G().InboxSource.SetStatus(ctx, uid, nm.InboxVers, nm.ConvID, nm.Status); err != nil {
				g.Debug(ctx, "chat activity: unable to update inbox: %s", err.Error())
			}
			activity = chat1.NewChatActivityWithSetStatus(chat1.SetStatusInfo{
				ConvID: nm.ConvID,
				Status: nm.Status,
				Conv:   conv,
			})

			if badger != nil && nm.UnreadUpdate != nil {
				badger.PushChatUpdate(*nm.UnreadUpdate, nm.InboxVers)
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

			activity = chat1.NewChatActivityWithNewConversation(chat1.NewConversationInfo{
				Conv: inbox.Convs[0],
			})

			if badger != nil && nm.UnreadUpdate != nil {
				badger.PushChatUpdate(*nm.UnreadUpdate, nm.InboxVers)
			}
		default:
			g.Debug(ctx, "unhandled chat.activity action %q", action)
		}

		g.notifyNewChatActivity(ctx, m.UID(), &activity)
	}()
	return nil
}

func (g *PushHandler) notifyNewChatActivity(ctx context.Context, uid gregor.UID, activity *chat1.ChatActivity) error {
	kbUID, err := keybase1.UIDFromString(hex.EncodeToString(uid.Bytes()))
	if err != nil {
		return err
	}
	g.G().NotifyRouter.HandleNewChatActivity(ctx, kbUID, activity)
	return nil
}
