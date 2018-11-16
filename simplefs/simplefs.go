// Copyright 2016-2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package simplefs

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	stdpath "path"
	"strings"
	"sync"
	"time"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/env"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/kbfsmd"
	"github.com/keybase/kbfs/libfs"
	"github.com/keybase/kbfs/libhttpserver"
	"github.com/keybase/kbfs/libkbfs"
	"github.com/keybase/kbfs/tlf"
	"golang.org/x/sync/errgroup"
	"gopkg.in/src-d/go-billy.v4"
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
	context.Context, libkbfs.Config, *libkbfs.TlfHandle, libkbfs.BranchName,
	string) (billy.Filesystem, error)

func defaultNewFS(ctx context.Context, config libkbfs.Config,
	tlfHandle *libkbfs.TlfHandle, branch libkbfs.BranchName, subdir string) (
	billy.Filesystem, error) {
	return libfs.NewFS(
		ctx, config, tlfHandle, branch, subdir, "", keybase1.MDPriorityNormal)
}

// SimpleFS is the simple filesystem rpc layer implementation.
type SimpleFS struct {
	// log for logging - constant, does not need locking.
	log logger.Logger
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

	subscribeLock     sync.RWMutex
	subscribeCurrPath string
	subscribeCurrFB   libkbfs.FolderBranch

	localHTTPServer *libhttpserver.Server
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

func newSimpleFS(appStateUpdater env.AppStateUpdater, config libkbfs.Config) *SimpleFS {
	log := config.MakeLogger("simplefs")
	localHTTPServer, err := libhttpserver.New(appStateUpdater, config)
	if err != nil {
		log.Fatalf("initializing localHTTPServer error: %v", err)
	}
	return &SimpleFS{
		config:          config,
		handles:         map[keybase1.OpID]*handle{},
		inProgress:      map[keybase1.OpID]*inprogress{},
		log:             log,
		newFS:           defaultNewFS,
		idd:             libkbfs.NewImpatientDebugDumperForForcedDumps(config),
		localHTTPServer: localHTTPServer,
	}
}

// NewSimpleFS creates a new SimpleFS instance.
func NewSimpleFS(appStateUpdater env.AppStateUpdater, config libkbfs.Config) keybase1.SimpleFSInterface {
	return newSimpleFS(appStateUpdater, config)
}

func (k *SimpleFS) makeContext(ctx context.Context) context.Context {
	return libkbfs.CtxWithRandomIDReplayable(ctx, ctxIDKey, ctxOpID, k.log)
}

func rawPathFromKbfsPath(path keybase1.Path) (string, error) {
	pt, err := path.PathType()
	if err != nil {
		return "", err
	}

	switch pt {
	case keybase1.PathType_KBFS:
		return stdpath.Clean(path.Kbfs()), nil
	case keybase1.PathType_KBFS_ARCHIVED:
		return stdpath.Clean(path.KbfsArchived().Path), nil
	default:
		return "", errOnlyRemotePathSupported
	}
}

// remoteTlfAndPath decodes a remote path for us.
func remoteTlfAndPath(path keybase1.Path) (
	t tlf.Type, tlfName, middlePath, finalElem string, err error) {
	raw, err := rawPathFromKbfsPath(path)
	if err != nil {
		return tlf.Private, "", "", "", err
	}
	if stdpath.IsAbs(raw) {
		raw = raw[1:]
	}
	ps := strings.Split(raw, `/`)
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
	ctx context.Context, tlfHandle *libkbfs.TlfHandle, path keybase1.Path) (
	libkbfs.BranchName, error) {
	pt, err := path.PathType()
	if err != nil {
		return "", err
	}
	switch pt {
	case keybase1.PathType_KBFS:
		return libkbfs.MasterBranch, nil
	case keybase1.PathType_KBFS_ARCHIVED:
		archivedParam := path.KbfsArchived().ArchivedParam
		archivedType, err := archivedParam.KBFSArchivedType()
		if err != nil {
			return "", err
		}
		switch archivedType {
		case keybase1.KBFSArchivedType_REVISION:
			return libkbfs.MakeRevBranchName(
				kbfsmd.Revision(archivedParam.Revision())), nil
		case keybase1.KBFSArchivedType_TIME:
			t := keybase1.FromTime(archivedParam.Time())
			rev, err := libkbfs.GetMDRevisionByTime(ctx, k.config, tlfHandle, t)
			if err != nil {
				return "", err
			}
			return libkbfs.MakeRevBranchName(rev), nil
		case keybase1.KBFSArchivedType_TIME_STRING:
			t := archivedParam.TimeString()
			rev, err := libfs.RevFromTimeString(ctx, k.config, tlfHandle, t)
			if err != nil {
				return "", err
			}
			return libkbfs.MakeRevBranchName(rev), nil
		case keybase1.KBFSArchivedType_REL_TIME_STRING:
			t := archivedParam.RelTimeString()
			rev, err := libfs.RevFromRelativeTimeString(
				ctx, k.config, tlfHandle, t)
			if err != nil {
				return "", err
			}
			return libkbfs.MakeRevBranchName(rev), nil
		default:
			return "", simpleFSError{"Invalid archived type for branch name"}
		}
	default:
		return "", simpleFSError{"Invalid path type for branch name"}
	}
}

func (k *SimpleFS) getFS(ctx context.Context, path keybase1.Path) (
	fs billy.Filesystem, finalElem string, err error) {
	pt, err := path.PathType()
	if err != nil {
		return nil, "", err
	}
	switch pt {
	case keybase1.PathType_KBFS, keybase1.PathType_KBFS_ARCHIVED:
		t, tlfName, restOfPath, finalElem, err := remoteTlfAndPath(path)
		if err != nil {
			return nil, "", err
		}
		tlfHandle, err := libkbfs.GetHandleFromFolderNameAndType(
			ctx, k.config.KBPKI(), k.config.MDOps(), tlfName, t)
		if err != nil {
			return nil, "", err
		}
		branch, err := k.branchNameFromPath(ctx, tlfHandle, path)
		if err != nil {
			return nil, "", err
		}
		fs, err := k.newFS(ctx, k.config, tlfHandle, branch, restOfPath)
		if err != nil {
			if exitEarly, _ := libfs.FilterTLFEarlyExitError(
				ctx, err, k.log, tlfHandle.GetCanonicalName()); exitEarly {
				return nil, finalElem, libfs.TlfDoesNotExist{}
			}
			return nil, "", err
		}
		return fs, finalElem, nil
	case keybase1.PathType_LOCAL:
		fs = osfs.New(stdpath.Dir(path.Local()))
		return fs, stdpath.Base(path.Local()), nil
	default:
		return nil, "", simpleFSError{"Invalid path type"}
	}
}

func deTy2Ty(et libkbfs.EntryType) keybase1.DirentType {
	switch et {
	case libkbfs.Exec:
		return keybase1.DirentType_EXEC
	case libkbfs.File:
		return keybase1.DirentType_FILE
	case libkbfs.Dir:
		return keybase1.DirentType_DIR
	case libkbfs.Sym:
		return keybase1.DirentType_SYM
	}
	panic("deTy2Ty unreachable")
}

func (k *SimpleFS) favoriteList(ctx context.Context, path keybase1.Path, t tlf.Type) ([]keybase1.Dirent, error) {
	session, err := k.config.KBPKI().GetCurrentSession(ctx)
	// Return empty directory listing if we are not logged in.
	if err != nil {
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
		res[len(res)-1].DirentType = deTy2Ty(libkbfs.Dir)

		handle, err := libfs.ParseTlfHandlePreferredQuick(ctx, k.config.KBPKI(), string(pname), t)
		if err != nil {
			k.log.Errorf("ParseTlfHandlePreferredQuick: %s %q %v", t, pname, err)
			continue
		}
		res[len(res)-1].Writable, err = libfs.IsWriter(ctx, k.config.KBPKI(), handle)
		if err != nil {
			k.log.Errorf("libfs.IsWriter: %q %+v", pname, err)
			continue
		}
	}
	return res, nil
}

func setStat(de *keybase1.Dirent, fi os.FileInfo) error {
	de.Time = keybase1.ToTime(fi.ModTime())
	de.Size = int(fi.Size()) // TODO: FIX protocol

	t := libkbfs.File
	if fi.IsDir() {
		t = libkbfs.Dir
	} else if fi.Mode()&0100 != 0 {
		t = libkbfs.Exec
	} else if fi.Mode()&os.ModeSymlink != 0 {
		t = libkbfs.Sym
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
	context.Context, error) {
	ctx = k.makeContext(ctx)
	ctx, cancel := context.WithCancel(ctx)
	k.lock.Lock()
	k.inProgress[opid] = &inprogress{
		desc,
		cancel,
		make(chan error, 1),
		keybase1.OpProgress{OpType: opType},
	}
	k.lock.Unlock()
	// ignore error, this is just for logging.
	descBS, _ := json.Marshal(desc)
	k.log.CDebugf(ctx, "start %X %s", opid, descBS)
	return k.startOpWrapContext(ctx)
}

func (k *SimpleFS) doneOp(ctx context.Context, opid keybase1.OpID, err error) {
	k.lock.Lock()
	w, ok := k.inProgress[opid]
	if ok {
		w.progress.EndEstimate = keybase1.ToTime(k.config.Clock().Now())
	}
	k.lock.Unlock()
	if ok {
		w.done <- err
		close(w.done)
	}
	k.log.CDebugf(ctx, "done op %X, status=%v", opid, err)
	if ctx != nil {
		libkbfs.CleanupCancellationDelayer(ctx)
	}
}

func (k *SimpleFS) startAsync(
	ctx context.Context, opid keybase1.OpID, opType keybase1.AsyncOps,
	desc keybase1.OpDescription,
	callback func(context.Context) error) error {
	ctxAsync, e0 := k.startOp(context.Background(), opid, opType, desc)
	if e0 != nil {
		return e0
	}
	// Bind the old context to the new context, for debugging purposes.
	k.log.CDebugf(ctx, "Launching new async operation with SFSID=%s",
		ctxAsync.Value(ctxIDKey))
	go func() (err error) {
		defer func() { k.doneOp(ctxAsync, opid, err) }()
		return callback(ctxAsync)
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
	libkbfs.FolderBranch, string, error) {
	t, tlfName, _, _, err := remoteTlfAndPath(path)
	if err != nil {
		return libkbfs.FolderBranch{}, "", err
	}
	tlfHandle, err := libkbfs.GetHandleFromFolderNameAndType(
		ctx, k.config.KBPKI(), k.config.MDOps(), tlfName, t)
	if err != nil {
		return libkbfs.FolderBranch{}, "", err
	}

	// Get the root node first to initialize the TLF.
	node, _, err := k.config.KBFSOps().GetRootNode(
		ctx, tlfHandle, libkbfs.MasterBranch)
	if err != nil {
		return libkbfs.FolderBranch{}, "", err
	}
	if node == nil {
		return libkbfs.FolderBranch{}, tlfHandle.GetCanonicalPath(), nil
	}
	return node.GetFolderBranch(), tlfHandle.GetCanonicalPath(), nil
}

func (k *SimpleFS) refreshSubscription(
	ctx context.Context, path keybase1.Path) error {
	pType, err := path.PathType()
	if err != nil {
		return err
	}
	if pType != keybase1.PathType_KBFS {
		k.log.CDebugf(ctx, "Ignoring subscription for path of type %s", pType)
		return nil
	}

	k.subscribeLock.Lock()
	defer k.subscribeLock.Unlock()

	// TODO: when favorites caching is ready, handle folder-list paths
	// like `/keybase/private` here.

	fb, subscribePath, err := k.getFolderBranchFromPath(ctx, path)
	if err != nil {
		return err
	}
	if fb == (libkbfs.FolderBranch{}) {
		k.log.CDebugf(
			ctx, "Ignoring subscription for empty TLF %s", subscribePath)
		return nil
	}

	if k.subscribeCurrPath == subscribePath {
		return nil
	}

	if k.subscribeCurrPath != "" {
		err = k.config.Notifier().UnregisterFromChanges(
			[]libkbfs.FolderBranch{k.subscribeCurrFB}, k)
		if err != nil {
			return err
		}
	}

	k.log.CDebugf(ctx, "Subscribing to %s", subscribePath)
	err = k.config.Notifier().RegisterForChanges(
		[]libkbfs.FolderBranch{fb}, k)
	if err != nil {
		return err
	}
	k.subscribeCurrPath = subscribePath
	k.subscribeCurrFB = fb
	return nil
}

// SimpleFSList - Begin list of items in directory at path
// Retrieve results with readList()
// Cannot be a single file to get flags/status,
// must be a directory.
func (k *SimpleFS) SimpleFSList(ctx context.Context, arg keybase1.SimpleFSListArg) error {
	return k.startAsync(ctx, arg.OpID, keybase1.AsyncOps_LIST,
		keybase1.NewOpDescriptionWithList(
			keybase1.ListArgs{
				OpID: arg.OpID, Path: arg.Path, Filter: arg.Filter,
			}),
		func(ctx context.Context) (err error) {
			var res []keybase1.Dirent

			rawPath, err := rawPathFromKbfsPath(arg.Path)
			if err != nil {
				return err
			}
			switch {
			case rawPath == "/":
				res = []keybase1.Dirent{
					{Name: "private", DirentType: deTy2Ty(libkbfs.Dir)},
					{Name: "public", DirentType: deTy2Ty(libkbfs.Dir)},
					{Name: "team", DirentType: deTy2Ty(libkbfs.Dir)},
				}
			case rawPath == `/public`:
				res, err = k.favoriteList(ctx, arg.Path, tlf.Public)
			case rawPath == `/private`:
				res, err = k.favoriteList(ctx, arg.Path, tlf.Private)
			case rawPath == `/team`:
				res, err = k.favoriteList(ctx, arg.Path, tlf.SingleTeam)
			default:
				fs, finalElem, err := k.getFS(ctx, arg.Path)
				switch err.(type) {
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
				} else {
					fis = append(fis, finalElemFI)
				}
				for _, fi := range fis {
					if finalElemFI.IsDir() &&
						isFiltered(arg.Filter, fi.Name()) {
						continue
					}

					var d keybase1.Dirent
					err := setStat(&d, fi)
					if err != nil {
						return err
					}
					res = append(res, d)
				}
				k.updateReadProgress(arg.OpID, 0, int64(len(fis)))
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

		fs, finalElem, err := k.getFS(ctx, path)
		switch err.(type) {
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
			err := setStat(&d, fi)
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
				err := setStat(&de, fi)
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

// SimpleFSListRecursiveToDepth - Begin recursive list of items in directory at path up to a given depth.
func (k *SimpleFS) SimpleFSListRecursiveToDepth(ctx context.Context, arg keybase1.SimpleFSListRecursiveToDepthArg) error {
	return k.startAsync(ctx, arg.OpID, keybase1.AsyncOps_LIST_RECURSIVE_TO_DEPTH,
		keybase1.NewOpDescriptionWithListRecursiveToDepth(
			keybase1.ListToDepthArgs{
				OpID: arg.OpID, Path: arg.Path, Filter: arg.Filter, Depth: arg.Depth,
			}),
		k.listRecursiveToDepth(arg.OpID, arg.Path, arg.Filter, arg.Depth, arg.RefreshSubscription),
	)
}

// SimpleFSListRecursive - Begin recursive list of items in directory at path
func (k *SimpleFS) SimpleFSListRecursive(ctx context.Context, arg keybase1.SimpleFSListRecursiveArg) error {
	return k.startAsync(ctx, arg.OpID, keybase1.AsyncOps_LIST_RECURSIVE,
		keybase1.NewOpDescriptionWithListRecursive(
			keybase1.ListArgs{
				OpID: arg.OpID, Path: arg.Path, Filter: arg.Filter,
			}),
		k.listRecursiveToDepth(arg.OpID, arg.Path, arg.Filter, -1, arg.RefreshSubscription),
	)
}

// SimpleFSReadList - Get list of Paths in progress. Can indicate status of pending
// to get more entries.
func (k *SimpleFS) SimpleFSReadList(_ context.Context, opid keybase1.OpID) (keybase1.SimpleFSListResult, error) {
	k.lock.Lock()
	res, _ := k.handles[opid]
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
	destPath keybase1.Path) (err error) {
	dstFS, finalDstElem, err := k.getFS(ctx, destPath)
	if err != nil {
		return err
	}

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

	if pathType, _ := destPath.PathType(); pathType == keybase1.PathType_LOCAL {
		defer func() {
			qerr := Quarantine(ctx, destPath.Local())
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
	return k.doCopyFromSource(ctx, opID, srcFS, srcFI, destPath)
}

// SimpleFSCopy - Begin copy of file or directory
func (k *SimpleFS) SimpleFSCopy(ctx context.Context, arg keybase1.SimpleFSCopyArg) error {
	return k.startAsync(ctx, arg.OpID, keybase1.AsyncOps_COPY,
		keybase1.NewOpDescriptionWithCopy(
			keybase1.CopyArgs{OpID: arg.OpID, Src: arg.Src, Dest: arg.Dest}),
		func(ctx context.Context) (err error) {
			return k.doCopy(ctx, arg.OpID, arg.Src, arg.Dest)
		})
}

// SimpleFSSymlink starts making a symlink of a file or directory
func (k *SimpleFS) SimpleFSSymlink(ctx context.Context, arg keybase1.SimpleFSSymlinkArg) (err error) {
	// This is not async.
	ctx, err = k.startSyncOp(ctx, "Symlink", arg)
	if err != nil {
		return err
	}
	defer func() { k.doneSyncOp(ctx, err) }()

	dstFS, finalDstElem, err := k.getFS(ctx, arg.Link)
	if err != nil {
		return err
	}

	err = dstFS.Symlink(arg.Target, finalDstElem)
	return err
}

type pathPair struct {
	src, dest keybase1.Path
}

func pathAppend(p keybase1.Path, leaf string) keybase1.Path {
	if p.Local__ != nil {
		var s = stdpath.Join(*p.Local__, leaf)
		p.Local__ = &s
	} else if p.Kbfs__ != nil {
		var s = stdpath.Join(*p.Kbfs__, leaf)
		p.Kbfs__ = &s
	} else if p.KbfsArchived__ != nil {
		var s = stdpath.Join(p.KbfsArchived__.Path, leaf)
		p = p.DeepCopy()
		p.KbfsArchived__.Path = s
	}
	return p
}

// SimpleFSCopyRecursive - Begin recursive copy of directory
func (k *SimpleFS) SimpleFSCopyRecursive(ctx context.Context,
	arg keybase1.SimpleFSCopyRecursiveArg) error {
	return k.startAsync(ctx, arg.OpID, keybase1.AsyncOps_COPY,
		keybase1.NewOpDescriptionWithCopy(
			keybase1.CopyArgs{OpID: arg.OpID, Src: arg.Src, Dest: arg.Dest}),
		func(ctx context.Context) (err error) {
			// Get the full byte/file count.
			srcFS, finalSrcElem, err := k.getFS(ctx, arg.Src)
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
				k.setProgressTotals(arg.OpID, bytes, files+1)
			} else {
				// No need for recursive.
				return k.doCopy(ctx, arg.OpID, arg.Src, arg.Dest)
			}

			var paths = []pathPair{{src: arg.Src, dest: arg.Dest}}
			for len(paths) > 0 {
				select {
				case <-ctx.Done():
					return ctx.Err()
				default:
				}

				// wrap in a function for defers.
				err = func() error {
					path := paths[len(paths)-1]
					paths = paths[:len(paths)-1]

					srcFS, finalSrcElem, err := k.getFS(ctx, path.src)
					if err != nil {
						return err
					}
					srcFI, err := srcFS.Stat(finalSrcElem)
					if err != nil {
						return err
					}
					err = k.doCopyFromSource(
						ctx, arg.OpID, srcFS, srcFI, path.dest)
					if err != nil {
						return err
					}

					// TODO symlinks
					if srcFI.IsDir() {
						fis, err := srcFS.ReadDir(srcFI.Name())
						if err != nil {
							return err
						}
						for _, fi := range fis {
							paths = append(paths, pathPair{
								src:  pathAppend(path.src, fi.Name()),
								dest: pathAppend(path.dest, fi.Name()),
							})
						}
					}
					return nil
				}()
			}

			return err
		})
}

func (k *SimpleFS) doRemove(ctx context.Context, path keybase1.Path) error {
	fs, finalElem, err := k.getFS(ctx, path)
	if err != nil {
		return err
	}
	return fs.Remove(finalElem)
}

// SimpleFSMove - Begin move of file or directory, from/to KBFS only
func (k *SimpleFS) SimpleFSMove(ctx context.Context, arg keybase1.SimpleFSMoveArg) error {
	return k.startAsync(ctx, arg.OpID, keybase1.AsyncOps_MOVE,
		keybase1.NewOpDescriptionWithMove(
			keybase1.MoveArgs{
				OpID: arg.OpID, Src: arg.Src, Dest: arg.Dest,
			}),
		func(ctx context.Context) (err error) {
			// TODO: Make this a proper rename within a single TLF.
			// (See `SimpleFSRename` below.)  Also even copy+deletes
			// should be resursive I think.
			err = k.doCopy(ctx, arg.OpID, arg.Src, arg.Dest)
			if err != nil {
				return err
			}
			return k.doRemove(ctx, arg.Src)
		})
}

func (k *SimpleFS) startSyncOp(ctx context.Context, name string, logarg interface{}) (context.Context, error) {
	ctx = k.makeContext(ctx)
	k.log.CDebugf(ctx, "start sync %s %v", name, logarg)
	return k.startOpWrapContext(ctx)
}
func (k *SimpleFS) startOpWrapContext(outer context.Context) (context.Context, error) {
	return libkbfs.NewContextWithCancellationDelayer(libkbfs.NewContextReplayable(
		outer, func(c context.Context) context.Context {
			return c
		}))
}

func (k *SimpleFS) doneSyncOp(ctx context.Context, err error) {
	k.log.CDebugf(ctx, "done sync op, status=%v", err)
	if ctx != nil {
		libkbfs.CleanupCancellationDelayer(ctx)
	}
}

// SimpleFSRename - Rename file or directory, KBFS side only
func (k *SimpleFS) SimpleFSRename(ctx context.Context, arg keybase1.SimpleFSRenameArg) (err error) {
	// This is not async.
	ctx, err = k.startSyncOp(ctx, "Rename", arg)
	if err != nil {
		return err
	}
	defer func() { k.doneSyncOp(ctx, err) }()

	// Get root FS, to be shared by both src and dst.
	t, tlfName, restOfSrcPath, finalSrcElem, err := remoteTlfAndPath(arg.Src)
	if err != nil {
		return err
	}
	tlfHandle, err := libkbfs.GetHandleFromFolderNameAndType(
		ctx, k.config.KBPKI(), k.config.MDOps(), tlfName, t)
	if err != nil {
		return err
	}
	fs, err := libfs.NewFS(
		ctx, k.config, tlfHandle, libkbfs.MasterBranch, "", "",
		keybase1.MDPriorityNormal)
	if err != nil {
		return err
	}

	// Make sure src and dst share the same TLF.
	tDst, tlfNameDst, restOfDstPath, finalDstElem, err :=
		remoteTlfAndPath(arg.Dest)
	if err != nil {
		return err
	}
	if tDst != t || tlfName != tlfNameDst {
		return simpleFSError{"Cannot rename across top-level folders"}
	}

	err = fs.Rename(
		stdpath.Join(restOfSrcPath, finalSrcElem),
		stdpath.Join(restOfDstPath, finalDstElem))
	return err
}

// SimpleFSOpen - Create/open a file and leave it open
// or create a directory
// Files must be closed afterwards.
func (k *SimpleFS) SimpleFSOpen(ctx context.Context, arg keybase1.SimpleFSOpenArg) (err error) {
	ctx, err = k.startSyncOp(ctx, "Open", arg)
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
func (k *SimpleFS) SimpleFSSetStat(ctx context.Context, arg keybase1.SimpleFSSetStatArg) (err error) {
	ctx, err = k.startSyncOp(ctx, "SetStat", arg)
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
	const exec = 0100
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
	ctx, err := k.startSyncOp(ctx, desc.AsyncOp__.String(), desc)
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
		libkbfs.CleanupCancellationDelayer(ctx)
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
func (k *SimpleFS) SimpleFSWrite(ctx context.Context, arg keybase1.SimpleFSWriteArg) error {
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

	ctx, err := k.startReadWriteOp(
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
	arg keybase1.SimpleFSRemoveArg) error {
	return k.startAsync(ctx, arg.OpID, keybase1.AsyncOps_REMOVE,
		keybase1.NewOpDescriptionWithRemove(
			keybase1.RemoveArgs{
				OpID: arg.OpID, Path: arg.Path,
			}),
		func(ctx context.Context) (err error) {
			return k.doRemove(ctx, arg.Path)
		})
}

// SimpleFSStat - Get info about file
func (k *SimpleFS) SimpleFSStat(ctx context.Context, arg keybase1.SimpleFSStatArg) (de keybase1.Dirent, err error) {
	if arg.IdentifyBehavior != nil {
		ctx, err = libkbfs.MakeExtendedIdentify(ctx, *arg.IdentifyBehavior)
		if err != nil {
			return keybase1.Dirent{}, err
		}
	}
	ctx, err = k.startSyncOp(ctx, "Stat", arg.Path)
	if err != nil {
		return keybase1.Dirent{}, err
	}
	defer func() { k.doneSyncOp(ctx, err) }()

	fs, finalElem, err := k.getFS(ctx, arg.Path)
	if err != nil {
		return keybase1.Dirent{}, err
	}
	// Use LStat so we don't follow symlinks.
	fi, err := fs.Lstat(finalElem)
	if err != nil {
		return keybase1.Dirent{}, err
	}

	err = setStat(&de, fi)
	return de, err
}

func (k *SimpleFS) getRevisionsFromPath(
	ctx context.Context, path keybase1.Path) (
	os.FileInfo, libkbfs.PrevRevisions, error) {
	fs, finalElem, err := k.getFS(ctx, path)
	if err != nil {
		k.log.CDebugf(ctx, "Trouble getting fs for path %s: %+v", path, err)
		return nil, nil, err
	}
	// Use LStat so we don't follow symlinks.
	k.log.CDebugf(ctx, "About to lstat %s", finalElem)
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
	k.log.CDebugf(ctx, "Getting revisions for path %s, spanType=%s",
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
	err = setStat(&currRev.Entry, fi)
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
			if prs[nextSlot].Count == expectedCount {
				rev = prs[nextSlot].Revision
			} else if lastRevision > kbfsmd.RevisionInitial {
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
			} else {
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
		fs, finalElem, err := k.getFS(groupCtx, p)
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
		err = setStat(&rev.Entry, fi)
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
			keybase1.GetRevisionsArgs{
				OpID:     arg.OpID,
				Path:     arg.Path,
				SpanType: arg.SpanType,
			}),
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
	res, _ := k.handles[opid]
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
	ctx, err = k.startSyncOp(ctx, "Close", opid)
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
func (k *SimpleFS) SimpleFSCheck(_ context.Context, opid keybase1.OpID) (keybase1.OpProgress, error) {
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
			k.log.CDebugf(nil, "Start=%s, n=%d, d=%d, fracDone=%f, End=%s",
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
	k.lock.RUnlock()
	k.log.CDebugf(ctx, "Wait %X -> %v, %v", opid, w, ok)
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
	jServer, jErr := libkbfs.GetJournalServer(k.config)
	if jErr != nil {
		k.log.CDebugf(ctx, "Journal not enabled; sending empty response")
		return keybase1.FSSyncStatus{}, nil
	}
	status, tlfIDs := jServer.Status(ctx)
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
			if isFiltered(filter, p) {
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

// SimpleFSGetHTTPAddressAndToken returns a random token to be used for the
// local KBFS http server.
func (k *SimpleFS) SimpleFSGetHTTPAddressAndToken(ctx context.Context) (
	resp keybase1.SimpleFSGetHTTPAddressAndTokenResponse, err error) {
	if resp.Token, err = k.localHTTPServer.NewToken(); err != nil {
		return keybase1.SimpleFSGetHTTPAddressAndTokenResponse{}, err
	}
	if resp.Address, err = k.localHTTPServer.Address(); err != nil {
		return keybase1.SimpleFSGetHTTPAddressAndTokenResponse{}, err
	}

	return resp, nil
}

// SimpleFSUserEditHistory returns the edit history for the logged-in user.
func (k *SimpleFS) SimpleFSUserEditHistory(ctx context.Context) (
	res []keybase1.FSFolderEditHistory, err error) {
	session, err := libkbfs.GetCurrentSessionIfPossible(
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
	if fb == (libkbfs.FolderBranch{}) {
		return keybase1.FSFolderEditHistory{}, nil
	}

	// Now get the edit history.
	return k.config.KBFSOps().GetEditHistory(ctx, fb)
}

// SimpleFSReset resets the given TLF.
func (k *SimpleFS) SimpleFSReset(
	ctx context.Context, path keybase1.Path) error {
	t, tlfName, _, _, err := remoteTlfAndPath(path)
	if err != nil {
		return err
	}
	tlfHandle, err := libkbfs.GetHandleFromFolderNameAndType(
		ctx, k.config.KBPKI(), k.config.MDOps(), tlfName, t)
	if err != nil {
		return err
	}

	return k.config.KBFSOps().Reset(ctx, tlfHandle)
}

var _ libkbfs.Observer = (*SimpleFS)(nil)

// LocalChange implements the libkbfs.Observer interface for SimpleFS.
func (k *SimpleFS) LocalChange(
	_ context.Context, _ libkbfs.Node, _ libkbfs.WriteRange) {
	// No-op.
}

// BatchChanges implements the libkbfs.Observer interface for SimpleFS.
func (k *SimpleFS) BatchChanges(
	ctx context.Context, changes []libkbfs.NodeChange, _ []libkbfs.NodeID) {
	// Don't take any locks while processing these notifications,
	// since it risks deadlock.
	fbs := make(map[libkbfs.FolderBranch]bool, 1)
	for _, nc := range changes {
		fbs[nc.Node.GetFolderBranch()] = true
	}

	go func() {
		k.subscribeLock.RLock()
		defer k.subscribeLock.RUnlock()
		for fb := range fbs {
			if fb == k.subscribeCurrFB {
				k.config.Reporter().NotifyPathUpdated(ctx, k.subscribeCurrPath)
			}
		}
	}()
}

// TlfHandleChange implements the libkbfs.Observer interface for SimpleFS.
func (k *SimpleFS) TlfHandleChange(_ context.Context, _ *libkbfs.TlfHandle) {
	// TODO: the GUI might eventually care about a handle change.
}

// SimpleFSGetUserQuotaUsage returns the quota usage information for
// the logged-in user.
func (k *SimpleFS) SimpleFSGetUserQuotaUsage(ctx context.Context) (
	res keybase1.SimpleFSQuotaUsage, err error) {
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

func (k *SimpleFS) getSyncConfig(ctx context.Context, path keybase1.Path) (
	tlfID tlf.ID, config keybase1.FolderSyncConfig,
	err error) {
	t, tlfName, _, _, err := remoteTlfAndPath(path)
	if err != nil {
		return tlf.NullID, keybase1.FolderSyncConfig{}, err
	}
	tlfHandle, err := libkbfs.GetHandleFromFolderNameAndType(
		ctx, k.config.KBPKI(), k.config.MDOps(), tlfName, t)
	if err != nil {
		return tlf.NullID, keybase1.FolderSyncConfig{}, err
	}

	config = keybase1.FolderSyncConfig{Mode: keybase1.FolderSyncMode_DISABLED}
	if k.config.IsSyncedTlf(tlfHandle.TlfID()) {
		config.Mode = keybase1.FolderSyncMode_ENABLED
	}
	return tlfHandle.TlfID(), config, nil
}

// SimpleFSFolderSyncConfigAndStatus gets the given folder's sync config.
func (k *SimpleFS) SimpleFSFolderSyncConfigAndStatus(
	ctx context.Context, path keybase1.Path) (
	keybase1.FolderSyncConfigAndStatus, error) {
	_, config, err := k.getSyncConfig(ctx, path)
	if err != nil {
		return keybase1.FolderSyncConfigAndStatus{}, err
	}
	res := keybase1.FolderSyncConfigAndStatus{Config: config}

	dbc := k.config.DiskBlockCache()
	if dbc != nil {
		dbcStatus := dbc.Status(ctx)
		if status, ok := dbcStatus["SyncBlockCache"]; ok {
			res.Status.LocalDiskBytesAvailable = int64(
				status.LocalDiskBytesAvailable)
			res.Status.LocalDiskBytesTotal = int64(status.LocalDiskBytesTotal)
		}
	}

	return res, err
}

// SimpleFSSetFolderSyncConfig implements the SimpleFSInterface.
func (k *SimpleFS) SimpleFSSetFolderSyncConfig(
	ctx context.Context, arg keybase1.SimpleFSSetFolderSyncConfigArg) error {
	tlfID, _, err := k.getSyncConfig(ctx, arg.Path)
	if err != nil {
		return err
	}

	_, err = k.config.KBFSOps().SetSyncConfig(ctx, tlfID, arg.Config)
	return err
}
