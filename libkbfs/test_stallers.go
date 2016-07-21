// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"sync"

	"golang.org/x/net/context"
)

type stallableOp string

// StallableBlockOp defines an Op that is stallable using StallBlockOp
type StallableBlockOp stallableOp

// StallableMDOp defines an Op that is stallable using StallMDOp
type StallableMDOp stallableOp

// stallable Block Ops and MD Ops
const (
	StallableBlockGet     StallableBlockOp = "Get"
	StallableBlockReady   StallableBlockOp = "Ready"
	StallableBlockPut     StallableBlockOp = "Put"
	StallableBlockDelete  StallableBlockOp = "Delete"
	StallableBlockArchive StallableBlockOp = "Archive"

	StallableMDGetForHandle          StallableMDOp = "GetForHandle"
	StallableMDGetUnmergedForHandle  StallableMDOp = "GetUnmergedForHandle"
	StallableMDGetForTLF             StallableMDOp = "GetForTLF"
	StallableMDGetLatestHandleForTLF StallableMDOp = "GetLatestHandleForTLF"
	StallableMDGetUnmergedForTLF     StallableMDOp = "GetUnmergedForTLF"
	StallableMDGetRange              StallableMDOp = "GetRange"
	StallableMDGetUnmergedRange      StallableMDOp = "GetUnmergedRange"
	StallableMDPut                   StallableMDOp = "Put"
	StallableMDAfterPut              StallableMDOp = "AfterPut"
	StallableMDPutUnmerged           StallableMDOp = "PutUnmerged"
)

const stallKeyStallEverything = ""

type naïveStallInfo struct {
	onStalled   <-chan struct{}
	unstall     chan<- struct{}
	oldBlockOps BlockOps
	oldMDOps    MDOps
}

// NaïveStaller is used to stall certain ops in BlockOps or MDOps. Unlike
// StallBlockOp and StallMDOp which provides a way to precisely control which
// particular op is stalled by passing in ctx with corresponding stallKey,
// NaïveStaller simply stalls all instances of specified op.
type NaïveStaller struct {
	config Config

	mu             sync.RWMutex
	blockOpsStalls map[StallableBlockOp]*naïveStallInfo
	mdOpsStalls    map[StallableMDOp]*naïveStallInfo

	// We are only supporting stalling one Op per kind at a time for now. If in
	// the future a dsl test needs to stall different Ops, please see
	// https://github.com/keybase/kbfs/pull/163 for an implementation.
	blockStalled bool
	mdStalled    bool
}

// NewNaïveStaller returns a new NaïveStaller
func NewNaïveStaller(config Config) *NaïveStaller {
	return &NaïveStaller{
		config:         config,
		blockOpsStalls: make(map[StallableBlockOp]*naïveStallInfo),
		mdOpsStalls:    make(map[StallableMDOp]*naïveStallInfo),
	}
}

func (s *NaïveStaller) getNaïveStallInfoForBlockOpOrBust(
	stalledOp StallableBlockOp) *naïveStallInfo {
	s.mu.RLock()
	defer s.mu.RUnlock()
	info, ok := s.blockOpsStalls[stalledOp]
	if !ok {
		panic("naïveStallInfo is not found." +
			"This indicates incorrect use of NaïveStaller")
	}
	return info
}

func (s *NaïveStaller) getNaïveStallInfoForMDOpOrBust(
	stalledOp StallableMDOp) *naïveStallInfo {
	s.mu.RLock()
	defer s.mu.RUnlock()
	info, ok := s.mdOpsStalls[stalledOp]
	if !ok {
		panic("naïveStallInfo is not found." +
			"This indicates incorrect use of NaïveStaller")
	}
	return info
}

