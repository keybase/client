// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package search

import (
	"context"
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
	kvstoreName       = "kbfs"
	bleveIndexType    = "upside_down"
	fsIndexStorageDir = "kbfs_index"
	docDbDir          = "docdb"
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

	userChangedCh chan struct{}
	tlfCh         chan tlfMessage
	shutdownCh    chan struct{}

	lock           sync.RWMutex
	index          bleve.Index
	indexConfig    libkbfs.Config
	configShutdown func(context.Context) error
	blocksDb       *IndexedBlockDb
	docDb          *DocDb
	indexReadyCh   chan struct{}
	cancelCtx      context.CancelFunc
	fs             billy.Filesystem
}

func newIndexerWithConfigInit(config libkbfs.Config, configInitFn initFn) (
	*Indexer, error) {
	log := config.MakeLogger("search")
	i := &Indexer{
		config:        config,
		log:           log,
		configInitFn:  configInitFn,
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
	return newIndexerWithConfigInit(config, defaultInitConfig)
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
	i.docDb.Shutdown(ctx)

	shutdownErr := i.configShutdown(ctx)
	i.index = nil
	i.indexConfig = nil
	i.blocksDb = nil
	i.docDb = nil
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
		registry.RegisterKVStore(kvstoreName, kvstoreConstructor)
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
			p, indexMapping, bleveIndexType, kvstoreName, nil)
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
	go func() {
		select {
		case <-waitCh:
		case <-i.shutdownCh:
			return
		}

		m := tlfMessage{tlfID, rev, keybase1.FolderSyncMode_ENABLED}
		select {
		case i.tlfCh <- m:
		default:
			i.log.CDebugf(
				context.Background(), "Couldn't send TLF message for %s/%d")
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
			context.Background(), "Couldn't send TLF message for %s/%d")
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

func (i *Indexer) indexChildWithPtrAndNode(
	ctx context.Context, parentNode libkbfs.Node, parentDocID string,
	childName data.PathPartString, ptr data.BlockPointer, n libkbfs.Node,
	ei data.EntryInfo, nextDocID string, revision kbfsmd.Revision) (
	usedDocID bool, err error) {
	if i.blocksDb == nil {
		return false, errors.New("No indexed blocks db")
	}
	ver, docID, err := i.blocksDb.Get(ctx, ptr)
	switch errors.Cause(err) {
	case nil:
	case ldberrors.ErrNotFound:
		usedDocID = true
		docID = nextDocID
	default:
		return false, err
	}

	tlfID := n.GetFolderBranch().Tlf
	defer func() {
		if err != nil {
			return
		}

		// Skip the put if we got the doc ID from the DB, and the
		// version was already up to date.
		if !usedDocID && ver == currentIndexedBlocksDbVersion {
			return
		}

		// Put the docID into the DB after a successful indexing.
		putErr := i.blocksDb.Put(
			ctx, tlfID, ptr, currentIndexedBlocksDbVersion, docID)
		if putErr != nil {
			err = putErr
			return
		}

		// Save the docID -> parentDocID mapping.
		putErr = i.docDb.Put(ctx, docID, parentDocID, childName.Plaintext())
		if putErr != nil {
			err = putErr
		}
	}()

	if n.EntryType() == data.Dir {
		// TODO: just index the child name for a directory.
		return usedDocID, nil
	}

	// Get the content type and create a document based on that type.
	d, err := makeDoc(ctx, i.config, n, ei, revision, time.Unix(0, ei.Mtime))
	if err != nil {
		return false, err
	}

	i.lock.RLock()
	defer i.lock.RUnlock()
	if i.index == nil {
		return false, errors.New("Index not loaded")
	}

	err = i.index.Index(docID, d)
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
		ctx, parentNode, parentDocID, childName, ptr, n, ei, nextDocID,
		revision)
}

func (i *Indexer) updateChild(
	ctx context.Context, parentNode libkbfs.Node, parentDocID string,
	childName data.PathPartString, oldPtr data.BlockPointer,
	revision kbfsmd.Revision) (err error) {
	newPtr, n, ei, err := i.getCurrentPtrAndNode(ctx, parentNode, childName)
	if err != nil {
		return err
	}

	if i.blocksDb == nil {
		return errors.New("No indexed blocks db")
	}

	// Before indexing, move the doc ID over to the new block pointer.
	v, docID, err := i.blocksDb.Get(ctx, oldPtr)
	switch errors.Cause(err) {
	case nil:
	case ldberrors.ErrNotFound:
		// Maybe indexing was interrupted in the past, and we've
		// already moved the doc ID to the new pointer.
		_, docID, err = i.blocksDb.Get(ctx, newPtr)
		if err != nil {
			return err
		}
	default:
		return err
	}

	tlfID := parentNode.GetFolderBranch().Tlf
	err = i.blocksDb.Put(ctx, tlfID, newPtr, v, docID)
	if err != nil {
		return err
	}
	err = i.blocksDb.Delete(ctx, tlfID, oldPtr)
	if err != nil {
		return err
	}

	usedDocID, err := i.indexChildWithPtrAndNode(
		ctx, parentNode, parentDocID, childName, newPtr, n, ei,
		docID /* should get picked up from DB, not from this param*/, revision)
	if err != nil {
		return err
	}
	if usedDocID {
		return errors.Errorf("Index update %s (%s->%s) used passed-in doc "+
			"ID %s incorrectly", childName, oldPtr, newPtr, docID)
	}
	return nil
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
				i.log.CDebugf(ctx, "Received TLF message for %s", m.tlfID)

				// Figure out which revision to lock to, for this
				// indexing scan.
				var rev kbfsmd.Revision
				if m.rev == kbfsmd.RevisionUninitialized {
					// TODO(HOTPOT-1504) -- remove indexing if the
					// mode is no longer synced.
					continue
				}

				_, err := i.fsForRev(ctx, m.tlfID, rev)
				if err != nil {
					i.log.CDebugf(ctx, "Error making FS: %+v", err)
					continue
				}

				// TODO(HOTPOT-1494, HOTPOT-1495): initiate processing
				// pass, using the FS made above.
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
