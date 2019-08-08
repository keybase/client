package chat

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/libkb"
	"github.com/kyokomi/emoji"

	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-codec/codec"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type remoteNotificationSuccessHandler struct{}

func (g *remoteNotificationSuccessHandler) HandlerName() string {
	return "remote notification success"
}
func (g *remoteNotificationSuccessHandler) OnConnect(ctx context.Context, conn *rpc.Connection, cli rpc.GenericClient, srv *rpc.Server) error {
	return nil
}
func (g *remoteNotificationSuccessHandler) OnConnectError(err error, reconnectThrottleDuration time.Duration) {
}
func (g *remoteNotificationSuccessHandler) OnDisconnected(ctx context.Context, status rpc.DisconnectStatus) {
}
func (g *remoteNotificationSuccessHandler) OnDoCommandError(err error, nextTime time.Duration) {}
func (g *remoteNotificationSuccessHandler) ShouldRetry(name string, err error) bool {
	return false
}
func (g *remoteNotificationSuccessHandler) ShouldRetryOnConnect(err error) bool {
	return false
}

type MobilePush struct {
	globals.Contextified
	utils.DebugLabeler
}

func NewMobilePush(g *globals.Context) *MobilePush {
	return &MobilePush{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "MobilePush", false),
	}
}

func (h *MobilePush) AckNotificationSuccess(ctx context.Context, pushIDs []string) {
	defer h.Trace(ctx, func() error { return nil }, "AckNotificationSuccess: pushID: %v", pushIDs)()
	conn, token, err := utils.GetGregorConn(ctx, h.G(), h.DebugLabeler,
		func(nist *libkb.NIST) rpc.ConnectionHandler {
			return &remoteNotificationSuccessHandler{}
		})
	if err != nil {
		return
	}
	defer conn.Shutdown()

	// Make remote successful call on our ad hoc conn
	cli := chat1.RemoteClient{Cli: NewRemoteClient(h.G(), conn.GetClient())}
	if err = cli.RemoteNotificationSuccessful(ctx,
		chat1.RemoteNotificationSuccessfulArg{
			AuthToken:        token,
			CompanionPushIDs: pushIDs,
		}); err != nil {
		h.Debug(ctx, "AckNotificationSuccess: failed to invoke remote notification success: %s", err)
	}
}

func (h *MobilePush) formatTextPush(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	membersType chat1.ConversationMembersType, msg chat1.MessageUnboxed) (res string, err error) {
	switch membersType {
	case chat1.ConversationMembersType_TEAM:
		var channelName string
		// Try to get the channel name
		ib, _, err := h.G().InboxSource.Read(ctx, uid, types.ConversationLocalizerBlocking,
			types.InboxSourceDataSourceAll, nil,
			&chat1.GetInboxLocalQuery{
				ConvIDs: []chat1.ConversationID{convID},
			}, nil)
		if err != nil || len(ib.Convs) == 0 {
			h.Debug(ctx, "FormatPushText: failed to unbox conv: %v", convID)
		} else {
			channelName = ib.Convs[0].Info.TopicName
		}
		if channelName == "" {
			// Don't give up here, just display the team name only
			h.Debug(ctx, "FormatPushText: failed to get topicName")
			return fmt.Sprintf("%s (%s): %s", msg.Valid().SenderUsername,
				msg.Valid().ClientHeader.TlfName, msg.Valid().MessageBody.Text().Body), nil
		}
		return fmt.Sprintf("%s (%s#%s): %s", msg.Valid().SenderUsername,
			msg.Valid().ClientHeader.TlfName, channelName,
			msg.Valid().MessageBody.Text().Body), nil
	default:
		return fmt.Sprintf("%s: %s", msg.Valid().SenderUsername, msg.Valid().MessageBody.Text().Body), nil
	}
}

