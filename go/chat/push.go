package chat

import (
	"bytes"
	"context"
	"encoding/hex"
	"errors"
	"fmt"

	"github.com/keybase/client/go/badges"
	"github.com/keybase/client/go/chat/pager"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/gregor"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-codec/codec"
)

type PushHandler struct {
	libkb.Contextified
	utils.DebugLabeler

	identNotifier *IdentifyNotifier
}

func NewPushHandler(g *libkb.GlobalContext) *PushHandler {
	return &PushHandler{
		Contextified:  libkb.NewContextified(g),
		DebugLabeler:  utils.NewDebugLabeler(g, "PushHandler", false),
		identNotifier: NewIdentifyNotifier(g),
	}
}

func (g *PushHandler) TlfFinalize(ctx context.Context, m gregor.OutOfBandMessage) error {
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

func (g *PushHandler) TlfResolve(ctx context.Context, m gregor.OutOfBandMessage) error {
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
	defer g.Trace(ctx, func() error { return err }, "Activity")()
	if m.Body() == nil {
		return errors.New("gregor handler for chat.activity: nil message body")
	}

	var activity chat1.ChatActivity
	var gm chat1.GenericPayload
	reader := bytes.NewReader(m.Body().Bytes())
	dec := codec.NewDecoder(reader, &codec.MsgpackHandle{WriteExt: true})
	err = dec.Decode(&gm)
	if err != nil {
		return err
	}

	g.Debug(ctx, "chat activity: action %s", gm.Action)

	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = Context(ctx, keybase1.TLFIdentifyBehavior_CHAT_GUI, &identBreaks, g.identNotifier)

	action := gm.Action
	reader.Reset(m.Body().Bytes())
	switch action {
	case "newMessage":
		var nm chat1.NewMessagePayload
		err = dec.Decode(&nm)
		if err != nil {
			g.Debug(ctx, "chat activity: error decoding newMessage: %s", err.Error())
			return err
		}

		g.Debug(ctx, "chat activity: newMessage: convID: %s sender: %s",
			nm.ConvID, nm.Message.ClientHeader.Sender)
		if nm.Message.ClientHeader.OutboxID != nil {
			g.Debug(ctx, "chat activity: newMessage: outboxID: %s",
				hex.EncodeToString(*nm.Message.ClientHeader.OutboxID))
		} else {
			g.Debug(ctx, "chat activity: newMessage: outboxID is empty")
		}
		uid := m.UID().Bytes()

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
			g.G().ChatSyncer.SendChatStaleNotifications(context.Background(), m.UID().Bytes(),
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
			return err
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
			return err
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
	case "setSettings":
		var nm chat1.SetSettingsPayload
		err = dec.Decode(&nm)
		if err != nil {
			g.Debug(ctx, "chat activity: error decoding: %s", err.Error())
			return err
		}
		g.Debug(ctx, "chat activity: setSettings: convID: %s settings: %d",
			nm.ConvID, len(nm.Settings))

		var conv *chat1.ConversationLocal
		uid := m.UID().Bytes()
		if nm.ConvID == nil {
			return fmt.Errorf("multi-conv settings not supported")
		}
		if conv, err = g.G().InboxSource.SetSettings(ctx, uid, nm.InboxVers, *nm.ConvID, nm.Settings); err != nil {
			g.Debug(ctx, "chat activity: unable to update inbox: %s", err.Error())
		}
		activity = chat1.NewChatActivityWithSetSettings(chat1.SetSettingsInfo{
			ConvID:   nm.ConvID,
			Settings: nm.Settings,
			Conv:     conv,
		})

		if badger != nil && nm.UnreadUpdate != nil {
			badger.PushChatUpdate(*nm.UnreadUpdate, nm.InboxVers)
		}
	case "newConversation":
		var nm chat1.NewConversationPayload
		err = dec.Decode(&nm)
		if err != nil {
			g.Debug(ctx, "chat activity: error decoding: %s", err.Error())
			return err
		}
		g.Debug(ctx, "chat activity: newConversation: convID: %s ", nm.ConvID)

		uid := m.UID().Bytes()

		// We need to get this conversation and then localize it
		var inbox chat1.Inbox
		if inbox, _, err = g.G().InboxSource.Read(ctx, uid, nil, false, &chat1.GetInboxLocalQuery{
			ConvIDs: []chat1.ConversationID{nm.ConvID},
		}, nil); err != nil {
			g.Debug(ctx, "chat activity: unable to read conversation: %s", err.Error())
			return err
		}
		if len(inbox.Convs) != 1 {
			g.Debug(ctx, "chat activity: unable to find conversation")
			return fmt.Errorf("unable to find conversation")
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
		return fmt.Errorf("unhandled chat.activity action %q", action)
	}

	return g.notifyNewChatActivity(ctx, m.UID(), &activity)
}

func (g *PushHandler) notifyNewChatActivity(ctx context.Context, uid gregor.UID, activity *chat1.ChatActivity) error {
	kbUID, err := keybase1.UIDFromString(hex.EncodeToString(uid.Bytes()))
	if err != nil {
		return err
	}
	g.G().NotifyRouter.HandleNewChatActivity(ctx, kbUID, activity)
	return nil
}
