// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"math"
	"time"

	"github.com/keybase/client/go/protocol/keybase1"
)

// NewInitModeFromType returns an InitMode object corresponding to the
// given type.
func NewInitModeFromType(t InitModeType) InitMode {
	switch t {
	case InitDefault:
		return modeDefault{}
	case InitMinimal:
		return modeMinimal{}
	case InitSingleOp:
		return modeSingleOp{modeDefault{}}
	case InitConstrained:
		return modeConstrained{modeDefault{}}
	case InitMemoryLimited:
		return modeMemoryLimited{modeConstrained{modeDefault{}}}
	default:
		panic(fmt.Sprintf("Unknown mode: %s", t))
	}
}

const (
	defaultQRPeriod      = 1 * time.Hour
	defaultQRMinUnrefAge = 2 * 7 * 24 * time.Hour // 2 weeks
)

// Default mode:

type modeDefault struct {
}

func (md modeDefault) Type() InitModeType {
	return InitDefault
}

func (md modeDefault) BlockWorkers() int {
	return defaultBlockRetrievalWorkerQueueSize
}

func (md modeDefault) PrefetchWorkers() int {
	return defaultPrefetchWorkerQueueSize
}

func (md modeDefault) DefaultBlockRequestAction() BlockRequestAction {
	return BlockRequestWithPrefetch
}

func (md modeDefault) RekeyWorkers() int {
	return 16
}

func (md modeDefault) RekeyQueueSize() int {
	return 2048 // 48 KB
}

func (md modeDefault) IsTestMode() bool {
	return false
}

func (md modeDefault) DirtyBlockCacheEnabled() bool {
	return true
}

func (md modeDefault) BackgroundFlushesEnabled() bool {
	return true
}

func (md modeDefault) MetricsEnabled() bool {
	return true
}

func (md modeDefault) ConflictResolutionEnabled() bool {
	return true
}

func (md modeDefault) BlockManagementEnabled() bool {
	return true
}

func (md modeDefault) QuotaReclamationEnabled() bool {
	return true
}

func (md modeDefault) QuotaReclamationPeriod() time.Duration {
	return defaultQRPeriod
}

func (md modeDefault) QuotaReclamationMinUnrefAge() time.Duration {
	return defaultQRMinUnrefAge
}

func (md modeDefault) QuotaReclamationMinHeadAge() time.Duration {
	// How old must the most recent TLF revision be before another
	// device can run QR on that TLF?  This is large, to avoid
	// unnecessary conflicts on the TLF between devices.
	return defaultQRMinUnrefAge + 24*time.Hour
}

func (md modeDefault) NodeCacheEnabled() bool {
	return true
}

func (md modeDefault) TLFUpdatesEnabled() bool {
	return true
}

func (md modeDefault) KBFSServiceEnabled() bool {
	return true
}

func (md modeDefault) JournalEnabled() bool {
	return true
}

func (md modeDefault) UnmergedTLFsEnabled() bool {
	return true
}

func (md modeDefault) ServiceKeepaliveEnabled() bool {
	return true
}

func (md modeDefault) TLFEditHistoryEnabled() bool {
	return true
}

func (md modeDefault) SendEditNotificationsEnabled() bool {
	return true
}

func (md modeDefault) ClientType() keybase1.ClientType {
	return keybase1.ClientType_KBFS
}

func (md modeDefault) LocalHTTPServerEnabled() bool {
	return true
}

func (md modeDefault) MaxCleanBlockCacheCapacity() uint64 {
	return math.MaxUint64
}

// Minimal mode:

type modeMinimal struct {
}

func (mm modeMinimal) Type() InitModeType {
	return InitMinimal
}

func (mm modeMinimal) BlockWorkers() int {
	// In minimal mode, block re-embedding is not required, so we
	// don't fetch the unembedded blocks..
	return 0
}

func (mm modeMinimal) PrefetchWorkers() int {
	return 0
}

func (mm modeMinimal) DefaultBlockRequestAction() BlockRequestAction {
	return BlockRequestSolo
}

