// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package data

import (
	"fmt"
	"os"
	"reflect"
	"strconv"
	"strings"
	"time"

	"github.com/keybase/client/go/kbfs/kbfsblock"
	"github.com/keybase/client/go/kbfs/kbfscrypto"
	"github.com/keybase/client/go/kbfs/kbfsmd"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/kbfs/tlfhandle"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/pkg/errors"
)

const (
	// MaxBlockSizeBytesDefault is the default maximum block size for KBFS.
	// 512K blocks by default, block changes embedded max == 8K.
	// Block size was chosen somewhat arbitrarily by trying to
	// minimize the overall size of the history written by a user when
	// appending 1KB writes to a file, up to a 1GB total file.  Here
	// is the output of a simple script that approximates that
	// calculation:
	//
	// Total history size for 0065536-byte blocks: 1134341128192 bytes
	// Total history size for 0131072-byte blocks: 618945052672 bytes
	// Total history size for 0262144-byte blocks: 412786622464 bytes
	// Total history size for 0524288-byte blocks: 412786622464 bytes
	// Total history size for 1048576-byte blocks: 618945052672 bytes
	// Total history size for 2097152-byte blocks: 1134341128192 bytes
	// Total history size for 4194304-byte blocks: 2216672886784 bytes
	MaxBlockSizeBytesDefault = 512 << 10
	// MaxNameBytesDefault is the max supported size of a directory
	// entry name.
	MaxNameBytesDefault = 255
	// BackgroundTaskTimeout is the timeout for any background task.
	BackgroundTaskTimeout = 1 * time.Minute
)

// Ver is the type of a version for marshalled KBFS data structures.
//
// 1) Ver is a per-block attribute, not per-file. This means that,
// in theory, an indirect block with DataVer n may point to blocks
// with Vers less than, equal to, or greater than n. However, for
// now, it's guaranteed that an indirect block will never point to
// blocks with greater versions than itself. (See #3 for details.)
//
// 2) Ver is an external attribute of a block, meaning that it's
// not stored as part of the block, but computed by the creator (or
// anyone with the latest kbfs client), and stored only in pointers to
// the block.
//
// 2.5) A file (or, in the future a dir) can in theory have any
// arbitrary tree structure of blocks. However, we only write files
// such that all paths to leaves have the same depth.
//
// Currently, in addition to 2.5, we have the following constraints on block
// tree structures:
// a) Direct blocks are always v1.
// b) Indirect blocks of depth 2 (meaning one indirect block pointing
// to all direct blocks) can be v1 (if it has no holes) or v2 (if it has
// holes). However, all its indirect pointers will have Ver
// 1, by a).
// c) Indirect blocks of depth 3 must be v3 and must have at least one
// indirect pointer with an indirect DirectType [although if it holds
// for one, it should hold for all], although its indirect pointers
// may have any combination of Ver 1 or 2, by b).
// d) Indirect blocks of dept k > 3 must be v3 and must have at least
// one indirect pointer with an indirect DirectType [although if it
// holds for one, it should hold for all], and all of its indirect
// pointers must have Ver 3, by c).
type Ver int

const (
	// FirstValidVer is the first value that is considered a
	// valid data version. Note that the nil value is not
	// considered valid.
	FirstValidVer Ver = 1
	// ChildHolesVer is the data version for any indirect block
	// containing a set of pointers with holes.
	ChildHolesVer Ver = 2
	// AtLeastTwoLevelsOfChildrenVer is the data version for
	// blocks that have multiple levels of indirection below them
	// (i.e., indirect blocks that point to other indirect blocks).
	AtLeastTwoLevelsOfChildrenVer Ver = 3
	// IndirectDirsVer is the data version for a directory block
	// that contains indirect pointers.
	IndirectDirsVer Ver = 4
)

// BlockReqType indicates whether an operation makes block
// modifications or not
type BlockReqType int

