package chat

import (
	"testing"

	"github.com/keybase/client/go/chat/attachments"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/kbhttp/manager"
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
	ri := ctc.as(t, users[0]).ri
	tc.ChatG.AttachmentURLSrv = NewAttachmentHTTPSrv(tc.Context(),
		manager.NewSrv(tc.Context().ExternalG()),
		types.DummyAttachmentFetcher{},
		func() chat1.RemoteInterface { return ri })
	store := attachments.NewStoreTesting(tc.Context(), nil)
	uploader := attachments.NewUploader(tc.Context(), store, mockSigningRemote{},
		func() chat1.RemoteInterface { return ri }, 1)
	tc.ChatG.AttachmentUploader = uploader
	filename := "./testdata/ship.jpg"

	conv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
		chat1.ConversationMembersType_IMPTEAMNATIVE)

	t.Logf("admin")
	require.NoError(t, tc.Context().EmojiSource.Add(ctx, uid, conv.Id, "party_parrot", filename))
	require.NoError(t, tc.Context().EmojiSource.Add(ctx, uid, conv.Id, "mike", filename))

	teamConv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
		chat1.ConversationMembersType_TEAM)

	require.NoError(t, tc.Context().EmojiSource.Add(ctx, uid, teamConv.Id, "mike", filename))
	require.NoError(t, tc.Context().EmojiSource.Add(ctx, uid, teamConv.Id, "party_parrot", filename))

	res, err := tc.Context().EmojiSource.Get(ctx, uid, nil)
	require.NoError(t, err)
	require.Equal(t, 2, len(res.Emojis))
	for _, group := range res.Emojis {
		require.True(t, group.Name == conv.TlfName || group.Name == teamConv.TlfName)
		require.Equal(t, 2, len(group.Emojis))
		for _, emoji := range group.Emojis {
			require.True(t, emoji.Alias == "mike" || emoji.Alias == "party_parrot")
			styp, err := emoji.Source.Typ()
			require.NoError(t, err)
			require.Equal(t, chat1.EmojiLoadSourceTyp_HTTPSRV, styp)
			require.NotZero(t, len(emoji.Source.Httpsrv()))
		}
	}

	t.Logf("decorate")
	msgID := mustPostLocalForTest(t, ctc, users[0], conv, chat1.NewMessageBodyWithText(chat1.MessageText{
		Body: "ITS TIME :party_parrot:!",
	}))
	msg, err := GetMessage(ctx, tc.Context(), uid, conv.Id, msgID, true, nil)
	require.NoError(t, err)
	require.True(t, msg.IsValid())
	require.Equal(t, 1, len(msg.Valid().Emojis))
	require.Equal(t, "party_parrot", msg.Valid().Emojis[0].Alias)
	uimsg := utils.PresentMessageUnboxed(ctx, tc.Context(), msg, uid, conv.Id)
	require.True(t, uimsg.IsValid())
	require.NotNil(t, uimsg.Valid().DecoratedTextBody)
}
