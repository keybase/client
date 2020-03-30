// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package search

import (
	"context"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/blevesearch/bleve"
	"github.com/blevesearch/bleve/index/store"
	"github.com/blevesearch/bleve/registry"
	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/idutil"
	"github.com/keybase/client/go/kbfs/ioutil"
	"github.com/keybase/client/go/kbfs/kbfsmd"
	"github.com/keybase/client/go/kbfs/kbfssync"
	"github.com/keybase/client/go/kbfs/libcontext"
	"github.com/keybase/client/go/kbfs/libfs"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/keybase/client/go/kbfs/tlf"
	kbname "github.com/keybase/client/go/kbun"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/pkg/errors"
	"github.com/shirou/gopsutil/mem"
	ldberrors "github.com/syndtr/goleveldb/leveldb/errors"
	billy "gopkg.in/src-d/go-billy.v4"
)

const (
	textFileType          = "kbfsTextFile"
	htmlFileType          = "kbfsHTMLFile"
	kvstoreNamePrefix     = "kbfs"
	bleveIndexType        = "upside_down"
	fsIndexStorageDir     = "kbfs_index"
	docDbDir              = "docdb"
	nameDocIDPrefix       = "name_"
	defaultIndexBatchSize = 10 * 1024 * 1024 // 10 MB
	indexBatchSizeFactor  = 500
	minIndexBatchSize     = 1 * 1024 * 1024   // 1 MB
	maxIndexBatchSize     = 100 * 1024 * 1024 // 100 MB
)

const (
	// CtxOpID is the display name for the unique operation index ID tag.
	ctxOpID = "IID"
)

// CtxTagKey is the type used for unique context tags
type ctxTagKey int

const (
	// CtxIDKey is the type of the tag for unique operation IDs.
	ctxIDKey ctxTagKey = iota
)

type tlfMessage struct {
	tlfID tlf.ID
	rev   kbfsmd.Revision
	mode  keybase1.FolderSyncMode
}

type initFn func(
	context.Context, libkbfs.Config, idutil.SessionInfo, logger.Logger) (
	context.Context, libkbfs.Config, func(context.Context) error, error)

// Indexer can index and search KBFS TLFs.
type Indexer struct {
	config       libkbfs.Config
	log          logger.Logger
	cancelLoop   context.CancelFunc
	remoteStatus libfs.RemoteStatus
	configInitFn initFn
	once         sync.Once
	indexWG      kbfssync.RepeatedWaitGroup
	loopWG       kbfssync.RepeatedWaitGroup
	kvstoreName  string
	fullIndexCB  func() error // helpful for testing
	progress     *Progress

	userChangedCh chan struct{}
	tlfCh         chan tlfMessage
	shutdownCh    chan struct{}

	lock           sync.RWMutex
	index          bleve.Index
	indexConfig    libkbfs.Config
	configShutdown func(context.Context) error
	blocksDb       *IndexedBlockDb
	tlfDb          *IndexedTlfDb
	docDb          *DocDb
	indexReadyCh   chan struct{}
	cancelCtx      context.CancelFunc
	fs             billy.Filesystem
	currBatch      *bleve.Batch
	currBatchSize  uint64
	batchFns       []func() error
}

func newIndexerWithConfigInit(config libkbfs.Config, configInitFn initFn,
	kvstoreName string) (
	*Indexer, error) {
	log := config.MakeLogger("search")
	i := &Indexer{
		config:        config,
		log:           log,
		configInitFn:  configInitFn,
		kvstoreName:   kvstoreName,
		progress:      NewProgress(config.Clock()),
		userChangedCh: make(chan struct{}, 1),
		tlfCh:         make(chan tlfMessage, 1000),
		shutdownCh:    make(chan struct{}),
		indexReadyCh:  make(chan struct{}),
	}

	i.startLoop()
	return i, nil
}

// NewIndexer creates a new instance of an Indexer.
func NewIndexer(config libkbfs.Config) (*Indexer, error) {
	return newIndexerWithConfigInit(
		config, defaultInitConfig, kvstoreNamePrefix)
}

func (i *Indexer) startLoop() {
	ctx, cancel := context.WithCancel(i.makeContext(context.Background()))
	i.cancelLoop = cancel
	i.loopWG.Add(1)
	go i.loop(ctx)
}

func (i *Indexer) makeContext(ctx context.Context) context.Context {
	return libkbfs.CtxWithRandomIDReplayable(ctx, ctxIDKey, ctxOpID, i.log)
}

func (i *Indexer) closeIndexLocked(ctx context.Context) error {
	if i.index == nil {
		return nil
	}

	err := i.index.Close()
	if err != nil {
		return err
	}

	// If the ready channel has already been closed, make a new one.
	select {
	case <-i.indexReadyCh:
		i.indexReadyCh = make(chan struct{})
	default:
	}

	i.blocksDb.Shutdown(ctx)
	i.tlfDb.Shutdown(ctx)
	i.docDb.Shutdown(ctx)

	shutdownErr := i.configShutdown(ctx)
	i.index = nil
	i.indexConfig = nil
	i.blocksDb = nil
	i.docDb = nil
	i.tlfDb = nil
	i.cancelCtx()
	return shutdownErr
}

func defaultInitConfig(
	ctx context.Context, config libkbfs.Config, session idutil.SessionInfo,
	log logger.Logger) (
	newCtx context.Context, newConfig libkbfs.Config,
	shutdownFn func(context.Context) error, err error) {
	kbCtx := config.KbContext()
	params, err := Params(kbCtx, config.StorageRoot(), session.UID)
	if err != nil {
		return nil, nil, nil, err
	}
	newCtx, newConfig, err = Init(
		ctx, kbCtx, params, libkbfs.NewKeybaseServicePassthrough(config),
		log, config.VLogLevel())
	if err != nil {
		return nil, nil, nil, err
	}

	return newCtx, newConfig, newConfig.Shutdown, err
}