const (
	// BlockRead indicates a block read request.
	BlockRead BlockReqType = iota
	// BlockWrite indicates a block write request.
	BlockWrite
	// BlockReadParallel indicates a block read request that is
	// happening from a different goroutine than the blockLock rlock
	// holder, using the same lState.
	BlockReadParallel
	// BlockLookup indicates a lookup for a block for the purposes of
	// creating a new node in the node cache for it; avoid any unlocks
	// as part of the lookup process.
	BlockLookup
)

// BlockDirectType indicates to what kind of block (direct or
// indirect) a BlockPointer points.
type BlockDirectType int

const (
	// UnknownDirectType indicates an old block that was written
	// before we started labeling pointers.
	UnknownDirectType BlockDirectType = 0
	// DirectBlock indicates the pointed-to block has no indirect
	// pointers.
	DirectBlock BlockDirectType = 1
	// IndirectBlock indicates the pointed-to block has indirect
	// pointers.
	IndirectBlock BlockDirectType = 2
)

func (bdt BlockDirectType) String() string {
	switch bdt {
	case UnknownDirectType:
		return "unknown"
	case DirectBlock:
		return "direct"
	case IndirectBlock:
		return "indirect"
	}
	return fmt.Sprintf("<unknown blockDirectType %d>", bdt)
}

// BlockRef is a block ID/ref nonce pair, which defines a unique
// reference to a block.
type BlockRef struct {
	ID       kbfsblock.ID
	RefNonce kbfsblock.RefNonce
}

// IsValid returns true exactly when ID.IsValid() does.
func (r BlockRef) IsValid() bool {
	return r.ID.IsValid()
}

func (r BlockRef) String() string {
	s := fmt.Sprintf("BlockRef{id: %s", r.ID)
	if r.RefNonce != kbfsblock.ZeroRefNonce {
		s += fmt.Sprintf(", refNonce: %s", r.RefNonce)
	}
	s += "}"
	return s
}

// BlockPointer contains the identifying information for a block in KBFS.
//
// NOTE: Don't add or modify anything in this struct without
// considering how old clients will handle them.
type BlockPointer struct {
	ID         kbfsblock.ID    `codec:"i"`
	KeyGen     kbfsmd.KeyGen   `codec:"k"`           // if valid, which generation of the TLF{Writer,Reader}KeyBundle to use.
	DataVer    Ver             `codec:"d"`           // if valid, which version of the KBFS data structures is pointed to
	DirectType BlockDirectType `codec:"t,omitempty"` // the type (direct, indirect, or unknown [if omitted]) of the pointed-to block
	kbfsblock.Context
}

// ZeroPtr represents an empty BlockPointer.
var ZeroPtr BlockPointer

// IsValid returns whether the block pointer is valid. A zero block
// pointer is considered invalid.
func (p BlockPointer) IsValid() bool {
	return p.ID.IsValid()

	// TODO: Should also check KeyGen, Ver, and Creator. (A
	// bunch of tests use invalid values for one of these.)
}

func (p BlockPointer) String() string {
	if p == (BlockPointer{}) {
		return "BlockPointer{}"
	}
	return fmt.Sprintf("BlockPointer{ID: %s, KeyGen: %d, DataVer: %d, "+
		"Context: %s, DirectType: %s}",
		p.ID, p.KeyGen, p.DataVer, p.Context, p.DirectType)
}

// IsInitialized returns whether or not this BlockPointer has non-nil data.
func (p BlockPointer) IsInitialized() bool {
	return p.ID != kbfsblock.ID{}
}

// Ref returns the BlockRef equivalent of this pointer.
func (p BlockPointer) Ref() BlockRef {
	return BlockRef{
		ID:       p.ID,
		RefNonce: p.RefNonce,
	}
}

// BlockInfo contains all information about a block in KBFS and its
// contents.
//
// NOTE: Don't add or modify anything in this struct without
// considering how old clients will handle them.
type BlockInfo struct {
	BlockPointer
	// When non-zero, the size of the encoded (and possibly
	// encrypted) data contained in the block. When non-zero,
	// always at least the size of the plaintext data contained in
	// the block.
	EncodedSize uint32 `codec:"e"`
}

