// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package search

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/blevesearch/bleve"
	"github.com/blevesearch/bleve/index/store"
	"github.com/blevesearch/bleve/registry"
	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/idutil"
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
	ldberrors "github.com/syndtr/goleveldb/leveldb/errors"
	billy "gopkg.in/src-d/go-billy.v4"
)

const (
	textFileType      = "kbfsTextFile"
	htmlFileType      = "kbfsHTMLFile"
	kvstoreNamePrefix = "kbfs"
	bleveIndexType    = "upside_down"
	fsIndexStorageDir = "kbfs_index"
	docDbDir          = "docdb"
	nameDocIDPrefix   = "name_"
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
	kvstoreName  string

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
		userChangedCh: make(chan struct{}, 1),
		tlfCh:         make(chan tlfMessage, 1000),
		shutdownCh:    make(chan struct{}),
		indexReadyCh:  make(chan struct{}),
	}

	ctx, cancel := context.WithCancel(i.makeContext(context.Background()))
	i.cancelLoop = cancel
	go i.loop(ctx)
	err := config.Notifier().RegisterForSyncedTlfs(i)
	if err != nil {
		return nil, err
	}
	return i, nil
}

// NewIndexer creates a new instance of an Indexer.
func NewIndexer(config libkbfs.Config) (*Indexer, error) {
	return newIndexerWithConfigInit(
		config, defaultInitConfig, kvstoreNamePrefix)
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

		m := tlfMessage{tlfID, rev, keybase1.FolderSyncMode_ENABLED}
		select {
		case i.tlfCh <- m:
		default:
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
	m := tlfMessage{tlfID, kbfsmd.RevisionUninitialized, newMode}
	select {
	case i.tlfCh <- m:
	default:
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

func (i *Indexer) indexChildWithPtrAndNode(
	ctx context.Context, parentNode libkbfs.Node, parentDocID string,
	childName data.PathPartString, oldPtr, newPtr data.BlockPointer,
	n libkbfs.Node, ei data.EntryInfo, nextDocID string,
	revision kbfsmd.Revision) (usedDocID bool, err error) {
	if i.blocksDb == nil {
		return false, errors.New("No indexed blocks db")
	}

	// If the new pointer has already been indexed, skip indexing it again.
	v, _, err := i.blocksDb.Get(ctx, newPtr)
	switch errors.Cause(err) {
	case nil:
		if v == currentIndexedBlocksDbVersion {
			i.log.CDebugf(ctx, "%s already indexed; skipping", newPtr)
			return false, nil
		}
	case ldberrors.ErrNotFound:
	default:
		return false, err
	}

	var docID string
	if oldPtr != data.ZeroPtr {
		_, docID, err = i.blocksDb.Get(ctx, oldPtr)
		switch errors.Cause(err) {
		case nil:
		case ldberrors.ErrNotFound:
			return false, errors.WithStack(OldPtrNotFound{oldPtr})
		default:
			return false, err
		}
	} else {
		usedDocID = true
		docID = nextDocID
	}

	defer func() {
		if err != nil {
			return
		}

		// Put the docID into the DB after a successful indexing.
		tlfID := n.GetFolderBranch().Tlf
		putErr := i.blocksDb.Put(
			ctx, tlfID, newPtr, currentIndexedBlocksDbVersion, docID)
		if putErr != nil {
			err = putErr
			return
		}

		// Save the docID -> parentDocID mapping.
		putErr = i.docDb.Put(ctx, docID, parentDocID, childName.Plaintext())
		if putErr != nil {
			err = putErr
			return
		}

		// Delete the old pointer if one was given.
		if oldPtr != data.ZeroPtr {
			delErr := i.blocksDb.Delete(ctx, tlfID, oldPtr)
			if err != nil {
				err = delErr
				return
			}
		}
	}()

	// Get the content type and create a document based on that type.
	d, nameD, err := makeDoc(
		ctx, i.config, n, ei, revision, time.Unix(0, ei.Mtime))
	if err != nil {
		return false, err
	}

	i.lock.RLock()
	defer i.lock.RUnlock()
	if i.index == nil {
		return false, errors.New("Index not loaded")
	}

	b := i.index.NewBatch()

	if d != nil {
		err = b.Index(docID, d)
		if err != nil {
			return false, err
		}
	}
	err = b.Index(nameDocID(docID), nameD)
	if err != nil {
		return false, err
	}

	err = i.index.Batch(b)
	if err != nil {
		return false, err
	}

	return usedDocID, nil
}

func (i *Indexer) indexChild(
	ctx context.Context, parentNode libkbfs.Node, parentDocID string,
	childName data.PathPartString, nextDocID string,
	revision kbfsmd.Revision) (usedDocID bool, err error) {
	ptr, n, ei, err := i.getCurrentPtrAndNode(ctx, parentNode, childName)
	if err != nil {
		return false, err
	}

	return i.indexChildWithPtrAndNode(
		ctx, parentNode, parentDocID, childName, data.ZeroPtr, ptr, n, ei,
		nextDocID, revision)
}

func (i *Indexer) updateChild(
	ctx context.Context, parentNode libkbfs.Node, parentDocID string,
	childName data.PathPartString, oldPtr data.BlockPointer,
	revision kbfsmd.Revision) (err error) {
	newPtr, n, ei, err := i.getCurrentPtrAndNode(ctx, parentNode, childName)
	if err != nil {
		return err
	}

	usedDocID, err := i.indexChildWithPtrAndNode(
		ctx, parentNode, parentDocID, childName, oldPtr, newPtr, n, ei,
		"" /* should get picked up from DB, not from this param*/, revision)
	if err != nil {
		return err
	}
	if usedDocID {
		panic(fmt.Sprintf("Index update %s (%s->%s) used passed-in doc "+
			"ID incorrectly", childName, oldPtr, newPtr))
	}
	return nil
}

func (i *Indexer) renameChild(
	ctx context.Context, parentNode libkbfs.Node, parentDocID string,
	childName data.PathPartString, revision kbfsmd.Revision) (err error) {
	ptr, n, ei, err := i.getCurrentPtrAndNode(ctx, parentNode, childName)
	if err != nil {
		return err
	}

	if i.blocksDb == nil {
		return errors.New("No indexed blocks db")
	}

	// Get the docID.
	_, docID, err := i.blocksDb.Get(ctx, ptr)
	if err != nil {
		// Treat "not found" errors as real errors, since a rename
		// implies that the doc should have already been indexed.
		return err
	}

	// Rename the doc ID for the new name.
	newNameDoc := makeNameDoc(n, revision, time.Unix(0, ei.Mtime))
	err = i.index.Index(nameDocID(docID), newNameDoc)
	if err != nil {
		return err
	}

	// Fix the child name in the doc db.
	return i.docDb.Put(ctx, docID, parentDocID, childName.Plaintext())
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
		_, docID, err = i.blocksDb.Get(ctx, unref)
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

	i.lock.RLock()
	defer i.lock.RUnlock()

	err = i.index.Delete(docID)
	if err != nil {
		return err
	}

	err = i.docDb.Delete(ctx, docID)
	if err != nil {
		return err
	}

	return i.blocksDb.Delete(ctx, tlfID, unref)
}

func (i *Indexer) fsForRev(
	ctx context.Context, tlfID tlf.ID, rev kbfsmd.Revision) (*libfs.FS, error) {
	if rev == kbfsmd.RevisionUninitialized {
		return nil, errors.New("No revision provided")
	}
	branch := data.MakeRevBranchName(rev)

	md, err := i.config.MDOps().GetForTLF(ctx, tlfID, nil)
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
		usedDocID, err := i.indexChild(
			ctx, dir, dirDocID, name, ids[currDocID], rev)
		if err != nil {
			return err
		}
		var docID string
		if usedDocID {
			docID = ids[currDocID]
			currDocID++
		} else {
			return errors.Errorf(
				"Didn't use new doc ID for newly indexed child %s", name)
		}

		if child.Type == data.Dir {
			n, _, err := i.config.KBFSOps().Lookup(ctx, dir, name)
			if err != nil {
				return err
			}

			err = i.indexNewlySyncedTlfDir(ctx, n, docID, rev)
			if err != nil {
				return err
			}
		}
	}
	return nil
}

func (i *Indexer) indexNewlySyncedTlf(
	ctx context.Context, fs *libfs.FS, rev kbfsmd.Revision) error {
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

	// No need to index the root dir, since it doesn't really have a name.
	return i.indexNewlySyncedTlfDir(ctx, root, id, rev)
}

func (i *Indexer) doFullIndex(
	ctx context.Context, m tlfMessage, rev kbfsmd.Revision) (err error) {
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

func (i *Indexer) handleTlfMessage(ctx context.Context, m tlfMessage) error {
	defer i.indexWG.Done()

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

	if startedRev != kbfsmd.RevisionUninitialized && startedRev != rev {
		// We've started indexing a particular revision already; we
		// need to continue on at that revision, or risk confusing the
		// index.  But re-add the message for this revision later.
		i.log.CDebugf(ctx, "Finishing incomplete index for revision %s for "+
			"TLF %s, before indexing the requested revision %d",
			startedRev, m.tlfID, rev)
		rev = startedRev
		select {
		case i.tlfCh <- m:
		default:
			i.log.CDebugf(
				context.Background(), "Couldn't send TLF message for %s/%d",
				m.tlfID, rev)
		}
	}

	if indexedRev != kbfsmd.RevisionUninitialized {
		// TODO(HOTPOT-1495): Do a partial update based on the MD
		// revision changes (assuming we haven't missed so many
		// revisions that we should just force a fast-forward).
		i.log.CDebugf(
			ctx, "Ignoring incremental update for %s (HOTPOT-1495)", m.tlfID)
		return nil
	}

	err = i.doFullIndex(ctx, m, rev)
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
	i.log.CDebugf(ctx, "Starting indexing loop")
	defer i.log.CDebugf(ctx, "Ending index loop")

	i.remoteStatus.Init(ctx, i.log, i.config, i)

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