func (h *MobilePush) formatReactionPush(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	membersType chat1.ConversationMembersType, msg chat1.MessageUnboxed) (res string, err error) {
	reaction, err := utils.GetReaction(msg)
	if err != nil {
		return res, err
	}
	switch membersType {
	case chat1.ConversationMembersType_TEAM:
		// Try to get the channel name
		ib, _, err := h.G().InboxSource.Read(ctx, uid, types.ConversationLocalizerBlocking,
			types.InboxSourceDataSourceAll, nil,
			&chat1.GetInboxLocalQuery{
				ConvIDs: []chat1.ConversationID{convID},
			}, nil)
		if err != nil || len(ib.Convs) == 0 {
			h.Debug(ctx, "FormatPushText: failed to unbox convo, using team only")
			return emoji.Sprintf("(%s): %s reacted to your message with %v", msg.Valid().ClientHeader.TlfName,
				msg.Valid().SenderUsername, reaction), nil
		}
		return emoji.Sprintf("(%s#%s): %s reacted to your message with %v", msg.Valid().ClientHeader.TlfName,
			ib.Convs[0].Info.TopicName, msg.Valid().SenderUsername, reaction), nil
	default:
		return emoji.Sprintf("%s reacted to your message with %v", msg.Valid().SenderUsername,
			reaction), nil
	}
}

func (h *MobilePush) FormatPushText(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	membersType chat1.ConversationMembersType, msg chat1.MessageUnboxed) (res string, err error) {
	defer h.Trace(ctx, func() error { return err }, "FormatPushText: convID: %v", convID)()
	if !msg.IsValid() {
		h.Debug(ctx, "FormatPushText: message is not valid")
		return res, errors.New("invalid message")
	}
	switch msg.GetMessageType() {
	case chat1.MessageType_TEXT:
		return h.formatTextPush(ctx, uid, convID, membersType, msg)
	case chat1.MessageType_REACTION:
		return h.formatReactionPush(ctx, uid, convID, membersType, msg)
	default:
		h.Debug(ctx, "FormatPushText: unknown message type: %v", msg.GetMessageType())
		return res, errors.New("invalid message type for plaintext")
	}
}

func (h *MobilePush) UnboxPushNotification(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID, membersType chat1.ConversationMembersType, payload string) (res chat1.MessageUnboxed, err error) {
	defer h.Trace(ctx, func() error { return err }, "UnboxPushNotification: convID: %v", convID)()
	// Parse the message payload
	bMsg, err := base64.StdEncoding.DecodeString(payload)
	if err != nil {
		h.Debug(ctx, "UnboxPushNotification: invalid message payload: %s", err)
		return res, err
	}
	var msgBoxed chat1.MessageBoxed
	mh := codec.MsgpackHandle{WriteExt: true}
	if err = codec.NewDecoderBytes(bMsg, &mh).Decode(&msgBoxed); err != nil {
		h.Debug(ctx, "UnboxPushNotification: failed to msgpack decode payload: %s", err)
		return res, err
	}

	// Unbox first
	vis := keybase1.TLFVisibility_PRIVATE
	if msgBoxed.ClientHeader.TlfPublic {
		vis = keybase1.TLFVisibility_PUBLIC
	}
	unboxInfo := newBasicUnboxConversationInfo(convID, membersType, nil, vis)
	msgUnboxed, err := NewBoxer(h.G()).UnboxMessage(ctx, msgBoxed, unboxInfo, nil)
	if err != nil {
		h.Debug(ctx, "UnboxPushNotification: unbox failed, bailing: %s", err)
		return res, err
	}

	// Check to see if this will be a strict append before adding to the body cache
	if err := h.G().ConvSource.AcquireConversationLock(ctx, uid, convID); err != nil {
		return res, err
	}
	maxMsgID, err := storage.New(h.G(), h.G().ConvSource).GetMaxMsgID(ctx, convID, uid)
	if err == nil {
		if msgUnboxed.GetMessageID() > maxMsgID {
			if err = h.G().ConvSource.PushUnboxed(ctx, convID, uid, []chat1.MessageUnboxed{msgUnboxed}); err != nil {
				h.Debug(ctx, "UnboxPushNotification: failed to push message to conv source: %s",
					err.Error())
			}
		} else {
			h.Debug(ctx, "UnboxPushNotification: message from the past, skipping insert: msgID: %d maxMsgID: %d", msgUnboxed.GetMessageID(), maxMsgID)
		}
	} else {
		h.Debug(ctx, "UnboxPushNotification: failed to fetch max msg ID: %s", err)
	}
	h.G().ConvSource.ReleaseConversationLock(ctx, uid, convID)
	return msgUnboxed, nil
}
