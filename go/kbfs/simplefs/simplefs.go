// Copyright 2016-2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package simplefs

import (
	"encoding/json"
	"fmt"
	"io"
	"mime"
	"net/http"
	"net/url"
	"os"
	"path"
	stdpath "path"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/env"
	"github.com/keybase/client/go/kbfs/idutil"
	"github.com/keybase/client/go/kbfs/kbfscrypto"
	"github.com/keybase/client/go/kbfs/kbfsmd"
	"github.com/keybase/client/go/kbfs/libcontext"
	"github.com/keybase/client/go/kbfs/libfs"
	"github.com/keybase/client/go/kbfs/libhttpserver"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/kbfs/tlfhandle"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/runtimestats"
	"github.com/pkg/errors"
	"golang.org/x/net/context"
	"golang.org/x/sync/errgroup"
	billy "gopkg.in/src-d/go-billy.v4"
	"gopkg.in/src-d/go-billy.v4/osfs"
)

const (
	// CtxOpID is the display name for the unique operation SimpleFS ID tag.
	ctxOpID = "SFSID"
)

// CtxTagKey is the type used for unique context tags
type ctxTagKey int

const (
	// CtxIDKey is the type of the tag for unique operation IDs.
	ctxIDKey ctxTagKey = iota
)

// simpleFSError wraps errors for SimpleFS
type simpleFSError struct {
	reason string
}

// Error implements the error interface for simpleFSError
func (e simpleFSError) Error() string { return e.reason }

// ToStatus implements the keybase1.ToStatusAble interface for simpleFSError
func (e simpleFSError) ToStatus() keybase1.Status {
	return keybase1.Status{
		Name: e.reason,
		Code: int(keybase1.StatusCode_SCGeneric),
		Desc: e.Error(),
	}
}

var errOnlyRemotePathSupported = simpleFSError{"Only remote paths are supported for this operation"}
var errInvalidRemotePath = simpleFSError{"Invalid remote path"}
var errNoSuchHandle = simpleFSError{"No such handle"}
var errNoResult = simpleFSError{"Async result not found"}

type newFSFunc func(
	context.Context, libkbfs.Config, *tlfhandle.Handle, data.BranchName,
	string, bool) (billy.Filesystem, error)

func defaultNewFS(ctx context.Context, config libkbfs.Config,
	tlfHandle *tlfhandle.Handle, branch data.BranchName, subdir string,
	create bool) (
	billy.Filesystem, error) {
	maker := libfs.NewFS
	if !create {
		maker = libfs.NewFSIfExists
	}
	return maker(
		ctx, config, tlfHandle, branch, subdir, "", keybase1.MDPriorityNormal)
}

// SimpleFS is the simple filesystem rpc layer implementation.
type SimpleFS struct {
	// logs for logging - constant, do not need locking.
	log  logger.Logger
	vlog *libkb.VDebugLog
	// config for the fs - constant, does not need locking.
	config libkbfs.Config
	// The function to call for constructing a new KBFS file system.
	// Overrideable for testing purposes.
	newFS newFSFunc
	// For dumping debug info to the logs.
	idd *libkbfs.ImpatientDebugDumper

	// lock protects handles and inProgress
	lock sync.RWMutex
	// handles contains handles opened by SimpleFSOpen,
	// closed by SimpleFSClose (or SimpleFSCancel) and used
	// by listing, reading and writing.
	handles map[keybase1.OpID]*handle
	// inProgress is for keeping state of operations in progress,
	// values are removed by SimpleFSWait (or SimpleFSCancel).
	inProgress map[keybase1.OpID]*inprogress

	subscribeLock               sync.RWMutex
	subscribeCurrTlfPathFromGUI string
	subscribeCurrFB             data.FolderBranch
	subscribeToEmptyTlf         string

	localHTTPServer *libhttpserver.Server

	subscriber libkbfs.Subscriber

	onlineStatusTracker libkbfs.OnlineStatusTracker

	downloadManager *downloadManager

	httpClient *http.Client
}

type inprogress struct {
	desc     keybase1.OpDescription
	cancel   context.CancelFunc
	done     chan error
	progress keybase1.OpProgress
}

type handle struct {
	file   billy.File
	async  interface{}
	path   keybase1.Path
	cancel context.CancelFunc
}

// make sure the interface is implemented
var _ keybase1.SimpleFSInterface = (*SimpleFS)(nil)

// We need this wrapper because at the time simpleFS is initialized
// KeybaseService is not initialized yet. So just save config here, and get
// the KeybaseService() later.
type subscriptionNotifier struct {
	config libkbfs.Config
}

var _ libkbfs.SubscriptionNotifier = subscriptionNotifier{}

// OnNonPathChange implements the libkbfs.SubscriptionNotifier interface.
func (s subscriptionNotifier) OnPathChange(
	subscriptionID libkbfs.SubscriptionID,
	path string, topic keybase1.PathSubscriptionTopic) {
	ks := s.config.KeybaseService()
	if ks == nil {
		return
	}
	ks.OnPathChange(subscriptionID, path, topic)
}

// OnPathChange implements the libkbfs.SubscriptionNotifier interface.
func (s subscriptionNotifier) OnNonPathChange(
	subscriptionID libkbfs.SubscriptionID,
	topic keybase1.SubscriptionTopic) {
	ks := s.config.KeybaseService()
	if ks == nil {
		return
	}
	ks.OnNonPathChange(subscriptionID, topic)
}

func newSimpleFS(appStateUpdater env.AppStateUpdater, config libkbfs.Config) *SimpleFS {
	log := config.MakeLogger("simplefs")
	var localHTTPServer *libhttpserver.Server
	var err error
	if config.Mode().LocalHTTPServerEnabled() {
		localHTTPServer, err = libhttpserver.New(appStateUpdater, config)
		if err != nil {
			log.Fatalf("initializing localHTTPServer error: %v", err)
		}
	}
	k := &SimpleFS{
		config: config,

		handles:             map[keybase1.OpID]*handle{},
		inProgress:          map[keybase1.OpID]*inprogress{},
		log:                 log,
		vlog:                config.MakeVLogger(log),
		newFS:               defaultNewFS,
		idd:                 libkbfs.NewImpatientDebugDumperForForcedDumps(config),
		localHTTPServer:     localHTTPServer,
		subscriber:          config.SubscriptionManager().Subscriber(subscriptionNotifier{config}),
		onlineStatusTracker: config.SubscriptionManager().OnlineStatusTracker(),
		httpClient:          &http.Client{},
	}
	k.downloadManager = newDownloadManager(k)
	return k
}

// NewSimpleFS creates a new SimpleFS instance.
func NewSimpleFS(appStateUpdater env.AppStateUpdater, config libkbfs.Config) keybase1.SimpleFSInterface {
	return newSimpleFS(appStateUpdater, config)
}

func (k *SimpleFS) makeContext(ctx context.Context) context.Context {
	return libkbfs.CtxWithRandomIDReplayable(ctx, ctxIDKey, ctxOpID, k.log)
}

func (k *SimpleFS) makeContextWithIdentifyBehavior(ctx context.Context, identifyBehavior *keybase1.TLFIdentifyBehavior) (newCtx context.Context, err error) {
	newCtx = libkbfs.CtxWithRandomIDReplayable(ctx, ctxIDKey, ctxOpID, k.log)
	if identifyBehavior != nil {
		newCtx, err = tlfhandle.MakeExtendedIdentify(newCtx, *identifyBehavior)
		if err != nil {
			return nil, err
		}
	}
	return newCtx, nil
}

func getIdentifyBehaviorFromPath(path *keybase1.Path) (*keybase1.TLFIdentifyBehavior, error) {
	if path == nil {
		return nil, nil
	}
	pt, err := path.PathType()
	if err != nil {
		return nil, err
	}
	switch pt {
	case keybase1.PathType_KBFS:
		return path.Kbfs().IdentifyBehavior, nil
	case keybase1.PathType_KBFS_ARCHIVED:
		return path.KbfsArchived().IdentifyBehavior, nil
	default:
		return nil, nil
	}
}

func populateIdentifyBehaviorIfNeeded(ctx context.Context, path1 *keybase1.Path, path2 *keybase1.Path) (context.Context, error) {
	ib1, err := getIdentifyBehaviorFromPath(path1)
	if err != nil {
		return nil, err
	}
	ib2, err := getIdentifyBehaviorFromPath(path2)
	if err != nil {
		return nil, err
	}

	if ib1 == nil && ib2 == nil {
		return ctx, nil
	}
	if ib1 == nil && ib2 != nil {
		return tlfhandle.MakeExtendedIdentify(ctx, *ib2)
	}
	if ib1 != nil && ib2 == nil {
		return tlfhandle.MakeExtendedIdentify(ctx, *ib1)
	}
	if *ib1 == *ib2 {
		return tlfhandle.MakeExtendedIdentify(ctx, *ib1)
	}
	return nil, errors.New("inconsistent IdentifyBehavior set in both paths")
}

func rawPathFromKbfsPath(path keybase1.Path) (string, error) {
	pt, err := path.PathType()
	if err != nil {
		return "", err
	}

	switch pt {
	case keybase1.PathType_KBFS:
		return stdpath.Clean(path.Kbfs().Path), nil
	case keybase1.PathType_KBFS_ARCHIVED:
		return stdpath.Clean(path.KbfsArchived().Path), nil
	default:
		return "", errOnlyRemotePathSupported
	}
}

func splitPathFromKbfsPath(path keybase1.Path) ([]string, error) {
	raw, err := rawPathFromKbfsPath(path)
	if err != nil {
		return nil, err
	}
	if stdpath.IsAbs(raw) {
		raw = raw[1:]
	}
	return strings.Split(raw, `/`), nil
}

// remoteTlfAndPath decodes a remote path for us.
func remoteTlfAndPath(path keybase1.Path) (
	t tlf.Type, tlfName, middlePath, finalElem string, err error) {
	ps, err := splitPathFromKbfsPath(path)
	if err != nil {
		return tlf.Private, "", "", "", err
	}
	switch {
	case len(ps) < 2:
		return tlf.Private, "", "", "", errInvalidRemotePath
	case ps[0] == `private`:
		t = tlf.Private
	case ps[0] == `public`:
		t = tlf.Public
	case ps[0] == `team`:
		t = tlf.SingleTeam
	default:
		return tlf.Private, "", "", "", errInvalidRemotePath
	}
	if len(ps) >= 3 {
		finalElem = ps[len(ps)-1]
		middlePath = stdpath.Join(ps[2 : len(ps)-1]...)
	}
	return t, ps[1], middlePath, finalElem, nil
}

func (k *SimpleFS) branchNameFromPath(
	ctx context.Context, tlfHandle *tlfhandle.Handle, path keybase1.Path) (
	data.BranchName, error) {
	pt, err := path.PathType()
	if err != nil {
		return "", err
	}
	switch pt {
	case keybase1.PathType_KBFS:
		if tlfHandle.IsLocalConflict() {
			b, ok := data.MakeConflictBranchName(tlfHandle)
			if ok {
				return b, nil
			}
		}
		return data.MasterBranch, nil
	case keybase1.PathType_KBFS_ARCHIVED:
		archivedParam := path.KbfsArchived().ArchivedParam
		archivedType, err := archivedParam.KBFSArchivedType()
		if err != nil {
			return "", err
		}
		switch archivedType {
		case keybase1.KBFSArchivedType_REVISION:
			return data.MakeRevBranchName(
				kbfsmd.Revision(archivedParam.Revision())), nil
		case keybase1.KBFSArchivedType_TIME:
			t := keybase1.FromTime(archivedParam.Time())
			rev, err := libkbfs.GetMDRevisionByTime(ctx, k.config, tlfHandle, t)
			if err != nil {
				return "", err
			}
			return data.MakeRevBranchName(rev), nil
		case keybase1.KBFSArchivedType_TIME_STRING:
			t := archivedParam.TimeString()
			rev, err := libfs.RevFromTimeString(ctx, k.config, tlfHandle, t)
			if err != nil {
				return "", err
			}
			return data.MakeRevBranchName(rev), nil
		case keybase1.KBFSArchivedType_REL_TIME_STRING:
			t := archivedParam.RelTimeString()
			rev, err := libfs.RevFromRelativeTimeString(
				ctx, k.config, tlfHandle, t)
			if err != nil {
				return "", err
			}
			return data.MakeRevBranchName(rev), nil
		default:
			return "", simpleFSError{"Invalid archived type for branch name"}
		}
	default:
		return "", simpleFSError{"Invalid path type for branch name"}
	}
}

func (k *SimpleFS) getFSWithMaybeCreate(
	ctx context.Context, path keybase1.Path, create bool) (
	fs billy.Filesystem, finalElem string, err error) {
	pt, err := path.PathType()
	if err != nil {
		return nil, "", err
	}
	switch pt {
	case keybase1.PathType_KBFS, keybase1.PathType_KBFS_ARCHIVED:
		// Check for the root FS first.
		ps, err := splitPathFromKbfsPath(path)
		if err != nil {
			return nil, "", err
		}
		if len(ps) < 2 {
			fs = libfs.NewRootFS(k.config)
			if len(ps) == 1 {
				finalElem = ps[0]
			}
			return fs, finalElem, nil
		}

		t, tlfName, restOfPath, finalElem, err := remoteTlfAndPath(path)
		if err != nil {
			return nil, "", err
		}
		tlfHandle, err := libkbfs.GetHandleFromFolderNameAndType(
			ctx, k.config.KBPKI(), k.config.MDOps(), k.config, tlfName, t)
		if err != nil {
			return nil, "", err
		}
		branch, err := k.branchNameFromPath(ctx, tlfHandle, path)
		if err != nil {
			return nil, "", err
		}
		fs, err := k.newFS(
			ctx, k.config, tlfHandle, branch, restOfPath, create)
		if err != nil {
			if exitEarly, _ := libfs.FilterTLFEarlyExitError(
				ctx, err, k.log, tlfHandle.GetCanonicalName()); exitEarly {
				return nil, finalElem, libfs.TlfDoesNotExist{}
			}
			return nil, "", err
		}
		if create {
			err = k.checkEmptySubscription(ctx, path)
			if err != nil {
				return nil, "", err
			}
		}
		return fs, finalElem, nil
	case keybase1.PathType_LOCAL:
		fs = osfs.New(stdpath.Dir(path.Local()))
		return fs, stdpath.Base(path.Local()), nil
	default:
		return nil, "", simpleFSError{"Invalid path type"}
	}
}

