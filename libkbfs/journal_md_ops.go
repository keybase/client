// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"time"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/kbfsblock"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/kbfsmd"
	"github.com/pkg/errors"

	"github.com/keybase/kbfs/tlf"

	"golang.org/x/net/context"
)

// journalMDOps is an implementation of MDOps that delegates to a
// TLF's mdJournal, if one exists. Specifically, it intercepts put
// calls to write to the journal instead of the MDServer, where
// something else is presumably flushing the journal to the MDServer.
//
// It then intercepts get calls to provide a combined view of the MDs
// from the journal and the server when the journal is
// non-empty. Specifically, if rev is the earliest revision in the
// journal, and BID is the branch ID of the journal (which can only
// have one), then any requests for revisions >= rev on BID will be
// served from the journal instead of the server. If BID is empty,
// i.e. the journal is holding merged revisions, then this means that
// all merged revisions on the server from rev are hidden.
//
// TODO: This makes server updates meaningless for revisions >=
// rev. Fix this.
type journalMDOps struct {
	MDOps
	jServer *JournalServer
}

var _ MDOps = journalMDOps{}

// convertImmutableBareRMDToIRMD decrypts the bare MD into a
// full-fledged RMD.  The MD is assumed to have been read from the
// journal.
func (j journalMDOps) convertImmutableBareRMDToIRMD(ctx context.Context,
	ibrmd ImmutableBareRootMetadata, handle *TlfHandle,
	uid keybase1.UID, key kbfscrypto.VerifyingKey) (
	ImmutableRootMetadata, error) {
	// TODO: Avoid having to do this type assertion.
	brmd, ok := ibrmd.RootMetadata.(kbfsmd.MutableRootMetadata)
	if !ok {
		return ImmutableRootMetadata{}, kbfsmd.MutableRootMetadataNoImplError{}
	}

	rmd := makeRootMetadata(brmd, ibrmd.extra, handle)

	config := j.jServer.config
	pmd, err := decryptMDPrivateData(ctx, config.Codec(), config.Crypto(),
		config.BlockCache(), config.BlockOps(), config.KeyManager(),
		config.KBPKI(), config.Mode(), uid, rmd.GetSerializedPrivateMetadata(),
		rmd, rmd, j.jServer.log)
	if err != nil {
		return ImmutableRootMetadata{}, err
	}

	rmd.data = pmd
	irmd := MakeImmutableRootMetadata(
		rmd, key, ibrmd.mdID, ibrmd.localTimestamp, false)
	return irmd, nil
}

// getHeadFromJournal returns the head RootMetadata for the TLF with
// the given ID stored in the journal, assuming it exists and matches
// the given branch ID and merge status. As a special case, if bid is
// kbfsmd.NullBranchID and mStatus is Unmerged, the branch ID check is
// skipped.
func (j journalMDOps) getHeadFromJournal(
	ctx context.Context, id tlf.ID, bid kbfsmd.BranchID, mStatus kbfsmd.MergeStatus,
	handle *TlfHandle) (
	ImmutableRootMetadata, error) {
	tlfJournal, ok := j.jServer.getTLFJournal(id, handle)
	if !ok {
		return ImmutableRootMetadata{}, nil
	}

	if mStatus == kbfsmd.Unmerged && bid == kbfsmd.NullBranchID {
		// We need to look up the branch ID because the caller didn't
		// know it.
		var err error
		bid, err = tlfJournal.getBranchID()
		if err != nil {
			return ImmutableRootMetadata{}, err
		}
	}

	head, err := tlfJournal.getMDHead(ctx, bid)
	switch errors.Cause(err).(type) {
	case nil:
		break
	case errTLFJournalDisabled:
		return ImmutableRootMetadata{}, nil
	default:
		return ImmutableRootMetadata{}, err
	}

	if head == (ImmutableBareRootMetadata{}) {
		return ImmutableRootMetadata{}, nil
	}

	if head.MergedStatus() != mStatus {
		return ImmutableRootMetadata{}, nil
	}

	if mStatus == kbfsmd.Unmerged && bid != kbfsmd.NullBranchID && bid != head.BID() {
		// The given branch ID doesn't match the one in the
		// journal, which can only be an error.
		return ImmutableRootMetadata{},
			fmt.Errorf("Expected branch ID %s, got %s",
				bid, head.BID())
	}

	headBareHandle, err := head.MakeBareTlfHandleWithExtra()
	if err != nil {
		return ImmutableRootMetadata{}, err
	}

	if handle == nil {
		handle, err = MakeTlfHandle(
			ctx, headBareHandle, id.Type(), j.jServer.config.KBPKI(),
			j.jServer.config.KBPKI(), constIDGetter{id})
		if err != nil {
			return ImmutableRootMetadata{}, err
		}
	} else {
		// Check for mutual handle resolution.
		headHandle, err := MakeTlfHandle(
			ctx, headBareHandle, id.Type(), j.jServer.config.KBPKI(),
			j.jServer.config.KBPKI(), constIDGetter{id})
		if err != nil {
			return ImmutableRootMetadata{}, err
		}

		if err := headHandle.MutuallyResolvesTo(ctx, j.jServer.config.Codec(),
			j.jServer.config.KBPKI(), j.jServer.config.MDOps(), *handle,
			head.RevisionNumber(), head.TlfID(), j.jServer.log); err != nil {
			return ImmutableRootMetadata{}, err
		}
	}

	irmd, err := j.convertImmutableBareRMDToIRMD(
		ctx, head, handle, tlfJournal.uid, tlfJournal.key)
	if err != nil {
		return ImmutableRootMetadata{}, err
	}

	return irmd, nil
}

