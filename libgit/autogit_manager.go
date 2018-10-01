// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libgit

import (
	"context"
	"os"
	"sync"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/libfs"
	"github.com/keybase/kbfs/libkbfs"
	"github.com/keybase/kbfs/tlf"
	"github.com/pkg/errors"
)

type getNewConfigFn func(context.Context) (
	context.Context, libkbfs.Config, string, error)

const (
	// Debug tag ID for an individual autogit operation
	ctxAutogitOpID = "AGID"
)

type ctxAutogitTagKey int

const (
	ctxAutogitIDKey ctxAutogitTagKey = iota
)

// AutogitManager can clone and pull source git repos into a
// destination folder, potentially across different TLFs.  New
// requests for an operation in a destination repo are blocked by any
// ongoing requests for the same folder, and multiple outstanding
// requests for the same destination folder get rolled up into one.
type AutogitManager struct {
	config   libkbfs.Config
	log      logger.Logger
	deferLog logger.Logger

	registryLock           sync.RWMutex
	registeredFBs          map[libkbfs.FolderBranch]bool
	repoNodesForWatchedIDs map[libkbfs.NodeID]*repoDirNode
	watchedNodes           []libkbfs.Node // preventing GC on the watched nodes
	deleteCancels          map[string]context.CancelFunc
	shutdown               bool

	doRemoveSelfCheckouts sync.Once
}

// NewAutogitManager constructs a new AutogitManager instance.
func NewAutogitManager(config libkbfs.Config) *AutogitManager {
	log := config.MakeLogger("")
	return &AutogitManager{
		config:                 config,
		log:                    log,
		deferLog:               log.CloneWithAddedDepth(1),
		registeredFBs:          make(map[libkbfs.FolderBranch]bool),
		repoNodesForWatchedIDs: make(map[libkbfs.NodeID]*repoDirNode),
		deleteCancels:          make(map[string]context.CancelFunc),
	}
}

// Shutdown shuts down this manager.
func (am *AutogitManager) Shutdown() {
	am.registryLock.Lock()
	defer am.registryLock.Unlock()
	am.shutdown = true
	for _, cancel := range am.deleteCancels {
		cancel()
	}
}

func (am *AutogitManager) removeOldCheckoutsForHandle(
	ctx context.Context, h *libkbfs.TlfHandle, branch libkbfs.BranchName) {
	// Make an "unwrapped" FS, so we don't end up recursively entering
	// the virtual autogit nodes again.
	fs, err := libfs.NewUnwrappedFS(
		ctx, am.config, h, branch, "", "", keybase1.MDPriorityNormal)
	if err != nil {
		am.log.CDebugf(ctx, "Error making unwrapped FS for TLF %s: %+v",
			h.GetCanonicalPath(), err)
		return
	}

	fi, err := fs.Stat(AutogitRoot)
	if os.IsNotExist(errors.Cause(err)) {
		// No autogit repos to remove.
		return
	} else if err != nil {
		am.log.CDebugf(ctx,
			"Error checking autogit in unwrapped FS for TLF %s: %+v",
			h.GetCanonicalPath(), err)
		return
	}

	ctx, ok := func() (context.Context, bool) {
		am.registryLock.Lock()
		defer am.registryLock.Unlock()
		if am.shutdown {
			return nil, false
		}
		p := h.GetCanonicalPath()
		if _, ok := am.deleteCancels[p]; ok {
			return nil, false
		}

		ctx, cancel := context.WithCancel(ctx)
		am.deleteCancels[p] = cancel
		return ctx, true
	}()
	if !ok {
		return
	}

	am.log.CDebugf(ctx, "Recursively deleting old autogit data in TLF %s",
		h.GetCanonicalPath())
	defer func() {
		am.log.CDebugf(ctx, "Recursive delete of autogit done: %+v", err)
		am.registryLock.Lock()
		defer am.registryLock.Unlock()
		delete(am.deleteCancels, h.GetCanonicalPath())
	}()
	err = recursiveDelete(ctx, fs, fi)
}

