// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/kbfscodec"
	"github.com/keybase/client/go/kbfs/kbfscrypto"
	"github.com/keybase/client/go/kbfs/kbfsmd"
	"github.com/keybase/client/go/kbfs/tlf"
	kbname "github.com/keybase/client/go/kbun"
	kbgitkbfs "github.com/keybase/client/go/protocol/kbgitkbfs1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-codec/codec"
	"github.com/pkg/errors"
)

// disallowedPrefixes must not be allowed at the beginning of any
// user-created directory entry name.
var disallowedPrefixes = [...]string{".kbfs"}

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
	defaultClientMetadataVer kbfsmd.MetadataVer = kbfsmd.ImplicitTeamsVer
)

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
	//
	// Ideally, we'd omit Info if it's empty. However, old clients
	// rely on encoded BlockChanges always having an encoded Info,
	// so that decoding into an existing BlockChanges object
	// clobbers any existing Info, so we can't omit Info until all
	// clients have upgraded to a version that explicitly clears
	// Info on decode, and we've verified that there's nothing
	// else that relies on Info always being filled.
	Info data.BlockInfo `codec:"p"`
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
func (bc *BlockChanges) AddRefBlock(ptr data.BlockPointer) {
	if bc.sizeEstimate != 0 {
		panic("Can't alter block changes after the size is estimated")
	}
	bc.Ops[len(bc.Ops)-1].AddRefBlock(ptr)
}

// AddUnrefBlock adds the newly unreferenced block to this BlockChanges
// and updates the size estimate.
func (bc *BlockChanges) AddUnrefBlock(ptr data.BlockPointer) {
	if bc.sizeEstimate != 0 {
		panic("Can't alter block changes after the size is estimated")
	}
	bc.Ops[len(bc.Ops)-1].AddUnrefBlock(ptr)
}

// AddUpdate adds the newly updated block to this BlockChanges
// and updates the size estimate.
func (bc *BlockChanges) AddUpdate(oldPtr data.BlockPointer, newPtr data.BlockPointer) {
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
			bc.sizeEstimate +=
				uint64(numPtrs)*data.BPSize + op.SizeExceptUpdates()
		}
	}
	return bc.sizeEstimate
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
	offline  keybase1.OfflineAvailability
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

