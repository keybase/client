// Copyright 2016-2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package simplefs

import (
	"encoding/json"
	"io"
	"os"
	stdpath "path"
	"strings"
	"sync"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/libkbfs"
)

// SimpleFS is the simple filesystem rpc layer implementation.
type SimpleFS struct {
	// log for logging - constant, does not need locking.
	log logger.Logger
	// config for the fs - constant, does not need locking.
	config libkbfs.Config
	// lock protects handles and inProgress
	lock sync.RWMutex
	// handles contains handles opened by SimpleFSOpen,
	// closed by SimpleFSClose (or SimpleFSCancel) and used
	// by listing, reading and writing.
	handles map[keybase1.OpID]*handle
	// inProgress is for keeping state of operations in progress,
	// values are removed by SimpleFSWait (or SimpleFSCancel).
	inProgress map[keybase1.OpID]*inprogress
}

type inprogress struct {
	desc   keybase1.OpDescription
	cancel context.CancelFunc
	done   chan error
}

type handle struct {
	node  libkbfs.Node
	async interface{}
	path  keybase1.Path
}

// make sure the interface is implemented
var _ keybase1.SimpleFSInterface = (*SimpleFS)(nil)

// NewSimpleFS creates a new SimpleFS instance.
func NewSimpleFS(config libkbfs.Config) keybase1.SimpleFSInterface {
	return newSimpleFS(config)
}

func newSimpleFS(config libkbfs.Config) *SimpleFS {
	log := config.MakeLogger("simplefs")
	return &SimpleFS{
		config:     config,
		handles:    map[keybase1.OpID]*handle{},
		inProgress: map[keybase1.OpID]*inprogress{},
		log:        log,
	}
}

// SimpleFSList - Begin list of items in directory at path
// Retrieve results with readList()
// Cannot be a single file to get flags/status,
// must be a directory.
func (k *SimpleFS) SimpleFSList(_ context.Context, arg keybase1.SimpleFSListArg) error {
	return k.startAsync(arg.OpID, keybase1.NewOpDescriptionWithList(
		keybase1.ListArgs{
			OpID: arg.OpID, Path: arg.Path,
		}), func(ctx context.Context) (err error) {
		var children map[string]libkbfs.EntryInfo

		rawPath := arg.Path.Kbfs()
		wantPublic := false
		switch {
		case rawPath == `/public`:
			wantPublic = true
			fallthrough
		case rawPath == `/private`:
			children, err = k.favoriteList(ctx, arg.Path, wantPublic)
		default:
			node, ei, err := k.getRemoteNode(ctx, arg.Path)
			if err != nil {
				return err
			}
			switch ei.Type {
			case libkbfs.Dir:
				children, err = k.config.KBFSOps().GetDirChildren(ctx, node)
			default:
				children = map[string]libkbfs.EntryInfo{stdpath.Base(arg.Path.Kbfs()): ei}
			}
		}
		if err != nil {
			return err
		}
		var des = make([]keybase1.Dirent, len(children))
		var i = 0
		for name, ei := range children {
			setStat(&des[i], &ei)
			des[i].Name = name
			i++
		}

		k.setResult(arg.OpID, keybase1.SimpleFSListResult{Entries: des})
		return nil
	})
}

func (k *SimpleFS) favoriteList(ctx context.Context, path keybase1.Path, wantPublic bool) (map[string]libkbfs.EntryInfo, error) {
	session, err := k.config.KBPKI().GetCurrentSession(ctx)
	// Return empty directory listing if we are not logged in.
	if err != nil {
		return nil, nil
	}

	favs, err := k.config.KBFSOps().GetFavorites(ctx)
	if err != nil {
		return nil, err
	}

	res := make(map[string]libkbfs.EntryInfo, len(favs))
	for _, fav := range favs {
		if fav.Public != wantPublic {
			continue
		}
		pname, err := libkbfs.FavoriteNameToPreferredTLFNameFormatAs(
			session.Name, libkbfs.CanonicalTlfName(fav.Name))
		if err != nil {
			k.log.Errorf("FavoriteNameToPreferredTLFNameFormatAs: %q %v", fav.Name, err)
			continue
		}
		res[string(pname)] = libkbfs.EntryInfo{Type: libkbfs.Dir}
	}
	return res, nil
}

