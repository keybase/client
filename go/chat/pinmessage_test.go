package chat

import (
	"testing"
	"time"

	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/stretchr/testify/require"
)

func TestPinMessages(t *testing.T) {
	useRemoteMock = false
	defer func() { useRemoteMock = true }()
	ctc := makeChatTestContext(t, "TestPinMessages", 2)
	defer ctc.cleanup()

	timeout := 20 * time.Second
	users := ctc.users()
	ctx := ctc.as(t, users[0]).startCtx
	ctx1 := ctc.as(t, users[1]).startCtx
	tc := ctc.world.Tcs[users[0].Username]
	tc1 := ctc.world.Tcs[users[1].Username]
	uid := gregor1.UID(users[0].GetUID().ToBytes())
	uid1 := gregor1.UID(users[1].GetUID().ToBytes())
	listener0 := newServerChatListener()
	ctc.as(t, users[0]).h.G().NotifyRouter.AddListener(listener0)
	listener1 := newServerChatListener()
	ctc.as(t, users[1]).h.G().NotifyRouter.AddListener(listener1)

	t.Logf("test impteam")
	impConv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
		chat1.ConversationMembersType_IMPTEAMNATIVE, users[1])
	msgID := mustPostLocalForTest(t, ctc, users[0], impConv, chat1.NewMessageBodyWithText(chat1.MessageText{
		Body: "PIN THIS NOW",
	}))
	consumeNewMsgRemote(t, listener0, chat1.MessageType_TEXT)
	consumeNewMsgRemote(t, listener1, chat1.MessageType_TEXT)
	_, err := ctc.as(t, users[0]).chatLocalHandler().PinMessage(ctx, chat1.PinMessageArg{
		ConvID: impConv.Id,
		MsgID:  msgID,
	})
	require.NoError(t, err)
	consumeNewMsgRemote(t, listener0, chat1.MessageType_PIN)
	consumeNewMsgRemote(t, listener1, chat1.MessageType_PIN)
	conv, err := utils.GetVerifiedConv(ctx, tc.Context(), uid, impConv.Id, types.InboxSourceDataSourceAll)
	require.NoError(t, err)
	require.NotNil(t, conv.Info.PinnedMsg)
	require.Equal(t, msgID, conv.Info.PinnedMsg.Message.GetMessageID())
	conv, err = utils.GetVerifiedConv(ctx1, tc1.Context(), uid1, impConv.Id, types.InboxSourceDataSourceAll)
	require.NoError(t, err)
	require.NotNil(t, conv.Info.PinnedMsg)
	require.Equal(t, msgID, conv.Info.PinnedMsg.Message.GetMessageID())

	_, err = ctc.as(t, users[1]).chatLocalHandler().UnpinMessage(ctx1, impConv.Id)
	require.Error(t, err)
	require.NoError(t, ctc.as(t, users[1]).chatLocalHandler().IgnorePinnedMessage(ctx1, impConv.Id))
	select {
	case <-listener1.convUpdate:
	case <-time.After(timeout):
		require.Fail(t, "no stale")
	}
	conv, err = utils.GetVerifiedConv(ctx1, tc1.Context(), uid1, impConv.Id, types.InboxSourceDataSourceAll)
	require.NoError(t, err)
	require.Nil(t, conv.Info.PinnedMsg)
	_, err = ctc.as(t, users[0]).chatLocalHandler().UnpinMessage(ctx, impConv.Id)
	require.NoError(t, err)
	consumeNewMsgRemote(t, listener0, chat1.MessageType_DELETE)
	consumeNewMsgRemote(t, listener1, chat1.MessageType_DELETE)
	conv, err = utils.GetVerifiedConv(ctx, tc.Context(), uid, impConv.Id, types.InboxSourceDataSourceAll)
	require.NoError(t, err)
	require.Nil(t, conv.Info.PinnedMsg)

	t.Logf("test team")
	teamConv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
		chat1.ConversationMembersType_TEAM, users[1])
	msgID = mustPostLocalForTest(t, ctc, users[0], teamConv, chat1.NewMessageBodyWithText(chat1.MessageText{
		Body: "PIN THIS NOW",
	}))
	consumeNewMsgRemote(t, listener0, chat1.MessageType_TEXT)
	consumeNewMsgRemote(t, listener1, chat1.MessageType_TEXT)
	_, err = ctc.as(t, users[1]).chatLocalHandler().PinMessage(ctx1, chat1.PinMessageArg{
		ConvID: teamConv.Id,
		MsgID:  msgID,
	})
	require.NoError(t, err)
	consumeNewMsgRemote(t, listener0, chat1.MessageType_PIN)
	consumeNewMsgRemote(t, listener1, chat1.MessageType_PIN)
	_, err = ctc.as(t, users[0]).chatLocalHandler().UnpinMessage(ctx, teamConv.Id)
	require.NoError(t, err)
	consumeNewMsgRemote(t, listener0, chat1.MessageType_DELETE)
	consumeNewMsgRemote(t, listener1, chat1.MessageType_DELETE)
	conv, err = utils.GetVerifiedConv(ctx1, tc1.Context(), uid1, teamConv.Id, types.InboxSourceDataSourceAll)
	require.NoError(t, err)
	require.Nil(t, conv.Info.PinnedMsg)
}