// StallBlockOp wraps the internal BlockOps so that all subsequent stalledOp
// will be stalled. This can be undone by calling UndoStallBlockOp.
func (s *NaïveStaller) StallBlockOp(stalledOp StallableBlockOp) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.blockStalled {
		panic("incorrect use of NaïveStaller;" +
			" only one stalled Op at a time is supported")
	}
	onStalledCh := make(chan struct{}, 1)
	unstallCh := make(chan struct{})
	oldBlockOps := s.config.BlockOps()
	s.config.SetBlockOps(&stallingBlockOps{
		stallOpName: stalledOp,
		stallKey:    stallKeyStallEverything,
		staller: staller{
			stalled: onStalledCh,
			unstall: unstallCh,
		},
		delegate: oldBlockOps,
	})
	s.blockStalled = true
	s.blockOpsStalls[stalledOp] = &naïveStallInfo{
		onStalled:   onStalledCh,
		unstall:     unstallCh,
		oldBlockOps: oldBlockOps,
	}
}

// StallMDOp wraps the internal MDOps so that all subsequent stalledOp
// will be stalled. This can be undone by calling UndoStallMDOp.
func (s *NaïveStaller) StallMDOp(stalledOp StallableMDOp) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.mdStalled {
		panic("incorrect use of NaïveStaller;" +
			" only one stalled Op at a time is supported")
	}
	onStalledCh := make(chan struct{}, 1)
	unstallCh := make(chan struct{})
	oldMDOps := s.config.MDOps()
	s.config.SetMDOps(&stallingMDOps{
		stallOpName: stalledOp,
		stallKey:    stallKeyStallEverything,
		staller: staller{
			stalled: onStalledCh,
			unstall: unstallCh,
		},
		delegate: oldMDOps,
	})
	s.mdStalled = true
	s.mdOpsStalls[stalledOp] = &naïveStallInfo{
		onStalled: onStalledCh,
		unstall:   unstallCh,
		oldMDOps:  oldMDOps,
	}
}

// WaitForStallBlockOp blocks until stalledOp is stalled. StallBlockOp should
// have been called upon stalledOp, otherwise this would panic.
func (s *NaïveStaller) WaitForStallBlockOp(stalledOp StallableBlockOp) {
	<-s.getNaïveStallInfoForBlockOpOrBust(stalledOp).onStalled
}

// WaitForStallMDOp blocks until stalledOp is stalled. StallMDOp should
// have been called upon stalledOp, otherwise this would panic.
func (s *NaïveStaller) WaitForStallMDOp(stalledOp StallableMDOp) {
	<-s.getNaïveStallInfoForMDOpOrBust(stalledOp).onStalled
}

// UnstallOneBlockOp unstalls exactly one stalled stalledOp. StallBlockOp
// should have been called upon stalledOp, otherwise this would panic.
func (s *NaïveStaller) UnstallOneBlockOp(stalledOp StallableBlockOp) {
	s.getNaïveStallInfoForBlockOpOrBust(stalledOp).unstall <- struct{}{}
}

// UnstallOneMDOp unstalls exactly one stalled stalledOp. StallMDOp
// should have been called upon stalledOp, otherwise this would panic.
func (s *NaïveStaller) UnstallOneMDOp(stalledOp StallableMDOp) {
	s.getNaïveStallInfoForMDOpOrBust(stalledOp).unstall <- struct{}{}
}

// UndoStallBlockOp reverts StallBlockOp so that future stalledOp are not
// stalled anymore. It also unstalls any stalled stalledOp. StallBlockOp
// should have been called upon stalledOp, otherwise this would panic.
func (s *NaïveStaller) UndoStallBlockOp(stalledOp StallableBlockOp) {
	ns := s.getNaïveStallInfoForBlockOpOrBust(stalledOp)
	s.config.SetBlockOps(ns.oldBlockOps)
	close(ns.unstall)
	s.mu.Lock()
	defer s.mu.Unlock()
	s.blockStalled = false
	delete(s.blockOpsStalls, stalledOp)
}