// SimpleFSListRecursive - Begin recursive list of items in directory at path
func (k *SimpleFS) SimpleFSListRecursive(ctx context.Context, arg keybase1.SimpleFSListRecursiveArg) error {
	return k.startAsync(arg.OpID, keybase1.NewOpDescriptionWithListRecursive(
		keybase1.ListArgs{
			OpID: arg.OpID, Path: arg.Path,
		}), func(ctx context.Context) (err error) {

		// A stack of paths to process - ordering does not matter.
		// Here we don't walk symlinks, so no loops possible.
		var paths = []keybase1.Path{arg.Path}
		var des []keybase1.Dirent
		for len(paths) > 0 {
			// Take last element and shorten
			path := paths[len(paths)-1]
			paths = paths[:len(paths)-1]
			node, _, err := k.getRemoteNode(ctx, path)
			if err != nil {
				return err
			}
			children, err := k.config.KBFSOps().GetDirChildren(ctx, node)
			if err != nil {
				return err
			}
			for name, ei := range children {
				var de keybase1.Dirent
				setStat(&de, &ei)
				de.Name = name
				des = append(des, de)
				if ei.Type == libkbfs.Dir {
					paths = append(paths, keybase1.NewPathWithKbfs(
						path.Kbfs()+"/"+name,
					))
				}
			}
		}
		k.setResult(arg.OpID, keybase1.SimpleFSListResult{Entries: des})

		return nil
	})
}

// SimpleFSReadList - Get list of Paths in progress. Can indicate status of pending
// to get more entries.
func (k *SimpleFS) SimpleFSReadList(ctx context.Context, opid keybase1.OpID) (keybase1.SimpleFSListResult, error) {
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

// SimpleFSCopy - Begin copy of file or directory
func (k *SimpleFS) SimpleFSCopy(ctx context.Context, arg keybase1.SimpleFSCopyArg) error {
	return k.startAsync(arg.OpID, keybase1.NewOpDescriptionWithCopy(
		keybase1.CopyArgs{OpID: arg.OpID, Src: arg.Src, Dest: arg.Dest}),
		func(ctx context.Context) (err error) {
			return k.doCopy(ctx, arg.Src, arg.Dest)
		})
}

func (k *SimpleFS) doCopy(ctx context.Context, srcPath, destPath keybase1.Path) error {
	// Note this is also used by move, so if this changes update SimpleFSMove
	// code also.
	src, err := k.pathIO(ctx, srcPath, keybase1.OpenFlags_READ|keybase1.OpenFlags_EXISTING, nil)
	if err != nil {
		return err
	}
	defer src.Close()

	dst, err := k.pathIO(ctx, destPath, keybase1.OpenFlags_WRITE|keybase1.OpenFlags_REPLACE, src)
	if err != nil {
		return err
	}
	defer dst.Close()

	if src.Type() == keybase1.DirentType_FILE || src.Type() == keybase1.DirentType_EXEC {
		err = copyWithCancellation(ctx, dst, src)
		if err != nil {
			return err
		}
	}

	return nil
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

type pathPair struct {
	src, dest keybase1.Path
}

// SimpleFSCopyRecursive - Begin recursive copy of directory
func (k *SimpleFS) SimpleFSCopyRecursive(ctx context.Context,
	arg keybase1.SimpleFSCopyRecursiveArg) error {
	return k.startAsync(arg.OpID, keybase1.NewOpDescriptionWithCopy(
		keybase1.CopyArgs{OpID: arg.OpID, Src: arg.Src, Dest: arg.Dest}),
		func(ctx context.Context) (err error) {

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

					src, err := k.pathIO(ctx, path.src, keybase1.OpenFlags_READ|keybase1.OpenFlags_EXISTING, nil)
					if err != nil {
						return err
					}
					defer src.Close()

					dst, err := k.pathIO(ctx, path.dest, keybase1.OpenFlags_WRITE|keybase1.OpenFlags_REPLACE, src)
					if err != nil {
						return err
					}
					defer dst.Close()

					// TODO symlinks
					switch src.Type() {
					case keybase1.DirentType_FILE, keybase1.DirentType_EXEC:
						err = copyWithCancellation(ctx, dst, src)
						if err != nil {
							return err
						}
					case keybase1.DirentType_DIR:
						eis, err := src.Children()
						if err != nil {
							return err
						}
						for name := range eis {
							paths = append(paths, pathPair{
								src:  pathAppend(path.src, name),
								dest: pathAppend(path.dest, name),
							})
						}
					}
					return nil
				}()
			}

			return err
		})
}

