// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libgit

import (
	"context"
	"path"
	"sync"
	"time"

	"github.com/keybase/kbfs/libkbfs"
	"github.com/keybase/kbfs/tlf"
	"github.com/pkg/errors"
)

// This file contains libkbfs.Node wrappers for implementing the
// .kbfs_autogit directory structure. It breaks down like this:
//
// * `rootWrapper.wrap()` is installed as a root node wrapper, and wraps
//   the root node for each TLF in a `rootNode` instance.
// * `rootNode` allows .kbfs_autogit to be auto-created when it is
//   looked up, and wraps it two ways, as both a `readonlyNode`, and
//   an `autogitRootNode`.
// * `readonlyNode` is always marked as read-only, unless
//   `ctxReadWriteKey` has a non-nil value in the context.
// * `autogitRootNode` allows the auto-creation of subdirectories
//   representing TLF types, e.g. .kbfs_autogit/private or
//   .kbfs_autogit/public.  It wraps child nodes two ways, as both a
//   `readonlyNode`, and an `tlfTypeNode`.
// * `tlfTypeNode` allows the auto-creation of subdirectories
//   representing TLFs, e.g. .kbfs_autogit/private/max or
//   .kbfs_autogit/team/keybase.  It wraps child nodes as a
//   `readOnlyNode`.  TODO(KBFS-2678): allow repo autocreation under
//   a `tlfTypeNode`.

type ctxReadWriteKeyType int
type ctxSkipPopulateKeyType int

const (
	autogitRoot = ".kbfs_autogit"

	populateTimeout = 10 * time.Second

	ctxReadWriteKey    ctxReadWriteKeyType    = 1
	ctxSkipPopulateKey ctxSkipPopulateKeyType = 1

	public  = "public"
	private = "private"
	team    = "team"
)

type repoNode struct {
	libkbfs.Node
	am       *AutogitManager
	h        *libkbfs.TlfHandle
	repoName string

	lock                 sync.Mutex
	populated            bool
	populatingInProgress chan struct{}
}

var _ libkbfs.Node = (*repoNode)(nil)

func newRepoNode(n libkbfs.Node, am *AutogitManager, h *libkbfs.TlfHandle,
	repoName string) *repoNode {
	return &repoNode{
		Node:     n,
		am:       am,
		h:        h,
		repoName: repoName,
	}
}

func (rn *repoNode) dstDir() string {
	var typeStr string
	switch rn.h.Type() {
	case tlf.Public:
		typeStr = public
	case tlf.Private:
		typeStr = private
	case tlf.SingleTeam:
		typeStr = team
	}

	return path.Join(
		autogitRoot, typeStr, string(rn.h.GetCanonicalName()))
}

func (rn *repoNode) populate(ctx context.Context) bool {
	ctx = context.WithValue(ctx, ctxSkipPopulateKey, 1)
	children, err := rn.am.config.KBFSOps().GetDirChildren(ctx, rn)
	if err != nil {
		rn.am.log.CDebugf(ctx, "Error getting children: %+v", err)
		return false
	}

	h, err := rn.am.config.KBFSOps().GetTLFHandle(ctx, rn)
	if err != nil {
		rn.am.log.CDebugf(ctx, "Error getting handle: %+v", err)
		return false
	}

	// If the directory is empty, clone it.  Otherwise, pull it.
	var doneCh <-chan struct{}
	cloneNeeded := len(children) == 0
	ctx = context.WithValue(ctx, ctxReadWriteKey, 1)
	if cloneNeeded {
		doneCh, err = rn.am.Clone(
			ctx, rn.h, rn.repoName, "master", h, rn.dstDir())
	} else {
		doneCh, err = rn.am.Pull(
			ctx, rn.h, rn.repoName, "master", h, rn.dstDir())
	}
	if err != nil {
		rn.am.log.CDebugf(ctx, "Error starting population: %+v", err)
		return false
	}

	select {
	case <-doneCh:
		return true
	case <-ctx.Done():
		rn.am.log.CDebugf(ctx, "Error waiting for population: %+v", ctx.Err())
		// If we did a clone, ask for a refresh anyway, so they will
		// see the CLONING file at least.
		return cloneNeeded
	}
}