func (mm modeMinimal) RekeyWorkers() int {
	return 4
}

func (mm modeMinimal) RekeyQueueSize() int {
	return 512 // 12 KB
}

func (mm modeMinimal) IsTestMode() bool {
	return false
}

func (mm modeMinimal) DirtyBlockCacheEnabled() bool {
	// No blocks will be dirtied in minimal mode, so don't bother with
	// the dirty block cache.
	return false
}

func (mm modeMinimal) BackgroundFlushesEnabled() bool {
	// Don't do background flushes when in minimal mode, since there
	// shouldn't be any data writes.
	return false
}

func (mm modeMinimal) MetricsEnabled() bool {
	return false
}

func (mm modeMinimal) ConflictResolutionEnabled() bool {
	// No need to run CR if there won't be any data writes on this
	// device.  (There may still be rekey writes, but we don't allow
	// conflicts to happen in that case.)
	return false
}

func (mm modeMinimal) BlockManagementEnabled() bool {
	// If this device is in minimal mode and won't be doing any data
	// writes, no need deal with block-level cleanup operations.
	// TODO: in the future it might still be useful to have
	// e.g. mobile devices doing QR.
	return false
}

func (mm modeMinimal) QuotaReclamationEnabled() bool {
	return false
}

func (mm modeMinimal) QuotaReclamationPeriod() time.Duration {
	return 0
}

func (mm modeMinimal) QuotaReclamationMinUnrefAge() time.Duration {
	return 0
}

func (mm modeMinimal) QuotaReclamationMinHeadAge() time.Duration {
	return 0
}

func (mm modeMinimal) NodeCacheEnabled() bool {
	// If we're in minimal mode, let the node cache remain nil to
	// ensure that the user doesn't try any data reads or writes.
	return false
}

func (mm modeMinimal) TLFUpdatesEnabled() bool {
	return true
}

func (mm modeMinimal) KBFSServiceEnabled() bool {
	return false
}

func (mm modeMinimal) JournalEnabled() bool {
	return false
}

func (mm modeMinimal) UnmergedTLFsEnabled() bool {
	// Writes aren't allowed, so unmerged TLFs on this device
	// shouldn't be possible.
	return false
}

func (mm modeMinimal) ServiceKeepaliveEnabled() bool {
	return false
}

func (mm modeMinimal) TLFEditHistoryEnabled() bool {
	return false
}

func (mm modeMinimal) SendEditNotificationsEnabled() bool {
	// Writes aren't allowed, so we shouldn't need to send any.
	return false
}

func (mm modeMinimal) ClientType() keybase1.ClientType {
	return keybase1.ClientType_KBFS
}

func (mm modeMinimal) LocalHTTPServerEnabled() bool {
	return false
}

func (mm modeMinimal) MaxCleanBlockCacheCapacity() uint64 {
	return math.MaxUint64
}

// Single op mode:

type modeSingleOp struct {
	InitMode
}

func (mso modeSingleOp) Type() InitModeType {
	return InitSingleOp
}

func (mso modeSingleOp) RekeyWorkers() int {
	// Just block all rekeys and don't bother cleaning up requests
	// since the process is short lived anyway.
	return 0
}

func (mso modeSingleOp) RekeyQueueSize() int {
	return 0
}

func (mso modeSingleOp) QuotaReclamationEnabled() bool {
	return false
}

func (mso modeSingleOp) QuotaReclamationPeriod() time.Duration {
	return 0
}

func (mso modeSingleOp) QuotaReclamationMinUnrefAge() time.Duration {
	return 0
}

func (mso modeSingleOp) QuotaReclamationMinHeadAge() time.Duration {
	return 0
}

func (mso modeSingleOp) TLFUpdatesEnabled() bool {
	return false
}

func (mso modeSingleOp) KBFSServiceEnabled() bool {
	return false
}

func (mso modeSingleOp) UnmergedTLFsEnabled() bool {
	// There's basically no way for a TLF to start off as unmerged
	// since single-ops should be using a fresh journal.
	return false
}