func pathAppend(p keybase1.Path, leaf string) keybase1.Path {
	if p.Local__ != nil {
		var s = *p.Local__ + "/" + leaf
		p.Local__ = &s
	} else if p.Kbfs__ != nil {
		var s = *p.Kbfs__ + "/" + leaf
		p.Kbfs__ = &s
	}
	return p
}

// SimpleFSMove - Begin move of file or directory, from/to KBFS only
func (k *SimpleFS) SimpleFSMove(ctx context.Context, arg keybase1.SimpleFSMoveArg) error {
	return k.startAsync(arg.OpID, keybase1.NewOpDescriptionWithMove(
		keybase1.MoveArgs{
			OpID: arg.OpID, Src: arg.Src, Dest: arg.Dest,
		}), func(ctx context.Context) (err error) {

		err = k.doCopy(ctx, arg.Src, arg.Dest)
		if err != nil {
			return err
		}
		pt, err := arg.Src.PathType()
		if err != nil {
			// should really not happen...
			return err
		}
		switch pt {
		case keybase1.PathType_KBFS:
			err = k.doRemove(ctx, arg.Src)
		case keybase1.PathType_LOCAL:
			err = os.Remove(arg.Src.Local())
		}
		return err
	})
}

// SimpleFSRename - Rename file or directory, KBFS side only
func (k *SimpleFS) SimpleFSRename(ctx context.Context, arg keybase1.SimpleFSRenameArg) (err error) {
	// This is not async.
	ctx, err = k.startSyncOp(ctx, "Rename", arg)
	if err != nil {
		return err
	}
	defer func() { k.doneSyncOp(ctx, err) }()

	snode, sleaf, err := k.getRemoteNodeParent(ctx, arg.Src)
	if err != nil {
		return err
	}
	dnode, dleaf, err := k.getRemoteNodeParent(ctx, arg.Dest)
	if err != nil {
		return err
	}
	err = k.config.KBFSOps().Rename(ctx, snode, sleaf, dnode, dleaf)
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

	node, _, err := k.open(ctx, arg.Dest, arg.Flags)

	if err != nil {
		return err
	}

	k.lock.Lock()
	k.handles[arg.OpID] = &handle{node: node, path: arg.Dest}
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

	node, _, err := k.getRemoteNode(ctx, arg.Dest)
	if err != nil {
		return err
	}
	var exec bool
	switch arg.Flag {
	case keybase1.DirentType_EXEC:
		exec = true
		fallthrough
	case keybase1.DirentType_FILE:
		err = k.config.KBFSOps().SetEx(ctx, node, exec)
		if err != nil {
			return err
		}
	}

	return nil
}

