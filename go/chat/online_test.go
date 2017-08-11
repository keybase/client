package chat

import (
	"testing"
	"time"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestOnline(t *testing.T) {
	ctc := makeChatTestContext(t, "ResolveConversationLocal", 2)
	defer ctc.cleanup()
	users := ctc.users()

	ctx := ctc.as(t, users[0]).startCtx
	created := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
		chat1.ConversationMembersType_KBFS, ctc.as(t, users[1]).user())

	// XXX cleanup if this works
	g := ctc.world.Tcs[users[0].Username].G

	g.AppState.Update(keybase1.AppState_BACKGROUND)

	time.Sleep(5 * time.Second)

	gilres, err := ctc.as(t, users[0]).chatLocalHandler().GetInboxAndUnboxLocal(ctx, chat1.GetInboxAndUnboxLocalArg{
		Query: &chat1.GetInboxLocalQuery{
			ConvIDs: []chat1.ConversationID{created.Id},
		},
	})
	if err != nil {
		t.Fatalf("GetInboxAndUnboxLocal error: %v", err)
	}
	conversations := gilres.Conversations
	if len(conversations) != 1 {
		t.Fatalf("unexpected response from GetInboxAndUnboxLocal. expected 1 items, got %d\n", len(conversations))
	}

	if gilres.Offline {
		t.Errorf("offline, but not really")
	}
}

func TestChatForeground(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		ctc := makeChatTestContext(t, "ChatForeground", 1)
		defer ctc.cleanup()
		users := ctc.users()

		inboxCb := make(chan kbtest.NonblockInboxResult, 100)
		threadCb := make(chan kbtest.NonblockThreadResult, 100)
		ui := kbtest.NewChatUI(inboxCb, threadCb)
		ctc.as(t, users[0]).h.mockChatUI = ui

		t.Logf("test empty thread")
		query := chat1.GetThreadQuery{
			MessageTypes: []chat1.MessageType{chat1.MessageType_TEXT},
		}
		ctx := ctc.as(t, users[0]).startCtx
		conv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT, mt)
		_, err := ctc.as(t, users[0]).chatLocalHandler().GetThreadNonblock(ctx,
			chat1.GetThreadNonblockArg{
				ConversationID:   conv.Id,
				IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
				Query:            &query,
			},
		)
		require.NoError(t, err)
		res := receiveThreadResult(t, threadCb)
		require.Zero(t, len(res.Messages))

		t.Logf("send a bunch of messages")
		numMsgs := 20
		msg := chat1.NewMessageBodyWithText(chat1.MessageText{Body: "hi"})
		for i := 0; i < numMsgs; i++ {
			mustPostLocalForTest(t, ctc, users[0], conv, msg)
		}

		// XXX cleanup if works
		g := ctc.world.Tcs[users[0].Username].G

		// go background
		g.AppState.Update(keybase1.AppState_BACKGROUND)

		time.Sleep(1 * time.Second)

		// go foreground
		g.AppState.Update(keybase1.AppState_FOREGROUND)

		t.Logf("read back full thread")
		gtres, err := ctc.as(t, users[0]).chatLocalHandler().GetThreadNonblock(ctx,
			chat1.GetThreadNonblockArg{
				ConversationID:   conv.Id,
				IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
				Query:            &query,
			},
		)
		require.NoError(t, err)

		if gtres.Offline {
			t.Fatal("gtres offline")
		}

		res = receiveThreadResult(t, threadCb)
		require.Equal(t, numMsgs, len(res.Messages))

		// check res.offline
		// check gtres (_ above) offline flag
	})
}
