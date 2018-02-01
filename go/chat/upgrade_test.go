package chat

import (
	"fmt"
	"testing"

	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/gregor"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/go-codec/codec"
	"github.com/stretchr/testify/require"
)

func makeKBFSUpgradeNotification(t *testing.T, uid gregor1.UID, convID chat1.ConversationID) gregor.OutOfBandMessage {

	nm := chat1.KBFSImpteamUpgradeUpdate{
		ConvID: convID,
	}
	var data []byte
	enc := codec.NewEncoderBytes(&data, &codec.MsgpackHandle{WriteExt: true})
	require.NoError(t, enc.Encode(nm))
	m := gregor1.OutOfBandMessage{
		Uid_:    uid,
		System_: gregor1.System(types.PushKBFSUpgrade),
		Body_:   data,
	}
	return m
}

func TestChatKBFSUpgrade(t *testing.T) {
	useRemoteMock = true
	ctc := makeChatTestContext(t, "TestChatKBFSUpgrade", 2)
	defer ctc.cleanup()
	users := ctc.users()

	ctx := ctc.as(t, users[0]).startCtx
	var listeners []*serverChatListener
	listener0 := newServerChatListener()
	ctc.as(t, users[0]).h.G().SetService()
	ctc.as(t, users[0]).h.G().NotifyRouter.SetListener(listener0)
	listeners = append(listeners, listener0)
	listener1 := newServerChatListener()
	ctc.as(t, users[1]).h.G().SetService()
	ctc.as(t, users[1]).h.G().NotifyRouter.SetListener(listener1)
	listeners = append(listeners, listener1)
	uid := gregor1.UID(users[0].User.GetUID().ToBytes())

	conv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
		chat1.ConversationMembersType_KBFS, ctc.as(t, users[1]).user())
	numKBFSMsgs := 5
	for i := 0; i < numKBFSMsgs; i++ {
		r := 0
		if i < numKBFSMsgs/2 {
			r = 1
		}
		user := users[r]
		mustPostLocalForTest(t, ctc, user, conv, chat1.NewMessageBodyWithText(chat1.MessageText{
			Body: fmt.Sprintf("0: %d", i),
		}))
		consumeNewMsg(t, listeners[r], chat1.MessageType_TEXT)
		consumeNewMsg(t, listeners[r], chat1.MessageType_TEXT)
	}
	require.Equal(t, chat1.ConversationMembersType_KBFS, conv.MembersType)

	threadRes, err := ctc.as(t, users[0]).chatLocalHandler().GetThreadLocal(ctx, chat1.GetThreadLocalArg{
		ConversationID: conv.Id,
		Query: &chat1.GetThreadQuery{
			MessageTypes: []chat1.MessageType{chat1.MessageType_TEXT},
		},
	})
	require.NoError(t, err)
	require.Len(t, threadRes.Thread.Messages, numKBFSMsgs)
	for _, m := range threadRes.Thread.Messages {
		require.NotNil(t, m.Valid().ClientHeader.KbfsCryptKeysUsed)
		require.True(t, *m.Valid().ClientHeader.KbfsCryptKeysUsed)
	}

	require.NoError(t, ctc.as(t, users[0]).chatLocalHandler().UpgradeKBFSConversationToImpteam(ctx, conv.Id))
	ctc.as(t, users[0]).h.G().PushHandler.UpgradeKBFSToImpteam(ctx,
		makeKBFSUpgradeNotification(t, uid, conv.Id))

	iboxRes, err := ctc.as(t, users[0]).chatLocalHandler().GetInboxAndUnboxLocal(ctx,
		chat1.GetInboxAndUnboxLocalArg{
			Query: &chat1.GetInboxLocalQuery{
				ConvIDs: []chat1.ConversationID{conv.Id},
			},
		})
	require.NoError(t, err)
	require.Len(t, iboxRes.Conversations, 1)
	require.Equal(t, conv.Id, iboxRes.Conversations[0].GetConvID())
	require.Equal(t, chat1.ConversationMembersType_IMPTEAMUPGRADE, iboxRes.Conversations[0].GetMembersType())
}
