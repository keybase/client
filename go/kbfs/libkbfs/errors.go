// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"time"

	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/idutil"
	"github.com/keybase/client/go/kbfs/kbfsblock"
	"github.com/keybase/client/go/kbfs/kbfscrypto"
	"github.com/keybase/client/go/kbfs/kbfsmd"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/kbfs/tlfhandle"
	kbname "github.com/keybase/client/go/kbun"
	"github.com/keybase/client/go/protocol/keybase1"
)

// ErrorFile is the name of the virtual file in KBFS that should
// contain the last reported error(s).
var ErrorFile = ".kbfs_error"

// WrapError simply wraps an error in a fmt.Stringer interface, so
// that it can be reported.
type WrapError struct {
	Err error
}

// String implements the fmt.Stringer interface for WrapError
func (e WrapError) String() string {
	return e.Err.Error()
}

// InvalidBlockRefError indicates an invalid block reference was
// encountered.
type InvalidBlockRefError struct {
	ref data.BlockRef
}

func (e InvalidBlockRefError) Error() string {
	return fmt.Sprintf("Invalid block ref %s", e.ref)
}

// InvalidPathError indicates an invalid path was encountered.
type InvalidPathError struct {
	p data.Path
}

// Error implements the error interface for InvalidPathError.
func (e InvalidPathError) Error() string {
	return fmt.Sprintf("Invalid path %s", e.p.DebugString())
}

// InvalidParentPathError indicates a path without a valid parent was
// encountered.
type InvalidParentPathError struct {
	p data.Path
}

// Error implements the error interface for InvalidParentPathError.
func (e InvalidParentPathError) Error() string {
	return fmt.Sprintf("Path with invalid parent %s", e.p.DebugString())
}

// DirNotEmptyError indicates that the user tried to unlink a
// subdirectory that was not empty.
type DirNotEmptyError struct {
	Name data.PathPartString
}

// Error implements the error interface for DirNotEmptyError
func (e DirNotEmptyError) Error() string {
	return fmt.Sprintf("Directory %s is not empty and can't be removed", e.Name)
}

// TlfAccessError that the user tried to perform an unpermitted
// operation on a top-level folder.
type TlfAccessError struct {
	ID tlf.ID
}

// Error implements the error interface for TlfAccessError
func (e TlfAccessError) Error() string {
	return fmt.Sprintf("Operation not permitted on folder %s", e.ID)
}

// RenameAcrossDirsError indicates that the user tried to do an atomic
// rename across directories.
type RenameAcrossDirsError struct {
	// ApplicationExecPath, if not empty, is the exec path of the application
	// that issued the rename.
	ApplicationExecPath string
}

// Error implements the error interface for RenameAcrossDirsError
func (e RenameAcrossDirsError) Error() string {
	return fmt.Sprintf("Cannot rename across directories")
}

// ErrorFileAccessError indicates that the user tried to perform an
// operation on the ErrorFile that is not allowed.
type ErrorFileAccessError struct {
}

// Error implements the error interface for ErrorFileAccessError
func (e ErrorFileAccessError) Error() string {
	return fmt.Sprintf("Operation not allowed on file %s", ErrorFile)
}

// WriteUnsupportedError indicates an error when trying to write a file
type WriteUnsupportedError struct {
	Filename string
}

// Error implements the error interface for WriteUnsupportedError
func (e WriteUnsupportedError) Error() string {
	return fmt.Sprintf("Writing to %s is unsupported", e.Filename)
}

// WriteToReadonlyNodeError indicates an error when trying to write a
// node that's marked as read-only.
type WriteToReadonlyNodeError struct {
	Filename string
}

// Error implements the error interface for WriteToReadonlyNodeError
func (e WriteToReadonlyNodeError) Error() string {
	return fmt.Sprintf("%s is read-only and writes are not allowed", e.Filename)
}

// UnsupportedOpInUnlinkedDirError indicates an error when trying to
// create a file.
type UnsupportedOpInUnlinkedDirError struct {
	Dirpath string
}

// Error implements the error interface for UnsupportedOpInUnlinkedDirError.
func (e UnsupportedOpInUnlinkedDirError) Error() string {
	return fmt.Sprintf(
		"Operation is unsupported in unlinked directory %s", e.Dirpath)
}

