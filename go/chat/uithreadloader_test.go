package chat

import (
	"context"
	"encoding/base64"
	"testing"
	"time"

	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/clockwork"
	"github.com/keybase/go-codec/codec"
	"github.com/stretchr/testify/require"
)

func TestUIThreadLoaderGrouper(t *testing.T) {
	useRemoteMock = false
	defer func() { useRemoteMock = true }()
	ctc := makeChatTestContext(t, "TestUIThreadLoaderGrouper", 6)
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
		chat1.ConversationMembersType_TEAM, users[1:]...)
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
	consumeNewMsgRemote(t, listener0, chat1.MessageType_SYSTEM)
	conv := convFull.Conv.Info

	err = ctc.as(t, users[0]).chatLocalHandler().BulkAddToConv(ctx,
		chat1.BulkAddToConvArg{
			Usernames: []string{"foo", "bar", "baz"},
			ConvID:    conv.Id,
		})
	require.NoError(t, err)
	consumeNewMsgRemote(t, listener0, chat1.MessageType_SYSTEM)

	err = ctc.as(t, users[0]).chatLocalHandler().BulkAddToConv(ctx,
		chat1.BulkAddToConvArg{
			Usernames: []string{users[3].Username},
			ConvID:    conv.Id,
		})
	require.NoError(t, err)
	consumeNewMsgRemote(t, listener0, chat1.MessageType_SYSTEM)

	err = ctc.as(t, users[0]).chatLocalHandler().BulkAddToConv(ctx,
		chat1.BulkAddToConvArg{
			Usernames: []string{users[4].Username},
			ConvID:    conv.Id,
		})
	require.NoError(t, err)
	lastBulkAdd := consumeNewMsgRemote(t, listener0, chat1.MessageType_SYSTEM)

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

	_, err = ctc.as(t, users[5]).chatLocalHandler().JoinConversationByIDLocal(ctx, conv.Id)
	require.NoError(t, err)
	consumeNewMsgRemote(t, listener0, chat1.MessageType_JOIN)
	_, err = ctc.as(t, users[5]).chatLocalHandler().LeaveConversationLocal(ctx, conv.Id)
	require.NoError(t, err)
	consumeNewMsgRemote(t, listener0, chat1.MessageType_LEAVE)

	require.NoError(t, tc.Context().ConvSource.Clear(ctx, conv.Id, uid, nil))
	_, err = tc.Context().ConvSource.GetMessages(ctx, convFull.Conv.GetConvID(), uid,
		[]chat1.MessageID{1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11}, nil, nil, false)
	require.NoError(t, err)

	_, err = tc.Context().ParticipantsSource.Get(ctx, uid, conv.Id, types.InboxSourceDataSourceAll)
	require.NoError(t, err)

	clock := clockwork.NewFakeClock()
	ri := ctc.as(t, users[0]).ri
	uil := NewUIThreadLoader(tc.Context(), func() chat1.RemoteInterface { return ri })
	uil.cachedThreadDelay = nil
	uil.remoteThreadDelay = &timeout
	uil.resolveThreadDelay = &timeout
	uil.validatedDelay = 0
	uil.clock = clock
	cb := make(chan error, 1)
	go func() {
		cb <- uil.LoadNonblock(ctx, chatUI, uid, conv.Id, chat1.GetThreadReason_GENERAL,
			chat1.GetThreadNonblockPgMode_DEFAULT, chat1.GetThreadNonblockCbMode_INCREMENTAL, nil, nil, nil)
	}()
	select {
	case res := <-chatUI.ThreadCb:
		require.False(t, res.Full)

		require.Equal(t, 9, len(res.Thread.Messages))

		require.True(t, res.Thread.Messages[0].IsPlaceholder())
		require.True(t, res.Thread.Messages[1].IsPlaceholder())

		require.Equal(t, chat1.MessageType_JOIN, res.Thread.Messages[2].GetMessageType())
		require.Equal(t, 1, len(res.Thread.Messages[2].Valid().MessageBody.Join().Joiners))
		require.Equal(t, 1, len(res.Thread.Messages[2].Valid().MessageBody.Join().Leavers))

		require.Equal(t, chat1.MessageType_TEXT, res.Thread.Messages[3].GetMessageType())

		require.Equal(t, chat1.MessageType_JOIN, res.Thread.Messages[4].GetMessageType())
		require.Zero(t, len(res.Thread.Messages[4].Valid().MessageBody.Join().Joiners))
		require.Equal(t, 1, len(res.Thread.Messages[4].Valid().MessageBody.Join().Leavers))

		require.Equal(t, chat1.MessageType_JOIN, res.Thread.Messages[5].GetMessageType())
		require.Equal(t, 2, len(res.Thread.Messages[5].Valid().MessageBody.Join().Joiners))
		require.Zero(t, len(res.Thread.Messages[5].Valid().MessageBody.Join().Leavers))

		require.Equal(t, chat1.MessageType_SYSTEM, res.Thread.Messages[6].GetMessageType())
		bod := res.Thread.Messages[6].Valid().MessageBody.System()
		sysTyp, err := bod.SystemType()
		require.NoError(t, err)
		require.Equal(t, chat1.MessageSystemType_BULKADDTOCONV, sysTyp)
		require.Equal(t, 2, len(bod.Bulkaddtoconv().Usernames))

		require.Equal(t, chat1.MessageType_JOIN, res.Thread.Messages[7].GetMessageType())
		require.Zero(t, len(res.Thread.Messages[7].Valid().MessageBody.Join().Joiners))
		require.Zero(t, len(res.Thread.Messages[7].Valid().MessageBody.Join().Leavers))

	case <-time.After(timeout):
		require.Fail(t, "no full cb")
	}
	require.NoError(t, tc.Context().ConvSource.Clear(ctx, conv.Id, uid, nil))
	clock.Advance(5 * time.Second)
	select {
	case res := <-chatUI.ThreadCb:
		require.True(t, res.Full)
		require.Equal(t, 7, len(res.Thread.Messages))
		for _, msg := range res.Thread.Messages {
			switch msg.GetMessageID() {
			case lastLeave.GetMessageID():
				require.True(t, msg.IsPlaceholder())
			case lastBulkAdd.GetMessageID():
				require.Equal(t, chat1.MessageType_SYSTEM, msg.GetMessageType())
			default:
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
	require.NoError(t, tc.Context().ConvSource.Clear(ctx, conv.Id, uid, nil))
	_, err := tc.Context().ConvSource.PullLocalOnly(ctx, conv.Id, uid, chat1.GetThreadReason_GENERAL, nil, nil, 0)
	require.Error(t, err)
	require.IsType(t, storage.MissError{}, err)

	clock := clockwork.NewFakeClock()
	ri := ctc.as(t, users[0]).ri
	uil := NewUIThreadLoader(tc.Context(), func() chat1.RemoteInterface { return ri })
	uil.cachedThreadDelay = &timeout
	uil.resolveThreadDelay = &timeout
	uil.validatedDelay = 0
	uil.clock = clock
	cb := make(chan error, 1)
	go func() {
		cb <- uil.LoadNonblock(ctx, chatUI, uid, conv.Id, chat1.GetThreadReason_GENERAL,
			chat1.GetThreadNonblockPgMode_DEFAULT, chat1.GetThreadNonblockCbMode_INCREMENTAL, nil, nil, nil)
	}()
	select {
	case res := <-chatUI.ThreadCb:
		require.True(t, res.Full)
		require.Equal(t, 2, len(res.Thread.Messages))
	case <-time.After(timeout):
		require.Fail(t, "no full cb")
	}
	_, err = tc.Context().ConvSource.PullLocalOnly(ctx, conv.Id, uid, chat1.GetThreadReason_GENERAL, nil, nil, 0)
	require.Error(t, err)
	require.IsType(t, storage.MissError{}, err)
	clock.Advance(10 * time.Second)
	worked := false
	for i := 0; i < 5 && !worked; i++ {
		select {
		case err := <-cb:
			require.NoError(t, err)
			t.Logf("cb received: %d", i)
			worked = true
		case <-time.After(timeout):
			t.Logf("end failed: %d", i)
			clock.Advance(10 * time.Second)
		}
	}
	require.True(t, worked)
	tv, err := tc.Context().ConvSource.PullLocalOnly(ctx, conv.Id, uid, chat1.GetThreadReason_GENERAL, nil, nil, 0)
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
	ri := ctc.as(t, users[0]).ri
	uil := NewUIThreadLoader(tc.Context(), func() chat1.RemoteInterface { return ri })
	rtd := 10 * time.Second
	uil.cachedThreadDelay = nil
	uil.remoteThreadDelay = &rtd
	uil.resolveThreadDelay = &rtd
	uil.validatedDelay = 0
	uil.clock = clock
	cb := make(chan error, 1)
	go func() {
		cb <- uil.LoadNonblock(ctx, chatUI, uid, conv.Id, chat1.GetThreadReason_GENERAL,
			chat1.GetThreadNonblockPgMode_DEFAULT, chat1.GetThreadNonblockCbMode_INCREMENTAL, nil, nil, nil)
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
			chat1.GetThreadNonblockPgMode_DEFAULT, chat1.GetThreadNonblockCbMode_INCREMENTAL, nil, nil, nil)
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

func TestUIThreadLoaderSingleFlight(t *testing.T) {
	useRemoteMock = false
	defer func() { useRemoteMock = true }()
	ctc := makeChatTestContext(t, "TestUIThreadLoaderSingleFlight", 1)
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

	clock := clockwork.NewFakeClock()
	ri := ctc.as(t, users[0]).ri
	uil := NewUIThreadLoader(tc.Context(), func() chat1.RemoteInterface { return ri })
	rtd := 1 * time.Second
	uil.cachedThreadDelay = nil
	uil.remoteThreadDelay = &rtd
	uil.resolveThreadDelay = nil
	uil.validatedDelay = 0
	uil.clock = clock
	cb := make(chan error, 1)
	cb2 := make(chan error, 1)
	go func() {
		cb <- uil.LoadNonblock(ctx, chatUI, uid, conv.Id, chat1.GetThreadReason_GENERAL,
			chat1.GetThreadNonblockPgMode_DEFAULT, chat1.GetThreadNonblockCbMode_INCREMENTAL, nil, nil, nil)
	}()
	go func() {
		cb2 <- uil.LoadNonblock(ctx, chatUI, uid, conv.Id, chat1.GetThreadReason_GENERAL,
			chat1.GetThreadNonblockPgMode_DEFAULT, chat1.GetThreadNonblockCbMode_INCREMENTAL, nil, nil, nil)
	}()
	time.Sleep(time.Second)
	errors := 0
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
		if err != nil {
			errors++
		}
	case <-time.After(timeout):
		require.Fail(t, "no end")
	}
	select {
	case err := <-cb2:
		if err != nil {
			errors++
		}
	case <-time.After(timeout):
		require.Fail(t, "no end")
	}
	select {
	case <-chatUI.ThreadStatusCb:
		require.Fail(t, "no status cbs")
	default:
	}
	require.Equal(t, 1, errors)
}

type testingKnownRemote struct {
	chat1.RemoteInterface
	t *testing.T
}

func (r *testingKnownRemote) GetMessagesRemote(ctx context.Context, arg chat1.GetMessagesRemoteArg) (res chat1.GetMessagesRemoteRes, err error) {
	require.Fail(r.t, "no remote reqs!")
	return res, err
}

func TestUIThreadLoaderKnownRemotes(t *testing.T) {
	useRemoteMock = false
	defer func() { useRemoteMock = true }()
	ctc := makeChatTestContext(t, "TestUIThreadLoaderKnownRemotes", 1)
	defer ctc.cleanup()

	timeout := 2 * time.Second
	users := ctc.users()
	chatUI := kbtest.NewChatUI()
	tc := ctc.world.Tcs[users[0].Username]
	ctx := ctc.as(t, users[0]).startCtx
	uid := gregor1.UID(users[0].GetUID().ToBytes())
	<-ctc.as(t, users[0]).h.G().ConvLoader.Stop(ctx)
	listener := newServerChatListener()
	ctc.as(t, users[0]).h.G().NotifyRouter.AddListener(listener)
	conv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
		chat1.ConversationMembersType_IMPTEAMNATIVE)
	msgID1 := mustPostLocalForTest(t, ctc, users[0], conv, chat1.NewMessageBodyWithText(chat1.MessageText{
		Body: "HI",
	}))
	msgID2 := mustPostLocalForTest(t, ctc, users[0], conv, chat1.NewMessageBodyWithText(chat1.MessageText{
		Body: "HI2",
	}))
	consumeNewMsgRemote(t, listener, chat1.MessageType_TEXT)
	consumeNewMsgRemote(t, listener, chat1.MessageType_TEXT)

	require.NoError(t, tc.Context().ConvSource.Clear(ctx, conv.Id, uid, nil))
	_, err := ctc.as(t, users[0]).chatLocalHandler().GetMessagesLocal(ctx, chat1.GetMessagesLocalArg{
		ConversationID: conv.Id,
		MessageIDs:     []chat1.MessageID{1, msgID1},
	})
	require.NoError(t, err)

	msgBoxed := chat1.MessageBoxed{
		ServerHeader: &chat1.MessageServerHeader{
			MessageID: msgID2,
		},
	}
	var dat []byte
	mh := codec.MsgpackHandle{WriteExt: true}
	require.NoError(t, codec.NewEncoderBytes(&dat, &mh).Encode(msgBoxed))
	knownRemote := base64.StdEncoding.EncodeToString(dat)
	cb := make(chan error, 1)
	ri := ctc.as(t, users[0]).ri
	testingRemote := &testingKnownRemote{
		RemoteInterface: ri,
		t:               t,
	}
	clock := clockwork.NewFakeClock()

	uil := NewUIThreadLoader(tc.Context(), func() chat1.RemoteInterface { return testingRemote })
	uil.remoteThreadDelay = &timeout
	uil.cachedThreadDelay = nil
	uil.validatedDelay = 0
	uil.clock = clock
	go func() {
		cb <- uil.LoadNonblock(ctx, chatUI, uid, conv.Id, chat1.GetThreadReason_GENERAL,
			chat1.GetThreadNonblockPgMode_DEFAULT, chat1.GetThreadNonblockCbMode_FULL,
			[]string{knownRemote}, nil, nil)
	}()
	numNonPlace := func(msgs []chat1.UIMessage) (res int) {
		for _, msg := range msgs {
			if !msg.IsPlaceholder() {
				res++
			}
		}
		return res
	}
	select {
	case res := <-chatUI.ThreadCb:
		require.False(t, res.Full)
		require.Equal(t, 2, numNonPlace(res.Thread.Messages))
	case <-time.After(timeout):
		require.Fail(t, "no cache cb")
	}
	clock.Advance(10 * time.Second)
	select {
	case res := <-chatUI.ThreadCb:
		require.True(t, res.Full)
		require.Equal(t, 3, numNonPlace(res.Thread.Messages))
	case <-time.After(timeout):
		require.Fail(t, "no cache cb")
	}
	select {
	case err = <-cb:
		require.NoError(t, err)
	case <-time.After(timeout):
		require.Fail(t, "no end cb")
	}
}
