package search

import (
	"context"
	"testing"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/externalstest"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/stretchr/testify/require"
)

// The stall backoff only fires for a conv that cannot converge, which a healthy
// client never produces: SelectiveSync drains every conv to numMissing 0 and
// skips it thereafter. These paths are therefore unreachable from an end-to-end
// run and can only be covered here.

func setupStallTestIndexer(t *testing.T, label string) (*Indexer, chat1.Conversation) {
	tc := externalstest.SetupTest(t, label, 2)
	t.Cleanup(tc.Cleanup)
	g := globals.NewContext(tc.G, &globals.ChatContext{})
	idx := NewIndexer(g)
	idx.SetUID(gregor1.UID([]byte{1, 2, 3, 4}))

	convID := chat1.ConversationID([]byte{
		1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
	})
	conv := chat1.Conversation{
		Metadata: chat1.ConversationMetadata{ConversationID: convID},
		// nothing is indexed, so this conv reads as 100 missing ids
		MaxMsgSummaries: []chat1.MessageSummary{{MsgID: 100}},
	}
	return idx, conv
}

func TestConvStalledBackoff(t *testing.T) {
	ctx := context.TODO()
	idx, conv := setupStallTestIndexer(t, "stall-backoff")
	convID := conv.GetConvID()

	// a conv never seen before is always given an attempt
	require.False(t, idx.convStalled(convID, 100),
		"a conv with no recorded history must not be skipped")

	// an attempt that moved nothing earns a backoff
	idx.recordIndexProgress(ctx, conv, 100)
	require.True(t, idx.convStalled(convID, 100), "first skip")
	require.True(t, idx.convStalled(convID, 100), "second skip")
	require.False(t, idx.convStalled(convID, 100),
		"backoff must expire rather than suppress the conv permanently")

	// a different missing count means something changed the conv, so it gets an
	// attempt immediately whatever the backoff said
	idx.recordIndexProgress(ctx, conv, 100)
	require.False(t, idx.convStalled(convID, 99),
		"a changed missing count must clear the backoff")
}

func TestConvStalledClearedByProgress(t *testing.T) {
	ctx := context.TODO()
	idx, conv := setupStallTestIndexer(t, "stall-progress")
	convID := conv.GetConvID()

	idx.recordIndexProgress(ctx, conv, 100)
	require.True(t, idx.convStalled(convID, 100))

	// "before" higher than the current count is an attempt that made progress:
	// the marker must be dropped so the conv keeps getting full attempts
	idx.recordIndexProgress(ctx, conv, 500)
	require.False(t, idx.convStalled(convID, 100),
		"a conv that made progress must not stay backed off")

	idx.stalledMu.Lock()
	_, ok := idx.stalledConvs[convID.ConvIDStr()]
	idx.stalledMu.Unlock()
	require.False(t, ok, "progress must delete the entry, not just zero it")
}

// TestStallStreakDoesNotOverflow pins the clamp on the shift exponent. streak is
// unbounded, so `1 << streak` on a conv that never converges eventually shifts
// past the width of an int: the result goes negative and then to 0, which reads
// as "no skips left" and silently disables the backoff for good. Clamping the
// result instead of the exponent does not help - the shift has already
// overflowed by then.
func TestStallStreakDoesNotOverflow(t *testing.T) {
	ctx := context.TODO()
	idx, conv := setupStallTestIndexer(t, "stall-overflow")
	convID := conv.GetConvID()

	// well past the 64 rounds it takes to shift an int to zero
	for i := 0; i < 200; i++ {
		idx.recordIndexProgress(ctx, conv, 100)

		idx.stalledMu.Lock()
		entry := idx.stalledConvs[convID.ConvIDStr()]
		idx.stalledMu.Unlock()

		require.Greater(t, entry.skips, 0,
			"round %d: skips fell to %d, so the backoff is off", i, entry.skips)
		require.LessOrEqual(t, entry.skips, maxStallSkips,
			"round %d: skips %d exceeds the cap", i, entry.skips)
		require.LessOrEqual(t, entry.streak, uint(maxStallStreak),
			"round %d: streak %d was not clamped", i, entry.streak)

		// consume the backoff so the next round records another no-progress
		// attempt rather than sitting on this one
		for idx.convStalled(convID, 100) {
		}
	}
}

func TestStopResetsStalledConvs(t *testing.T) {
	ctx := context.TODO()
	idx, conv := setupStallTestIndexer(t, "stall-stop")
	convID := conv.GetConvID()

	idx.recordIndexProgress(ctx, conv, 100)
	require.True(t, idx.convStalled(convID, 100), "conv is backed off before Stop")

	idx.Lock()
	idx.started = true
	idx.stopCh = make(chan struct{})
	idx.Unlock()
	<-idx.Stop(ctx)

	// entries are keyed by convID alone and team convs are shared between users
	// on one device, so a count left by the previous user must not decide
	// anything for the next one
	require.False(t, idx.convStalled(convID, 100),
		"Stop must clear the backoff so the next user starts clean")
}

func TestClearResetsStalledConv(t *testing.T) {
	ctx := context.TODO()
	idx, conv := setupStallTestIndexer(t, "stall-clear")
	convID := conv.GetConvID()

	idx.recordIndexProgress(ctx, conv, 100)
	require.True(t, idx.convStalled(convID, 100), "conv is backed off before Clear")

	require.NoError(t, idx.Clear(ctx, idx.uid, convID))

	// clearing the index resets what is missing, so the old count must not keep
	// the conv suppressed
	require.False(t, idx.convStalled(convID, 100),
		"Clear must drop the backoff for that conv")
}