func (mso modeSingleOp) TLFEditHistoryEnabled() bool {
	return false
}

func (mso modeSingleOp) SendEditNotificationsEnabled() bool {
	// We don't want git, or other single op writes, showing up in the
	// notification history.
	return false
}

func (mso modeSingleOp) ClientType() keybase1.ClientType {
	return keybase1.ClientType_NONE
}

func (mso modeSingleOp) LocalHTTPServerEnabled() bool {
	return false
}

// Constrained mode:

type modeConstrained struct {
	InitMode
}

func (mc modeConstrained) Type() InitModeType {
	return InitConstrained
}

func (mc modeConstrained) BlockWorkers() int {
	return 1
}

func (mc modeConstrained) PrefetchWorkers() int {
	return 1
}

func (mc modeConstrained) DefaultBlockRequestAction() BlockRequestAction {
	return BlockRequestSolo
}

func (mc modeConstrained) RekeyWorkers() int {
	return 4
}

func (mc modeConstrained) RekeyQueueSize() int {
	return 1024 // 24 KB
}

func (mc modeConstrained) BackgroundFlushesEnabled() bool {
	return true
}

func (mc modeConstrained) ConflictResolutionEnabled() bool {
	return true
}

func (mc modeConstrained) QuotaReclamationEnabled() bool {
	return true
}

func (mc modeConstrained) QuotaReclamationPeriod() time.Duration {
	return defaultQRPeriod
}

func (mc modeConstrained) QuotaReclamationMinUnrefAge() time.Duration {
	return defaultQRMinUnrefAge
}

func (mc modeConstrained) QuotaReclamationMinHeadAge() time.Duration {
	// Don't ever run QR in constrained mode unless this device was
	// the most recent writer.
	return 0
}

func (mc modeConstrained) KBFSServiceEnabled() bool {
	return false
}

func (mc modeConstrained) JournalEnabled() bool {
	return true
}

func (mc modeConstrained) UnmergedTLFsEnabled() bool {
	return true
}

func (mc modeConstrained) ServiceKeepaliveEnabled() bool {
	return false
}

func (mc modeConstrained) TLFEditHistoryEnabled() bool {
	return false
}

func (mc modeConstrained) SendEditNotificationsEnabled() bool {
	return true
}

func (mc modeConstrained) LocalHTTPServerEnabled() bool {
	return true
}

// Memory limited mode

type modeMemoryLimited struct {
	InitMode
}

func (mml modeMemoryLimited) Type() InitModeType {
	return InitMemoryLimited
}

func (mml modeMemoryLimited) RekeyWorkers() int {
	return 0
}

func (mml modeMemoryLimited) RekeyQueueSize() int {
	return 0
}

func (mml modeMemoryLimited) ConflictResolutionEnabled() bool {
	return false
}

func (mml modeMemoryLimited) QuotaReclamationEnabled() bool {
	return false
}

func (mml modeMemoryLimited) UnmergedTLFsEnabled() bool {
	return false
}

func (mml modeMemoryLimited) SendEditNotificationsEnabled() bool {
	return false
}

func (mml modeMemoryLimited) LocalHTTPServerEnabled() bool {
	return false
}

func (mml modeMemoryLimited) MaxCleanBlockCacheCapacity() uint64 {
	return 1 * (1 << 20) // 1 MB
}

// Wrapper for tests.

type modeTest struct {
	InitMode
}

func (mt modeTest) IsTestMode() bool {
	return true
}

func (mt modeTest) QuotaReclamationPeriod() time.Duration {
	// No auto-reclamation during testing.
	return 0
}

func (mt modeTest) QuotaReclamationMinUnrefAge() time.Duration {
	// Smaller archival window by default during testing, for
	// backwards compatibility with old tests.
	return 1 * time.Minute
}

func (mt modeTest) QuotaReclamationMinHeadAge() time.Duration {
	// No min head age during testing.
	return 0
}
