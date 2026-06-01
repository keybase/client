package chat

import (
	"context"
	"fmt"
	"sync"
	"testing"

	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/stretchr/testify/require"
)

func TestInboxSourceUpdateRace(t *testing.T) {
	ctx, world, ri, _, sender, _ := setupTest(t, 1)
	defer world.Cleanup()

	u := world.GetUsers()[0]
	uid := u.User.GetUID().ToBytes()
	tc := world.Tcs[u.Username]
	conv := newBlankConv(ctx, t, tc, uid, ri, sender, u.Username)

	_, _, err := sender.Send(ctx, conv.GetConvID(), chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			Conv:        conv.Metadata.IdTriple,
			Sender:      u.User.GetUID().ToBytes(),
			TlfName:     u.Username,
			TlfPublic:   false,
			MessageType: chat1.MessageType_TEXT,
		},
		MessageBody: chat1.NewMessageBodyWithText(chat1.MessageText{
			Body: "HIHI",
		}),
	}, 0, nil, nil, nil)
	require.NoError(t, err)

	ib, _, err := tc.ChatG.InboxSource.Read(ctx, u.User.GetUID().ToBytes(),
		types.ConversationLocalizerBlocking, types.InboxSourceDataSourceAll, nil, nil)
	require.NoError(t, err)
	require.Equal(t, chat1.InboxVers(0), ib.Version, "wrong version")

	// Spawn two goroutines to try and update the inbox at the same time with a self-update, and a
	// Gregor style update
	t.Logf("spawning update goroutines")
	var wg sync.WaitGroup

	wg.Add(1)
	go func() {
		_, err = tc.ChatG.InboxSource.SetStatus(ctx, uid, 0, conv.GetConvID(),
			chat1.ConversationStatus_UNFILED)
		require.NoError(t, err)
		wg.Done()
	}()
	wg.Add(1)
	go func() {
		_, err = tc.ChatG.InboxSource.SetStatus(ctx, uid, 1, conv.GetConvID(),
			chat1.ConversationStatus_UNFILED)
		require.NoError(t, err)
		wg.Done()
	}()
	wg.Wait()

	ib, _, err = tc.ChatG.InboxSource.Read(ctx, u.User.GetUID().ToBytes(),
		types.ConversationLocalizerBlocking, types.InboxSourceDataSourceAll, nil, nil)
	require.NoError(t, err)
	require.Equal(t, chat1.InboxVers(1), ib.Version, "wrong version")
}

// Test that when an update is received that is more than 1 ahead of the current inbox version,
// a complete sync of the inbox occurs.
func TestInboxSourceSkipAhead(t *testing.T) {
	t.Logf("setup")
	ctx, world, ri2, _, sender, _ := setupTest(t, 1)
	ri := ri2.(*kbtest.ChatRemoteMock)
	defer world.Cleanup()
	t.Logf("test's remoteInterface: %p[%T] -> %v", &ri, ri, ri)

	u := world.GetUsers()[0]
	tc := world.Tcs[u.Username]
	uid := u.User.GetUID().ToBytes()

	assertInboxVersion := func(v int) {
		ib, _, err := tc.ChatG.InboxSource.Read(ctx, u.User.GetUID().ToBytes(),
			types.ConversationLocalizerBlocking, types.InboxSourceDataSourceAll, nil, nil)
		require.Equal(t, chat1.InboxVers(v), ib.Version, "wrong version") //nolint:gosec // G115: Test code comparing version numbers, safe to convert
		require.NoError(t, err)
	}

	fatal := func(msg string, args ...interface{}) error {
		t.Fatalf(msg, args...)
		return fmt.Errorf(msg, args...)
	}

	t.Logf("install fake sync")
	ri.SyncInboxFunc = func(m *kbtest.ChatRemoteMock, ctx context.Context, vers chat1.InboxVers) (chat1.SyncInboxRes, error) {
		return chat1.SyncInboxRes{}, fatal("sync not expected yet")
	}

	assertInboxVersion(0)

	t.Logf("new conv")
	conv := newBlankConv(ctx, t, tc, uid, ri, sender, u.Username)

	assertInboxVersion(0)

	t.Logf("add message but drop oobm")

	rc := utils.RemoteConv(conv)
	localConvs, _, err := tc.Context().InboxSource.Localize(ctx, uid, []types.RemoteConversation{rc},
		types.ConversationLocalizerBlocking)
	require.NoError(t, err)
	require.Equal(t, 1, len(localConvs))
	prepareRes, err := sender.Prepare(ctx, chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			Conv:        conv.Metadata.IdTriple,
			Sender:      u.User.GetUID().ToBytes(),
			TlfName:     u.Username,
			TlfPublic:   false,
			MessageType: chat1.MessageType_TEXT,
		},
		MessageBody: chat1.NewMessageBodyWithText(chat1.MessageText{
			Body: "HIHI",
		}),
	}, chat1.ConversationMembersType_KBFS, &localConvs[0], nil)
	require.NoError(t, err)
	boxed := prepareRes.Boxed

	postRes, err := ri.PostRemote(ctx, chat1.PostRemoteArg{
		ConversationID: conv.GetConvID(),
		MessageBoxed:   boxed,
	})
	require.NoError(t, err)
	boxed.ServerHeader = &postRes.MsgHeader

	assertInboxVersion(0)

	t.Logf("install fake sync")
	syncCalled := 0
	ri.SyncInboxFunc = func(m *kbtest.ChatRemoteMock, ctx context.Context, vers chat1.InboxVers) (chat1.SyncInboxRes, error) {
		syncCalled++
		require.Equal(t, chat1.InboxVers(0), vers)

		res, err := m.GetInboxRemote(ctx, chat1.GetInboxRemoteArg{
			Vers:       vers,
			Query:      nil,
			Pagination: nil,
		})
		require.NoError(t, err)

		return chat1.NewSyncInboxResWithIncremental(chat1.SyncIncrementalRes{
			Vers:  100,
			Convs: res.Inbox.Full().Conversations,
		}), nil
	}

	t.Logf("receive oobm with version light years ahead of its current one")
	_, err = tc.ChatG.InboxSource.NewMessage(context.TODO(), u.User.GetUID().ToBytes(), chat1.InboxVers(100),
		conv.GetConvID(), boxed, nil)
	require.NoError(t, err)
	assertInboxVersion(100)

	t.Logf("sync was triggered")
	require.Equal(t, 1, syncCalled)
}

