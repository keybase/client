package chat

import (
	"testing"
	"time"

	"github.com/keybase/client/go/protocol/chat1"
	"github.com/stretchr/testify/require"
)

func TestChatReplyToBasic(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		ctc := makeChatTestContext(t, "ChatReplyTo", 1)
		defer ctc.cleanup()
		users := ctc.users()

		ctx := ctc.as(t, users[0]).startCtx
		timeout := 20 * time.Second
		listener0 := newServerChatListener()
		ctc.as(t, users[0]).h.G().NotifyRouter.AddListener(listener0)
		t.Logf("uid0: %s", users[0].GetUID())

		conv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT, mt)
		consumeNewConversation(t, listener0, conv.Id)

		origID := mustPostLocalForTest(t, ctc, users[0], conv,
			chat1.NewMessageBodyWithText(chat1.MessageText{
				Body: "MIKE",
			}))
		consumeNewMsgRemote(t, listener0, chat1.MessageType_TEXT)
		consumeNewMsgLocal(t, listener0, chat1.MessageType_TEXT)

		// reply
		t.Logf("send reply")
		postRes, err := ctc.as(t, users[0]).chatLocalHandler().PostLocal(ctx, chat1.PostLocalArg{
			ConversationID: conv.Id,
			Msg: chat1.MessagePlaintext{
				ClientHeader: chat1.MessageClientHeader{
					Conv:        conv.Triple,
					MessageType: chat1.MessageType_TEXT,
					TlfName:     conv.TlfName,
				},
				MessageBody: chat1.NewMessageBodyWithText(chat1.MessageText{
					Body: "REPLY",
				}),
			},
			ReplyTo: &origID,
		})
		require.NoError(t, err)

		// Check that we get the reply on notifications and fetches
		select {
		case note := <-listener0.newMessageLocal:
			require.True(t, note.Message.IsValid())
			require.NotNil(t, note.Message.Valid().ReplyTo)
			require.Equal(t, origID, note.Message.Valid().ReplyTo.GetMessageID())
		case <-time.After(timeout):
			require.Fail(t, "no local")
		}
		select {
		case note := <-listener0.newMessageRemote:
			require.True(t, note.Message.IsValid())
			require.NotNil(t, note.Message.Valid().ReplyTo)
			require.Equal(t, origID, note.Message.Valid().ReplyTo.GetMessageID())
		case <-time.After(timeout):
			require.Fail(t, "no local")
		}
		threadRes, err := ctc.as(t, users[0]).chatLocalHandler().GetThreadLocal(ctx, chat1.GetThreadLocalArg{
			ConversationID: conv.Id,
			Query: &chat1.GetThreadQuery{
				MessageTypes: []chat1.MessageType{chat1.MessageType_TEXT},
			},
		})
		require.NoError(t, err)
		require.Equal(t, 2, len(threadRes.Thread.Messages))
		require.True(t, threadRes.Thread.Messages[0].IsValid())
		require.NotNil(t, threadRes.Thread.Messages[0].Valid().ReplyTo)
		require.Equal(t, origID, threadRes.Thread.Messages[0].Valid().ReplyTo.GetMessageID())

		t.Logf("edit original message")
		mustEditMsg(ctx, t, ctc, users[0], conv, origID)
		consumeNewMsgRemote(t, listener0, chat1.MessageType_EDIT)
		consumeNewMsgLocal(t, listener0, chat1.MessageType_EDIT)
		for i := 0; i < 2; i++ {
			select {
			case update := <-listener0.messagesUpdated:
				require.Equal(t, 1, len(update.Updates))
				require.Equal(t, postRes.MessageID, update.Updates[0].GetMessageID())
				require.True(t, update.Updates[0].IsValid())
				require.NotNil(t, update.Updates[0].Valid().ReplyTo)
				require.True(t, update.Updates[0].Valid().ReplyTo.IsValid())
				require.Equal(t, "edited", update.Updates[0].Valid().ReplyTo.Valid().BodySummary)
			case <-time.After(timeout):
				require.Fail(t, "no message update")
			}
		}

		t.Logf("delete original message")
		mustDeleteMsg(ctx, t, ctc, users[0], conv, origID)
		consumeNewMsgRemote(t, listener0, chat1.MessageType_DELETE)
		consumeNewMsgLocal(t, listener0, chat1.MessageType_DELETE)
		select {
		case update := <-listener0.messagesUpdated:
			require.Equal(t, 1, len(update.Updates))
			require.Equal(t, postRes.MessageID, update.Updates[0].GetMessageID())
			require.True(t, update.Updates[0].IsValid())
			require.NotNil(t, update.Updates[0].Valid().ReplyTo)
			st, err := update.Updates[0].Valid().ReplyTo.State()
			require.NoError(t, err)
			require.Equal(t, chat1.MessageUnboxedState_PLACEHOLDER, st)
		case <-time.After(timeout):
			require.Fail(t, "no message update")
		}
	})
}