func (k *SimpleFS) startReadWriteOp(ctx context.Context, opid keybase1.OpID, desc keybase1.OpDescription) (context.Context, error) {
	ctx, err := k.startSyncOp(ctx, desc.AsyncOp__.String(), desc)
	if err != nil {
		return nil, err
	}
	k.lock.RLock()
	k.inProgress[opid] = &inprogress{desc, func() {}, make(chan error, 1)}
	k.lock.RUnlock()
	return ctx, err
}

func (k *SimpleFS) doneReadWriteOp(ctx context.Context, opID keybase1.OpID, err error) {
	k.lock.RLock()
	delete(k.inProgress, opID)
	k.lock.RUnlock()
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
	ctx, err = k.startReadWriteOp(ctx, arg.OpID, opDesc)
	if err != nil {
		return keybase1.FileContent{}, err
	}

	defer func() { k.doneReadWriteOp(ctx, arg.OpID, err) }()

	bs := make([]byte, arg.Size)
	n, err := k.config.KBFSOps().Read(ctx, h.node, bs, arg.Offset)
	bs = bs[:n]
	return keybase1.FileContent{
		Data: bs,
	}, err
}

// SimpleFSWrite - Append content to opened file.
// May be repeated until OpID is closed.
func (k *SimpleFS) SimpleFSWrite(ctx context.Context, arg keybase1.SimpleFSWriteArg) error {
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

	ctx, err := k.startReadWriteOp(ctx, arg.OpID, opDesc)
	if err != nil {
		return err
	}
	defer func() { k.doneReadWriteOp(ctx, arg.OpID, err) }()

	err = k.config.KBFSOps().Write(ctx, h.node, arg.Content, arg.Offset)
	return err
}

// SimpleFSRemove - Remove file or directory from filesystem
func (k *SimpleFS) SimpleFSRemove(ctx context.Context,
	arg keybase1.SimpleFSRemoveArg) error {
	go k.simpleFSRemove(context.Background(), arg)
	return nil
}
func (k *SimpleFS) simpleFSRemove(ctx context.Context,
	arg keybase1.SimpleFSRemoveArg) (err error) {
	return k.startAsync(arg.OpID, keybase1.NewOpDescriptionWithRemove(
		keybase1.RemoveArgs{
			OpID: arg.OpID, Path: arg.Path,
		}), func(ctx context.Context) (err error) {
		return k.doRemove(ctx, arg.Path)
	})
}

func (k *SimpleFS) doRemove(ctx context.Context, path keybase1.Path) error {
	node, leaf, err := k.getRemoteNodeParent(ctx, path)
	if err != nil {
		return err
	}
	_, ei, err := k.config.KBFSOps().Lookup(ctx, node, leaf)
	if err != nil {
		return err
	}
	switch ei.Type {
	case libkbfs.Dir:
		err = k.config.KBFSOps().RemoveDir(ctx, node, leaf)
	default:
		err = k.config.KBFSOps().RemoveEntry(ctx, node, leaf)
	}
	return err
}