func (k *SimpleFS) getFS(
	ctx context.Context, path keybase1.Path) (
	fs billy.Filesystem, finalElem string, err error) {
	return k.getFSWithMaybeCreate(ctx, path, true)
}

func (k *SimpleFS) getFSIfExists(
	ctx context.Context, path keybase1.Path) (
	fs billy.Filesystem, finalElem string, err error) {
	return k.getFSWithMaybeCreate(ctx, path, false)
}

func deTy2Ty(et data.EntryType) keybase1.DirentType {
	switch et {
	case data.Exec:
		return keybase1.DirentType_EXEC
	case data.File:
		return keybase1.DirentType_FILE
	case data.Dir:
		return keybase1.DirentType_DIR
	case data.Sym:
		return keybase1.DirentType_SYM
	}
	panic("deTy2Ty unreachable")
}

func (k *SimpleFS) favoriteList(ctx context.Context, path keybase1.Path, t tlf.Type) ([]keybase1.Dirent, error) {
	session, err := idutil.GetCurrentSessionIfPossible(
		ctx, k.config.KBPKI(), true)
	if err != nil {
		return nil, err
	}
	// Return empty directory listing if we are not logged in.
	if session.UID.IsNil() {
		return nil, nil
	}

	favs, err := k.config.KBFSOps().GetFavorites(ctx)
	if err != nil {
		return nil, err
	}

	res := make([]keybase1.Dirent, 0, len(favs))
	for _, fav := range favs {
		if fav.Type != t {
			continue
		}
		pname, err := tlf.CanonicalToPreferredName(
			session.Name, tlf.CanonicalName(fav.Name))
		if err != nil {
			k.log.Errorf("CanonicalToPreferredName: %q %v", fav.Name, err)
			continue
		}
		res = append(res, keybase1.Dirent{})
		res[len(res)-1].Name = string(pname)
		res[len(res)-1].DirentType = deTy2Ty(data.Dir)

		handle, err := tlfhandle.ParseHandlePreferredQuick(
			ctx, k.config.KBPKI(), k.config, string(pname), t)
		if err != nil {
			k.log.Errorf("ParseTlfHandlePreferredQuick: %s %q %v", t, pname, err)
			continue
		}
		res[len(res)-1].Writable, err = libfs.IsWriter(
			ctx, k.config.KBPKI(), k.config, handle)
		if err != nil {
			k.log.Errorf("libfs.IsWriter: %q %+v", pname, err)
			continue
		}
	}
	return res, nil
}

func (k *SimpleFS) setStat(de *keybase1.Dirent, fi os.FileInfo) error {
	de.Time = keybase1.ToTime(fi.ModTime())
	de.Size = int(fi.Size()) // TODO: FIX protocol

	t := data.File
	switch {
	case fi.IsDir():
		t = data.Dir
	case fi.Mode()&0100 != 0:
		t = data.Exec
	case fi.Mode()&os.ModeSymlink != 0:
		t = data.Sym
	}
	de.DirentType = deTy2Ty(t)
	de.Writable = (fi.Mode()&0222 != 0)

	if lwg, ok := fi.Sys().(libfs.KBFSMetadataForSimpleFSGetter); ok {
		md, err := lwg.KBFSMetadataForSimpleFS()
		if err != nil {
			return err
		}
		de.LastWriterUnverified = md.LastWriter
		de.PrefetchStatus = md.PrefetchStatus
		de.PrefetchProgress = md.PrefetchProgress.ToProtocolProgress(
			k.config.Clock())
	}
	de.Name = fi.Name()
	return nil
}

func (k *SimpleFS) setResult(opid keybase1.OpID, val interface{}) {
	k.lock.Lock()
	k.handles[opid] = &handle{async: val}
	k.lock.Unlock()
}

func (k *SimpleFS) startOp(ctx context.Context, opid keybase1.OpID,
	opType keybase1.AsyncOps, desc keybase1.OpDescription) (
	_ context.Context, w *inprogress, err error) {
	ctx = k.makeContext(ctx)
	ctx, cancel := context.WithCancel(ctx)
	w = &inprogress{
		desc,
		cancel,
		make(chan error, 1),
		keybase1.OpProgress{OpType: opType},
	}
	k.lock.Lock()
	k.inProgress[opid] = w
	k.lock.Unlock()
	// ignore error, this is just for logging.
	descBS, _ := json.Marshal(desc)
	k.vlog.CLogf(ctx, libkb.VLog1, "start %X %s", opid, descBS)
	newCtx, err := k.startOpWrapContext(ctx)
	return newCtx, w, err
}

func (k *SimpleFS) doneOp(ctx context.Context, opid keybase1.OpID, w *inprogress, err error) {
	// We aren't accessing w.progress directionly but w can still be in there
	// so is still protected by the lock.
	k.lock.Lock()
	w.progress.EndEstimate = keybase1.ToTime(k.config.Clock().Now())
	k.lock.Unlock()

	w.done <- err
	close(w.done)
	k.log.CDebugf(ctx, "done op %X, status=%+v", opid, err)
	if ctx != nil {
		err := libcontext.CleanupCancellationDelayer(ctx)
		if err != nil {
			k.log.CDebugf(ctx, "Error cancelling delayer: %+v", err)
		}
	}
}

func (k *SimpleFS) startAsync(
	ctx context.Context, opid keybase1.OpID, opType keybase1.AsyncOps,
	desc keybase1.OpDescription,
	path1ForIdentifyBehavior *keybase1.Path,
	path2ForIdentifyBehavior *keybase1.Path,
	callback func(context.Context) error) (err error) {
	ctxAsync, w, e0 := k.startOp(context.Background(), opid, opType, desc)
	if e0 != nil {
		return e0
	}
	ctxAsync, err = populateIdentifyBehaviorIfNeeded(
		ctxAsync, path1ForIdentifyBehavior, path2ForIdentifyBehavior)
	if err != nil {
		return err
	}
	// Bind the old context to the new context, for debugging purposes.
	k.log.CDebugf(ctx, "Launching new async operation with SFSID=%s",
		ctxAsync.Value(ctxIDKey))
	go func() {
		var err error
		// Capture the inprogress reference here rather than let doneOp
		// retrieve it when called, so that doneOp always has it when it's
		// called. This is needed when SimpleFSCancel is called when a
		// SimpleFSWait is already in the air. Since SimpleFSCancel deletes the
		// inprogress object from k.inProgress, doneOp wouldn't be able to get
		// the object when it's called. To make sure SimpleFSWait returns and
		// returns the correct error, we just pass in the inprogress reference
		// here.
		defer func() { k.doneOp(ctxAsync, opid, w, err) }()
		err = callback(ctxAsync)
		if err != nil {
			k.log.CDebugf(ctxAsync, "Error making async callback: %+v", err)
		}
	}()
	return nil
}

func (k *SimpleFS) setProgressTotals(
	opid keybase1.OpID, totalBytes, totalFiles int64) {
	k.lock.Lock()
	defer k.lock.Unlock()
	w, ok := k.inProgress[opid]
	if !ok {
		return
	}
	w.progress.BytesTotal = totalBytes
	w.progress.FilesTotal = totalFiles
	w.progress.Start = keybase1.ToTime(k.config.Clock().Now())
}

func (k *SimpleFS) updateReadProgress(
	opid keybase1.OpID, readBytes, readFiles int64) {
	k.lock.Lock()
	defer k.lock.Unlock()
	w, ok := k.inProgress[opid]
	if !ok {
		return
	}
	w.progress.BytesRead += readBytes
	if w.progress.BytesRead > w.progress.BytesTotal {
		// Our original total was wrong or we didn't get one.
		w.progress.BytesTotal = w.progress.BytesRead
	}
	w.progress.FilesRead += readFiles
	if w.progress.FilesRead > w.progress.FilesTotal {
		// Our original total was wrong or we didn't get one.
		w.progress.FilesTotal = w.progress.FilesRead
	}
}

func (k *SimpleFS) updateWriteProgress(
	opid keybase1.OpID, wroteBytes, wroteFiles int64) {
	k.lock.Lock()
	defer k.lock.Unlock()
	w, ok := k.inProgress[opid]
	if !ok {
		return
	}
	w.progress.BytesWritten += wroteBytes
	if w.progress.BytesWritten > w.progress.BytesTotal {
		// Our original total was wrong or we didn't get one.
		w.progress.BytesTotal = w.progress.BytesWritten
	}
	w.progress.FilesWritten += wroteFiles
	if w.progress.FilesWritten > w.progress.FilesTotal {
		// Our original total was wrong or we didn't get one.
		w.progress.FilesTotal = w.progress.FilesWritten
	}
}

var filesToIgnore = map[string]bool{
	".Trashes":   true,
	".fseventsd": true,
	".DS_Store":  true,
}
var prefixesToIgnore = []string{"._"}

func isFiltered(filter keybase1.ListFilter, name string) bool {
	switch filter {
	case keybase1.ListFilter_NO_FILTER:
		return false
	case keybase1.ListFilter_FILTER_ALL_HIDDEN:
		return strings.HasPrefix(name, ".")
	case keybase1.ListFilter_FILTER_SYSTEM_HIDDEN:
		if filesToIgnore[name] {
			return true
		}
		for _, prefix := range prefixesToIgnore {
			if strings.HasPrefix(name, prefix) {
				return true
			}
		}
		return false
	}
	return false
}

func (k *SimpleFS) getFolderBranchFromPath(
	ctx context.Context, path keybase1.Path) (
	data.FolderBranch, string, error) {
	t, tlfName, _, _, err := remoteTlfAndPath(path)
	if err != nil {
		return data.FolderBranch{}, "", err
	}
	tlfHandle, err := libkbfs.GetHandleFromFolderNameAndType(
		ctx, k.config.KBPKI(), k.config.MDOps(), k.config, tlfName, t)
	if err != nil {
		return data.FolderBranch{}, "", err
	}

	// Get the root node first to initialize the TLF.
	node, _, err := k.config.KBFSOps().GetRootNode(
		ctx, tlfHandle, data.MasterBranch)
	if err != nil {
		return data.FolderBranch{}, "", err
	}
	if node == nil {
		return data.FolderBranch{}, tlfHandle.GetCanonicalPath(), nil
	}
	return node.GetFolderBranch(), tlfHandle.GetCanonicalPath(), nil
}

func (k *SimpleFS) refreshSubscriptionLocked(
	ctx context.Context, path keybase1.Path, tlfPathFromGUI string) error {
	// TODO: when favorites caching is ready, handle folder-list paths
	// like `/keybase/private` here.

	fb, _, err := k.getFolderBranchFromPath(ctx, path)
	if err != nil {
		return err
	}
	if fb == (data.FolderBranch{}) {
		k.log.CDebugf(
			ctx, "Ignoring subscription for empty TLF %q", path)
		k.subscribeToEmptyTlf = tlfPathFromGUI
		return nil
	}

	if k.subscribeCurrFB == fb {
		k.subscribeToEmptyTlf = ""
		return nil
	}

	if k.subscribeCurrFB != (data.FolderBranch{}) {
		err = k.config.Notifier().UnregisterFromChanges(
			[]data.FolderBranch{k.subscribeCurrFB}, k)
		if err != nil {
			return err
		}
	}

	k.log.CDebugf(ctx, "Subscribing to %s", tlfPathFromGUI)
	err = k.config.Notifier().RegisterForChanges(
		[]data.FolderBranch{fb}, k)
	if err != nil {
		return err
	}
	// We are subscribing on TLF level anyway, so just use TLF path when
	// notifying GUI.
	k.subscribeCurrTlfPathFromGUI = tlfPathFromGUI
	k.subscribeCurrFB = fb
	k.subscribeToEmptyTlf = ""
	return nil
}

func tlfNameFromPath(path keybase1.Path) (string, error) {
	pType, err := path.PathType()
	if err != nil {
		return "", err
	}
	if pType != keybase1.PathType_KBFS {
		return "", nil
	}

	tlfType, tlfNameFromGUI, _, _, err := remoteTlfAndPath(path)
	if err != nil {
		return "", err
	}
	return tlfhandle.BuildCanonicalPathForTlfType(
		tlfType, tlfNameFromGUI), nil
}

func (k *SimpleFS) refreshSubscription(
	ctx context.Context, path keybase1.Path) error {
	tlfPathFromGUI, err := tlfNameFromPath(path)
	if err != nil {
		return err
	}
	if tlfPathFromGUI == "" {
		k.log.CDebugf(ctx, "Ignoring subscription for path %s", path)
		return nil
	}

	k.subscribeLock.Lock()
	defer k.subscribeLock.Unlock()
	return k.refreshSubscriptionLocked(ctx, path, tlfPathFromGUI)
}

