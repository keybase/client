package chat

import (
	"context"
	"regexp"
	"testing"

	"github.com/keybase/client/go/kbtest"

	"github.com/keybase/client/go/chat/attachments"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/kbhttp/manager"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/stretchr/testify/require"
)

func checkEmoji(ctx context.Context, t *testing.T, tc *kbtest.ChatTestContext,
	uid gregor1.UID, conv chat1.ConversationInfoLocal, msgID chat1.MessageID, emoji string) {
	msg, err := GetMessage(ctx, tc.Context(), uid, conv.Id, msgID, true, nil)
	require.NoError(t, err)
	require.True(t, msg.IsValid())
	require.Equal(t, 1, len(msg.Valid().Emojis))
	require.Equal(t, emoji, msg.Valid().Emojis[0].Alias)
	uimsg := utils.PresentMessageUnboxed(ctx, tc.Context(), msg, uid, conv.Id)
	require.True(t, uimsg.IsValid())
	require.NotNil(t, uimsg.Valid().DecoratedTextBody)
	checker := regexp.MustCompile(utils.ServiceDecorationPrefix)
	require.True(t, checker.Match([]byte(*uimsg.Valid().DecoratedTextBody)))
}

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
	_, err := tc.Context().EmojiSource.Add(ctx, uid, conv.Id, "party_parrot", filename, nil)
	require.NoError(t, err)
	_, err = tc.Context().EmojiSource.Add(ctx, uid, conv.Id, "mike", filename, nil)
	require.NoError(t, err)

	teamConv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
		chat1.ConversationMembersType_TEAM)

	_, err = tc.Context().EmojiSource.Add(ctx, uid, teamConv.Id, "mike2", filename, nil)
	require.NoError(t, err)
	_, err = tc.Context().EmojiSource.Add(ctx, uid, teamConv.Id, "party_parrot2", filename, nil)
	require.NoError(t, err)

	res, err := tc.Context().EmojiSource.Get(ctx, uid, nil)
	require.NoError(t, err)
	require.Equal(t, 2, len(res.Emojis))
	for _, group := range res.Emojis {
		require.True(t, group.Name == conv.TlfName || group.Name == teamConv.TlfName)
		require.Equal(t, 2, len(group.Emojis))
		for _, emoji := range group.Emojis {
			require.True(t, emoji.Alias == "mike" || emoji.Alias == "party_parrot" ||
				emoji.Alias == "mike2" || emoji.Alias == "party_parrot2")
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
	checkEmoji(ctx, t, tc, uid, conv, msgID, "party_parrot")
}

func TestEmojiSourceCrossTeam(t *testing.T) {
	useRemoteMock = false
	defer func() { useRemoteMock = true }()
	ctc := makeChatTestContext(t, "TestEmojiSourceCrossTeam", 3)
	defer ctc.cleanup()

	users := ctc.users()
	uid := users[0].User.GetUID().ToBytes()
	uid1 := users[0].User.GetUID().ToBytes()
	tc := ctc.world.Tcs[users[0].Username]
	tc1 := ctc.world.Tcs[users[1].Username]
	ctx := ctc.as(t, users[0]).startCtx
	ctx1 := ctc.as(t, users[1]).startCtx
	ri := ctc.as(t, users[0]).ri
	store := attachments.NewStoreTesting(tc.Context(), nil)
	fetcher := NewRemoteAttachmentFetcher(tc.Context(), store)
	tc.ChatG.AttachmentURLSrv = NewAttachmentHTTPSrv(tc.Context(),
		manager.NewSrv(tc.Context().ExternalG()),
		fetcher, func() chat1.RemoteInterface { return ri })
	uploader := attachments.NewUploader(tc.Context(), store, mockSigningRemote{},
		func() chat1.RemoteInterface { return ri }, 1)
	tc.ChatG.AttachmentUploader = uploader
	filename := "./testdata/ship.jpg"

	aloneConv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
		chat1.ConversationMembersType_TEAM)
	sharedConv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
		chat1.ConversationMembersType_TEAM, users[1])
	sharedConv2 := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
		chat1.ConversationMembersType_TEAM, users[2])

	t.Logf("basic")
	_, err := tc.Context().EmojiSource.Add(ctx, uid, aloneConv.Id, "party_parrot", filename, nil)
	require.NoError(t, err)

	msgID := mustPostLocalForTest(t, ctc, users[0], sharedConv, chat1.NewMessageBodyWithText(chat1.MessageText{
		Body: "ITS TIME :party_parrot:!",
	}))
	checkEmoji(ctx1, t, tc1, uid1, sharedConv, msgID, "party_parrot")

	t.Logf("collision")
	_, err = tc.Context().EmojiSource.Add(ctx, uid, sharedConv2.Id, "party_parrot", filename, nil)
	require.NoError(t, err)
	msgID = mustPostLocalForTest(t, ctc, users[0], sharedConv, chat1.NewMessageBodyWithText(chat1.MessageText{
		Body: "ITS TIME :party_parrot#2:!",
	}))
	checkEmoji(ctx1, t, tc1, uid1, sharedConv, msgID, "party_parrot#2")
}

type emojiTestCase struct {
	body     string
	expected []emojiMatch
}

func TestEmojiSourceParse(t *testing.T) {
	es := &DevConvEmojiSource{}
	ctx := context.TODO()

	testCases := []emojiTestCase{
		{
			body: "x :miked:",
			expected: []emojiMatch{
				{
					name:     "miked",
					position: []int{2, 9},
				},
			},
		},
		{
			body: ":333mm__--M:",
			expected: []emojiMatch{
				{
					name:     "333mm__--M",
					position: []int{0, 12},
				},
			},
		},
		{
			body: ":mike: :lisa:",
			expected: []emojiMatch{
				{
					name:     "mike",
					position: []int{0, 6},
				},
				{
					name:     "lisa",
					position: []int{7, 13},
				},
			},
		},
		{
			body: ":mike::lisa:",
			expected: []emojiMatch{
				{
					name:     "mike",
					position: []int{0, 6},
				},
				{
					name:     "lisa",
					position: []int{6, 12},
				},
			},
		},
		{
			body: "::",
		},
	}
	for _, tc := range testCases {
		res := es.parse(ctx, tc.body)
		require.Equal(t, tc.expected, res)
	}
}
