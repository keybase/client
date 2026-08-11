package search

import (
	"context"
	"fmt"
	"sync"
	"testing"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/externalstest"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/stretchr/testify/require"
)

// memDiskStorage simulates the disk store without encryption, so tests don't need
// a logged-in user. Cache.Purge() in tests simulates LRU eviction: during heavy
// indexing, dirty entries are evicted before flush (normal case, not corner case).
type memDiskStorage struct {
	sync.Mutex
	tokens  map[string]*tokenEntry
	aliases map[string]*aliasEntry
	md      map[chat1.ConvIDStr]*indexMetadata

	// set to make the corresponding call fail, so the error paths - which are
	// where entries get lost - are reachable from a test
	failTokenPut error
	failAliasPut error
	failMdPut    error
	failTokenGet error

	// runs once, during a PutTokenEntry, to interleave an operation with a
	// flush's disk writes - which happen outside the store lock
	onPutToken func()
}

func newMemDiskStorage() *memDiskStorage {
	return &memDiskStorage{
		tokens:  make(map[string]*tokenEntry),
		aliases: make(map[string]*aliasEntry),
		md:      make(map[chat1.ConvIDStr]*indexMetadata),
	}
}

func (m *memDiskStorage) key(convID chat1.ConversationID, token string) string {
	return convID.ConvIDStr().String() + ":" + token
}

func (m *memDiskStorage) GetTokenEntry(ctx context.Context, convID chat1.ConversationID,
	token string,
) (*tokenEntry, error) {
	m.Lock()
	defer m.Unlock()
	if m.failTokenGet != nil {
		return nil, m.failTokenGet
	}
	return m.tokens[m.key(convID, token)], nil
}

func (m *memDiskStorage) PutTokenEntry(ctx context.Context, convID chat1.ConversationID,
	token string, te *tokenEntry,
) error {
	m.Lock()
	defer m.Unlock()
	if m.failTokenPut != nil {
		return m.failTokenPut
	}
	if te == nil {
		return fmt.Errorf("PutTokenEntry called with a nil entry: a delete must not be written as a value")
	}
	if m.onPutToken != nil {
		hook := m.onPutToken
		m.onPutToken = nil
		m.Unlock()
		hook()
		m.Lock()
	}
	m.tokens[m.key(convID, token)] = te
	return nil
}

func (m *memDiskStorage) RemoveTokenEntry(ctx context.Context, convID chat1.ConversationID, token string) {
	m.Lock()
	defer m.Unlock()
	delete(m.tokens, m.key(convID, token))
}

func (m *memDiskStorage) GetAliasEntry(ctx context.Context, alias string) (*aliasEntry, error) {
	m.Lock()
	defer m.Unlock()
	return m.aliases[alias], nil
}

func (m *memDiskStorage) PutAliasEntry(ctx context.Context, alias string, ae *aliasEntry) error {
	m.Lock()
	defer m.Unlock()
	if m.failAliasPut != nil {
		return m.failAliasPut
	}
	if ae == nil {
		return fmt.Errorf("PutAliasEntry called with a nil entry: a delete must not be written as a value")
	}
	m.aliases[alias] = ae
	return nil
}

func (m *memDiskStorage) RemoveAliasEntry(ctx context.Context, alias string) {
	m.Lock()
	defer m.Unlock()
	delete(m.aliases, alias)
}

func (m *memDiskStorage) GetMetadata(ctx context.Context, convID chat1.ConversationID) (*indexMetadata, error) {
	m.Lock()
	defer m.Unlock()
	return m.md[convID.ConvIDStr()], nil
}

func (m *memDiskStorage) PutMetadata(ctx context.Context, convID chat1.ConversationID, md *indexMetadata) error {
	m.Lock()
	defer m.Unlock()
	if m.failMdPut != nil {
		return m.failMdPut
	}
	m.md[convID.ConvIDStr()] = md
	return nil
}

func (m *memDiskStorage) Clear(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID) error {
	m.Lock()
	defer m.Unlock()
	delete(m.md, convID.ConvIDStr())
	return nil
}