// NewWriteUnsupportedError returns unsupported error trying to write a file
func NewWriteUnsupportedError(filename string) error {
	return WriteUnsupportedError{
		Filename: filename,
	}
}

// NeedSelfRekeyError indicates that the folder in question needs to
// be rekeyed for the local device, and can be done so by one of the
// other user's devices.
type NeedSelfRekeyError struct {
	Tlf tlf.CanonicalName
	Err error
}

// Error implements the error interface for NeedSelfRekeyError
func (e NeedSelfRekeyError) Error() string {
	return fmt.Sprintf("This device does not yet have read access to "+
		"directory %s, log into Keybase from one of your other "+
		"devices to grant access: %+v",
		tlfhandle.BuildCanonicalPathForTlfName(tlf.Private, e.Tlf), e.Err)
}

// ToStatus exports error to status
func (e NeedSelfRekeyError) ToStatus() keybase1.Status {
	kv := keybase1.StringKVPair{
		Key:   "Tlf",
		Value: string(e.Tlf),
	}
	return keybase1.Status{
		Code:   int(keybase1.StatusCode_SCNeedSelfRekey),
		Name:   "SC_NEED_SELF_REKEY",
		Desc:   e.Error(),
		Fields: []keybase1.StringKVPair{kv},
	}
}

// NeedOtherRekeyError indicates that the folder in question needs to
// be rekeyed for the local device, and can only done so by one of the
// other users.
type NeedOtherRekeyError struct {
	Tlf tlf.CanonicalName
	Err error
}

// Error implements the error interface for NeedOtherRekeyError
func (e NeedOtherRekeyError) Error() string {
	return fmt.Sprintf("This device does not yet have read access to "+
		"directory %s, ask one of the other directory participants to "+
		"log into Keybase to grant you access automatically: %+v",
		tlfhandle.BuildCanonicalPathForTlfName(tlf.Private, e.Tlf), e.Err)
}

// ToStatus exports error to status
func (e NeedOtherRekeyError) ToStatus() keybase1.Status {
	kv := keybase1.StringKVPair{
		Key:   "Tlf",
		Value: string(e.Tlf),
	}
	return keybase1.Status{
		Code:   int(keybase1.StatusCode_SCNeedOtherRekey),
		Name:   "SC_NEED_OTHER_REKEY",
		Desc:   e.Error(),
		Fields: []keybase1.StringKVPair{kv},
	}
}

// NotFileBlockError indicates that a file block was expected but a
// block of a different type was found.
//
// ptr and branch should be filled in, but p may be empty.
type NotFileBlockError struct {
	ptr    data.BlockPointer
	branch data.BranchName
	p      data.Path
}

func (e NotFileBlockError) Error() string {
	return fmt.Sprintf("The block at %s is not a file block (branch=%s, path=%s)", e.ptr, e.branch, e.p)
}

// NotDirBlockError indicates that a file block was expected but a
// block of a different type was found.
//
// ptr and branch should be filled in, but p may be empty.
type NotDirBlockError struct {
	ptr    data.BlockPointer
	branch data.BranchName
	p      data.Path
}

func (e NotDirBlockError) Error() string {
	return fmt.Sprintf("The block at %s is not a dir block (branch=%s, path=%s)", e.ptr, e.branch, e.p)
}

// NotFileError indicates that the user tried to perform a
// file-specific operation on something that isn't a file.
type NotFileError struct {
	path data.Path
}

// Error implements the error interface for NotFileError
func (e NotFileError) Error() string {
	return fmt.Sprintf("%s is not a file (folder %s)", e.path, e.path.Tlf)
}

// NotDirError indicates that the user tried to perform a
// dir-specific operation on something that isn't a directory.
type NotDirError struct {
	path data.Path
}

// Error implements the error interface for NotDirError
func (e NotDirError) Error() string {
	return fmt.Sprintf("%s is not a directory (folder %s)", e.path, e.path.Tlf)
}

// BlockDecodeError indicates that a block couldn't be decoded as
// expected; probably it is the wrong type.
type BlockDecodeError struct {
	decodeErr error
}

// Error implements the error interface for BlockDecodeError
func (e BlockDecodeError) Error() string {
	return fmt.Sprintf("Decode error for a block: %v", e.decodeErr)
}

// BadCryptoError indicates that KBFS performed a bad crypto operation.
type BadCryptoError struct {
	ID kbfsblock.ID
}