func TestInboxSourceLocalOnly(t *testing.T) {
	ctc := makeChatTestContext(t, "TestInboxSourceLocalOnly", 1)
	defer ctc.cleanup()
	users := ctc.users()
	useRemoteMock = false
	defer func() { useRemoteMock = true }()

	listener := newServerChatListener()
	ctc.as(t, users[0]).h.G().NotifyRouter.AddListener(listener)
	ctc.world.Tcs[users[0].Username].ChatG.UIInboxLoader = types.DummyUIInboxLoader{}
	ctc.world.Tcs[users[0].Username].ChatG.Syncer.(*Syncer).isConnected = true

	ctx := ctc.as(t, users[0]).startCtx
	tc := ctc.world.Tcs[users[0].Username]
	uid := users[0].User.GetUID().ToBytes()

	conv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
		chat1.ConversationMembersType_IMPTEAMNATIVE)
	consumeNewConversation(t, listener, conv.Id)

	attempt := func(mode types.InboxSourceDataSourceTyp, success bool) {
		ib, err := tc.Context().InboxSource.ReadUnverified(ctx, uid, mode,
			&chat1.GetInboxQuery{
				ConvID: &conv.Id,
			})
		if success {
			require.NoError(t, err)
			require.Equal(t, 1, len(ib.ConvsUnverified))
			require.Equal(t, conv.Id, ib.ConvsUnverified[0].GetConvID())
		} else {
			require.Error(t, err)
			require.IsType(t, storage.MissError{}, err)
		}
	}

	attempt(types.InboxSourceDataSourceAll, true)
	attempt(types.InboxSourceDataSourceLocalOnly, true)
	require.NoError(t, tc.Context().InboxSource.Clear(ctx, uid, nil))
	attempt(types.InboxSourceDataSourceLocalOnly, false)
	attempt(types.InboxSourceDataSourceRemoteOnly, true)
	attempt(types.InboxSourceDataSourceLocalOnly, false)
	attempt(types.InboxSourceDataSourceAll, true)
	attempt(types.InboxSourceDataSourceLocalOnly, true)
}

