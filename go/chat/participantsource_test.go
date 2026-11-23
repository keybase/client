package chat

import (
	"context"
	"testing"
	"time"

	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/encrypteddb"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/teams"
	"github.com/stretchr/testify/require"
)

func TestParticipantsSource(t *testing.T) {
	useRemoteMock = false
	defer func() { useRemoteMock = true }()
	ctc := makeChatTestContext(t, "TestParticipantsSource", 3)
	defer ctc.cleanup()

	timeout := time.Second * 20
	users := ctc.users()
	tc := ctc.world.Tcs[users[0].Username]
	ctx := ctc.as(t, users[0]).startCtx
	uid := gregor1.UID(users[0].GetUID().ToBytes())
	listener0 := newServerChatListener()
	ctc.as(t, users[0]).h.G().NotifyRouter.AddListener(listener0)

	info := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
		chat1.ConversationMembersType_TEAM, users[1])
	conv, err := utils.GetUnverifiedConv(ctx, tc.Context(), uid, info.Id, types.InboxSourceDataSourceAll)
	require.NoError(t, err)

	// empty should get one
	ch := tc.Context().ParticipantsSource.GetNonblock(ctx, uid, conv.GetConvID(),
		types.InboxSourceDataSourceAll)
	select {
	case pres := <-ch:
		require.NoError(t, pres.Err)
		require.Len(t, pres.Uids, 2)
	case <-time.After(timeout):
		require.Fail(t, "no uids")
	}
	time.Sleep(time.Millisecond * 200)
	_, ok := <-ch
	require.False(t, ok)

	// cached should get one
	ch = tc.Context().ParticipantsSource.GetNonblock(ctx, uid, conv.GetConvID(),
		types.InboxSourceDataSourceAll)
	select {
	case pres := <-ch:
		require.NoError(t, pres.Err)
		require.Len(t, pres.Uids, 2)
	case <-time.After(timeout):
		require.Fail(t, "no uids")
	}
	time.Sleep(time.Millisecond * 200)
	_, ok = <-ch
	require.False(t, ok)

	// hash wrong, should get two
	err = teams.SetRoleWriter(context.TODO(), tc.G, info.TlfName, users[2].Username)
	require.NoError(t, err)
	consumeMembersUpdate(t, listener0)
	ch = tc.Context().ParticipantsSource.GetNonblock(ctx, uid, conv.GetConvID(),
		types.InboxSourceDataSourceAll)
	select {
	case pres := <-ch:
		require.NoError(t, pres.Err)
		require.Len(t, pres.Uids, 2)
	case <-time.After(timeout):
		require.Fail(t, "no uids")
	}
	select {
	case pres := <-ch:
		require.NoError(t, pres.Err)
		require.Len(t, pres.Uids, 3)
	case <-time.After(timeout):
		require.Fail(t, "no uids")
	}

	// cached should get one
	ch = tc.Context().ParticipantsSource.GetNonblock(ctx, uid, conv.GetConvID(),
		types.InboxSourceDataSourceAll)
	select {
	case pres := <-ch:
		require.NoError(t, pres.Err)
		require.Len(t, pres.Uids, 3)
	case <-time.After(timeout):
		require.Fail(t, "no uids")
	}
	time.Sleep(time.Millisecond * 200)
	_, ok = <-ch
	require.False(t, ok)
}

func TestParticipantsSourceGetPropagatesErrors(t *testing.T) {
	useRemoteMock = false
	defer func() { useRemoteMock = true }()
	ctc := makeChatTestContext(t, "TestParticipantsSourceGetPropagatesErrors", 1)
	defer ctc.cleanup()

	users := ctc.users()
	tc := ctc.world.Tcs[users[0].Username]
	ctx := ctc.as(t, users[0]).startCtx
	uid := gregor1.UID(users[0].GetUID().ToBytes())

	_, err := tc.Context().ParticipantsSource.Get(ctx, uid, chat1.ConversationID([]byte("missing")),
		types.InboxSourceDataSourceAll)
	require.Error(t, err)
}

