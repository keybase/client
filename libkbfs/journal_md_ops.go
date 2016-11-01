// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"errors"
	"fmt"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/kbfscrypto"

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
// full-fledged RMD.
func (j journalMDOps) convertImmutableBareRMDToIRMD(ctx context.Context,
	ibrmd ImmutableBareRootMetadata, handle *TlfHandle,
	uid keybase1.UID, key kbfscrypto.VerifyingKey) (
	ImmutableRootMetadata, error) {
	// TODO: Avoid having to do this type assertion.
	brmd, ok := ibrmd.BareRootMetadata.(MutableBareRootMetadata)
	if !ok {
		return ImmutableRootMetadata{}, MutableBareRootMetadataNoImplError{}
	}

	rmd := makeRootMetadata(brmd, ibrmd.extra, handle)

	config := j.jServer.config
	pmd, err := decryptMDPrivateData(ctx, config.Codec(), config.Crypto(),
		config.BlockCache(), config.BlockOps(), config.KeyManager(),
		uid, rmd.GetSerializedPrivateMetadata(), rmd, rmd)
	if err != nil {
		return ImmutableRootMetadata{}, err
	}

	rmd.data = pmd
	irmd := MakeImmutableRootMetadata(
		rmd, key, ibrmd.mdID, ibrmd.localTimestamp)
	return irmd, nil
}

