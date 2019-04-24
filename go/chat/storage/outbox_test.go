package storage

import (
	"context"
	"fmt"
	"testing"

	"time"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/clockwork"
	"github.com/stretchr/testify/require"
)

func setupOutboxTest(t testing.TB, storageEngine, name string) (kbtest.ChatTestContext, *Outbox, gregor1.UID, clockwork.FakeClock) {
	ctc := setupCommonTest(t, name)
	u, err := kbtest.CreateAndSignupFakeUser("ob", ctc.TestContext.G)
	require.NoError(t, err)
	uid := gregor1.UID(u.User.GetUID().ToBytes())
	cl := clockwork.NewFakeClock()
	ctc.G.Env = libkb.NewEnv(libkb.AppConfig{
		HomeDir:             ctc.Context().GetEnv().GetHome(),
		OutboxStorageEngine: storageEngine,
	}, nil, ctc.Context().GetLog)
	ob := NewOutbox(ctc.Context(), uid)
	ob.SetClock(cl)
	return ctc, ob, uid, cl
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

func runOutboxTest(test func(engine string)) {
	test("db")
	test("files")
	test("combined")
}

func TestChatOutbox(t *testing.T) {
	runOutboxTest(func(engine string) {
		tc, ob, uid, cl := setupOutboxTest(t, engine, "outbox")
		defer tc.Cleanup()

		var obrs []chat1.OutboxRecord
		conv := makeConvo(gregor1.Time(5), 1, 1)

		prevOrdinal := 1
		for i := 0; i < 5; i++ {
			obr, err := ob.PushMessage(context.TODO(), conv.GetConvID(), makeMsgPlaintext("hi", uid),
				nil, nil, nil, keybase1.TLFIdentifyBehavior_CHAT_CLI)
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
		t.Logf("retrying the error: %s", obrs[2].OutboxID)
		_, err = ob.RetryMessage(context.TODO(), obrs[2].OutboxID, nil)
		require.NoError(t, err)
		res, err = ob.PullAllConversations(context.TODO(), true, false)
		require.NoError(t, err)
		require.Equal(t, 2, len(res), "wrong len")
		state, err = res[1].State.State()
		require.NoError(t, err)
		require.Equal(t, chat1.OutboxStateType_SENDING, state, "wrong state")
		require.Equal(t, 0, res[1].State.Sending(), "wrong attempts")

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
	})
}

func TestChatOutboxPurge(t *testing.T) {
	runOutboxTest(func(engine string) {
		tc, ob, uid, cl := setupOutboxTest(t, engine, "outbox")
		defer tc.Cleanup()

		var obrs []chat1.OutboxRecord
		conv := makeConvo(gregor1.Time(5), 1, 1)

		prevOrdinal := 1
		ephemeralMetadata := &chat1.MsgEphemeralMetadata{Lifetime: 0}
		for i := 0; i < 9; i++ {
			// send some exploding and some non exploding msgs
			if i > 3 {
				ephemeralMetadata = nil
			}
			obr, err := ob.PushMessage(context.TODO(), conv.GetConvID(),
				makeMsgPlaintextEphemeral("hi", uid, ephemeralMetadata),
				nil, nil, nil, keybase1.TLFIdentifyBehavior_CHAT_CLI)
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
		_, err = ob.OutboxPurge(context.TODO())
		require.NoError(t, err)

		res, err = ob.PullAllConversations(context.TODO(), true, false)
		require.NoError(t, err)
		require.Equal(t, obrs, res, "wrong obids")

		// Mark 6/9 records as an error, three of these are ephemeral message, 3
		// regular messages.
		for i := 0; i < 6; i++ {
			errRec := chat1.OutboxStateError{
				Message: "failed",
				Typ:     chat1.OutboxErrorType_MISC,
			}
			obrs[i], err = ob.MarkAsError(context.TODO(), obrs[i], errRec)
			require.NoError(t, err)
		}

		_, err = ob.OutboxPurge(context.TODO())
		require.NoError(t, err)
		res, err = ob.PullAllConversations(context.TODO(), true, false)
		require.NoError(t, err)
		require.Equal(t, obrs, res, "wrong obids")

		// move the clock forward the ephemeralPurgeCutoff duration and we'll
		// remove the ephemeral records.
		cl.Advance(ephemeralPurgeCutoff)
		_, err = ob.OutboxPurge(context.TODO())
		require.NoError(t, err)
		res, err = ob.PullAllConversations(context.TODO(), true, false)
		require.NoError(t, err)
		require.Equal(t, obrs[4:], res, "wrong obids")

		// move the clock forward the errorPurgeCutoff duration and we'll remove
		// the records that are marked as an error.
		cl.Advance(errorPurgeCutoff)
		_, err = ob.OutboxPurge(context.TODO())
		require.NoError(t, err)
		res, err = ob.PullAllConversations(context.TODO(), true, false)
		require.NoError(t, err)
		require.Equal(t, obrs[6:], res, "wrong obids")
	})
}

func TestChatOutboxMarkAll(t *testing.T) {
	runOutboxTest(func(engine string) {
		tc, ob, uid, cl := setupOutboxTest(t, engine, "outbox")
		defer tc.Cleanup()

		var obrs []chat1.OutboxRecord
		conv := makeConvo(gregor1.Time(5), 1, 1)
		for i := 0; i < 5; i++ {
			obr, err := ob.PushMessage(context.TODO(), conv.GetConvID(),
				makeMsgPlaintext("hi", uid),
				nil, nil, nil, keybase1.TLFIdentifyBehavior_CHAT_CLI)
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
	})
}

func TestChatOutboxCancelMessagesWithPredicate(t *testing.T) {
	runOutboxTest(func(engine string) {
		tc, ob, uid, cl := setupOutboxTest(t, engine, "outbox")
		defer tc.Cleanup()
		ctx := context.TODO()

		var obrs []chat1.OutboxRecord
		conv := makeConvo(gregor1.Time(5), 1, 1)
		for i := 0; i < 5; i++ {
			obr, err := ob.PushMessage(ctx, conv.GetConvID(),
				makeMsgPlaintext(fmt.Sprintf("hi%d", i), uid),
				nil, nil, nil, keybase1.TLFIdentifyBehavior_CHAT_CLI)
			require.NoError(t, err)
			obrs = append(obrs, obr)
			cl.Advance(time.Millisecond)
		}

		allFalse := func(obr chat1.OutboxRecord) bool { return false }
		numCancelled, err := ob.CancelMessagesWithPredicate(ctx, allFalse)
		require.NoError(t, err)
		require.Zero(t, numCancelled)
		res, err := ob.PullAllConversations(ctx, false, false)
		require.NoError(t, err)
		require.Len(t, res, 5)

		ith := func(obr chat1.OutboxRecord) bool {
			txt := obr.Msg.MessageBody.Text().Body
			return txt == "hi0" || txt == "hi1"
		}
		numCancelled, err = ob.CancelMessagesWithPredicate(ctx, ith)
		require.NoError(t, err)
		require.Equal(t, 2, numCancelled)
		res, err = ob.PullAllConversations(ctx, false, false)
		require.NoError(t, err)
		require.Len(t, res, 3)

		allTrue := func(obr chat1.OutboxRecord) bool { return true }
		numCancelled, err = ob.CancelMessagesWithPredicate(ctx, allTrue)
		require.NoError(t, err)
		require.Equal(t, 3, numCancelled)
		res, err = ob.PullAllConversations(ctx, false, false)
		require.NoError(t, err)
		require.Zero(t, len(res))
	})
}