func (am *AutogitManager) removeOldCheckouts(node libkbfs.Node) {
	ctx := libkbfs.CtxWithRandomIDReplayable(
		context.Background(), ctxAutogitIDKey, ctxAutogitOpID, am.log)

	h, err := am.config.KBFSOps().GetTLFHandle(ctx, node)
	if err != nil {
		am.log.CDebugf(ctx, "Error getting handle: %+v", err)
		return
	}

	am.removeOldCheckoutsForHandle(ctx, h, node.GetFolderBranch().Branch)
}

func (am *AutogitManager) removeSelfCheckouts() {
	ctx := libkbfs.CtxWithRandomIDReplayable(
		context.Background(), ctxAutogitIDKey, ctxAutogitOpID, am.log)

	session, err := am.config.KBPKI().GetCurrentSession(ctx)
	if err != nil {
		am.log.CDebugf(ctx,
			"Unable to get session; ignoring self-autogit delete: +%v", err)
		return
	}

	h, err := libkbfs.GetHandleFromFolderNameAndType(
		ctx, am.config.KBPKI(), am.config.MDOps(),
		string(session.Name), tlf.Private)
	if err != nil {
		am.log.CDebugf(ctx,
			"Unable to get private handle; ignoring self-autogit delete: +%v",
			err)
		return
	}

	am.removeOldCheckoutsForHandle(ctx, h, libkbfs.MasterBranch)
}

func (am *AutogitManager) registerRepoNode(
	nodeToWatch libkbfs.Node, rdn *repoDirNode) {
	am.registryLock.Lock()
	defer am.registryLock.Unlock()
	am.repoNodesForWatchedIDs[nodeToWatch.GetID()] = rdn
	fb := nodeToWatch.GetFolderBranch()
	if !am.registeredFBs[fb] {
		go am.removeOldCheckouts(rdn)
		am.doRemoveSelfCheckouts.Do(func() { go am.removeSelfCheckouts() })
		am.watchedNodes = append(am.watchedNodes, nodeToWatch)
		err := am.config.Notifier().RegisterForChanges(
			[]libkbfs.FolderBranch{fb}, am)
		if err != nil {
			am.log.CWarningf(nil, "Error registering %s: +%v", fb.Tlf, err)
			return
		}
		am.registeredFBs[fb] = true
	}
}

// LocalChange implements the libkbfs.Observer interface for AutogitManager.
func (am *AutogitManager) LocalChange(
	ctx context.Context, node libkbfs.Node, wr libkbfs.WriteRange) {
	// Do nothing.
}

func (am *AutogitManager) getNodesToInvalidate(
	affectedNodeIDs []libkbfs.NodeID) (nodes []libkbfs.Node) {
	am.registryLock.RLock()
	defer am.registryLock.RUnlock()
	for _, nodeID := range affectedNodeIDs {
		node, ok := am.repoNodesForWatchedIDs[nodeID]
		if ok {
			nodes = append(nodes, node)
		}
	}
	return nodes
}

// BatchChanges implements the libkbfs.Observer interface for AutogitManager.
func (am *AutogitManager) BatchChanges(
	ctx context.Context, _ []libkbfs.NodeChange,
	affectedNodeIDs []libkbfs.NodeID) {
	nodes := am.getNodesToInvalidate(affectedNodeIDs)
	for _, node := range nodes {
		node := node
		go func() {
			ctx := libkbfs.CtxWithRandomIDReplayable(
				context.Background(), ctxAutogitIDKey, ctxAutogitOpID, am.log)
			am.config.KBFSOps().InvalidateNodeAndChildren(ctx, node)
		}()
	}
}

// TlfHandleChange implements the libkbfs.Observer interface for
// AutogitManager.
func (am *AutogitManager) TlfHandleChange(
	ctx context.Context, newHandle *libkbfs.TlfHandle) {
	// Do nothing.
}

// StartAutogit launches autogit, and returns a function that should
// be called on shutdown.
func StartAutogit(config libkbfs.Config) func() {
	am := NewAutogitManager(config)
	rw := rootWrapper{am}
	config.AddRootNodeWrapper(rw.wrap)
	return am.Shutdown
}