func (j journalMDOps) getRangeFromJournal(
	ctx context.Context, id tlf.ID, bid kbfsmd.BranchID, mStatus kbfsmd.MergeStatus,
	start, stop kbfsmd.Revision) (
	[]ImmutableRootMetadata, error) {
	tlfJournal, ok := j.jServer.getTLFJournal(id, nil)
	if !ok {
		return nil, nil
	}

	ibrmds, err := tlfJournal.getMDRange(ctx, bid, start, stop)
	switch errors.Cause(err).(type) {
	case nil:
		break
	case errTLFJournalDisabled:
		return nil, nil
	default:
		return nil, err
	}

	if len(ibrmds) == 0 {
		return nil, nil
	}

	headIndex := len(ibrmds) - 1
	head := ibrmds[headIndex]
	if head.MergedStatus() != mStatus {
		return nil, nil
	}

	if mStatus == kbfsmd.Unmerged && bid != kbfsmd.NullBranchID && bid != head.BID() {
		// The given branch ID doesn't match the one in the
		// journal, which can only be an error.
		return nil, fmt.Errorf("Expected branch ID %s, got %s",
			bid, head.BID())
	}

	bareHandle, err := head.MakeBareTlfHandleWithExtra()
	if err != nil {
		return nil, err
	}
	handle, err := MakeTlfHandle(
		ctx, bareHandle, id.Type(), j.jServer.config.KBPKI(),
		j.jServer.config.KBPKI(), constIDGetter{id})
	if err != nil {
		return nil, err
	}

	irmds := make([]ImmutableRootMetadata, 0, len(ibrmds))

	for _, ibrmd := range ibrmds {
		irmd, err := j.convertImmutableBareRMDToIRMD(
			ctx, ibrmd, handle, tlfJournal.uid, tlfJournal.key)
		if err != nil {
			return nil, err
		}

		irmds = append(irmds, irmd)
	}

	// It would be nice to cache the irmds here, but we can't because
	// the underlying journal might have been converted to a branch
	// since we fetched them, and we can't risk putting them in the
	// cache with the wrong branch ID.  TODO: convert them to
	// ImmutableRootMetadata and cache them under the tlfJournal lock?

	return irmds, nil
}

// GetIDForHandle implements the MDOps interface for journalMDOps.
func (j journalMDOps) GetIDForHandle(
	ctx context.Context, handle *TlfHandle) (id tlf.ID, err error) {
	id, err = j.MDOps.GetIDForHandle(ctx, handle)
	if err != nil {
		return tlf.NullID, err
	}
	if id == tlf.NullID {
		return id, nil
	}
	// Create the journal if needed, while we have access to `handle`.
	_, _ = j.jServer.getTLFJournal(id, handle)
	return id, nil
}