func setupFlushTestStore(t *testing.T, label string) (context.Context, *store, *memDiskStorage, chat1.ConversationID) {
	tc := externalstest.SetupTest(t, label, 2)
	t.Cleanup(tc.Cleanup)
	g := globals.NewContext(tc.G, &globals.ChatContext{})
	s := newStore(g, gregor1.UID([]byte{1, 2, 3, 4}))
	disk := newMemDiskStorage()
	s.diskStorage = disk
	convID := chat1.ConversationID([]byte{
		1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
	})
	return context.TODO(), s, disk, convID
}

func TestFlushWritesEvictedTokens(t *testing.T) {
	ctx, s, disk, convID := setupFlushTestStore(t, "flush-evicted-token")

	te := newTokenEntry()
	te.MsgIDs[7] = chat1.EmptyStruct{}
	s.Lock()
	require.NoError(t, s.putTokenEntry(ctx, convID, "alpha", te))
	s.Unlock()

	// evicted before the flush loop got to it
	s.tokenCache.Purge()

	require.NoError(t, s.Flush())

	onDisk, err := disk.GetTokenEntry(ctx, convID, "alpha")
	require.NoError(t, err)
	require.NotNil(t, onDisk, "an evicted dirty token must still be written to disk")
	require.Contains(t, onDisk.MsgIDs, chat1.MessageID(7))
}

func TestFlushWritesEvictedAliases(t *testing.T) {
	ctx, s, disk, _ := setupFlushTestStore(t, "flush-evicted-alias")

	ae := newAliasEntry()
	ae.Aliases["alpha"] = 1
	s.Lock()
	require.NoError(t, s.putAliasEntry(ctx, "alp", ae))
	s.Unlock()

	s.aliasCache.Purge()

	require.NoError(t, s.Flush())

	onDisk, err := disk.GetAliasEntry(ctx, "alp")
	require.NoError(t, err)
	require.NotNil(t, onDisk, "an evicted dirty alias must still be written to disk")
	require.Contains(t, onDisk.Aliases, "alpha")
}

// Losing metadata is the one that costs search history: SeenIDs is what records
// a message as indexed, so dropping it silently un-indexes messages whose tokens
// were already written.
func TestFlushWritesEvictedMetadata(t *testing.T) {
	ctx, s, disk, convID := setupFlushTestStore(t, "flush-evicted-md")

	require.NoError(t, s.MarkSeen(ctx, convID, []chat1.MessageID{1, 2, 3}))

	s.mdCache.Purge()

	require.NoError(t, s.Flush())

	onDisk, err := disk.GetMetadata(ctx, convID)
	require.NoError(t, err)
	require.NotNil(t, onDisk, "evicted dirty metadata must still be written to disk")
	require.Contains(t, onDisk.SeenIDs, chat1.MessageID(2))
}

// A read of an evicted dirty entry must come from the pending set, not disk. The
// copy on disk is by definition stale - it is missing precisely the writes that
// are still dirty - and further updates would be built on top of it.
func TestReadAfterEvictionDoesNotSeeStaleDisk(t *testing.T) {
	ctx, s, _, convID := setupFlushTestStore(t, "flush-stale-read")

	first := newTokenEntry()
	first.MsgIDs[1] = chat1.EmptyStruct{}
	s.Lock()
	require.NoError(t, s.putTokenEntry(ctx, convID, "alpha", first))
	s.Unlock()
	require.NoError(t, s.Flush())

	// a second write that is still dirty when the entry is evicted
	second := newTokenEntry()
	second.MsgIDs[1] = chat1.EmptyStruct{}
	second.MsgIDs[2] = chat1.EmptyStruct{}
	s.Lock()
	require.NoError(t, s.putTokenEntry(ctx, convID, "alpha", second))
	s.Unlock()

	s.tokenCache.Purge()

	s.Lock()
	got, err := s.getTokenEntry(ctx, convID, "alpha")
	s.Unlock()
	require.NoError(t, err)
	require.Contains(t, got.MsgIDs, chat1.MessageID(2),
		"read fell through to the stale copy on disk instead of the pending write")
}