func (i *Indexer) loadIndex(ctx context.Context) (err error) {
	i.log.CDebugf(ctx, "Loading index")
	defer func() { i.log.CDebugf(ctx, "Done loading index: %+v", err) }()
	i.lock.Lock()
	defer i.lock.Unlock()

	err = i.closeIndexLocked(ctx)
	if err != nil {
		return err
	}

	session, err := idutil.GetCurrentSessionIfPossible(
		ctx, i.config.KBPKI(), true)
	if err != nil {
		return err
	}
	if session.Name == "" {
		return nil
	}

	// Create a new Config object for the index data, with a storage
	// root that's unique to this user.
	ctx, indexConfig, configShutdown, err := i.configInitFn(
		ctx, i.config, session, i.log)
	if err != nil {
		return err
	}
	cancelCtx := func() {
		_ = libcontext.CleanupCancellationDelayer(ctx)
	}
	defer func() {
		if err != nil {
			configErr := indexConfig.Shutdown(ctx)
			if configErr != nil {
				i.log.CDebugf(ctx, "Couldn't shutdown config: %+v", configErr)
			}
			cancelCtx()
		}
	}()

	// Store the index in a KBFS private folder for the current user,
	// with all the blocks and MD stored in the storage root created
	// above.  Everything will be encrypted as if it were in the
	// user's own private KBFS folder.
	privateHandle, err := libkbfs.GetHandleFromFolderNameAndType(
		ctx, indexConfig.KBPKI(), indexConfig.MDOps(), indexConfig,
		string(session.Name), tlf.Private)
	if err != nil {
		return err
	}
	fs, err := libfs.NewFS(
		ctx, indexConfig, privateHandle, data.MasterBranch, "", "", 0)
	if err != nil {
		return err
	}
	err = fs.MkdirAll(fsIndexStorageDir, 0400)
	if err != nil {
		return err
	}
	fs, err = fs.ChrootAsLibFS(fsIndexStorageDir)
	if err != nil {
		return err
	}

	// The index itself will use LevelDB storage that writes to the
	// KBFS filesystem object made above.  Register this storage type
	// with Bleve.
	i.fs = fs
	i.once.Do(func() {
		kvstoreConstructor := func(
			mo store.MergeOperator, _ map[string]interface{}) (
			s store.KVStore, err error) {
			return newBleveLevelDBStore(i.fs, false, mo)
		}
		registry.RegisterKVStore(i.kvstoreName, kvstoreConstructor)
	})

	// Create the actual index using this storage type.  Bleve has
	// different calls for new vs. existing indicies, so we first need
	// to check if it exists.  The Bleve LevelDB storage takes a lock,
	// so we don't really need to worry about concurrent KBFS
	// processes here.
	var index bleve.Index
	p := filepath.Join(i.config.StorageRoot(), indexStorageDir, bleveIndexDir)
	_, err = os.Stat(p)
	switch {
	case os.IsNotExist(errors.Cause(err)):
		i.log.CDebugf(ctx, "Creating new index for user %s/%s",
			session.Name, session.UID)

		indexMapping, err := makeIndexMapping()
		if err != nil {
			return err
		}
		index, err = bleve.NewUsing(
			p, indexMapping, bleveIndexType, i.kvstoreName, nil)
		if err != nil {
			return err
		}
	case err == nil:
		i.log.CDebugf(ctx, "Using existing index for user %s/%s",
			session.Name, session.UID)

		index, err = bleve.OpenUsing(p, nil)
		if err != nil {
			return err
		}
	default:
		return err
	}

	// Load the blocks DB.
	blocksDb, err := newIndexedBlockDb(i.config, indexConfig.StorageRoot())
	if err != nil {
		return err
	}

	// Load the TLF DB.
	tlfDb, err := newIndexedTlfDb(i.config, indexConfig.StorageRoot())
	if err != nil {
		return err
	}

	err = fs.MkdirAll(docDbDir, 0600)
	if err != nil {
		return err
	}
	docFS, err := fs.Chroot(docDbDir)
	if err != nil {
		return err
	}
	docDb, err := newDocDb(indexConfig, docFS)
	if err != nil {
		return err
	}

	err = indexConfig.KBFSOps().SyncFromServer(
		ctx, fs.RootNode().GetFolderBranch(), nil)
	if err != nil {
		return err
	}

	i.index = index
	i.indexConfig = indexConfig
	i.configShutdown = configShutdown
	i.blocksDb = blocksDb
	i.tlfDb = tlfDb
	i.docDb = docDb
	i.cancelCtx = cancelCtx
	close(i.indexReadyCh)
	return nil
}

// UserChanged implements the libfs.RemoteStatusUpdater for Indexer.
func (i *Indexer) UserChanged(
	ctx context.Context, oldName, newName kbname.NormalizedUsername) {
	select {
	case i.userChangedCh <- struct{}{}:
	default:
		i.log.CDebugf(ctx, "Dropping user changed notification")
	}
}

var _ libfs.RemoteStatusUpdater = (*Indexer)(nil)

func (i *Indexer) getMDForRev(
	ctx context.Context, tlfID tlf.ID, rev kbfsmd.Revision) (
	md libkbfs.ImmutableRootMetadata, err error) {
	return libkbfs.GetSingleMD(
		ctx, i.config, tlfID, kbfsmd.NullBranchID, rev, kbfsmd.Merged, nil)
}