// NodeMetadata has metadata about a node needed for higher level operations.
type NodeMetadata struct {
	// LastWriterUnverified is the last writer of this
	// node according to the last writer of the TLF.
	// A more thorough check is possible in the future.
	LastWriterUnverified kbname.NormalizedUsername
	BlockInfo            data.BlockInfo
	PrefetchStatus       PrefetchStatus
	PrefetchProgress     *PrefetchProgress `json:",omitempty"`
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

// InitModeType indicates how KBFS should configure itself at runtime.
type InitModeType int

const (
	// InitDefault is the normal mode for when KBFS data will be read
	// and written.
	InitDefault InitModeType = iota
	// InitMinimal is for when KBFS will only be used as a MD lookup
	// layer (e.g., for chat on mobile).
	InitMinimal
	// InitSingleOp is a mode for when KBFS is only needed for a
	// single logical operation; no rekeys or update subscriptions is
	// needed, and some naming restrictions are lifted (e.g., `.kbfs_`
	// filenames are allowed).
	InitSingleOp
	// InitConstrained is a mode where KBFS reads and writes data, but
	// constrains itself to using fewer resources (e.g. on mobile).
	InitConstrained
	// InitMemoryLimited is a mode where KBFS reads and writes data, but
	// constrains its memory use even further.
	InitMemoryLimited
)

func (im InitModeType) String() string {
	switch im {
	case InitDefault:
		return InitDefaultString
	case InitMinimal:
		return InitMinimalString
	case InitSingleOp:
		return InitSingleOpString
	case InitConstrained:
		return InitConstrainedString
	case InitMemoryLimited:
		return InitMemoryLimitedString
	default:
		return "unknown"
	}
}

// PrefetchStatus denotes the prefetch status of a block.
type PrefetchStatus int

// ErrUnrecognizedPrefetchStatus is returned when trying to unmarshal a
// prefetch status from JSON if the prefetch status is unrecognized.
var ErrUnrecognizedPrefetchStatus = errors.New(
	"Unrecognized PrefetchStatus value")

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

// ToProtocolStatus returns a prefetch status that can be send over
// the keybase1 protocol.
func (s PrefetchStatus) ToProtocolStatus() keybase1.PrefetchStatus {
	switch s {
	case NoPrefetch:
		return keybase1.PrefetchStatus_NOT_STARTED
	case TriggeredPrefetch:
		return keybase1.PrefetchStatus_IN_PROGRESS
	case FinishedPrefetch:
		return keybase1.PrefetchStatus_COMPLETE
	default:
		panic(fmt.Sprintf("Unknown prefetch status: %s", s))
	}
}

// MarshalJSON converts a PrefetchStatus to JSON
func (s PrefetchStatus) MarshalJSON() ([]byte, error) {
	return json.Marshal(s.String())
}

// UnmarshalJSON converts a PrefetchStatus from JSON
func (s *PrefetchStatus) UnmarshalJSON(b []byte) error {
	var st string
	if err := json.Unmarshal(b, &st); err != nil {
		return err
	}
	switch st {
	default:
		return ErrUnrecognizedPrefetchStatus
	case "NoPrefetch":
		*s = NoPrefetch
	case "TriggeredPrefetch":
		*s = TriggeredPrefetch
	case "FinishedPrefetch":
		*s = FinishedPrefetch
	}
	return nil
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

// FolderSyncEncryptedPartialPaths describes an encrypted block
// containing the paths of a partial sync config.
type FolderSyncEncryptedPartialPaths struct {
	Ptr        data.BlockPointer
	Buf        []byte
	ServerHalf kbfscrypto.BlockCryptKeyServerHalf
}

// FolderSyncConfig is the on-disk representation for a TLF sync
// config.
type FolderSyncConfig struct {
	Mode    keybase1.FolderSyncMode         `codec:"mode" json:"mode"`
	Paths   FolderSyncEncryptedPartialPaths `codec:"paths" json:"paths"`
	TlfPath string                          `codec:"tlfpath" json:"tlfpath"`
}

type syncPathList struct {
	// Paths is a list of files and directories within a TLF that are
	// configured to be synced to the local device.
	Paths []string

	codec.UnknownFieldSetHandler
}

func (spl syncPathList) makeBlock(codec kbfscodec.Codec) (data.Block, error) {
	buf, err := codec.Encode(spl)
	if err != nil {
		return nil, err
	}
	b := data.NewFileBlock().(*data.FileBlock)
	b.Contents = buf
	return b, nil
}

func syncPathListFromBlock(codec kbfscodec.Codec, b *data.FileBlock) (
	paths syncPathList, err error) {
	err = codec.Decode(b.Contents, &paths)
	if err != nil {
		return syncPathList{}, err
	}
	return paths, nil
}

// BlockMetadataValue represents the value stored in the block metadata
// store. This is usually locally stored, and is separate from block metadata
// stored on bserver.
type BlockMetadataValue struct {
	// Xattr contains all xattrs stored in association with the block. This is
	// useful for stuff that's contingent to content of the block, such as
	// quarantine data.
	Xattr map[XattrType][]byte
}

// BlockMetadataUpdater defines a function to update a BlockMetadataValue.
type BlockMetadataUpdater func(*BlockMetadataValue) error

// BlockRequestAction indicates what kind of action should be taken
// after successfully fetching a block.  This is a bit mask filled
// with `blockRequestFlag`s.
type BlockRequestAction int

const (
	// These unexported actions are really flags that are combined to
	// make the other actions below.
	blockRequestTrackedInPrefetch BlockRequestAction = 1 << iota
	blockRequestPrefetch
	blockRequestSync
	blockRequestStopIfFull
	blockRequestDeepSync
	blockRequestDelayCacheCheck

	// BlockRequestSolo indicates that no action should take place
	// after fetching the block.  However, a TLF that is configured to
	// be fully-synced will still be prefetched and synced.
	BlockRequestSolo BlockRequestAction = 0
	// BlockRequestSoloWithSync indicates the the requested block
	// should be put in the sync cache, but no prefetching should be
	// triggered.
	BlockRequestSoloWithSync BlockRequestAction = blockRequestSync
	// BlockRequestPrefetchTail indicates that the block is being
	// tracked in the prefetcher, but shouldn't kick off any more
	// prefetches.
	BlockRequestPrefetchTail BlockRequestAction = blockRequestTrackedInPrefetch
	// BlockRequestPrefetchTailWithSync indicates that the block is
	// being tracked in the prefetcher and goes in the sync cache, but
	// shouldn't kick off any more prefetches.
	BlockRequestPrefetchTailWithSync BlockRequestAction = blockRequestTrackedInPrefetch | blockRequestSync
	// BlockRequestWithPrefetch indicates that a prefetch should be
	// triggered after fetching the block.  If a TLF is configured to
	// be fully-synced, the block will still be put in the sync cache.
	BlockRequestWithPrefetch BlockRequestAction = blockRequestTrackedInPrefetch | blockRequestPrefetch
	// BlockRequestWithSyncAndPrefetch indicates that the block should
	// be stored in the sync cache after fetching it, as well as
	// triggering a prefetch of one level of child blocks (and the
	// syncing doesn't propagate to the child blocks).
	BlockRequestWithSyncAndPrefetch BlockRequestAction = blockRequestTrackedInPrefetch | blockRequestPrefetch | blockRequestSync
	// BlockRequestPrefetchUntilFull prefetches starting from the
	// given block (but does not sync the blocks) until the working
	// set cache is full, and then it stops prefetching.
	BlockRequestPrefetchUntilFull BlockRequestAction = blockRequestTrackedInPrefetch | blockRequestPrefetch | blockRequestStopIfFull
	// BlockRequestWithDeepSync is the same as above, except both the
	// prefetching and the sync flags propagate to the child, so the
	// whole tree root at the block is prefetched and synced.
	BlockRequestWithDeepSync BlockRequestAction = blockRequestTrackedInPrefetch | blockRequestPrefetch | blockRequestSync | blockRequestDeepSync
)

func (bra BlockRequestAction) String() string {
	if bra.DeepSync() {
		return "deep-sync"
	}
	if bra == BlockRequestSolo {
		return "solo"
	}

	attrs := make([]string, 0, 3)
	if bra.prefetch() {
		attrs = append(attrs, "prefetch")
	} else if bra.PrefetchTracked() {
		attrs = append(attrs, "prefetch-tracked")
	}

	if bra.Sync() {
		attrs = append(attrs, "sync")
	}

	if bra.StopIfFull() {
		attrs = append(attrs, "stop-if-full")
	}

	if bra.DelayCacheCheck() {
		attrs = append(attrs, "delay-cache-check")
	}

	return strings.Join(attrs, "|")
}

// Combine returns a new action by taking `other` into account.
func (bra BlockRequestAction) Combine(
	other BlockRequestAction) BlockRequestAction {
	combined := bra | other
	// If the actions don't agree on stop-if-full, we should remove it
	// from the combined result.
	if bra.StopIfFull() != other.StopIfFull() {
		combined &^= blockRequestStopIfFull
	}
	return combined
}

func (bra BlockRequestAction) prefetch() bool {
	return bra&blockRequestPrefetch > 0
}

// Prefetch returns true if the action indicates the block should
// trigger a prefetch.
func (bra BlockRequestAction) Prefetch(block data.Block) bool {
	// When syncing, always prefetch child blocks of an indirect
	// block, since it makes no sense to sync just part of a
	// multi-block object.
	if block.IsIndirect() && bra.Sync() {
		return true
	}
	return bra.prefetch()
}

// PrefetchTracked returns true if this block is being tracked by the
// prefetcher.
func (bra BlockRequestAction) PrefetchTracked() bool {
	return bra.prefetch() || bra&blockRequestTrackedInPrefetch > 0
}

// Sync returns true if the action indicates the block should go into
// the sync cache.
func (bra BlockRequestAction) Sync() bool {
	return bra&blockRequestSync > 0
}

// DeepSync returns true if the action indicates a deep-syncing of the
// block tree rooted at the given block.
func (bra BlockRequestAction) DeepSync() bool {
	// The delayed cache check doesn't affect deep-syncing.
	return bra.WithoutDelayedCacheCheckAction() == BlockRequestWithDeepSync
}

// DeepPrefetch returns true if the prefetcher should continue
// prefetching the children of this block all the way to the leafs of
// the tree.
func (bra BlockRequestAction) DeepPrefetch() bool {
	return bra.DeepSync() || bra == BlockRequestPrefetchUntilFull
}

// ChildAction returns the action that should propagate down to any
// children of this block.
func (bra BlockRequestAction) ChildAction(block data.Block) BlockRequestAction {
	// When syncing, always prefetch child blocks of an indirect
	// block, since it makes no sense to sync just part of a
	// multi-block object.
	if bra.DeepPrefetch() || (block.IsIndirect() && bra.Sync()) {
		return bra
	}
	return bra &^ (blockRequestPrefetch | blockRequestSync)
}

// SoloAction returns a solo-fetch action based on `bra` (e.g.,
// preserving the sync bit but nothing else).
func (bra BlockRequestAction) SoloAction() BlockRequestAction {
	return bra & blockRequestSync
}

// AddSync returns a new action that adds syncing in addition to the
// original request.  For prefetch requests, it returns a deep-sync
// request (unlike `Combine`, which just adds the regular sync bit).
func (bra BlockRequestAction) AddSync() BlockRequestAction {
	if bra.prefetch() {
		return BlockRequestWithDeepSync
	}
	// If the prefetch bit is NOT yet set (as when some component
	// makes a solo request, for example), we should not kick off a
	// deep sync since the action explicit prohibits any more blocks
	// being fetched (and doing so will mess up sensitive tests).
	return bra | blockRequestSync
}

// CacheType returns the disk block cache type that should be used,
// according to the type of action.
func (bra BlockRequestAction) CacheType() DiskBlockCacheType {
	if bra.Sync() {
		return DiskBlockSyncCache
	}
	return DiskBlockAnyCache
}

// StopIfFull returns true if prefetching should stop for good (i.e.,
// not get rescheduled) when the corresponding disk cache is full.
func (bra BlockRequestAction) StopIfFull() bool {
	return bra&blockRequestStopIfFull > 0
}

// DelayedCacheCheckAction returns a new action that adds the
// delayed-cache-check feature to `bra`.
func (bra BlockRequestAction) DelayedCacheCheckAction() BlockRequestAction {
	return bra | blockRequestDelayCacheCheck
}

// WithoutDelayedCacheCheckAction returns a new action that strips the
// delayed-cache-check feature from `bra`.
func (bra BlockRequestAction) WithoutDelayedCacheCheckAction() BlockRequestAction {
	return bra &^ blockRequestDelayCacheCheck
}

// DelayCacheCheck returns true if the disk cache check for a block
// request should be delayed until the request is being serviced by a
// block worker, in order to improve the performance of the inline
// `Request` call.
func (bra BlockRequestAction) DelayCacheCheck() bool {
	return bra&blockRequestDelayCacheCheck > 0
}

// PrefetchProgress tracks the number of bytes fetched for the block
// tree rooted at a given block, along with the known total number of
// bytes in that tree, and the start time of the prefetch.  Note that
// the total can change over time as more blocks are downloaded.
type PrefetchProgress struct {
	SubtreeBytesFetched uint64
	SubtreeBytesTotal   uint64
	Start               time.Time
}

// ToProtocolProgress creates a progress suitable of being sent over
// the keybase1 protocol to the service.
func (p PrefetchProgress) ToProtocolProgress(clock Clock) (
	out keybase1.PrefetchProgress) {
	out.BytesFetched = int64(p.SubtreeBytesFetched)
	out.BytesTotal = int64(p.SubtreeBytesTotal)
	out.Start = keybase1.ToTime(p.Start)

	if out.BytesTotal == 0 || out.Start == 0 {
		return out
	}

	timeRunning := clock.Now().Sub(p.Start)
	fracDone := float64(out.BytesFetched) / float64(out.BytesTotal)
	totalTimeEstimate := time.Duration(float64(timeRunning) / fracDone)
	endEstimate := p.Start.Add(totalTimeEstimate)
	out.EndEstimate = keybase1.ToTime(endEstimate)
	return out
}

// ToProtocolStatus creates a status suitable of being sent over the
// keybase1 protocol to the service.  It never generates NOT_STARTED
// since that doesn't make sense once you already have a prefetch
// progress created.
func (p PrefetchProgress) ToProtocolStatus() keybase1.PrefetchStatus {
	if p.SubtreeBytesTotal == p.SubtreeBytesFetched ||
		p.SubtreeBytesTotal == 0 {
		return keybase1.PrefetchStatus_COMPLETE
	}
	return keybase1.PrefetchStatus_IN_PROGRESS
}

type parsedPath struct {
	tlfType      tlf.Type
	tlfName      string
	rawInTlfPath string
	rawFullPath  userPath
}

func parsePath(path userPath) (parsed *parsedPath, err error) {
	if !strings.HasPrefix(string(path), "/keybase") {
		return nil, errors.New("not a KBFS path")
	}
	parsed = &parsedPath{tlfType: tlf.Unknown, rawFullPath: path}
	elems := strings.Split(string(path[1:]), "/")
	if len(elems) < 2 {
		return parsed, nil
	}
	parsed.tlfType, err = tlf.ParseTlfTypeFromPath(elems[1])
	if err != nil {
		return nil, err
	}
	if len(elems) < 3 {
		return parsed, nil
	}
	parsed.tlfName = elems[2]
	if len(elems) == 3 {
		parsed.rawInTlfPath = "/"
		return parsed, nil
	}
	parsed.rawInTlfPath = "/" + strings.Join(elems[3:], "/")
	return parsed, nil
}

func (p *parsedPath) getRootNode(ctx context.Context, config Config) (Node, error) {
	if p.tlfType == tlf.Unknown || len(p.tlfName) == 0 {
		return nil, errors.New("path does not have a TLF")
	}
	tlfHandle, err := GetHandleFromFolderNameAndType(
		ctx, config.KBPKI(), config.MDOps(), config, p.tlfName, p.tlfType)
	if err != nil {
		return nil, err
	}
	// Get the root node first to initialize the TLF.
	node, _, err := config.KBFSOps().GetRootNode(
		ctx, tlfHandle, data.MasterBranch)
	if err != nil {
		return nil, err
	}
	return node, nil
}

func (p *parsedPath) getFolderBranch(ctx context.Context, config Config) (data.FolderBranch, error) {
	node, err := p.getRootNode(ctx, config)
	if err != nil {
		return data.FolderBranch{}, err
	}
	if node == nil {
		return data.FolderBranch{}, nil
	}
	return node.GetFolderBranch(), nil
}