// Error implements the error interface for BadCryptoError
func (e BadCryptoError) Error() string {
	return fmt.Sprintf("Bad crypto for block %v", e.ID)
}

// BadCryptoMDError indicates that KBFS performed a bad crypto
// operation, specifically on a MD object.
type BadCryptoMDError struct {
	ID tlf.ID
}

// Error implements the error interface for BadCryptoMDError
func (e BadCryptoMDError) Error() string {
	return fmt.Sprintf("Bad crypto for the metadata of directory %v", e.ID)
}

// BadMDError indicates that the system is storing corrupt MD object
// for the given TLF ID.
type BadMDError struct {
	ID tlf.ID
}

// Error implements the error interface for BadMDError
func (e BadMDError) Error() string {
	return fmt.Sprintf("Wrong format for metadata for directory %v", e.ID)
}

// MDMismatchError indicates an inconsistent or unverifiable MD object
// for the given top-level folder.
type MDMismatchError struct {
	Revision kbfsmd.Revision
	Dir      string
	TlfID    tlf.ID
	Err      error
}

// Error implements the error interface for MDMismatchError
func (e MDMismatchError) Error() string {
	return fmt.Sprintf("Could not verify metadata (revision=%d) for directory %s (id=%s): %s",
		e.Revision, e.Dir, e.TlfID, e.Err)
}

// NoSuchMDError indicates that there is no MD object for the given
// folder, revision, and merged status.
type NoSuchMDError struct {
	Tlf tlf.ID
	Rev kbfsmd.Revision
	BID kbfsmd.BranchID
}

// Error implements the error interface for NoSuchMDError
func (e NoSuchMDError) Error() string {
	return fmt.Sprintf("Couldn't get metadata for folder %v, revision %d, "+
		"%s", e.Tlf, e.Rev, e.BID)
}

// InvalidDataVersionError indicates that an invalid data version was
// used.
type InvalidDataVersionError struct {
	DataVer data.Ver
}

// Error implements the error interface for InvalidDataVersionError.
func (e InvalidDataVersionError) Error() string {
	return fmt.Sprintf("Invalid data version %d", int(e.DataVer))
}

// NewDataVersionError indicates that the data at the given path has
// been written using a new data version that our client doesn't
// understand.
type NewDataVersionError struct {
	path    data.Path
	DataVer data.Ver
}

// Error implements the error interface for NewDataVersionError.
func (e NewDataVersionError) Error() string {
	return fmt.Sprintf(
		"The data at path %s is of a version (%d) that we can't read "+
			"(in folder %s)",
		e.path, e.DataVer, e.path.Tlf)
}

// OutdatedVersionError indicates that we have encountered some new
// data version we don't understand, and the user should be prompted
// to upgrade.
type OutdatedVersionError struct {
}

// Error implements the error interface for OutdatedVersionError.
func (e OutdatedVersionError) Error() string {
	return "Your software is out of date, and cannot read this data.  " +
		"Please use `keybase update check` to upgrade your software."
}

// InvalidVersionError indicates that we have encountered some new data version
// we don't understand, and we don't know how to handle it.
type InvalidVersionError struct {
	msg string
}

// Error implements the error interface for InvalidVersionError.
func (e InvalidVersionError) Error() string {
	if e.msg != "" {
		return e.msg
	}
	return "The version provided is not valid."
}

// TooLowByteCountError indicates that size of a block is smaller than
// the expected size.
type TooLowByteCountError struct {
	ExpectedMinByteCount int
	ByteCount            int
}

// Error implements the error interface for TooLowByteCountError
func (e TooLowByteCountError) Error() string {
	return fmt.Sprintf("Expected at least %d bytes, got %d bytes",
		e.ExpectedMinByteCount, e.ByteCount)
}

// InconsistentEncodedSizeError is raised when a dirty block has a
// non-zero encoded size.
type InconsistentEncodedSizeError struct {
	info data.BlockInfo
}

// Error implements the error interface for InconsistentEncodedSizeError
func (e InconsistentEncodedSizeError) Error() string {
	return fmt.Sprintf("Block pointer to dirty block %v with non-zero "+
		"encoded size = %d bytes", e.info.ID, e.info.EncodedSize)
}

// MDWriteNeededInRequest indicates that the system needs MD write
// permissions to successfully complete an operation, so it should
// retry in mdWrite mode.
type MDWriteNeededInRequest struct {
}