func (i *Indexer) tlfQueueForProgress(
	ctx context.Context, tlfID tlf.ID, rev kbfsmd.Revision) error {
	md, err := i.getMDForRev(ctx, tlfID, rev)
	if err != nil {
		return err
	}
	// For now assume we will be indexing the entire TLF.  If when
	// we actually start indexing, we figure out that this is an
	// incremental index, we can update it. `DiskUsage` is the
	// encoded, padded size, but it's the best we can easily do
	// right now.
	i.progress.tlfQueue(tlfID, md.DiskUsage())
	return nil
}

// FullSyncStarted implements the libkbfs.SyncedTlfObserver interface
// for Indexer.
func (i *Indexer) FullSyncStarted(
	ctx context.Context, tlfID tlf.ID, rev kbfsmd.Revision,
	waitCh <-chan struct{}) {
	i.log.CDebugf(ctx, "Sync started for %s/%d", tlfID, rev)
	i.indexWG.Add(1)
	go func() {
		select {
		case <-waitCh:
		case <-i.shutdownCh:
			i.indexWG.Done()
			return
		}

		ctx := i.makeContext(context.Background())
		err := i.tlfQueueForProgress(ctx, tlfID, rev)
		if err != nil {
			i.log.CDebugf(
				ctx, "Couldn't enqueue for %s/%s: %+v", tlfID, rev, err)
			i.indexWG.Done()
			return
		}

		m := tlfMessage{tlfID, rev, keybase1.FolderSyncMode_ENABLED}
		select {
		case i.tlfCh <- m:
		default:
			i.progress.tlfUnqueue(tlfID)
			i.indexWG.Done()
			i.log.CDebugf(
				context.Background(), "Couldn't send TLF message for %s/%d",
				tlfID, rev)
		}
	}()
}

// SyncModeChanged implements the libkbfs.SyncedTlfObserver interface
// for Indexer.
func (i *Indexer) SyncModeChanged(
	ctx context.Context, tlfID tlf.ID, newMode keybase1.FolderSyncMode) {
	i.log.CDebugf(ctx, "Sync mode changed for %s to %s", tlfID, newMode)
	i.indexWG.Add(1)

	// Don't enqueue progress for a TLF when the sync mode changes; if
	// the TLF is now being synced, `FullSyncStarted` will also be
	// called.

	m := tlfMessage{tlfID, kbfsmd.RevisionUninitialized, newMode}
	select {
	case i.tlfCh <- m:
	default:
		i.indexWG.Done()
		i.log.CDebugf(
			context.Background(), "Couldn't send TLF message for %s/%s",
			tlfID, newMode)
	}
}

var _ libkbfs.SyncedTlfObserver = (*Indexer)(nil)

func (i *Indexer) getCurrentPtrAndNode(
	ctx context.Context, parentNode libkbfs.Node,
	childName data.PathPartString) (
	ptr data.BlockPointer, n libkbfs.Node, ei data.EntryInfo, err error) {
	n, ei, err = i.config.KBFSOps().Lookup(ctx, parentNode, childName)
	if err != nil {
		return data.ZeroPtr, nil, data.EntryInfo{}, err
	}

	// Symlinks don't have block pointers.
	if n == nil {
		return data.ZeroPtr, nil, ei, nil
	}

	// Let's find the current block ID.
	md, err := i.config.KBFSOps().GetNodeMetadata(ctx, n)
	if err != nil {
		return data.ZeroPtr, nil, data.EntryInfo{}, err
	}
	return md.BlockInfo.BlockPointer, n, ei, nil
}

func nameDocID(docID string) string {
	return nameDocIDPrefix + docID
}

func (i *Indexer) flushBatchLocked(ctx context.Context) error {
	if i.currBatch == nil {
		return nil
	}
	defer func() {
		i.currBatch = nil
		i.batchFns = nil
	}()

	// Flush the old batch.
	i.log.CDebugf(
		ctx, "Flushing a batch of size %d", i.currBatch.TotalDocsSize())
	err := i.index.Batch(i.currBatch)
	if err != nil {
		return err
	}
	for _, f := range i.batchFns {
		err := f()
		if err != nil {
			return err
		}
	}
	return i.blocksDb.ClearMemory()
}

func (i *Indexer) flushBatch(ctx context.Context) error {
	i.lock.Lock()
	defer i.lock.Unlock()
	return i.flushBatchLocked(ctx)
}

func (i *Indexer) refreshBatchLocked(ctx context.Context) error {
	if i.index == nil {
		return errors.New("Index not loaded")
	}
	err := i.flushBatchLocked(ctx)
	if err != nil {
		return err
	}
	i.currBatch = i.index.NewBatch()

	// Try to scale the batch size appropriately, given the current
	// available memory on the system.
	i.currBatchSize = defaultIndexBatchSize
	vmstat, err := mem.VirtualMemory()
	if err == nil {
		// Allow large batches only if there is plenty of available
		// memory.  Bleve allocates a lot of memory per batch (I think
		// maybe 100x+ the batch size), so we need lots of spare
		// overhead.
		allowable := vmstat.Available / indexBatchSizeFactor
		if allowable > maxIndexBatchSize {
			allowable = maxIndexBatchSize
		} else if allowable < minIndexBatchSize {
			allowable = minIndexBatchSize
		}

		i.log.CDebugf(
			ctx, "Setting the indexing batch size to %d "+
				"(available mem = %d)", allowable, vmstat.Available)
		i.currBatchSize = allowable
	}

	return nil
}

func (i *Indexer) refreshBatch(ctx context.Context) error {
	i.lock.Lock()
	defer i.lock.Unlock()
	return i.refreshBatchLocked(ctx)
}

func (i *Indexer) currBatchLocked(ctx context.Context) (*bleve.Batch, error) {
	if i.currBatch == nil {
		return nil, errors.New("No current batch")
	}

	if i.currBatch.TotalDocsSize() > i.currBatchSize {
		err := i.refreshBatchLocked(ctx)
		if err != nil {
			return nil, err
		}
	}
	return i.currBatch, nil
}

