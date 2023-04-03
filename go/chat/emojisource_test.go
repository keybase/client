package chat

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"os"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/keybase/client/go/kbtest"

	"github.com/keybase/client/go/chat/attachments"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/kbhttp/manager"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/stretchr/testify/require"
)

var decorateBegin = "$>kb$"
var decorateEnd = "$<kb$"

func checkEmoji(ctx context.Context, t *testing.T, tc *kbtest.ChatTestContext,
	uid gregor1.UID, conv chat1.ConversationInfoLocal, msgID chat1.MessageID, emoji string) {
	msg, err := tc.Context().ConvSource.GetMessage(ctx, conv.Id, uid, msgID, nil, nil, true)
	require.NoError(t, err)
	require.True(t, msg.IsValid())
	require.Equal(t, 1, len(msg.Valid().Emojis))
	require.Equal(t, emoji, msg.Valid().Emojis[0].Alias)
	uimsg := utils.PresentMessageUnboxed(ctx, tc.Context(), msg, uid, conv.Id)
	require.True(t, uimsg.IsValid())
	require.NotNil(t, uimsg.Valid().DecoratedTextBody)
	checker := regexp.MustCompile(utils.ServiceDecorationPrefix)
	require.True(t, checker.Match([]byte(*uimsg.Valid().DecoratedTextBody)))
	payload := strings.ReplaceAll(*uimsg.Valid().DecoratedTextBody, decorateBegin, "")
	payload = strings.ReplaceAll(payload, decorateEnd, "")
	t.Logf("payload: %s", payload)
	dat, err := base64.StdEncoding.DecodeString(payload)
	require.NoError(t, err)
	var dec chat1.UITextDecoration
	require.NoError(t, json.Unmarshal(dat, &dec))
	typ, err := dec.Typ()
	require.NoError(t, err)
	require.Equal(t, chat1.UITextDecorationTyp_EMOJI, typ)
	require.True(t, dec.Emoji().Source.IsHTTPSrv())
	resp, err := http.Get(dec.Emoji().Source.Httpsrv())
	require.NoError(t, err)
	defer resp.Body.Close()
	require.Equal(t, http.StatusOK, resp.StatusCode)
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
	filename := "./testdata/party_parrot.gif"
	tc.ChatG.EmojiSource.(*DevConvEmojiSource).tempDir = os.TempDir()

	conv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
		chat1.ConversationMembersType_IMPTEAMNATIVE)

	t.Logf("admin")
	source, err := tc.Context().EmojiSource.Add(ctx, uid, conv.Id, "party_parrot", filename, false)
	require.NoError(t, err)
	_, err = tc.Context().EmojiSource.Add(ctx, uid, conv.Id, "+1", filename, false)
	require.NoError(t, err)

	teamConv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
		chat1.ConversationMembersType_TEAM)

	_, err = tc.Context().EmojiSource.Add(ctx, uid, teamConv.Id, "mike2", filename, false)
	require.NoError(t, err)
	_, err = tc.Context().EmojiSource.Add(ctx, uid, teamConv.Id, "party_parrot2", filename, false)
	require.NoError(t, err)

	res, err := tc.Context().EmojiSource.Get(ctx, uid, nil, chat1.EmojiFetchOpts{
		GetCreationInfo: true,
		GetAliases:      true,
	})
	require.NoError(t, err)
	require.Equal(t, 2, len(res.Emojis))
	for _, group := range res.Emojis {
		require.True(t, group.Name == conv.TlfName || group.Name == teamConv.TlfName)
		require.Equal(t, 2, len(group.Emojis))
		for _, emoji := range group.Emojis {
			require.True(t, emoji.Alias == "+1#2" || emoji.Alias == "party_parrot" ||
				emoji.Alias == "mike2" || emoji.Alias == "party_parrot2", emoji.Alias)
			styp, err := emoji.Source.Typ()
			require.NoError(t, err)
			require.Equal(t, chat1.EmojiLoadSourceTyp_HTTPSRV, styp)
			require.NotZero(t, len(emoji.Source.Httpsrv()))
		}
	}

	t.Logf("decorate")
	msgID := mustPostLocalForTest(t, ctc, users[0], conv, chat1.NewMessageBodyWithText(chat1.MessageText{
		Body: ":party_parrot:",
	}))
	checkEmoji(ctx, t, tc, uid, conv, msgID, "party_parrot")

	t.Logf("remove")
	_, err = tc.Context().ConvSource.GetMessage(ctx, source.Message().ConvID, uid, source.Message().MsgID,
		nil, nil, true)
	require.NoError(t, err)
	require.NoError(t, tc.Context().EmojiSource.Remove(ctx, uid, conv.Id, "party_parrot"))
	require.True(t, source.IsMessage())
	_, err = tc.Context().ConvSource.GetMessage(ctx, source.Message().ConvID, uid, source.Message().MsgID,
		nil, nil, true)
	require.Error(t, err)
	res, err = tc.Context().EmojiSource.Get(ctx, uid, &conv.Id, chat1.EmojiFetchOpts{
		GetCreationInfo: true,
		GetAliases:      true,
	})
	require.NoError(t, err)
	checked := false
	for _, group := range res.Emojis {
		if group.Name == conv.TlfName {
			require.Equal(t, 1, len(group.Emojis))
			checked = true
		}
	}
	require.True(t, checked)

	t.Logf("alias")
	_, err = tc.Context().EmojiSource.AddAlias(ctx, uid, conv.Id, "mike2", "+1")
	require.NoError(t, err)
	res, err = tc.Context().EmojiSource.Get(ctx, uid, &conv.Id, chat1.EmojiFetchOpts{
		GetCreationInfo: true,
		GetAliases:      true,
	})
	require.NoError(t, err)
	checked = false
	for _, group := range res.Emojis {
		if group.Name == conv.TlfName {
			require.Equal(t, 2, len(group.Emojis))
			checked = true
		}
	}
	require.True(t, checked)
	msgID = mustPostLocalForTest(t, ctc, users[0], conv, chat1.NewMessageBodyWithText(chat1.MessageText{
		Body: ":mike2:",
	}))
	checkEmoji(ctx, t, tc, uid, conv, msgID, "mike2")
	require.NoError(t, tc.Context().EmojiSource.Remove(ctx, uid, conv.Id, "mike2"))
	res, err = tc.Context().EmojiSource.Get(ctx, uid, &conv.Id, chat1.EmojiFetchOpts{
		GetCreationInfo: true,
		GetAliases:      true,
	})
	require.NoError(t, err)
	checked = false
	for _, group := range res.Emojis {
		if group.Name == conv.TlfName {
			t.Logf("emojis: %+v", group.Emojis)
			require.Equal(t, 1, len(group.Emojis))
			checked = true
		}
	}
	require.True(t, checked)
	msgID = mustPostLocalForTest(t, ctc, users[0], conv, chat1.NewMessageBodyWithText(chat1.MessageText{
		Body: ":+1#2:",
	}))
	checkEmoji(ctx, t, tc, uid, conv, msgID, "+1#2")
	_, err = tc.Context().EmojiSource.AddAlias(ctx, uid, conv.Id, "mike2", "+1")
	require.NoError(t, err)
	require.NoError(t, tc.Context().EmojiSource.Remove(ctx, uid, conv.Id, "+1"))
	res, err = tc.Context().EmojiSource.Get(ctx, uid, &conv.Id, chat1.EmojiFetchOpts{
		GetCreationInfo: true,
		GetAliases:      true,
	})
	require.NoError(t, err)
	checked = false
	for _, group := range res.Emojis {
		if group.Name == conv.TlfName {
			require.Zero(t, len(group.Emojis))
			checked = true
		}
	}
	require.True(t, checked)

	t.Logf("stock alias")
	_, err = tc.Context().EmojiSource.AddAlias(ctx, uid, conv.Id, ":my+1:", ":+1::skin-tone-0:")
	require.NoError(t, err)
	res, err = tc.Context().EmojiSource.Get(ctx, uid, &conv.Id, chat1.EmojiFetchOpts{
		GetCreationInfo: true,
		GetAliases:      true,
	})
	require.NoError(t, err)
	checked = false
	for _, group := range res.Emojis {
		if group.Name == conv.TlfName {
			require.Len(t, group.Emojis, 1)
			emoji := group.Emojis[0]
			require.Equal(t, chat1.Emoji{
				Alias:        ":my+1:",
				IsBig:        false,
				IsReacji:     false,
				IsCrossTeam:  false,
				IsAlias:      true,
				Teamname:     &conv.TlfName,
				Source:       chat1.NewEmojiLoadSourceWithStr(":+1::skin-tone-0:"),
				NoAnimSource: chat1.NewEmojiLoadSourceWithStr(":+1::skin-tone-0:"),
				RemoteSource: chat1.NewEmojiRemoteSourceWithStockalias(chat1.EmojiStockAlias{
					Text:     ":+1::skin-tone-0:",
					Username: users[0].Username,
					Time:     gregor1.ToTime(ctc.world.Fc.Now()),
				}),
				CreationInfo: &chat1.EmojiCreationInfo{
					Username: users[0].Username,
					Time:     gregor1.ToTime(ctc.world.Fc.Now()),
				},
			}, emoji)
			checked = true
		}
	}
	require.True(t, checked)
}

