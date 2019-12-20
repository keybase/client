// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package search

import (
	"context"
	"os"
	"path/filepath"
	"sync"

	"github.com/blevesearch/bleve"
	"github.com/blevesearch/bleve/index/store"
	"github.com/blevesearch/bleve/registry"
	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/idutil"
	"github.com/keybase/client/go/kbfs/kbfsmd"
	"github.com/keybase/client/go/kbfs/libfs"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/keybase/client/go/kbfs/tlf"
	kbname "github.com/keybase/client/go/kbun"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/pkg/errors"
)

const (
	textFileType      = "kbfsTextFile"
	htmlFileType      = "kbfsHtmlFile"
	kvstoreName       = "kbfs"
	bleveIndexType    = "upside_down"
	fsIndexStorageDir = "kbfs_index"
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

// Indexer can index and search KBFS TLFs.
type Indexer struct {
	config       libkbfs.Config
	log          logger.Logger
	cancelLoop   context.CancelFunc
	remoteStatus libfs.RemoteStatus

	userChangedCh chan struct{}
	tlfCh         chan tlfMessage
	shutdownCh    chan struct{}

	lock        sync.RWMutex
	index       bleve.Index
	indexConfig libkbfs.Config
}

// NewIndexer creates a new instance of an Indexer.
func NewIndexer(config libkbfs.Config) (*Indexer, error) {
	log := config.MakeLogger("search")
	i := &Indexer{
		config:        config,
		log:           log,
		userChangedCh: make(chan struct{}, 1),
		tlfCh:         make(chan tlfMessage, 1000),
		shutdownCh:    make(chan struct{}),
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
	i.index = nil

	return i.indexConfig.Shutdown(ctx)
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
		i.log.CDebugf(ctx, "Not indexing while logged out")
		return nil
	}

	// Create a new Config object for the index data, with a storage
	// root that's unique to this user.
	kbCtx := i.config.KbContext()
	params, err := Params(kbCtx, i.config.StorageRoot(), session.UID)
	if err != nil {
		return err
	}
	ctx, indexConfig, err := Init(
		ctx, kbCtx, params, libkbfs.NewKeybaseServicePassthrough(i.config),
		i.log, i.config.VLogLevel())
	if err != nil {
		return err
	}
	defer func() {
		if err != nil {
			configErr := indexConfig.Shutdown(ctx)
			if configErr != nil {
				i.log.CDebugf(ctx, "Couldn't shutdown config: %+v", configErr)
			}
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
	kvstoreConstructor := func(
		mo store.MergeOperator, _ map[string]interface{}) (
		s store.KVStore, err error) {
		return newBleveLevelDBStore(fs, false, mo)
	}
	registry.RegisterKVStore(kvstoreName, kvstoreConstructor)

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

	i.index = index
	i.indexConfig = indexConfig
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
			}
		}
	}
}

// Shutdown shuts down this indexer.
func (i *Indexer) Shutdown(ctx context.Context) error {
	i.cancelLoop()
	close(i.shutdownCh)

	i.lock.Lock()
	defer i.lock.Unlock()

	return i.closeIndexLocked(ctx)
}
