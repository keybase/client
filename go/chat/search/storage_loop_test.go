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

// add() converts its context with globals.BackgroundChatCtx, which reaches for
// the context factory. Nothing on the paths under test uses what it returns, so
// a stub keeps these tests from needing the whole chat harness.
type stubCtxFactory struct{}

func (stubCtxFactory) NewKeyFinder() types.KeyFinder   { return nil }
func (stubCtxFactory) NewUPAKFinder() types.UPAKFinder { return nil }

func setupStorageLoopTestIndexer(t *testing.T, label string) (*Indexer, chat1.Conversation) {
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

// A failed store.Add must reach the caller as an error, not as a completed op,
// or reindexConv can treat messages that never reached the index as finished.
func TestStorageLoopReportsAddFailure(t *testing.T) {
	idx, _ := setupStorageLoopTestIndexer(t, "storage-add-failure")
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

// reindexConv waits on a storage op's callback, so a dropped op must still
// complete it. A missing result parks the waiter forever, holding SelectiveSync's
// cancel func and leaving every later pass reporting "already running" -
// background indexing dead until the process restarts.
func TestDroppedStorageOpDoesNotStrandCaller(t *testing.T) {
	ctx := context.TODO()
	idx, conv := setupStorageLoopTestIndexer(t, "dispatch-full")
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
		require.Fail(t, "callback of a dropped op never completed; caller would hang forever")
	}
}

// A stopped indexer refuses the op for a different reason than a full queue, and
// must release the caller just the same.
func TestDispatchOnStoppedIndexerDoesNotStrandCaller(t *testing.T) {
	ctx := context.TODO()
	idx, conv := setupStorageLoopTestIndexer(t, "dispatch-stopped")

	msgs := []chat1.MessageUnboxed{textMsgForTest(1, "hello world")}
	cb, err := idx.add(ctx, conv.GetConvID(), msgs, true)
	require.ErrorIs(t, err, errStorageStopped,
		"an op refused by a stopped indexer must report that the loop is stopped")

	select {
	case <-cb:
	case <-time.After(5 * time.Second):
		require.Fail(t, "callback of a refused op never completed; caller would hang forever")
	}
}

// Ops still queued when the loop shuts down have nobody left to run them, so
// their callbacks have to be released - and released with an error. Waking the
// caller with a bare "done" is worse than hanging it: reindexConv then marks the
// chunk seen, recording messages as indexed that were never handed to the store,
// and a conv that reaches numMissing 0 that way is never revisited.
func TestStorageLoopReleasesQueuedCallbacksOnShutdown(t *testing.T) {
	idx, _ := setupStorageLoopTestIndexer(t, "dispatch-shutdown")
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

// Stop finishes its final flush asynchronously, but the next Start must wait for
// it. Otherwise old loops can observe the new store or drain the new run's
// storage operations. Run with -race to cover the store replacement as well as
// the lifecycle ordering.
func TestStopDoesNotReachForANewerStore(t *testing.T) {
	idx, _ := setupStorageLoopTestIndexer(t, "stop-start-store")
	uid := gregor1.UID([]byte{1, 2, 3, 4})
	ctx := context.TODO()
	for range 20 {
		idx.Start(ctx, uid)
		stopped := idx.Stop(ctx)
		// deliberately not waiting on stopped before restarting: that gap is
		// exactly what this covers
		idx.Start(ctx, uid)
		<-stopped
		<-idx.Stop(ctx)
	}
}