// Error implements the error interface for MDWriteNeededInRequest
func (e MDWriteNeededInRequest) Error() string {
	return "This request needs MD write access, but doesn't have it."
}

// VerifyingKeyNotFoundError indicates that a verifying key matching
// the given one couldn't be found.
type VerifyingKeyNotFoundError struct {
	key kbfscrypto.VerifyingKey
}

func (e VerifyingKeyNotFoundError) Error() string {
	return fmt.Sprintf("Could not find verifying key %s", e.key)
}

// UnverifiableTlfUpdateError indicates that a MD update could not be
// verified.
type UnverifiableTlfUpdateError struct {
	Tlf  string
	User kbname.NormalizedUsername
	Err  error
}

// Error implements the error interface for UnverifiableTlfUpdateError.
func (e UnverifiableTlfUpdateError) Error() string {
	return fmt.Sprintf("%s was last written by an unknown device claiming "+
		"to belong to user %s.  The device has possibly been revoked by the "+
		"user.  Use `keybase log send` to file an issue with the Keybase "+
		"admins.", e.Tlf, e.User)
}

// KeyCacheMissError indicates that a key matching the given TLF ID
// and key generation wasn't found in cache.
type KeyCacheMissError struct {
	tlf    tlf.ID
	keyGen kbfsmd.KeyGen
}

// Error implements the error interface for KeyCacheMissError.
func (e KeyCacheMissError) Error() string {
	return fmt.Sprintf("Could not find key with tlf=%s, keyGen=%d", e.tlf, e.keyGen)
}

// KeyCacheHitError indicates that a key matching the given TLF ID
// and key generation was found in cache but the object type was unknown.
type KeyCacheHitError struct {
	tlf    tlf.ID
	keyGen kbfsmd.KeyGen
}

// Error implements the error interface for KeyCacheHitError.
func (e KeyCacheHitError) Error() string {
	return fmt.Sprintf("Invalid key with tlf=%s, keyGen=%d", e.tlf, e.keyGen)
}

// NoKeysError indicates that no keys were provided for a decryption allowing
// multiple device keys
type NoKeysError struct{}

func (e NoKeysError) Error() string {
	return "No keys provided"
}

// WrongOpsError indicates that an unexpected path got passed into a
// FolderBranchOps instance
type WrongOpsError struct {
	nodeFB data.FolderBranch
	opsFB  data.FolderBranch
}

// Error implements the error interface for WrongOpsError.
func (e WrongOpsError) Error() string {
	return fmt.Sprintf("Ops for folder %v, branch %s, was given path %s, "+
		"branch %s", e.opsFB.Tlf, e.opsFB.Branch, e.nodeFB.Tlf, e.nodeFB.Branch)
}

// NodeNotFoundError indicates that we tried to find a node for the
// given BlockPointer and failed.
type NodeNotFoundError struct {
	ptr data.BlockPointer
}

// Error implements the error interface for NodeNotFoundError.
func (e NodeNotFoundError) Error() string {
	return fmt.Sprintf("No node found for pointer %v", e.ptr)
}

// ParentNodeNotFoundError indicates that we tried to update a Node's
// parent with a BlockPointer that we don't yet know about.
type ParentNodeNotFoundError struct {
	parent data.BlockRef
}

// Error implements the error interface for ParentNodeNotFoundError.
func (e ParentNodeNotFoundError) Error() string {
	return fmt.Sprintf("No such parent node found for %v", e.parent)
}

// EmptyNameError indicates that the user tried to use an empty name
// for the given BlockRef.
type EmptyNameError struct {
	ref data.BlockRef
}

// Error implements the error interface for EmptyNameError.
func (e EmptyNameError) Error() string {
	return fmt.Sprintf("Cannot use empty name for %v", e.ref)
}

// KeyHalfMismatchError is returned when the key server doesn't return the expected key half.
type KeyHalfMismatchError struct {
	Expected kbfscrypto.TLFCryptKeyServerHalfID
	Actual   kbfscrypto.TLFCryptKeyServerHalfID
}

// Error implements the error interface for KeyHalfMismatchError.
func (e KeyHalfMismatchError) Error() string {
	return fmt.Sprintf("Key mismatch, expected ID: %s, actual ID: %s",
		e.Expected, e.Actual)
}

