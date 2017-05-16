// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"math/rand"
	"sync"

	"github.com/keybase/kbfs/kbfsblock"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/kbfsmd"
	"github.com/keybase/kbfs/tlf"

	"golang.org/x/net/context"
)

type stallableOp string

// StallableBlockOp defines an Op that is stallable using StallBlockOp
type StallableBlockOp stallableOp

// StallableMDOp defines an Op that is stallable using StallMDOp
type StallableMDOp stallableOp

// stallable Block Ops and MD Ops
const (
	StallableBlockGet StallableBlockOp = "Get"
	StallableBlockPut StallableBlockOp = "Put"

	StallableMDGetForHandle          StallableMDOp = "GetForHandle"
	StallableMDGetForTLF             StallableMDOp = "GetForTLF"
	StallableMDGetLatestHandleForTLF StallableMDOp = "GetLatestHandleForTLF"
	StallableMDGetUnmergedForTLF     StallableMDOp = "GetUnmergedForTLF"
	StallableMDGetRange              StallableMDOp = "GetRange"
	StallableMDGetUnmergedRange      StallableMDOp = "GetUnmergedRange"
	StallableMDPut                   StallableMDOp = "Put"
	StallableMDAfterPut              StallableMDOp = "AfterPut"
	StallableMDPutUnmerged           StallableMDOp = "PutUnmerged"
	StallableMDAfterPutUnmerged      StallableMDOp = "AfterPutUnmerged"
	StallableMDPruneBranch           StallableMDOp = "PruneBranch"
	StallableMDResolveBranch         StallableMDOp = "ResolveBranch"
)

type stallKeyType uint64

const stallKeyStallEverything stallKeyType = 0

type naïveStallInfo struct {
	onStalled               <-chan struct{}
	unstall                 chan<- struct{}
	oldBlockServer          BlockServer
	oldMDOps                MDOps
	oldJournalDelegateMDOps MDOps
}

// NaïveStaller is used to stall certain ops in BlockServer or
// MDOps. Unlike StallBlockOp and StallMDOp which provides a way to
// precisely control which particular op is stalled by passing in ctx
// with corresponding stallKey, NaïveStaller simply stalls all
// instances of specified op.
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

// StallBlockOp wraps the internal BlockServer so that all subsequent stalledOp
// will be stalled. This can be undone by calling UndoStallBlockOp.
func (s *NaïveStaller) StallBlockOp(stalledOp StallableBlockOp, maxStalls int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.blockStalled {
		panic("incorrect use of NaïveStaller;" +
			" only one stalled Op at a time is supported")
	}
	onStalledCh := make(chan struct{}, maxStalls)
	unstallCh := make(chan struct{})
	oldBlockServer := s.config.BlockServer()
	s.config.SetBlockServer(&stallingBlockServer{
		BlockServer: oldBlockServer,
		stallOpName: stalledOp,
		stallKey:    stallKeyStallEverything,
		staller: staller{
			stalled: onStalledCh,
			unstall: unstallCh,
		},
	})
	s.blockStalled = true
	s.blockOpsStalls[stalledOp] = &naïveStallInfo{
		onStalled:      onStalledCh,
		unstall:        unstallCh,
		oldBlockServer: oldBlockServer,
	}
}