// Pending entries are pinned in memory until flushed, so without a size bound a
// fast writer decides how much accumulates between the 15s ticks.
func TestFlushSignalledWhenPendingSetIsFull(t *testing.T) {
	ctx, s, _, convID := setupFlushTestStore(t, "flush-size-bound")

	s.Lock()
	for i := chat1.MessageID(0); i < maxDirtyEntries-1; i++ {
		te := newTokenEntry()
		te.MsgIDs[i] = chat1.EmptyStruct{}
		require.NoError(t, s.putTokenEntry(ctx, convID, fmt.Sprintf("tok%d", i), te))
	}
	s.Unlock()

	select {
	case <-s.flushNeeded():
		require.Fail(t, "asked for a flush below the bound")
	default:
	}

	s.Lock()
	require.NoError(t, s.putTokenEntry(ctx, convID, "last", newTokenEntry()))
	s.Unlock()

	select {
	case <-s.flushNeeded():
	default:
		require.Fail(t, "crossing the bound must ask for a flush")
	}
}

// Rewriting the same key does not grow the pending set, so it must not count
// toward the bound - otherwise a hot token flushes constantly for no reason.
func TestPendingCountTracksDistinctEntries(t *testing.T) {
	ctx, s, _, convID := setupFlushTestStore(t, "flush-size-distinct")

	s.Lock()
	for i := chat1.MessageID(0); i < maxDirtyEntries*2; i++ {
		te := newTokenEntry()
		te.MsgIDs[i] = chat1.EmptyStruct{}
		require.NoError(t, s.putTokenEntry(ctx, convID, "same", te))
	}
	count := s.dirtyCount
	s.Unlock()

	require.Equal(t, 1, count, "rewrites of one key must count once")

	select {
	case <-s.flushNeeded():
		require.Fail(t, "rewriting one key must not trip the bound")
	default:
	}
}

func TestFlushResetsPendingCount(t *testing.T) {
	ctx, s, _, convID := setupFlushTestStore(t, "flush-size-reset")

	s.Lock()
	for i := 0; i < maxDirtyEntries; i++ {
		require.NoError(t, s.putTokenEntry(ctx, convID, fmt.Sprintf("tok%d", i), newTokenEntry()))
	}
	s.Unlock()

	require.NoError(t, s.Flush())

	s.Lock()
	count := s.dirtyCount
	s.Unlock()
	require.Equal(t, 0, count, "flush must clear the pending count with the maps")

	// and the signal it answered must not still be queued, or the loop spins
	select {
	case <-s.flushNeeded():
		require.Fail(t, "a flush left its own signal pending")
	default:
	}
}

func TestMetadataReadAfterEvictionKeepsSeenIDs(t *testing.T) {
	ctx, s, disk, convID := setupFlushTestStore(t, "flush-stale-md-read")

	require.NoError(t, s.MarkSeen(ctx, convID, []chat1.MessageID{1}))
	require.NoError(t, s.Flush())
	require.NoError(t, s.MarkSeen(ctx, convID, []chat1.MessageID{2}))

	s.mdCache.Purge()

	s.RLock()
	md, err := s.getMetadataLocked(ctx, convID)
	s.RUnlock()
	require.NoError(t, err)
	require.Contains(t, md.SeenIDs, chat1.MessageID(2),
		"an unflushed SeenID was lost to a cache eviction")

	// and the id must survive the round trip rather than only living in memory
	require.NoError(t, s.Flush())
	onDisk, err := disk.GetMetadata(ctx, convID)
	require.NoError(t, err)
	require.Contains(t, onDisk.SeenIDs, chat1.MessageID(2))
}

