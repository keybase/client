package chat

import (
	"context"
	"testing"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/externalstest"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/stretchr/testify/require"
)

// recordingParticipantSource records what Invalidate was asked to drop. Only that
// method is exercised here, so the rest comes from the dummy.
type recordingParticipantSource struct {
	types.DummyParticipantSource
	calls [][]chat1.ConversationID
}

func (r *recordingParticipantSource) Invalidate(ctx context.Context, uid gregor1.UID,
	convIDs []chat1.ConversationID,
) {
	ids := make([]chat1.ConversationID, len(convIDs))
	copy(ids, convIDs)
	r.calls = append(r.calls, ids)
}

func convIDForTest(b byte) chat1.ConversationID {
	return chat1.ConversationID([]byte{b, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16})
}

// invalidateParticipants only reaches ParticipantsSource, so these two run
// without a chat harness or a signed-in user.
func setupInvalidateTest(t *testing.T, label string) (*PushHandler, *recordingParticipantSource, gregor1.UID) {
	tc := externalstest.SetupTest(t, label, 2)
	t.Cleanup(tc.Cleanup)
	rec := &recordingParticipantSource{}
	g := globals.NewContext(tc.G, &globals.ChatContext{ParticipantsSource: rec})
	// Built directly rather than through NewPushHandler: that wires an identify
	// notifier onto the ConnectionManager, which a bare test context has no need
	// for and does not have. invalidateParticipants reaches neither.
	handler := &PushHandler{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.ExternalG(), "PushHandler", false),
	}
	return handler, rec, gregor1.UID([]byte{1, 2, 3, 4})
}

// A membership update names the same conv in more than one bucket, and every
// bucket has to be covered, so the conv list is deduped and every field read.
func TestInvalidateParticipantsCoversAndDedupes(t *testing.T) {
	handler, rec, uid := setupInvalidateTest(t, "invalidate-dedupe")

	dup := convIDForTest(1)
	res := types.MembershipUpdateRes{
		RoleUpdates: []chat1.ConversationLocal{{
			Info: chat1.ConversationInfoLocal{Id: dup},
		}},
		UserJoinedConvs: []chat1.ConversationLocal{{
			Info: chat1.ConversationInfoLocal{Id: convIDForTest(2)},
		}},
		UserRemovedConvs:   []chat1.ConversationMember{{ConvID: convIDForTest(3)}},
		UserResetConvs:     []chat1.ConversationMember{{ConvID: convIDForTest(4)}},
		OthersJoinedConvs:  []chat1.ConversationMember{{ConvID: dup}},
		OthersRemovedConvs: []chat1.ConversationMember{{ConvID: convIDForTest(5)}},
		OthersResetConvs:   []chat1.ConversationMember{{ConvID: convIDForTest(6)}},
	}

	handler.invalidateParticipants(context.TODO(), uid, res)

	require.Len(t, rec.calls, 1)
	got := rec.calls[0]
	require.Len(t, got, 6, "the conv named in two buckets must be invalidated once")
	want := []chat1.ConversationID{
		dup, convIDForTest(2), convIDForTest(3),
		convIDForTest(4), convIDForTest(5), convIDForTest(6),
	}
	require.Equal(t, want, got, "every membership bucket must be covered, in first-seen order")
}

// Nothing changed means nothing to invalidate, and the source must not be woken
// for an empty list.
func TestInvalidateParticipantsSkipsEmptyUpdate(t *testing.T) {
	handler, rec, uid := setupInvalidateTest(t, "invalidate-empty")
	handler.invalidateParticipants(context.TODO(), uid, types.MembershipUpdateRes{})
	require.Empty(t, rec.calls)
}

