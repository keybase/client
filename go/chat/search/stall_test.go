package search

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/externalstest"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/stretchr/testify/require"
)

// The stall backoff only fires for a conv that cannot converge, which a healthy
// client never produces: SelectiveSync drains every conv to numMissing 0 and
// skips it thereafter. These paths are therefore unreachable from an end-to-end
// run and can only be covered here.

// add() converts its context with globals.BackgroundChatCtx, which reaches for
// the context factory. Nothing on the paths under test uses what it returns, so
// a stub keeps these tests from needing the whole chat harness.
type stubCtxFactory struct{}

func (stubCtxFactory) NewKeyFinder() types.KeyFinder   { return nil }
func (stubCtxFactory) NewUPAKFinder() types.UPAKFinder { return nil }

func setupStallTestIndexer(t *testing.T, label string) (*Indexer, chat1.Conversation) {
	tc := externalstest.SetupTest(t, label, 2)
	t.Cleanup(tc.Cleanup)
	g := globals.NewContext(tc.G, &globals.ChatContext{CtxFactory: stubCtxFactory{}})
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

// A failed store.Add must reach the caller as an error, not as a completed op:
// reindexConv marks the whole chunk seen on success, against messages that never
// made it into the index.
func TestStorageLoopReportsAddFailure(t *testing.T) {
	idx, _ := setupStallTestIndexer(t, "storage-add-failure")
	disk := newMemDiskStorage()
	idx.store.diskStorage = disk
	disk.Lock()
	disk.failTokenGet = fmt.Errorf("cannot read token entry")
	disk.Unlock()

	stopCh := make(chan struct{})
	go func() { _ = idx.storageLoop(stopCh) }()
	t.Cleanup(func() { close(stopCh) })

	convID := chat1.ConversationID([]byte{1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16})
	cb := make(chan error, 1)
	idx.storageCh <- storageAdd{
		ctx:    context.TODO(),
		convID: convID,
		msgs:   []chat1.MessageUnboxed{textMsgForTest(1, "hello world")},
		cb:     cb,
	}

	select {
	case err := <-cb:
		require.Error(t, err,
			"a failed add reported success, so its messages get marked indexed")
	case <-time.After(5 * time.Second):
		require.Fail(t, "the caller was never woken")
	}
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

// TestStallStreakDoesNotOverflow pins the clamp on the shift exponent. Nothing
// else bounds streak, so `1 << streak` on a conv that never converges shifts past
// the width of an int: the result goes negative and then to 0, which reads as "no
// skips left" and silently disables the backoff for good. Clamping the result
// instead of the exponent does not help - the shift has already overflowed by
// then.
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

// reindexConv waits on a storage op's callback, so a dropped op must still close
// it. An unclosed callback parks the waiter forever, holding SelectiveSync's
// cancel func and leaving every later pass reporting "already running" -
// background indexing dead until the process restarts.
func TestDroppedStorageOpDoesNotStrandCaller(t *testing.T) {
	ctx := context.TODO()
	idx, conv := setupStallTestIndexer(t, "dispatch-full")
	convID := conv.GetConvID()

	// storageDispatch returns at its !started check otherwise, so the queue never
	// comes into it and the branch under test is never reached.
	idx.Lock()
	idx.started = true
	idx.stopCh = make(chan struct{})
	idx.Unlock()

	// fill the dispatch queue so the next op cannot be accepted
	for len(idx.storageCh) < cap(idx.storageCh) {
		idx.storageCh <- storageAdd{}
	}

	msgs := []chat1.MessageUnboxed{textMsgForTest(1, "hello world")}
	cb, err := idx.add(ctx, convID, msgs, true)
	require.ErrorIs(t, err, errStorageQueueFull,
		"a dropped op must be reported, or the caller marks unindexed messages as seen")

	select {
	case <-cb:
	case <-time.After(5 * time.Second):
		require.Fail(t, "callback of a dropped op was never closed; caller would hang forever")
	}
}

// A stopped indexer refuses the op for a different reason than a full queue, and
// must release the caller just the same.
func TestDispatchOnStoppedIndexerDoesNotStrandCaller(t *testing.T) {
	ctx := context.TODO()
	idx, conv := setupStallTestIndexer(t, "dispatch-stopped")

	msgs := []chat1.MessageUnboxed{textMsgForTest(1, "hello world")}
	cb, err := idx.add(ctx, conv.GetConvID(), msgs, true)
	require.ErrorIs(t, err, errStorageQueueFull,
		"a op refused by a stopped indexer must be reported like any other drop")

	select {
	case <-cb:
	case <-time.After(5 * time.Second):
		require.Fail(t, "callback of a refused op was never closed; caller would hang forever")
	}
}

// Ops still queued when the loop shuts down have nobody left to run them, so
// their callbacks have to be released - and released with an error. Waking the
// caller with a bare "done" is worse than hanging it: reindexConv then marks the
// chunk seen, recording messages as indexed that were never handed to the store,
// and a conv that reaches numMissing 0 that way is never revisited.
func TestStorageLoopReleasesQueuedCallbacksOnShutdown(t *testing.T) {
	idx, _ := setupStallTestIndexer(t, "dispatch-shutdown")
	cb := make(chan error, 1)
	idx.storageCh <- storageAdd{cb: cb}

	// the drain directly, not storageLoop: with stopCh closed both of its select
	// cases are ready and Go picks at random, so going through the loop would
	// run the op half the time and test nothing the other half
	idx.drainStorageQueue()

	select {
	case err := <-cb:
		require.ErrorIs(t, err, errStorageStopped,
			"an op that never ran reported success, so its messages get marked indexed")
	case <-time.After(5 * time.Second):
		require.Fail(t, "a queued op's callback was abandoned at shutdown")
	}
}
