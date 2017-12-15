// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"reflect"
	"strings"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/kbfsblock"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/kbfsmd"
	kbgitkbfs "github.com/keybase/kbfs/protocol/kbgitkbfs1"
	"github.com/keybase/kbfs/tlf"
)

const (
	// PublicUIDName is the name given to keybase1.PublicUID.  This string
	// should correspond to an illegal or reserved Keybase user name.
	PublicUIDName = "_public"
)

// disallowedPrefixes must not be allowed at the beginning of any
// user-created directory entry name.
var disallowedPrefixes = [...]string{".kbfs"}

// UserInfo contains all the info about a keybase user that kbfs cares
// about.
type UserInfo struct {
	Name            libkb.NormalizedUsername
	UID             keybase1.UID
	VerifyingKeys   []kbfscrypto.VerifyingKey
	CryptPublicKeys []kbfscrypto.CryptPublicKey
	KIDNames        map[keybase1.KID]string
	EldestSeqno     keybase1.Seqno

	// Revoked keys, and the time at which they were revoked.
	RevokedVerifyingKeys   map[kbfscrypto.VerifyingKey]keybase1.KeybaseTime
	RevokedCryptPublicKeys map[kbfscrypto.CryptPublicKey]keybase1.KeybaseTime
}

// TeamInfo contains all the info about a keybase team that kbfs cares
// about.
type TeamInfo struct {
	// Maybe this should be bare string?  The service doesn't give us
	// a nice type, unfortunately.  Also note that for implicit teams,
	// this is an auto-generated name that shouldn't be shown to
	// users.
	Name         libkb.NormalizedUsername
	TID          keybase1.TeamID
	CryptKeys    map[kbfsmd.KeyGen]kbfscrypto.TLFCryptKey
	LatestKeyGen kbfsmd.KeyGen
	RootID       keybase1.TeamID // for subteams only

	Writers map[keybase1.UID]bool
	Readers map[keybase1.UID]bool

	// TODO: Should we add a historic membership log to easily check
	// whether a user was a member given some Merkle seqno?
}

// ImplicitTeamInfo contains information needed after
// resolving/identifying an implicit team.  TeamInfo is used for
// anything else.
type ImplicitTeamInfo struct {
	Name  libkb.NormalizedUsername // The "display" name for the i-team.
	TID   keybase1.TeamID
	TlfID tlf.ID
}

// SessionInfo contains all the info about the keybase session that
// kbfs cares about.
type SessionInfo struct {
	Name           libkb.NormalizedUsername
	UID            keybase1.UID
	CryptPublicKey kbfscrypto.CryptPublicKey
	VerifyingKey   kbfscrypto.VerifyingKey
}

// EncryptedTLFCryptKeyClientAndEphemeral has what's needed to
// request a client half decryption.
type EncryptedTLFCryptKeyClientAndEphemeral struct {
	// PublicKey contains the wrapped Key ID of the public key
	PubKey kbfscrypto.CryptPublicKey
	// ClientHalf contains the encrypted client half of the TLF key
	ClientHalf kbfscrypto.EncryptedTLFCryptKeyClientHalf
	// EPubKey contains the ephemeral public key used to encrypt ClientHalf
	EPubKey kbfscrypto.TLFEphemeralPublicKey
}

const (
	defaultClientMetadataVer kbfsmd.MetadataVer = kbfsmd.SegregatedKeyBundlesVer
)

// DataVer is the type of a version for marshalled KBFS data
// structures.
//
// 1) DataVer is a per-block attribute, not per-file. This means that,
// in theory, an indirect block with DataVer n may point to blocks
// with DataVers less than, equal to, or greater than n. However, for
// now, it's guaranteed that an indirect block will never point to
// blocks with greater versions than itself. (See #3 for details.)
//
// 2) DataVer is an external attribute of a block, meaning that it's
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
// holes). However, all its indirect pointers will have DataVer
// 1, by a).
// c) Indirect blocks of depth 3 must be v3 and must have at least one
// indirect pointer with an indirect DirectType [although if it holds
// for one, it should hold for all], although its indirect pointers
// may have any combination of DataVer 1 or 2, by b).
// d) Indirect blocks of dept k > 3 must be v3 and must have at least
// one indirect pointer with an indirect DirectType [although if it
// holds for one, it should hold for all], and all of its indirect
// pointers must have DataVer 3, by c).
type DataVer int