// TestIsConvSearchHitCaseInsensitive verifies that channel name matching is
// case-insensitive. Queries are lowercased before matching, so conv names must
// also be lowercased before comparison or uppercase channel names (e.g. "AB")
// will never match a user-typed query.
func TestIsConvSearchHitCaseInsensitive(t *testing.T) {
	src := &HybridInboxSource{}
	ctx := context.TODO()
	username := "alice"

	makeTeamChannel := func(teamName, channelName string) types.RemoteConversation {
		convID := chat1.ConversationID([]byte(teamName + "#" + channelName))
		rc := types.RemoteConversation{
			Conv: chat1.Conversation{
				Metadata: chat1.ConversationMetadata{
					ConversationID: convID,
					IdTriple: chat1.ConversationIDTriple{
						Tlfid: chat1.TLFID([]byte(teamName)),
					},
					TeamType:    chat1.TeamType_COMPLEX,
					MembersType: chat1.ConversationMembersType_TEAM,
					Status:      chat1.ConversationStatus_UNFILED,
				},
				ReaderInfo: &chat1.ConversationReaderInfo{
					Status: chat1.ConversationMemberStatus_ACTIVE,
				},
				MaxMsgSummaries: []chat1.MessageSummary{{MsgID: 1}},
			},
			ConvIDStr: chat1.ConvIDStr(teamName + "#" + channelName),
			LocalMetadata: &types.RemoteConversationMetadata{
				Name:      teamName,
				TopicName: channelName,
			},
		}
		return rc
	}

	queryToks := func(q string) []string { return []string{q} }

	// Uppercase two-letter channel name must match a lowercase query.
	rcUpper := makeTeamChannel("acme", "AB")
	hit := src.isConvSearchHit(ctx, rcUpper, queryToks("ab"), username,
		types.InboxSourceSearchEmptyModeAll)
	require.True(t, hit.valid(), "uppercase channel 'AB' should match lowercase query 'ab'")

	// Lowercase channel name must still match.
	rcLower := makeTeamChannel("acme", "ab")
	hit = src.isConvSearchHit(ctx, rcLower, queryToks("ab"), username,
		types.InboxSourceSearchEmptyModeAll)
	require.True(t, hit.valid(), "lowercase channel 'ab' should match query 'ab'")

	// Uppercase team name must match a lowercase query.
	rcUpperTeam := makeTeamChannel("ACME", "general")
	hit = src.isConvSearchHit(ctx, rcUpperTeam, queryToks("acme"), username,
		types.InboxSourceSearchEmptyModeAll)
	require.True(t, hit.valid(), "uppercase team 'ACME' should match lowercase query 'acme'")

	// Query that is not a substring of the channel name must not match.
	hit = src.isConvSearchHit(ctx, rcUpper, queryToks("zz"), username,
		types.InboxSourceSearchEmptyModeAll)
	require.False(t, hit.valid(), "query 'zz' should not match channel 'AB'")
}

// TestSearchQueryTokenization verifies that the Search query tokenizer correctly
// splits and discards whitespace (including tabs and other unicode space chars)
// so that tokens containing whitespace do not fail to match channel names.
func TestSearchQueryTokenization(t *testing.T) {
	cases := []struct {
		query    string
		expected []string
		desc     string
	}{
		{"ab", []string{"ab"}, "plain query"},
		{"  ab  ", []string{"ab"}, "leading/trailing spaces"},
		{"ab\t", []string{"ab"}, "trailing tab"},
		{"\tab\t", []string{"ab"}, "surrounding tabs"},
		{"ab\n", []string{"ab"}, "trailing newline"},
		{"ab\u00a0cd", []string{"ab", "cd"}, "unicode whitespace separated tokens"},
		{"ab cd", []string{"ab", "cd"}, "space-separated tokens"},
		{"ab,cd", []string{"ab", "cd"}, "comma-separated tokens"},
		{"AB", []string{"ab"}, "uppercase lowercased"},
		{"  ,,\u00a0\t ", nil, "whitespace/commas only yields no tokens"},
	}
	for _, tc := range cases {
		got := tokenizeSearchQuery(tc.query)
		require.Equal(t, tc.expected, got, tc.desc)
	}
}

func TestChatConversationDeleted(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		switch mt {
		case chat1.ConversationMembersType_TEAM:
		default:
			return
		}
		ctc := makeChatTestContext(t, "TestChatConversationDeleted", 1)
		defer ctc.cleanup()
		users := ctc.users()
		ctx := context.TODO()
		uid := gregor1.UID(users[0].User.GetUID().ToBytes())
		ctc.as(t, users[0])
		g := ctc.world.Tcs[users[0].Username].Context()
		_, _, err := g.InboxSource.Read(ctx, uid, types.ConversationLocalizerBlocking, types.InboxSourceDataSourceRemoteOnly, nil,
			&chat1.GetInboxLocalQuery{
				ConvIDs: []chat1.ConversationID{chat1.ConversationID("dead")},
			})
		require.NoError(t, err)
	})
}