type emojiAliasTestCase struct {
	input, output string
	emojis        []chat1.HarvestedEmoji
}

func TestEmojiSourceAliasDecorate(t *testing.T) {
	useRemoteMock = false
	defer func() { useRemoteMock = true }()
	ctc := makeChatTestContext(t, "TestEmojiSourceAliasDecorate", 1)
	defer ctc.cleanup()

	users := ctc.users()
	uid := users[0].User.GetUID().ToBytes()
	tc := ctc.world.Tcs[users[0].Username]
	ctx := ctc.as(t, users[0]).startCtx

	source := tc.Context().EmojiSource.(*DevConvEmojiSource)
	testCases := []emojiAliasTestCase{
		{
			input:  "this is a test! :my+1: <- thumbs up",
			output: "this is a test! :+1::skin-tone-0: <- thumbs up",
			emojis: []chat1.HarvestedEmoji{
				{
					Alias: "my+1",
					Source: chat1.NewEmojiRemoteSourceWithStockalias(chat1.EmojiStockAlias{
						Text: ":+1::skin-tone-0:",
					}),
				}},
		},
		{
			input:  ":my+1: <- :nothing: dksjdksdj :: :alias:",
			output: ":+1::skin-tone-0: <- :nothing: dksjdksdj :: :karen:",
			emojis: []chat1.HarvestedEmoji{
				{
					Alias: "my+1",
					Source: chat1.NewEmojiRemoteSourceWithStockalias(chat1.EmojiStockAlias{
						Text: ":+1::skin-tone-0:",
					}),
				},
				{
					Alias: "alias",
					Source: chat1.NewEmojiRemoteSourceWithStockalias(chat1.EmojiStockAlias{
						Text: ":karen:",
					}),
				},
			},
		},
		{
			input:  ":nothing: dskjdksdjs ::: :my+1: <- :nothing: dksjdksdj :: :alias: !!",
			output: ":nothing: dskjdksdjs ::: :+1::skin-tone-0: <- :nothing: dksjdksdj :: :karen: !!",
			emojis: []chat1.HarvestedEmoji{
				{
					Alias: "my+1",
					Source: chat1.NewEmojiRemoteSourceWithStockalias(chat1.EmojiStockAlias{
						Text: ":+1::skin-tone-0:",
					}),
				},
				{
					Alias: "alias",
					Source: chat1.NewEmojiRemoteSourceWithStockalias(chat1.EmojiStockAlias{
						Text: ":karen:",
					}),
				},
			},
		},
	}
	for _, testCase := range testCases {
		output := source.Decorate(ctx, testCase.input, uid, chat1.MessageType_TEXT, testCase.emojis)
		require.Equal(t, testCase.output, output)
	}
}