func (rn *repoNode) shouldPopulate() (bool, <-chan struct{}) {
	rn.lock.Lock()
	defer rn.lock.Unlock()
	if rn.populated {
		return false, nil
	}
	if rn.populatingInProgress != nil {
		return false, rn.populatingInProgress
	}
	rn.populatingInProgress = make(chan struct{})
	return true, rn.populatingInProgress
}

func (rn *repoNode) finishPopulate(populated bool) {
	rn.lock.Lock()
	defer rn.lock.Unlock()
	rn.populated = populated
	close(rn.populatingInProgress)
	rn.populatingInProgress = nil
}

// ShouldRetryOnDirRead implements the Node interface for
// repoNode.
func (rn *repoNode) ShouldRetryOnDirRead(ctx context.Context) (
	shouldRetry bool) {
	if ctx.Value(ctxSkipPopulateKey) != nil {
		return false
	}

	// Don't let this operation take more than a fixed amount of time.
	// We should just let the caller see the CLONING file if it takes
	// too long.
	ctx, cancel := context.WithTimeout(ctx, populateTimeout)
	defer cancel()

	for {
		doPopulate, ch := rn.shouldPopulate()
		if !doPopulate && ch == nil {
			return shouldRetry
		}
		// If it wasn't populated on the first check, always force the
		// caller to retry.
		shouldRetry = true

		if doPopulate {
			rn.am.log.CDebugf(ctx, "Populating repo node on first access")
			shouldRetry = rn.populate(ctx)
			rn.finishPopulate(shouldRetry)
			return shouldRetry
		}

		// Wait for the existing populate to succeed or fail.
		rn.am.log.CDebugf(ctx, "Waiting for existing populate to finish")
		select {
		case <-ch:
		case <-ctx.Done():
			rn.am.log.CDebugf(ctx, "Error waiting for populate: %+v", ctx.Err())
			return false
		}
	}
}

type tlfNode struct {
	libkbfs.Node
	am *AutogitManager
	h  *libkbfs.TlfHandle
}

var _ libkbfs.Node = (*tlfNode)(nil)

// ShouldCreateMissedLookup implements the Node interface for
// tlfNode.
func (tn tlfNode) ShouldCreateMissedLookup(
	ctx context.Context, name string) (
	bool, context.Context, libkbfs.EntryType, string) {
	normalizedRepoName := normalizeRepoName(name)

	// Is this a legit repo?
	_, _, err := GetRepoAndID(ctx, tn.am.config, tn.h, name, "")
	if err != nil {
		return false, ctx, libkbfs.File, ""
	}

	ctx = context.WithValue(ctx, ctxReadWriteKey, 1)
	if name != normalizedRepoName {
		return true, ctx, libkbfs.Sym, normalizedRepoName
	}
	return true, ctx, libkbfs.Dir, ""
}

// WrapChild implements the Node interface for tlfNode.
func (tn tlfNode) WrapChild(child libkbfs.Node) libkbfs.Node {
	child = tn.Node.WrapChild(child)
	return newRepoNode(child, tn.am, tn.h, child.GetBasename())
}

// tlfTypeNode represents an autogit subdirectory corresponding to a
// specific TLF type.  It can only contain subdirectories that
// correspond to valid TLF name for the TLF type.
type tlfTypeNode struct {
	libkbfs.Node
	am      *AutogitManager
	tlfType tlf.Type
}

var _ libkbfs.Node = (*tlfTypeNode)(nil)

// ShouldCreateMissedLookup implements the Node interface for
// tlfTypeNode.
func (ttn tlfTypeNode) ShouldCreateMissedLookup(
	ctx context.Context, name string) (
	bool, context.Context, libkbfs.EntryType, string) {
	_, err := libkbfs.ParseTlfHandle(
		ctx, ttn.am.config.KBPKI(), ttn.am.config.MDOps(), name, ttn.tlfType)

	ctx = context.WithValue(ctx, ctxReadWriteKey, struct{}{})
	switch e := errors.Cause(err).(type) {
	case nil:
		return true, ctx, libkbfs.Dir, ""
	case libkbfs.TlfNameNotCanonical:
		return true, ctx, libkbfs.Sym, e.NameToTry
	default:
		ttn.am.log.CDebugf(ctx,
			"Error parsing handle for name %s: %+v", name, err)
		return ttn.Node.ShouldCreateMissedLookup(ctx, name)
	}
}

