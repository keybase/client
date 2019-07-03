// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"reflect"
	"sync"
	"time"

	"github.com/keybase/client/go/kbfs/kbfsmd"
	"github.com/keybase/client/go/kbfs/tlf"
	kbname "github.com/keybase/client/go/kbun"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

// FolderBranchStatus is a simple data structure describing the
// current status of a particular folder-branch.  It is suitable for
// encoding directly as JSON.
type FolderBranchStatus struct {
	Staged              bool
	BranchID            string
	HeadWriter          kbname.NormalizedUsername
	DiskUsage           uint64
	RekeyPending        bool
	LatestKeyGeneration kbfsmd.KeyGen
	FolderID            string
	Revision            kbfsmd.Revision
	LastGCRevision      kbfsmd.Revision
	MDVersion           kbfsmd.MetadataVer
	RootBlockID         string
	SyncEnabled         bool
	PrefetchStatus      string
	UsageBytes          int64
	ArchiveBytes        int64
	LimitBytes          int64
	GitUsageBytes       int64
	GitArchiveBytes     int64
	GitLimitBytes       int64
	LocalTimestamp      time.Time

	// DirtyPaths are files that have been written, but not flushed.
	// They do not represent unstaged changes in your local instance.
	DirtyPaths []string

	// If we're in the staged state, these summaries show the
	// diverging operations per-file
	Unmerged []*crChainSummary
	Merged   []*crChainSummary

	ConflictResolutionAttempts []conflictRecord            `json:",omitempty"`
	ConflictStatus             keybase1.FolderConflictType `json:",omitempty"`

	Journal *TLFJournalStatus `json:",omitempty"`

	PermanentErr string `json:",omitempty"`
}

// KBFSStatus represents the content of the top-level status file. It is
// suitable for encoding directly as JSON.
// TODO: implement magical status update like FolderBranchStatus
type KBFSStatus struct {
	CurrentUser          string
	IsConnected          bool
	UsageBytes           int64
	ArchiveBytes         int64
	LimitBytes           int64
	GitUsageBytes        int64
	GitArchiveBytes      int64
	GitLimitBytes        int64
	FailingServices      map[string]error
	JournalManager       *JournalManagerStatus           `json:",omitempty"`
	DiskBlockCacheStatus map[string]DiskBlockCacheStatus `json:",omitempty"`
	DiskMDCacheStatus    DiskMDCacheStatus               `json:",omitempty"`
	DiskQuotaCacheStatus DiskQuotaCacheStatus            `json:",omitempty"`
}

// StatusUpdate is a dummy type used to indicate status has been updated.
type StatusUpdate struct{}

// folderBranchStatusKeeper holds and updates the status for a given
// folder-branch, and produces FolderBranchStatus instances suitable
// for callers outside this package to consume.
type folderBranchStatusKeeper struct {
	config    Config
	nodeCache NodeCache

	dataMutex  sync.Mutex
	md         ImmutableRootMetadata
	permErr    error
	dirtyNodes map[NodeID]Node
	unmerged   []*crChainSummary
	merged     []*crChainSummary
	quotaUsage *EventuallyConsistentQuotaUsage

	fboIDBytes []byte

	updateChan  chan StatusUpdate
	updateMutex sync.Mutex
}

func newFolderBranchStatusKeeper(
	config Config, nodeCache NodeCache,
	quotaUsage *EventuallyConsistentQuotaUsage,
	fboIDBytes []byte) *folderBranchStatusKeeper {
	return &folderBranchStatusKeeper{
		config:     config,
		nodeCache:  nodeCache,
		dirtyNodes: make(map[NodeID]Node),
		updateChan: make(chan StatusUpdate, 1),
		quotaUsage: quotaUsage,
		fboIDBytes: fboIDBytes,
	}
}

// dataMutex should be taken by the caller
func (fbsk *folderBranchStatusKeeper) signalChangeLocked() {
	fbsk.updateMutex.Lock()
	defer fbsk.updateMutex.Unlock()
	close(fbsk.updateChan)
	fbsk.updateChan = make(chan StatusUpdate, 1)
}

// setRootMetadata sets the current head metadata for the
// corresponding folder-branch.
func (fbsk *folderBranchStatusKeeper) setRootMetadata(md ImmutableRootMetadata) {
	fbsk.dataMutex.Lock()
	defer fbsk.dataMutex.Unlock()
	if fbsk.md.MdID() == md.MdID() {
		return
	}
	fbsk.md = md
	fbsk.signalChangeLocked()
}