// UndoStallMDOp reverts StallMDOp so that future stalledOp are not
// stalled anymore. It also unstalls any stalled stalledOp. StallMDOp
// should have been called upon stalledOp, otherwise this would panic.
func (s *NaïveStaller) UndoStallMDOp(stalledOp StallableMDOp) {
	ns := s.getNaïveStallInfoForMDOpOrBust(stalledOp)
	s.config.SetMDOps(ns.oldMDOps)
	close(ns.unstall)
	s.mu.Lock()
	defer s.mu.Unlock()
	s.mdStalled = false
	delete(s.mdOpsStalls, stalledOp)
}

// StallBlockOp sets a wrapped BlockOps in config so that the specified Op, stalledOp,
// is stalled. Caller should use the returned newCtx for subsequent operations
// for the stall to be effective. onStalled is a channel to notify the caller
// when the stall has happened. unstall is a channel for caller to unstall an
// Op.
func StallBlockOp(ctx context.Context, config Config, stalledOp StallableBlockOp) (
	onStalled <-chan struct{}, unstall chan<- struct{}, newCtx context.Context) {
	onStalledCh := make(chan struct{}, 1)
	unstallCh := make(chan struct{})
	stallKey := newStallKey()
	config.SetBlockOps(&stallingBlockOps{
		stallOpName: stalledOp,
		stallKey:    stallKey,
		staller: staller{
			stalled: onStalledCh,
			unstall: unstallCh,
		},
		delegate: config.BlockOps(),
	})
	newCtx = context.WithValue(ctx, stallKey, true)
	return onStalledCh, unstallCh, newCtx
}

// StallMDOp sets a wrapped MDOps in config so that the specified Op,
// stalledOp, is stalled. Caller should use the returned newCtx for subsequent
// operations for the stall to be effective. onStalled is a channel to notify
// the caller when the stall has happened. unstall is a channel for caller to
// unstall an Op.
func StallMDOp(ctx context.Context, config Config, stalledOp StallableMDOp) (
	onStalled <-chan struct{}, unstall chan<- struct{}, newCtx context.Context) {
	onStalledCh := make(chan struct{}, 1)
	unstallCh := make(chan struct{})
	stallKey := newStallKey()
	config.SetMDOps(&stallingMDOps{
		stallOpName: stalledOp,
		stallKey:    stallKey,
		staller: staller{
			stalled: onStalledCh,
			unstall: unstallCh,
		},
		delegate: config.MDOps(),
	})
	newCtx = context.WithValue(ctx, stallKey, true)
	return onStalledCh, unstallCh, newCtx
}

var stallerCounter uint64

func newStallKey() string {
	stallerCounter++
	return fmt.Sprintf("stallKey-%d", stallerCounter)
}

// staller is a pair of channels. Whenever something is to be
// stalled, a value is sent on stalled (if not blocked), and then
// unstall is waited on.
type staller struct {
	stalled chan<- struct{}
	unstall <-chan struct{}
}

func maybeStall(ctx context.Context, opName stallableOp,
	stallOpName stallableOp, stallKey string,
	staller staller) {
	if opName != stallOpName {
		return
	}

	if stallKey != stallKeyStallEverything {
		if v, ok := ctx.Value(stallKey).(bool); !ok || !v {
			return
		}
	}

	select {
	case staller.stalled <- struct{}{}:
	default:
	}
	<-staller.unstall
}

// runWithContextCheck checks ctx.Done() before and after running action. If
// either ctx.Done() check has error, ctx's error is returned. Otherwise,
// action's returned value is returned.
func runWithContextCheck(ctx context.Context, action func(ctx context.Context) error) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}
	err := action(ctx)
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}
	return err
}

// stallingBlockOps is an implementation of BlockOps whose operations
// sometimes stall. In particular, if the operation name matches
// stallOpName, and ctx.Value(stallKey) is a key in the corresponding
// staller is used to stall the operation.
type stallingBlockOps struct {
	stallOpName StallableBlockOp
	// stallKey is a key for switching on/off stalling. If it's present in ctx,
	// and equal to `true`, the operation is stalled. This allows us to use the
	// ctx to control stallings
	stallKey string
	staller  staller
	delegate BlockOps
}

