package storage

import (
	"context"
	"testing"

	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/clockwork"
	"github.com/stretchr/testify/require"
)

func setupOutboxTest(t testing.TB, name string) (kbtest.ChatTestContext, *Outbox, gregor1.UID, clockwork.FakeClock) {
	ltc := setupCommonTest(t, name)
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
			Sender:     uid,
			OutboxInfo: &chat1.OutboxInfo{},
		},
		MessageBody: chat1.NewMessageBodyWithText(chat1.MessageText{Body: body}),
	}
}

func makeMsgPlaintextEphemeral(body string, uid gregor1.UID, ephemeralMetadata *chat1.MsgEphemeralMetadata) chat1.MessagePlaintext {
	msg := makeMsgPlaintext(body, uid)
	msg.ClientHeader.EphemeralMetadata = ephemeralMetadata
	return msg
}

func TestChatOutbox(t *testing.T) {

	_, ob, uid, cl := setupOutboxTest(t, "outbox")

	var obrs []chat1.OutboxRecord
	conv := makeConvo(gregor1.Time(5), 1, 1)

	prevOrdinal := 1
	for i := 0; i < 5; i++ {
		obr, err := ob.PushMessage(context.TODO(), conv.GetConvID(), makeMsgPlaintext("hi", uid),
			nil, keybase1.TLFIdentifyBehavior_CHAT_CLI)
		require.Equal(t, obr.Ordinal, prevOrdinal)
		prevOrdinal++
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
	newObr, err := ob.MarkAsError(context.TODO(), obrs[2], chat1.OutboxStateError{
		Message: "failed",
		Typ:     chat1.OutboxErrorType_MISC,
	})
	require.NoError(t, err)
	st, err := newObr.State.State()
	require.NoError(t, err)
	require.Equal(t, chat1.OutboxStateType_ERROR, st)
	require.Equal(t, chat1.OutboxErrorType_MISC, newObr.State.Error().Typ)

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
	require.NoError(t, ob.RetryMessage(context.TODO(), obrs[2].OutboxID, nil))
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

	var tv chat1.ThreadView
	require.NoError(t, ob.SprinkleIntoThread(context.TODO(), conv.GetConvID(), &tv))
	require.Equal(t, 1, len(tv.Messages))
	newObr, err = ob.MarkAsError(context.TODO(), obrs[3], chat1.OutboxStateError{
		Message: "failed",
		Typ:     chat1.OutboxErrorType_DUPLICATE,
	})
	require.NoError(t, err)
	st, err = newObr.State.State()
	require.NoError(t, err)
	require.Equal(t, chat1.OutboxStateType_ERROR, st)
	require.Equal(t, chat1.OutboxErrorType_DUPLICATE, newObr.State.Error().Typ)
	tv.Messages = nil
	require.NoError(t, ob.SprinkleIntoThread(context.TODO(), conv.GetConvID(), &tv))
	require.Zero(t, len(tv.Messages))
}

func TestChatOutboxPurge(t *testing.T) {

	_, ob, uid, cl := setupOutboxTest(t, "outbox")

	var obrs []chat1.OutboxRecord
	conv := makeConvo(gregor1.Time(5), 1, 1)

	prevOrdinal := 1
	ephemeralMetadata := &chat1.MsgEphemeralMetadata{Lifetime: 0}
	for i := 0; i < 5; i++ {
		// send some exploding and some non exploding msgs
		if i%2 == 0 {
			ephemeralMetadata = nil
		}
		obr, err := ob.PushMessage(context.TODO(), conv.GetConvID(), makeMsgPlaintextEphemeral("hi", uid, ephemeralMetadata),
			nil, keybase1.TLFIdentifyBehavior_CHAT_CLI)
		require.Equal(t, obr.Ordinal, prevOrdinal)
		prevOrdinal++
		require.NoError(t, err)
		obrs = append(obrs, obr)
		cl.Advance(time.Millisecond)
	}

	res, err := ob.PullAllConversations(context.TODO(), true, false)
	require.NoError(t, err)
	require.Equal(t, obrs, res, "wrong obids")

	// Nothing is in the error state & expired, so we should not have purged anything
	err = ob.OutboxPurge(context.TODO())
	require.NoError(t, err)

	res, err = ob.PullAllConversations(context.TODO(), true, false)
	require.NoError(t, err)
	require.Equal(t, obrs, res, "wrong obids")

	// Mark half the records as errors, but they are not considered expired
	for i := 0; i < len(obrs)/2; i++ {
		errRec := chat1.OutboxStateError{
			Message: "failed",
			Typ:     chat1.OutboxErrorType_MISC,
		}
		obrs[i], err = ob.MarkAsError(context.TODO(), obrs[i], errRec)
		require.NoError(t, err)
	}

	err = ob.OutboxPurge(context.TODO())
	require.NoError(t, err)
	res, err = ob.PullAllConversations(context.TODO(), true, false)
	require.NoError(t, err)
	require.Equal(t, obrs, res, "wrong obids")

	// move the clock forward and it this should get purged
	cl.Advance(errorPurgeCutoff)
	err = ob.OutboxPurge(context.TODO())
	require.NoError(t, err)
	res, err = ob.PullAllConversations(context.TODO(), true, false)
	require.NoError(t, err)
	require.Equal(t, obrs[len(obrs)/2:], res, "wrong obids")
}

func TestChatOutboxMarkAll(t *testing.T) {
	_, ob, uid, cl := setupOutboxTest(t, "outbox")

	var obrs []chat1.OutboxRecord
	conv := makeConvo(gregor1.Time(5), 1, 1)
	for i := 0; i < 5; i++ {
		obr, err := ob.PushMessage(context.TODO(), conv.GetConvID(), makeMsgPlaintext("hi", uid),
			nil, keybase1.TLFIdentifyBehavior_CHAT_CLI)
		require.NoError(t, err)
		obrs = append(obrs, obr)
		cl.Advance(time.Millisecond)
	}

	newObr, err := ob.MarkAsError(context.TODO(), obrs[0], chat1.OutboxStateError{
		Message: "failed",
		Typ:     chat1.OutboxErrorType_MISC,
	})
	require.NoError(t, err)
	st, err := newObr.State.State()
	require.NoError(t, err)
	require.Equal(t, chat1.OutboxStateType_ERROR, st)
	require.Equal(t, chat1.OutboxErrorType_MISC, newObr.State.Error().Typ)

	newObrs, err := ob.MarkAllAsError(context.TODO(), chat1.OutboxStateError{
		Message: "failed",
		Typ:     chat1.OutboxErrorType_MISC,
	})
	require.NoError(t, err)
	require.Equal(t, 4, len(newObrs))
	for _, newObr := range newObrs {
		st, err := newObr.State.State()
		require.NoError(t, err)
		require.Equal(t, chat1.OutboxStateType_ERROR, st)
		require.Equal(t, chat1.OutboxErrorType_MISC, newObr.State.Error().Typ)
	}
}
