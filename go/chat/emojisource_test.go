package chat

import (
	"testing"

	"github.com/keybase/client/go/protocol/chat1"
	"github.com/stretchr/testify/require"
)

func TestEmojiSourceBasic(t *testing.T) {
	useRemoteMock = false
	defer func() { useRemoteMock = true }()
	ctc := makeChatTestContext(t, "TestEmojiSourceBasic", 1)
	defer ctc.cleanup()

	users := ctc.users()
	uid := users[0].User.GetUID().ToBytes()
	tc := ctc.world.Tcs[users[0].Username]
	ctx := ctc.as(t, users[0]).startCtx

	conv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
		chat1.ConversationMembersType_IMPTEAMNATIVE)

	require.NoError(t, tc.Context().EmojiSource.Add(ctx, uid, conv.Id, "party_parrot", ""))
}