// SimpleFSStat - Get info about file
func (k *SimpleFS) SimpleFSStat(ctx context.Context, path keybase1.Path) (_ keybase1.Dirent, err error) {
	ctx, err = k.startSyncOp(ctx, "Stat", path)
	if err != nil {
		return keybase1.Dirent{}, err
	}
	defer func() { k.doneSyncOp(ctx, err) }()

	_, ei, err := k.getRemoteNode(ctx, path)
	return wrapStat(ei, err)
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
	if h.node != nil {
		err = k.config.KBFSOps().SyncAll(ctx, h.node.GetFolderBranch())
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
func (k *SimpleFS) SimpleFSCheck(_ context.Context, opid keybase1.OpID) (keybase1.Progress, error) {
	k.lock.RLock()
	defer k.lock.RUnlock()
	if _, ok := k.inProgress[opid]; ok {
		return 0, nil
	} else if _, ok := k.handles[opid]; ok {
		return 0, nil
	}
	return 0, errNoResult
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

// remotePath decodes a remote path for us.
func remotePath(path keybase1.Path) (ps []string, public bool, err error) {
	pt, err := path.PathType()
	if err != nil {
		return nil, false, err
	}
	if pt != keybase1.PathType_KBFS {
		return nil, false, errOnlyRemotePathSupported
	}
	raw := path.Kbfs()
	if raw != `` && raw[0] == '/' {
		raw = raw[1:]
	}
	ps = strings.Split(raw, `/`)
	switch {
	case len(ps) < 2:
		return nil, false, errInvalidRemotePath
	case ps[0] == `private`:
	case ps[0] == `public`:
		public = true
	default:
		return nil, false, errInvalidRemotePath

	}
	return ps[1:], public, nil
}

func (k *SimpleFS) open(ctx context.Context, dest keybase1.Path, f keybase1.OpenFlags) (
	libkbfs.Node, libkbfs.EntryInfo, error) {
	var node libkbfs.Node
	var ei libkbfs.EntryInfo

	parent, name, err := k.getRemoteNodeParent(ctx, dest)
	if err != nil {
		return node, ei, err
	}

	// On REPLACE return existing results and if it is a file then truncate it.
	// TODO: What are the desired semantics on non-matching types?
	if f&keybase1.OpenFlags_REPLACE != 0 {
		node, ei, err = k.config.KBFSOps().Lookup(ctx, parent, name)
		if err == nil {
			if ei.Type != libkbfs.Dir {
				err = k.config.KBFSOps().Truncate(ctx, node, 0)
			}
			return node, ei, err
		}
	}
	switch {
	case (f&keybase1.OpenFlags_EXISTING == 0) && (f&keybase1.OpenFlags_DIRECTORY == keybase1.OpenFlags_DIRECTORY):
		node, ei, err = k.config.KBFSOps().CreateDir(ctx, parent, name)
	case f&keybase1.OpenFlags_EXISTING == 0:
		node, ei, err = k.config.KBFSOps().CreateFile(ctx, parent, name, false, false)
	default:
		node, ei, err = k.config.KBFSOps().Lookup(ctx, parent, name)
	}

	return node, ei, err
}

// getRemoteRootNode
func (k *SimpleFS) getRemoteRootNode(ctx context.Context, path keybase1.Path) (
	libkbfs.Node, libkbfs.EntryInfo, []string, error) {
	ps, public, err := remotePath(path)
	if err != nil {
		return nil, libkbfs.EntryInfo{}, nil, err
	}
	tlf, err := libkbfs.ParseTlfHandlePreferred(
		ctx, k.config.KBPKI(), ps[0], public)
	if err != nil {
		return nil, libkbfs.EntryInfo{}, nil, err
	}
	node, ei, err := k.config.KBFSOps().GetOrCreateRootNode(
		ctx, tlf, libkbfs.MasterBranch)
	if err != nil {
		return nil, libkbfs.EntryInfo{}, nil, err
	}
	return node, ei, ps[1:], nil
}

// getRemoteNode
func (k *SimpleFS) getRemoteNode(ctx context.Context, path keybase1.Path) (
	libkbfs.Node, libkbfs.EntryInfo, error) {
	node, ei, ps, err := k.getRemoteRootNode(ctx, path)
	if err != nil {
		return nil, libkbfs.EntryInfo{}, err
	}

	// TODO: should we walk symlinks here?
	// Some callers like List* don't want that.
	for _, name := range ps {
		node, ei, err = k.config.KBFSOps().Lookup(ctx, node, name)
		if err != nil {
			return nil, libkbfs.EntryInfo{}, err
		}
	}

	return node, ei, nil
}

// getRemoteNodeParent
func (k *SimpleFS) getRemoteNodeParent(ctx context.Context, path keybase1.Path) (
	libkbfs.Node, string, error) {
	node, _, ps, err := k.getRemoteRootNode(ctx, path)
	if err != nil {
		return nil, "", err
	}

	if len(ps) == 0 {
		return node, "", nil
	}

	leaf := ps[len(ps)-1]
	ps = ps[:len(ps)-1]

	// TODO: should we walk symlinks here?
	for _, name := range ps {
		node, _, err = k.config.KBFSOps().Lookup(ctx, node, name)
		if err != nil {
			return nil, "", err
		}
	}

	return node, leaf, nil
}

func wrapStat(ei libkbfs.EntryInfo, err error) (keybase1.Dirent, error) {
	if err != nil {
		return keybase1.Dirent{}, err
	}
	var de keybase1.Dirent
	setStat(&de, &ei)
	return de, nil
}

func setStat(de *keybase1.Dirent, ei *libkbfs.EntryInfo) {
	de.Time = keybase1.Time(ei.Mtime / 1000000)
	de.Size = int(ei.Size) // TODO: FIX protocol
	de.DirentType = deTy2Ty(ei)
}

func deTy2Ty(ei *libkbfs.EntryInfo) keybase1.DirentType {
	switch ei.Type {
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

type ioer interface {
	io.ReadWriteCloser
	Type() keybase1.DirentType
	Children() (map[string]libkbfs.EntryInfo, error)
}

func (k *SimpleFS) pathIO(ctx context.Context, path keybase1.Path,
	flags keybase1.OpenFlags, like ioer) (ioer, error) {
	pt, err := path.PathType()
	if err != nil {
		return nil, err
	}
	if like != nil && like.Type() == keybase1.DirentType_DIR {
		flags |= keybase1.OpenFlags_DIRECTORY
	}
	switch pt {
	case keybase1.PathType_KBFS:
		node, ei, err := k.open(ctx, path, flags)
		if err != nil {
			return nil, err
		}
		return &kbfsIO{ctx, k, node, 0, deTy2Ty(&ei)}, nil
	case keybase1.PathType_LOCAL:
		var cflags = os.O_RDONLY
		// This must be first since it writes the flag, not just ors into it
		if flags&keybase1.OpenFlags_WRITE != 0 {
			cflags = os.O_RDWR
		}
		if flags&keybase1.OpenFlags_EXISTING == 0 {
			cflags |= os.O_CREATE
		}
		if flags&keybase1.OpenFlags_REPLACE != 0 {
			cflags |= os.O_TRUNC
		}
		var f *os.File
		if (cflags&os.O_CREATE != 0) && (flags&keybase1.OpenFlags_DIRECTORY != 0) {
			// Return value is ignored.
			os.Mkdir(path.Local(), 0755)
		}
		f, err = os.OpenFile(path.Local(), cflags, 0644)
		k.log.CDebugf(ctx, "Local open %q -> %v,%v", path.Local(), f, err)
		if err != nil {
			return nil, err
		}
		st, err := f.Stat()
		if err != nil {
			f.Close()
			return nil, err
		}
		var det keybase1.DirentType
		mode := st.Mode()
		switch {
		case mode&os.ModeSymlink != 0:
			det = keybase1.DirentType_SYM
		case mode.IsDir():
			det = keybase1.DirentType_DIR
		case mode&0100 == 0100:
			det = keybase1.DirentType_EXEC
		default:
			det = keybase1.DirentType_FILE
		}
		return &localIO{f, det}, nil
	}
	return nil, simpleFSError{"Invalid path type"}
}

type kbfsIO struct {
	ctx    context.Context
	sfs    *SimpleFS
	node   libkbfs.Node
	offset int64
	deType keybase1.DirentType
}

func (r *kbfsIO) Read(bs []byte) (int, error) {
	n, err := r.sfs.config.KBFSOps().Read(r.ctx, r.node, bs, r.offset)
	if n == 0 && err == nil {
		return 0, io.EOF
	}
	r.offset += n
	return int(n), err
}

func (r *kbfsIO) Write(bs []byte) (int, error) {
	err := r.sfs.config.KBFSOps().Write(r.ctx, r.node, bs, r.offset)
	r.offset += int64(len(bs))
	return len(bs), err
}

func (r *kbfsIO) Close() error {
	return r.sfs.config.KBFSOps().SyncAll(r.ctx, r.node.GetFolderBranch())
}

func (r *kbfsIO) Type() keybase1.DirentType {
	return r.deType
}

func (r *kbfsIO) Children() (map[string]libkbfs.EntryInfo, error) {
	return r.sfs.config.KBFSOps().GetDirChildren(r.ctx, r.node)
}

type localIO struct {
	*os.File
	deType keybase1.DirentType
}

func (r *localIO) Type() keybase1.DirentType { return r.deType }
func (r *localIO) Children() (map[string]libkbfs.EntryInfo, error) {
	fis, err := r.File.Readdir(-1)
	if err != nil {
		return nil, err
	}
	eis := make(map[string]libkbfs.EntryInfo, len(fis))
	for _, fi := range fis {
		eis[fi.Name()] = libkbfs.EntryInfo{
			Type: ty2Kbfs(fi.Mode()),
		}
	}
	return eis, nil
}

func ty2Kbfs(mode os.FileMode) libkbfs.EntryType {
	switch {
	case mode.IsDir():
		return libkbfs.Dir
	case mode&os.ModeSymlink == os.ModeSymlink:
		return libkbfs.Sym
	case mode.IsRegular() && (mode&0700 == 0700):
		return libkbfs.Exec
	}
	return libkbfs.File
}

func (k *SimpleFS) startAsync(opid keybase1.OpID, desc keybase1.OpDescription,
	callback func(context.Context) error) error {
	ctx, e0 := k.startOp(context.Background(), opid, desc)
	if e0 != nil {
		return e0
	}
	go func() (err error) {
		defer func() { k.doneOp(ctx, opid, err) }()
		return callback(ctx)
	}()
	return nil
}

func (k *SimpleFS) startOp(ctx context.Context, opid keybase1.OpID,
	desc keybase1.OpDescription) (context.Context, error) {
	ctx, cancel := context.WithCancel(ctx)
	k.lock.Lock()
	k.inProgress[opid] = &inprogress{desc, cancel, make(chan error, 1)}
	k.lock.Unlock()
	// ignore error, this is just for logging.
	descBS, _ := json.Marshal(desc)
	k.log.CDebugf(ctx, "start %X %s", opid, descBS)
	return k.startOpWrapContext(ctx)
}
func (k *SimpleFS) startSyncOp(ctx context.Context, name string, logarg interface{}) (context.Context, error) {
	k.log.CDebugf(ctx, "start sync %s %v", name, logarg)
	return k.startOpWrapContext(ctx)
}
func (k *SimpleFS) startOpWrapContext(outer context.Context) (context.Context, error) {
	return libkbfs.NewContextWithCancellationDelayer(libkbfs.NewContextReplayable(
		outer, func(c context.Context) context.Context {
			return c
		}))
}

func (k *SimpleFS) doneOp(ctx context.Context, opid keybase1.OpID, err error) {
	k.lock.Lock()
	w, ok := k.inProgress[opid]
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

func (k *SimpleFS) doneSyncOp(ctx context.Context, err error) {
	k.log.CDebugf(ctx, "done sync op, status=%v", err)
	if ctx != nil {
		libkbfs.CleanupCancellationDelayer(ctx)
	}
}

func (k *SimpleFS) setResult(opid keybase1.OpID, val interface{}) {
	k.lock.Lock()
	k.handles[opid] = &handle{async: val}
	k.lock.Unlock()
}

var errOnlyRemotePathSupported = simpleFSError{"Only remote paths are supported for this operation"}
var errInvalidRemotePath = simpleFSError{"Invalid remote path"}
var errNoSuchHandle = simpleFSError{"No such handle"}
var errNoResult = simpleFSError{"Async result not found"}

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
