package chat

import (
	"fmt"
	"testing"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/teams"

	"github.com/keybase/client/go/protocol/keybase1"

	"sync"

	context "golang.org/x/net/context"

	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/protocol/chat1"
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

	rc := types.RemoteConversation{
		Conv: conv,
	}
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

func TestInboxSourceFlushLoop(t *testing.T) {
	ctx, world, ri, _, sender, _ := setupTest(t, 2)
	defer world.Cleanup()

	u := world.GetUsers()[0]
	u2 := world.GetUsers()[1]
	uid := u.User.GetUID().ToBytes()
	tc := world.Tcs[u.Username]
	<-tc.Context().ConvLoader.Stop(context.TODO())
	ibs := tc.Context().InboxSource
	hbs, ok := ibs.(*HybridInboxSource)
	if !ok {
		t.Skip()
	}
	newBlankConv(ctx, t, tc, uid, ri, sender, u.Username)
	_, err := hbs.ReadUnverified(ctx, uid, types.InboxSourceDataSourceAll, nil)
	require.NoError(t, err)
	inbox := hbs.createInbox()
	flushCh := make(chan struct{}, 10)
	hbs.testFlushCh = flushCh
	_, _, err = inbox.ReadAll(ctx, uid, false)
	require.Error(t, err)
	require.IsType(t, storage.MissError{}, err)
	_, rc, err := inbox.ReadAll(ctx, uid, true)
	require.NoError(t, err)
	require.Equal(t, 1, len(rc))
	world.Fc.Advance(time.Hour)
	select {
	case <-flushCh:
	case <-time.After(20 * time.Second):
		require.Fail(t, "no flush")
	}
	_, rc, err = inbox.ReadAll(ctx, uid, false)
	require.NoError(t, err)
	require.Equal(t, 1, len(rc))
	_, rc, err = inbox.ReadAll(ctx, uid, true)
	require.NoError(t, err)
	require.Equal(t, 1, len(rc))

	newBlankConv(ctx, t, tc, uid, ri, sender, u.Username+","+u2.Username)
	_, rc, err = inbox.ReadAll(ctx, uid, false)
	require.NoError(t, err)
	require.Equal(t, 1, len(rc))
	_, rc, err = inbox.ReadAll(ctx, uid, true)
	require.NoError(t, err)
	require.Equal(t, 2, len(rc))
	tc.Context().MobileAppState.Update(keybase1.MobileAppState_BACKGROUND)
	select {
	case <-flushCh:
	case <-time.After(20 * time.Second):
		require.Fail(t, "no flush")
	}
	_, rc, err = inbox.ReadAll(ctx, uid, false)
	require.NoError(t, err)
	require.Equal(t, 2, len(rc))
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
	require.NoError(t, tc.Context().InboxSource.Clear(ctx, uid))
	attempt(types.InboxSourceDataSourceLocalOnly, false)
	attempt(types.InboxSourceDataSourceRemoteOnly, true)
	attempt(types.InboxSourceDataSourceLocalOnly, false)
	attempt(types.InboxSourceDataSourceAll, true)
	attempt(types.InboxSourceDataSourceLocalOnly, true)
}

func TestInboxSourceMarkAsRead(t *testing.T) {
	ctc := makeChatTestContext(t, "TestInboxSourceMarkAsRead", 2)
	defer ctc.cleanup()
	users := ctc.users()
	useRemoteMock = false
	defer func() { useRemoteMock = true }()

	listener0 := newServerChatListener()
	listener1 := newServerChatListener()
	ctc.as(t, users[0]).h.G().NotifyRouter.AddListener(listener0)
	ctc.as(t, users[1]).h.G().NotifyRouter.AddListener(listener1)
	ctc.world.Tcs[users[0].Username].ChatG.Syncer.(*Syncer).isConnected = true
	ctc.world.Tcs[users[1].Username].ChatG.Syncer.(*Syncer).isConnected = true
	tc1 := ctc.world.Tcs[users[1].Username]
	inboxSource := tc1.Context().InboxSource.(*HybridInboxSource)
	syncer := ctc.world.Tcs[users[1].Username].ChatG.Syncer.(*Syncer)
	badger := tc1.ChatG.Badger
	badger.SetLocalChatState(inboxSource)
	pusher := tc1.Context().PushHandler.(*PushHandler)
	ctx1 := ctc.as(t, users[1]).startCtx
	uid1 := users[1].User.GetUID().ToBytes()
	syncer.RegisterOfflinable(inboxSource)

	conv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
		chat1.ConversationMembersType_IMPTEAMNATIVE, users[1])
	consumeNewConversation(t, listener0, conv.Id)
	consumeNewConversation(t, listener1, conv.Id)
	mustPostLocalForTest(t, ctc, users[0], conv, chat1.NewMessageBodyWithText(chat1.MessageText{Body: "HI"}))
	consumeNewMsgRemote(t, listener0, chat1.MessageType_TEXT)
	msg := consumeNewMsgRemote(t, listener1, chat1.MessageType_TEXT)

	badgeState, err := badger.State().Export(context.TODO())
	require.NoError(t, err)
	require.Equal(t, 1, len(badgeState.Conversations))
	require.Equal(t, 1, badgeState.Conversations[0].UnreadMessages)

	ri := inboxSource.getChatInterface
	inboxSource.SetRemoteInterface(func() chat1.RemoteInterface {
		return chat1.RemoteClient{Cli: OfflineClient{}}
	})
	msgID := msg.GetMessageID()
	require.NoError(t, inboxSource.MarkAsRead(ctx1, conv.Id, uid1, &msgID))
	syncer.Disconnected(context.TODO())
	pusher.testingIgnoreBroadcasts = true

	// make sure we didn't get any remote call through
	select {
	case <-listener1.readMessage:
		require.Fail(t, "no read message yet")
	default:
	}
	badgeState, err = badger.State().Export(context.TODO())
	require.NoError(t, err)
	require.Equal(t, 1, len(badgeState.Conversations))
	require.Equal(t, 0, badgeState.Conversations[0].UnreadMessages)

	// send another message we have unread state when coming back online
	mustPostLocalForTest(t, ctc, users[0], conv, chat1.NewMessageBodyWithText(chat1.MessageText{Body: "HI"}))
	consumeNewMsgRemote(t, listener0, chat1.MessageType_TEXT)
	select {
	case <-listener1.newMessageRemote:
		require.Fail(t, "no read message yet")
	default:
	}

	pusher.testingIgnoreBroadcasts = false
	inboxSource.getChatInterface = ri
	err = syncer.Connected(context.TODO(), ri(), uid1, nil)
	require.NoError(t, err)
	select {
	case info := <-listener1.readMessage:
		require.Equal(t, conv.Id, info.ConvID)
		require.Equal(t, msg.GetMessageID(), info.MsgID)
	case <-time.After(2 * time.Second):
		require.Fail(t, "no read message info")
	}
	badgeState, err = badger.State().Export(context.TODO())
	require.NoError(t, err)
	require.Equal(t, 1, len(badgeState.Conversations))
	require.Equal(t, 1, badgeState.Conversations[0].UnreadMessages)
}