// TODO: Combine the two GetForTLF functions in MDOps to avoid the
// need for this helper function.
func (j journalMDOps) getForTLF(ctx context.Context, id tlf.ID, bid kbfsmd.BranchID,
	mStatus kbfsmd.MergeStatus, lockBeforeGet *keybase1.LockID,
	delegateFn func(context.Context, tlf.ID, *keybase1.LockID) (
		ImmutableRootMetadata, error)) (ImmutableRootMetadata, error) {
	// If the journal has a head, use that.
	irmd, err := j.getHeadFromJournal(ctx, id, bid, mStatus, nil)
	if err != nil {
		return ImmutableRootMetadata{}, err
	}
	if irmd != (ImmutableRootMetadata{}) {
		return irmd, nil
	}

	if mStatus == kbfsmd.Unmerged {
		// Journal users always store their unmerged heads locally, so
		// no need to check with the server.
		return ImmutableRootMetadata{}, nil
	}

	// Otherwise, consult the server instead.
	return delegateFn(ctx, id, lockBeforeGet)
}

func (j journalMDOps) GetForTLF(
	ctx context.Context, id tlf.ID, lockBeforeGet *keybase1.LockID) (
	irmd ImmutableRootMetadata, err error) {
	j.jServer.log.LazyTrace(ctx, "jMDOps: GetForTLF %s", id)
	defer func() {
		j.jServer.deferLog.LazyTrace(ctx, "jMDOps: GetForTLF %s done (err=%v)", id, err)
	}()

	return j.getForTLF(
		ctx, id, kbfsmd.NullBranchID, kbfsmd.Merged, lockBeforeGet, j.MDOps.GetForTLF)
}

func (j journalMDOps) GetForTLFByTime(
	ctx context.Context, id tlf.ID, serverTime time.Time) (
	ImmutableRootMetadata, error) {
	// For now, we don't bother looking up MDs from the journal by
	// time -- that could be confusing, since the "server time" could
	// change once the MD is actually flushed.
	return j.MDOps.GetForTLFByTime(ctx, id, serverTime)
}

func (j journalMDOps) GetUnmergedForTLF(
	ctx context.Context, id tlf.ID, bid kbfsmd.BranchID) (
	irmd ImmutableRootMetadata, err error) {
	j.jServer.log.LazyTrace(ctx, "jMDOps: GetUnmergedForTLF %s %s", id, bid)
	defer func() {
		j.jServer.deferLog.LazyTrace(ctx, "jMDOps: GetForTLF %s %s done (err=%v)", id, bid, err)
	}()

	delegateFn := func(ctx context.Context, id tlf.ID, _ *keybase1.LockID) (
		ImmutableRootMetadata, error) {
		return j.MDOps.GetUnmergedForTLF(ctx, id, bid)
	}
	return j.getForTLF(ctx, id, bid, kbfsmd.Unmerged, nil, delegateFn)
}

