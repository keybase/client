package storage

import (
	"context"
	"testing"

	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/externals"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/clockwork"
	"github.com/stretchr/testify/require"
)

func setupOutboxTest(t testing.TB, name string) (kbtest.ChatTestContext, *Outbox, gregor1.UID, clockwork.FakeClock) {
	ltc := externals.SetupTest(t, name, 2)
	tc := kbtest.ChatTestContext{
		TestContext: ltc,
		ChatG:       &globals.ChatContext{},
	}
	u, err := kbtest.CreateAndSignupFakeUser("ob", ltc.G)
	require.NoError(t, err)
	uid := gregor1.UID(u.User.GetUID().ToBytes())
	cl := clockwork.NewFakeClock()
	ob := NewOutbox(tc.Context(), uid)
	ob.SetClock(cl)
	return tc, ob, uid, cl
}

func makeMsgPlaintext(body string, uid gregor1.UID) chat1.MessagePlaintext {
	return chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			Sender: uid,
		},
		MessageBody: chat1.NewMessageBodyWithText(chat1.MessageText{Body: body}),
	}
}

func TestChatOutbox(t *testing.T) {

	_, ob, uid, cl := setupOutboxTest(t, "outbox")

	var obrs []chat1.OutboxRecord
	conv := makeConvo(gregor1.Time(5), 1, 1)

	for i := 0; i < 5; i++ {
		obr, err := ob.PushMessage(context.TODO(), conv.GetConvID(), makeMsgPlaintext("hi", uid),
			keybase1.TLFIdentifyBehavior_CHAT_CLI)
		require.NoError(t, err)
		obrs = append(obrs, obr)
		cl.Advance(time.Millisecond)
	}

	// Basic pull
	res, err := ob.PullAllConversations(context.TODO(), true, false)
	require.NoError(t, err)
	require.Equal(t, obrs, res, "wrong obids")

	// Pull with remove
	res, err = ob.PullAllConversations(context.TODO(), true, true)
	require.NoError(t, err)
	require.Equal(t, obrs, res, "wrong obids")
	emptyRes, err := ob.PullAllConversations(context.TODO(), true, true)
	require.NoError(t, err)
	require.Zero(t, len(emptyRes), "not empty")

	// Record a failed attempt
	require.NoError(t, ob.RecordFailedAttempt(context.TODO(), obrs[3]))

	// Check to make sure this record now has a failure
	res, err = ob.PullAllConversations(context.TODO(), true, false)
	require.NoError(t, err)
	require.Equal(t, 1, len(res), "wrong len")
	state, err := res[0].State.State()
	require.NoError(t, err)
	require.Equal(t, chat1.OutboxStateType_SENDING, state, "wrong state")
	require.Equal(t, 1, res[0].State.Sending(), "wrong attempts")

	// Mark one as an error
	require.NoError(t, ob.MarkAsError(context.TODO(), obrs[2], chat1.OutboxStateError{
		Message: "failed",
		Typ:     chat1.OutboxErrorType_MISC,
	}))

	// Check for correct order
	res, err = ob.PullAllConversations(context.TODO(), true, false)
	require.NoError(t, err)
	require.Equal(t, 2, len(res), "wrong len")
	state, err = res[0].State.State()
	require.NoError(t, err)
	require.Equal(t, chat1.OutboxStateType_ERROR, state, "wrong state")
	state, err = res[1].State.State()
	require.NoError(t, err)
	require.Equal(t, chat1.OutboxStateType_SENDING, state, "wrong state")

	// Pull without errors
	res, err = ob.PullAllConversations(context.TODO(), false, false)
	require.NoError(t, err)
	require.Equal(t, 1, len(res), "wrong len")

	// Retry the error
	require.NoError(t, ob.RetryMessage(context.TODO(), obrs[2].OutboxID))
	res, err = ob.PullAllConversations(context.TODO(), true, false)
	require.NoError(t, err)
	require.Equal(t, 2, len(res), "wrong len")
	state, err = res[0].State.State()
	require.NoError(t, err)
	require.Equal(t, chat1.OutboxStateType_SENDING, state, "wrong state")
	require.Equal(t, 0, res[0].State.Sending(), "wrong attempts")

	// Remove 2
	require.NoError(t, ob.RemoveMessage(context.TODO(), obrs[2].OutboxID))
	res, err = ob.PullAllConversations(context.TODO(), true, false)
	require.NoError(t, err)
	require.Equal(t, 1, len(res), "wrong len")
	require.Equal(t, obrs[3].OutboxID, res[0].OutboxID, "wrong element")
}