const (
	// FirstValidDataVer is the first value that is considered a
	// valid data version. Note that the nil value is not
	// considered valid.
	FirstValidDataVer DataVer = 1
	// ChildHolesDataVer is the data version for any indirect block
	// containing a set of pointers with holes.
	ChildHolesDataVer DataVer = 2
	// AtLeastTwoLevelsOfChildrenDataVer is the data version for
	// blocks that have multiple levels of indirection below them
	// (i.e., indirect blocks that point to other indirect blocks).
	AtLeastTwoLevelsOfChildrenDataVer DataVer = 3
)

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

// BlockPointer contains the identifying information for a block in KBFS.
//
// NOTE: Don't add or modify anything in this struct without
// considering how old clients will handle them.
type BlockPointer struct {
	ID         kbfsblock.ID    `codec:"i"`
	KeyGen     kbfsmd.KeyGen   `codec:"k"`           // if valid, which generation of the TLF{Writer,Reader}KeyBundle to use.
	DataVer    DataVer         `codec:"d"`           // if valid, which version of the KBFS data structures is pointed to
	DirectType BlockDirectType `codec:"t,omitempty"` // the type (direct, indirect, or unknown [if omitted]) of the pointed-to block
	kbfsblock.Context
}

// IsValid returns whether the block pointer is valid. A zero block
// pointer is considered invalid.
func (p BlockPointer) IsValid() bool {
	if !p.ID.IsValid() {
		return false
	}

	// TODO: Should also check KeyGen, DataVer, and Creator. (A
	// bunch of tests use invalid values for one of these.)

	return true
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

var bpSize = uint64(reflect.TypeOf(BlockPointer{}).Size())

// ReadyBlockData is a block that has been encoded (and encrypted).
type ReadyBlockData struct {
	// These fields should not be used outside of putBlockToServer.
	buf        []byte
	serverHalf kbfscrypto.BlockCryptKeyServerHalf
}

// GetEncodedSize returns the size of the encoded (and encrypted)
// block data.
func (r ReadyBlockData) GetEncodedSize() int {
	return len(r.buf)
}

// Favorite is a top-level favorited folder name.
type Favorite struct {
	Name string
	Type tlf.Type
}

// NewFavoriteFromFolder creates a Favorite from a
// keybase1.Folder.
func NewFavoriteFromFolder(folder keybase1.Folder) *Favorite {
	name := folder.Name
	if !folder.Private {
		// Old versions of the client still use an outdated "#public"
		// suffix for favorited public folders. TODO: remove this once
		// those old versions of the client are retired.
		const oldPublicSuffix = tlf.ReaderSep + "public"
		name = strings.TrimSuffix(folder.Name, oldPublicSuffix)
	}

	var t tlf.Type
	if folder.FolderType == keybase1.FolderType_UNKNOWN {
		// Use deprecated boolean
		if folder.Private {
			t = tlf.Private
		} else {
			t = tlf.Public
		}
	} else {
		switch folder.FolderType {
		case keybase1.FolderType_PRIVATE:
			t = tlf.Private
		case keybase1.FolderType_PUBLIC:
			t = tlf.Public
		case keybase1.FolderType_TEAM:
			// TODO: if we ever support something other than single
			// teams in the favorites list, we'll have to figure out
			// which type the favorite is from its name.
			t = tlf.SingleTeam
		default:
			// This shouldn't happen, but just in case the service
			// sends us bad info....
			t = tlf.Private
		}
	}

	return &Favorite{
		Name: name,
		Type: t,
	}
}

// ToKBFolder creates a keybase1.Folder from a Favorite.
func (f Favorite) ToKBFolder(created bool) keybase1.Folder {
	return keybase1.Folder{
		Name:       f.Name,
		FolderType: f.Type.FolderType(),
		Private:    f.Type != tlf.Public, // deprecated
		Created:    created,
	}
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
)

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

// BlockChanges tracks the set of blocks that changed in a commit, and
// the operations that made the changes.  It might consist of just a
// BlockPointer if the list is too big to embed in the MD structure
// directly.
//
// If this commit represents a conflict-resolution merge, which may
// comprise multiple individual operations, then there will be an
// ordered list of the changes for individual operations.  This lets
// the notification and conflict resolution strategies figure out the
// difference between a renamed file and a modified file, for example.
//
// NOTE: Don't add or modify anything in this struct without
// considering how old clients will handle them.
type BlockChanges struct {
	// If this is set, the actual changes are stored in a block (where
	// the block contains a serialized version of BlockChanges)
	Info BlockInfo `codec:"p,omitempty"`
	// An ordered list of operations completed in this update
	Ops opsList `codec:"o,omitempty"`
	// Estimate the number of bytes that this set of changes will take to encode
	sizeEstimate uint64
}

// Equals returns true if the given BlockChanges is equal to this
// BlockChanges.  Currently does not check for equality at the
// operation level.
func (bc BlockChanges) Equals(other BlockChanges) bool {
	if bc.Info != other.Info || len(bc.Ops) != len(other.Ops) ||
		(bc.sizeEstimate != 0 && other.sizeEstimate != 0 &&
			bc.sizeEstimate != other.sizeEstimate) {
		return false
	}
	// TODO: check for op equality?
	return true
}

// AddRefBlock adds the newly-referenced block to this BlockChanges
// and updates the size estimate.
func (bc *BlockChanges) AddRefBlock(ptr BlockPointer) {
	if bc.sizeEstimate != 0 {
		panic("Can't alter block changes after the size is estimated")
	}
	bc.Ops[len(bc.Ops)-1].AddRefBlock(ptr)
}

// AddUnrefBlock adds the newly unreferenced block to this BlockChanges
// and updates the size estimate.
func (bc *BlockChanges) AddUnrefBlock(ptr BlockPointer) {
	if bc.sizeEstimate != 0 {
		panic("Can't alter block changes after the size is estimated")
	}
	bc.Ops[len(bc.Ops)-1].AddUnrefBlock(ptr)
}

// AddUpdate adds the newly updated block to this BlockChanges
// and updates the size estimate.
func (bc *BlockChanges) AddUpdate(oldPtr BlockPointer, newPtr BlockPointer) {
	if bc.sizeEstimate != 0 {
		panic("Can't alter block changes after the size is estimated")
	}
	bc.Ops[len(bc.Ops)-1].AddUpdate(oldPtr, newPtr)
}

// AddOp starts a new operation for this BlockChanges.  Subsequent
// Add* calls will populate this operation.
func (bc *BlockChanges) AddOp(o op) {
	if bc.sizeEstimate != 0 {
		panic("Can't alter block changes after the size is estimated")
	}
	bc.Ops = append(bc.Ops, o)
}

// SizeEstimate calculates the estimated size of the encoded version
// of this BlockChanges.
func (bc *BlockChanges) SizeEstimate() uint64 {
	if bc.sizeEstimate == 0 {
		for _, op := range bc.Ops {
			numPtrs := len(op.Refs()) + len(op.Unrefs()) +
				2*len(op.allUpdates())
			bc.sizeEstimate += uint64(numPtrs)*bpSize + op.SizeExceptUpdates()
		}
	}
	return bc.sizeEstimate
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

// Excl indicates whether O_EXCL is set on a fuse call
type Excl bool

const (
	// NoExcl indicates O_EXCL is not set
	NoExcl Excl = false

	// WithExcl indicates O_EXCL is set
	WithExcl Excl = true
)

func (o Excl) String() string {
	switch o {
	case NoExcl:
		return "O_EXCL unset"
	case WithExcl:
		return "O_EXCL set"
	default:
		return "<invalid Excl>"
	}
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
}

// ReportedError represents an error reported by KBFS.
type ReportedError struct {
	Time  time.Time
	Error error
	Stack []uintptr
}

// OpSummary describes the changes performed by a single op, and is
// suitable for encoding directly as JSON.
type OpSummary struct {
	Op      string
	Refs    []string
	Unrefs  []string
	Updates map[string]string
}

// UpdateSummary describes the operations done by a single MD revision.
type UpdateSummary struct {
	Revision  kbfsmd.Revision
	Date      time.Time
	Writer    string
	LiveBytes uint64 // the "DiskUsage" for the TLF as of this revision
	Ops       []OpSummary
}

// TLFUpdateHistory gives all the summaries of all updates in a TLF's
// history.
type TLFUpdateHistory struct {
	ID      string
	Name    string
	Updates []UpdateSummary
}

// writerInfo is the keybase UID and device (represented by its
// verifying key) that generated the operation at the given revision.
type writerInfo struct {
	uid      keybase1.UID
	key      kbfscrypto.VerifyingKey
	revision kbfsmd.Revision
}

// ErrorModeType indicates what type of operation was being attempted
// when an error was reported.
type ErrorModeType int

const (
	// ReadMode indicates that an error happened while trying to read.
	ReadMode ErrorModeType = iota
	// WriteMode indicates that an error happened while trying to write.
	WriteMode
)

// UserInfoFromProtocol returns UserInfo from UserPlusKeys
func UserInfoFromProtocol(upk keybase1.UserPlusKeys) (UserInfo, error) {
	verifyingKeys, cryptPublicKeys, kidNames, err := filterKeys(upk.DeviceKeys)
	if err != nil {
		return UserInfo{}, err
	}

	revokedVerifyingKeys, revokedCryptPublicKeys, revokedKidNames, err := filterRevokedKeys(upk.RevokedDeviceKeys)
	if err != nil {
		return UserInfo{}, err
	}

	for k, v := range revokedKidNames {
		kidNames[k] = v
	}

	return UserInfo{
		Name:                   libkb.NewNormalizedUsername(upk.Username),
		UID:                    upk.Uid,
		VerifyingKeys:          verifyingKeys,
		CryptPublicKeys:        cryptPublicKeys,
		KIDNames:               kidNames,
		RevokedVerifyingKeys:   revokedVerifyingKeys,
		RevokedCryptPublicKeys: revokedCryptPublicKeys,
	}, nil
}

// SessionInfoFromProtocol returns SessionInfo from Session
func SessionInfoFromProtocol(session keybase1.Session) (SessionInfo, error) {
	// Import the KIDs to validate them.
	deviceSubkey, err := libkb.ImportKeypairFromKID(session.DeviceSubkeyKid)
	if err != nil {
		return SessionInfo{}, err
	}
	deviceSibkey, err := libkb.ImportKeypairFromKID(session.DeviceSibkeyKid)
	if err != nil {
		return SessionInfo{}, err
	}
	cryptPublicKey := kbfscrypto.MakeCryptPublicKey(deviceSubkey.GetKID())
	verifyingKey := kbfscrypto.MakeVerifyingKey(deviceSibkey.GetKID())
	return SessionInfo{
		Name:           libkb.NewNormalizedUsername(session.Username),
		UID:            keybase1.UID(session.Uid),
		CryptPublicKey: cryptPublicKey,
		VerifyingKey:   verifyingKey,
	}, nil
}

// NodeMetadata has metadata about a node needed for higher level operations.
type NodeMetadata struct {
	// LastWriterUnverified is the last writer of this
	// node according to the last writer of the TLF.
	// A more thorough check is possible in the future.
	LastWriterUnverified libkb.NormalizedUsername
	BlockInfo            BlockInfo
	PrefetchStatus       string
}

// FavoritesOp defines an operation related to favorites.
type FavoritesOp int

const (
	_ FavoritesOp = iota
	// FavoritesOpAdd means TLF should be added to favorites.
	FavoritesOpAdd
	// FavoritesOpAddNewlyCreated means TLF should be added to favorites, and it
	// should be considered newly created.
	FavoritesOpAddNewlyCreated
	// FavoritesOpRemove means TLF should be removed from favorites.
	FavoritesOpRemove
	// FavoritesOpNoChange means no changes regarding to favorites should be made.
	FavoritesOpNoChange
)

// RekeyResult represents the result of an rekey operation.
type RekeyResult struct {
	DidRekey      bool
	NeedsPaperKey bool
}

// InitMode indicates how KBFS should configure itself at runtime.
type InitMode int

const (
	// InitModeMask masks out mode flags.
	InitModeMask InitMode = 0xffff
	// InitTest is a mode flag that represents whether we're running in a test.
	InitTest InitMode = 1 << 16

	// InitDefault is the normal mode for when KBFS data will be read
	// and written.
	InitDefault InitMode = iota
	// InitMinimal is for when KBFS will only be used as a MD lookup
	// layer (e.g., for chat on mobile).
	InitMinimal
	// InitSingleOp is a mode for when KBFS is only needed for a
	// single logical operation; no rekeys or update subscriptions is
	// needed, and some naming restrictions are lifted (e.g., `.kbfs_`
	// filenames are allowed).
	InitSingleOp
)

// Mode returns the mode absent any mode flags.
func (im InitMode) Mode() InitMode {
	return im & InitModeMask
}

// HasFlags returns whether all the specified flags are set.
func (im InitMode) HasFlags(flags InitMode) bool {
	return im&flags > 0
}

func (im InitMode) String() string {
	switch im.Mode() {
	case InitDefault:
		return InitDefaultString
	case InitMinimal:
		return InitMinimalString
	case InitSingleOp:
		return InitSingleOpString
	default:
		return "unknown"
	}
}

// PrefetchStatus denotes the prefetch status of a block.
type PrefetchStatus int

const (
	// NoPrefetch represents an entry that hasn't been prefetched.
	NoPrefetch PrefetchStatus = iota
	// TriggeredPrefetch represents a block for which prefetching has been
	// triggered, but the full tree has not been completed.
	TriggeredPrefetch
	// FinishedPrefetch represents a block whose full subtree is synced.
	FinishedPrefetch
)

func (s PrefetchStatus) String() string {
	switch s {
	case NoPrefetch:
		return "NoPrefetch"
	case TriggeredPrefetch:
		return "TriggeredPrefetch"
	case FinishedPrefetch:
		return "FinishedPrefetch"
	}
	return "Unknown"
}

// ToProtocol transforms a PrefetchStatus to a kbgitkbfs.PrefetchStatus, while
// validating its value.
func (s PrefetchStatus) ToProtocol() kbgitkbfs.PrefetchStatus {
	protocolPrefetchStatus := kbgitkbfs.PrefetchStatus(s)
	_, ok := kbgitkbfs.PrefetchStatusRevMap[protocolPrefetchStatus]
	if !ok {
		panic("Invalid prefetch status for protocol")
	}
	return protocolPrefetchStatus
}

// PrefetchStatusFromProtocol transforms a kbgitkbfs.PrefetchStatus to a
// PrefetchStatus, while validating its value.
func PrefetchStatusFromProtocol(
	protocolPrefetchStatus kbgitkbfs.PrefetchStatus) PrefetchStatus {
	s := PrefetchStatus(protocolPrefetchStatus)
	switch s {
	case NoPrefetch:
	case TriggeredPrefetch:
	case FinishedPrefetch:
	default:
		panic("Invalid prefetch status from protocol")
	}
	return s
}