// getHeadFromJournal returns the head RootMetadata for the TLF with
// the given ID stored in the journal, assuming it exists and matches
// the given branch ID and merge status. As a special case, if bid is
// NullBranchID and mStatus is Unmerged, the branch ID check is
// skipped.
func (j journalMDOps) getHeadFromJournal(
	ctx context.Context, id TlfID, bid BranchID, mStatus MergeStatus,
	handle *TlfHandle) (
	ImmutableRootMetadata, error) {
	tlfJournal, ok := j.jServer.getTLFJournal(id)
	if !ok {
		return ImmutableRootMetadata{}, nil
	}

	head, err := tlfJournal.getMDHead(ctx)
	if err == errTLFJournalDisabled {
		return ImmutableRootMetadata{}, nil
	} else if err != nil {
		return ImmutableRootMetadata{}, err
	}

	if head == (ImmutableBareRootMetadata{}) {
		return ImmutableRootMetadata{}, nil
	}

	if head.MergedStatus() != mStatus {
		return ImmutableRootMetadata{}, nil
	}

	if mStatus == Unmerged && bid != NullBranchID && bid != head.BID() {
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
			ctx, headBareHandle, j.jServer.config.KBPKI())
		if err != nil {
			return ImmutableRootMetadata{}, err
		}
	} else {
		// Check for mutual handle resolution.
		headHandle, err := MakeTlfHandle(ctx, headBareHandle,
			j.jServer.config.KBPKI())
		if err != nil {
			return ImmutableRootMetadata{}, err
		}

		if err := headHandle.MutuallyResolvesTo(ctx, j.jServer.config.Codec(),
			j.jServer.config.KBPKI(), *handle, head.RevisionNumber(),
			head.TlfID(), j.jServer.log); err != nil {
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
	ctx context.Context, id TlfID, bid BranchID, mStatus MergeStatus,
	start, stop MetadataRevision) (
	[]ImmutableRootMetadata, error) {
	tlfJournal, ok := j.jServer.getTLFJournal(id)
	if !ok {
		return nil, nil
	}

	ibrmds, err := tlfJournal.getMDRange(ctx, start, stop)
	if err == errTLFJournalDisabled {
		return nil, nil
	} else if err != nil {
		return nil, err
	}

	if len(ibrmds) == 0 {
		return nil, nil
	}

	head := ibrmds[len(ibrmds)-1]

	if head.MergedStatus() != mStatus {
		return nil, nil
	}

	if mStatus == Unmerged && bid != NullBranchID && bid != head.BID() {
		// The given branch ID doesn't match the one in the
		// journal, which can only be an error.
		return nil, fmt.Errorf("Expected branch ID %s, got %s",
			bid, head.BID())
	}

	bareHandle, err := head.MakeBareTlfHandleWithExtra()
	if err != nil {
		return nil, err
	}
	handle, err := MakeTlfHandle(ctx, bareHandle, j.jServer.config.KBPKI())
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

	return irmds, nil
}

func (j journalMDOps) GetForHandle(
	ctx context.Context, handle *TlfHandle, mStatus MergeStatus) (
	TlfID, ImmutableRootMetadata, error) {
	// Need to always consult the server to get the tlfID. No need
	// to optimize this, since all subsequent lookups will be by
	// TLF. Although if we did want to, we could store a handle ->
	// TLF ID mapping with the journals.
	tlfID, rmd, err := j.MDOps.GetForHandle(ctx, handle, mStatus)
	if err != nil {
		return TlfID{}, ImmutableRootMetadata{}, err
	}

	if rmd != (ImmutableRootMetadata{}) && (rmd.TlfID() != tlfID) {
		return TlfID{}, ImmutableRootMetadata{},
			fmt.Errorf("Expected RMD to have TLF ID %s, but got %s",
				tlfID, rmd.TlfID())
	}

	// If the journal has a head, use that.
	irmd, err := j.getHeadFromJournal(
		ctx, tlfID, NullBranchID, mStatus, handle)
	if err != nil {
		return TlfID{}, ImmutableRootMetadata{}, err
	}
	if irmd != (ImmutableRootMetadata{}) {
		return TlfID{}, irmd, nil
	}

	// Otherwise, use the server's head.
	return tlfID, rmd, nil
}

// TODO: Combine the two GetForTLF functions in MDOps to avoid the
// need for this helper function.
func (j journalMDOps) getForTLF(
	ctx context.Context, id TlfID, bid BranchID, mStatus MergeStatus,
	delegateFn func(context.Context, TlfID) (ImmutableRootMetadata, error)) (
	ImmutableRootMetadata, error) {
	// If the journal has a head, use that.
	irmd, err := j.getHeadFromJournal(ctx, id, bid, mStatus, nil)
	if err != nil {
		return ImmutableRootMetadata{}, err
	}
	if irmd != (ImmutableRootMetadata{}) {
		return irmd, nil
	}

	// Otherwise, consult the server instead.
	return delegateFn(ctx, id)
}

func (j journalMDOps) GetForTLF(
	ctx context.Context, id TlfID) (ImmutableRootMetadata, error) {
	return j.getForTLF(ctx, id, NullBranchID, Merged, j.MDOps.GetForTLF)
}

func (j journalMDOps) GetUnmergedForTLF(
	ctx context.Context, id TlfID, bid BranchID) (
	ImmutableRootMetadata, error) {
	delegateFn := func(ctx context.Context, id TlfID) (
		ImmutableRootMetadata, error) {
		return j.MDOps.GetUnmergedForTLF(ctx, id, bid)
	}
	return j.getForTLF(ctx, id, bid, Unmerged, delegateFn)
}

// TODO: Combine the two GetRange functions in MDOps to avoid the need
// for this helper function.
func (j journalMDOps) getRange(
	ctx context.Context, id TlfID, bid BranchID, mStatus MergeStatus,
	start, stop MetadataRevision,
	delegateFn func(ctx context.Context, id TlfID,
		start, stop MetadataRevision) (
		[]ImmutableRootMetadata, error)) (
	[]ImmutableRootMetadata, error) {
	// Grab the range from the journal first.
	jirmds, err := j.getRangeFromJournal(ctx, id, bid, mStatus, start, stop)
	if err != nil {
		return nil, err
	}

	// If it's empty or disabled, just fall back to the server.
	if len(jirmds) == 0 || err == errTLFJournalDisabled {
		return delegateFn(ctx, id, start, stop)
	}

	// If the first revision from the journal is the first
	// revision we asked for, then just return the range from the
	// journal.
	if jirmds[0].Revision() == start {
		return jirmds, nil
	}

	// Otherwise, fetch the rest from the server and prepend them.
	serverStop := jirmds[0].Revision() - 1
	irmds, err := delegateFn(ctx, id, start, serverStop)
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

func (j journalMDOps) GetRange(
	ctx context.Context, id TlfID, start, stop MetadataRevision) (
	[]ImmutableRootMetadata, error) {
	return j.getRange(ctx, id, NullBranchID, Merged, start, stop,
		j.MDOps.GetRange)
}

func (j journalMDOps) GetUnmergedRange(
	ctx context.Context, id TlfID, bid BranchID,
	start, stop MetadataRevision) ([]ImmutableRootMetadata, error) {
	delegateFn := func(ctx context.Context, id TlfID,
		start, stop MetadataRevision) (
		[]ImmutableRootMetadata, error) {
		return j.MDOps.GetUnmergedRange(ctx, id, bid, start, stop)
	}
	return j.getRange(ctx, id, bid, Unmerged, start, stop,
		delegateFn)
}

func (j journalMDOps) Put(ctx context.Context, rmd *RootMetadata) (
	MdID, error) {
	if tlfJournal, ok := j.jServer.getTLFJournal(rmd.TlfID()); ok {
		// Just route to the journal.
		mdID, err := tlfJournal.putMD(ctx, rmd)
		if err != errTLFJournalDisabled {
			return mdID, err
		}
	}

	return j.MDOps.Put(ctx, rmd)
}

func (j journalMDOps) PutUnmerged(ctx context.Context, rmd *RootMetadata) (
	MdID, error) {
	if tlfJournal, ok := j.jServer.getTLFJournal(rmd.TlfID()); ok {
		rmd.SetUnmerged()
		mdID, err := tlfJournal.putMD(ctx, rmd)
		if err != errTLFJournalDisabled {
			return mdID, err
		}
	}

	return j.MDOps.PutUnmerged(ctx, rmd)
}

func (j journalMDOps) PruneBranch(
	ctx context.Context, id TlfID, bid BranchID) error {
	if tlfJournal, ok := j.jServer.getTLFJournal(id); ok {
		// Prune the journal, too.
		err := tlfJournal.clearMDs(ctx, bid)
		if err != nil && err != errTLFJournalDisabled {
			return err
		}
	}

	return j.MDOps.PruneBranch(ctx, id, bid)
}

func (j journalMDOps) ResolveBranch(
	ctx context.Context, id TlfID, bid BranchID,
	blocksToDelete []BlockID, rmd *RootMetadata) (MdID, error) {
	if tlfJournal, ok := j.jServer.getTLFJournal(id); ok {
		mdID, err := tlfJournal.resolveBranch(
			ctx, bid, blocksToDelete, rmd, rmd.extra)
		if err != errTLFJournalDisabled {
			return mdID, err
		}
	}

	return MdID{}, errors.New("ResolveBranch not supported outside of journal")
}
