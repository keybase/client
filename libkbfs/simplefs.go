// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"encoding/json"
	"errors"
	"io"
	"os"
	"strings"
	"sync"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/kbfscrypto"
)

// SimpleFS is the simple filesystem rpc layer implementation.
type SimpleFS struct {
	lock       sync.RWMutex
	config     Config
	handles    map[keybase1.OpID]*handle
	inProgress map[keybase1.OpID]*inprogress
	log        logger.Logger
}

type inprogress struct {
	desc keybase1.OpDescription
	done chan struct{}
}

type handle struct {
	node  Node
	async interface{}
	path  keybase1.Path
}

// make sure the interface is implemented
var _ keybase1.SimpleFSInterface = (*SimpleFS)(nil)

func newSimpleFS(config Config) *SimpleFS {
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
func (k *SimpleFS) SimpleFSList(ctx context.Context, arg keybase1.SimpleFSListArg) error {
	ctx, err := k.startOp(ctx, arg.OpID, keybase1.NewOpDescriptionWithList(
		keybase1.ListArgs{
			OpID: arg.OpID, Path: arg.Path,
		}))
	if err != nil {
		return err
	}
	defer k.doneOp(ctx, arg.OpID)

	node, err := k.getRemoteNode(ctx, arg.Path)
	if err != nil {
		return err
	}
	children, err := k.config.KBFSOps().GetDirChildren(ctx, node)
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

	k.lock.Lock()
	k.handles[arg.OpID] = &handle{async: keybase1.SimpleFSListResult{Entries: des}}
	k.lock.Unlock()

	return nil
}

// SimpleFSListRecursive - Begin recursive list of items in directory at path
func (k *SimpleFS) SimpleFSListRecursive(ctx context.Context, arg keybase1.SimpleFSListRecursiveArg) error {
	ctx, err := k.startOp(ctx, arg.OpID, keybase1.NewOpDescriptionWithListRecursive(
		keybase1.ListArgs{
			OpID: arg.OpID, Path: arg.Path,
		}))
	if err != nil {
		return err
	}
	defer k.doneOp(ctx, arg.OpID)

	// A stack of paths to process - ordering does not matter.
	// Here we don't walk symlinks, so no loops possible.
	var paths = []keybase1.Path{arg.Path}
	var des []keybase1.Dirent
	for len(paths) > 0 {
		// Take last element and shorten
		path := paths[len(paths)-1]
		paths = paths[:len(paths)-1]
		node, err := k.getRemoteNode(ctx, path)
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
			if ei.Type == Dir {
				paths = append(paths, keybase1.NewPathWithKbfs(
					path.Kbfs()+"/"+name,
				))
			}
		}
	}
	k.lock.Lock()
	k.handles[arg.OpID] = &handle{async: keybase1.SimpleFSListResult{Entries: des}}
	k.lock.Unlock()

	return nil
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
	ctx, err := k.startOp(ctx, arg.OpID, keybase1.NewOpDescriptionWithCopy(
		keybase1.CopyArgs{OpID: arg.OpID, Src: arg.Src, Dest: arg.Dest},
	))
	if err != nil {
		return err
	}
	defer k.doneOp(ctx, arg.OpID)
	return k.simpleFSCopy(ctx, arg)
}

func (k *SimpleFS) simpleFSCopy(ctx context.Context, arg keybase1.SimpleFSCopyArg) error {
	// Note this is also used by move, so if this changes update SimpleFSMove
	// code also.
	src, err := k.pathIO(ctx, arg.Src, keybase1.OpenFlags_READ|keybase1.OpenFlags_EXISTING, nil)
	if err != nil {
		return err
	}
	defer src.Close()

	dst, err := k.pathIO(ctx, arg.Dest, keybase1.OpenFlags_WRITE|keybase1.OpenFlags_REPLACE, src)
	if err != nil {
		return err
	}
	defer dst.Close()

	if src.Type() == keybase1.DirentType_FILE || src.Type() == keybase1.DirentType_EXEC {
		_, err = io.Copy(dst, src)
	}

	// TODO: async handling could be better.
	k.setAsyncErr(arg.OpID, err)

	return err
}

type pathPair struct {
	src, dest keybase1.Path
}