func (bi BlockInfo) String() string {
	if bi == (BlockInfo{}) {
		return "BlockInfo{}"
	}
	return fmt.Sprintf("BlockInfo{BlockPointer: %s, EncodedSize: %d}",
		bi.BlockPointer, bi.EncodedSize)
}

// BPSize is the estimated size of a block pointer in bytes.
var BPSize = uint64(reflect.TypeOf(BlockPointer{}).Size())

// ReadyBlockData is a block that has been encoded (and encrypted).
type ReadyBlockData struct {
	// These fields should not be used outside of putBlockToServer.
	Buf        []byte
	ServerHalf kbfscrypto.BlockCryptKeyServerHalf
}

// GetEncodedSize returns the size of the encoded (and encrypted)
// block data.
func (r ReadyBlockData) GetEncodedSize() int {
	return len(r.Buf)
}

// EntryInfo is the (non-block-related) info a directory knows about
// its child.
//
// NOTE: Don't add or modify anything in this struct without
// considering how old clients will handle them (since this is
// embedded in DirEntry).
type EntryInfo struct {
	Type    EntryType
	Size    uint64
	SymPath string `codec:",omitempty"` // must be within the same root dir
	// Mtime is in unix nanoseconds
	Mtime int64
	// Ctime is in unix nanoseconds
	Ctime int64
	// If this is a team TLF, we want to track the last writer of an
	// entry, since in the block, only the team ID will be tracked.
	TeamWriter keybase1.UID `codec:"tw,omitempty"`
	// Tracks a skiplist of the previous revisions for this entry.
	PrevRevisions PrevRevisions `codec:"pr,omitempty"`
}

func init() {
	if reflect.ValueOf(EntryInfo{}).NumField() != 7 {
		panic(errors.New(
			"Unexpected number of fields in EntryInfo; " +
				"please update EntryInfo.Eq() for your " +
				"new or removed field"))
	}
}

// EntryInfoFromFileInfo converts an `os.FileInfo` into an
// `EntryInfo`, to the best of our ability to do so.  The caller is
// responsible for filling in `EntryInfo.SymPath`, if needed.
func EntryInfoFromFileInfo(fi os.FileInfo) EntryInfo {
	t := File
	switch {
	case fi.IsDir():
		t = Dir
	case fi.Mode()&os.ModeSymlink != 0:
		t = Sym
	case fi.Mode()&0100 != 0:
		t = Exec
	}
	mtime := fi.ModTime().UnixNano()
	return EntryInfo{
		Type:  t,
		Size:  uint64(fi.Size()), // TODO: deal with negatives?
		Mtime: mtime,
		Ctime: mtime,
		// Leave TeamWriter and PrevRevisions empty
	}
}

// Eq returns true if `other` is equal to `ei`.
func (ei EntryInfo) Eq(other EntryInfo) bool {
	eq := ei.Type == other.Type &&
		ei.Size == other.Size &&
		ei.SymPath == other.SymPath &&
		ei.Mtime == other.Mtime &&
		ei.Ctime == other.Ctime &&
		ei.TeamWriter == other.TeamWriter &&
		len(ei.PrevRevisions) == len(other.PrevRevisions)
	if !eq {
		return false
	}
	for i, pr := range ei.PrevRevisions {
		otherPR := other.PrevRevisions[i]
		if pr.Revision != otherPR.Revision || pr.Count != otherPR.Count {
			return false
		}
	}
	return true
}

// EntryType is the type of a directory entry.
type EntryType int

const (
	// File is a regular file.
	File EntryType = iota
	// Exec is an executable file.
	Exec
	// Dir is a directory.
	Dir
	// Sym is a symbolic link.
	Sym

	// FakeFile can be used to indicate a faked-out entry for a file,
	// that will be specially processed by folderBranchOps.
	FakeFile EntryType = 0xfffe
	// FakeDir can be used to indicate a faked-out entry for a directory,
	// that will be specially processed by folderBranchOps.
	FakeDir EntryType = 0xffff
)

