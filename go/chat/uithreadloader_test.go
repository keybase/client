package chat

import (
	"testing"
	"time"

	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/clockwork"
	"github.com/stretchr/testify/require"
)

func TestUIThreadLoaderCache(t *testing.T) {
	useRemoteMock = false
	defer func() { useRemoteMock = true }()
	ctc := makeChatTestContext(t, "TestUIThreadLoaderCache", 1)
	defer ctc.cleanup()

	timeout := 20 * time.Second
	users := ctc.users()
	chatUI := kbtest.NewChatUI()
	tc := ctc.world.Tcs[users[0].Username]
	ctx := ctc.as(t, users[0]).startCtx
	uid := gregor1.UID(users[0].GetUID().ToBytes())
	conv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
		chat1.ConversationMembersType_IMPTEAMNATIVE)
	mustPostLocalForTest(t, ctc, users[0], conv, chat1.NewMessageBodyWithText(chat1.MessageText{
		Body: "HI",
	}))
	require.NoError(t, tc.Context().ConvSource.Clear(ctx, conv.Id, uid))
	_, err := tc.Context().ConvSource.PullLocalOnly(ctx, conv.Id, uid, nil, nil, 0)
	require.Error(t, err)
	require.IsType(t, storage.MissError{}, err)

	clock := clockwork.NewFakeClock()
	uil := NewUIThreadLoader(tc.Context())
	uil.cachedThreadDelay = &timeout
	uil.resolveThreadDelay = &timeout
	uil.validatedDelay = 0
	uil.clock = clock
	cb := make(chan error, 1)
	go func() {
		cb <- uil.LoadNonblock(ctx, chatUI, uid, conv.Id, chat1.GetThreadReason_GENERAL,
			chat1.GetThreadNonblockPgMode_DEFAULT, chat1.GetThreadNonblockCbMode_INCREMENTAL, nil, nil)
	}()
	select {
	case res := <-chatUI.ThreadCb:
		require.True(t, res.Full)
		require.Equal(t, 2, len(res.Thread.Messages))
	case <-time.After(timeout):
		require.Fail(t, "no full cb")
	}
	_, err = tc.Context().ConvSource.PullLocalOnly(ctx, conv.Id, uid, nil, nil, 0)
	require.Error(t, err)
	require.IsType(t, storage.MissError{}, err)
	time.Sleep(time.Second)
	clock.Advance(10 * time.Second)
	select {
	case err := <-cb:
		require.NoError(t, err)
	case <-time.After(timeout):
		require.Fail(t, "no end")
	}
	tv, err := tc.Context().ConvSource.PullLocalOnly(ctx, conv.Id, uid, nil, nil, 0)
	require.NoError(t, err)
	require.Equal(t, 2, len(tv.Messages))
}

func TestUIThreadLoaderDisplayStatus(t *testing.T) {
	useRemoteMock = false
	defer func() { useRemoteMock = true }()
	ctc := makeChatTestContext(t, "TestUIThreadLoaderCache", 1)
	defer ctc.cleanup()

	timeout := 2 * time.Second
	users := ctc.users()
	chatUI := kbtest.NewChatUI()
	tc := ctc.world.Tcs[users[0].Username]
	ctx := ctc.as(t, users[0]).startCtx
	uid := gregor1.UID(users[0].GetUID().ToBytes())
	conv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
		chat1.ConversationMembersType_IMPTEAMNATIVE)
	mustPostLocalForTest(t, ctc, users[0], conv, chat1.NewMessageBodyWithText(chat1.MessageText{
		Body: "HI",
	}))

	clock := clockwork.NewFakeClock()
	uil := NewUIThreadLoader(tc.Context())
	rtd := 10 * time.Second
	uil.remoteThreadDelay = &rtd
	uil.resolveThreadDelay = &rtd
	uil.validatedDelay = 0
	uil.clock = clock
	cb := make(chan error, 1)
	go func() {
		cb <- uil.LoadNonblock(ctx, chatUI, uid, conv.Id, chat1.GetThreadReason_GENERAL,
			chat1.GetThreadNonblockPgMode_DEFAULT, chat1.GetThreadNonblockCbMode_INCREMENTAL, nil, nil)
	}()
	select {
	case res := <-chatUI.ThreadCb:
		require.False(t, res.Full)
		require.Equal(t, 2, len(res.Thread.Messages))
	case <-time.After(timeout):
		require.Fail(t, "no cache cb")
	}
	clock.Advance(5 * time.Second)
	select {
	case res := <-chatUI.ThreadStatusCb:
		typ, err := res.Typ()
		require.NoError(t, err)
		require.Equal(t, chat1.UIChatThreadStatusTyp_SERVER, typ)
	case <-time.After(timeout):
		require.Fail(t, "no server status")
	}
	clock.Advance(6 * time.Second)
	select {
	case res := <-chatUI.ThreadCb:
		require.True(t, res.Full)
		require.Zero(t, len(res.Thread.Messages))
	case <-time.After(timeout):
		require.Fail(t, "no full cb")
	}
	time.Sleep(time.Second)
	clock.Advance(time.Second)
	select {
	case res := <-chatUI.ThreadStatusCb:
		typ, err := res.Typ()
		require.NoError(t, err)
		require.Equal(t, chat1.UIChatThreadStatusTyp_VALIDATING, typ)
	case <-time.After(timeout):
		require.Fail(t, "no validating status")
	}
	clock.Advance(20 * time.Second)
	select {
	case res := <-chatUI.ThreadStatusCb:
		typ, err := res.Typ()
		require.NoError(t, err)
		require.Equal(t, chat1.UIChatThreadStatusTyp_VALIDATED, typ)
	case <-time.After(timeout):
		require.Fail(t, "no validating status")
	}
	select {
	case err := <-cb:
		require.NoError(t, err)
	case <-time.After(timeout):
		require.Fail(t, "no end")
	}

	// Too fast for status
	rtd = 1 * time.Second
	uil.remoteThreadDelay = &rtd
	uil.resolveThreadDelay = nil
	go func() {
		cb <- uil.LoadNonblock(ctx, chatUI, uid, conv.Id, chat1.GetThreadReason_GENERAL,
			chat1.GetThreadNonblockPgMode_DEFAULT, chat1.GetThreadNonblockCbMode_INCREMENTAL, nil, nil)
	}()
	select {
	case res := <-chatUI.ThreadCb:
		require.False(t, res.Full)
		require.Equal(t, 2, len(res.Thread.Messages))
	case <-time.After(timeout):
		require.Fail(t, "no cache cb")
	}
	clock.Advance(2 * time.Second)
	select {
	case res := <-chatUI.ThreadCb:
		require.True(t, res.Full)
		require.Zero(t, len(res.Thread.Messages))
	case <-time.After(timeout):
		require.Fail(t, "no full cb")
	}
	select {
	case err := <-cb:
		require.NoError(t, err)
	case <-time.After(timeout):
		require.Fail(t, "no end")
	}
	select {
	case <-chatUI.ThreadStatusCb:
		require.Fail(t, "no status cbs")
	default:
	}
}
