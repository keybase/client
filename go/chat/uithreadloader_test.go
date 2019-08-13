package chat

import (
	"testing"
	"time"

	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/clockwork"
	"github.com/stretchr/testify/require"
)

func TestUIThreadLoaderGrouper(t *testing.T) {
	useRemoteMock = false
	defer func() { useRemoteMock = true }()
	ctc := makeChatTestContext(t, "TestUIThreadLoaderGrouper", 3)
	defer ctc.cleanup()

	timeout := 2 * time.Second
	users := ctc.users()
	chatUI := kbtest.NewChatUI()
	tc := ctc.world.Tcs[users[0].Username]
	ctx := ctc.as(t, users[0]).startCtx
	uid := gregor1.UID(users[0].GetUID().ToBytes())
	listener0 := newServerChatListener()
	ctc.as(t, users[0]).h.G().NotifyRouter.AddListener(listener0)
	listener1 := newServerChatListener()
	ctc.as(t, users[1]).h.G().NotifyRouter.AddListener(listener1)
	baseconv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
		chat1.ConversationMembersType_TEAM, users[1], users[2])
	topicName := "MKMK"
	convFull, err := ctc.as(t, users[0]).chatLocalHandler().NewConversationLocal(ctx,
		chat1.NewConversationLocalArg{
			TlfName:       baseconv.TlfName,
			TopicName:     &topicName,
			TopicType:     chat1.TopicType_CHAT,
			TlfVisibility: keybase1.TLFVisibility_PRIVATE,
			MembersType:   chat1.ConversationMembersType_TEAM,
		})
	require.NoError(t, err)
	consumeNewMsgRemote(t, listener0, chat1.MessageType_JOIN)
	consumeNewMsgRemote(t, listener0, chat1.MessageType_SYSTEM)
	conv := convFull.Conv.Info

	_, err = ctc.as(t, users[1]).chatLocalHandler().JoinConversationByIDLocal(ctx, conv.Id)
	require.NoError(t, err)
	consumeNewMsgRemote(t, listener0, chat1.MessageType_JOIN)
	_, err = ctc.as(t, users[2]).chatLocalHandler().JoinConversationByIDLocal(ctx, conv.Id)
	require.NoError(t, err)
	consumeNewMsgRemote(t, listener0, chat1.MessageType_JOIN)
	_, err = ctc.as(t, users[2]).chatLocalHandler().LeaveConversationLocal(ctx, conv.Id)
	require.NoError(t, err)
	consumeNewMsgRemote(t, listener0, chat1.MessageType_LEAVE)
	mustPostLocalForTest(t, ctc, users[0], conv, chat1.NewMessageBodyWithText(chat1.MessageText{
		Body: "HI",
	}))
	consumeNewMsgRemote(t, listener0, chat1.MessageType_TEXT)
	_, err = ctc.as(t, users[2]).chatLocalHandler().JoinConversationByIDLocal(ctx, conv.Id)
	require.NoError(t, err)
	consumeNewMsgRemote(t, listener0, chat1.MessageType_JOIN)
	_, err = ctc.as(t, users[1]).chatLocalHandler().LeaveConversationLocal(ctx, conv.Id)
	require.NoError(t, err)
	lastLeave := consumeNewMsgRemote(t, listener0, chat1.MessageType_LEAVE)
	consumeLeaveConv(t, listener1)
	_, err = ctc.as(t, users[1]).chatLocalHandler().JoinConversationByIDLocal(ctx, conv.Id)
	require.NoError(t, err)
	consumeNewMsgRemote(t, listener0, chat1.MessageType_JOIN)

	require.NoError(t, tc.Context().ConvSource.Clear(ctx, conv.Id, uid))
	_, err = tc.Context().ConvSource.GetMessages(ctx, convFull.Conv, uid,
		[]chat1.MessageID{1, 2, 3, 4, 5, 6, 7, 8}, nil)
	require.NoError(t, err)

	clock := clockwork.NewFakeClock()
	uil := NewUIThreadLoader(tc.Context())
	uil.cachedThreadDelay = nil
	uil.remoteThreadDelay = &timeout
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
		require.False(t, res.Full)

		require.Equal(t, 6, len(res.Thread.Messages))

		require.True(t, res.Thread.Messages[0].IsPlaceholder())

		require.Equal(t, chat1.MessageType_JOIN, res.Thread.Messages[1].GetMessageType())
		require.Equal(t, 1, len(res.Thread.Messages[1].Valid().MessageBody.Join().Joiners))
		require.Equal(t, 1, len(res.Thread.Messages[1].Valid().MessageBody.Join().Leavers))

		require.Equal(t, chat1.MessageType_TEXT, res.Thread.Messages[2].GetMessageType())

		require.Equal(t, chat1.MessageType_JOIN, res.Thread.Messages[3].GetMessageType())
		require.Equal(t, 2, len(res.Thread.Messages[3].Valid().MessageBody.Join().Joiners))
		require.Equal(t, 1, len(res.Thread.Messages[3].Valid().MessageBody.Join().Leavers))

		require.Equal(t, chat1.MessageType_JOIN, res.Thread.Messages[4].GetMessageType())
		require.Zero(t, len(res.Thread.Messages[4].Valid().MessageBody.Join().Joiners))
	case <-time.After(timeout):
		require.Fail(t, "no full cb")
	}
	require.NoError(t, tc.Context().ConvSource.Clear(ctx, conv.Id, uid))
	clock.Advance(5 * time.Second)
	select {
	case res := <-chatUI.ThreadCb:
		require.True(t, res.Full)
		require.Equal(t, 4, len(res.Thread.Messages))
		for _, msg := range res.Thread.Messages {
			if msg.GetMessageID() == lastLeave.GetMessageID() {
				require.True(t, msg.IsPlaceholder())
			} else {
				require.Equal(t, chat1.MessageType_JOIN, msg.GetMessageType())
			}
		}
	case <-time.After(timeout):
		require.Fail(t, "no full cb")
	}
}

func TestUIThreadLoaderCache(t *testing.T) {
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
	<-ctc.as(t, users[0]).h.G().ConvLoader.Stop(ctx)
	listener0 := newServerChatListener()
	ctc.as(t, users[0]).h.G().NotifyRouter.AddListener(listener0)
	conv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
		chat1.ConversationMembersType_IMPTEAMNATIVE)
	mustPostLocalForTest(t, ctc, users[0], conv, chat1.NewMessageBodyWithText(chat1.MessageText{
		Body: "HI",
	}))
	consumeNewMsgRemote(t, listener0, chat1.MessageType_TEXT)
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
	clock.Advance(10 * time.Second)
	worked := false
	for i := 0; i < 5; i++ {
		select {
		case err := <-cb:
			require.NoError(t, err)
			worked = true
			break
		case <-time.After(timeout):
			t.Logf("end failed: %d", i)
			clock.Advance(10 * time.Second)
		}
	}
	require.True(t, worked)
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
	uil.cachedThreadDelay = nil
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
