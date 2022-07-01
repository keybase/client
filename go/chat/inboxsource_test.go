package chat

import (
	"fmt"
	"testing"

	"sync"

	context "golang.org/x/net/context"

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
		require.Equal(t, chat1.InboxVers(v), ib.Version, "wrong version")
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