// Invalidate expires the entry rather than dropping it, so the stale list is
// still there to answer with while the refresh is in flight. A local-and-remote
// read must therefore emit twice: the cached list, then the fresh one.
func TestParticipantsSourceInvalidateKeepsLocalAnswer(t *testing.T) {
	useRemoteMock = false
	defer func() { useRemoteMock = true }()
	ctc := makeChatTestContext(t, "TestParticipantsSourceInvalidateKeepsLocalAnswer", 2)
	defer ctc.cleanup()

	timeout := 20 * time.Second
	users := ctc.users()
	tc := ctc.world.Tcs[users[0].Username]
	ctx := ctc.as(t, users[0]).startCtx
	uid := gregor1.UID(users[0].GetUID().ToBytes())

	info := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
		chat1.ConversationMembersType_TEAM, users[1])
	conv, err := utils.GetUnverifiedConv(ctx, tc.Context(), uid, info.Id,
		types.InboxSourceDataSourceAll)
	require.NoError(t, err)
	convID := conv.GetConvID()

	// prime the cache
	uids, err := tc.Context().ParticipantsSource.Get(ctx, uid, convID,
		types.InboxSourceDataSourceAll)
	require.NoError(t, err)
	require.Equal(t, 2, len(uids))

	tc.Context().ParticipantsSource.Invalidate(ctx, uid, []chat1.ConversationID{convID})

	// local first, then remote - two results, not one
	ch := tc.Context().ParticipantsSource.GetNonblock(ctx, uid, convID,
		types.InboxSourceDataSourceAll)
	var got [][]gregor1.UID
	for i := 0; i < 2; i++ {
		select {
		case pres := <-ch:
			require.NoError(t, pres.Err)
			got = append(got, pres.Uids)
		case <-time.After(timeout):
			require.Fail(t, "expected a local result then a remote one after Invalidate")
		}
	}
	require.Len(t, got, 2)
	require.Equal(t, 2, len(got[0]), "the expired list must still be served locally")
	require.Equal(t, 2, len(got[1]))
}

// A local-only read has nowhere else to go, so an expired entry must still
// answer it rather than coming back empty.
func TestParticipantsSourceLocalOnlyAfterInvalidate(t *testing.T) {
	useRemoteMock = false
	defer func() { useRemoteMock = true }()
	ctc := makeChatTestContext(t, "TestParticipantsSourceLocalOnlyAfterInvalidate", 2)
	defer ctc.cleanup()

	users := ctc.users()
	tc := ctc.world.Tcs[users[0].Username]
	ctx := ctc.as(t, users[0]).startCtx
	uid := gregor1.UID(users[0].GetUID().ToBytes())

	info := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
		chat1.ConversationMembersType_TEAM, users[1])
	conv, err := utils.GetUnverifiedConv(ctx, tc.Context(), uid, info.Id,
		types.InboxSourceDataSourceAll)
	require.NoError(t, err)
	convID := conv.GetConvID()

	_, err = tc.Context().ParticipantsSource.Get(ctx, uid, convID,
		types.InboxSourceDataSourceAll)
	require.NoError(t, err)

	tc.Context().ParticipantsSource.Invalidate(ctx, uid, []chat1.ConversationID{convID})

	uids, err := tc.Context().ParticipantsSource.Get(ctx, uid, convID,
		types.InboxSourceDataSourceLocalOnly)
	require.NoError(t, err)
	require.Equal(t, 2, len(uids),
		"an expired entry must still answer a local-only read")
}

// Within the freshness window a repeat read is served from disk; past it the
// server is consulted again. The clock is faked in these tests, so the window
// only elapses when the test says so.
func TestParticipantsSourceCacheFreshness(t *testing.T) {
	useRemoteMock = false
	defer func() { useRemoteMock = true }()
	ctc := makeChatTestContext(t, "TestParticipantsSourceCacheFreshness", 2)
	defer ctc.cleanup()

	timeout := 20 * time.Second
	users := ctc.users()
	tc := ctc.world.Tcs[users[0].Username]
	ctx := ctc.as(t, users[0]).startCtx
	uid := gregor1.UID(users[0].GetUID().ToBytes())

	info := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
		chat1.ConversationMembersType_TEAM, users[1])
	conv, err := utils.GetUnverifiedConv(ctx, tc.Context(), uid, info.Id,
		types.InboxSourceDataSourceAll)
	require.NoError(t, err)
	convID := conv.GetConvID()

	_, err = tc.Context().ParticipantsSource.Get(ctx, uid, convID,
		types.InboxSourceDataSourceAll)
	require.NoError(t, err)

	// inside the window: one result, straight from disk, no remote leg
	ch := tc.Context().ParticipantsSource.GetNonblock(ctx, uid, convID,
		types.InboxSourceDataSourceAll)
	select {
	case pres := <-ch:
		require.NoError(t, pres.Err)
		require.Equal(t, 2, len(pres.Uids))
	case <-time.After(timeout):
		require.Fail(t, "no uids")
	}
	select {
	case _, ok := <-ch:
		require.False(t, ok, "a fresh entry must not produce a second, remote result")
	case <-time.After(timeout):
		require.Fail(t, "channel was never closed")
	}

	// past the window: local first, then the refreshed remote answer
	ctc.advanceFakeClock(participantsCacheFreshness + time.Minute)
	ch = tc.Context().ParticipantsSource.GetNonblock(ctx, uid, convID,
		types.InboxSourceDataSourceAll)
	count := 0
	for pres := range ch {
		require.NoError(t, pres.Err)
		count++
	}
	require.Equal(t, 2, count, "an expired entry must go back to the server")
}
