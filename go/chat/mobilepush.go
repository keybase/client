package chat

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"time"

	"github.com/keybase/client/go/chat/globals"

	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
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
	defer h.Trace(ctx, func() error { return nil }, "AckNotificationSuccess")()
	// Get session token
	nist, _, err := h.G().ActiveDevice.NISTAndUID(ctx)
	if nist == nil {
		h.Debug(ctx, "AckNotificationSuccess: got a nil NIST, is the user logged out?")
		return
	}
	if err != nil {
		h.Debug(ctx, "AckNotificationSuccess: failed to get logged in session: %s", err.Error())
		return
	}

	// Make an ad hoc connection to gregor
	uri, err := rpc.ParseFMPURI(h.G().Env.GetGregorURI())
	if err != nil {
		h.Debug(ctx, "AckNotificationSuccess: failed to parse chat server UR: %s", err.Error())
		return
	}

	var conn *rpc.Connection
	if uri.UseTLS() {
		rawCA := h.G().Env.GetBundledCA(uri.Host)
		if len(rawCA) == 0 {
			h.Debug(ctx, "AckNotificationSuccess: failed to parse CAs: %s", err.Error())
			return
		}
		conn = rpc.NewTLSConnection(rpc.NewFixedRemote(uri.HostPort),
			[]byte(rawCA), libkb.NewContextifiedErrorUnwrapper(h.G().ExternalG()),
			&remoteNotificationSuccessHandler{}, libkb.NewRPCLogFactory(h.G().ExternalG()),
			logger.LogOutputWithDepthAdder{Logger: h.G().Log}, rpc.ConnectionOpts{})
	} else {
		t := rpc.NewConnectionTransport(uri, nil, libkb.MakeWrapError(h.G().ExternalG()))
		conn = rpc.NewConnectionWithTransport(&remoteNotificationSuccessHandler{}, t,
			libkb.NewContextifiedErrorUnwrapper(h.G().ExternalG()),
			logger.LogOutputWithDepthAdder{Logger: h.G().Log}, rpc.ConnectionOpts{})
	}
	defer conn.Shutdown()

	// Make remote successful call on our ad hoc conn
	cli := chat1.RemoteClient{Cli: NewRemoteClient(h.G(), conn.GetClient())}
	if err = cli.RemoteNotificationSuccessful(ctx,
		chat1.RemoteNotificationSuccessfulArg{
			AuthToken:        gregor1.SessionToken(nist.Token().String()),
			CompanionPushIDs: pushIDs,
		}); err != nil {
		h.Debug(ctx, "AckNotificationSuccess: failed to invoke remote notification success: %",
			err.Error())
	}
}

func (h *MobilePush) FormatPushText(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	membersType chat1.ConversationMembersType, msg chat1.MessageUnboxed) (res string, err error) {
	defer h.Trace(ctx, func() error { return err }, "FormatPushText")()

	if !msg.IsValid() || msg.GetMessageType() != chat1.MessageType_TEXT {
		h.Debug(ctx, "FormatPushText: unknown message type: %v", msg.GetMessageType())
		return res, errors.New("invalid message")
	}
	switch membersType {
	case chat1.ConversationMembersType_TEAM:
		// Try to get the channel name
		ib, err := h.G().InboxSource.Read(ctx, uid, nil, true, &chat1.GetInboxLocalQuery{
			ConvIDs: []chat1.ConversationID{convID},
		}, nil)
		if err != nil || len(ib.Convs) == 0 {
			// Don't give up here, just display the team name only
			h.Debug(ctx, "FormatPushText: failed to unbox convo, using team only")
			return fmt.Sprintf("%s (%s): %s", msg.Valid().SenderUsername,
				msg.Valid().ClientHeader.TlfName, msg.Valid().MessageBody.Text().Body), nil
		}
		return fmt.Sprintf("%s (%s#%s): %s", msg.Valid().SenderUsername,
			msg.Valid().ClientHeader.TlfName, utils.GetTopicName(ib.Convs[0]),
			msg.Valid().MessageBody.Text().Body), nil
	default:
		return fmt.Sprintf("%s: %s", msg.Valid().SenderUsername, msg.Valid().MessageBody.Text().Body), nil
	}
}

func (h *MobilePush) UnboxPushNotification(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID, membersType chat1.ConversationMembersType, payload string) (res chat1.MessageUnboxed, err error) {
	defer h.Trace(ctx, func() error { return err }, "UnboxPushNotification")()
	// Parse the message payload
	bMsg, err := base64.StdEncoding.DecodeString(payload)
	if err != nil {
		h.Debug(ctx, "UnboxPushNotification: invalid message payload: %s", err.Error())
		return res, err
	}
	var msgBoxed chat1.MessageBoxed
	mh := codec.MsgpackHandle{WriteExt: true}
	if err = codec.NewDecoderBytes(bMsg, &mh).Decode(&msgBoxed); err != nil {
		h.Debug(ctx, "UnboxPushNotification: failed to msgpack decode payload: %s", err.Error())
		return res, err
	}

	// Unbox first
	vis := keybase1.TLFVisibility_PRIVATE
	if msgBoxed.ClientHeader.TlfPublic {
		vis = keybase1.TLFVisibility_PUBLIC
	}
	unboxInfo := newBasicUnboxConversationInfo(convID, membersType, nil, vis)
	msgUnboxed, err := NewBoxer(h.G()).UnboxMessage(ctx, msgBoxed, unboxInfo)
	if err != nil {
		h.Debug(ctx, "UnboxPushNotification: unbox failed, bailing: %s", err.Error())
		return res, err
	}

	// Check to see if this will be a strict append before adding to the body cache
	if err := h.G().ConvSource.AcquireConversationLock(ctx, uid, convID); err != nil {
		return res, err
	}
	maxMsgID, err := storage.New(h.G(), h.G().ConvSource).GetMaxMsgID(ctx, convID, uid)
	if err == nil {
		if msgUnboxed.GetMessageID() > maxMsgID {
			if _, err = h.G().ConvSource.PushUnboxed(ctx, convID, uid, msgUnboxed); err != nil {
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