func (i *Indexer) checkDone(ctx context.Context) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-i.shutdownCh:
		return errors.New("Shutdown")
	default:
		return nil
	}
}

func (i *Indexer) indexChildWithPtrAndNode(
	ctx context.Context, parentNode libkbfs.Node, parentDocID string,
	childName data.PathPartString, oldPtr, newPtr data.BlockPointer,
	n libkbfs.Node, ei data.EntryInfo, nextDocID string,
	revision kbfsmd.Revision) (dirDoneFn func() error, err error) {
	if i.blocksDb == nil {
		return nil, errors.New("No indexed blocks db")
	}

	if i.fullIndexCB != nil {
		// Error on indexing this node if the callback tells us to
		// (useful for testing).
		err := i.fullIndexCB()
		if err != nil {
			i.log.CDebugf(ctx, "Stopping index due to testing error: %+v", err)
			return nil, err
		}
	}

	err = i.checkDone(ctx)
	if err != nil {
		return nil, err
	}

	defer func() {
		if err == nil {
			// Mark the bytes of this child as indexed.  This is the
			// actual unencrypted size of the entry, which won't match
			// up perfectly with the disk usage, but it's the easiest
			// thing to do for now.
			i.progress.indexedBytes(ei.Size)
		}
	}()

	tlfID := n.GetFolderBranch().Tlf

	// If the new pointer has already been indexed, skip indexing it again.
	v, docID, dirDone, err := i.blocksDb.Get(ctx, newPtr)
	switch errors.Cause(err) {
	case nil:
		if v == currentIndexedBlocksDbVersion {
			i.log.CDebugf(
				ctx, "%s/%s already indexed; skipping (type=%s, dirDone=%t)",
				newPtr, childName, ei.Type, dirDone)
			if ei.Type != data.Dir || dirDone {
				return nil, nil
			}
			return func() error {
				flushFn, err := i.blocksDb.PutMemory(
					ctx, tlfID, newPtr, currentIndexedBlocksDbVersion, docID,
					true)
				if err != nil {
					return err
				}
				i.lock.Lock()
				defer i.lock.Unlock()
				i.batchFns = append(i.batchFns, flushFn)
				return nil
			}, nil
		}
	case ldberrors.ErrNotFound:
	default:
		return nil, err
	}

	if oldPtr != data.ZeroPtr {
		_, docID, _, err = i.blocksDb.Get(ctx, oldPtr)
		switch errors.Cause(err) {
		case nil:
		case ldberrors.ErrNotFound:
			return nil, errors.WithStack(OldPtrNotFound{oldPtr})
		default:
			return nil, err
		}
	} else {
		docID = nextDocID
	}

	dirDoneFn = func() error {
		flushFn, err := i.blocksDb.PutMemory(
			ctx, tlfID, newPtr, currentIndexedBlocksDbVersion, docID, true)
		if err != nil {
			return err
		}
		i.lock.Lock()
		defer i.lock.Unlock()
		i.batchFns = append(i.batchFns, flushFn)
		return nil
	}

	// Get the content type and create a document based on that type.
	d, nameD, err := makeDoc(
		ctx, i.config, n, ei, revision, time.Unix(0, ei.Mtime))
	if err != nil {
		return nil, err
	}

	i.lock.Lock()
	defer i.lock.Unlock()
	if i.index == nil {
		return nil, errors.New("Index not loaded")
	}

	b, err := i.currBatchLocked(ctx)
	if err != nil {
		return nil, err
	}

	if d != nil {
		err = b.Index(docID, d)
		if err != nil {
			return nil, err
		}
	}
	err = b.Index(nameDocID(docID), nameD)
	if err != nil {
		return nil, err
	}

	// Put the docID into the DB after a successful indexing.
	flushFn, err := i.blocksDb.PutMemory(
		ctx, tlfID, newPtr, currentIndexedBlocksDbVersion, docID, false)
	if err != nil {
		return nil, err
	}

	i.batchFns = append(i.batchFns, func() error {
		err := flushFn()
		if err != nil {
			return err
		}

		// Save the docID -> parentDocID mapping.
		err = i.docDb.Put(ctx, docID, parentDocID, childName.Plaintext())
		if err != nil {
			return err
		}

		// Delete the old pointer if one was given.
		if oldPtr != data.ZeroPtr {
			err = i.blocksDb.Delete(ctx, tlfID, oldPtr)
			if err != nil {
				return err
			}
		}

		return nil
	})

	return dirDoneFn, nil
}

func (i *Indexer) indexChild(
	ctx context.Context, parentNode libkbfs.Node, parentDocID string,
	childName data.PathPartString, nextDocID string,
	revision kbfsmd.Revision) (dirDoneFn func() error, err error) {
	ptr, n, ei, err := i.getCurrentPtrAndNode(ctx, parentNode, childName)
	if err != nil {
		return nil, err
	}

	if ptr == data.ZeroPtr {
		// Skip indexing symlinks for now -- they are hard to track
		// since they don't have a BlockPointer to put in the blocksDb.
		return nil, nil
	}

	return i.indexChildWithPtrAndNode(
		ctx, parentNode, parentDocID, childName, data.ZeroPtr, ptr, n, ei,
		nextDocID, revision)
}