// String implements the fmt.Stringer interface for EntryType
func (et EntryType) String() string {
	switch et {
	case File:
		return "FILE"
	case Exec:
		return "EXEC"
	case Dir:
		return "DIR"
	case Sym:
		return "SYM"
	}
	return "<invalid EntryType>"
}

// IsFile returns whether or not this entry points to a file.
func (et EntryType) IsFile() bool {
	return et == File || et == Exec
}

// BranchName is the name given to a KBFS branch, for a particular
// top-level folder.  Currently, the notion of a "branch" is
// client-side only, and can be used to specify which root to use for
// a top-level folder.  (For example, viewing a historical archive
// could use a different branch name.)
type BranchName string

const (
	// MasterBranch represents the mainline branch for a top-level
	// folder.  Set to the empty string so that the default will be
	// the master branch.
	MasterBranch BranchName = ""

	branchRevPrefix           = "rev="
	branchLocalConflictPrefix = "localConflict="
)

// MakeRevBranchName returns a branch name specifying an archive
// branch pinned to the given revision number.
func MakeRevBranchName(rev kbfsmd.Revision) BranchName {
	return BranchName(branchRevPrefix + strconv.FormatInt(int64(rev), 10))
}

// MakeConflictBranchName returns a branch name specifying a conflict
// date, if possible.
func MakeConflictBranchName(h *tlfhandle.Handle) (BranchName, bool) {
	if !h.IsLocalConflict() {
		return "", false
	}

	return BranchName(
		branchLocalConflictPrefix + h.ConflictInfo().String()), true
}

// IsArchived returns true if the branch specifies an archived revision.
func (bn BranchName) IsArchived() bool {
	return strings.HasPrefix(string(bn), branchRevPrefix)
}

// IsLocalConflict returns true if the branch specifies a local conflict branch.
func (bn BranchName) IsLocalConflict() bool {
	return strings.HasPrefix(string(bn), branchLocalConflictPrefix)
}

// RevisionIfSpecified returns a valid revision number and true if
// `bn` is a revision branch.
func (bn BranchName) RevisionIfSpecified() (kbfsmd.Revision, bool) {
	if !bn.IsArchived() {
		return kbfsmd.RevisionUninitialized, false
	}

	i, err := strconv.ParseInt(string(bn[len(branchRevPrefix):]), 10, 64)
	if err != nil {
		return kbfsmd.RevisionUninitialized, false
	}

	return kbfsmd.Revision(i), true
}

// FolderBranch represents a unique pair of top-level folder and a
// branch of that folder.
type FolderBranch struct {
	Tlf    tlf.ID
	Branch BranchName // master branch, by default
}

func (fb FolderBranch) String() string {
	s := fb.Tlf.String()
	if len(fb.Branch) > 0 {
		s += fmt.Sprintf("(branch=%s)", fb.Branch)
	}
	return s
}

// BlockCacheLifetime denotes the lifetime of an entry in BlockCache.
type BlockCacheLifetime int

func (l BlockCacheLifetime) String() string {
	switch l {
	case NoCacheEntry:
		return "NoCacheEntry"
	case TransientEntry:
		return "TransientEntry"
	case PermanentEntry:
		return "PermanentEntry"
	}
	return "Unknown"
}

const (
	// NoCacheEntry means that the entry will not be cached.
	NoCacheEntry BlockCacheLifetime = iota
	// TransientEntry means that the cache entry may be evicted at
	// any time.
	TransientEntry
	// PermanentEntry means that the cache entry must remain until
	// explicitly removed from the cache.
	PermanentEntry
)

// BlockCacheHashBehavior denotes whether the cache should hash the
// plaintext of a new block or not.
type BlockCacheHashBehavior int

const (
	// SkipCacheHash means that the plaintext of a block should not be hashed.
	SkipCacheHash BlockCacheHashBehavior = iota
	// DoCacheHash means that the plaintext of a block should be hashed.
	DoCacheHash
)
