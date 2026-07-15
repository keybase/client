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
		DebugLabeler: utils.NewDebugLabeler(g.ExternalG(), "MobilePush", false),
	}
}

func (h *MobilePush) AckNotificationSuccess(ctx context.Context, pushIDs []string) {
	defer h.Trace(ctx, nil, "AckNotificationSuccess: pushID: %v", pushIDs)()
	ack := NewPushAck(ctx, h.G())
	defer ack.Shutdown()
	ack.Ack(ctx, pushIDs)
}

// PushAck acks push notifications over an ad hoc gregor connection. The ack
// is what stops the server from delivering its generic fallback notification,
// so it races the server's timeout: rpc.Connection dials eagerly at
// construction, so create the PushAck as early as possible to overlap the
// TLS/auth handshake with unboxing work, then call Ack once the notification
// has actually been displayed. Always Shutdown when done.
type PushAck struct {
	globals.Contextified
	utils.DebugLabeler
	conn  *rpc.Connection
	token gregor1.SessionToken
	err   error
}

func NewPushAck(ctx context.Context, g *globals.Context) *PushAck {
	a := &PushAck{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.ExternalG(), "PushAck", false),
	}
	a.conn, a.token, a.err = utils.GetGregorConn(ctx, g, a.DebugLabeler,
		func(nist *libkb.NIST) rpc.ConnectionHandler {
			return &remoteNotificationSuccessHandler{}
		})
	return a
}

func (a *PushAck) Ack(ctx context.Context, pushIDs []string) {
	defer a.Trace(ctx, nil, "Ack: pushID: %v", pushIDs)()
	if a.err != nil {
		a.Debug(ctx, "Ack: no gregor connection: %s", a.err)
		return
	}
	cli := chat1.RemoteClient{Cli: NewRemoteClient(a.G(), a.conn.GetClient())}
	arg := chat1.RemoteNotificationSuccessfulArg{
		AuthToken:        a.token,
		CompanionPushIDs: pushIDs,
	}
	// Acking is idempotent server-side; retry since a lost ack means the user
	// gets a duplicate generic notification.
	for attempt := 0; attempt < 3; attempt++ {
		err := cli.RemoteNotificationSuccessful(ctx, arg)
		if err == nil {
			return
		}
		a.Debug(ctx, "Ack: attempt %d failed: %s", attempt, err)
		select {
		case <-time.After(time.Second):
		case <-ctx.Done():
			return
		}
	}
}

func (a *PushAck) Shutdown() {
	if a.conn != nil {
		a.conn.Shutdown()
	}
}

func (h *MobilePush) UnboxPushNotification(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID, membersType chat1.ConversationMembersType, payload string,
) (res chat1.MessageUnboxed, err error) {
	defer h.Trace(ctx, &err, "UnboxPushNotification: convID: %v", convID)()
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
			if err = h.G().ConvSource.PushUnboxed(ctx, unboxInfo, uid, []chat1.MessageUnboxed{msgUnboxed}); err != nil {
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