func (i *Indexer) updateChild(
	ctx context.Context, parentNode libkbfs.Node, parentDocID string,
	childName data.PathPartString, oldPtr data.BlockPointer,
	revision kbfsmd.Revision) (dirDoneFn func() error, err error) {
	newPtr, n, ei, err := i.getCurrentPtrAndNode(ctx, parentNode, childName)
	if err != nil {
		return nil, err
	}

	if newPtr == data.ZeroPtr {
		// Symlinks should never be updated.
		return nil, errors.Errorf("Symlink %s should not be updated", childName)
	}

	return i.indexChildWithPtrAndNode(
		ctx, parentNode, parentDocID, childName, oldPtr, newPtr, n, ei,
		"" /* should get picked up from DB, not from this param*/, revision)
}

func (i *Indexer) renameChild(
	ctx context.Context, parentNode libkbfs.Node, parentDocID string,
	childName data.PathPartString, revision kbfsmd.Revision) (err error) {
	ptr, n, ei, err := i.getCurrentPtrAndNode(ctx, parentNode, childName)
	if err != nil {
		return err
	}

	if ptr == data.ZeroPtr {
		// Ignore symlink renames.
		return nil
	}

	i.log.CDebugf(ctx, "Found %s for child %s", ptr, childName)

	if i.blocksDb == nil {
		return errors.New("No indexed blocks db")
	}

	// Get the docID.
	_, docID, _, err := i.blocksDb.Get(ctx, ptr)
	if err != nil {
		// Treat "not found" errors as real errors, since a rename
		// implies that the doc should have already been indexed.
		return err
	}

	i.lock.Lock()
	defer i.lock.Unlock()

	b, err := i.currBatchLocked(ctx)
	if err != nil {
		return err
	}

	newNameDoc := makeNameDoc(n, revision, time.Unix(0, ei.Mtime))
	err = b.Index(nameDocID(docID), newNameDoc)
	if err != nil {
		return err
	}

	// Rename the doc ID for the new name.
	i.batchFns = append(
		i.batchFns,
		func() error {
			// Fix the child name in the doc db.
			return i.docDb.Put(ctx, docID, parentDocID, childName.Plaintext())
		})

	return nil
}

func (i *Indexer) deleteFromUnrefs(
	ctx context.Context, tlfID tlf.ID, unrefs []data.BlockPointer) (err error) {
	if i.blocksDb == nil {
		return errors.New("No indexed blocks db")
	}

	// Find the right doc ID.
	var docID string
	var unref data.BlockPointer
unrefLoop:
	for _, unref = range unrefs {
		_, docID, _, err = i.blocksDb.Get(ctx, unref)
		switch errors.Cause(err) {
		case nil:
			break unrefLoop
		case ldberrors.ErrNotFound:
			continue
		default:
			return err
		}
	}
	if docID == "" {
		i.log.CDebugf(ctx, "Couldn't find doc ID for deleted ptrs %v", unrefs)
		return nil
	}

	i.lock.Lock()
	defer i.lock.Unlock()

	b, err := i.currBatchLocked(ctx)
	if err != nil {
		return err
	}

	b.Delete(docID)
	b.Delete(nameDocID(docID))
	err = i.index.Batch(b)
	if err != nil {
		return err
	}

	i.batchFns = append(
		i.batchFns,
		func() error { return i.docDb.Delete(ctx, docID) },
		func() error { return i.blocksDb.Delete(ctx, tlfID, unref) },
	)
	return nil
}

func (i *Indexer) fsForRev(
	ctx context.Context, tlfID tlf.ID, rev kbfsmd.Revision) (*libfs.FS, error) {
	if rev == kbfsmd.RevisionUninitialized {
		return nil, errors.New("No revision provided")
	}
	branch := data.MakeRevBranchName(rev)

	md, err := i.getMDForRev(ctx, tlfID, rev)
	if err != nil {
		return nil, err
	}

	h := md.GetTlfHandle()
	return libfs.NewReadonlyFS(
		ctx, i.config, h, branch, "", "", keybase1.MDPriorityNormal)
}

func (i *Indexer) indexNewlySyncedTlfDir(
	ctx context.Context, dir libkbfs.Node,
	dirDocID string, rev kbfsmd.Revision) error {
	err := i.checkDone(ctx)
	if err != nil {
		return err
	}

	children, err := i.config.KBFSOps().GetDirChildren(ctx, dir)
	if err != nil {
		return err
	}

	if len(children) == 0 {
		// Nothing to do.
		return nil
	}

	ids, err := i.blocksDb.GetNextDocIDs(len(children))
	if err != nil {
		return err
	}

	currDocID := 0
	for name, child := range children {
		dirDoneFn, err := i.indexChild(
			ctx, dir, dirDocID, name, ids[currDocID], rev)
		if err != nil {
			return err
		}
		docID := ids[currDocID]
		currDocID++

		if child.Type == data.Dir && dirDoneFn != nil {
			n, _, err := i.config.KBFSOps().Lookup(ctx, dir, name)
			if err != nil {
				return err
			}

			err = i.indexNewlySyncedTlfDir(ctx, n, docID, rev)
			if err != nil {
				return err
			}

			err = dirDoneFn()
			if err != nil {
				return err
			}
		}
	}
	return nil
}

func (i *Indexer) recordUpdatedNodePtr(
	ctx context.Context, node libkbfs.Node, rev kbfsmd.Revision, docID string,
	oldPtr data.BlockPointer) (dirDoneFn func() error, err error) {
	md, err := i.config.KBFSOps().GetNodeMetadata(ctx, node)
	if err != nil {
		return nil, err
	}
	tlfID := node.GetFolderBranch().Tlf
	i.lock.Lock()
	defer i.lock.Unlock()
	flushFn, err := i.blocksDb.PutMemory(
		ctx, tlfID, md.BlockInfo.BlockPointer,
		currentIndexedBlocksDbVersion, docID, false)
	if err != nil {
		return nil, err
	}
	i.batchFns = append(i.batchFns, flushFn)

	return func() error {
		flushFn, err := i.blocksDb.PutMemory(
			ctx, tlfID, md.BlockInfo.BlockPointer,
			currentIndexedBlocksDbVersion, docID, true)
		if err != nil {
			return err
		}

		i.lock.Lock()
		defer i.lock.Unlock()
		i.batchFns = append(i.batchFns, flushFn)

		if oldPtr != data.ZeroPtr {
			err := i.blocksDb.Delete(ctx, tlfID, oldPtr)
			if err != nil {
				return err
			}
		}
		return nil
	}, nil
}

