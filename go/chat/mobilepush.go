package chat

import (
	"context"
	"encoding/base64"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/libkb"

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
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), g.GetPerfLog(), "MobilePush", false),
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