func (fbsk *folderBranchStatusKeeper) setCRSummary(unmerged []*crChainSummary,
	merged []*crChainSummary) {
	fbsk.dataMutex.Lock()
	defer fbsk.dataMutex.Unlock()
	if reflect.DeepEqual(unmerged, fbsk.unmerged) &&
		reflect.DeepEqual(merged, fbsk.merged) {
		return
	}
	fbsk.unmerged = unmerged
	fbsk.merged = merged
	fbsk.signalChangeLocked()
}

func (fbsk *folderBranchStatusKeeper) setPermErr(err error) {
	fbsk.dataMutex.Lock()
	defer fbsk.dataMutex.Unlock()
	fbsk.permErr = err
	fbsk.signalChangeLocked()
}

func (fbsk *folderBranchStatusKeeper) addNode(m map[NodeID]Node, n Node) bool {
	fbsk.dataMutex.Lock()
	defer fbsk.dataMutex.Unlock()
	id := n.GetID()
	_, ok := m[id]
	if ok {
		return false
	}
	m[id] = n
	fbsk.signalChangeLocked()
	return true
}

func (fbsk *folderBranchStatusKeeper) rmNode(m map[NodeID]Node, n Node) bool {
	fbsk.dataMutex.Lock()
	defer fbsk.dataMutex.Unlock()
	id := n.GetID()
	_, ok := m[id]
	if !ok {
		return false
	}
	delete(m, id)
	fbsk.signalChangeLocked()
	return true
}

func (fbsk *folderBranchStatusKeeper) addDirtyNode(n Node) bool {
	return fbsk.addNode(fbsk.dirtyNodes, n)
}

func (fbsk *folderBranchStatusKeeper) rmDirtyNode(n Node) bool {
	return fbsk.rmNode(fbsk.dirtyNodes, n)
}

// dataMutex should be taken by the caller
func (fbsk *folderBranchStatusKeeper) convertNodesToPathsLocked(
	m map[NodeID]Node) []string {
	var ret []string
	for _, n := range m {
		ret = append(ret, fbsk.nodeCache.PathFromNode(n).String())
	}
	return ret
}