func (i *Indexer) indexNewlySyncedTlf(
	ctx context.Context, fs *libfs.FS, rev kbfsmd.Revision) (err error) {
	root := fs.RootNode()

	ids, err := i.blocksDb.GetNextDocIDs(1)
	if err != nil {
		return err
	}
	id := ids[0]
	err = i.docDb.Put(ctx, id, "", fs.Handle().GetCanonicalPath())
	if err != nil {
		return err
	}

	err = i.refreshBatch(ctx)
	if err != nil {
		return err
	}

	defer func() {
		flushErr := i.flushBatch(ctx)
		if flushErr == nil {
			return
		}
		i.log.CDebugf(ctx, "Error flushing batch: %+v", flushErr)
		if err == nil {
			err = flushErr
		}
	}()

	// Record the docID for the root node. But no need to index the
	// root dir, since it doesn't really have a name.
	dirDoneFn, err := i.recordUpdatedNodePtr(ctx, root, rev, id, data.ZeroPtr)
	if err != nil {
		return err
	}
	defer func() {
		if err != nil {
			return
		}

		err = dirDoneFn()
	}()

	return i.indexNewlySyncedTlfDir(ctx, root, id, rev)
}

func (i *Indexer) doFullIndex(
	ctx context.Context, m tlfMessage, rev kbfsmd.Revision) (err error) {
	i.log.CDebugf(ctx, "Doing full index of %s at rev %d", m.tlfID, rev)
	defer func() {
		i.log.CDebugf(
			ctx, "Finished full index of %s at rev %d: %+v", m.tlfID, rev, err)
	}()

	md, err := i.getMDForRev(ctx, m.tlfID, rev)
	if err != nil {
		return err
	}
	err = i.progress.startIndex(m.tlfID, md.DiskUsage(), indexFull)
	if err != nil {
		return err
	}
	defer func() {
		progErr := i.progress.finishIndex(m.tlfID)
		if progErr != nil {
			i.log.CDebugf(ctx, "Couldn't finish index: %+v", err)
		}
	}()

	fs, err := i.fsForRev(ctx, m.tlfID, rev)
	if err != nil {
		return err
	}

	// Check whether this revision has been garbage-collected yet.  If
	// so, return a typed error.  The caller may wish to clear out the
	// current index for the TLF in this case.
	status, _, err := i.config.KBFSOps().FolderStatus(
		ctx, fs.RootNode().GetFolderBranch())
	if err != nil {
		return err
	}
	if rev <= status.LastGCRevision {
		return errors.WithStack(
			RevisionGCdError{m.tlfID, rev, status.LastGCRevision})
	}

	// Record that we've started a full sync for this TLF at this
	// revision.  If it gets interrupted, it should be resumed on the
	// next restart of the indexer.  There is no `indexedRev`, because
	// this function should only be called when a full index is
	// needed.
	err = i.tlfDb.Put(ctx, m.tlfID, kbfsmd.RevisionUninitialized, rev)
	if err != nil {
		return err
	}

	defer func() {
		if err != nil {
			return
		}

		// After a successful indexing, mark the revision as fully indexed.
		err = i.tlfDb.Put(ctx, m.tlfID, rev, kbfsmd.RevisionUninitialized)
	}()

	return i.indexNewlySyncedTlf(ctx, fs, rev)
}