func (k *SimpleFS) checkEmptySubscription(
	ctx context.Context, path keybase1.Path) error {
	k.subscribeLock.Lock()
	defer k.subscribeLock.Unlock()
	if k.subscribeToEmptyTlf == "" {
		// Fast path.
		return nil
	}

	tlfPathFromGUI, err := tlfNameFromPath(path)
	if err != nil {
		return err
	}
	if tlfPathFromGUI == "" {
		return nil
	}

	if k.subscribeToEmptyTlf != tlfPathFromGUI {
		return nil
	}

	k.log.CDebugf(
		ctx, "Trying to subscribe to %s, which was previously empty",
		tlfPathFromGUI)
	return k.refreshSubscriptionLocked(ctx, path, tlfPathFromGUI)
}

// SimpleFSList - Begin list of items in directory at path
// Retrieve results with readList()
// Cannot be a single file to get flags/status,
// must be a directory.
func (k *SimpleFS) SimpleFSList(ctx context.Context, arg keybase1.SimpleFSListArg) (err error) {
	return k.startAsync(ctx, arg.OpID, keybase1.AsyncOps_LIST,
		keybase1.NewOpDescriptionWithList(
			keybase1.ListArgs{
				OpID: arg.OpID, Path: arg.Path, Filter: arg.Filter,
			}),
		&arg.Path, nil,
		func(ctx context.Context) (err error) {
			var res []keybase1.Dirent

			rawPath, err := rawPathFromKbfsPath(arg.Path)
			if err != nil {
				return err
			}
			switch {
			case rawPath == "/":
				res = []keybase1.Dirent{
					{Name: "private", DirentType: deTy2Ty(data.Dir)},
					{Name: "public", DirentType: deTy2Ty(data.Dir)},
					{Name: "team", DirentType: deTy2Ty(data.Dir)},
				}
			case rawPath == `/public`:
				res, err = k.favoriteList(ctx, arg.Path, tlf.Public)
			case rawPath == `/private`:
				res, err = k.favoriteList(ctx, arg.Path, tlf.Private)
			case rawPath == `/team`:
				res, err = k.favoriteList(ctx, arg.Path, tlf.SingleTeam)
			default:
				fs, finalElem, err := k.getFSIfExists(ctx, arg.Path)
				switch errors.Cause(err).(type) {
				case nil:
				case libfs.TlfDoesNotExist:
					// TLF doesn't exist yet; just return an empty result.
					k.setResult(arg.OpID, keybase1.SimpleFSListResult{})
					return nil
				default:
					return err
				}

				if arg.RefreshSubscription {
					// TODO: move this higher when we handle
					// subscribing to the favorites list.
					err = k.refreshSubscription(ctx, arg.Path)
					if err != nil {
						return err
					}
				}

				// With listing, we don't know the totals ahead of time,
				// so just start with a 0 total.
				k.setProgressTotals(arg.OpID, 0, 0)
				finalElemFI, err := fs.Stat(finalElem)
				if err != nil {
					return err
				}
				var fis []os.FileInfo
				if finalElemFI.IsDir() {
					fis, err = fs.ReadDir(finalElem)
					if err != nil {
						return err
					}
				} else {
					fis = append(fis, finalElemFI)
				}
				for _, fi := range fis {
					if finalElemFI.IsDir() &&
						isFiltered(arg.Filter, fi.Name()) {
						continue
					}

					var d keybase1.Dirent
					err := k.setStat(&d, fi)
					if err != nil {
						return err
					}
					res = append(res, d)
				}
				k.updateReadProgress(arg.OpID, 0, int64(len(fis)))
			}
			if err != nil {
				return err
			}
			k.setResult(arg.OpID, keybase1.SimpleFSListResult{Entries: res})
			return nil
		})
}

// listRecursiveToDepthAsync returns a function that recursively lists folders,
// up to a given depth. A depth of -1 is treated as unlimited. The function
// also updates progress for the passed-in opID as it progresses, and then sets
// the result for the opID when it completes.
//
// TODO: refactor SimpleFSList to use this too (finalDepth = 0)
//
func (k *SimpleFS) listRecursiveToDepth(opID keybase1.OpID,
	path keybase1.Path, filter keybase1.ListFilter,
	finalDepth int, refreshSubscription bool) func(context.Context) error {
	return func(ctx context.Context) (err error) {
		// A stack of paths to process - ordering does not matter.
		// Here we don't walk symlinks, so no loops possible.
		type pathStackElem struct {
			path  string
			depth int
		}
		var paths []pathStackElem

		fs, finalElem, err := k.getFSIfExists(ctx, path)
		switch errors.Cause(err).(type) {
		case nil:
		case libfs.TlfDoesNotExist:
			// TLF doesn't exist yet; just return an empty result.
			k.setResult(opID, keybase1.SimpleFSListResult{})
			return nil
		default:
			return err
		}

		if refreshSubscription {
			err = k.refreshSubscription(ctx, path)
			if err != nil {
				return err
			}
		}

		// With listing, we don't know the totals ahead of time,
		// so just start with a 0 total.
		k.setProgressTotals(opID, 0, 0)
		fi, err := fs.Stat(finalElem)
		if err != nil {
			return err
		}
		var des []keybase1.Dirent
		if !fi.IsDir() {
			var d keybase1.Dirent
			err := k.setStat(&d, fi)
			if err != nil {
				return err
			}
			d.Name = finalElem
			des = append(des, d)
			// Leave paths empty so we can skip the loop below.
		} else {
			// Start with a depth of 0.
			// A TLF root will have a `finalElem` of "".
			// A subdirectory will have a `finalElem` of just the name.
			paths = append(paths, pathStackElem{finalElem, 0})
		}

		for len(paths) > 0 {
			// Take last element and shorten.
			pathElem := paths[len(paths)-1]
			paths = paths[:len(paths)-1]
			pathName := ""
			if pathElem.path != finalElem {
				pathName = strings.TrimPrefix(pathElem.path, finalElem+"/")
			}

			fis, err := fs.ReadDir(pathElem.path)
			if err != nil {
				return err
			}
			for _, fi := range fis {
				// We can only get here if we're listing a
				// directory, not a single file, so we should
				// always filter.
				if isFiltered(filter, fi.Name()) {
					continue
				}

				var de keybase1.Dirent
				err := k.setStat(&de, fi)
				if err != nil {
					return err
				}
				de.Name = stdpath.Join(pathName, fi.Name())
				des = append(des, de)
				// Only recurse if the caller requested infinite depth (-1), or
				// if the current path has a depth less than the desired final
				// depth of recursion.
				if fi.IsDir() && (finalDepth == -1 || pathElem.depth < finalDepth) {
					paths = append(paths, pathStackElem{stdpath.Join(pathElem.path, fi.Name()), pathElem.depth + 1})
				}
			}
			k.updateReadProgress(opID, 0, int64(len(fis)))
		}
		k.setResult(opID, keybase1.SimpleFSListResult{Entries: des})

		return nil
	}
}

// SimpleFSListRecursiveToDepth - Begin recursive list of items in directory at
// path up to a given depth.
func (k *SimpleFS) SimpleFSListRecursiveToDepth(
	ctx context.Context, arg keybase1.SimpleFSListRecursiveToDepthArg) (err error) {
	return k.startAsync(ctx, arg.OpID, keybase1.AsyncOps_LIST_RECURSIVE_TO_DEPTH,
		keybase1.NewOpDescriptionWithListRecursiveToDepth(
			keybase1.ListToDepthArgs{
				OpID: arg.OpID, Path: arg.Path, Filter: arg.Filter, Depth: arg.Depth,
			}),
		&arg.Path, nil,
		k.listRecursiveToDepth(arg.OpID, arg.Path, arg.Filter, arg.Depth, arg.RefreshSubscription),
	)
}

// SimpleFSListRecursive - Begin recursive list of items in directory at path
func (k *SimpleFS) SimpleFSListRecursive(
	ctx context.Context, arg keybase1.SimpleFSListRecursiveArg) (err error) {
	return k.startAsync(ctx, arg.OpID, keybase1.AsyncOps_LIST_RECURSIVE,
		keybase1.NewOpDescriptionWithListRecursive(
			keybase1.ListArgs{
				OpID: arg.OpID, Path: arg.Path, Filter: arg.Filter,
			}),
		&arg.Path, nil,
		k.listRecursiveToDepth(arg.OpID, arg.Path, arg.Filter, -1, arg.RefreshSubscription),
	)
}

// SimpleFSReadList - Get list of Paths in progress. Can indicate status of pending
// to get more entries.
func (k *SimpleFS) SimpleFSReadList(_ context.Context, opid keybase1.OpID) (keybase1.SimpleFSListResult, error) {
	k.lock.Lock()
	res := k.handles[opid]
	var x interface{}
	if res != nil {
		x = res.async
		res.async = nil
	}
	k.lock.Unlock()

	lr, ok := x.(keybase1.SimpleFSListResult)
	if !ok {
		return keybase1.SimpleFSListResult{}, errNoResult
	}

	return lr, nil
}

// SimpleFSListFavorites lists the favorite, new,
// and ignored folders of the logged in user,
// getting its data from the KBFS Favorites cache. If the cache is stale,
// this will trigger a network request.
func (k *SimpleFS) SimpleFSListFavorites(ctx context.Context) (
	keybase1.FavoritesResult, error) {
	session, err := idutil.GetCurrentSessionIfPossible(
		ctx, k.config.KBPKI(), true)
	if err != nil {
		return keybase1.FavoritesResult{}, err
	}
	if session.UID.IsNil() {
		return keybase1.FavoritesResult{}, nil
	}

	return k.config.KBFSOps().GetFavoritesAll(ctx)
}

func recursiveByteAndFileCount(fs billy.Filesystem) (
	bytes, files int64, err error) {
	fileInfos, err := fs.ReadDir("/")
	if err != nil {
		return 0, 0, err
	}

	for _, fi := range fileInfos {
		if fi.IsDir() {
			if fi.Name() == "." {
				continue
			}
			chrootFS, err := fs.Chroot(fi.Name())
			if err != nil {
				return 0, 0, err
			}
			chrootBytes, chrootFiles, err := recursiveByteAndFileCount(chrootFS)
			if err != nil {
				return 0, 0, err
			}
			bytes += chrootBytes
			files += chrootFiles
		} else {
			bytes += fi.Size()
		}
		files++
	}
	return bytes, files, nil
}

func copyWithCancellation(ctx context.Context, dst io.Writer, src io.Reader) error {
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}
		_, err := io.CopyN(dst, src, 64*1024)
		if err == io.EOF {
			return nil
		}
		if err != nil {
			return err
		}
	}
}

type progressReader struct {
	k     *SimpleFS
	opID  keybase1.OpID
	input io.Reader
}

var _ io.Reader = (*progressReader)(nil)

func (pr *progressReader) Read(p []byte) (n int, err error) {
	n, err = pr.input.Read(p)
	if n > 0 {
		// Update read progress, even for errors.
		pr.k.updateReadProgress(pr.opID, int64(n), 0)
	}
	return n, err
}

type progressWriter struct {
	k      *SimpleFS
	opID   keybase1.OpID
	output io.Writer
}

var _ io.Writer = (*progressWriter)(nil)

func (pw *progressWriter) Write(p []byte) (n int, err error) {
	n, err = pw.output.Write(p)
	if n > 0 {
		// Update write progress, even for errors.
		pw.k.updateWriteProgress(pw.opID, int64(n), 0)
	}
	return n, err
}

func (k *SimpleFS) doCopyFromSource(
	ctx context.Context, opID keybase1.OpID,
	srcFS billy.Filesystem, srcFI os.FileInfo,
	dstPath keybase1.Path, dstFS billy.Filesystem,
	finalDstElem string) (err error) {
	defer func() {
		if err == nil {
			k.updateReadProgress(opID, 0, 1)
			k.updateWriteProgress(opID, 0, 1)
		}
	}()

	if srcFI.IsDir() {
		return dstFS.MkdirAll(finalDstElem, 0755)
	}

	src, err := srcFS.Open(srcFI.Name())
	if err != nil {
		return err
	}
	defer src.Close()

	dst, err := dstFS.OpenFile(
		finalDstElem, os.O_RDWR|os.O_CREATE|os.O_TRUNC, 0600)
	if err != nil {
		return err
	}
	defer dst.Close()

	if pathType, _ := dstPath.PathType(); pathType == keybase1.PathType_LOCAL {
		defer func() {
			qerr := Quarantine(ctx, dstPath.Local())
			if err == nil {
				err = qerr
			}
		}()
	}

	err = copyWithCancellation(
		ctx,
		&progressWriter{k, opID, dst},
		&progressReader{k, opID, src},
	)
	return err
}

func (k *SimpleFS) doCopy(
	ctx context.Context, opID keybase1.OpID,
	srcPath, destPath keybase1.Path) (err error) {
	// Note this is also used by move, so if this changes update SimpleFSMove
	// code also.
	srcFS, finalSrcElem, err := k.getFS(ctx, srcPath)
	if err != nil {
		return err
	}
	srcFI, err := srcFS.Stat(finalSrcElem)
	if err != nil {
		return err
	}
	if srcFI.IsDir() {
		// The byte count for making a single directory is meaningless.
		k.setProgressTotals(opID, 0, 1)
	} else {
		k.setProgressTotals(opID, srcFI.Size(), 1)
	}
	destFS, finalDestElem, err := k.getFS(ctx, destPath)
	if err != nil {
		return err
	}

	return k.doCopyFromSource(
		ctx, opID, srcFS, srcFI, destPath, destFS, finalDestElem)
}

// SimpleFSCopy - Begin copy of file or directory
func (k *SimpleFS) SimpleFSCopy(
	ctx context.Context, arg keybase1.SimpleFSCopyArg) (err error) {
	return k.startAsync(ctx, arg.OpID, keybase1.AsyncOps_COPY,
		keybase1.NewOpDescriptionWithCopy(keybase1.CopyArgs(arg)),
		&arg.Src, &arg.Dest,
		func(ctx context.Context) (err error) {
			return k.doCopy(ctx, arg.OpID, arg.Src, arg.Dest)
		})
}