func (fbsk *folderBranchStatusKeeper) getStatusWithoutJournaling(
	ctx context.Context) (
	FolderBranchStatus, <-chan StatusUpdate, tlf.ID, error) {
	fbsk.dataMutex.Lock()
	defer fbsk.dataMutex.Unlock()
	fbsk.updateMutex.Lock()
	defer fbsk.updateMutex.Unlock()

	var fbs FolderBranchStatus

	tlfID := tlf.NullID
	if fbsk.md != (ImmutableRootMetadata{}) {
		tlfID = fbsk.md.TlfID()
		fbs.Staged = fbsk.md.IsUnmergedSet()
		fbs.BranchID = fbsk.md.BID().String()
		name, err := fbsk.config.KBPKI().GetNormalizedUsername(
			ctx, fbsk.md.LastModifyingWriter().AsUserOrTeam(),
			fbsk.config.OfflineAvailabilityForID(tlfID))
		if err != nil {
			return FolderBranchStatus{}, nil, tlf.NullID, err
		}
		fbs.HeadWriter = name
		fbs.DiskUsage = fbsk.md.DiskUsage()
		fbs.RekeyPending = fbsk.config.RekeyQueue().IsRekeyPending(fbsk.md.TlfID())
		fbs.LatestKeyGeneration = fbsk.md.LatestKeyGeneration()
		fbs.FolderID = fbsk.md.TlfID().String()
		fbs.Revision = fbsk.md.Revision()
		fbs.LastGCRevision = fbsk.md.data.LastGCRevision
		fbs.MDVersion = fbsk.md.Version()
		fbs.SyncEnabled = fbsk.config.IsSyncedTlf(fbsk.md.TlfID())
		prefetchStatus := fbsk.config.PrefetchStatus(ctx, fbsk.md.TlfID(),
			fbsk.md.Data().Dir.BlockPointer)
		fbs.PrefetchStatus = prefetchStatus.String()
		fbs.RootBlockID = fbsk.md.Data().Dir.BlockPointer.ID.String()
		fbs.LocalTimestamp = fbsk.md.localTimestamp

		if fbsk.quotaUsage == nil {
			log := fbsk.config.MakeLogger(QuotaUsageLogModule(fmt.Sprintf(
				"status-%s", fbsk.md.TlfID())))
			vlog := fbsk.config.MakeVLogger(log)
			chargedTo, err := chargedToForTLF(
				ctx, fbsk.config.KBPKI(), fbsk.config.KBPKI(),
				fbsk.config, fbsk.md.GetTlfHandle())
			if err != nil {
				return FolderBranchStatus{}, nil, tlf.NullID, err
			}
			if chargedTo.IsTeam() {
				// TODO: somehow share this team quota usage instance
				// with the journal for the team (and subteam) TLFs?
				fbsk.quotaUsage = NewEventuallyConsistentTeamQuotaUsage(
					fbsk.config, chargedTo.AsTeamOrBust(), log, vlog)
			} else {
				// Almost certainly this should be being passed in by
				// the caller of fbsk's constructor, and in that case
				// we wouldn't be making a new one here
				fbsk.quotaUsage = NewEventuallyConsistentQuotaUsage(
					fbsk.config, log, vlog)
			}
		}
		_, usageBytes, archiveBytes, limitBytes,
			gitUsageBytes, gitArchiveBytes, gitLimitBytes, quErr :=
			fbsk.quotaUsage.GetAllTypes(
				ctx, quotaUsageStaleTolerance/2, quotaUsageStaleTolerance)
		if quErr != nil {
			// The error is ignored here so that other fields can
			// still be populated even if this fails.
			log := fbsk.config.MakeLogger("")
			log.CDebugf(ctx, "Getting quota usage error: %v", quErr)
		}
		fbs.UsageBytes = usageBytes
		fbs.ArchiveBytes = archiveBytes
		fbs.LimitBytes = limitBytes
		fbs.GitUsageBytes = gitUsageBytes
		fbs.GitArchiveBytes = gitArchiveBytes
		fbs.GitLimitBytes = gitLimitBytes
	}

	var crErr error
	fbs.ConflictResolutionAttempts, crErr = getAndDeserializeConflicts(
		fbsk.config, fbsk.config.GetConflictResolutionDB(), fbsk.fboIDBytes)
	if crErr != nil {
		// The error is ignored here so that other fields can
		// still be populated even if this fails.
		log := fbsk.config.MakeLogger("")
		log.CDebugf(ctx, "Getting CR status error: %+v", crErr)
	}
	if isCRStuckFromRecords(fbs.ConflictResolutionAttempts) {
		fbs.ConflictStatus = keybase1.FolderConflictType_IN_CONFLICT_AND_STUCK
	} else if fbs.BranchID != kbfsmd.NullBranchID.String() {
		fbs.ConflictStatus = keybase1.FolderConflictType_IN_CONFLICT
	}

	fbs.DirtyPaths = fbsk.convertNodesToPathsLocked(fbsk.dirtyNodes)

	fbs.Unmerged = fbsk.unmerged
	fbs.Merged = fbsk.merged

	if fbsk.permErr != nil {
		fbs.PermanentErr = fbsk.permErr.Error()
	}

	return fbs, fbsk.updateChan, tlfID, nil
}

// getStatus returns a FolderBranchStatus-representation of the
// current status. If blocks != nil, the paths of any unflushed files
// in the journals will be included in the status. The returned
// channel is closed whenever the status changes, except for journal
// status changes.
func (fbsk *folderBranchStatusKeeper) getStatus(ctx context.Context,
	blocks *folderBlockOps) (FolderBranchStatus, <-chan StatusUpdate, error) {
	fbs, ch, tlfID, err := fbsk.getStatusWithoutJournaling(ctx)
	if err != nil {
		return FolderBranchStatus{}, nil, err
	}
	if tlfID == tlf.NullID {
		return fbs, ch, nil
	}

	// Fetch journal info without holding any locks, to avoid possible
	// deadlocks with folderBlockOps.

	// TODO: Ideally, the journal would push status
	// updates to this object instead, so we can notify
	// listeners.
	jManager, err := GetJournalManager(fbsk.config)
	if err != nil {
		return fbs, ch, nil
	}

	var jStatus TLFJournalStatus
	if blocks != nil {
		jStatus, err = jManager.JournalStatusWithPaths(ctx, tlfID, blocks)
	} else {
		jStatus, err = jManager.JournalStatus(tlfID)
	}
	if err != nil {
		log := fbsk.config.MakeLogger("")
		log.CWarningf(ctx, "Error getting journal status for %s: %v",
			tlfID, err)
	} else {
		fbs.Journal = &jStatus
	}
	return fbs, ch, nil
}
