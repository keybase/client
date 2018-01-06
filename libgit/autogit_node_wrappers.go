// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libgit

import (
	"context"

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

const (
	autogitRoot                         = ".kbfs_autogit"
	ctxReadWriteKey ctxReadWriteKeyType = 1

	public  = "public"
	private = "private"
	team    = "team"
)

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