// MDServerDisconnected indicates the MDServer has been disconnected for clients waiting
// on an update channel.
type MDServerDisconnected struct {
}

// Error implements the error interface for MDServerDisconnected.
func (e MDServerDisconnected) Error() string {
	return "MDServer is disconnected"
}

// MDUpdateInvertError indicates that we tried to apply a revision that
// was not the next in line.
type MDUpdateInvertError struct {
	rev  kbfsmd.Revision
	curr kbfsmd.Revision
}

// Error implements the error interface for MDUpdateInvertError.
func (e MDUpdateInvertError) Error() string {
	return fmt.Sprintf("MD revision %d isn't next in line for our "+
		"current revision %d while inverting", e.rev, e.curr)
}

// NotPermittedWhileDirtyError indicates that some operation failed
// because of outstanding dirty files, and may be retried later.
type NotPermittedWhileDirtyError struct {
}

// Error implements the error interface for NotPermittedWhileDirtyError.
func (e NotPermittedWhileDirtyError) Error() string {
	return "Not permitted while writes are dirty"
}

// NoChainFoundError indicates that a conflict resolution chain
// corresponding to the given pointer could not be found.
type NoChainFoundError struct {
	ptr data.BlockPointer
}

// Error implements the error interface for NoChainFoundError.
func (e NoChainFoundError) Error() string {
	return fmt.Sprintf("No chain found for %v", e.ptr)
}

// DisallowedPrefixError indicates that the user attempted to create
// an entry using a name with a disallowed prefix.
type DisallowedPrefixError struct {
	name   string
	prefix string
}

// Error implements the error interface for NoChainFoundError.
func (e DisallowedPrefixError) Error() string {
	return fmt.Sprintf("Cannot create %s because it has the prefix %s",
		e.name, e.prefix)
}

// NameTooLongError indicates that the user tried to write a directory
// entry name that would be bigger than KBFS's supported size.
type NameTooLongError struct {
	name            string
	maxAllowedBytes uint32
}

// Error implements the error interface for NameTooLongError.
func (e NameTooLongError) Error() string {
	return fmt.Sprintf("New directory entry name %s has more than the maximum "+
		"allowed number of bytes (%d)", e.name, e.maxAllowedBytes)
}

// NoCurrentSessionExpectedError is the error text that will get
// converted into a NoCurrentSessionError.
var NoCurrentSessionExpectedError = "no current session"

// RekeyPermissionError indicates that the user tried to rekey a
// top-level folder in a manner inconsistent with their permissions.
type RekeyPermissionError struct {
	User kbname.NormalizedUsername
	Dir  string
}

// Error implements the error interface for RekeyPermissionError
func (e RekeyPermissionError) Error() string {
	return fmt.Sprintf("%s is trying to rekey directory %s in a manner "+
		"inconsistent with their role", e.User, e.Dir)
}

// NewRekeyPermissionError constructs a RekeyPermissionError for the given
// directory and user.
func NewRekeyPermissionError(
	dir *tlfhandle.Handle, username kbname.NormalizedUsername) error {
	dirname := dir.GetCanonicalPath()
	return RekeyPermissionError{username, dirname}
}

// RekeyIncompleteError is returned when a rekey is partially done but
// needs a writer to finish it.
type RekeyIncompleteError struct{}

func (e RekeyIncompleteError) Error() string {
	return fmt.Sprintf("Rekey did not complete due to insufficient user permissions")
}

// TimeoutError is just a replacement for context.DeadlineExceeded
// with a more friendly error string.
type TimeoutError struct {
}

func (e TimeoutError) Error() string {
	return "Operation timed out"
}

// InvalidOpError is returned when an operation is called that isn't supported
// by the current implementation.
type InvalidOpError struct {
	op string
}

func (e InvalidOpError) Error() string {
	return fmt.Sprintf("Invalid operation: %s", e.op)
}

// NoSuchFolderListError indicates that the user tried to access a
// subdirectory of /keybase that doesn't exist.
type NoSuchFolderListError struct {
	Name     string
	PrivName string
	PubName  string
}

// Error implements the error interface for NoSuchFolderListError
func (e NoSuchFolderListError) Error() string {
	return fmt.Sprintf("/keybase/%s is not a Keybase folder. "+
		"All folders begin with /keybase/%s or /keybase/%s.",
		e.Name, e.PrivName, e.PubName)
}