// TODO: Combine the two GetRange functions in MDOps to avoid the need
// for this helper function.
func (j journalMDOps) getRange(
	ctx context.Context, id tlf.ID, bid kbfsmd.BranchID, mStatus kbfsmd.MergeStatus,
	start, stop kbfsmd.Revision, lockBeforeGet *keybase1.LockID,
	delegateFn func(ctx context.Context, id tlf.ID,
		start, stop kbfsmd.Revision, lockBeforeGet *keybase1.LockID) (
		[]ImmutableRootMetadata, error)) (
	[]ImmutableRootMetadata, error) {
	// Grab the range from the journal first.
	jirmds, err := j.getRangeFromJournal(ctx, id, bid, mStatus, start, stop)
	switch errors.Cause(err).(type) {
	case nil:
		break
	case errTLFJournalDisabled:
		// Fall back to the server.
		return delegateFn(ctx, id, start, stop, lockBeforeGet)
	default:
		return nil, err
	}

	if len(jirmds) != 0 && lockBeforeGet != nil {
		// We need to grab locks, so we have to hit the server. But it's
		// dangerous to bypass journal if we have revisions in this range from
		// the journal. For now, we just return error here.
		// NOTE: In the future if we ever need locking in places other than
		// SyncFromServer, we can use the naked Lock RPC to grab the lock if
		// everything we need is in the journal already.
		return nil, errors.New(
			"cannot lock when getting revisions that exist in journal")
	}

	// If it's empty, fall back to the server if this isn't a local
	// squash branch.  TODO: we should be able to avoid server access
	// for regular conflict branches when the journal is enabled, as
	// well, once we're confident that all old server-based branches
	// have been resolved.
	if len(jirmds) == 0 {
		if bid == kbfsmd.PendingLocalSquashBranchID {
			return jirmds, nil
		}
		return delegateFn(ctx, id, start, stop, lockBeforeGet)
	}

	// If the first revision from the journal is the first revision we
	// asked for (or this is a local squash that doesn't require
	// server access), then just return the range from the journal.
	// TODO: we should be able to avoid server access for regular
	// conflict branches, as well.
	if jirmds[0].Revision() == start || bid == kbfsmd.PendingLocalSquashBranchID {
		return jirmds, nil
	}

	// Otherwise, fetch the rest from the server and prepend them.
	serverStop := jirmds[0].Revision() - 1
	irmds, err := delegateFn(ctx, id, start, serverStop, lockBeforeGet)
	if err != nil {
		return nil, err
	}

	if len(irmds) == 0 {
		return jirmds, nil
	}

	lastRev := irmds[len(irmds)-1].Revision()
	if lastRev != serverStop {
		return nil, fmt.Errorf(
			"Expected last server rev %d, got %d",
			serverStop, lastRev)
	}

	return append(irmds, jirmds...), nil
}

func (j journalMDOps) GetRange(ctx context.Context, id tlf.ID, start,
	stop kbfsmd.Revision, lockBeforeGet *keybase1.LockID) (
	irmds []ImmutableRootMetadata, err error) {
	j.jServer.log.LazyTrace(ctx, "jMDOps: GetRange %s %d-%d", id, start, stop)
	defer func() {
		j.jServer.deferLog.LazyTrace(ctx, "jMDOps: GetRange %s %d-%d done (err=%v)", id, start, stop, err)
	}()

	return j.getRange(ctx, id, kbfsmd.NullBranchID, kbfsmd.Merged, start, stop, lockBeforeGet,
		j.MDOps.GetRange)
}

func (j journalMDOps) GetUnmergedRange(
	ctx context.Context, id tlf.ID, bid kbfsmd.BranchID,
	start, stop kbfsmd.Revision) (irmd []ImmutableRootMetadata, err error) {
	j.jServer.log.LazyTrace(ctx, "jMDOps: GetUnmergedRange %s %d-%d", id, start, stop)
	defer func() {
		j.jServer.deferLog.LazyTrace(ctx, "jMDOps: GetUnmergedRange %s %d-%d done (err=%v)", id, start, stop, err)
	}()

	delegateFn := func(ctx context.Context, id tlf.ID,
		start, stop kbfsmd.Revision, _ *keybase1.LockID) (
		[]ImmutableRootMetadata, error) {
		return j.MDOps.GetUnmergedRange(ctx, id, bid, start, stop)
	}
	return j.getRange(ctx, id, bid, kbfsmd.Unmerged, start, stop, nil,
		delegateFn)
}