var _ BlockOps = (*stallingBlockOps)(nil)

func (f *stallingBlockOps) maybeStall(ctx context.Context, opName StallableBlockOp) {
	maybeStall(ctx, stallableOp(opName), stallableOp(f.stallOpName),
		f.stallKey, f.staller)
}

func (f *stallingBlockOps) Get(
	ctx context.Context, md ReadOnlyRootMetadata, blockPtr BlockPointer,
	block Block) error {
	f.maybeStall(ctx, StallableBlockGet)
	return runWithContextCheck(ctx, func(ctx context.Context) error {
		return f.delegate.Get(ctx, md, blockPtr, block)
	})
}

func (f *stallingBlockOps) Ready(
	ctx context.Context, md ReadOnlyRootMetadata, block Block) (
	id BlockID, plainSize int, readyBlockData ReadyBlockData, err error) {
	f.maybeStall(ctx, StallableBlockReady)
	err = runWithContextCheck(ctx, func(ctx context.Context) error {
		var errReady error
		id, plainSize, readyBlockData, errReady = f.delegate.Ready(ctx, md, block)
		return errReady
	})
	return id, plainSize, readyBlockData, err
}

func (f *stallingBlockOps) Put(
	ctx context.Context, md ReadOnlyRootMetadata, blockPtr BlockPointer,
	readyBlockData ReadyBlockData) error {
	f.maybeStall(ctx, StallableBlockPut)
	return runWithContextCheck(ctx, func(ctx context.Context) error {
		return f.delegate.Put(ctx, md, blockPtr, readyBlockData)
	})
}

func (f *stallingBlockOps) Delete(
	ctx context.Context, md ReadOnlyRootMetadata,
	ptrs []BlockPointer) (notDeleted map[BlockID]int, err error) {
	f.maybeStall(ctx, StallableBlockDelete)
	err = runWithContextCheck(ctx, func(ctx context.Context) error {
		var errDelete error
		notDeleted, errDelete = f.delegate.Delete(ctx, md, ptrs)
		return errDelete
	})
	return notDeleted, err
}

func (f *stallingBlockOps) Archive(
	ctx context.Context, md ReadOnlyRootMetadata, ptrs []BlockPointer) error {
	f.maybeStall(ctx, StallableBlockArchive)
	return runWithContextCheck(ctx, func(ctx context.Context) error {
		return f.delegate.Archive(ctx, md, ptrs)
	})
}

// stallingMDOps is an implementation of MDOps whose operations
// sometimes stall. In particular, if the operation name matches
// stallOpName, and ctx.Value(stallKey) is a key in the corresponding
// staller is used to stall the operation.
type stallingMDOps struct {
	stallOpName StallableMDOp
	// stallKey is a key for switching on/off stalling. If it's present in ctx,
	// and equal to `true`, the operation is stalled. This allows us to use the
	// ctx to control stallings
	stallKey string
	staller  staller
	delegate MDOps
}

var _ MDOps = (*stallingMDOps)(nil)

func (m *stallingMDOps) maybeStall(ctx context.Context, opName StallableMDOp) {
	maybeStall(ctx, stallableOp(opName), stallableOp(m.stallOpName),
		m.stallKey, m.staller)
}

func (m *stallingMDOps) GetForHandle(ctx context.Context, handle *TlfHandle) (
	tlfID TlfID, md ImmutableRootMetadata, err error) {
	m.maybeStall(ctx, StallableMDGetForHandle)
	err = runWithContextCheck(ctx, func(ctx context.Context) error {
		var errGetForHandle error
		tlfID, md, errGetForHandle =
			m.delegate.GetForHandle(ctx, handle)
		return errGetForHandle
	})
	return tlfID, md, err
}

