// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"context"
)

// CtxReadWriteKeyType is the type of the key for overriding read-only
// nodes.
type CtxReadWriteKeyType int

const (
	// CtxReadWriteKey is a context key to indicate that a read-only
	// node should be treated as read-write.
	CtxReadWriteKey CtxReadWriteKeyType = 1
)

// ReadonlyNode is a read-only node by default, unless `CtxReadWriteKey`
// has a value set in the context.
type ReadonlyNode struct {
	Node
}

var _ Node = (*ReadonlyNode)(nil)

// Readonly implements the Node interface for ReadonlyNode.
func (rn ReadonlyNode) Readonly(ctx context.Context) bool {
	return ctx.Value(CtxReadWriteKey) == nil
}

// WrapChild implements the Node interface for ReadonlyNode.
func (rn ReadonlyNode) WrapChild(child Node) Node {
	return &ReadonlyNode{rn.Node.WrapChild(child)}
}

func readonlyWrapper(node Node) Node {
	return &ReadonlyNode{Node: node}
}