// SimpleFSCopyRecursive - Begin recursive copy of directory
func (k *SimpleFS) SimpleFSCopyRecursive(ctx context.Context, arg keybase1.SimpleFSCopyRecursiveArg) error {
	ctx, err := k.startOp(ctx, arg.OpID, keybase1.NewOpDescriptionWithCopy(
		keybase1.CopyArgs{OpID: arg.OpID, Src: arg.Src, Dest: arg.Dest},
	))
	if err != nil {
		return err
	}
	defer k.doneOp(ctx, arg.OpID)

	var paths = []pathPair{{src: arg.Src, dest: arg.Dest}}
	for len(paths) > 0 {
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
				_, err = io.Copy(dst, src)
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
	// TODO: async handling could be better.
	k.setAsyncErr(arg.OpID, err)

	return err
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
	ctx, err := k.startOp(ctx, arg.OpID, keybase1.NewOpDescriptionWithMove(
		keybase1.MoveArgs{
			OpID: arg.OpID, Src: arg.Src, Dest: arg.Dest,
		}))
	if err != nil {
		return err
	}
	defer k.doneOp(ctx, arg.OpID)

	err = k.simpleFSCopy(ctx, keybase1.SimpleFSCopyArg{
		OpID: arg.OpID, Src: arg.Src, Dest: arg.Dest,
	})
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
		err = k.simpleFSRemove(ctx, keybase1.SimpleFSRemoveArg{
			OpID: arg.OpID, Path: arg.Src,
		})
	case keybase1.PathType_LOCAL:
		err = os.Remove(arg.Src.Local())
	}
	if err != nil {
		k.setAsyncErr(arg.OpID, err)
	}
	return err
}

// SimpleFSRename - Rename file or directory, KBFS side only
func (k *SimpleFS) SimpleFSRename(ctx context.Context, arg keybase1.SimpleFSRenameArg) error {
	ctx, err := k.startSyncOp(ctx, "Rename", arg)
	if err != nil {
		return err
	}
	defer k.doneSyncOp(ctx)

	snode, sleaf, err := k.getRemoteNodeParent(ctx, arg.Src)
	if err != nil {
		return err
	}
	dnode, dleaf, err := k.getRemoteNodeParent(ctx, arg.Dest)
	if err != nil {
		return err
	}
	err = k.config.KBFSOps().Rename(ctx, snode, sleaf, dnode, dleaf)
	// TODO should this be async?
	return err
}