// SimpleFSSymlink starts making a symlink of a file or directory
func (k *SimpleFS) SimpleFSSymlink(
	ctx context.Context, arg keybase1.SimpleFSSymlinkArg) (err error) {
	// This is not async.
	ctx, err = k.startSyncOp(ctx, "Symlink", arg, &arg.Link, nil)
	if err != nil {
		return err
	}
	defer func() { k.doneSyncOp(ctx, err) }()

	destFS, finalDestElem, err := k.getFS(ctx, arg.Link)
	if err != nil {
		return err
	}

	err = destFS.Symlink(arg.Target, finalDestElem)
	return err
}

type copyNode struct {
	dest                        keybase1.Path
	srcFS, destFS               billy.Filesystem
	srcFinalElem, destFinalElem string
}

func pathAppend(p keybase1.Path, leaf string) keybase1.Path {
	switch {
	case p.Local__ != nil:
		var s = stdpath.Join(*p.Local__, leaf)
		p.Local__ = &s
	case p.Kbfs__ != nil:
		var s = stdpath.Join(p.Kbfs__.Path, leaf)
		p = p.DeepCopy()
		p.Kbfs__.Path = s
	case p.KbfsArchived__ != nil:
		var s = stdpath.Join(p.KbfsArchived__.Path, leaf)
		p = p.DeepCopy()
		p.KbfsArchived__.Path = s
	}
	return p
}

func (k *SimpleFS) doCopyRecursive(
	ctx context.Context, opID keybase1.OpID, src, dest keybase1.Path) error {
	// Get the full byte/file count.
	srcFS, finalSrcElem, err := k.getFSIfExists(ctx, src)
	if err != nil {
		return err
	}
	srcFI, err := srcFS.Stat(finalSrcElem)
	if err != nil {
		return err
	}
	if srcFI.IsDir() {
		chrootFS, err := srcFS.Chroot(srcFI.Name())
		if err != nil {
			return err
		}
		bytes, files, err := recursiveByteAndFileCount(chrootFS)
		if err != nil {
			return err
		}
		// Add one to files to account for the src dir itself.
		k.setProgressTotals(opID, bytes, files+1)
	} else {
		// No need for recursive.
		return k.doCopy(ctx, opID, src, dest)
	}

	destFS, finalDestElem, err := k.getFS(ctx, dest)
	if err != nil {
		return err
	}

	var nodes = []copyNode{{
		dest:          dest,
		srcFS:         srcFS,
		destFS:        destFS,
		srcFinalElem:  finalSrcElem,
		destFinalElem: finalDestElem,
	}}
	for len(nodes) > 0 {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		node := nodes[len(nodes)-1]
		nodes = nodes[:len(nodes)-1]

		srcFI, err := node.srcFS.Stat(node.srcFinalElem)
		if err != nil {
			return err
		}

		err = k.doCopyFromSource(
			ctx, opID, node.srcFS, srcFI, node.dest, node.destFS,
			node.destFinalElem)
		if err != nil {
			return err
		}

		// TODO symlinks
		if srcFI.IsDir() {
			fis, err := node.srcFS.ReadDir(srcFI.Name())
			if err != nil {
				return err
			}

			newSrcFS, err := node.srcFS.Chroot(node.srcFinalElem)
			if err != nil {
				return err
			}

			newDestFS, err := node.destFS.Chroot(node.destFinalElem)
			if err != nil {
				return err
			}

			for _, fi := range fis {
				name := fi.Name()
				nodes = append(nodes, copyNode{
					dest:          pathAppend(node.dest, name),
					srcFS:         newSrcFS,
					destFS:        newDestFS,
					srcFinalElem:  name,
					destFinalElem: name,
				})
			}
		}
	}
	return err
}

// SimpleFSCopyRecursive - Begin recursive copy of directory
func (k *SimpleFS) SimpleFSCopyRecursive(ctx context.Context,
	arg keybase1.SimpleFSCopyRecursiveArg) (err error) {
	return k.startAsync(ctx, arg.OpID, keybase1.AsyncOps_COPY,
		keybase1.NewOpDescriptionWithCopy(keybase1.CopyArgs(arg)),
		&arg.Src, &arg.Dest,
		func(ctx context.Context) (err error) {
			return k.doCopyRecursive(ctx, arg.OpID, arg.Src, arg.Dest)
		})
}

func (k *SimpleFS) doRemove(
	ctx context.Context, path keybase1.Path, recursive bool) error {
	fs, finalElem, err := k.getFS(ctx, path)
	if err != nil {
		return err
	}
	if !recursive {
		if finalElem == "" {
			// If this is trying to remove a TLF, use favorite removal
			// instead.
			if asLibFS, ok := fs.(*libfs.FS); ok {
				h := asLibFS.Handle()
				return k.config.KBFSOps().DeleteFavorite(ctx, h.ToFavorite())
			}
		}
		return fs.Remove(finalElem)
	} else if finalElem == "" {
		// Give a nice error in the case where we're trying to
		// recursively delete a TLF.
		return errors.Errorf("Cannot recursively delete %s", fs.Root())
	}
	fi, err := fs.Stat(finalElem)
	if err != nil {
		return err
	}
	return libfs.RecursiveDelete(ctx, fs, fi)
}

func (k *SimpleFS) pathsForSameTlfMove(
	ctx context.Context, src, dest keybase1.Path) (
	sameTlf bool, srcPath, destPath string, tlfHandle *tlfhandle.Handle,
	err error) {
	srcType, err := src.PathType()
	if err != nil {
		return false, "", "", nil, err
	}
	if srcType != keybase1.PathType_KBFS {
		return false, "", "", nil, nil
	}
	destType, err := dest.PathType()
	if err != nil {
		return false, "", "", nil, err
	}
	if destType != keybase1.PathType_KBFS {
		return false, "", "", nil, nil
	}

	// They are both KBFS paths -- are they in the same TLF?
	srcTlfType, srcTlfName, srcMid, srcFinal, err := remoteTlfAndPath(src)
	if err != nil {
		return false, "", "", nil, err
	}
	destTlfType, destTlfName, destMid, destFinal, err := remoteTlfAndPath(dest)
	if err != nil {
		return false, "", "", nil, err
	}
	if srcTlfType != destTlfType || srcTlfName != destTlfName {
		return false, "", "", nil, nil
	}

	tlfHandle, err = libkbfs.GetHandleFromFolderNameAndType(
		ctx, k.config.KBPKI(), k.config.MDOps(), k.config, srcTlfName,
		srcTlfType)
	if err != nil {
		return false, "", "", nil, err
	}

	return true, stdpath.Join(srcMid, srcFinal), stdpath.Join(destMid, destFinal),
		tlfHandle, nil
}

// SimpleFSMove - Begin move of file or directory, from/to KBFS only
func (k *SimpleFS) SimpleFSMove(
	ctx context.Context, arg keybase1.SimpleFSMoveArg) (err error) {
	return k.startAsync(ctx, arg.OpID, keybase1.AsyncOps_MOVE,
		keybase1.NewOpDescriptionWithMove(keybase1.MoveArgs(arg)),
		&arg.Src, &arg.Dest,
		func(ctx context.Context) (err error) {
			sameTlf, srcPath, destPath, tlfHandle, err := k.pathsForSameTlfMove(
				ctx, arg.Src, arg.Dest)
			if err != nil {
				return err
			}
			if sameTlf {
				k.log.CDebugf(ctx, "Renaming within same TLF: %s",
					tlfHandle.GetCanonicalPath())
				fs, err := libfs.NewFS(
					ctx, k.config, tlfHandle, data.MasterBranch, "", "",
					keybase1.MDPriorityNormal)
				if err != nil {
					return err
				}

				return fs.Rename(srcPath, destPath)
			}

			err = k.doCopyRecursive(ctx, arg.OpID, arg.Src, arg.Dest)
			if err != nil {
				return err
			}
			return k.doRemove(ctx, arg.Src, true)
		})
}

func (k *SimpleFS) startSyncOp(
	ctx context.Context, name string, logarg interface{},
	path1ForIdentifyBehavior *keybase1.Path,
	path2ForIdentifyBehavior *keybase1.Path,
) (context.Context, error) {
	ctx = k.makeContext(ctx)
	ctx, err := populateIdentifyBehaviorIfNeeded(
		ctx, path1ForIdentifyBehavior, path2ForIdentifyBehavior)
	if err != nil {
		return nil, err
	}
	k.vlog.CLogf(ctx, libkb.VLog1, "start sync %s %v", name, logarg)
	return k.startOpWrapContext(ctx)
}
func (k *SimpleFS) startOpWrapContext(outer context.Context) (context.Context, error) {
	return libcontext.NewContextWithCancellationDelayer(libcontext.NewContextReplayable(
		outer, func(c context.Context) context.Context {
			return c
		}))
}

func (k *SimpleFS) doneSyncOp(ctx context.Context, err error) {
	k.log.CDebugf(ctx, "done sync op, status=%+v", err)
	if ctx != nil {
		err := libcontext.CleanupCancellationDelayer(ctx)
		if err != nil {
			k.log.CDebugf(ctx, "Error cancelling delayer: %+v", err)
		}
	}
}

// SimpleFSRename - Rename file or directory, KBFS side only
func (k *SimpleFS) SimpleFSRename(
	ctx context.Context, arg keybase1.SimpleFSRenameArg) (err error) {
	// This is not async.
	ctx, err = k.startSyncOp(ctx, "Rename", arg, &arg.Src, &arg.Dest)
	if err != nil {
		return err
	}
	defer func() { k.doneSyncOp(ctx, err) }()

	// Get root FS, to be shared by both src and dest.
	t, tlfName, restOfSrcPath, finalSrcElem, err := remoteTlfAndPath(arg.Src)
	if err != nil {
		return err
	}
	tlfHandle, err := libkbfs.GetHandleFromFolderNameAndType(
		ctx, k.config.KBPKI(), k.config.MDOps(), k.config, tlfName, t)
	if err != nil {
		return err
	}
	fs, err := libfs.NewFS(
		ctx, k.config, tlfHandle, data.MasterBranch, "", "",
		keybase1.MDPriorityNormal)
	if err != nil {
		return err
	}

	// Make sure src and dest share the same TLF.
	tDest, tlfNameDest, restOfDestPath, finalDestElem, err :=
		remoteTlfAndPath(arg.Dest)
	if err != nil {
		return err
	}
	if tDest != t || tlfName != tlfNameDest {
		return simpleFSError{"Cannot rename across top-level folders"}
	}

	err = fs.Rename(
		stdpath.Join(restOfSrcPath, finalSrcElem),
		stdpath.Join(restOfDestPath, finalDestElem))
	return err
}

// SimpleFSOpen - Create/open a file and leave it open
// or create a directory
// Files must be closed afterwards.
func (k *SimpleFS) SimpleFSOpen(
	ctx context.Context, arg keybase1.SimpleFSOpenArg) (err error) {
	ctx, err = k.startSyncOp(ctx, "Open", arg, &arg.Dest, nil)
	if err != nil {
		return err
	}
	defer func() { k.doneSyncOp(ctx, err) }()

	fs, finalElem, err := k.getFS(ctx, arg.Dest)
	if err != nil {
		return err
	}

	// Make a directory if needed.  This will return `nil` if the
	// directory already exists.
	if arg.Flags&keybase1.OpenFlags_DIRECTORY != 0 {
		return fs.MkdirAll(finalElem, 0755)
	}

	var cflags = os.O_RDONLY
	// This must be first since it writes the flag, not just ORs into it.
	if arg.Flags&keybase1.OpenFlags_WRITE != 0 {
		cflags = os.O_RDWR
	}
	if arg.Flags&keybase1.OpenFlags_EXISTING == 0 {
		cflags |= os.O_CREATE
	}
	if arg.Flags&keybase1.OpenFlags_REPLACE != 0 {
		cflags |= os.O_TRUNC
	}

	var cancel context.CancelFunc = func() {}
	if libfs, ok := fs.(*libfs.FS); ok {
		var fsCtx context.Context
		fsCtx, cancel = context.WithCancel(k.makeContext(context.Background()))
		fsCtx, err := k.startOpWrapContext(fsCtx)
		if err != nil {
			return err
		}
		libfs = libfs.WithContext(fsCtx)
		k.log.CDebugf(ctx, "New background context for open: SFSID=%s, OpID=%X",
			fsCtx.Value(ctxIDKey), arg.OpID)
		fs = libfs
	}

	f, err := fs.OpenFile(finalElem, cflags, 0644)
	if err != nil {
		return err
	}

	k.lock.Lock()
	k.handles[arg.OpID] = &handle{file: f, path: arg.Dest, cancel: cancel}
	k.lock.Unlock()

	return nil
}

// SimpleFSSetStat - Set/clear file bits - only executable for now
func (k *SimpleFS) SimpleFSSetStat(
	ctx context.Context, arg keybase1.SimpleFSSetStatArg) (err error) {
	ctx, err = k.startSyncOp(ctx, "SetStat", arg, &arg.Dest, nil)
	if err != nil {
		return err
	}
	defer func() { k.doneSyncOp(ctx, err) }()

	fs, finalElem, err := k.getFS(ctx, arg.Dest)
	if err != nil {
		return err
	}
	fi, err := fs.Stat(finalElem)
	if err != nil {
		return err
	}

	mode := fi.Mode()
	switch arg.Flag {
	case keybase1.DirentType_EXEC:
		mode |= 0100
	case keybase1.DirentType_FILE:
		mode &= 0677
	default:
		return nil
	}

	changeFS, ok := fs.(billy.Change)
	if !ok {
		panic(fmt.Sprintf("Unexpected non-Change FS: %T", fs))
	}

	return changeFS.Chmod(finalElem, mode)
}

