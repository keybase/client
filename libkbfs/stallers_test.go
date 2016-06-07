// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import "golang.org/x/net/context"

// staller is a pair of channels. Whenever something is to be
// stalled, a value is sent on stalled (if not blocked), and then
// unstall is waited on.
type staller struct {
	stalled chan<- struct{}
	unstall <-chan struct{}
}

func maybeStall(ctx context.Context, opName string, stallOpName string,
	stallKey interface{}, stallMap map[interface{}]staller) {
	if opName != stallOpName {
		return
	}

	v := ctx.Value(stallKey)
	chans, ok := stallMap[v]
	if !ok {
		return
	}

	select {
	case chans.stalled <- struct{}{}:
	default:
	}
	<-chans.unstall
}

// stallingBlockOps is an implementation of BlockOps whose operations
// sometimes stall. In particular, if the operation name matches
// stallOpName, and ctx.Value(stallKey) is a key in the corresponding
// staller is used to stall the operation.
type stallingBlockOps struct {
	stallOpName string
	stallKey    interface{}
	stallMap    map[interface{}]staller
	delegate    BlockOps
}

var _ BlockOps = (*stallingBlockOps)(nil)

func (f *stallingBlockOps) maybeStall(ctx context.Context, opName string) {
	maybeStall(ctx, opName, f.stallOpName, f.stallKey, f.stallMap)
}

func (f *stallingBlockOps) Get(
	ctx context.Context, md *RootMetadata, blockPtr BlockPointer,
	block Block) error {
	f.maybeStall(ctx, "Get")
	return f.delegate.Get(ctx, md, blockPtr, block)
}

func (f *stallingBlockOps) Ready(
	ctx context.Context, md *RootMetadata, block Block) (
	id BlockID, plainSize int, readyBlockData ReadyBlockData, err error) {
	f.maybeStall(ctx, "Ready")
	return f.delegate.Ready(ctx, md, block)
}

func (f *stallingBlockOps) Put(
	ctx context.Context, md *RootMetadata, blockPtr BlockPointer,
	readyBlockData ReadyBlockData) error {
	f.maybeStall(ctx, "Put")
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}
	err := f.delegate.Put(ctx, md, blockPtr, readyBlockData)
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}
	return err
}

func (f *stallingBlockOps) Delete(
	ctx context.Context, md *RootMetadata,
	ptrs []BlockPointer) (map[BlockID]int, error) {
	f.maybeStall(ctx, "Delete")
	return f.delegate.Delete(ctx, md, ptrs)
}

func (f *stallingBlockOps) Archive(
	ctx context.Context, md *RootMetadata, ptrs []BlockPointer) error {
	f.maybeStall(ctx, "Archive")
	return f.delegate.Archive(ctx, md, ptrs)
}

// stallingMDOps is an implementation of MDOps whose operations
// sometimes stall. In particular, if the operation name matches
// stallOpName, and ctx.Value(stallKey) is a key in the corresponding
// staller is used to stall the operation.
type stallingMDOps struct {
	stallOpName string
	stallKey    interface{}
	stallMap    map[interface{}]staller
	delegate    MDOps
}

var _ MDOps = (*stallingMDOps)(nil)

func (m *stallingMDOps) maybeStall(ctx context.Context, opName string) {
	maybeStall(ctx, opName, m.stallOpName, m.stallKey, m.stallMap)
}

func (m *stallingMDOps) GetForHandle(ctx context.Context, handle *TlfHandle) (
	*RootMetadata, error) {
	m.maybeStall(ctx, "GetForHandle")
	return m.delegate.GetForHandle(ctx, handle)
}

func (m *stallingMDOps) GetUnmergedForHandle(ctx context.Context,
	handle *TlfHandle) (*RootMetadata, error) {
	m.maybeStall(ctx, "GetUnmergedForHandle")
	return m.delegate.GetUnmergedForHandle(ctx, handle)
}

func (m *stallingMDOps) GetForTLF(ctx context.Context, id TlfID) (
	*RootMetadata, error) {
	m.maybeStall(ctx, "GetForTLF")
	return m.delegate.GetForTLF(ctx, id)
}

func (m *stallingMDOps) GetLatestHandleForTLF(ctx context.Context, id TlfID) (
	BareTlfHandle, error) {
	m.maybeStall(ctx, "GetLatestHandleForTLF")
	return m.delegate.GetLatestHandleForTLF(ctx, id)
}

func (m *stallingMDOps) GetUnmergedForTLF(ctx context.Context, id TlfID,
	bid BranchID) (*RootMetadata, error) {
	m.maybeStall(ctx, "GetUnmergedForTLF")
	return m.delegate.GetUnmergedForTLF(ctx, id, bid)
}

func (m *stallingMDOps) GetRange(ctx context.Context, id TlfID,
	start, stop MetadataRevision) (
	[]*RootMetadata, error) {
	m.maybeStall(ctx, "GetRange")
	return m.delegate.GetRange(ctx, id, start, stop)
}

func (m *stallingMDOps) GetUnmergedRange(ctx context.Context, id TlfID,
	bid BranchID, start, stop MetadataRevision) ([]*RootMetadata, error) {
	m.maybeStall(ctx, "GetUnmergedRange")
	return m.delegate.GetUnmergedRange(ctx, id, bid, start, stop)
}

func (m *stallingMDOps) Put(ctx context.Context, md *RootMetadata) error {
	m.maybeStall(ctx, "Put")
	err := m.delegate.Put(ctx, md)
	// If the Put was canceled, return the cancel error.  This
	// emulates the Put being canceled while the RPC is outstanding.
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
		return err
	}
}

func (m *stallingMDOps) PutUnmerged(ctx context.Context, md *RootMetadata,
	bid BranchID) error {
	m.maybeStall(ctx, "PutUnmerged")
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}
	err := m.delegate.PutUnmerged(ctx, md, bid)
	// If the PutUnmerged was canceled, return the cancel error.  This
	// emulates the PutUnmerged being canceled while the RPC is
	// outstanding.
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
		return err
	}
}