// SimpleFSOpen - Create/open a file and leave it open
// or create a directory
// Files must be closed afterwards.
func (k *SimpleFS) SimpleFSOpen(ctx context.Context, arg keybase1.SimpleFSOpenArg) error {
	ctx, err := k.startSyncOp(ctx, "Open", arg)
	if err != nil {
		return err
	}
	defer k.doneSyncOp(ctx)

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
func (k *SimpleFS) SimpleFSSetStat(ctx context.Context, arg keybase1.SimpleFSSetStatArg) error {
	ctx, err := k.startSyncOp(ctx, "SetStat", arg)
	if err != nil {
		return err
	}
	defer k.doneSyncOp(ctx)

	node, err := k.getRemoteNode(ctx, arg.Dest)
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

// SimpleFSRead - Read (possibly partial) contents of open file,
// up to the amount specified by size.
// Repeat until zero bytes are returned or error.
// If size is zero, read an arbitrary amount.
func (k *SimpleFS) SimpleFSRead(ctx context.Context,
	arg keybase1.SimpleFSReadArg) (keybase1.FileContent, error) {
	k.lock.RLock()
	h, ok := k.handles[arg.OpID]
	k.lock.RUnlock()
	if !ok {
		return keybase1.FileContent{}, errNoSuchHandle
	}

	ctx, err := k.startOp(ctx, arg.OpID, keybase1.NewOpDescriptionWithRead(
		keybase1.ReadArgs{
			OpID:   arg.OpID,
			Path:   h.path,
			Offset: arg.Offset,
			Size:   arg.Size,
		}))
	if err != nil {
		return keybase1.FileContent{}, err
	}
	defer k.doneOp(ctx, arg.OpID)

	bs := make([]byte, arg.Size)
	k.config.KBFSOps().Read(ctx, h.node, bs, arg.Offset)
	return keybase1.FileContent{
		Data: bs,
	}, nil
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

	ctx, err := k.startOp(ctx, arg.OpID, keybase1.NewOpDescriptionWithWrite(
		keybase1.WriteArgs{
			OpID: arg.OpID, Path: h.path, Offset: arg.Offset,
		}))
	if err != nil {
		return err
	}
	defer k.doneOp(ctx, arg.OpID)

	err = k.config.KBFSOps().Write(ctx, h.node, arg.Content, arg.Offset)
	return err
}

// SimpleFSRemove - Remove file or directory from filesystem
func (k *SimpleFS) SimpleFSRemove(ctx context.Context, arg keybase1.SimpleFSRemoveArg) error {
	ctx, err := k.startOp(ctx, arg.OpID, keybase1.NewOpDescriptionWithRemove(
		keybase1.RemoveArgs{
			OpID: arg.OpID, Path: arg.Path,
		}))
	if err != nil {
		return err
	}
	defer k.doneOp(ctx, arg.OpID)
	return k.simpleFSRemove(ctx, arg)
}

func (k *SimpleFS) simpleFSRemove(ctx context.Context, arg keybase1.SimpleFSRemoveArg) error {
	node, leaf, err := k.getRemoteNodeParent(ctx, arg.Path)
	if err != nil {
		return err
	}
	_, ei, err := k.config.KBFSOps().Lookup(ctx, node, leaf)
	if err != nil {
		return err
	}
	switch ei.Type {
	case Dir:
		err = k.config.KBFSOps().RemoveDir(ctx, node, leaf)
	default:
		err = k.config.KBFSOps().RemoveEntry(ctx, node, leaf)
	}
	// TODO Should this be async
	return err
}

// SimpleFSStat - Get info about file
func (k *SimpleFS) SimpleFSStat(ctx context.Context, path keybase1.Path) (keybase1.Dirent, error) {
	ctx, err := k.startSyncOp(ctx, "Stat", path)
	if err != nil {
		return keybase1.Dirent{}, err
	}
	defer k.doneSyncOp(ctx)

	node, err := k.getRemoteNode(ctx, path)
	if err != nil {
		return keybase1.Dirent{}, err
	}
	return wrapStat(k.config.KBFSOps().Stat(ctx, node))
}

// SimpleFSMakeOpid - Convenience helper for generating new random value
func (k *SimpleFS) SimpleFSMakeOpid(_ context.Context) (keybase1.OpID, error) {
	var opid keybase1.OpID
	err := kbfscrypto.RandRead(opid[:])
	return opid, err
}

// SimpleFSClose - Close OpID, cancels any pending operation.
// Must be called after list/copy/remove
func (k *SimpleFS) SimpleFSClose(ctx context.Context, opid keybase1.OpID) error {
	ctx, err := k.startSyncOp(ctx, "Close", opid)
	if err != nil {
		return err
	}
	defer k.doneSyncOp(ctx)

	k.lock.Lock()
	defer k.lock.Unlock()
	h, ok := k.handles[opid]
	if !ok {
		return errNoSuchHandle
	}
	delete(k.handles, opid)
	if h.node != nil {
		err = k.config.KBFSOps().Sync(ctx, h.node)
	}
	return err
}

// SimpleFSCheck - Check progress of pending operation
func (k *SimpleFS) SimpleFSCheck(_ context.Context, opid keybase1.OpID) (keybase1.Progress, error) {
	// TODO
	return 0, errors.New("not implemented")
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
func (k *SimpleFS) SimpleFSWait(_ context.Context, opid keybase1.OpID) error {
	k.lock.RLock()
	w, ok := k.inProgress[opid]
	k.lock.RUnlock()
	if !ok {
		return errNoSuchHandle
	}

	<-w.done
	return nil
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
	Node, EntryInfo, error) {
	var node Node
	var ei EntryInfo

	parent, name, err := k.getRemoteNodeParent(ctx, dest)
	if err != nil {
		return node, ei, err
	}

	// TODO: OpenFlags_REPLACE
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
	Node, []string, error) {
	ps, public, err := remotePath(path)
	if err != nil {
		return nil, nil, err
	}
	tlf, err := ParseTlfHandlePreferred(
		ctx, k.config.KBPKI(), ps[0], public)
	if err != nil {
		return nil, nil, err
	}
	node, _, err := k.config.KBFSOps().GetOrCreateRootNode(
		ctx, tlf, MasterBranch)
	if err != nil {
		return nil, nil, err
	}
	return node, ps[1:], nil
}

// getRemoteNode
func (k *SimpleFS) getRemoteNode(ctx context.Context, path keybase1.Path) (
	Node, error) {
	node, ps, err := k.getRemoteRootNode(ctx, path)
	if err != nil {
		return nil, err
	}

	// TODO: should we walk symlinks here?
	// Some callers like List* don't want that.
	for _, name := range ps {
		node, _, err = k.config.KBFSOps().Lookup(ctx, node, name)
		if err != nil {
			return nil, err
		}
	}

	return node, nil
}

// getRemoteNodeParent
func (k *SimpleFS) getRemoteNodeParent(ctx context.Context, path keybase1.Path) (
	Node, string, error) {
	node, ps, err := k.getRemoteRootNode(ctx, path)
	if err != nil {
		return nil, "", err
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

func wrapStat(ei EntryInfo, err error) (keybase1.Dirent, error) {
	if err != nil {
		return keybase1.Dirent{}, err
	}
	var de keybase1.Dirent
	setStat(&de, &ei)
	return de, nil
}

func setStat(de *keybase1.Dirent, ei *EntryInfo) {
	de.Time = keybase1.Time(ei.Mtime)
	de.Size = int(ei.Size) // TODO: FIX protocol
	de.DirentType = deTy2Ty(ei)
}

func deTy2Ty(ei *EntryInfo) keybase1.DirentType {
	switch ei.Type {
	case Exec:
		return keybase1.DirentType_EXEC
	case File:
		return keybase1.DirentType_FILE
	case Dir:
		return keybase1.DirentType_DIR
	case Sym:
		return keybase1.DirentType_SYM
	}
	panic("deTy2Ty unreachable")
}

func (k *SimpleFS) setAsyncErr(opid keybase1.OpID, err error) {
	k.lock.Lock()
	k.handles[opid] = &handle{async: err}
	k.lock.Unlock()
}

type ioer interface {
	io.ReadWriteCloser
	Type() keybase1.DirentType
	Children() (map[string]EntryInfo, error)
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
		var cflags = os.O_RDWR
		if flags&keybase1.OpenFlags_EXISTING == 0 {
			cflags |= os.O_CREATE
		}
		if flags&keybase1.OpenFlags_REPLACE == 1 {
			cflags |= os.O_TRUNC
		}
		var f *os.File
		if (cflags&os.O_CREATE != 0) && (flags&keybase1.OpenFlags_DIRECTORY != 0) {
			// Return value is ignored.
			os.Mkdir(path.Local(), 0755)
		}
		f, err = os.OpenFile(path.Local(), cflags, 0644)
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
	return nil, errors.New("Invalid path type")
}

type kbfsIO struct {
	ctx    context.Context
	sfs    *SimpleFS
	node   Node
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
	return r.sfs.config.KBFSOps().Sync(r.ctx, r.node)
}

func (r *kbfsIO) Type() keybase1.DirentType {
	return r.deType
}

func (r *kbfsIO) Children() (map[string]EntryInfo, error) {
	return r.sfs.config.KBFSOps().GetDirChildren(r.ctx, r.node)
}

type localIO struct {
	*os.File
	deType keybase1.DirentType
}

func (r *localIO) Type() keybase1.DirentType { return r.deType }
func (r *localIO) Children() (map[string]EntryInfo, error) {
	fis, err := r.File.Readdir(-1)
	if err != nil {
		return nil, err
	}
	eis := make(map[string]EntryInfo, len(fis))
	for _, fi := range fis {
		eis[fi.Name()] = EntryInfo{
			Type: ty2Kbfs(fi.Mode()),
		}
	}
	return eis, nil
}

func ty2Kbfs(mode os.FileMode) EntryType {
	switch {
	case mode.IsDir():
		return Dir
	case mode&os.ModeSymlink == os.ModeSymlink:
		return Sym
	case mode.IsRegular() && (mode&0700 == 0700):
		return Exec
	}
	return File
}

func (k *SimpleFS) startOp(ctx context.Context, opid keybase1.OpID,
	desc keybase1.OpDescription) (context.Context, error) {
	k.lock.Lock()
	k.inProgress[opid] = &inprogress{desc, make(chan struct{})}
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
	return NewContextWithCancellationDelayer(NewContextReplayable(
		outer, func(c context.Context) context.Context {
			return c
		}))
}

func (k *SimpleFS) doneOp(ctx context.Context, opid keybase1.OpID) {
	k.lock.Lock()
	w, ok := k.inProgress[opid]
	delete(k.inProgress, opid)
	k.lock.Unlock()
	if ok {
		close(w.done)
	}
	k.doneSyncOp(ctx)
}
func (k *SimpleFS) doneSyncOp(ctx context.Context) {
	k.log.CDebugf(ctx, "done")
	CleanupCancellationDelayer(ctx)
}

var errOnlyRemotePathSupported = errors.New("Only remote paths are supported for this operation")
var errInvalidRemotePath = errors.New("Invalid remote path")
var errNoSuchHandle = errors.New("No such handle")
var errNoResult = errors.New("Async result not found")