func (k *SimpleFS) startReadWriteOp(
	ctx context.Context, opid keybase1.OpID, opType keybase1.AsyncOps,
	desc keybase1.OpDescription) (context.Context, error) {
	ctx, err := k.startSyncOp(ctx, desc.AsyncOp__.String(), desc, nil, nil)
	if err != nil {
		return nil, err
	}
	k.lock.Lock()
	k.inProgress[opid] = &inprogress{
		desc,
		func() {},
		make(chan error, 1),
		keybase1.OpProgress{OpType: opType},
	}
	k.lock.Unlock()
	return ctx, err
}

func (k *SimpleFS) doneReadWriteOp(ctx context.Context, opID keybase1.OpID, err error) {
	k.lock.Lock()
	// Read/write ops never set the end estimate since the progress is
	// just deleted immediately.
	delete(k.inProgress, opID)
	k.lock.Unlock()
	k.log.CDebugf(ctx, "doneReadWriteOp, status=%v", err)
	if ctx != nil {
		err := libcontext.CleanupCancellationDelayer(ctx)
		if err != nil {
			k.log.CDebugf(ctx, "Error cancelling delayer: %+v", err)
		}
	}
}

// SimpleFSRead - Read (possibly partial) contents of open file,
// up to the amount specified by size.
// Repeat until zero bytes are returned or error.
// If size is zero, read an arbitrary amount.
func (k *SimpleFS) SimpleFSRead(ctx context.Context,
	arg keybase1.SimpleFSReadArg) (_ keybase1.FileContent, err error) {
	ctx = k.makeContext(ctx)
	k.lock.RLock()
	h, ok := k.handles[arg.OpID]
	k.lock.RUnlock()
	if !ok {
		return keybase1.FileContent{}, errNoSuchHandle
	}
	opDesc := keybase1.NewOpDescriptionWithRead(
		keybase1.ReadArgs{
			OpID:   arg.OpID,
			Path:   h.path,
			Offset: arg.Offset,
			Size:   arg.Size,
		})
	ctx, err = k.startReadWriteOp(ctx, arg.OpID, keybase1.AsyncOps_READ, opDesc)
	if err != nil {
		return keybase1.FileContent{}, err
	}
	k.setProgressTotals(arg.OpID, int64(arg.Size), 1)
	defer func() {
		if err == nil {
			k.updateReadProgress(arg.OpID, 0, 1)
		}
	}()

	defer func() { k.doneReadWriteOp(ctx, arg.OpID, err) }()

	// Print this so we can correlate the ID in
	k.log.CDebugf(ctx, "Starting read for OpID=%X, offset=%d, size=%d",
		arg.OpID, arg.Offset, arg.Size)

	_, err = h.file.Seek(arg.Offset, io.SeekStart)
	if err != nil {
		return keybase1.FileContent{}, err
	}

	bs := make([]byte, arg.Size)
	// TODO: make this a proper buffered read so we can get finer progress?
	reader := &progressReader{k, arg.OpID, h.file}
	n, err := reader.Read(bs)
	if err != nil && err != io.EOF {
		return keybase1.FileContent{}, err
	}
	bs = bs[:n]
	return keybase1.FileContent{
		Data: bs,
	}, nil
}

// SimpleFSWrite - Append content to opened file.
// May be repeated until OpID is closed.
func (k *SimpleFS) SimpleFSWrite(
	ctx context.Context, arg keybase1.SimpleFSWriteArg) (err error) {
	ctx = k.makeContext(ctx)
	k.lock.RLock()
	h, ok := k.handles[arg.OpID]
	k.lock.RUnlock()
	if !ok {
		return errNoSuchHandle
	}

	opDesc := keybase1.NewOpDescriptionWithWrite(
		keybase1.WriteArgs{
			OpID: arg.OpID, Path: h.path, Offset: arg.Offset,
		})

	ctx, err = k.startReadWriteOp(
		ctx, arg.OpID, keybase1.AsyncOps_WRITE, opDesc)
	if err != nil {
		return err
	}
	defer func() { k.doneReadWriteOp(ctx, arg.OpID, err) }()

	k.setProgressTotals(arg.OpID, int64(len(arg.Content)), 1)
	defer func() {
		if err == nil {
			k.updateWriteProgress(arg.OpID, 0, 1)
		}
	}()

	k.log.CDebugf(ctx, "Starting write for OpID=%X, offset=%d, size=%d",
		arg.OpID, arg.Offset, len(arg.Content))

	_, err = h.file.Seek(arg.Offset, io.SeekStart)
	if err != nil {
		return err
	}

	writer := &progressWriter{k, arg.OpID, h.file}
	_, err = writer.Write(arg.Content)
	return err
}

// SimpleFSRemove - Remove file or directory from filesystem
func (k *SimpleFS) SimpleFSRemove(ctx context.Context,
	arg keybase1.SimpleFSRemoveArg) (err error) {
	return k.startAsync(ctx, arg.OpID, keybase1.AsyncOps_REMOVE,
		keybase1.NewOpDescriptionWithRemove(keybase1.RemoveArgs(arg)),
		&arg.Path,
		nil,
		func(ctx context.Context) (err error) {
			return k.doRemove(ctx, arg.Path, arg.Recursive)
		})
}

// SimpleFSStat - Get info about file
func (k *SimpleFS) SimpleFSStat(ctx context.Context, arg keybase1.SimpleFSStatArg) (de keybase1.Dirent, err error) {
	ctx, err = k.startSyncOp(ctx, "Stat", arg.Path, &arg.Path, nil)
	if err != nil {
		return keybase1.Dirent{}, err
	}
	defer func() { k.doneSyncOp(ctx, err) }()

	fs, finalElem, err := k.getFSIfExists(ctx, arg.Path)
	switch errors.Cause(err).(type) {
	case nil:
	case libfs.TlfDoesNotExist:
		k.log.CDebugf(ctx, "Return err for finalElem=%s", finalElem)
		if finalElem != "" && finalElem != "." {
			return keybase1.Dirent{}, err
		}

		// TLF doesn't exist yet; just return an empty result.
		return keybase1.Dirent{
			DirentType: keybase1.DirentType_DIR,
			Writable:   false,
		}, nil
	default:
		return keybase1.Dirent{}, err
	}

	if arg.RefreshSubscription {
		err = k.refreshSubscription(ctx, arg.Path)
		if err != nil {
			return keybase1.Dirent{}, err
		}
	}

	// Use LStat so we don't follow symlinks.
	fi, err := fs.Lstat(finalElem)
	if err != nil {
		return keybase1.Dirent{}, err
	}

	err = k.setStat(&de, fi)
	return de, err
}

func (k *SimpleFS) getRevisionsFromPath(
	ctx context.Context, path keybase1.Path) (
	os.FileInfo, data.PrevRevisions, error) {
	fs, finalElem, err := k.getFSIfExists(ctx, path)
	if err != nil {
		k.log.CDebugf(ctx, "Trouble getting fs for path: %+v", err)
		return nil, nil, err
	}
	// Use LStat so we don't follow symlinks.
	fi, err := fs.Lstat(finalElem)
	if err != nil {
		return nil, nil, err
	}

	fipr, ok := fi.Sys().(libfs.PrevRevisionsGetter)
	if !ok {
		return nil, nil, simpleFSError{"Cannot get revisions for non-KBFS path"}
	}
	return fi, fipr.PrevRevisions(), nil
}

func (k *SimpleFS) doGetRevisions(
	ctx context.Context, opID keybase1.OpID, path keybase1.Path,
	spanType keybase1.RevisionSpanType) (
	revs []keybase1.DirentWithRevision, err error) {
	k.vlog.CLogf(ctx, libkb.VLog1, "Getting revisions for path %s, spanType=%s",
		path, spanType)

	// Both span types return up to 5 revisions.
	k.setProgressTotals(opID, 0, 5)

	fi, prs, err := k.getRevisionsFromPath(ctx, path)
	if err != nil {
		return nil, err
	}
	if len(prs) == 0 {
		return nil, simpleFSError{"No previous revisions"}
	}

	var currRev keybase1.DirentWithRevision
	err = k.setStat(&currRev.Entry, fi)
	if err != nil {
		return nil, err
	}
	currRev.Revision = keybase1.KBFSRevision(prs[0].Revision)
	k.log.CDebugf(ctx, "Found current revision: %d", prs[0].Revision)
	k.updateReadProgress(opID, 0, 1)

	var revPaths []keybase1.Path

	// The next four depend on the span type.
	pathStr := path.String()
	switch spanType {
	case keybase1.RevisionSpanType_DEFAULT:
		// Use `prs` for the rest of the paths.
		for i := 1; i < len(prs); i++ {
			p := keybase1.NewPathWithKbfsArchived(keybase1.KBFSArchivedPath{
				Path: pathStr,
				ArchivedParam: keybase1.NewKBFSArchivedParamWithRevision(
					keybase1.KBFSRevision(prs[i].Revision)),
			})
			revPaths = append(revPaths, p)
		}
	case keybase1.RevisionSpanType_LAST_FIVE:
		expectedCount := uint8(2)
		nextSlot := 1
		lastRevision := prs[0].Revision

		// Step back through the previous revisions.  If the next one
		// in the list happens to be the next in line (because the
		// count is one more than the current count), use it.
		// Otherwise, we have to fetch the stats from the MD revision
		// before the last one we processed, and use the
		// PreviousRevisions list from that version of the file.
		for len(revPaths) < 4 && nextSlot < len(prs) {
			var rev kbfsmd.Revision
			switch {
			case prs[nextSlot].Count == expectedCount:
				rev = prs[nextSlot].Revision
			case lastRevision > kbfsmd.RevisionInitial:
				k.log.CDebugf(ctx, "Inspecting revision %d to find previous",
					lastRevision-1)
				pathToPrev := keybase1.NewPathWithKbfsArchived(
					keybase1.KBFSArchivedPath{
						Path: pathStr,
						ArchivedParam: keybase1.NewKBFSArchivedParamWithRevision(
							keybase1.KBFSRevision(lastRevision - 1)),
					})
				_, prevPRs, err := k.getRevisionsFromPath(ctx, pathToPrev)
				if _, isGC := err.(libkbfs.RevGarbageCollectedError); isGC {
					k.log.CDebugf(ctx, "Hit a GC'd revision: %d",
						lastRevision-1)
					break
				} else if err != nil {
					return nil, err
				}
				if len(prevPRs) == 0 {
					// This should never happen, because there is some
					// next slot in the `prs` list, but it doesn't
					// match the expected count, which means there
					// must be _some_ revision in between the last
					// revision and the one in the next slot, that we
					// should uncover by looking up `lastRevision-1`.
					return nil, simpleFSError{fmt.Sprintf(
						"Revision %s unexpectedly lists no previous revisions",
						lastRevision-1)}
				}
				rev = prevPRs[0].Revision
				prs = prevPRs
				nextSlot = 0      // will be incremented below
				expectedCount = 1 // will be incremented below
			default:
				break
			}

			p := keybase1.NewPathWithKbfsArchived(keybase1.KBFSArchivedPath{
				Path: pathStr,
				ArchivedParam: keybase1.NewKBFSArchivedParamWithRevision(
					keybase1.KBFSRevision(rev)),
			})
			revPaths = append(revPaths, p)
			lastRevision = rev
			nextSlot++
			expectedCount++
		}
	default:
		return nil, simpleFSError{
			fmt.Sprintf("Unknown span type: %s", spanType)}
	}

	if len(revPaths) < 4 {
		// See if the final revision has a predecessor that's
		// still live, to fill out the list of 5.  An older
		// revision could have slid off the previous revisions
		// list because that revision was garbage-collected, but
		// that doesn't guarantee that the older revision of the
		// file was garabge-collected too (since it was created,
		// not deleted, as of that garbage-collected revision).
		p := keybase1.NewPathWithKbfsArchived(keybase1.KBFSArchivedPath{
			Path: pathStr,
			ArchivedParam: keybase1.NewKBFSArchivedParamWithRevision(
				keybase1.KBFSRevision(prs[len(prs)-1].Revision - 1)),
		})
		revPaths = append(revPaths, p)
	}

	// Now that we have all the paths we need, stat them one-by-one.
	revs = make([]keybase1.DirentWithRevision, len(revPaths)+1)
	revs[0] = currRev

	if len(revs) < 5 {
		// Discount the revisions that don't exist from the progress.
		k.updateReadProgress(opID, 0, int64(5-len(revs)))
	}

	// Fetch all the past revisions in parallel to populate the
	// directory entry.
	eg, groupCtx := errgroup.WithContext(ctx)
	doStat := func(slot int) error {
		p := revPaths[slot]
		fs, finalElem, err := k.getFSIfExists(groupCtx, p)
		if _, isGC := err.(libkbfs.RevGarbageCollectedError); isGC {
			k.log.CDebugf(ctx, "Hit a GC'd revision: %d",
				p.KbfsArchived().ArchivedParam.Revision())
			return nil
		} else if err != nil {
			return err
		}
		// Use LStat so we don't follow symlinks.
		fi, err := fs.Lstat(finalElem)
		if os.IsNotExist(err) {
			k.log.CDebugf(ctx, "Ran out of revisions as of %d",
				p.KbfsArchived().ArchivedParam.Revision())
			return nil
		}
		if err != nil {
			return err
		}
		var rev keybase1.DirentWithRevision
		err = k.setStat(&rev.Entry, fi)
		if err != nil {
			return err
		}
		rev.Revision = p.KbfsArchived().ArchivedParam.Revision()
		revs[slot+1] = rev
		k.updateReadProgress(opID, 0, 1)
		return nil
	}
	for i := range revPaths {
		i := i
		eg.Go(func() error { return doStat(i) })
	}
	err = eg.Wait()
	if err != nil {
		return nil, err
	}

	// Remove any GC'd revisions.
	for i, r := range revs {
		if kbfsmd.Revision(r.Revision) == kbfsmd.RevisionUninitialized {
			revs = revs[:i]
			break
		}
	}

	return revs, nil
}