func (i *Indexer) doIncrementalIndex(
	ctx context.Context, m tlfMessage, indexedRev, newRev kbfsmd.Revision) (
	err error) {
	i.log.CDebugf(
		ctx, "Incremental index %s: %d -> %d", m.tlfID, indexedRev, newRev)
	defer func() {
		i.log.CDebugf(ctx, "Incremental index %s: %d -> %d: %+v",
			m.tlfID, indexedRev, newRev, err)
	}()

	// Gather list of changes after indexedRev, up to and including newRev.
	changes, refSize, err := libkbfs.GetChangesBetweenRevisions(
		ctx, i.config, m.tlfID, indexedRev, newRev)
	if err != nil {
		return err
	}

	err = i.progress.startIndex(m.tlfID, refSize, indexIncremental)
	if err != nil {
		return err
	}
	defer func() {
		progErr := i.progress.finishIndex(m.tlfID)
		if progErr != nil {
			i.log.CDebugf(ctx, "Couldn't finish index: %+v", err)
		}
	}()

	// Sort by path length, to make sure we process directories before
	// their children.
	sort.Slice(changes, func(i, j int) bool {
		return len(changes[i].CurrPath.Path) < len(changes[j].CurrPath.Path)
	})

	fs, err := i.fsForRev(ctx, m.tlfID, newRev)
	if err != nil {
		return err
	}

	// Save newRev as the started revision.
	err = i.tlfDb.Put(ctx, m.tlfID, indexedRev, newRev)
	if err != nil {
		return err
	}

	defer func() {
		if err != nil {
			return
		}

		// After a successful indexing, mark the revision as fully indexed.
		err = i.tlfDb.Put(ctx, m.tlfID, newRev, kbfsmd.RevisionUninitialized)
	}()

	err = i.refreshBatch(ctx)
	if err != nil {
		return err
	}

	defer func() {
		flushErr := i.flushBatch(ctx)
		if flushErr == nil {
			return
		}
		i.log.CDebugf(ctx, "Error flushing batch: %+v", flushErr)
		if err == nil {
			err = flushErr
		}
	}()

	newChanges := 0
	for _, change := range changes {
		if change.IsNew {
			newChanges++
		}
	}
	ids, err := i.blocksDb.GetNextDocIDs(newChanges)
	if err != nil {
		return err
	}
	currID := 0

	var dirDoneFns []func() error
	if len(changes) > 0 {
		// Update the root pointer first; it doesn't require re-indexing.
		oldPtr := changes[0].OldPtr
		changes = changes[1:]
		doUpdate := true
		_, docID, _, err := i.blocksDb.Get(ctx, oldPtr)
		switch errors.Cause(err) {
		case nil:
		case ldberrors.ErrNotFound:
			// The update already happened.
			doUpdate = false
		default:
			return err
		}

		if doUpdate {
			dirDoneFn, err := i.recordUpdatedNodePtr(
				ctx, fs.RootNode(), newRev, docID, oldPtr)
			if err != nil {
				return err
			}
			defer func() {
				if err != nil {
					return
				}

				err = dirDoneFn()
			}()
		}
	}

	// Iterate through each change and call the appropriate index
	// function for it.
	for _, change := range changes {
		err := i.checkDone(ctx)
		if err != nil {
			return err
		}

		plainPath, _ := change.CurrPath.PlaintextSansTlf()
		dir, _ := path.Split(plainPath)
		dirFS, err := fs.ChrootAsLibFS(path.Clean(dir))
		if err != nil {
			return err
		}

		dirNode := dirFS.RootNode()
		md, err := i.config.KBFSOps().GetNodeMetadata(ctx, dirNode)
		if err != nil {
			return err
		}
		_, dirDocID, _, err := i.blocksDb.Get(ctx, md.BlockInfo.BlockPointer)
		if err != nil {
			return err
		}

		switch change.Type {
		case libkbfs.ChangeTypeWrite:
			var dirDoneFn func() error
			if change.IsNew {
				id := ids[currID]
				currID++
				dirDoneFn, err = i.indexChild(
					ctx, dirNode, dirDocID, change.CurrPath.TailName(),
					id, newRev)
			} else {
				dirDoneFn, err = i.updateChild(
					ctx, dirNode, dirDocID, change.CurrPath.TailName(),
					change.OldPtr, newRev)
				switch errors.Cause(err).(type) {
				case OldPtrNotFound:
					// Already updated.
					err = nil
				default:
				}
			}
			if err != nil {
				return err
			}
			if dirDoneFn != nil {
				dirDoneFns = append(dirDoneFns, dirDoneFn)
			}
		case libkbfs.ChangeTypeRename:
			err := i.renameChild(
				ctx, dirNode, dirDocID, change.CurrPath.TailName(), newRev)
			if err != nil {
				return err
			}
		case libkbfs.ChangeTypeDelete:
			err := i.deleteFromUnrefs(ctx, m.tlfID, change.UnrefsForDelete)
			if err != nil {
				return err
			}
		default:
			i.log.CDebugf(ctx, "Ignoring unknown change type %s", change.Type)
			continue
		}
	}

	// Finish all the dirs at the end, since we're not processing them
	// recursively.
	for _, f := range dirDoneFns {
		err := f()
		if err != nil {
			return err
		}
	}

	return nil
}

func (i *Indexer) handleTlfMessage(ctx context.Context, m tlfMessage) error {
	defer i.indexWG.Done()

	doUnqueue := true
	defer func() {
		if doUnqueue {
			// We didn't end up indexing this TLF after all.
			i.progress.tlfUnqueue(m.tlfID)
		}
	}()

	// Figure out which revision to lock to, for this
	// indexing scan.
	rev := m.rev
	if rev == kbfsmd.RevisionUninitialized {
		// TODO(HOTPOT-1504) -- remove indexing if the
		// mode is no longer synced.
		return nil
	}

	indexedRev, startedRev, err := i.tlfDb.Get(ctx, m.tlfID)
	switch errors.Cause(err) {
	case nil:
	case ldberrors.ErrNotFound:
	default:
		return err
	}

	if rev <= indexedRev {
		// No need to re-index this.
		return nil
	}

	if startedRev != kbfsmd.RevisionUninitialized && startedRev != rev {
		// We've started indexing a particular revision already; we
		// need to continue on at that revision, or risk confusing the
		// index.  But re-add the message for this revision later.
		i.log.CDebugf(ctx, "Finishing incomplete index for revision %s for "+
			"TLF %s, before indexing the requested revision %d",
			startedRev, m.tlfID, rev)
		rev = startedRev
		i.indexWG.Add(1)
		select {
		case i.tlfCh <- m:
		default:
			i.indexWG.Done()
			i.log.CDebugf(
				context.Background(), "Couldn't send TLF message for %s/%d",
				m.tlfID, m.rev)
		}
	}

	doUnqueue = false
	if indexedRev != kbfsmd.RevisionUninitialized {
		err = i.doIncrementalIndex(ctx, m, indexedRev, rev)
	} else {
		err = i.doFullIndex(ctx, m, rev)
	}

	switch errors.Cause(err).(type) {
	case nil:
	case RevisionGCdError:
		// TODO(HOTPOT-1504) -- remove all documents from the index
		// and trigger a new indexing at the latest revision.
		i.log.CDebugf(
			ctx, "Ignoring a GC-revision failure for now (HOTPOT-1504): %+v",
			err)
		return nil
	default:
		return err
	}

	return nil
}

