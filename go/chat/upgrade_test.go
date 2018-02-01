package chat

import (
	"fmt"
	"testing"

	"github.com/keybase/client/go/protocol/chat1"
	"github.com/stretchr/testify/require"
)

func TestChatKBFSUpgrade(t *testing.T) {
	ctc := makeChatTestContext(t, "TestChatSrvKBFSUpgrade", 2)
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

	threadRes, err := ctc.as(t, users[0]).chatLocalHandler().GetThreadLocal(ctx, chat1.GetThreadLocalArg{
		ConversationID: conv.Id,
		Query: &chat1.GetThreadQuery{
			MessageTypes: []chat1.MessageType{chat1.MessageType_TEXT},
		},
	})
	require.NoError(t, err)
	require.Len(t, threadRes.Thread.Messages, numKBFSMsgs)

	require.NoError(t, ctc.as(t, users[0]).chatLocalHandler().UpgradeKBFSConversationToImpteam(ctx, conv.Id))
}
