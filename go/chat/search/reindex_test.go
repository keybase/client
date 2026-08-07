package search

import (
	"context"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/externalstest"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

// reindexConv reaches ConversationSource.GetMessages and nothing else on the paths under
// test, so the interface is embedded and left nil: any other method called here
// panics rather than silently returning a zero value.
type stubConvSource struct {
	types.ConversationSource

	mu       sync.Mutex
	requests [][]chat1.MessageID
	// keyed by the first id of the chunk, so a test can fail one chunk only
	errs map[chat1.MessageID]error
	// ids to withhold from the reply even though they were asked for
	withhold map[chat1.MessageID]bool
	// optional messages to return in place of the default text message
	messages map[chat1.MessageID]chat1.MessageUnboxed
}

// IsPermanentErr treats any plain error as permanent, so exercising the
// retry-later branch needs an error that reports itself transient. The real one
// lives in package chat, which this package cannot import.
type transientErr struct{ inner error }

var _ types.UnboxingError = transientErr{}

func (e transientErr) Error() string                  { return e.inner.Error() }
func (e transientErr) InternalError() string          { return e.inner.Error() }
func (e transientErr) Inner() error                   { return e.inner }
func (e transientErr) IsPermanent() bool              { return false }
func (e transientErr) IsCritical() bool               { return false }
func (e transientErr) VersionKind() chat1.VersionKind { return "" }
func (e transientErr) VersionNumber() int             { return 0 }
func (e transientErr) ExportType() chat1.MessageUnboxedErrorType {
	return chat1.MessageUnboxedErrorType_MISC
}
func (e transientErr) ToStatus() keybase1.Status { return keybase1.Status{} }

func newStubConvSource() *stubConvSource {
	return &stubConvSource{
		errs:     make(map[chat1.MessageID]error),
		withhold: make(map[chat1.MessageID]bool),
		messages: make(map[chat1.MessageID]chat1.MessageUnboxed),
	}
}

func (s *stubConvSource) GetMessages(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, msgIDs []chat1.MessageID, reason *chat1.GetThreadReason,
	ri func() chat1.RemoteInterface, resolveSupersedes bool,
) ([]chat1.MessageUnboxed, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	chunk := make([]chat1.MessageID, len(msgIDs))
	copy(chunk, msgIDs)
	s.requests = append(s.requests, chunk)
	if len(msgIDs) > 0 {
		if err, ok := s.errs[msgIDs[0]]; ok {
			return nil, err
		}
	}
	var res []chat1.MessageUnboxed
	for _, id := range msgIDs {
		if s.withhold[id] {
			continue
		}
		if msg, ok := s.messages[id]; ok {
			res = append(res, msg)
		} else {
			res = append(res, textMsgForTest(id, fmt.Sprintf("message %d", id)))
		}
	}
	return res, nil
}

type stubInboxSource struct {
	types.InboxSource
	convs []types.RemoteConversation
}

func (s *stubInboxSource) ReadUnverified(context.Context, gregor1.UID,
	types.InboxSourceDataSourceTyp, *chat1.GetInboxQuery,
) (types.Inbox, error) {
	return types.Inbox{ConvsUnverified: s.convs}, nil
}

type cancelBlockingConvSource struct {
	types.ConversationSource
	started  chan struct{}
	canceled chan struct{}
	release  chan struct{}
}

func (s *cancelBlockingConvSource) GetMessages(ctx context.Context, _ chat1.ConversationID,
	_ gregor1.UID, _ []chat1.MessageID, _ *chat1.GetThreadReason,
	_ func() chat1.RemoteInterface, _ bool,
) ([]chat1.MessageUnboxed, error) {
	close(s.started)
	<-ctx.Done()
	close(s.canceled)
	<-s.release
	return nil, ctx.Err()
}

func (s *stubConvSource) calls() [][]chat1.MessageID {
	s.mu.Lock()
	defer s.mu.Unlock()
	res := make([][]chat1.MessageID, len(s.requests))
	copy(res, s.requests)
	return res
}

// maxID is the conv's newest message id; nothing is indexed, so every id from 1
// to maxID reads as missing.
func setupReindexTest(t *testing.T, label string, maxID chat1.MessageID) (
	*Indexer, *stubConvSource, chat1.Conversation, types.RemoteConversation,
) {
	tc := externalstest.SetupTest(t, label, 2)
	t.Cleanup(tc.Cleanup)
	cs := newStubConvSource()
	g := globals.NewContext(tc.G, &globals.ChatContext{
		CtxFactory: stubCtxFactory{},
		ConvSource: cs,
	})
	idx := NewIndexer(g)
	idx.SetUID(gregor1.UID([]byte{1, 2, 3, 4}))
	idx.store.diskStorage = newMemDiskStorage()

	convID := chat1.ConversationID([]byte{
		1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
	})
	conv := chat1.Conversation{
		Metadata:        chat1.ConversationMetadata{ConversationID: convID},
		MaxMsgSummaries: []chat1.MessageSummary{{MsgID: maxID}},
	}
	return idx, cs, conv, types.RemoteConversation{Conv: conv}
}

// startStorage runs the storage loop, which is what actually applies the ops
// reindexConv dispatches and releases the callbacks it waits on.
func startStorage(t *testing.T, idx *Indexer) {
	idx.Lock()
	idx.started = true
	idx.stopCh = make(chan struct{})
	stopCh := idx.stopCh
	idx.Unlock()
	go func() { _ = idx.storageLoop(stopCh) }()
	t.Cleanup(func() { close(stopCh) })
}

func seenIDs(t *testing.T, idx *Indexer, conv chat1.Conversation) map[chat1.MessageID]chat1.EmptyStruct {
	idx.store.Lock()
	defer idx.store.Unlock()
	md, err := idx.store.getMetadataLocked(context.TODO(), conv.GetConvID())
	require.NoError(t, err)
	return md.SeenIDs
}

// The headline of the paging rewrite: only ids that are actually missing are
// fetched. Paging the raw min..max range re-fetches everything already indexed,
// which spends the budget before reaching the ids that need it.
func TestReindexConvPagesOverMissingIDsOnly(t *testing.T) {
	ctx := context.TODO()
	idx, cs, conv, rconv := setupReindexTest(t, "reindex-missing-only", 30)
	startStorage(t, idx)
	idx.SetPageSize(10)

	// mark the first 20 ids as already accounted for
	var alreadySeen []chat1.MessageID
	for id := chat1.MessageID(1); id <= 20; id++ {
		alreadySeen = append(alreadySeen, id)
	}
	require.NoError(t, idx.store.MarkSeen(ctx, conv.GetConvID(), alreadySeen))

	result, err := idx.reindexConv(ctx, rconv, 0, nil)
	require.NoError(t, err)
	require.Equal(t, 1, result.completed)

	calls := cs.calls()
	require.Len(t, calls, 1, "only the 10 missing ids should have been fetched")
	require.Equal(t, []chat1.MessageID{21, 22, 23, 24, 25, 26, 27, 28, 29, 30}, calls[0])
	for _, chunk := range calls {
		for _, id := range chunk {
			require.Greater(t, id, chat1.MessageID(20), "an already-seen id was refetched")
		}
	}
}

// An id the source will not return can never be indexed, so a successful fetch
// has to close it out. Otherwise it holds numMissing above zero forever and the
// conv is re-queued every sync interval for work that cannot accomplish anything.
func TestReindexConvMarksUnreturnedIDsSeen(t *testing.T) {
	ctx := context.TODO()
	idx, cs, conv, rconv := setupReindexTest(t, "reindex-mark-seen", 5)
	startStorage(t, idx)
	idx.SetPageSize(10)

	// the server has no message 3 for us - deleted, or never delivered
	cs.mu.Lock()
	cs.withhold[3] = true
	cs.mu.Unlock()

	_, err := idx.reindexConv(ctx, rconv, 0, nil)
	require.NoError(t, err)

	require.Contains(t, seenIDs(t, idx, conv), chat1.MessageID(3),
		"an id the source will never return must still be marked seen")

	missing, err := idx.store.MissingIDForConv(ctx, conv)
	require.NoError(t, err)
	require.Empty(t, missing, "the conv must converge rather than stay permanently incomplete")
}

// A returned edit is not "accounted for" when its superseded message could not
// be fetched: store.Add deliberately leaves it unseen so a later pass retries
// it. MarkSeen must therefore cover only IDs absent from the successful outer
// fetch, not every ID that was requested.
func TestReindexConvDoesNotMarkUnresolvedEditSeen(t *testing.T) {
	ctx := context.TODO()
	idx, cs, conv, rconv := setupReindexTest(t, "reindex-unresolved-edit", 2)
	startStorage(t, idx)
	idx.SetPageSize(10)
	idx.G().ExternalG().ChatHelper = kbtest.NewMockChatHelper()

	require.NoError(t, idx.store.MarkSeen(ctx, conv.GetConvID(), []chat1.MessageID{1}))
	edit := chat1.NewMessageUnboxedWithValid(chat1.MessageUnboxedValid{
		ClientHeader: chat1.MessageClientHeaderVerified{
			MessageType: chat1.MessageType_EDIT,
			Conv:        chat1.ConversationIDTriple{TopicType: chat1.TopicType_CHAT},
		},
		MessageBody: chat1.NewMessageBodyWithEdit(chat1.MessageEdit{
			MessageID: 1,
			Body:      "edited text",
		}),
		ServerHeader: chat1.MessageServerHeader{MessageID: 2},
	})
	cs.mu.Lock()
	cs.messages[2] = edit
	cs.mu.Unlock()

	_, err := idx.reindexConv(ctx, rconv, 0, nil)
	require.NoError(t, err)
	require.NotContains(t, seenIDs(t, idx, conv), chat1.MessageID(2),
		"an edit whose superseded message was unavailable must remain retryable")
}

// A transient fetch failure says nothing about the ids, so they stay missing and
// a later pass retries them while the rest of the conv still makes progress.
func TestReindexConvDoesNotMarkSeenOnFetchError(t *testing.T) {
	ctx := context.TODO()
	idx, cs, conv, rconv := setupReindexTest(t, "reindex-fetch-error", 20)
	startStorage(t, idx)
	idx.SetPageSize(10)

	cs.mu.Lock()
	cs.errs[1] = transientErr{fmt.Errorf("network blip")}
	cs.mu.Unlock()

	result, err := idx.reindexConv(ctx, rconv, 0, nil)
	require.NoError(t, err, "a transient failure must not fail the whole conv")
	require.Equal(t, 1, result.completed, "only the chunk that succeeded counts as a job")

	seen := seenIDs(t, idx, conv)
	require.NotContains(t, seen, chat1.MessageID(1), "a failed chunk must stay missing")
	require.Contains(t, seen, chat1.MessageID(11), "the chunk that succeeded must be marked")
}

// A store failure is about the store, not the conv: nothing was indexed, so
// nothing may be marked seen, or the messages are recorded as indexed with no
// tokens behind them and nothing ever revisits them.
func TestReindexConvStopsOnAddFailure(t *testing.T) {
	ctx := context.TODO()
	idx, _, conv, rconv := setupReindexTest(t, "reindex-add-failure", 10)
	startStorage(t, idx)
	idx.SetPageSize(10)

	disk := newMemDiskStorage()
	idx.store.diskStorage = disk
	disk.Lock()
	disk.failTokenGet = fmt.Errorf("cannot read token entry")
	disk.Unlock()

	_, err := idx.reindexConv(ctx, rconv, 0, nil)
	require.Error(t, err, "a failed add must fail the conv")

	disk.Lock()
	disk.failTokenGet = nil
	disk.Unlock()
	require.Empty(t, seenIDs(t, idx, conv), "nothing may be marked seen when indexing failed")
}

func TestReindexConvRespectsJobBudget(t *testing.T) {
	ctx := context.TODO()
	idx, cs, _, rconv := setupReindexTest(t, "reindex-budget", 50)
	startStorage(t, idx)
	idx.SetPageSize(10)

	result, err := idx.reindexConv(ctx, rconv, 2, nil)
	require.NoError(t, err)
	require.Equal(t, 2, result.completed)
	require.Len(t, cs.calls(), 2, "the budget must stop the paging, not just the count")
}

// A disabled indexer drops everything add() is given, so paging on would mark
// ids seen with nothing indexed behind them - and they would stay that way if
// indexing were turned back on.
func TestReindexConvSkipsWhenIndexerDisabled(t *testing.T) {
	ctx := context.TODO()
	idx, cs, conv, rconv := setupReindexTest(t, "reindex-disabled", 10)
	startStorage(t, idx)
	t.Setenv("KEYBASE_DISABLE_SEARCH_INDEXER", "1")
	require.True(t, idx.G().GetEnv().GetDisableSearchIndexer())

	result, err := idx.reindexConv(ctx, rconv, 0, nil)
	require.NoError(t, err)
	require.Equal(t, 0, result.completed)
	require.Empty(t, cs.calls(), "a disabled indexer must not fetch anything")
	require.Empty(t, seenIDs(t, idx, conv), "a disabled indexer must not mark anything seen")
}

// The flush loop wakes on a full pending set as well as on its timer, so a burst
// of indexing does not sit in memory for a whole flush interval.
func TestFlushLoopFlushesOnPendingSignal(t *testing.T) {
	ctx := context.TODO()
	idx, _, _, _ := setupReindexTest(t, "flush-signal", 10)
	disk := newMemDiskStorage()
	idx.store.diskStorage = disk

	// long enough that only the pending signal can be what fires
	idx.SetFlushDelay(time.Hour)
	idx.Lock()
	idx.started = true
	idx.stopCh = make(chan struct{})
	stopCh := idx.stopCh
	idx.Unlock()
	go func() { _ = idx.flushLoop(stopCh) }()
	t.Cleanup(func() { close(stopCh) })

	convID := chat1.ConversationID([]byte{1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16})
	idx.store.Lock()
	for i := chat1.MessageID(0); i < maxDirtyEntries; i++ {
		te := newTokenEntry()
		te.MsgIDs[i] = chat1.EmptyStruct{}
		require.NoError(t, idx.store.putTokenEntry(ctx, convID, fmt.Sprintf("token%d", i), te))
	}
	idx.store.Unlock()

	require.Eventually(t, func() bool {
		onDisk, err := disk.GetTokenEntry(ctx, convID, "token0")
		return err == nil && onDisk != nil
	}, 10*time.Second, 10*time.Millisecond,
		"a full pending set must trigger a flush without waiting for the timer")
}

// Clearing one conversation must not take every other conversation's pending
// writes with it: the disk clear is per-conv but ClearMemory is global.
func TestClearPreservesOtherConvsPendingWrites(t *testing.T) {
	ctx, s, disk, convA := setupFlushTestStore(t, "clear-other-convs")
	convB := chat1.ConversationID([]byte{
		9, 9, 9, 9, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
	})

	teA := newTokenEntry()
	teA.MsgIDs[1] = chat1.EmptyStruct{}
	teB := newTokenEntry()
	teB.MsgIDs[2] = chat1.EmptyStruct{}
	s.Lock()
	require.NoError(t, s.putTokenEntry(ctx, convA, "alpha", teA))
	require.NoError(t, s.putTokenEntry(ctx, convB, "beta", teB))
	s.Unlock()

	require.NoError(t, s.Clear(ctx, s.uid, convA))

	onDisk, err := disk.GetTokenEntry(ctx, convB, "beta")
	require.NoError(t, err)
	require.NotNil(t, onDisk, "another conv's pending write must survive a single-conv clear")
	require.Contains(t, onDisk.MsgIDs, chat1.MessageID(2))
}

// Clear flushes before dropping the caches. A mutation that lands during that
// flush must not be discarded by the following ClearMemory.
func TestClearPreservesConcurrentMutation(t *testing.T) {
	ctx, s, disk, convA := setupFlushTestStore(t, "clear-concurrent-write")
	convB := chat1.ConversationID([]byte{
		9, 9, 9, 9, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
	})

	s.Lock()
	require.NoError(t, s.putTokenEntry(ctx, convA, "alpha", newTokenEntry()))
	s.Unlock()

	writeDone := make(chan struct{})
	var writeErr error
	disk.Lock()
	disk.onPutToken = func() {
		go func() {
			writeErr = s.Add(ctx, convB, []chat1.MessageUnboxed{
				textMsgForTest(2, "beta"),
			})
			close(writeDone)
		}()
		// With the old implementation Add is allowed to finish in the window
		// before ClearMemory. Once Clear serializes mutations, it remains blocked
		// here until Clear completes.
		select {
		case <-writeDone:
		case <-time.After(100 * time.Millisecond):
		}
	}
	disk.Unlock()

	require.NoError(t, s.Clear(ctx, s.uid, convA))
	select {
	case <-writeDone:
	case <-time.After(5 * time.Second):
		require.Fail(t, "concurrent mutation never completed")
	}
	require.NoError(t, writeErr)
	require.NoError(t, s.Flush())

	onDisk, err := disk.GetTokenEntry(ctx, convB, "beta")
	require.NoError(t, err)
	require.NotNil(t, onDisk, "Clear discarded another conversation's concurrent write")
	require.Contains(t, onDisk.MsgIDs, chat1.MessageID(2))
}

// The alias read path has the same pending-delete hazard as the token one: a
// queued delete must hide the copy still on disk.
func TestPendingAliasDeleteIsNotReadFromDisk(t *testing.T) {
	ctx, s, disk, _ := setupFlushTestStore(t, "alias-tombstone")

	ae := newAliasEntry()
	ae.add("alpha")
	require.NoError(t, disk.PutAliasEntry(ctx, "al", ae))

	s.Lock()
	defer s.Unlock()
	s.deleteAliasEntry(ctx, "al")

	got, err := s.getAliasEntry(ctx, "al")
	require.NoError(t, err)
	require.NotNil(t, got)
	require.Empty(t, got.Aliases,
		"a pending alias delete must read as empty, not fall through to the copy on disk")
}

// A fetch that fails spends the same remote round trip a completed page does. If
// only completed pages count, a conv whose fetches keep failing pages over its
// entire missing range in one pass and numJobs bounds nothing.
func TestReindexConvStopsAfterRepeatedFetchFailures(t *testing.T) {
	ctx := context.TODO()
	idx, cs, _, rconv := setupReindexTest(t, "reindex-repeated-failures", 50)
	startStorage(t, idx)
	idx.SetPageSize(10)

	cs.mu.Lock()
	for _, first := range []chat1.MessageID{1, 11, 21, 31, 41} {
		cs.errs[first] = transientErr{fmt.Errorf("network blip")}
	}
	cs.mu.Unlock()

	result, err := idx.reindexConv(ctx, rconv, 0, nil)
	require.NoError(t, err, "a transient failure must not fail the whole conv")
	require.Equal(t, 0, result.completed)
	require.Len(t, cs.calls(), maxConsecutiveFetchFailures,
		"a conv whose fetches keep failing must be abandoned, not paged to the end")
}

// The budget counts round trips, so a failed one leaves less of it for the rest
// of the pass.
func TestReindexConvChargesFailedFetchesToBudget(t *testing.T) {
	ctx := context.TODO()
	idx, cs, _, rconv := setupReindexTest(t, "reindex-failure-budget", 50)
	startStorage(t, idx)
	idx.SetPageSize(10)

	// second chunk only, so the failures never run consecutively
	cs.mu.Lock()
	cs.errs[11] = transientErr{fmt.Errorf("network blip")}
	cs.mu.Unlock()

	result, err := idx.reindexConv(ctx, rconv, 2, nil)
	require.NoError(t, err)
	require.Equal(t, 1, result.completed, "only the chunk that succeeded counts as a job")
	require.Equal(t, 2, result.attempted, "both remote calls must count against the budget")
	require.Len(t, cs.calls(), 2, "the failed fetch must spend budget like a completed one")
}

// The budget belongs to the whole SelectiveSync pass, not each conversation.
// During an outage, failed fetches across many conversations must not multiply
// past maxSyncConvs.
func TestSelectiveSyncChargesFailedFetchesAcrossConversations(t *testing.T) {
	ctx := context.TODO()
	idx, cs, _, _ := setupReindexTest(t, "selective-sync-global-budget", 20)
	idx.SetPageSize(10)
	idx.SetMaxSyncConvs(2)

	var convs []types.RemoteConversation
	for suffix := byte(1); suffix <= 3; suffix++ {
		convID := chat1.ConversationID([]byte{
			1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, suffix,
		})
		convs = append(convs, types.RemoteConversation{
			ConvIDStr: convID.ConvIDStr(),
			Conv: chat1.Conversation{
				Metadata:        chat1.ConversationMetadata{ConversationID: convID},
				MaxMsgSummaries: []chat1.MessageSummary{{MsgID: 20}},
				ReaderInfo:      &chat1.ConversationReaderInfo{MaxMsgid: 20},
			},
		})
	}
	idx.G().InboxSource = &stubInboxSource{convs: convs}
	cs.mu.Lock()
	cs.errs[1] = transientErr{fmt.Errorf("network down")}
	cs.errs[11] = transientErr{fmt.Errorf("network down")}
	cs.mu.Unlock()

	require.NoError(t, idx.SelectiveSync(ctx))
	require.Len(t, cs.calls(), 2,
		"failed fetches across conversations exceeded the pass-wide budget")
}

// SyncLoop owns the SelectiveSync goroutine it starts. On shutdown it must wait
// for that attempt to leave, or the old attempt can keep reading idx.store after
// the next Start replaces it.
func TestSyncLoopWaitsForActiveAttemptOnStop(t *testing.T) {
	tc := externalstest.SetupTest(t, "sync-loop-stop-wait", 2)
	t.Cleanup(tc.Cleanup)
	source := &cancelBlockingConvSource{
		started:  make(chan struct{}),
		canceled: make(chan struct{}),
		release:  make(chan struct{}),
	}
	var releaseOnce sync.Once
	t.Cleanup(func() { releaseOnce.Do(func() { close(source.release) }) })

	convID := chat1.ConversationID([]byte{
		1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
	})
	rconv := types.RemoteConversation{
		ConvIDStr: convID.ConvIDStr(),
		Conv: chat1.Conversation{
			Metadata:        chat1.ConversationMetadata{ConversationID: convID},
			MaxMsgSummaries: []chat1.MessageSummary{{MsgID: 2}},
			ReaderInfo:      &chat1.ConversationReaderInfo{MaxMsgid: 2},
		},
	}
	g := globals.NewContext(tc.G, &globals.ChatContext{
		CtxFactory:  stubCtxFactory{},
		ConvSource:  source,
		InboxSource: &stubInboxSource{convs: []types.RemoteConversation{rconv}},
	})
	idx := NewIndexer(g)
	idx.SetUID(gregor1.UID([]byte{1, 2, 3, 4}))
	idx.store.diskStorage = newMemDiskStorage()
	idx.SetStartSyncDelay(0)

	stopCh := make(chan struct{})
	loopDone := make(chan error, 1)
	go func() { loopDone <- idx.SyncLoop(stopCh) }()

	select {
	case <-source.started:
	case <-time.After(5 * time.Second):
		require.Fail(t, "SelectiveSync never reached the blocking fetch")
	}
	close(stopCh)
	select {
	case <-source.canceled:
	case <-time.After(5 * time.Second):
		require.Fail(t, "SyncLoop did not cancel its active attempt")
	}
	select {
	case <-loopDone:
		require.Fail(t, "SyncLoop returned while its SelectiveSync attempt was still running")
	default:
	}

	releaseOnce.Do(func() { close(source.release) })
	select {
	case err := <-loopDone:
		require.NoError(t, err)
	case <-time.After(5 * time.Second):
		require.Fail(t, "SyncLoop did not finish after its active attempt exited")
	}
}