// UnexpectedUnmergedPutError indicates that we tried to do an
// unmerged put when that was disallowed.
type UnexpectedUnmergedPutError struct {
}

// Error implements the error interface for UnexpectedUnmergedPutError
func (e UnexpectedUnmergedPutError) Error() string {
	return "Unmerged puts are not allowed"
}

// NoSuchTlfHandleError indicates we were unable to resolve a folder
// ID to a folder handle.
type NoSuchTlfHandleError struct {
	ID tlf.ID
}

// Error implements the error interface for NoSuchTlfHandleError
func (e NoSuchTlfHandleError) Error() string {
	return fmt.Sprintf("Folder handle for %s not found", e.ID)
}

// NoSuchTlfIDError indicates we were unable to resolve a folder
// handle to a folder ID.
type NoSuchTlfIDError struct {
	handle *tlfhandle.Handle
}

// Error implements the error interface for NoSuchTlfIDError
func (e NoSuchTlfIDError) Error() string {
	return fmt.Sprintf("Folder ID for %s not found",
		e.handle.GetCanonicalPath())
}

// IncompatibleHandleError indicates that somethine tried to update
// the head of a TLF with a RootMetadata with an incompatible handle.
type IncompatibleHandleError struct {
	oldName                  tlf.CanonicalName
	partiallyResolvedOldName tlf.CanonicalName
	newName                  tlf.CanonicalName
}

func (e IncompatibleHandleError) Error() string {
	return fmt.Sprintf(
		"old head %q resolves to %q instead of new head %q",
		e.oldName, e.partiallyResolvedOldName, e.newName)
}

// UnmergedError indicates that fbo is on an unmerged local revision
type UnmergedError struct {
}

// Error implements the error interface for UnmergedError.
func (e UnmergedError) Error() string {
	return "fbo is on an unmerged local revision"
}

// ExclOnUnmergedError happens when an operation with O_EXCL set when fbo is on
// an unmerged local revision
type ExclOnUnmergedError struct {
}

// Error implements the error interface for ExclOnUnmergedError.
func (e ExclOnUnmergedError) Error() string {
	return "an operation with O_EXCL set is called but fbo is on an unmerged local version"
}

// OverQuotaWarning indicates that the user is over their quota, and
// is being slowed down by the server.
type OverQuotaWarning struct {
	UsageBytes int64
	LimitBytes int64
}

// Error implements the error interface for OverQuotaWarning.
func (w OverQuotaWarning) Error() string {
	return fmt.Sprintf("You are using %d bytes, and your plan limits you "+
		"to %d bytes.  Please delete some data.", w.UsageBytes, w.LimitBytes)
}

// OpsCantHandleFavorite means that folderBranchOps wasn't able to
// deal with a favorites request.
type OpsCantHandleFavorite struct {
	Msg string
}

// Error implements the error interface for OpsCantHandleFavorite.
func (e OpsCantHandleFavorite) Error() string {
	return fmt.Sprintf("Couldn't handle the favorite operation: %s", e.Msg)
}

// RekeyConflictError indicates a conflict happened while trying to rekey.
type RekeyConflictError struct {
	Err error
}

// Error implements the error interface for RekeyConflictError.
func (e RekeyConflictError) Error() string {
	return fmt.Sprintf("Conflict during a rekey, not retrying: %v", e.Err)
}

// UnmergedSelfConflictError indicates that we hit a conflict on the
// unmerged branch, so a previous MD PutUnmerged we thought had
// failed, had actually succeeded.
type UnmergedSelfConflictError struct {
	Err error
}

// Error implements the error interface for UnmergedSelfConflictError.
func (e UnmergedSelfConflictError) Error() string {
	return fmt.Sprintf("Unmerged self conflict: %v", e.Err)
}

// blockNonExistentError is returned when a block doesn't exist. This
// is a generic error, suitable for use by non-server types, whereas
// kbfsblock.ServerErrorBlockNonExistent is used only by servers.
type blockNonExistentError struct {
	id kbfsblock.ID
}

func (e blockNonExistentError) Error() string {
	return fmt.Sprintf("block %s does not exist", e.id)
}

// NoMergedMDError indicates that no MDs for this folder have been
// created yet.
type NoMergedMDError struct {
	tlf tlf.ID
}

