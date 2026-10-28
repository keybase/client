package chat

import (
	"testing"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

// Records the account each pending (outbox) incoming-message activity is addressed to.
type pendingActivityListener struct {
	libkb.NoopNotifyListener
	uids chan keybase1.UID
}

func (l *pendingActivityListener) NewChatActivity(uid keybase1.UID, activity chat1.ChatActivity,
	_ chat1.ChatActivitySource,
) {
	typ, err := activity.ActivityType()
	if err != nil || typ != chat1.ChatActivityType_INCOMING_MESSAGE {
		return
	}
	if !activity.IncomingMessage().Message.IsOutbox() {
		return
	}
	select {
	case l.uids <- uid:
	default:
	}
}

// A message posted through the app's nonblocking path is shown as pending through an outbox
// activity before it is sent. Every chat activity names the account it was made for, and the app
// drops one that does not name the signed-in account, so the pending activity must name the poster.
func TestChatSrvPendingMessageActivityNamesTheAccount(t *testing.T) {
	ctc := makeChatTestContext(t, "PendingActivityUID", 1)
	defer ctc.cleanup()
	users := ctc.users()
	tc := ctc.as(t, users[0])

	listener := &pendingActivityListener{uids: make(chan keybase1.UID, 4)}
	tc.h.G().NotifyRouter.AddListener(listener)
	created := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
		chat1.ConversationMembersType_IMPTEAMNATIVE)

	_, err := tc.chatLocalHandler().PostTextNonblock(tc.startCtx, chat1.PostTextNonblockArg{
		ConversationID:   created.Id,
		TlfName:          created.TlfName,
		Body:             "pending",
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
	})
	require.NoError(t, err)

	select {
	case uid := <-listener.uids:
		require.Equal(t, users[0].User.GetUID(), uid, "the pending message activity names the account that posted it")
	case <-time.After(20 * time.Second):
		require.Fail(t, "no pending message activity")
	}
}