// WrapChild implements the Node interface for tlfTypeNode.
func (ttn tlfTypeNode) WrapChild(child libkbfs.Node) libkbfs.Node {
	child = ttn.Node.WrapChild(child)
	ctx, cancel := context.WithTimeout(context.Background(), populateTimeout)
	defer cancel()
	h, err := libkbfs.ParseTlfHandle(
		ctx, ttn.am.config.KBPKI(), ttn.am.config.MDOps(),
		child.GetBasename(), ttn.tlfType)
	if err != nil {
		// If we have a node for the child already, it can't be
		// non-canonical because symlinks don't have Nodes.
		ttn.am.log.CDebugf(ctx,
			"Error parsing handle for tlfTypeNode child: %+v", err)
		return child
	}

	return &tlfNode{child, ttn.am, h}
}

// autogitRootNode represents the .kbfs_autogit folder, and can only
// contain subdirectories corresponding to TLF types.
type autogitRootNode struct {
	libkbfs.Node
	am *AutogitManager
}

var _ libkbfs.Node = (*autogitRootNode)(nil)

// ShouldCreateMissedLookup implements the Node interface for
// autogitRootNode.
func (arn autogitRootNode) ShouldCreateMissedLookup(
	ctx context.Context, name string) (
	bool, context.Context, libkbfs.EntryType, string) {
	switch name {
	case public, private, team:
		ctx = context.WithValue(ctx, ctxReadWriteKey, struct{}{})
		return true, ctx, libkbfs.Dir, ""
	default:
		return arn.Node.ShouldCreateMissedLookup(ctx, name)
	}
}

// WrapChild implements the Node interface for autogitRootNode.
func (arn autogitRootNode) WrapChild(child libkbfs.Node) libkbfs.Node {
	child = arn.Node.WrapChild(child)
	var tlfType tlf.Type
	switch child.GetBasename() {
	case public:
		tlfType = tlf.Public
	case private:
		tlfType = tlf.Private
	case team:
		tlfType = tlf.SingleTeam
	default:
		return child
	}
	return &tlfTypeNode{
		Node:    child,
		am:      arn.am,
		tlfType: tlfType,
	}
}

// readonlyNode is a read-only node by default, unless `ctxReadWriteKey`
// has a value set in the context.
type readonlyNode struct {
	libkbfs.Node
}

var _ libkbfs.Node = (*readonlyNode)(nil)

// Readonly implements the Node interface for readonlyNode.
func (rn readonlyNode) Readonly(ctx context.Context) bool {
	return ctx.Value(ctxReadWriteKey) == nil
}

// WrapChild implements the Node interface for readonlyNode.
func (rn readonlyNode) WrapChild(child libkbfs.Node) libkbfs.Node {
	return &readonlyNode{rn.Node.WrapChild(child)}
}

// rootNode is a Node wrapper around a TLF root node, that causes the
// autogit root to be created when it is accessed.
type rootNode struct {
	libkbfs.Node
	am *AutogitManager
}

var _ libkbfs.Node = (*rootNode)(nil)

// ShouldCreateMissedLookup implements the Node interface for
// rootNode.
func (rn rootNode) ShouldCreateMissedLookup(ctx context.Context, name string) (
	bool, context.Context, libkbfs.EntryType, string) {
	if name == autogitRoot {
		ctx = context.WithValue(ctx, ctxReadWriteKey, struct{}{})
		ctx = context.WithValue(ctx, libkbfs.CtxAllowNameKey, autogitRoot)
		return true, ctx, libkbfs.Dir, ""
	}
	return rn.Node.ShouldCreateMissedLookup(ctx, name)
}

// WrapChild implements the Node interface for rootNode.
func (rn rootNode) WrapChild(child libkbfs.Node) libkbfs.Node {
	child = rn.Node.WrapChild(child)
	if child.GetBasename() == autogitRoot {
		return &autogitRootNode{
			Node: &readonlyNode{child},
			am:   rn.am,
		}
	}
	return child
}

// rootWrapper is a struct that manages wrapping root nodes with
// autogit-related context.
type rootWrapper struct {
	am *AutogitManager
}

func (rw rootWrapper) wrap(node libkbfs.Node) libkbfs.Node {
	return &rootNode{node, rw.am}
}
