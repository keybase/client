package chat

import (
	"context"
	"sync/atomic"
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

// countingParticipantsRemote counts the participant loads that reach the server.
type countingParticipantsRemote struct {
	chat1.RemoteInterface
	refreshes *int32
}

func (r countingParticipantsRemote) RefreshParticipantsRemote(ctx context.Context,
	arg chat1.RefreshParticipantsRemoteArg,
) (chat1.RefreshParticipantsRemoteRes, error) {
	atomic.AddInt32(r.refreshes, 1)
	return r.RemoteInterface.RefreshParticipantsRemote(ctx, arg)
}

// Another member's join reaches this client only as a membership push. The push patches
// the cached participant list and notifies it, and never asks the server for the list.
func TestParticipantsPushedOnJoinWithoutServerCall(t *testing.T) {
	useRemoteMock = false
	defer func() { useRemoteMock = true }()
	ctc := makeChatTestContext(t, "TestParticipantsPushedOnJoinWithoutServerCall", 2)
	defer ctc.cleanup()

	users := ctc.users()
	tc := ctc.world.Tcs[users[0].Username]
	ctx := ctc.as(t, users[0]).startCtx
	uid := gregor1.UID(users[0].GetUID().ToBytes())
	mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
		chat1.ConversationMembersType_TEAM, users[1])
	topicName := "joinme"
	channel := mustCreateChannelForTest(t, ctc, users[0], chat1.TopicType_CHAT, &topicName,
		chat1.ConversationMembersType_TEAM, users[1])
	uncachedName := "notcached"
	uncached := mustCreateChannelForTest(t, ctc, users[0], chat1.TopicType_CHAT, &uncachedName,
		chat1.ConversationMembersType_TEAM, users[1])

	ps := tc.Context().ParticipantsSource.(*CachingParticipantSource)
	// cache the list for one channel only, as an open members list would
	before, err := ps.Get(ctx, uid, channel.Id, types.InboxSourceDataSourceAll)
	require.NoError(t, err)
	require.Len(t, before, 1)

	var refreshes int32
	ri := ps.ri
	ps.ri = func() chat1.RemoteInterface {
		return countingParticipantsRemote{RemoteInterface: ri(), refreshes: &refreshes}
	}
	listener := &teamChannelParticipantsListener{
		participants: make(chan map[chat1.ConvIDStr][]chat1.UIParticipant, 100),
	}
	ctc.as(t, users[0]).h.G().NotifyRouter.AddListener(listener)

	for _, conv := range []chat1.ConversationInfoLocal{uncached, channel} {
		_, err = ctc.as(t, users[1]).chatLocalHandler().JoinConversationByIDLocal(
			ctc.as(t, users[1]).startCtx, conv.Id)
		require.NoError(t, err)
	}

	timeout := time.After(20 * time.Second)
wait:
	for {
		select {
		case participants := <-listener.participants:
			_, ok := participants[uncached.Id.ConvIDStr()]
			require.False(t, ok, "a conversation with no cached list gets no push")
			for _, p := range participants[channel.Id.ConvIDStr()] {
				if p.Assertion == users[1].Username {
					break wait
				}
			}
		case <-timeout:
			require.FailNow(t, "no participant list with the joined user was pushed")
		}
	}
	require.Zero(t, atomic.LoadInt32(&refreshes), "a membership push must not load participants from the server")

	var stored partDiskStorage
	found, err := ps.encryptedDB.Get(ctx, ps.dbKey(uid, channel.Id), &stored)
	require.NoError(t, err)
	require.True(t, found)
	require.Len(t, stored.Uids, 2)
	require.Empty(t, stored.Hash, "a patched list must not match the server's hash")
	found, err = ps.encryptedDB.Get(ctx, ps.dbKey(uid, uncached.Id), &stored)
	require.NoError(t, err)
	require.False(t, found, "a membership push must not create a cached list")
}

func TestPatchParticipants(t *testing.T) {
	a, b, c := gregor1.UID([]byte{1}), gregor1.UID([]byte{2}), gregor1.UID([]byte{3})
	for _, tc := range []struct {
		name            string
		uids            []gregor1.UID
		joined, removed []gregor1.UID
		want            []gregor1.UID
		changed         bool
	}{
		{"join appends", []gregor1.UID{a, b}, []gregor1.UID{c}, nil, []gregor1.UID{a, b, c}, true},
		{"join of a member is a no-op", []gregor1.UID{a, b}, []gregor1.UID{b}, nil, []gregor1.UID{a, b}, false},
		{"removal keeps the order of the rest", []gregor1.UID{a, b, c}, nil, []gregor1.UID{b}, []gregor1.UID{a, c}, true},
		{"removal of a non-member is a no-op", []gregor1.UID{a}, nil, []gregor1.UID{c}, []gregor1.UID{a}, false},
		{"join and removal together", []gregor1.UID{a, b}, []gregor1.UID{c}, []gregor1.UID{a}, []gregor1.UID{b, c}, true},
	} {
		got, changed := patchParticipants(tc.uids, tc.joined, tc.removed)
		require.Equal(t, tc.want, got, tc.name)
		require.Equal(t, tc.changed, changed, tc.name)
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
