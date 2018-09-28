// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libgit

import (
	"context"
	"sync"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/kbfs/libkbfs"
)

type getNewConfigFn func(context.Context) (
	context.Context, libkbfs.Config, string, error)

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
	}
}

// Shutdown shuts down this manager.
func (am *AutogitManager) Shutdown() {
	// No-op.
}

func (am *AutogitManager) registerRepoNode(
	nodeToWatch libkbfs.Node, rdn *repoDirNode) {
	am.registryLock.Lock()
	defer am.registryLock.Unlock()
	am.repoNodesForWatchedIDs[nodeToWatch.GetID()] = rdn
	fb := nodeToWatch.GetFolderBranch()
	if !am.registeredFBs[fb] {
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
			// TODO(KBFS-3429): fill in context.
			ctx := context.TODO()
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