// A write that never reached disk must go back into the pending set. Before
// this, Flush cleared dirty tracking before writing, so a failed write was
// dropped: nothing marks a token entry dirty again once its message is indexed,
// while the live metadata keeps its SeenIDs. The next successful flush then
// recorded those messages as indexed with no tokens behind them.
func TestFlushRequeuesUnwrittenEntriesOnFailure(t *testing.T) {
	ctx, s, disk, convID := setupFlushTestStore(t, "flush-requeue")

	te := newTokenEntry()
	te.MsgIDs[7] = chat1.EmptyStruct{}
	s.Lock()
	require.NoError(t, s.putTokenEntry(ctx, convID, "alpha", te))
	s.Unlock()
	require.NoError(t, s.MarkSeen(ctx, convID, []chat1.MessageID{7}))

	disk.Lock()
	disk.failTokenPut = fmt.Errorf("disk is full")
	disk.Unlock()

	require.Error(t, s.Flush(), "a failed write must surface")

	// metadata must not have landed while its token did not
	onDisk, err := disk.GetMetadata(ctx, convID)
	require.NoError(t, err)
	require.Nil(t, onDisk, "metadata was published without the tokens behind it")

	s.Lock()
	pending := s.dirtyCount
	_, tokenPending := s.dirtyTokens[convID.ConvIDStr()]["alpha"]
	_, mdPending := s.dirtyMetadata[convID.ConvIDStr()]
	s.Unlock()
	require.True(t, tokenPending, "the token that failed to write was dropped")
	require.True(t, mdPending, "the metadata that was never attempted was dropped")
	require.Equal(t, 2, pending, "dirtyCount must match what was put back")

	// once the disk recovers, the retry writes everything
	disk.Lock()
	disk.failTokenPut = nil
	disk.Unlock()
	require.NoError(t, s.Flush())

	gotToken, err := disk.GetTokenEntry(ctx, convID, "alpha")
	require.NoError(t, err)
	require.NotNil(t, gotToken, "the retry did not write the token")
	require.Contains(t, gotToken.MsgIDs, chat1.MessageID(7))
	gotMd, err := disk.GetMetadata(ctx, convID)
	require.NoError(t, err)
	require.NotNil(t, gotMd)
	require.Contains(t, gotMd.SeenIDs, chat1.MessageID(7))
}

// Requeueing must not clobber a write that happened after the snapshot was
// taken - that value is newer than the one that failed.
func TestRequeueKeepsNewerPendingWrite(t *testing.T) {
	ctx, s, _, convID := setupFlushTestStore(t, "flush-requeue-newer")

	stale := newTokenEntry()
	stale.MsgIDs[1] = chat1.EmptyStruct{}
	newer := newTokenEntry()
	newer.MsgIDs[2] = chat1.EmptyStruct{}

	s.Lock()
	require.NoError(t, s.putTokenEntry(ctx, convID, "alpha", newer))
	s.Unlock()

	s.requeue([]tokenSnapshot{{convID: convID, token: "alpha", entry: stale}}, nil, nil)

	s.Lock()
	got := s.dirtyTokens[convID.ConvIDStr()]["alpha"]
	count := s.dirtyCount
	s.Unlock()
	require.Contains(t, got.MsgIDs, chat1.MessageID(2), "requeue overwrote a newer pending write")
	require.Equal(t, 1, count, "requeue double-counted an entry that was already pending")
}

// Remove must route metadata through the overlay, not straight to disk: writing
// it directly publishes it ahead of the tokens for any SeenIDs an in-flight Add
// has put on the same live object.
func TestRemoveRoutesMetadataThroughOverlay(t *testing.T) {
	ctx, s, disk, convID := setupFlushTestStore(t, "remove-ordering")

	msg := textMsgForTest(3, "hello world")
	require.NoError(t, s.Add(ctx, convID, []chat1.MessageUnboxed{msg}))

	require.NoError(t, s.Remove(ctx, convID, []chat1.MessageUnboxed{msg}))

	onDisk, err := disk.GetMetadata(ctx, convID)
	require.NoError(t, err)
	require.Nil(t, onDisk,
		"Remove published metadata to disk directly, ahead of the pending tokens")

	s.Lock()
	_, mdPending := s.dirtyMetadata[convID.ConvIDStr()]
	s.Unlock()
	require.True(t, mdPending, "Remove must leave metadata pending like every other writer")
}

// Add marked a message seen before indexing it, so an indexing failure left the
// message recorded as indexed with no tokens - and nothing re-indexes a message
// the metadata already accounts for.
func TestAddDoesNotMarkSeenWhenIndexingFails(t *testing.T) {
	ctx, s, disk, convID := setupFlushTestStore(t, "add-mark-after-work")

	disk.Lock()
	disk.failTokenGet = fmt.Errorf("cannot read token entry")
	disk.Unlock()

	msg := textMsgForTest(5, "hello world")
	require.Error(t, s.Add(ctx, convID, []chat1.MessageUnboxed{msg}),
		"the indexing failure must surface")

	s.RLock()
	md, err := s.getMetadataLocked(ctx, convID)
	s.RUnlock()
	require.NoError(t, err)
	require.NotContains(t, md.SeenIDs, chat1.MessageID(5),
		"message was marked indexed even though indexing it failed")
}