// SimpleFSGetRevisions - Get revisions for a file
func (k *SimpleFS) SimpleFSGetRevisions(
	ctx context.Context, arg keybase1.SimpleFSGetRevisionsArg) (err error) {
	return k.startAsync(ctx, arg.OpID, keybase1.AsyncOps_GET_REVISIONS,
		keybase1.NewOpDescriptionWithGetRevisions(
			keybase1.GetRevisionsArgs(arg)),
		&arg.Path,
		nil,
		func(ctx context.Context) (err error) {
			revs, err := k.doGetRevisions(ctx, arg.OpID, arg.Path, arg.SpanType)
			if err != nil {
				return err
			}
			k.setResult(arg.OpID, keybase1.GetRevisionsResult{
				Revisions: revs,
				// For don't set any progress indicators.  If we decide we want
				// to display partial results, we can fix this later.
			})
			return nil
		})
}

// SimpleFSReadRevisions - Get list of revisions in progress. Can
// indicate status of pending to get more revisions.
func (k *SimpleFS) SimpleFSReadRevisions(
	_ context.Context, opid keybase1.OpID) (
	keybase1.GetRevisionsResult, error) {
	k.lock.Lock()
	res := k.handles[opid]
	var x interface{}
	if res != nil {
		x = res.async
		res.async = nil
	}
	k.lock.Unlock()

	lr, ok := x.(keybase1.GetRevisionsResult)
	if !ok {
		return keybase1.GetRevisionsResult{}, errNoResult
	}

	return lr, nil
}

// SimpleFSMakeOpid - Convenience helper for generating new random value
func (k *SimpleFS) SimpleFSMakeOpid(_ context.Context) (keybase1.OpID, error) {
	var opid keybase1.OpID
	err := kbfscrypto.RandRead(opid[:])
	return opid, err
}

// SimpleFSClose - Close removes a handle associated with Open / List.
func (k *SimpleFS) SimpleFSClose(ctx context.Context, opid keybase1.OpID) (err error) {
	ctx, err = k.startSyncOp(ctx, "Close", opid, nil, nil)
	if err != nil {
		return err
	}
	defer func() { k.doneSyncOp(ctx, err) }()

	k.lock.Lock()
	defer k.lock.Unlock()
	delete(k.inProgress, opid)
	h, ok := k.handles[opid]
	if !ok {
		return errNoSuchHandle
	}
	delete(k.handles, opid)
	if h.file != nil {
		err = h.file.Close()
	}
	if h.cancel != nil {
		h.cancel()
	}
	return err
}

// SimpleFSCancel starts to cancel op with the given opid.
// Also remove any pending references of opid everywhere.
// Returns before cancellation is guaranteeded to be done - that
// may take some time. Currently always returns nil.
func (k *SimpleFS) SimpleFSCancel(_ context.Context, opid keybase1.OpID) error {
	k.lock.Lock()
	defer k.lock.Unlock()
	delete(k.handles, opid)
	w, ok := k.inProgress[opid]
	if !ok {
		return nil
	}
	delete(k.inProgress, opid)
	w.cancel()
	return nil
}

// SimpleFSCheck - Check progress of pending operation
// Progress variable is still TBD.
// Return errNoResult if no operation found.
func (k *SimpleFS) SimpleFSCheck(
	ctx context.Context, opid keybase1.OpID) (keybase1.OpProgress, error) {
	k.lock.RLock()
	defer k.lock.RUnlock()
	if p, ok := k.inProgress[opid]; ok {
		// For now, estimate the ending time purely on the read progress.
		var n, d int64
		progress := p.progress
		if progress.BytesTotal > 0 {
			n = progress.BytesRead
			d = progress.BytesTotal
		} else if p.progress.FilesTotal > 0 {
			n = progress.FilesRead
			d = progress.FilesTotal
		}
		if n > 0 && d > 0 && !progress.Start.IsZero() &&
			progress.EndEstimate.IsZero() {
			// Crudely estimate that the total time for the op is the
			// time spent so far, divided by the fraction of the
			// reading that's been done.
			start := keybase1.FromTime(progress.Start)
			timeRunning := k.config.Clock().Now().Sub(start)
			fracDone := float64(n) / float64(d)
			totalTimeEstimate := time.Duration(float64(timeRunning) / fracDone)
			progress.EndEstimate =
				keybase1.ToTime(start.Add(totalTimeEstimate))
			k.log.CDebugf(ctx, "Start=%s, n=%d, d=%d, fracDone=%f, End=%s",
				start, n, d, fracDone, start.Add(totalTimeEstimate))
		}

		return progress, nil
	} else if _, ok := k.handles[opid]; ok {
		// Return an empty progress and nil error if there's no async
		// operation pending, but there is still an open handle.
		return keybase1.OpProgress{}, nil
	}
	return keybase1.OpProgress{}, errNoResult
}

// SimpleFSGetOps - Get all the outstanding operations
func (k *SimpleFS) SimpleFSGetOps(_ context.Context) ([]keybase1.OpDescription, error) {
	k.lock.RLock()
	r := make([]keybase1.OpDescription, 0, len(k.inProgress))
	for _, p := range k.inProgress {
		r = append(r, p.desc)
	}
	k.lock.RUnlock()
	return r, nil
}

// SimpleFSWait - Blocking wait for the pending operation to finish
func (k *SimpleFS) SimpleFSWait(ctx context.Context, opid keybase1.OpID) error {
	ctx = k.makeContext(ctx)
	k.lock.RLock()
	w, ok := k.inProgress[opid]
	k.log.CDebugf(ctx, "Wait %X -> %v, %v", opid, w, ok)
	k.lock.RUnlock()
	if !ok {
		return errNoSuchHandle
	}

	err, ok := <-w.done

	k.lock.Lock()
	delete(k.inProgress, opid)
	k.lock.Unlock()

	if !ok {
		return errNoResult
	}
	return err
}

// SimpleFSDumpDebuggingInfo - Instructs KBFS to dump debugging info
// into its logs.
func (k *SimpleFS) SimpleFSDumpDebuggingInfo(ctx context.Context) error {
	ctx = k.makeContext(ctx)
	k.idd.ForceDump(ctx)
	return nil
}

// This timeout needs to be smaller than the one in
// keybase/client/go/service/simplefs.go so that for situations where error is
// not critical (e.g. quota usage in journal status calls), we'll get (and
// ignore) a timeout before service times us out in RPC.
const simpleFSFastActionTimeout = 6 * time.Second

// SimpleFSSyncStatus - Get sync status.
func (k *SimpleFS) SimpleFSSyncStatus(ctx context.Context, filter keybase1.ListFilter) (keybase1.FSSyncStatus, error) {
	ctx, cancel := context.WithTimeout(
		k.makeContext(ctx), simpleFSFastActionTimeout)
	defer cancel()
	jManager, jErr := libkbfs.GetJournalManager(k.config)
	if jErr != nil {
		k.log.CDebugf(ctx, "Journal not enabled; sending empty response")
		return keybase1.FSSyncStatus{}, nil
	}
	status, tlfIDs := jManager.Status(ctx)
	err := libkbfs.FillInJournalStatusUnflushedPaths(
		ctx, k.config, &status, tlfIDs)
	if err != nil {
		k.log.CDebugf(ctx, "Error setting unflushed paths: %+v; "+
			"sending empty response", err)
		return keybase1.FSSyncStatus{}, nil
	}

	var syncingPaths []string
	if filter == keybase1.ListFilter_NO_FILTER {
		syncingPaths = status.UnflushedPaths
	} else {
		for _, p := range status.UnflushedPaths {

			if isFiltered(filter, stdpath.Base(p)) {
				continue
			}
			syncingPaths = append(syncingPaths, p)
		}
	}

	k.log.CDebugf(ctx, "Sending sync status response with %d syncing bytes",
		status.UnflushedBytes)
	return keybase1.FSSyncStatus{
		TotalSyncingBytes: status.UnflushedBytes,
		SyncingPaths:      syncingPaths,
		EndEstimate:       keybase1.ToTimePtr(status.EndEstimate),
	}, nil
}

// SimpleFSUserEditHistory returns the edit history for the logged-in user.
func (k *SimpleFS) SimpleFSUserEditHistory(ctx context.Context) (
	res []keybase1.FSFolderEditHistory, err error) {
	session, err := idutil.GetCurrentSessionIfPossible(
		ctx, k.config.KBPKI(), true)
	// Return empty history if we are not logged in.
	if err != nil {
		return nil, nil
	}
	return k.config.UserHistory().Get(string(session.Name)), nil
}

// SimpleFSFolderEditHistory returns the edit history for the given TLF.
func (k *SimpleFS) SimpleFSFolderEditHistory(
	ctx context.Context, path keybase1.Path) (
	res keybase1.FSFolderEditHistory, err error) {
	ctx = k.makeContext(ctx)
	fb, _, err := k.getFolderBranchFromPath(ctx, path)
	if err != nil {
		return keybase1.FSFolderEditHistory{}, err
	}
	if fb == (data.FolderBranch{}) {
		return keybase1.FSFolderEditHistory{}, nil
	}

	// Now get the edit history.
	return k.config.KBFSOps().GetEditHistory(ctx, fb)
}

// SimpleFSReset resets the given TLF.
func (k *SimpleFS) SimpleFSReset(
	ctx context.Context, arg keybase1.SimpleFSResetArg) error {
	t, tlfName, _, _, err := remoteTlfAndPath(arg.Path)
	if err != nil {
		return err
	}
	tlfHandle, err := libkbfs.GetHandleFromFolderNameAndType(
		ctx, k.config.KBPKI(), k.config.MDOps(), k.config, tlfName, t)
	if err != nil {
		return err
	}

	var newTlfID *tlf.ID
	if arg.TlfID != "" {
		tlfID, err := tlf.ParseID(arg.TlfID)
		if err != nil {
			return err
		}
		newTlfID = &tlfID
	}

	return k.config.KBFSOps().Reset(ctx, tlfHandle, newTlfID)
}

var _ libkbfs.Observer = (*SimpleFS)(nil)

// LocalChange implements the libkbfs.Observer interface for SimpleFS.
func (k *SimpleFS) LocalChange(
	ctx context.Context, node libkbfs.Node, _ libkbfs.WriteRange) {
	k.subscribeLock.RLock()
	defer k.subscribeLock.RUnlock()
	if node.GetFolderBranch() == k.subscribeCurrFB {
		k.config.Reporter().NotifyPathUpdated(ctx, k.subscribeCurrTlfPathFromGUI)
	}
}

// BatchChanges implements the libkbfs.Observer interface for SimpleFS.
func (k *SimpleFS) BatchChanges(
	ctx context.Context, changes []libkbfs.NodeChange, _ []libkbfs.NodeID) {
	// Don't take any locks while processing these notifications,
	// since it risks deadlock.
	fbs := make(map[data.FolderBranch]bool, 1)
	for _, nc := range changes {
		fbs[nc.Node.GetFolderBranch()] = true
	}

	go func() {
		k.subscribeLock.RLock()
		defer k.subscribeLock.RUnlock()
		if fbs[k.subscribeCurrFB] {
			k.config.Reporter().NotifyPathUpdated(ctx, k.subscribeCurrTlfPathFromGUI)
		}
	}()
}

// TlfHandleChange implements the libkbfs.Observer interface for SimpleFS.
func (k *SimpleFS) TlfHandleChange(_ context.Context, _ *tlfhandle.Handle) {
	// TODO: the GUI might eventually care about a handle change.
}

// SimpleFSGetUserQuotaUsage returns the quota usage information for
// the logged-in user.
func (k *SimpleFS) SimpleFSGetUserQuotaUsage(ctx context.Context) (
	res keybase1.SimpleFSQuotaUsage, err error) {
	ctx = k.makeContext(ctx)
	status, _, err := k.config.KBFSOps().Status(ctx)
	if err != nil {
		return keybase1.SimpleFSQuotaUsage{}, err
	}
	res.UsageBytes = status.UsageBytes
	res.ArchiveBytes = status.ArchiveBytes
	res.LimitBytes = status.LimitBytes
	res.GitUsageBytes = status.GitUsageBytes
	res.GitArchiveBytes = status.GitArchiveBytes
	res.GitLimitBytes = status.GitLimitBytes
	return res, nil
}

// SimpleFSGetTeamQuotaUsage returns the quota usage information for
// the given team.
func (k *SimpleFS) SimpleFSGetTeamQuotaUsage(
	ctx context.Context, teamName keybase1.TeamName) (
	res keybase1.SimpleFSQuotaUsage, err error) {
	ctx = k.makeContext(ctx)
	path := keybase1.NewPathWithKbfsPath(
		fmt.Sprintf("team/%s", teamName.String()))
	fb, _, err := k.getFolderBranchFromPath(ctx, path)
	if err != nil {
		return keybase1.SimpleFSQuotaUsage{}, err
	}
	if fb == (data.FolderBranch{}) {
		return keybase1.SimpleFSQuotaUsage{}, nil
	}

	status, _, err := k.config.KBFSOps().FolderStatus(ctx, fb)
	if err != nil {
		return keybase1.SimpleFSQuotaUsage{}, err
	}

	res.UsageBytes = status.UsageBytes
	res.ArchiveBytes = status.ArchiveBytes
	res.LimitBytes = status.LimitBytes
	res.GitUsageBytes = status.GitUsageBytes
	res.GitArchiveBytes = status.GitArchiveBytes
	res.GitLimitBytes = status.GitLimitBytes
	return res, nil
}

