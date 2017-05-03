package chat

import (
	"context"
	"testing"
	"time"

	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/go-codec/codec"
	"github.com/stretchr/testify/require"
)

func sendSimple(t *testing.T, tc *kbtest.ChatTestContext, ph *PushHandler,
	sender Sender, conv chat1.Conversation, user *kbtest.FakeUser,
	iboxXform func(chat1.InboxVers) chat1.InboxVers) {
	uid := gregor1.UID(user.User.GetUID().ToBytes())
	convID := conv.GetConvID()
	outboxID := chat1.OutboxID(randBytes(t, 8))
	nr := tc.G.NotifyRouter
	tc.G.NotifyRouter = nil
	pt := chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			Conv:        conv.Metadata.IdTriple,
			Sender:      uid,
			TlfName:     user.Username,
			TlfPublic:   false,
			MessageType: chat1.MessageType_TEXT,
			OutboxID:    &outboxID,
		},
		MessageBody: chat1.NewMessageBodyWithText(chat1.MessageText{
			Body: "hi",
		}),
	}
	_, boxed, _, err := sender.Send(context.TODO(), convID, pt, 0)
	require.NoError(t, err)

	ibox := storage.NewInbox(tc.Context(), uid)
	vers, err := ibox.Version(context.TODO())
	if err != nil {
		require.IsType(t, storage.MissError{}, err)
		vers = 0
	}
	newVers := iboxXform(vers)
	t.Logf("newVers: %d vers: %d", newVers, vers)
	nm := chat1.NewMessagePayload{
		Action:    "newMessage",
		ConvID:    conv.GetConvID(),
		Message:   *boxed,
		InboxVers: iboxXform(vers),
	}
	var data []byte
	enc := codec.NewEncoderBytes(&data, &codec.MsgpackHandle{WriteExt: true})
	require.NoError(t, enc.Encode(nm))
	m := gregor1.OutOfBandMessage{
		Uid_:    uid,
		System_: "chat.activity",
		Body_:   data,
	}

	tc.G.NotifyRouter = nr
	require.NoError(t, ph.Activity(context.TODO(), m, nil))
}

func TestPushOrdering(t *testing.T) {
	world, ri2, _, sender, list, tlf := setupTest(t, 1)
	defer world.Cleanup()

	ri := ri2.(*kbtest.ChatRemoteMock)
	u := world.GetUsers()[0]
	uid := u.User.GetUID().ToBytes()
	tc := world.Tcs[u.Username]
	handler := NewPushHandler(tc.Context())
	handler.SetClock(world.Fc)

	conv := newBlankConv(t, uid, ri, sender, tlf, u.Username)
	sendSimple(t, tc, handler, sender, conv, u,
		func(vers chat1.InboxVers) chat1.InboxVers { return vers + 1 })

	select {
	case <-list.incoming:
	case <-time.After(20 * time.Second):
		require.Fail(t, "no notification received")
	}

	sendSimple(t, tc, handler, sender, conv, u,
		func(vers chat1.InboxVers) chat1.InboxVers { return vers + 2 })
	select {
	case <-list.incoming:
		require.Fail(t, "should not have gotten one of these")
	default:
	}

	sendSimple(t, tc, handler, sender, conv, u,
		func(vers chat1.InboxVers) chat1.InboxVers { return vers + 1 })
	select {
	case <-list.incoming:
	case <-time.After(20 * time.Second):
		require.Fail(t, "no notification received")
	}
	select {
	case <-list.incoming:
	case <-time.After(20 * time.Second):
		require.Fail(t, "no notification received")
	}
	handler.orderer.Lock()
	require.Zero(t, len(handler.orderer.waiters))
	handler.orderer.Unlock()

	sendSimple(t, tc, handler, sender, conv, u,
		func(vers chat1.InboxVers) chat1.InboxVers { return vers + 2 })
	select {
	case <-list.incoming:
		require.Fail(t, "should not have gotten one of these")
	default:
	}

	t.Logf("advancing clock")
	world.Fc.Advance(time.Hour)
	select {
	case <-list.incoming:
	case <-time.After(20 * time.Second):
		require.Fail(t, "no notification received")
	}
	handler.orderer.Lock()
	require.Zero(t, len(handler.orderer.waiters))
	handler.orderer.Unlock()
}