// Error implements the error interface for NoMergedMDError.
func (e NoMergedMDError) Error() string {
	return fmt.Sprintf("No MD yet for TLF %s", e.tlf)
}

// InvalidFavoritesOpError indicates an unknown FavoritesOp has been provided.
type InvalidFavoritesOpError struct{}

// Error implements the error interface for InvalidFavoritesOpError.
func (InvalidFavoritesOpError) Error() string {
	return "invalid FavoritesOp"
}

// DiskCacheClosedError indicates that the disk cache has been
// closed, and thus isn't accepting any more operations.
type DiskCacheClosedError struct {
	op string
}

// Error implements the error interface for DiskCacheClosedError.
func (e DiskCacheClosedError) Error() string {
	return fmt.Sprintf("Error performing %s operation: the disk cache is "+
		"closed", e.op)
}

// DiskCacheStartingError indicates that the disk cache has not yet started, so
// it isn't yet accepting operations.
type DiskCacheStartingError struct {
	op string
}

// Error implements the error interface for DiskCacheStartingError.
func (e DiskCacheStartingError) Error() string {
	return fmt.Sprintf("Error performing %s operation: the disk cache is "+
		"still starting", e.op)
}

// NoUpdatesWhileDirtyError indicates that updates aren't being
// accepted while a TLF is locally dirty.
type NoUpdatesWhileDirtyError struct{}

// Error implements the error interface for NoUpdatesWhileDirtyError.
func (e NoUpdatesWhileDirtyError) Error() string {
	return "Ignoring MD updates while writes are dirty"
}

// Disk Cache Errors
const (
	// StatusCodeDiskBlockCacheError is a generic disk cache error.
	StatusCodeDiskBlockCacheError = 0x666
	// StatusCodeDiskMDCacheError is a generic disk cache error.
	StatusCodeDiskMDCacheError = 0x667
	// StatusCodeDiskQuotaCacheError is a generic disk cache error.
	StatusCodeDiskQuotaCacheError = 0x668
)

// DiskBlockCacheError is a generic disk cache error.
type DiskBlockCacheError struct {
	Msg string
}

func newDiskBlockCacheError(err error) DiskBlockCacheError {
	return DiskBlockCacheError{err.Error()}
}

// ToStatus implements the ExportableError interface for DiskBlockCacheError.
func (e DiskBlockCacheError) ToStatus() (s keybase1.Status) {
	s.Code = StatusCodeDiskBlockCacheError
	s.Name = "DISK_BLOCK_CACHE_ERROR"
	s.Desc = e.Msg
	return
}

// Error implements the Error interface for DiskBlockCacheError.
func (e DiskBlockCacheError) Error() string {
	return "DiskBlockCacheError{" + e.Msg + "}"
}

// DiskMDCacheError is a generic disk cache error.
type DiskMDCacheError struct {
	Msg string
}

func newDiskMDCacheError(err error) DiskMDCacheError {
	return DiskMDCacheError{err.Error()}
}

// ToStatus implements the ExportableError interface for DiskMDCacheError.
func (e DiskMDCacheError) ToStatus() (s keybase1.Status) {
	s.Code = StatusCodeDiskMDCacheError
	s.Name = "DISK_MD_CACHE_ERROR"
	s.Desc = e.Msg
	return
}

// Error implements the Error interface for DiskMDCacheError.
func (e DiskMDCacheError) Error() string {
	return "DiskMDCacheError{" + e.Msg + "}"
}

// DiskQuotaCacheError is a generic disk cache error.
type DiskQuotaCacheError struct {
	Msg string
}

func newDiskQuotaCacheError(err error) DiskQuotaCacheError {
	return DiskQuotaCacheError{err.Error()}
}

// ToStatus implements the ExportableError interface for DiskQuotaCacheError.
func (e DiskQuotaCacheError) ToStatus() (s keybase1.Status) {
	s.Code = StatusCodeDiskQuotaCacheError
	s.Name = "DISK_QUOTA_CACHE_ERROR"
	s.Desc = e.Msg
	return
}

// Error implements the Error interface for DiskQuotaCacheError.
func (e DiskQuotaCacheError) Error() string {
	return "DiskQuotaCacheError{" + e.Msg + "}"
}

// RevokedDeviceVerificationError indicates that the user is trying to
// verify a key that has been revoked.  It includes useful information
// about the revocation, so the code receiving the error can check if
// the device was valid at the time of the data being checked.
type RevokedDeviceVerificationError struct {
	info idutil.RevokedKeyInfo
}