func (k *SimpleFS) getSyncConfig(ctx context.Context, path keybase1.Path) (
	tlfID tlf.ID, config keybase1.FolderSyncConfig,
	err error) {
	t, tlfName, _, _, err := remoteTlfAndPath(path)
	if err != nil {
		return tlf.NullID, keybase1.FolderSyncConfig{}, err
	}
	tlfHandle, err := libkbfs.GetHandleFromFolderNameAndType(
		ctx, k.config.KBPKI(), k.config.MDOps(), k.config, tlfName, t)
	if err != nil {
		return tlf.NullID, keybase1.FolderSyncConfig{}, err
	}

	// Ensure the TLF is initialized by getting the root node first.
	_, _, err = k.config.KBFSOps().GetRootNode(
		ctx, tlfHandle, data.MasterBranch)
	if err != nil {
		return tlf.NullID, keybase1.FolderSyncConfig{}, err
	}

	config, err = k.config.KBFSOps().GetSyncConfig(ctx, tlfHandle.TlfID())
	if err != nil {
		return tlf.NullID, keybase1.FolderSyncConfig{}, err
	}
	return tlfHandle.TlfID(), config, nil
}

func (k *SimpleFS) filterEmptyErr(
	ctx context.Context, path string, err error) error {
	exitEarly, _ := libfs.FilterTLFEarlyExitError(
		ctx, err, k.log, tlf.CanonicalName(path) /* just for logging */)
	if exitEarly {
		return nil
	}
	return err
}

// SimpleFSFolderSyncConfigAndStatus gets the given folder's sync config.
func (k *SimpleFS) SimpleFSFolderSyncConfigAndStatus(
	ctx context.Context, path keybase1.Path) (
	_ keybase1.FolderSyncConfigAndStatus, err error) {
	defer func() {
		err = k.filterEmptyErr(ctx, path.String(), err)
	}()
	ctx = k.makeContext(ctx)
	ctx, err = populateIdentifyBehaviorIfNeeded(ctx, &path, nil)
	if err != nil {
		return keybase1.FolderSyncConfigAndStatus{}, err
	}
	_, config, err := k.getSyncConfig(ctx, path)
	if err != nil {
		return keybase1.FolderSyncConfigAndStatus{}, err
	}
	res := keybase1.FolderSyncConfigAndStatus{Config: config}

	dbc := k.config.DiskBlockCache()
	if config.Mode != keybase1.FolderSyncMode_DISABLED {
		fs, finalElem, err := k.getFSIfExists(ctx, path)
		if err != nil {
			return res, err
		}
		// Use LStat so we don't follow symlinks.
		fi, err := fs.Lstat(finalElem)
		if err != nil {
			return res, err
		}

		if kmg, ok := fi.Sys().(libfs.KBFSMetadataForSimpleFSGetter); ok {
			metadata, err := kmg.KBFSMetadataForSimpleFS()
			if err != nil {
				return keybase1.FolderSyncConfigAndStatus{}, err
			}
			res.Status.PrefetchStatus = metadata.PrefetchStatus
			res.Status.PrefetchProgress =
				metadata.PrefetchProgress.ToProtocolProgress(k.config.Clock())

			libfs, ok := fs.(*libfs.FS)
			if dbc != nil && ok {
				size, err := dbc.GetTlfSize(
					ctx, libfs.RootNode().GetFolderBranch().Tlf,
					libkbfs.DiskBlockSyncCache)
				if err != nil {
					return res, err
				}
				res.Status.StoredBytesTotal = int64(size)
			}
		} else {
			k.log.CDebugf(ctx,
				"Could not get prefetch status from filesys: %T", fi.Sys())
		}
	}

	libkbfs.FillInDiskSpaceStatus(
		ctx, &res.Status, res.Status.PrefetchStatus, dbc)
	return res, err
}

// SimpleFSSetFolderSyncConfig implements the SimpleFSInterface.
func (k *SimpleFS) SimpleFSSetFolderSyncConfig(
	ctx context.Context, arg keybase1.SimpleFSSetFolderSyncConfigArg) (err error) {
	ctx = k.makeContext(ctx)
	ctx, err = populateIdentifyBehaviorIfNeeded(ctx, &arg.Path, nil)
	if err != nil {
		return err
	}
	tlfID, _, err := k.getSyncConfig(ctx, arg.Path)
	if err != nil {
		return err
	}

	_, err = k.config.KBFSOps().SetSyncConfig(ctx, tlfID, arg.Config)
	return err
}

// SimpleFSGetFolder implements the SimpleFSInterface.
func (k *SimpleFS) SimpleFSGetFolder(
	ctx context.Context, kbfsPath keybase1.KBFSPath) (
	res keybase1.FolderWithFavFlags, err error) {
	ctx, err = k.makeContextWithIdentifyBehavior(ctx, kbfsPath.IdentifyBehavior)
	if err != nil {
		return keybase1.FolderWithFavFlags{}, err
	}
	t, tlfName, _, _, err := remoteTlfAndPath(keybase1.NewPathWithKbfs(kbfsPath))
	if err != nil {
		return keybase1.FolderWithFavFlags{}, err
	}
	tlfHandle, err := libkbfs.GetHandleFromFolderNameAndType(
		ctx, k.config.KBPKI(), k.config.MDOps(), k.config, tlfName, t)
	if err != nil {
		return keybase1.FolderWithFavFlags{}, err
	}
	return k.config.KBFSOps().GetFolderWithFavFlags(ctx, tlfHandle)
}

// SimpleFSSyncConfigAndStatus implements the SimpleFSInterface.
func (k *SimpleFS) SimpleFSSyncConfigAndStatus(ctx context.Context,
	identifyBehavior *keybase1.TLFIdentifyBehavior) (
	res keybase1.SyncConfigAndStatusRes, err error) {
	ctx, err = k.makeContextWithIdentifyBehavior(ctx, identifyBehavior)
	if err != nil {
		return keybase1.SyncConfigAndStatusRes{}, err
	}
	dbc := k.config.DiskBlockCache()
	bytesAvail, bytesTotal := libkbfs.GetLocalDiskStats(ctx, dbc)

	hasRoom := true
	if dbc != nil {
		hasRoom, _, err = dbc.DoesCacheHaveSpace(ctx, libkbfs.DiskBlockSyncCache)
		if err != nil {
			return keybase1.SyncConfigAndStatusRes{}, err
		}
	}

	tlfMDs := k.config.KBFSOps().GetAllSyncedTlfMDs(ctx)

	session, err := idutil.GetCurrentSessionIfPossible(
		ctx, k.config.KBPKI(), true)
	if err != nil {
		return keybase1.SyncConfigAndStatusRes{}, err
	}

	res.Folders = make(
		[]keybase1.FolderSyncConfigAndStatusWithFolder, len(tlfMDs))
	allNotStarted := true
	i := 0
	for tlfID, md := range tlfMDs {
		config, err := k.config.KBFSOps().GetSyncConfig(ctx, tlfID)
		if err != nil {
			return keybase1.SyncConfigAndStatusRes{}, err
		}

		if config.Mode == keybase1.FolderSyncMode_DISABLED {
			panic(fmt.Sprintf(
				"Folder %s has sync unexpectedly disabled", tlfID))
		}

		f := keybase1.Folder{
			Name:       string(md.Handle.GetPreferredFormat(session.Name)),
			FolderType: tlfID.Type().FolderType(),
			Private:    tlfID.Type() != tlf.Public,
		}

		res.Folders[i].Folder = f
		res.Folders[i].Config = config
		status := md.MD.PrefetchStatus.ToProtocolStatus()
		res.Folders[i].Status.PrefetchStatus = status
		if status != keybase1.PrefetchStatus_NOT_STARTED {
			allNotStarted = false
		}
		if md.MD.PrefetchProgress != nil {
			res.Folders[i].Status.PrefetchProgress =
				md.MD.PrefetchProgress.ToProtocolProgress(k.config.Clock())
		}
		res.Folders[i].Status.LocalDiskBytesAvailable = bytesAvail
		res.Folders[i].Status.LocalDiskBytesTotal = bytesTotal
		if res.Folders[i].Status.PrefetchStatus !=
			keybase1.PrefetchStatus_COMPLETE {
			res.Folders[i].Status.OutOfSyncSpace = !hasRoom
		}

		if dbc != nil {
			size, err := dbc.GetTlfSize(ctx, tlfID, libkbfs.DiskBlockSyncCache)
			if err != nil {
				return keybase1.SyncConfigAndStatusRes{}, err
			}
			res.Folders[i].Status.StoredBytesTotal = int64(size)
		}

		i++
	}

	// Sort by folder name.
	sort.SliceStable(res.Folders, func(i, j int) bool {
		return res.Folders[i].Folder.ToString() <
			res.Folders[j].Folder.ToString()
	})

	if len(tlfMDs) > 0 {
		p := k.config.BlockOps().Prefetcher().OverallSyncStatus()
		res.OverallStatus.PrefetchProgress = p.ToProtocolProgress(
			k.config.Clock())
		if allNotStarted {
			res.OverallStatus.PrefetchStatus =
				keybase1.PrefetchStatus_NOT_STARTED
		} else {
			res.OverallStatus.PrefetchStatus = p.ToProtocolStatus()
		}
	}

	res.OverallStatus.LocalDiskBytesAvailable = bytesAvail
	res.OverallStatus.LocalDiskBytesTotal = bytesTotal
	if res.OverallStatus.PrefetchStatus !=
		keybase1.PrefetchStatus_COMPLETE {
		res.OverallStatus.OutOfSyncSpace = !hasRoom
	}

	if dbc != nil {
		statusMap := dbc.Status(ctx)
		status, ok := statusMap["SyncBlockCache"]
		if ok {
			res.OverallStatus.StoredBytesTotal = int64(status.BlockBytes)
		}
	}

	return res, nil
}

// SimpleFSClearConflictState implements the SimpleFS interface.
func (k *SimpleFS) SimpleFSClearConflictState(ctx context.Context,
	path keybase1.Path) (err error) {
	ctx, err = populateIdentifyBehaviorIfNeeded(ctx, &path, nil)
	if err != nil {
		return err
	}
	ctx, err = k.startOpWrapContext(k.makeContext(ctx))
	if err != nil {
		return err
	}
	defer func() {
		err := libcontext.CleanupCancellationDelayer(ctx)
		if err != nil {
			k.log.CDebugf(ctx, "Error cancelling delayer: %+v", err)
		}
	}()
	t, tlfName, _, _, err := remoteTlfAndPath(path)
	if err != nil {
		return err
	}
	tlfHandle, err := libkbfs.GetHandleFromFolderNameAndType(
		ctx, k.config.KBPKI(), k.config.MDOps(), k.config, tlfName, t)
	if err != nil {
		return err
	}
	tlfID := tlfHandle.TlfID()
	return k.config.KBFSOps().ClearConflictView(ctx, tlfID)
}

// SimpleFSFinishResolvingConflict implements the SimpleFS interface.
func (k *SimpleFS) SimpleFSFinishResolvingConflict(ctx context.Context,
	path keybase1.Path) (err error) {
	ctx, err = populateIdentifyBehaviorIfNeeded(ctx, &path, nil)
	if err != nil {
		return err
	}
	ctx, err = k.startOpWrapContext(k.makeContext(ctx))
	if err != nil {
		return err
	}
	defer func() {
		err := libcontext.CleanupCancellationDelayer(ctx)
		if err != nil {
			k.log.CDebugf(ctx, "Error cancelling delayer: %+v", err)
		}
	}()
	t, tlfName, _, _, err := remoteTlfAndPath(path)
	if err != nil {
		return err
	}
	tlfHandle, err := libkbfs.GetHandleFromFolderNameAndType(
		ctx, k.config.KBPKI(), k.config.MDOps(), k.config, tlfName, t)
	if err != nil {
		return err
	}
	tlfID := tlfHandle.TlfID()
	branch, err := k.branchNameFromPath(ctx, tlfHandle, path)
	if err != nil {
		return err
	}
	return k.config.KBFSOps().FinishResolvingConflict(ctx, data.FolderBranch{
		Tlf:    tlfID,
		Branch: branch,
	})
}

// SimpleFSForceStuckConflict implements the SimpleFS interface.
func (k *SimpleFS) SimpleFSForceStuckConflict(
	ctx context.Context, path keybase1.Path) (err error) {
	ctx, err = populateIdentifyBehaviorIfNeeded(ctx, &path, nil)
	if err != nil {
		return err
	}
	ctx, err = k.startOpWrapContext(k.makeContext(ctx))
	if err != nil {
		return err
	}
	defer func() {
		err := libcontext.CleanupCancellationDelayer(ctx)
		if err != nil {
			k.log.CDebugf(ctx, "Error cancelling delayer: %+v", err)
		}
	}()
	t, tlfName, _, _, err := remoteTlfAndPath(path)
	if err != nil {
		return err
	}
	tlfHandle, err := libkbfs.GetHandleFromFolderNameAndType(
		ctx, k.config.KBPKI(), k.config.MDOps(), k.config, tlfName, t)
	if err != nil {
		return err
	}
	tlfID := tlfHandle.TlfID()
	return k.config.KBFSOps().ForceStuckConflictForTesting(ctx, tlfID)
}

// SimpleFSGetOnlineStatus implements the SimpleFSInterface.
func (k *SimpleFS) SimpleFSGetOnlineStatus(ctx context.Context) (keybase1.KbfsOnlineStatus, error) {
	return k.onlineStatusTracker.GetOnlineStatus(), nil
}