func TestInboxChatBlockingAlsoUserBlocks(t *testing.T) {
	ctc := makeChatTestContext(t, "TestInboxBlocking", 3)
	defer ctc.cleanup()
	users := ctc.users()
	useRemoteMock = false
	var err error
	defer func() { useRemoteMock = true }()

	userIsBlockedBy := func(maybeBlockedUserChat *kbtest.ChatTestContext, blocker *kbtest.FakeUser) bool {
		// verify this behaviorally by having the maybe-blocked-user attempt to add the blocker
		// to a team. if this errors with the expected code, then the maybe-blocked-user was definitely
		// blocked.
		name := createTeam(maybeBlockedUserChat.TestContext)
		err = teams.SetRoleWriter(context.TODO(), maybeBlockedUserChat.G, name, blocker.Username)
		if err == nil {
			return false
		}
		require.Error(t, err)
		require.IsType(t, err, libkb.AppStatusError{})
		aerr, _ := err.(libkb.AppStatusError)
		if aerr.Code != libkb.SCDeviceBadStatus {
			panic("unexpected error adding user to team")
		}
		return true
	}

	// three users: alice, bob, spammer
	alice := users[0]
	spammer := users[1]
	bob := users[2]
	tcAlice := ctc.world.Tcs[alice.Username]
	tcSpammer := ctc.world.Tcs[spammer.Username]
	ctxAlice := ctc.as(t, alice).startCtx
	uidAlice := alice.User.GetUID().ToBytes()

	listener := newServerChatListener()
	ctc.as(t, alice).h.G().NotifyRouter.AddListener(listener)
	ctc.world.Tcs[alice.Username].ChatG.Syncer.(*Syncer).isConnected = true

	// alice blocks a team channel conversation with only spammer in it
	conv := mustCreateConversationForTest(t, ctc, alice, chat1.TopicType_CHAT,
		chat1.ConversationMembersType_TEAM, spammer)
	err = tcAlice.ChatG.InboxSource.RemoteSetConversationStatus(ctxAlice, uidAlice, conv.Id,
		chat1.ConversationStatus_BLOCKED)
	require.NoError(t, err)
	// this DOES NOT user-block spammer
	require.False(t, userIsBlockedBy(tcSpammer, alice))

	// alice blocks a group implicit conversation with spammer and bob
	conv = mustCreateConversationForTest(t, ctc, alice, chat1.TopicType_CHAT,
		chat1.ConversationMembersType_IMPTEAMNATIVE, spammer, bob)
	err = tcAlice.ChatG.InboxSource.RemoteSetConversationStatus(ctxAlice, uidAlice, conv.Id,
		chat1.ConversationStatus_BLOCKED)
	require.NoError(t, err)
	// this DOES NOT user-block spammer
	require.False(t, userIsBlockedBy(tcSpammer, alice))

	// alice blocks a 1-on-1 implicit conversation with just spammer
	conv = mustCreateConversationForTest(t, ctc, alice, chat1.TopicType_CHAT,
		chat1.ConversationMembersType_IMPTEAMNATIVE, spammer)
	err = tcAlice.ChatG.InboxSource.RemoteSetConversationStatus(ctxAlice, uidAlice, conv.Id,
		chat1.ConversationStatus_BLOCKED)
	require.NoError(t, err)
	// this DOES user-block spammer
	require.True(t, userIsBlockedBy(tcSpammer, alice))
}