func TestEmojiSourceCrossTeam(t *testing.T) {
	useRemoteMock = false
	defer func() { useRemoteMock = true }()
	ctc := makeChatTestContext(t, "TestEmojiSourceCrossTeam", 4)
	defer ctc.cleanup()

	users := ctc.users()
	uid := users[0].User.GetUID().ToBytes()
	uid1 := gregor1.UID(users[1].User.GetUID().ToBytes())
	tc := ctc.world.Tcs[users[0].Username]
	tc1 := ctc.world.Tcs[users[1].Username]
	ctx := ctc.as(t, users[0]).startCtx
	ctx1 := ctc.as(t, users[1]).startCtx
	ri := ctc.as(t, users[0]).ri
	ri1 := ctc.as(t, users[1]).ri
	store := attachments.NewStoreTesting(tc.Context(), nil)
	fetcher := NewRemoteAttachmentFetcher(tc.Context(), store)
	source := tc.Context().EmojiSource.(*DevConvEmojiSource)
	source1 := tc1.Context().EmojiSource.(*DevConvEmojiSource)
	source.tempDir = os.TempDir()
	source1.tempDir = os.TempDir()
	syncCreated := make(chan struct{}, 10)
	syncRefresh := make(chan struct{}, 10)
	source.testingCreatedSyncConv = syncCreated
	source.testingRefreshedSyncConv = syncRefresh
	timeout := 2 * time.Second
	expectCreated := func(expect bool) {
		if expect {
			select {
			case <-syncCreated:
			case <-time.After(timeout):
				require.Fail(t, "no sync created")
			}
		} else {
			time.Sleep(100 * time.Millisecond)
			select {
			case <-syncCreated:
				require.Fail(t, "no sync created expected")
			default:
			}
		}
	}
	expectRefresh := func(expect bool) {
		if expect {
			select {
			case <-syncRefresh:
			case <-time.After(timeout):
				require.Fail(t, "no sync refresh")
			}
		} else {
			time.Sleep(100 * time.Millisecond)
			select {
			case <-syncRefresh:
				require.Fail(t, "no sync refresh expected")
			default:
			}
		}
	}

	tc.ChatG.AttachmentURLSrv = NewAttachmentHTTPSrv(tc.Context(),
		manager.NewSrv(tc.Context().ExternalG()),
		fetcher, func() chat1.RemoteInterface { return ri })
	tc1.ChatG.AttachmentURLSrv = NewAttachmentHTTPSrv(tc1.Context(),
		manager.NewSrv(tc1.Context().ExternalG()),
		fetcher, func() chat1.RemoteInterface { return ri1 })
	uploader := attachments.NewUploader(tc.Context(), store, mockSigningRemote{},
		func() chat1.RemoteInterface { return ri }, 1)
	tc.ChatG.AttachmentUploader = uploader
	filename := "./testdata/party_parrot.gif"
	t.Logf("uid1: %s", uid1)

	aloneConv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
		chat1.ConversationMembersType_TEAM)
	sharedConv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
		chat1.ConversationMembersType_TEAM, users[1], users[3])
	sharedConv2 := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
		chat1.ConversationMembersType_TEAM, users[2], users[3])

	t.Logf("basic")
	_, err := tc.Context().EmojiSource.Add(ctx, uid, aloneConv.Id, "party_parrot", filename, false)
	require.NoError(t, err)
	_, err = tc.Context().EmojiSource.Add(ctx, uid, aloneConv.Id, "success-kid", filename, false)
	require.NoError(t, err)
	_, err = tc.Context().EmojiSource.Add(ctx, uid, sharedConv2.Id, "mike", filename, false)
	require.NoError(t, err)
	_, err = tc.Context().EmojiSource.Add(ctx, uid, sharedConv2.Id, "rock", filename, false)
	require.NoError(t, err)

	msgID := mustPostLocalForTest(t, ctc, users[0], sharedConv, chat1.NewMessageBodyWithText(chat1.MessageText{
		Body: ":party_parrot:",
	}))
	checkEmoji(ctx1, t, tc1, uid1, sharedConv, msgID, "party_parrot")
	expectCreated(true)
	expectRefresh(true)
	msgID = mustPostLocalForTest(t, ctc, users[0], sharedConv, chat1.NewMessageBodyWithText(chat1.MessageText{
		Body: ":success-kid:",
	}))
	checkEmoji(ctx1, t, tc1, uid1, sharedConv, msgID, "success-kid")
	expectCreated(false)
	expectRefresh(true)
	msgID = mustPostLocalForTest(t, ctc, users[0], sharedConv, chat1.NewMessageBodyWithText(chat1.MessageText{
		Body: ":party_parrot:",
	}))
	checkEmoji(ctx1, t, tc1, uid1, sharedConv, msgID, "party_parrot")
	expectCreated(false)
	expectRefresh(false)
	t.Logf("post from different source")
	msgID = mustPostLocalForTest(t, ctc, users[0], sharedConv, chat1.NewMessageBodyWithText(chat1.MessageText{
		Body: ":mike:",
	}))
	checkEmoji(ctx1, t, tc1, uid1, sharedConv, msgID, "mike")
	expectCreated(true)
	expectRefresh(true)
	msgID = mustPostLocalForTest(t, ctc, users[0], sharedConv, chat1.NewMessageBodyWithText(chat1.MessageText{
		Body: ":mike:",
	}))
	checkEmoji(ctx1, t, tc1, uid1, sharedConv, msgID, "mike")
	expectCreated(false)
	expectRefresh(false)
	t.Logf("different user tries posting after convs are created")
	msgID = mustPostLocalForTest(t, ctc, users[3], sharedConv, chat1.NewMessageBodyWithText(chat1.MessageText{
		Body: ":mike:",
	}))
	checkEmoji(ctx1, t, tc1, uid1, sharedConv, msgID, "mike")
	expectCreated(false)
	expectRefresh(false)

	t.Logf("collision")
	_, err = tc.Context().EmojiSource.Add(ctx, uid, sharedConv2.Id, "party_parrot", filename, false)
	require.NoError(t, err)
	msgID = mustPostLocalForTest(t, ctc, users[0], sharedConv, chat1.NewMessageBodyWithText(chat1.MessageText{
		Body: ":party_parrot#2:",
	}))
	checkEmoji(ctx1, t, tc1, uid1, sharedConv, msgID, "party_parrot#2")

	// error on edit
	_, err = tc.Context().EmojiSource.Add(ctx, uid, aloneConv.Id, "party_parrot", filename, false)
	require.Error(t, err)
	_, err = tc.Context().EmojiSource.Add(ctx, uid, aloneConv.Id, "party_parrot", filename, true)
	require.NoError(t, err)

	t.Logf("stock collision")
	msgID = mustPostLocalForTest(t, ctc, users[0], sharedConv, chat1.NewMessageBodyWithText(chat1.MessageText{
		Body: ":rock#2:",
	}))
	checkEmoji(ctx1, t, tc1, uid1, sharedConv, msgID, "rock#2")
	expectCreated(false)
	expectRefresh(true)
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

func TestEmojiSourceIsStock(t *testing.T) {
	es := &DevConvEmojiSource{}
	require.True(t, es.IsStockEmoji("+1"))
	require.True(t, es.IsStockEmoji(":+1:"))
	require.True(t, es.IsStockEmoji(":+1::skin-tone-5:"))
	require.False(t, es.IsStockEmoji("foo"))
}