func (j journalMDOps) Put(ctx context.Context, rmd *RootMetadata,
	verifyingKey kbfscrypto.VerifyingKey,
	lc *keybase1.LockContext, priority keybase1.MDPriority) (
	irmd ImmutableRootMetadata, err error) {
	j.jServer.log.LazyTrace(ctx, "jMDOps: Put %s %d", rmd.TlfID(), rmd.Revision())
	defer func() {
		j.jServer.deferLog.LazyTrace(ctx, "jMDOps: Put %s %d done (err=%v)", rmd.TlfID(), rmd.Revision(), err)
	}()

	if tlfJournal, ok := j.jServer.getTLFJournal(
		rmd.TlfID(), rmd.GetTlfHandle()); ok {
		if lc != nil {
			return ImmutableRootMetadata{}, errors.New(
				"journal Put doesn't support LockContext " +
					"yet. Use FinishSingleOp to require locks on MD write.")
		}
		if priority != keybase1.MDPriorityNormal {
			return ImmutableRootMetadata{}, errors.New(
				"journal Put doesn't support priority other than " +
					"MDPriorityNormal yet. Use FinishSingleOp to specify " +
					"priority on MD write.")
		}
		// Just route to the journal.
		irmd, err := tlfJournal.putMD(ctx, rmd, verifyingKey)
		switch errors.Cause(err).(type) {
		case nil:
			return irmd, nil
		case errTLFJournalDisabled:
			break
		default:
			return ImmutableRootMetadata{}, err
		}
	}

	return j.MDOps.Put(ctx, rmd, verifyingKey, lc, priority)
}

func (j journalMDOps) PutUnmerged(ctx context.Context, rmd *RootMetadata,
	verifyingKey kbfscrypto.VerifyingKey) (
	irmd ImmutableRootMetadata, err error) {
	j.jServer.log.LazyTrace(ctx, "jMDOps: PutUnmerged %s %d", rmd.TlfID(), rmd.Revision())
	defer func() {
		j.jServer.deferLog.LazyTrace(ctx, "jMDOps: PutUnmerged %s %d done (err=%v)", rmd.TlfID(), rmd.Revision(), err)
	}()

	if tlfJournal, ok := j.jServer.getTLFJournal(
		rmd.TlfID(), rmd.GetTlfHandle()); ok {
		rmd.SetUnmerged()
		irmd, err := tlfJournal.putMD(ctx, rmd, verifyingKey)
		switch errors.Cause(err).(type) {
		case nil:
			return irmd, nil
		case errTLFJournalDisabled:
			break
		default:
			return ImmutableRootMetadata{}, err
		}
	}

	return j.MDOps.PutUnmerged(ctx, rmd, verifyingKey)
}

func (j journalMDOps) PruneBranch(
	ctx context.Context, id tlf.ID, bid kbfsmd.BranchID) (err error) {
	j.jServer.log.LazyTrace(ctx, "jMDOps: PruneBranch %s %s", id, bid)
	defer func() {
		j.jServer.deferLog.LazyTrace(ctx, "jMDOps: PruneBranch %s %s (err=%v)", id, bid, err)
	}()

	if tlfJournal, ok := j.jServer.getTLFJournal(id, nil); ok {
		// Prune the journal, too.
		err := tlfJournal.clearMDs(ctx, bid)
		switch errors.Cause(err).(type) {
		case nil:
			break
		case errTLFJournalDisabled:
			break
		default:
			return err
		}
	}

	return j.MDOps.PruneBranch(ctx, id, bid)
}

func (j journalMDOps) ResolveBranch(
	ctx context.Context, id tlf.ID, bid kbfsmd.BranchID,
	blocksToDelete []kbfsblock.ID, rmd *RootMetadata,
	verifyingKey kbfscrypto.VerifyingKey) (
	irmd ImmutableRootMetadata, err error) {
	j.jServer.log.LazyTrace(ctx, "jMDOps: ResolveBranch %s %s", id, bid)
	defer func() {
		j.jServer.deferLog.LazyTrace(ctx, "jMDOps: ResolveBranch %s %s (err=%v)", id, bid, err)
	}()

	if tlfJournal, ok := j.jServer.getTLFJournal(id, rmd.GetTlfHandle()); ok {
		irmd, err := tlfJournal.resolveBranch(
			ctx, bid, blocksToDelete, rmd, verifyingKey)
		switch errors.Cause(err).(type) {
		case nil:
			return irmd, nil
		case errTLFJournalDisabled:
			break
		default:
			return ImmutableRootMetadata{}, err
		}
	}

	return j.MDOps.ResolveBranch(
		ctx, id, bid, blocksToDelete, rmd, verifyingKey)
}
