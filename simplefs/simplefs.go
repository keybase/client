// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package simplefs

import (
	"errors"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/protocol/keybase1"
)

// SimpleFS - implement keybase1.SimpleFS
type SimpleFS struct{}

// make sure the interface is implemented
var _ keybase1.SimpleFSInterface = (*SimpleFS)(nil)

// SimpleFSList - Begin list of items in directory at path
// Retrieve results with readList()
// Can be a single file to get flags/status
func (k *SimpleFS) SimpleFSList(_ context.Context, arg keybase1.SimpleFSListArg) error {
	return errors.New("not implemented")
}

// SimpleFSListRecursive - Begin recursive list of items in directory at path
func (k *SimpleFS) SimpleFSListRecursive(_ context.Context, arg keybase1.SimpleFSListRecursiveArg) error {
	return errors.New("not implemented")
}

// SimpleFSReadList - Get list of Paths in progress. Can indicate status of pending
// to get more entries.
func (k *SimpleFS) SimpleFSReadList(context.Context, keybase1.OpID) (keybase1.SimpleFSListResult, error) {
	return keybase1.SimpleFSListResult{}, errors.New("not implemented")
}

// SimpleFSCopy - Begin copy of file or directory
func (k *SimpleFS) SimpleFSCopy(_ context.Context, arg keybase1.SimpleFSCopyArg) error {
	return errors.New("not implemented")
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
func (k *SimpleFS) SimpleFSOpen(_ context.Context, arg keybase1.SimpleFSOpenArg) error {
	return errors.New("not implemented")
}

// SimpleFSSetStat - Set/clear file bits - only executable for now
func (k *SimpleFS) SimpleFSSetStat(_ context.Context, arg keybase1.SimpleFSSetStatArg) error {
	return errors.New("not implemented")
}

// SimpleFSRead - Read (possibly partial) contents of open file,
// up to the amount specified by size.
// Repeat until zero bytes are returned or error.
// If size is zero, read an arbitrary amount.
func (k *SimpleFS) SimpleFSRead(_ context.Context, arg keybase1.SimpleFSReadArg) (keybase1.FileContent, error) {
	return keybase1.FileContent{}, errors.New("not implemented")
}

// SimpleFSWrite - Append content to opened file.
// May be repeated until OpID is closed.
func (k *SimpleFS) SimpleFSWrite(_ context.Context, arg keybase1.SimpleFSWriteArg) error {
	return errors.New("not implemented")
}

// SimpleFSRemove - Remove file or directory from filesystem
func (k *SimpleFS) SimpleFSRemove(_ context.Context, arg keybase1.SimpleFSRemoveArg) error {
	return errors.New("not implemented")
}

// SimpleFSStat - Get info about file
func (k *SimpleFS) SimpleFSStat(_ context.Context, path keybase1.Path) (keybase1.Dirent, error) {
	return keybase1.Dirent{}, errors.New("not implemented")
}

// SimpleFSMakeOpid - Convenience helper for generating new random value
func (k *SimpleFS) SimpleFSMakeOpid(_ context.Context) (keybase1.OpID, error) {
	return keybase1.OpID{}, errors.New("not implemented")
}

// SimpleFSClose - Close OpID, cancels any pending operation.
// Must be called after list/copy/remove
func (k *SimpleFS) SimpleFSClose(_ context.Context, opid keybase1.OpID) error {
	return errors.New("not implemented")
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