func TestParticipantsUnusableCacheRefreshesAndKeyErrorKeepsIt(t *testing.T) {
	useRemoteMock = false
	defer func() { useRemoteMock = true }()
	ctc := makeChatTestContext(t, "TestParticipantsUnusable", 2)
	defer ctc.cleanup()

	users := ctc.users()
	tc := ctc.world.Tcs[users[0].Username]
	ctx := ctc.as(t, users[0]).startCtx
	uid := gregor1.UID(users[0].GetUID().ToBytes())
	info := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
		chat1.ConversationMembersType_TEAM, users[1])
	conv, err := utils.GetUnverifiedConv(ctx, tc.Context(), uid, info.Id, types.InboxSourceDataSourceAll)
	require.NoError(t, err)

	ps := tc.Context().ParticipantsSource.(*CachingParticipantSource)
	var key [32]byte
	key[0] = 1
	var keyErr error
	keyFn := func(context.Context) ([32]byte, error) {
		if keyErr != nil {
			return [32]byte{}, keyErr
		}
		return key, nil
	}
	g := tc.Context().ExternalG()
	dbKey := ps.dbKey(uid, conv.GetConvID())
	ps.encryptedDB = encrypteddb.New(g, func(g *libkb.GlobalContext) *libkb.JSONLocalDb {
		return g.LocalChatDb
	}, keyFn)
	require.NoError(t, ps.encryptedDB.Put(ctx, dbKey, partDiskStorage{
		Uids: []gregor1.UID{uid},
		Hash: "stale",
	}))

	key[0] = 2
	got, err := ps.Get(ctx, uid, conv.GetConvID(), types.InboxSourceDataSourceAll)
	require.NoError(t, err)
	require.NotEmpty(t, got)
	var stored partDiskStorage
	found, err := ps.encryptedDB.Get(ctx, dbKey, &stored)
	require.NoError(t, err)
	require.True(t, found, "a remote refresh rewrites the dropped cache entry")
	require.NotEqual(t, "stale", stored.Hash)

	require.NoError(t, ps.encryptedDB.Put(ctx, dbKey, partDiskStorage{Uids: got, Hash: stored.Hash}))
	rawBefore, found, err := g.LocalChatDb.GetRaw(dbKey)
	require.NoError(t, err)
	require.True(t, found)
	keyErr = libkb.KeyCannotDecryptError{}
	_, err = ps.Get(ctx, uid, conv.GetConvID(), types.InboxSourceDataSourceAll)
	require.Error(t, err)
	rawAfter, found, err := g.LocalChatDb.GetRaw(dbKey)
	require.NoError(t, err)
	require.True(t, found, "a key-fetch failure must not delete the participants cache")
	require.Equal(t, rawBefore, rawAfter)
}

// A join reaches the other members (and the joiner) only as a membership push; nothing
// on those clients asks for the participant list again, so the push itself has to send it.
func TestParticipantsPushedOnJoin(t *testing.T) {
	useRemoteMock = false
	defer func() { useRemoteMock = true }()
	ctc := makeChatTestContext(t, "TestParticipantsPushedOnJoin", 2)
	defer ctc.cleanup()

	users := ctc.users()
	mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
		chat1.ConversationMembersType_TEAM, users[1])
	topicName := "joinme"
	channel := mustCreateChannelForTest(t, ctc, users[0], chat1.TopicType_CHAT, &topicName,
		chat1.ConversationMembersType_TEAM, users[1])

	listeners := make([]*teamChannelParticipantsListener, len(users))
	for i, u := range users {
		listeners[i] = &teamChannelParticipantsListener{
			participants: make(chan map[chat1.ConvIDStr][]chat1.UIParticipant, 100),
		}
		ctc.as(t, u).h.G().NotifyRouter.AddListener(listeners[i])
	}

	_, err := ctc.as(t, users[1]).chatLocalHandler().JoinConversationByIDLocal(
		ctc.as(t, users[1]).startCtx, channel.Id)
	require.NoError(t, err)

	for i, listener := range listeners {
		timeout := time.After(20 * time.Second)
	wait:
		for {
			select {
			case participants := <-listener.participants:
				for _, p := range participants[channel.Id.ConvIDStr()] {
					if p.Assertion == users[1].Username {
						break wait
					}
				}
			case <-timeout:
				require.FailNow(t, "no participant list with the joined user was pushed",
					"listener for users[%d]", i)
			}
		}
	}
}

func TestParticipantsNotifySkipsFailedLoads(t *testing.T) {
	useRemoteMock = false
	defer func() { useRemoteMock = true }()
	ctc := makeChatTestContext(t, "TestParticipantsNotifySkipsFailedLoads", 1)
	defer ctc.cleanup()

	users := ctc.users()
	tc := ctc.world.Tcs[users[0].Username]
	uid := gregor1.UID(users[0].GetUID().ToBytes())
	listener := &teamChannelParticipantsListener{
		participants: make(chan map[chat1.ConvIDStr][]chat1.UIParticipant, 10),
	}
	ctc.as(t, users[0]).h.G().NotifyRouter.AddListener(listener)

	tc.Context().ParticipantsSource.GetWithNotifyNonblock(ctc.as(t, users[0]).startCtx, uid,
		chat1.ConversationID([]byte("missing")), types.InboxSourceDataSourceAll)
	select {
	case participants := <-listener.participants:
		require.FailNow(t, "a failed load must not push a participant list", "%+v", participants)
	case <-time.After(2 * time.Second):
	}
}