// SimpleFSCheckReachability implements the SimpleFSInterface.
func (k *SimpleFS) SimpleFSCheckReachability(ctx context.Context) error {
	ctx = k.makeContext(ctx)
	mdServer := k.config.MDServer()
	if mdServer != nil {
		// KeybaseService (which holds SimpleFS service) gets init'ed before
		// MDServer is set. HOTPOT-1269
		mdServer.CheckReachability(ctx)
	}
	return nil
}

// SimpleFSSetDebugLevel implements the SimpleFSInterface.
func (k *SimpleFS) SimpleFSSetDebugLevel(
	_ context.Context, level string) error {
	k.config.SetVLogLevel(level)
	return nil
}

// SimpleFSSettings implements the SimpleFSInterface.
func (k *SimpleFS) SimpleFSSettings(ctx context.Context) (settings keybase1.FSSettings, err error) {
	defer func() {
		k.log.CDebugf(ctx, "SimpleFSSettings settings=%+v err=%+v", settings, err)
	}()
	db := k.config.GetSettingsDB()
	if db == nil {
		return keybase1.FSSettings{}, libkbfs.ErrNoSettingsDB
	}
	return db.Settings(ctx)
}

// SimpleFSSetNotificationThreshold implements the SimpleFSInterface.
func (k *SimpleFS) SimpleFSSetNotificationThreshold(ctx context.Context, threshold int64) (err error) {
	defer func() {
		k.log.CDebugf(ctx, "SimpleFSSetNotificationThreshold threshold=%d err=%+v", threshold, err)
	}()
	db := k.config.GetSettingsDB()
	if db == nil {
		return libkbfs.ErrNoSettingsDB
	}
	return db.SetNotificationThreshold(ctx, threshold)
}

// SimpleFSObfuscatePath implements the SimpleFSInterface.
func (k *SimpleFS) SimpleFSObfuscatePath(
	ctx context.Context, path keybase1.Path) (res string, err error) {
	ctx, err = k.startOpWrapContext(k.makeContext(ctx))
	if err != nil {
		return "", err
	}
	defer func() {
		err := libcontext.CleanupCancellationDelayer(ctx)
		if err != nil {
			k.log.CDebugf(ctx, "Error cancelling delayer: %+v", err)
		}
	}()
	t, tlfName, midPath, finalElem, err := remoteTlfAndPath(path)
	if err != nil {
		return "", err
	}
	tlfHandle, err := libkbfs.GetHandleFromFolderNameAndType(
		ctx, k.config.KBPKI(), k.config.MDOps(), k.config, tlfName, t)
	if err != nil {
		return "", err
	}
	branch, err := k.branchNameFromPath(ctx, tlfHandle, path)
	if err != nil {
		return "", err
	}
	fs, err := k.newFS(
		ctx, k.config, tlfHandle, branch, "", false)
	if err != nil {
		return "", err
	}
	asLibFS, ok := fs.(*libfs.FS)
	if !ok {
		return "", errors.Errorf("FS was not a KBFS file system: %T", fs)
	}
	p := fs.Join(midPath, finalElem)
	return stdpath.Join(
		tlfHandle.GetCanonicalPath(), asLibFS.PathForLogging(p)), nil
}

// SimpleFSDeobfuscatePath implements the SimpleFSInterface.
func (k *SimpleFS) SimpleFSDeobfuscatePath(
	ctx context.Context, path keybase1.Path) (res []string, err error) {
	ctx, err = k.startOpWrapContext(k.makeContext(ctx))
	if err != nil {
		return nil, err
	}
	defer func() {
		err := libcontext.CleanupCancellationDelayer(ctx)
		if err != nil {
			k.log.CDebugf(ctx, "Error cancelling delayer: %+v", err)
		}
	}()
	t, tlfName, midPath, finalElem, err := remoteTlfAndPath(path)
	if err != nil {
		return nil, err
	}
	tlfHandle, err := libkbfs.GetHandleFromFolderNameAndType(
		ctx, k.config.KBPKI(), k.config.MDOps(), k.config, tlfName, t)
	if err != nil {
		return nil, err
	}
	branch, err := k.branchNameFromPath(ctx, tlfHandle, path)
	if err != nil {
		return nil, err
	}
	fs, err := k.newFS(
		ctx, k.config, tlfHandle, branch, "", false)
	if err != nil {
		return nil, err
	}
	asLibFS, ok := fs.(*libfs.FS)
	if !ok {
		return nil, errors.Errorf("FS was not a KBFS file system: %T", fs)
	}
	p := fs.Join(midPath, finalElem)
	resWithoutPrefix, err := libfs.Deobfuscate(ctx, asLibFS, p)
	if err != nil {
		return nil, err
	}
	for _, r := range resWithoutPrefix {
		res = append(res, stdpath.Join(tlfHandle.GetCanonicalPath(), r))
	}
	if len(res) == 0 {
		return nil, errors.New("Found no matching paths")
	}
	return res, nil
}

// SimpleFSGetStats implements the SimpleFSInterface.
func (k *SimpleFS) SimpleFSGetStats(ctx context.Context) (
	res keybase1.SimpleFSStats, err error) {
	ctx = k.makeContext(ctx)
	dbc := k.config.DiskBlockCache()
	if dbc == nil {
		return keybase1.SimpleFSStats{}, nil
	}

	res.ProcessStats = runtimestats.GetProcessStats(keybase1.ProcessType_KBFS)

	statusMap := dbc.Status(ctx)
	if status, ok := statusMap["SyncBlockCache"]; ok {
		res.SyncCacheDbStats = status.BlockDBStats

		res.RuntimeDbStats = append(res.RuntimeDbStats,
			keybase1.DbStats{
				Type:            keybase1.DbType_FS_SYNC_BLOCK_CACHE,
				MemCompActive:   status.MemCompActive,
				TableCompActive: status.TableCompActive,
			})
		res.RuntimeDbStats = append(res.RuntimeDbStats,
			keybase1.DbStats{
				Type:            keybase1.DbType_FS_SYNC_BLOCK_CACHE_META,
				MemCompActive:   status.MetaMemCompActive,
				TableCompActive: status.MetaTableCompActive,
			})
	}
	if status, ok := statusMap["WorkingSetBlockCache"]; ok {
		res.BlockCacheDbStats = status.BlockDBStats
		res.RuntimeDbStats = append(res.RuntimeDbStats,
			keybase1.DbStats{
				Type:            keybase1.DbType_FS_BLOCK_CACHE,
				MemCompActive:   status.MemCompActive,
				TableCompActive: status.TableCompActive,
			})
		res.RuntimeDbStats = append(res.RuntimeDbStats,
			keybase1.DbStats{
				Type:            keybase1.DbType_FS_BLOCK_CACHE_META,
				MemCompActive:   status.MetaMemCompActive,
				TableCompActive: status.MetaTableCompActive,
			})
	}
	return res, nil
}

// SimpleFSSubscribePath implements the SimpleFSInterface.
func (k *SimpleFS) SimpleFSSubscribePath(
	ctx context.Context, arg keybase1.SimpleFSSubscribePathArg) (err error) {
	defer func() {
		err = k.filterEmptyErr(ctx, arg.KbfsPath, err)
	}()
	ctx, err = k.makeContextWithIdentifyBehavior(ctx, arg.IdentifyBehavior)
	if err != nil {
		return err
	}
	interval := time.Second * time.Duration(arg.DeduplicateIntervalSecond)
	return k.subscriber.SubscribePath(ctx, libkbfs.SubscriptionID(arg.SubscriptionID), arg.KbfsPath, arg.Topic, &interval)
}

// SimpleFSSubscribeNonPath implements the SimpleFSInterface.
func (k *SimpleFS) SimpleFSSubscribeNonPath(
	ctx context.Context, arg keybase1.SimpleFSSubscribeNonPathArg) (err error) {
	ctx, err = k.makeContextWithIdentifyBehavior(ctx, arg.IdentifyBehavior)
	if err != nil {
		return err
	}
	interval := time.Second * time.Duration(arg.DeduplicateIntervalSecond)
	return k.subscriber.SubscribeNonPath(ctx, libkbfs.SubscriptionID(arg.SubscriptionID), arg.Topic, &interval)
}

// SimpleFSUnsubscribe implements the SimpleFSInterface.
func (k *SimpleFS) SimpleFSUnsubscribe(
	ctx context.Context, arg keybase1.SimpleFSUnsubscribeArg) (err error) {
	ctx, err = k.makeContextWithIdentifyBehavior(ctx, arg.IdentifyBehavior)
	if err != nil {
		return err
	}
	k.subscriber.Unsubscribe(ctx, libkbfs.SubscriptionID(arg.SubscriptionID))
	return nil
}

// SimpleFSStartDownload implements the SimpleFSInterface.
func (k *SimpleFS) SimpleFSStartDownload(
	ctx context.Context, arg keybase1.SimpleFSStartDownloadArg) (
	downloadID string, err error) {
	return k.downloadManager.startDownload(ctx, arg)
}

// SimpleFSGetDownloadStatus implements the SimpleFSInterface.
func (k *SimpleFS) SimpleFSGetDownloadStatus(ctx context.Context) (
	status keybase1.DownloadStatus, err error) {
	return k.downloadManager.getDownloadStatus(ctx), nil
}

// SimpleFSCancelDownload implements the SimpleFSInterface.
func (k *SimpleFS) SimpleFSCancelDownload(
	ctx context.Context, downloadID string) (err error) {
	return k.downloadManager.cancelDownload(ctx, downloadID)
}

// SimpleFSDismissDownload implements the SimpleFSInterface.
func (k *SimpleFS) SimpleFSDismissDownload(
	ctx context.Context, downloadID string) (err error) {
	k.downloadManager.dismissDownload(ctx, downloadID)
	return nil
}

// SimpleFSGetDownloadInfo implements the SimpleFSInterface.
func (k *SimpleFS) SimpleFSGetDownloadInfo(
	ctx context.Context, downloadID string) (
	downloadInfo keybase1.DownloadInfo, err error) {
	return k.downloadManager.getDownloadInfo(downloadID)
}

// SimpleFSConfigureDownload implements the SimpleFSInterface.
func (k *SimpleFS) SimpleFSConfigureDownload(
	ctx context.Context, arg keybase1.SimpleFSConfigureDownloadArg) (err error) {
	k.downloadManager.configureDownload(arg.CacheDirOverride, arg.DownloadDirOverride)
	return nil
}

// Copied from net/http/sniff.go: the algorithm uses at most sniffLen bytes to
// make its decision.
const sniffLen = 512

// getContentType detects the content type of the file located at kbfsPath.
// It's adapted from serveContent in net/http/fs.go. The algorithm might change
// in the future, but it's OK as we are using the invariance mechanism and the
// check in libhttpserver happens right before writing the content, using the
// real HTTP headers from the http package.
func (k *SimpleFS) getContentType(ctx context.Context, kbfsPath keybase1.KBFSPath) (
	contentType string, err error) {
	contentType = mime.TypeByExtension(filepath.Ext(kbfsPath.Path))
	if len(contentType) > 0 {
		return contentType, nil
	}

	fs, finalElem, err := k.getFS(ctx, keybase1.NewPathWithKbfs(kbfsPath))
	if err != nil {
		return "", err
	}
	f, err := fs.OpenFile(finalElem, os.O_RDONLY, 0644)
	if err != nil {
		return "", err
	}
	var buf [sniffLen]byte
	n, _ := io.ReadFull(f, buf[:])
	return http.DetectContentType(buf[:n]), nil
}

// SimpleFSGetGUIFileContext implements the SimpleFSInterface.
func (k *SimpleFS) SimpleFSGetGUIFileContext(ctx context.Context,
	kbfsPath keybase1.KBFSPath) (resource keybase1.GUIFileContext, err error) {
	wrappedPath := keybase1.NewPathWithKbfs(kbfsPath)
	ctx, err = k.startSyncOp(ctx, "GetGUIFileContext", "", &wrappedPath, nil)
	if err != nil {
		return keybase1.GUIFileContext{}, err
	}
	defer func() { k.doneSyncOp(ctx, err) }()

	if len(kbfsPath.Path) == 0 {
		return keybase1.GUIFileContext{}, errors.New("empty path")
	}
	if k.localHTTPServer == nil {
		return keybase1.GUIFileContext{}, errors.New("HTTP server is disabled")
	}

	contentType, err := k.getContentType(ctx, kbfsPath)
	if err != nil {
		return keybase1.GUIFileContext{}, err
	}
	viewType, invariance := libhttpserver.GetGUIFileContextFromContentType(contentType)

	// Refresh the token every time. This RPC is called everytime a file is
	// being viewed and we have a cache size of 64 so this shouldn't be a
	// problem.
	token, err := k.localHTTPServer.NewToken()
	if err != nil {
		return keybase1.GUIFileContext{}, err
	}
	address, err := k.localHTTPServer.Address()
	if err != nil {
		return keybase1.GUIFileContext{}, err
	}

	u := url.URL{
		Scheme:   "http",
		Host:     address,
		Path:     path.Join("/files", kbfsPath.Path),
		RawQuery: "token=" + token + "&viewTypeInvariance=" + invariance,
	}

	return keybase1.GUIFileContext{
		ContentType: contentType,
		ViewType:    viewType,
		Url:         u.String(),
	}, nil
}

// SimpleFSGetFilesTabBadge implements the SimpleFSInterface.
func (k *SimpleFS) SimpleFSGetFilesTabBadge(ctx context.Context) (
	keybase1.FilesTabBadge, error) {
	return k.config.KBFSOps().GetBadge(ctx)
}