// IDs the server will never return - deleted messages, gaps that never existed -
// cannot be closed by indexing them, so before MarkSeen they held numMissing
// above zero forever and SelectiveSync re-fetched the same conv every interval.
func TestMarkSeenClosesUnfetchableIDs(t *testing.T) {
	ctx, s, _, convID := setupFlushTestStore(t, "mark-seen-converges")

	conv := chat1.Conversation{
		Metadata: chat1.ConversationMetadata{ConversationID: convID},
		MaxMsgSummaries: []chat1.MessageSummary{
			{MsgID: 3, MessageType: chat1.MessageType_TEXT},
		},
	}

	require.NoError(t, s.Add(ctx, convID, []chat1.MessageUnboxed{
		textMsgForTest(1, "hello world"),
		textMsgForTest(3, "hello world"),
	}))

	missing, err := s.MissingIDForConv(ctx, conv)
	require.NoError(t, err)
	require.Equal(t, []chat1.MessageID{2}, missing,
		"the ID the fetch could not produce must read as missing until marked")

	// The fetch that asked for 2 succeeded and did not return it, so nothing
	// else is coming for that ID.
	require.NoError(t, s.MarkSeen(ctx, convID, []chat1.MessageID{2}))

	missing, err = s.MissingIDForConv(ctx, conv)
	require.NoError(t, err)
	require.Empty(t, missing, "a marked ID must not keep the conv incomplete")

	fullyIndexed, err := s.FullyIndexed(ctx, conv)
	require.NoError(t, err)
	require.True(t, fullyIndexed, "conv must converge once every ID is accounted for")
}

// MarkSeen goes through the pending set like every other metadata mutation; a
// write-through would be undone by a concurrent flush's snapshot.
func TestMarkSeenSurvivesEviction(t *testing.T) {
	ctx, s, _, convID := setupFlushTestStore(t, "mark-seen-eviction")

	require.NoError(t, s.MarkSeen(ctx, convID, []chat1.MessageID{9}))
	s.mdCache.Purge()

	s.RLock()
	md, err := s.getMetadataLocked(ctx, convID)
	s.RUnlock()
	require.NoError(t, err)
	require.Contains(t, md.SeenIDs, chat1.MessageID(9),
		"the mark was lost once the metadata left the cache")
}

func textMsgForTest(id chat1.MessageID, body string) chat1.MessageUnboxed {
	return chat1.NewMessageUnboxedWithValid(chat1.MessageUnboxedValid{
		ClientHeader: chat1.MessageClientHeaderVerified{
			MessageType: chat1.MessageType_TEXT,
			Conv:        chat1.ConversationIDTriple{TopicType: chat1.TopicType_CHAT},
		},
		MessageBody:  chat1.NewMessageBodyWithText(chat1.MessageText{Body: body}),
		ServerHeader: chat1.MessageServerHeader{MessageID: id},
	})
}

// Bumping indexMetadataVersion is how a damaged index gets rebuilt: a conv whose
// metadata claims messages are indexed reads as complete, so nothing revisits
// it and only a version change discards it. That makes the mismatch check
// load-bearing rather than incidental.
func TestStaleVersionEntriesAreDiscarded(t *testing.T) {
	ctx, s, disk, convID := setupFlushTestStore(t, "stale-version")

	staleToken := newTokenEntry()
	staleToken.Version = "1:1"
	staleToken.MsgIDs[7] = chat1.EmptyStruct{}
	require.NoError(t, disk.PutTokenEntry(ctx, convID, "alpha", staleToken))

	staleMd := newIndexMetadata()
	staleMd.Version = "1:1"
	staleMd.SeenIDs[7] = chat1.EmptyStruct{}
	require.NoError(t, disk.PutMetadata(ctx, convID, staleMd))

	s.Lock()
	gotToken, err := s.getTokenEntry(ctx, convID, "alpha")
	s.Unlock()
	require.NoError(t, err)
	require.NotContains(t, gotToken.MsgIDs, chat1.MessageID(7),
		"an entry written by an older index version was served instead of discarded")

	s.RLock()
	gotMd, err := s.getMetadataLocked(ctx, convID)
	s.RUnlock()
	require.NoError(t, err)
	require.NotContains(t, gotMd.SeenIDs, chat1.MessageID(7),
		"stale metadata was kept, so the conv would still read as indexed")
}

