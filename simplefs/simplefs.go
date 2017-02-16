// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package simplefs

import (
	"errors"
	"io"
	"os"
	"strings"
	"sync"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/libkbfs"
)

// SimpleFS - implement keybase1.SimpleFS
type SimpleFS struct {
	lock    sync.RWMutex
	config  libkbfs.Config
	handles map[keybase1.OpID]*handle
}

type handle struct {
	node  libkbfs.Node
	async interface{}
}

// make sure the interface is implemented
var _ keybase1.SimpleFSInterface = (*SimpleFS)(nil)

// SimpleFSList - Begin list of items in directory at path
// Retrieve results with readList()
// Cannot be a single file to get flags/status,
// must be a directory.
func (k *SimpleFS) SimpleFSList(ctx context.Context, arg keybase1.SimpleFSListArg) error {
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
func (k *SimpleFS) SimpleFSListRecursive(_ context.Context, arg keybase1.SimpleFSListRecursiveArg) error {
	return errors.New("not implemented")
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
	src, err := k.pathIO(ctx, arg.Src, keybase1.OpenFlags_READ|keybase1.OpenFlags_EXISTING)
	if err != nil {
		return err
	}
	defer src.Close()
	dst, err := k.pathIO(ctx, arg.Dest, keybase1.OpenFlags_WRITE|keybase1.OpenFlags_REPLACE)
	if err != nil {
		return err
	}
	defer dst.Close()
	_, err = io.Copy(dst, src)

	// TODO: async handling could be better.
	k.lock.Lock()
	k.handles[arg.OpID] = &handle{async: err}
	k.lock.Unlock()

	return err
}

// SimpleFSCopyRecursive - Begin recursive copy of directory
func (k *SimpleFS) SimpleFSCopyRecursive(_ context.Context, arg keybase1.SimpleFSCopyRecursiveArg) error {
	return errors.New("not implemented")
}

// SimpleFSMove - Begin move of file or directory, from/to KBFS only
func (k *SimpleFS) SimpleFSMove(_ context.Context, arg keybase1.SimpleFSMoveArg) error {
	return errors.New("not implemented")
}

// SimpleFSRename - Rename file or directory, KBFS side only
func (k *SimpleFS) SimpleFSRename(_ context.Context, arg keybase1.SimpleFSRenameArg) error {
	return errors.New("not implemented")
}

// SimpleFSOpen - Create/open a file and leave it open
// or create a directory
// Files must be closed afterwards.
func (k *SimpleFS) SimpleFSOpen(ctx context.Context, arg keybase1.SimpleFSOpenArg) error {
	node, _, err := k.open(ctx, arg.Dest, arg.Flags)

	if err != nil {
		return err
	}

	k.lock.Lock()
	k.handles[arg.OpID] = &handle{node: node}
	k.lock.Unlock()

	return nil
}

// SimpleFSSetStat - Set/clear file bits - only executable for now
func (k *SimpleFS) SimpleFSSetStat(_ context.Context, arg keybase1.SimpleFSSetStatArg) error {
	return errors.New("not implemented")
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
	bs := make([]byte, arg.Size)
	// TODO fix offset
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
	// TODO fix offset
	err := k.config.KBFSOps().Write(ctx, h.node, arg.Content, arg.Offset)
	return err
}

// SimpleFSRemove - Remove file or directory from filesystem
func (k *SimpleFS) SimpleFSRemove(ctx context.Context, arg keybase1.SimpleFSRemoveArg) error {
	node, leaf, err := k.getRemoteNodeParent(ctx, arg.Path)
	_, _, _ = node, leaf, err
	return errors.New("not implemented")
}

// SimpleFSStat - Get info about file
func (k *SimpleFS) SimpleFSStat(ctx context.Context, path keybase1.Path) (keybase1.Dirent, error) {
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
	k.lock.Lock()
	defer k.lock.Unlock()
	h, ok := k.handles[opid]
	if !ok {
		return errNoSuchHandle
	}
	delete(k.handles, opid)
	if h.node != nil {
		k.config.KBFSOps().Sync(ctx, h.node)
	}
	return nil
}

// SimpleFSCheck - Check progress of pending operation
func (k *SimpleFS) SimpleFSCheck(_ context.Context, opid keybase1.OpID) (keybase1.Progress, error) {
	return 0, errors.New("not implemented")
}

// SimpleFSGetOps - Get all the outstanding operations
func (k *SimpleFS) SimpleFSGetOps(_ context.Context) ([]keybase1.OpDescription, error) {
	return []keybase1.OpDescription{}, errors.New("not implemented")
}

// SimpleFSWait - Blocking wait for the pending operation to finish
func (k *SimpleFS) SimpleFSWait(_ context.Context, opid keybase1.OpID) error {
	return errors.New("not implemented")
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
	libkbfs.Node, []string, error) {
	ps, public, err := remotePath(path)
	if err != nil {
		return nil, nil, err
	}
	tlf, err := libkbfs.ParseTlfHandlePreferred(
		ctx, k.config.KBPKI(), ps[0], public)
	if err != nil {
		return nil, nil, err
	}
	node, _, err := k.config.KBFSOps().GetOrCreateRootNode(
		ctx, tlf, libkbfs.MasterBranch)
	if err != nil {
		return nil, nil, err
	}
	return node, ps[1:], nil
}

// getRemoteNode
func (k *SimpleFS) getRemoteNode(ctx context.Context, path keybase1.Path) (
	libkbfs.Node, error) {
	node, ps, err := k.getRemoteRootNode(ctx, path)
	if err != nil {
		return nil, err
	}

	// TODO: should we walk symlinks here?
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
	libkbfs.Node, string, error) {
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

func wrapStat(ei libkbfs.EntryInfo, err error) (keybase1.Dirent, error) {
	if err != nil {
		return keybase1.Dirent{}, err
	}
	var de keybase1.Dirent
	setStat(&de, &ei)
	return de, nil
}

func setStat(de *keybase1.Dirent, ei *libkbfs.EntryInfo) {
	de.Time = keybase1.Time(ei.Mtime)
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
}

func (k *SimpleFS) pathIO(ctx context.Context, path keybase1.Path,
	flags keybase1.OpenFlags) (io.ReadWriteCloser, error) {
	pt, err := path.PathType()
	if err != nil {
		return nil, err
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
		f, err := os.OpenFile(path.Local(), cflags, 0644)
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
	return r.sfs.config.KBFSOps().Sync(r.ctx, r.node)
}

func (r *kbfsIO) Type() keybase1.DirentType {
	return r.deType
}

type localIO struct {
	*os.File
	deType keybase1.DirentType
}

func (r *localIO) Type() keybase1.DirentType { return r.deType }

var errOnlyRemotePathSupported = errors.New("Only remote paths are supported for this operation")
var errInvalidRemotePath = errors.New("Invalid remote path")
var errNoSuchHandle = errors.New("No such handle")
var errNoResult = errors.New("Async result not found")