// Error implements the Error interface for RevokedDeviceVerificationError.
func (e RevokedDeviceVerificationError) Error() string {
	return fmt.Sprintf("Device was revoked at time %s, root seqno %d",
		e.info.Time.Time().Format(time.RFC3339Nano), e.info.MerkleRoot.Seqno)
}

// MDWrittenAfterRevokeError indicates that we failed to verify an MD
// revision because it was written after the last valid revision that
// the corresponding device could have written.
type MDWrittenAfterRevokeError struct {
	tlfID        tlf.ID
	revBad       kbfsmd.Revision
	revLimit     kbfsmd.Revision
	verifyingKey kbfscrypto.VerifyingKey
}

// Error implements the Error interface for MDWrittenAfterRevokeError.
func (e MDWrittenAfterRevokeError) Error() string {
	return fmt.Sprintf("Failed to verify revision %d of folder %s by key %s; "+
		"last valid revision would have been %d",
		e.revBad, e.tlfID, e.verifyingKey, e.revLimit)
}

// RevGarbageCollectedError indicates that the user is trying to
// access a revision that's already been garbage-collected.
type RevGarbageCollectedError struct {
	rev       kbfsmd.Revision
	lastGCRev kbfsmd.Revision
}

// Error implements the Error interface for RevGarbageCollectedError.
func (e RevGarbageCollectedError) Error() string {
	return fmt.Sprintf("Requested revision %d has already been garbage "+
		"collected (last GC'd rev=%d)", e.rev, e.lastGCRev)
}

// FolderNotResetOnServer indicates that a folder can't be reset by
// the user, because it hasn't yet been reset on the mdserver.
type FolderNotResetOnServer struct {
	h *tlfhandle.Handle
}

// Error implements the Error interface for FolderNotResetOnServer.
func (e FolderNotResetOnServer) Error() string {
	return fmt.Sprintf("Folder %s is not yet reset on the server; "+
		"contact Keybase for help", e.h.GetCanonicalPath())
}

// OfflineArchivedError indicates trying to access archived data while
// offline.
type OfflineArchivedError struct {
	h *tlfhandle.Handle
}

// Error implements the Error interface for OfflineArchivedError.
func (e OfflineArchivedError) Error() string {
	return fmt.Sprintf("Archived data from %s is not available while offline",
		e.h.GetCanonicalPath())
}

// OfflineUnsyncedError indicates trying to access unsynced data while
// offline.
type OfflineUnsyncedError struct {
	h *tlfhandle.Handle
}

// Error implements the Error interface for OfflineUnsyncedError.
func (e OfflineUnsyncedError) Error() string {
	return fmt.Sprintf("Unsynced data from %s is not available while offline",
		e.h.GetCanonicalPath())
}

// NextMDNotCachedError indicates we haven't cached the next MD after
// the given Merkle seqno.
type NextMDNotCachedError struct {
	TlfID     tlf.ID
	RootSeqno keybase1.Seqno
}

// Error implements the Error interface for NextMDNotCachedError.
func (e NextMDNotCachedError) Error() string {
	return fmt.Sprintf("The MD following %d for folder %s is not cached",
		e.RootSeqno, e.TlfID)
}

// DiskCacheTooFullForBlockError indicates that the disk cache is too
// full to fetch a block requested with the `StopIfFull` action type.
type DiskCacheTooFullForBlockError struct {
	Ptr    data.BlockPointer
	Action BlockRequestAction
}

// Error implements the Error interface for DiskCacheTooFullForBlockError.
func (e DiskCacheTooFullForBlockError) Error() string {
	return fmt.Sprintf(
		"Disk cache too full for block %s requested with action %s",
		e.Ptr, e.Action)
}

// NonExistentTeamForHandleError indicates that we're trying to create
// a TLF for a handle that has no corresponding implicit team yet.
// Likely a writer needs to create the implicit team first.
type NonExistentTeamForHandleError struct {
	h *tlfhandle.Handle
}

// Error implements the Error interface for NonExistentTeamForHandleError.
func (e NonExistentTeamForHandleError) Error() string {
	return fmt.Sprintf("Can't create TLF ID for non-team-backed handle %s",
		e.h.GetCanonicalPath())
}