func (m *stallingMDOps) GetUnmergedForHandle(ctx context.Context,
	handle *TlfHandle) (md ImmutableRootMetadata, err error) {
	m.maybeStall(ctx, StallableMDGetUnmergedForHandle)
	err = runWithContextCheck(ctx, func(ctx context.Context) error {
		var errGetUnmergedForHandle error
		md, errGetUnmergedForHandle = m.delegate.GetUnmergedForHandle(ctx, handle)
		return errGetUnmergedForHandle
	})
	return md, err
}

func (m *stallingMDOps) GetForTLF(ctx context.Context, id TlfID) (
	md ImmutableRootMetadata, err error) {
	m.maybeStall(ctx, StallableMDGetForTLF)
	err = runWithContextCheck(ctx, func(ctx context.Context) error {
		var errGetForTLF error
		md, errGetForTLF = m.delegate.GetForTLF(ctx, id)
		return errGetForTLF
	})
	return md, err
}

func (m *stallingMDOps) GetLatestHandleForTLF(ctx context.Context, id TlfID) (
	h BareTlfHandle, err error) {
	m.maybeStall(ctx, StallableMDGetLatestHandleForTLF)
	err = runWithContextCheck(ctx, func(ctx context.Context) error {
		var errGetLatestHandleForTLF error
		h, errGetLatestHandleForTLF = m.delegate.GetLatestHandleForTLF(ctx, id)
		return errGetLatestHandleForTLF
	})
	return h, err
}

func (m *stallingMDOps) GetUnmergedForTLF(ctx context.Context, id TlfID,
	bid BranchID) (md ImmutableRootMetadata, err error) {
	m.maybeStall(ctx, StallableMDGetUnmergedForTLF)
	err = runWithContextCheck(ctx, func(ctx context.Context) error {
		var errGetUnmergedForTLF error
		md, errGetUnmergedForTLF = m.delegate.GetUnmergedForTLF(ctx, id, bid)
		return errGetUnmergedForTLF
	})
	return md, err
}

func (m *stallingMDOps) GetRange(ctx context.Context, id TlfID,
	start, stop MetadataRevision) (
	mds []ImmutableRootMetadata, err error) {
	m.maybeStall(ctx, StallableMDGetRange)
	err = runWithContextCheck(ctx, func(ctx context.Context) error {
		var errGetRange error
		mds, errGetRange = m.delegate.GetRange(ctx, id, start, stop)
		return errGetRange
	})
	return mds, err
}

func (m *stallingMDOps) GetUnmergedRange(ctx context.Context, id TlfID,
	bid BranchID, start, stop MetadataRevision) (mds []ImmutableRootMetadata, err error) {
	m.maybeStall(ctx, StallableMDGetUnmergedRange)
	err = runWithContextCheck(ctx, func(ctx context.Context) error {
		var errGetUnmergedRange error
		mds, errGetUnmergedRange = m.delegate.GetUnmergedRange(ctx, id, bid, start, stop)
		return errGetUnmergedRange
	})
	return mds, err
}

func (m *stallingMDOps) Put(ctx context.Context, md *RootMetadata) error {
	m.maybeStall(ctx, StallableMDPut)
	// If the Put was canceled, return the cancel error.  This
	// emulates the Put being canceled while the RPC is outstanding.
	return runWithContextCheck(ctx, func(ctx context.Context) error {
		err := m.delegate.Put(ctx, md)
		m.maybeStall(ctx, StallableMDAfterPut)
		return err
	})
}

func (m *stallingMDOps) PutUnmerged(ctx context.Context, md *RootMetadata,
	bid BranchID) error {
	m.maybeStall(ctx, StallableMDPutUnmerged)
	// If the PutUnmerged was canceled, return the cancel error.  This
	// emulates the PutUnmerged being canceled while the RPC is
	// outstanding.
	return runWithContextCheck(ctx, func(ctx context.Context) error {
		return m.delegate.PutUnmerged(ctx, md, bid)
	})
}