func (i *Indexer) loop(ctx context.Context) {
	defer i.loopWG.Done()

	i.log.CDebugf(ctx, "Starting indexing loop")
	defer i.log.CDebugf(ctx, "Ending index loop")

	// Wait for KBFSOps to be initialized, which might happen later
	// after the indexer.
	for i.config.KBFSOps() == nil {
		time.Sleep(1 * time.Second)
	}
	i.remoteStatus.Init(ctx, i.log, i.config, i)
	for i.config.Notifier() == nil {
		time.Sleep(1 * time.Second)
	}
	err := i.config.Notifier().RegisterForSyncedTlfs(i)
	if err != nil {
		i.log.CWarningf(
			ctx, "Couldn't register for synced TLF updates: %+v", err)
	}

outerLoop:
	for {
		err := i.loadIndex(ctx)
		if err != nil {
			i.log.CDebugf(ctx, "Couldn't load index: %+v", err)
		}

		state := keybase1.MobileAppState_FOREGROUND
		kbCtx := i.config.KbContext()
		for {
			select {
			case <-i.userChangedCh:
				// Re-load the index on each login/logout event.
				i.log.CDebugf(ctx, "User changed")
				continue outerLoop
			case state = <-kbCtx.NextAppStateUpdate(&state):
				// TODO(HOTPOT-1494): once we are doing actual
				// indexing in a separate goroutine, pause/unpause it
				// via a channel send from here.
				for state != keybase1.MobileAppState_FOREGROUND {
					i.log.CDebugf(ctx,
						"Pausing indexing while not foregrounded: state=%s",
						state)
					state = <-kbCtx.NextAppStateUpdate(&state)
				}
				i.log.CDebugf(ctx, "Resuming indexing while foregrounded")
				continue
			case m := <-i.tlfCh:
				ctx := i.makeContext(ctx)
				i.log.CDebugf(
					ctx, "Received TLF message for %s, rev=%d", m.tlfID, m.rev)

				err = i.handleTlfMessage(ctx, m)
				if err != nil {
					i.log.CDebugf(ctx, "Error handling TLF message: %+v", err)
				}
			case <-ctx.Done():
				return
			case <-i.shutdownCh:
				i.cancelLoop()
				return
			}
		}
	}
}

// Shutdown shuts down this indexer.
func (i *Indexer) Shutdown(ctx context.Context) error {
	close(i.shutdownCh)
	err := i.loopWG.Wait(ctx)
	if err != nil {
		return err
	}

	i.lock.Lock()
	defer i.lock.Unlock()

	return i.closeIndexLocked(ctx)
}

func (i *Indexer) waitForIndex(ctx context.Context) error {
	ch := func() <-chan struct{} {
		i.lock.RLock()
		defer i.lock.RUnlock()
		return i.indexReadyCh
	}()

	select {
	case <-ch:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

func (i *Indexer) waitForSyncs(ctx context.Context) error {
	return i.indexWG.Wait(ctx)
}

// Search executes the given query and returns the results in the form
// of full KBFS paths to each hit.  `numResults` limits the number of
// returned results, and `startingResult` indicates the number of
// results that have been previously fetched -- basically it indicates
// the starting index number of the next page of desired results.  The
// return parameter `nextResult` indicates what `startingResult` could
// be set to next time, to get more results, where -1 indicates that
// there are no more results.
func (i *Indexer) Search(
	ctx context.Context, query string, numResults, startingResult int) (
	results []Result, nextResult int, err error) {
	if numResults == 0 {
		return nil, 0, nil
	}

	i.lock.RLock()
	defer i.lock.RUnlock()

	if i.index == nil {
		return nil, 0, errors.New("Index not loaded")
	}

	sQuery := bleve.NewQueryStringQuery(query)
	nextResult = startingResult
	results = make([]Result, 0, numResults)
	usedPaths := make(map[string]bool)
resultLoop:
	for len(results) < numResults {
		req := bleve.NewSearchRequestOptions(
			sQuery, numResults, nextResult, false)
		indexResults, err := i.index.Search(req)
		if err != nil {
			return nil, 0, err
		}

		// Build up the path for each result.
		for j, hit := range indexResults.Hits {
			docID := hit.ID
			var p []string // reversed list of path components
			for docID != "" {
				parentDocID, name, err := i.docDb.Get(
					ctx, strings.TrimPrefix(docID, nameDocIDPrefix))
				if err != nil {
					return nil, 0, err
				}
				p = append(p, name)
				docID = parentDocID
			}

			// Reverse the path name.
			for k := len(p)/2 - 1; k >= 0; k-- {
				opp := len(p) - 1 - k
				p[k], p[opp] = p[opp], p[k]
			}
			fullPath := path.Join(p...)
			if usedPaths[fullPath] {
				continue
			}
			usedPaths[fullPath] = true
			results = append(results, Result{fullPath})

			if len(results) >= numResults {
				nextResult += j + 1
				break resultLoop
			}
		}

		nextResult += len(indexResults.Hits)
		if len(indexResults.Hits) < numResults {
			nextResult = -1
			break
		}
	}

	return results, nextResult, nil
}

// ResetIndex shuts down the current indexer, completely removes its
// on-disk presence, and then restarts it as a blank index.
func (i *Indexer) ResetIndex(ctx context.Context) (err error) {
	i.log.CDebugf(ctx, "Resetting the index")
	defer func() { i.log.CDebugf(ctx, "Done resetting the index: %+v", err) }()

	err = i.Shutdown(ctx)
	if err != nil {
		return err
	}

	dir := filepath.Join(i.config.StorageRoot(), indexStorageDir)
	err = ioutil.RemoveAll(dir)
	if err != nil {
		return err
	}

	i.startLoop()
	return nil
}

// Progress returns the progress instance of this indexer.
func (i *Indexer) Progress() *Progress {
	return i.progress
}