// StallMDOp wraps the internal MDOps so that all subsequent stalledOp
// will be stalled. This can be undone by calling UndoStallMDOp.
func (s *NaïveStaller) StallMDOp(stalledOp StallableMDOp, maxStalls int,
	stallDelegate bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.mdStalled {
		panic("incorrect use of NaïveStaller;" +
			" only one stalled Op at a time is supported")
	}
	onStalledCh := make(chan struct{}, maxStalls)
	unstallCh := make(chan struct{})
	oldMDOps := s.config.MDOps()
	var oldJDelegate MDOps
	if jServer, err := GetJournalServer(s.config); err == nil && stallDelegate {
		oldJDelegate = jServer.delegateMDOps
		// Stall the delegate server as well
		jServer.delegateMDOps = &stallingMDOps{
			stallOpName: stalledOp,
			stallKey:    stallKeyStallEverything,
			staller: staller{
				stalled: onStalledCh,
				unstall: unstallCh,
			},
			delegate: jServer.delegateMDOps,
		}
		s.config.SetMDOps(jServer.mdOps())
	} else {
		s.config.SetMDOps(&stallingMDOps{
			stallOpName: stalledOp,
			stallKey:    stallKeyStallEverything,
			staller: staller{
				stalled: onStalledCh,
				unstall: unstallCh,
			},
			delegate: oldMDOps,
		})
	}
	s.mdStalled = true
	s.mdOpsStalls[stalledOp] = &naïveStallInfo{
		onStalled:               onStalledCh,
		unstall:                 unstallCh,
		oldMDOps:                oldMDOps,
		oldJournalDelegateMDOps: oldJDelegate,
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
	s.config.SetBlockServer(ns.oldBlockServer)
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
	if jServer, err := GetJournalServer(s.config); err == nil &&
		ns.oldJournalDelegateMDOps != nil {
		jServer.delegateMDOps = ns.oldJournalDelegateMDOps
	}
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
func StallBlockOp(ctx context.Context, config Config,
	stalledOp StallableBlockOp, maxStalls int) (
	onStalled <-chan struct{}, unstall chan<- struct{}, newCtx context.Context) {
	onStalledCh := make(chan struct{}, maxStalls)
	unstallCh := make(chan struct{})
	stallKey := newStallKey()
	config.SetBlockServer(&stallingBlockServer{
		BlockServer: config.BlockServer(),
		stallOpName: stalledOp,
		stallKey:    stallKey,
		staller: staller{
			stalled: onStalledCh,
			unstall: unstallCh,
		},
	})
	newCtx = NewContextReplayable(ctx, func(ctx context.Context) context.Context {
		return context.WithValue(ctx, stallKey, true)
	})
	return onStalledCh, unstallCh, newCtx
}

// StallMDOp sets a wrapped MDOps in config so that the specified Op,
// stalledOp, is stalled. Caller should use the returned newCtx for subsequent
// operations for the stall to be effective. onStalled is a channel to notify
// the caller when the stall has happened. unstall is a channel for caller to
// unstall an Op.
func StallMDOp(ctx context.Context, config Config, stalledOp StallableMDOp,
	maxStalls int) (
	onStalled <-chan struct{}, unstall chan<- struct{}, newCtx context.Context) {
	onStalledCh := make(chan struct{}, maxStalls)
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
	newCtx = NewContextReplayable(ctx, func(ctx context.Context) context.Context {
		return context.WithValue(ctx, stallKey, true)
	})
	return onStalledCh, unstallCh, newCtx
}

func newStallKey() stallKeyType {
	stallKey := stallKeyStallEverything
	for stallKey == stallKeyStallEverything {
		stallKey = stallKeyType(rand.Int63())
	}
	return stallKey
}

// staller is a pair of channels. Whenever something is to be
// stalled, a value is sent on stalled (if not blocked), and then
// unstall is waited on.
type staller struct {
	stalled chan<- struct{}
	unstall <-chan struct{}
}

func maybeStall(ctx context.Context, opName stallableOp,
	stallOpName stallableOp, stallKey stallKeyType,
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

// stallingBlockServer is an implementation of BlockServer whose
// operations sometimes stall. In particular, if the operation name
// matches stallOpName, and ctx.Value(stallKey) is a key in the
// corresponding staller is used to stall the operation.
type stallingBlockServer struct {
	BlockServer
	stallOpName StallableBlockOp
	// stallKey is a key for switching on/off stalling. If it's present in ctx,
	// and equal to `true`, the operation is stalled. This allows us to use the
	// ctx to control stallings
	stallKey stallKeyType
	staller  staller
}

var _ BlockServer = (*stallingBlockServer)(nil)

func (f *stallingBlockServer) maybeStall(ctx context.Context, opName StallableBlockOp) {
	maybeStall(ctx, stallableOp(opName), stallableOp(f.stallOpName),
		f.stallKey, f.staller)
}

func (f *stallingBlockServer) Get(ctx context.Context, tlfID tlf.ID, id kbfsblock.ID,
	bctx kbfsblock.Context) (
	buf []byte, serverHalf kbfscrypto.BlockCryptKeyServerHalf, err error) {
	f.maybeStall(ctx, StallableBlockGet)
	err = runWithContextCheck(ctx, func(ctx context.Context) error {
		var errGet error
		buf, serverHalf, errGet = f.BlockServer.Get(ctx, tlfID, id, bctx)
		return errGet
	})
	return buf, serverHalf, err
}

func (f *stallingBlockServer) Put(ctx context.Context, tlfID tlf.ID, id kbfsblock.ID,
	bctx kbfsblock.Context, buf []byte,
	serverHalf kbfscrypto.BlockCryptKeyServerHalf) error {
	f.maybeStall(ctx, StallableBlockPut)
	return runWithContextCheck(ctx, func(ctx context.Context) error {
		return f.BlockServer.Put(ctx, tlfID, id, bctx, buf, serverHalf)
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
	stallKey stallKeyType
	staller  staller
	delegate MDOps
}

var _ MDOps = (*stallingMDOps)(nil)

func (m *stallingMDOps) maybeStall(ctx context.Context, opName StallableMDOp) {
	maybeStall(ctx, stallableOp(opName), stallableOp(m.stallOpName),
		m.stallKey, m.staller)
}

func (m *stallingMDOps) GetForHandle(
	ctx context.Context, handle *TlfHandle, mStatus MergeStatus) (
	tlfID tlf.ID, md ImmutableRootMetadata, err error) {
	m.maybeStall(ctx, StallableMDGetForHandle)
	err = runWithContextCheck(ctx, func(ctx context.Context) error {
		var errGetForHandle error
		tlfID, md, errGetForHandle =
			m.delegate.GetForHandle(ctx, handle, mStatus)
		return errGetForHandle
	})
	return tlfID, md, err
}

func (m *stallingMDOps) GetForTLF(ctx context.Context, id tlf.ID) (
	md ImmutableRootMetadata, err error) {
	m.maybeStall(ctx, StallableMDGetForTLF)
	err = runWithContextCheck(ctx, func(ctx context.Context) error {
		var errGetForTLF error
		md, errGetForTLF = m.delegate.GetForTLF(ctx, id)
		return errGetForTLF
	})
	return md, err
}

func (m *stallingMDOps) GetLatestHandleForTLF(ctx context.Context, id tlf.ID) (
	h tlf.Handle, err error) {
	m.maybeStall(ctx, StallableMDGetLatestHandleForTLF)
	err = runWithContextCheck(ctx, func(ctx context.Context) error {
		var errGetLatestHandleForTLF error
		h, errGetLatestHandleForTLF = m.delegate.GetLatestHandleForTLF(ctx, id)
		return errGetLatestHandleForTLF
	})
	return h, err
}

func (m *stallingMDOps) GetUnmergedForTLF(ctx context.Context, id tlf.ID,
	bid BranchID) (md ImmutableRootMetadata, err error) {
	m.maybeStall(ctx, StallableMDGetUnmergedForTLF)
	err = runWithContextCheck(ctx, func(ctx context.Context) error {
		var errGetUnmergedForTLF error
		md, errGetUnmergedForTLF = m.delegate.GetUnmergedForTLF(ctx, id, bid)
		return errGetUnmergedForTLF
	})
	return md, err
}

func (m *stallingMDOps) GetRange(ctx context.Context, id tlf.ID,
	start, stop kbfsmd.Revision) (
	mds []ImmutableRootMetadata, err error) {
	m.maybeStall(ctx, StallableMDGetRange)
	err = runWithContextCheck(ctx, func(ctx context.Context) error {
		var errGetRange error
		mds, errGetRange = m.delegate.GetRange(ctx, id, start, stop)
		return errGetRange
	})
	return mds, err
}

func (m *stallingMDOps) GetUnmergedRange(ctx context.Context, id tlf.ID,
	bid BranchID, start, stop kbfsmd.Revision) (mds []ImmutableRootMetadata, err error) {
	m.maybeStall(ctx, StallableMDGetUnmergedRange)
	err = runWithContextCheck(ctx, func(ctx context.Context) error {
		var errGetUnmergedRange error
		mds, errGetUnmergedRange = m.delegate.GetUnmergedRange(ctx, id, bid, start, stop)
		return errGetUnmergedRange
	})
	return mds, err
}

func (m *stallingMDOps) Put(ctx context.Context, md *RootMetadata,
	verifyingKey kbfscrypto.VerifyingKey) (
	irmd ImmutableRootMetadata, err error) {
	m.maybeStall(ctx, StallableMDPut)
	err = runWithContextCheck(ctx, func(ctx context.Context) error {
		irmd, err = m.delegate.Put(ctx, md, verifyingKey)
		m.maybeStall(ctx, StallableMDAfterPut)
		return err
	})
	return irmd, err
}

func (m *stallingMDOps) PutUnmerged(ctx context.Context, md *RootMetadata,
	verifyingKey kbfscrypto.VerifyingKey) (
	irmd ImmutableRootMetadata, err error) {
	m.maybeStall(ctx, StallableMDPutUnmerged)
	err = runWithContextCheck(ctx, func(ctx context.Context) error {
		irmd, err = m.delegate.PutUnmerged(ctx, md, verifyingKey)
		m.maybeStall(ctx, StallableMDAfterPutUnmerged)
		return err
	})
	return irmd, err
}

func (m *stallingMDOps) PruneBranch(
	ctx context.Context, id tlf.ID, bid BranchID) error {
	m.maybeStall(ctx, StallableMDPruneBranch)
	return runWithContextCheck(ctx, func(ctx context.Context) error {
		return m.delegate.PruneBranch(ctx, id, bid)
	})
}

func (m *stallingMDOps) ResolveBranch(
	ctx context.Context, id tlf.ID, bid BranchID, blocksToDelete []kbfsblock.ID,
	rmd *RootMetadata, verifyingKey kbfscrypto.VerifyingKey) (
	irmd ImmutableRootMetadata, err error) {
	m.maybeStall(ctx, StallableMDResolveBranch)
	err = runWithContextCheck(ctx, func(ctx context.Context) error {
		irmd, err = m.delegate.ResolveBranch(
			ctx, id, bid, blocksToDelete, rmd, verifyingKey)
		return err
	})
	return irmd, err
}