// A delete that lands while a flush is writing must survive that flush. Flush
// snapshots under the lock but writes outside it, so a delete applied straight to
// disk in that window is undone by the write that follows and the entry stays
// searchable forever. Queuing the delete instead orders it after the write.
func TestDeleteDuringFlushIsNotResurrected(t *testing.T) {
	ctx, s, disk, convID := setupFlushTestStore(t, "delete-during-flush")

	te := newTokenEntry()
	te.MsgIDs[7] = chat1.EmptyStruct{}
	s.Lock()
	require.NoError(t, s.putTokenEntry(ctx, convID, "alpha", te))
	s.Unlock()

	// delete the entry midway through the flush that is writing it
	disk.Lock()
	disk.onPutToken = func() {
		s.Lock()
		s.deleteTokenEntry(ctx, convID, "alpha")
		s.Unlock()
	}
	disk.Unlock()

	require.NoError(t, s.Flush())
	// that flush writes the value it snapshotted; the delete is pending behind it
	// and must be applied by the next one
	require.NoError(t, s.Flush())

	onDisk, err := disk.GetTokenEntry(ctx, convID, "alpha")
	require.NoError(t, err)
	require.Nil(t, onDisk,
		"a delete issued during a flush was undone by that flush's write")

	s.Lock()
	got, err := s.getTokenEntry(ctx, convID, "alpha")
	s.Unlock()
	require.NoError(t, err)
	require.NotContains(t, got.MsgIDs, chat1.MessageID(7),
		"the resurrected entry is still readable")
}

// A queued delete must be visible to readers immediately, rather than reading
// back the copy that is still on disk until the next flush.
func TestPendingDeleteIsNotReadFromDisk(t *testing.T) {
	ctx, s, disk, convID := setupFlushTestStore(t, "pending-delete-read")

	te := newTokenEntry()
	te.MsgIDs[7] = chat1.EmptyStruct{}
	s.Lock()
	require.NoError(t, s.putTokenEntry(ctx, convID, "alpha", te))
	s.Unlock()
	require.NoError(t, s.Flush())

	onDisk, err := disk.GetTokenEntry(ctx, convID, "alpha")
	require.NoError(t, err)
	require.NotNil(t, onDisk, "precondition: the entry is on disk")

	s.Lock()
	s.deleteTokenEntry(ctx, convID, "alpha")
	got, err := s.getTokenEntry(ctx, convID, "alpha")
	s.Unlock()
	require.NoError(t, err)
	require.NotContains(t, got.MsgIDs, chat1.MessageID(7),
		"a pending delete must not read back the copy still on disk")

	require.NoError(t, s.Flush())
	onDisk, err = disk.GetTokenEntry(ctx, convID, "alpha")
	require.NoError(t, err)
	require.Nil(t, onDisk, "the queued delete never reached disk")
}

// The failure path must not undo a delete: requeue puts unwritten snapshots
// back, and a delete that happened since the snapshot has to win.
func TestRequeueDoesNotResurrectDeletedEntry(t *testing.T) {
	ctx, s, _, convID := setupFlushTestStore(t, "requeue-delete")

	stale := newTokenEntry()
	stale.MsgIDs[7] = chat1.EmptyStruct{}

	// the delete lands after the snapshot was taken
	s.Lock()
	s.deleteTokenEntry(ctx, convID, "alpha")
	s.Unlock()

	s.requeue([]tokenSnapshot{{convID: convID, token: "alpha", entry: stale}}, nil, nil)

	s.Lock()
	entry, ok := s.dirtyTokens[convID.ConvIDStr()]["alpha"]
	s.Unlock()
	require.True(t, ok, "the delete should still be pending")
	require.Nil(t, entry,
		"requeue resurrected an entry that was deleted after the snapshot")
}
