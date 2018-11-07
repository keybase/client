package chat

import (
	"context"
	"testing"
	"time"

	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/unfurl"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/stretchr/testify/require"
)

type unfurlCall struct {
	uid    gregor1.UID
	convID chat1.ConversationID
	msg    chat1.MessageUnboxed
}

type mockUnfurler struct {
	t        *testing.T
	sender   types.Sender
	outboxID chat1.OutboxID
	unfurlCh chan unfurlCall
	retryCh  chan chat1.OutboxID
	status   types.UnfurlerTaskStatus
}

func newMockUnfurler(t *testing.T, sender types.Sender, outboxID chat1.OutboxID) *mockUnfurler {
	return &mockUnfurler{
		t:        t,
		sender:   sender,
		outboxID: outboxID,
		unfurlCh: make(chan unfurlCall, 1),
		retryCh:  make(chan chat1.OutboxID, 1),
		status:   types.UnfurlerTaskStatusUnfurling,
	}
}

func (m *mockUnfurler) UnfurlAndSend(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	msg chat1.MessageUnboxed) {
	umsg, err := unfurl.MakeBaseUnfurlMessage(ctx, msg, m.outboxID)
	require.NoError(m.t, err)
	_, _, err = m.sender.Send(ctx, convID, umsg, msg.GetMessageID(), &m.outboxID)
	require.NoError(m.t, err)
}

func (m *mockUnfurler) Status(ctx context.Context, outboxID chat1.OutboxID) (types.UnfurlerTaskStatus, *chat1.Unfurl, error) {
	switch m.status {
	case types.UnfurlerTaskStatusSuccess:
		return m.status, new(chat1.Unfurl), nil
	default:
		return m.status, nil, nil
	}
}

func (m *mockUnfurler) Retry(ctx context.Context, outboxID chat1.OutboxID) {
	m.retryCh <- outboxID
}

func TestChatSrvUnfurl(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		switch mt {
		case chat1.ConversationMembersType_KBFS:
			return
		}
		ctc := makeChatTestContext(t, "TestChatSrvUnfurl", 1)
		defer ctc.cleanup()
		users := ctc.users()

		timeout := 20 * time.Second
		ctx := ctc.as(t, users[0]).startCtx
		tc := ctc.world.Tcs[users[0].Username]
		ri := ctc.as(t, users[0]).ri
		uid := users[0].User.GetUID().ToBytes()
		listener0 := newServerChatListener()
		ctc.as(t, users[0]).h.G().NotifyRouter.SetListener(listener0)
		outboxID, err := storage.NewOutboxID()
		require.NoError(t, err)
		storage := NewDevConversationBackedStorage(tc.Context(), func() chat1.RemoteInterface { return ri })
		settings := unfurl.NewSettings(tc.Context().GetLog(), storage)
		sender := NewNonblockingSender(tc.Context(),
			NewBlockingSender(tc.Context(), NewBoxer(tc.Context()),
				func() chat1.RemoteInterface { return ri }))
		unfurler := newMockUnfurler(t, sender, outboxID)
		tc.ChatG.Unfurler = unfurler
		conv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT, mt)

		require.NoError(t, settings.WhitelistAdd(ctx, uid, "wsj.com"))
		consumeNewMsgRemote(t, listener0, chat1.MessageType_TEXT)
		msg := chat1.NewMessageBodyWithText(chat1.MessageText{Body: "http://www.wsj.com"})
		mustPostLocalForTest(t, ctc, users[0], conv, msg)
		consumeNewMsgRemote(t, listener0, chat1.MessageType_TEXT)
		select {
		case <-listener0.newMessageRemote:
			require.Fail(t, "no unfurl yet")
		default:
		}
		select {
		case <-unfurler.retryCh:
		case <-time.After(timeout):
			require.Fail(t, "no retry")
		}
		select {
		case <-unfurler.retryCh:
			require.Fail(t, "unexpected retry")
		default:
		}
		tc.Context().MessageDeliverer.ForceDeliverLoop(context.TODO())
		select {
		case <-unfurler.retryCh:
		case <-time.After(timeout):
			require.Fail(t, "no retry")
		}
		unfurler.status = types.UnfurlerTaskStatusFailed
		tc.Context().MessageDeliverer.ForceDeliverLoop(context.TODO())
		select {
		case <-unfurler.retryCh:
		case <-time.After(timeout):
			require.Fail(t, "no retry")
		}
		select {
		case <-listener0.newMessageRemote:
			require.Fail(t, "no unfurl yet")
		default:
		}
		unfurler.status = types.UnfurlerTaskStatusSuccess
		tc.Context().MessageDeliverer.ForceDeliverLoop(context.TODO())
		select {
		case m := <-listener0.newMessageRemote:
			require.Equal(t, conv.Id, m.ConvID)
			require.True(t, m.Message.IsValid())
			require.Equal(t, chat1.MessageType_UNFURL, m.Message.GetMessageType())
		case <-time.After(timeout):
			require.Fail(t, "no message")
		}
	})
}
