// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/kbfsblock"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/kbfsmd"
	"github.com/keybase/kbfs/tlf"
	"golang.org/x/net/context"
	"golang.org/x/sync/errgroup"
)

// MDOpsStandard provides plaintext RootMetadata objects to upper
// layers, and processes RootMetadataSigned objects (encrypted and
// signed) suitable for passing to/from the MDServer backend.
type MDOpsStandard struct {
	config Config
	log    logger.Logger
}

// NewMDOpsStandard returns a new MDOpsStandard
func NewMDOpsStandard(config Config) *MDOpsStandard {
	return &MDOpsStandard{config, config.MakeLogger("")}
}

// convertVerifyingKeyError gives a better error when the TLF was
// signed by a key that is no longer associated with the last writer.
func (md *MDOpsStandard) convertVerifyingKeyError(ctx context.Context,
	rmds *RootMetadataSigned, handle *TlfHandle, err error) error {
	if _, ok := err.(VerifyingKeyNotFoundError); !ok {
		return err
	}

	tlf := handle.GetCanonicalPath()
	writer, nameErr := md.config.KBPKI().GetNormalizedUsername(ctx,
		rmds.MD.LastModifyingWriter().AsUserOrTeam())
	if nameErr != nil {
		writer = libkb.NormalizedUsername("uid: " +
			rmds.MD.LastModifyingWriter().String())
	}
	md.log.CDebugf(ctx, "Unverifiable update for TLF %s: %+v",
		rmds.MD.TlfID(), err)
	return UnverifiableTlfUpdateError{tlf, writer, err}
}

// CtxAllowUnverifiedKeysType is the type for a context value allowing
// for unverified keys to have signed MD updates.
type CtxAllowUnverifiedKeysType int

const (
	// CtxAllowUnverifiedKeys is set in the context when an MD update
	// is allowed to have been signed by an unverified key (e.g.,
	// because the TLF has been finalized).
	CtxAllowUnverifiedKeys CtxAllowUnverifiedKeysType = iota
)

func unverifiedKeysAllowed(ctx context.Context, handle *TlfHandle) bool {
	// TODO: technically we should only allow unverified keys if the
	// writer has been reset.  But it's pretty difficult to know which
	// users have been reset here (note that multiple users could be
	// reset at this point).
	return handle.IsFinal() || ctx.Value(CtxAllowUnverifiedKeys) != nil
}

func (md *MDOpsStandard) verifyWriterKey(ctx context.Context,
	rmds *RootMetadataSigned, handle *TlfHandle,
	getRangeLock *sync.Mutex) error {
	if !rmds.MD.IsWriterMetadataCopiedSet() {
		var err error
		if unverifiedKeysAllowed(ctx, handle) {
			err = md.config.KBPKI().HasUnverifiedVerifyingKey(ctx,
				rmds.MD.LastModifyingWriter(),
				rmds.GetWriterMetadataSigInfo().VerifyingKey)
		} else {
			err = md.config.KBPKI().HasVerifyingKey(ctx,
				rmds.MD.LastModifyingWriter(),
				rmds.GetWriterMetadataSigInfo().VerifyingKey,
				rmds.untrustedServerTimestamp)
		}
		if err != nil {
			return md.convertVerifyingKeyError(ctx, rmds, handle, err)
		}
		return nil
	}

	// The writer metadata can be copied only for rekeys or
	// finalizations, neither of which should happen while
	// unmerged.
	if rmds.MD.MergedStatus() != kbfsmd.Merged {
		return fmt.Errorf("Revision %d for %s has a copied writer "+
			"metadata, but is unexpectedly not merged",
			rmds.MD.RevisionNumber(), rmds.MD.TlfID())
	}

	if getRangeLock != nil {
		// If there are multiple goroutines, we don't want to risk
		// several concurrent requests to the MD server, just in case
		// there are several revisions with copied writer MD in this
		// range.
		//
		// TODO: bugs could result in thousands (or more) copied MD
		// updates in a row (i.e., too many to fit in the cache).  We
		// could do something more sophisticated here where once one
		// goroutine finds the copied MD, it stores it somewhere so
		// the other goroutines don't have to also search through all
		// the same MD updates (which may have been evicted from the
		// cache in the meantime).  Also, maybe copied writer MDs
		// should include the original revision number so we don't
		// have to search like this.
		getRangeLock.Lock()
		defer getRangeLock.Unlock()
	}

	if handle.IsFinal() {
		// Checks of all the predecessors should allow unverified
		// keys, since the TLF has been finalized.
		ctx = context.WithValue(ctx, CtxAllowUnverifiedKeys, "true")
	}

	// The server timestamp on rmds does not reflect when the
	// writer MD was actually signed, since it was copied from a
	// previous revision.  Search backwards for the most recent
	// uncopied writer MD to get the right timestamp.
	prevHead := rmds.MD.RevisionNumber() - 1
	for {
		startRev := prevHead - maxMDsAtATime + 1
		if startRev < kbfsmd.RevisionInitial {
			startRev = kbfsmd.RevisionInitial
		}

		// Recursively call into MDOps.  Note that in the case where
		// we were already fetching a range of MDs, this could do
		// extra work by downloading the same MDs twice (for those
		// that aren't yet in the cache).  That should be so rare that
		// it's not worth optimizing.
		prevMDs, err := getMDRange(ctx, md.config, rmds.MD.TlfID(),
			rmds.MD.BID(), startRev, prevHead, rmds.MD.MergedStatus(), nil)
		if err != nil {
			return err
		}

		for i := len(prevMDs) - 1; i >= 0; i-- {
			if !prevMDs[i].IsWriterMetadataCopiedSet() {
				// We want to compare the writer signature of
				// rmds with that of prevMDs[i]. However, we've
				// already dropped prevMDs[i]'s writer
				// signature. We can just verify prevMDs[i]'s
				// writer metadata with rmds's signature,
				// though.
				buf, err := prevMDs[i].GetSerializedWriterMetadata(md.config.Codec())
				if err != nil {
					return err
				}

				err = kbfscrypto.Verify(
					buf, rmds.GetWriterMetadataSigInfo())
				if err != nil {
					return fmt.Errorf("Could not verify "+
						"uncopied writer metadata "+
						"from revision %d of folder "+
						"%s with signature from "+
						"revision %d: %v",
						prevMDs[i].Revision(),
						rmds.MD.TlfID(),
						rmds.MD.RevisionNumber(), err)
				}

				// The fact the fact that we were able to process this
				// MD correctly means that we already verified its key
				// at the correct timestamp, so we're good.
				return nil
			}
		}

		// No more MDs left to process.
		if len(prevMDs) < maxMDsAtATime {
			return fmt.Errorf("Couldn't find uncopied MD previous to "+
				"revision %d of folder %s for checking the writer "+
				"timestamp", rmds.MD.RevisionNumber(), rmds.MD.TlfID())
		}
		prevHead = prevMDs[0].Revision() - 1
	}
}

type everyoneOnEveryTeamChecker struct{}

func (e everyoneOnEveryTeamChecker) IsTeamWriter(
	_ context.Context, _ keybase1.TeamID, _ keybase1.UID,
	_ kbfscrypto.VerifyingKey) (bool, error) {
	return true, nil
}

func (e everyoneOnEveryTeamChecker) IsTeamReader(
	_ context.Context, _ keybase1.TeamID, _ keybase1.UID) (bool, error) {
	return true, nil
}

// processMetadata converts the given rmds to an
// ImmutableRootMetadata. After this function is called, rmds
// shouldn't be used.
func (md *MDOpsStandard) processMetadata(ctx context.Context,
	handle *TlfHandle, rmds *RootMetadataSigned, extra kbfsmd.ExtraMetadata,
	getRangeLock *sync.Mutex) (ImmutableRootMetadata, error) {
	// First, verify validity and signatures. Until KBFS-2229 is
	// complete, KBFS doesn't check for team membership on MDs that
	// have been fetched from the server, because if the writer has
	// been removed from the team since the MD was written, we have no
	// easy way of verifying that they used to be in the team.  We
	// rely on the fact that the updates are decryptable with the
	// secret key as a way to prove that only an authorized team
	// member wrote the update, along with trusting that the server
	// would have rejected an update from a former team member that is
	// still using an old key.  TODO(KBFS-2229): remove this.
	err := rmds.IsValidAndSigned(
		ctx, md.config.Codec(),
		everyoneOnEveryTeamChecker{}, extra)
	if err != nil {
		return ImmutableRootMetadata{}, MDMismatchError{
			rmds.MD.RevisionNumber(), handle.GetCanonicalPath(),
			rmds.MD.TlfID(), err,
		}
	}

	// Then, verify the verifying keys.
	if err := md.verifyWriterKey(ctx, rmds, handle, getRangeLock); err != nil {
		return ImmutableRootMetadata{}, err
	}

	if unverifiedKeysAllowed(ctx, handle) {
		err = md.config.KBPKI().HasUnverifiedVerifyingKey(
			ctx, rmds.MD.GetLastModifyingUser(),
			rmds.SigInfo.VerifyingKey)
	} else {
		err = md.config.KBPKI().HasVerifyingKey(
			ctx, rmds.MD.GetLastModifyingUser(),
			rmds.SigInfo.VerifyingKey,
			rmds.untrustedServerTimestamp)
	}
	if err != nil {
		return ImmutableRootMetadata{}, md.convertVerifyingKeyError(ctx, rmds, handle, err)
	}

	// Get the UID unless this is a public tlf - then proceed with empty uid.
	var uid keybase1.UID
	if handle.Type() != tlf.Public {
		session, err := md.config.KBPKI().GetCurrentSession(ctx)
		if err != nil {
			return ImmutableRootMetadata{}, err
		}
		uid = session.UID
	}

	// TODO: Avoid having to do this type assertion.
	brmd, ok := rmds.MD.(kbfsmd.MutableRootMetadata)
	if !ok {
		return ImmutableRootMetadata{}, kbfsmd.MutableRootMetadataNoImplError{}
	}

	rmd := makeRootMetadata(brmd, extra, handle)
	// Try to decrypt using the keys available in this md.  If that
	// doesn't work, a future MD may contain more keys and will be
	// tried later.
	pmd, err := decryptMDPrivateData(
		ctx, md.config.Codec(), md.config.Crypto(),
		md.config.BlockCache(), md.config.BlockOps(),
		md.config.KeyManager(), md.config.Mode(), uid,
		rmd.GetSerializedPrivateMetadata(), rmd, rmd, md.log)
	if err != nil {
		return ImmutableRootMetadata{}, err
	}
	rmd.data = pmd

	mdID, err := kbfsmd.MakeID(md.config.Codec(), rmd.bareMd)
	if err != nil {
		return ImmutableRootMetadata{}, err
	}

	localTimestamp := rmds.untrustedServerTimestamp
	if offset, ok := md.config.MDServer().OffsetFromServerTime(); ok {
		localTimestamp = localTimestamp.Add(offset)
	}

	key := rmds.GetWriterMetadataSigInfo().VerifyingKey
	*rmds = RootMetadataSigned{}
	irmd := MakeImmutableRootMetadata(rmd, key, mdID, localTimestamp, true)

	err = md.config.MDCache().Put(irmd)
	if err != nil {
		return ImmutableRootMetadata{}, err
	}
	return irmd, nil
}

// GetForHandle implements the MDOps interface for MDOpsStandard.
// TODO: unexport this when no longer part of the MDOps interface.
func (md *MDOpsStandard) GetForHandle(ctx context.Context, handle *TlfHandle,
	mStatus kbfsmd.MergeStatus, lockBeforeGet *keybase1.LockID) (
	id tlf.ID, rmd ImmutableRootMetadata, err error) {
	// If we already know the tlf ID, we shouldn't be calling this
	// function.
	if handle.tlfID != tlf.NullID {
		return tlf.ID{}, ImmutableRootMetadata{}, fmt.Errorf(
			"GetForHandle called for %s with non-nil TLF ID %s",
			handle.GetCanonicalPath(), handle.tlfID)
	}

	// Check for handle readership, to give a nice error early.
	if handle.Type() == tlf.Private {
		session, err := md.config.KBPKI().GetCurrentSession(ctx)
		if err != nil {
			return tlf.ID{}, ImmutableRootMetadata{}, err
		}

		if !handle.IsReader(session.UID) {
			return tlf.ID{}, ImmutableRootMetadata{}, NewReadAccessError(
				handle, session.Name, handle.GetCanonicalPath())
		}
	}

	md.log.CDebugf(
		ctx, "GetForHandle: %s %s", handle.GetCanonicalPath(), mStatus)
	defer func() {
		// Temporary debugging for KBFS-1921.  TODO: remove.
		if err != nil {
			md.log.CDebugf(ctx, "GetForHandle done with err=%+v", err)
		} else if rmd != (ImmutableRootMetadata{}) {
			md.log.CDebugf(ctx, "GetForHandle done, id=%s, revision=%d, "+
				"mStatus=%s", id, rmd.Revision(), rmd.MergedStatus())
		} else {
			md.log.CDebugf(
				ctx, "GetForHandle done, id=%s, no %s MD revisions yet", id,
				mStatus)
		}
	}()

	mdserv := md.config.MDServer()
	bh, err := handle.ToBareHandle()
	if err != nil {
		return tlf.ID{}, ImmutableRootMetadata{}, err
	}

	id, rmds, err := mdserv.GetForHandle(ctx, bh, mStatus, lockBeforeGet)
	if err != nil {
		return tlf.ID{}, ImmutableRootMetadata{}, err
	}

	if rmds == nil {
		if mStatus == kbfsmd.Unmerged {
			// The caller ignores the id argument for
			// mStatus == kbfsmd.Unmerged.
			return tlf.ID{}, ImmutableRootMetadata{}, nil
		}
		return id, ImmutableRootMetadata{}, nil
	}

	extra, err := md.getExtraMD(ctx, rmds.MD)
	if err != nil {
		return tlf.ID{}, ImmutableRootMetadata{}, err
	}

	bareMdHandle, err := rmds.MD.MakeBareTlfHandle(extra)
	if err != nil {
		return tlf.ID{}, ImmutableRootMetadata{}, err
	}

	mdHandle, err := MakeTlfHandle(ctx, bareMdHandle, md.config.KBPKI(), nil)
	if err != nil {
		return tlf.ID{}, ImmutableRootMetadata{}, err
	}

	// Check for mutual handle resolution.
	if err := mdHandle.MutuallyResolvesTo(ctx, md.config.Codec(),
		md.config.KBPKI(), nil, *handle, rmds.MD.RevisionNumber(),
		rmds.MD.TlfID(), md.log); err != nil {
		return tlf.ID{}, ImmutableRootMetadata{}, err
	}
	// Set the ID after checking the resolve, because `handle` doesn't
	// have the TLF ID set yet.
	mdHandle.tlfID = id

	// TODO: For now, use the mdHandle that came with rmds for
	// consistency. In the future, we'd want to eventually notify
	// the upper layers of the new name, either directly, or
	// through a rekey.
	rmd, err = md.processMetadata(ctx, mdHandle, rmds, extra, nil)
	if err != nil {
		return tlf.ID{}, ImmutableRootMetadata{}, err
	}

	return id, rmd, nil
}

// GetIDForHandle implements the MDOps interface for MDOpsStandard.
func (md *MDOpsStandard) GetIDForHandle(
	ctx context.Context, handle *TlfHandle) (id tlf.ID, err error) {
	// TODO: use a local, trusted, on-disk handle->ID cache to avoid
	// an RTT here?
	id, _, err = md.GetForHandle(ctx, handle, kbfsmd.Merged, nil)
	return id, err
}

func (md *MDOpsStandard) processMetadataWithID(ctx context.Context,
	id tlf.ID, bid kbfsmd.BranchID, handle *TlfHandle, rmds *RootMetadataSigned,
	extra kbfsmd.ExtraMetadata, getRangeLock *sync.Mutex) (ImmutableRootMetadata, error) {
	// Make sure the signed-over ID matches
	if id != rmds.MD.TlfID() {
		return ImmutableRootMetadata{}, MDMismatchError{
			rmds.MD.RevisionNumber(), id.String(), rmds.MD.TlfID(),
			fmt.Errorf("MD contained unexpected folder id %s, expected %s",
				rmds.MD.TlfID().String(), id.String()),
		}
	}
	// Make sure the signed-over branch ID matches
	if bid != kbfsmd.NullBranchID && bid != rmds.MD.BID() {
		return ImmutableRootMetadata{}, MDMismatchError{
			rmds.MD.RevisionNumber(), id.String(), rmds.MD.TlfID(),
			fmt.Errorf("MD contained unexpected branch id %s, expected %s, "+
				"folder id %s", rmds.MD.BID().String(), bid.String(), id.String()),
		}
	}

	return md.processMetadata(ctx, handle, rmds, extra, getRangeLock)
}

type constIDGetter struct {
	id tlf.ID
}

func (c constIDGetter) GetIDForHandle(_ context.Context, _ *TlfHandle) (
	tlf.ID, error) {
	return c.id, nil
}

func (md *MDOpsStandard) getForTLF(ctx context.Context, id tlf.ID,
	bid kbfsmd.BranchID, mStatus kbfsmd.MergeStatus, lockBeforeGet *keybase1.LockID) (
	ImmutableRootMetadata, error) {
	rmds, err := md.config.MDServer().GetForTLF(
		ctx, id, bid, mStatus, lockBeforeGet)
	if err != nil {
		return ImmutableRootMetadata{}, err
	}
	if rmds == nil {
		// Possible if mStatus is kbfsmd.Unmerged
		return ImmutableRootMetadata{}, nil
	}
	extra, err := md.getExtraMD(ctx, rmds.MD)
	if err != nil {
		return ImmutableRootMetadata{}, err
	}
	bareHandle, err := rmds.MD.MakeBareTlfHandle(extra)
	if err != nil {
		return ImmutableRootMetadata{}, err
	}
	handle, err := MakeTlfHandle(
		ctx, bareHandle, md.config.KBPKI(), constIDGetter{id})
	if err != nil {
		return ImmutableRootMetadata{}, err
	}
	rmd, err := md.processMetadataWithID(ctx, id, bid, handle, rmds, extra, nil)
	if err != nil {
		return ImmutableRootMetadata{}, err
	}
	return rmd, nil
}

// GetForTLF implements the MDOps interface for MDOpsStandard.
func (md *MDOpsStandard) GetForTLF(
	ctx context.Context, id tlf.ID, lockBeforeGet *keybase1.LockID) (
	ImmutableRootMetadata, error) {
	return md.getForTLF(ctx, id, kbfsmd.NullBranchID, kbfsmd.Merged, lockBeforeGet)
}

// GetUnmergedForTLF implements the MDOps interface for MDOpsStandard.
func (md *MDOpsStandard) GetUnmergedForTLF(
	ctx context.Context, id tlf.ID, bid kbfsmd.BranchID) (
	ImmutableRootMetadata, error) {
	return md.getForTLF(ctx, id, bid, kbfsmd.Unmerged, nil)
}

func (md *MDOpsStandard) processRange(ctx context.Context, id tlf.ID,
	bid kbfsmd.BranchID, rmdses []*RootMetadataSigned) (
	[]ImmutableRootMetadata, error) {
	if len(rmdses) == 0 {
		return nil, nil
	}

	eg, groupCtx := errgroup.WithContext(ctx)

	// Parallelize the MD decryption, because it could involve
	// fetching blocks to get unembedded block changes.
	rmdsChan := make(chan *RootMetadataSigned, len(rmdses))
	irmdChan := make(chan ImmutableRootMetadata, len(rmdses))
	var getRangeLock sync.Mutex
	worker := func() error {
		for rmds := range rmdsChan {
			extra, err := md.getExtraMD(groupCtx, rmds.MD)
			if err != nil {
				return err
			}
			bareHandle, err := rmds.MD.MakeBareTlfHandle(extra)
			if err != nil {
				return err
			}
			handle, err := MakeTlfHandle(
				groupCtx, bareHandle, md.config.KBPKI(), constIDGetter{id})
			if err != nil {
				return err
			}
			irmd, err := md.processMetadataWithID(groupCtx, id, bid,
				handle, rmds, extra, &getRangeLock)
			if err != nil {
				return err
			}
			irmdChan <- irmd
		}
		return nil
	}

	numWorkers := len(rmdses)
	if numWorkers > maxMDsAtATime {
		numWorkers = maxMDsAtATime
	}
	for i := 0; i < numWorkers; i++ {
		eg.Go(worker)
	}

	// Do this first, since processMetadataWithID consumes its
	// rmds argument.
	startRev := rmdses[0].MD.RevisionNumber()
	rmdsCount := len(rmdses)

	for _, rmds := range rmdses {
		rmdsChan <- rmds
	}
	close(rmdsChan)
	rmdses = nil
	err := eg.Wait()
	if err != nil {
		return nil, err
	}
	close(irmdChan)

	// Sort into slice based on revision.
	irmds := make([]ImmutableRootMetadata, rmdsCount)
	numExpected := kbfsmd.Revision(len(irmds))
	for irmd := range irmdChan {
		i := irmd.Revision() - startRev
		if i < 0 || i >= numExpected {
			return nil, fmt.Errorf("Unexpected revision %d; expected "+
				"something between %d and %d inclusive", irmd.Revision(),
				startRev, startRev+numExpected-1)
		} else if irmds[i] != (ImmutableRootMetadata{}) {
			return nil, fmt.Errorf("Got revision %d twice", irmd.Revision())
		}
		irmds[i] = irmd
	}

	// Now that we have all the immutable RootMetadatas, verify that
	// the given MD objects form a valid sequence.
	var prevIRMD ImmutableRootMetadata
	for _, irmd := range irmds {
		if prevIRMD != (ImmutableRootMetadata{}) {
			// Ideally, we'd call
			// ReadOnlyRootMetadata.CheckValidSuccessor()
			// instead. However, we only convert r.MD to
			// an ImmutableRootMetadata in
			// processMetadataWithID below, and we want to
			// do this check before then.
			err = prevIRMD.bareMd.CheckValidSuccessor(
				prevIRMD.mdID, irmd.bareMd)
			if err != nil {
				return nil, MDMismatchError{
					prevIRMD.Revision(),
					irmd.GetTlfHandle().GetCanonicalPath(),
					prevIRMD.TlfID(), err,
				}
			}
		}
		prevIRMD = irmd
	}

	// TODO: in the case where lastRoot == MdID{}, should we verify
	// that the starting PrevRoot points back to something that's
	// actually a valid part of this history?  If the MD signature is
	// indeed valid, this probably isn't a huge deal, but it may let
	// the server rollback or truncate unmerged history...

	return irmds, nil
}

func (md *MDOpsStandard) getRange(ctx context.Context, id tlf.ID,
	bid kbfsmd.BranchID, mStatus kbfsmd.MergeStatus, start, stop kbfsmd.Revision,
	lockBeforeGet *keybase1.LockID) ([]ImmutableRootMetadata, error) {
	rmds, err := md.config.MDServer().GetRange(
		ctx, id, bid, mStatus, start, stop, lockBeforeGet)
	if err != nil {
		return nil, err
	}
	rmd, err := md.processRange(ctx, id, bid, rmds)
	if err != nil {
		return nil, err
	}
	return rmd, nil
}

// GetRange implements the MDOps interface for MDOpsStandard.
func (md *MDOpsStandard) GetRange(ctx context.Context, id tlf.ID,
	start, stop kbfsmd.Revision, lockBeforeGet *keybase1.LockID) (
	[]ImmutableRootMetadata, error) {
	return md.getRange(
		ctx, id, kbfsmd.NullBranchID, kbfsmd.Merged, start, stop, lockBeforeGet)
}

// GetUnmergedRange implements the MDOps interface for MDOpsStandard.
func (md *MDOpsStandard) GetUnmergedRange(ctx context.Context, id tlf.ID,
	bid kbfsmd.BranchID, start, stop kbfsmd.Revision) (
	[]ImmutableRootMetadata, error) {
	return md.getRange(ctx, id, bid, kbfsmd.Unmerged, start, stop, nil)
}

func (md *MDOpsStandard) put(ctx context.Context, rmd *RootMetadata,
	verifyingKey kbfscrypto.VerifyingKey, lockContext *keybase1.LockContext,
	priority keybase1.MDPriority) (ImmutableRootMetadata, error) {
	session, err := md.config.KBPKI().GetCurrentSession(ctx)
	if err != nil {
		return ImmutableRootMetadata{}, err
	}

	// Ensure that the block changes are properly unembedded.
	if !rmd.IsWriterMetadataCopiedSet() &&
		rmd.data.Changes.Info.BlockPointer == zeroPtr &&
		!md.config.BlockSplitter().ShouldEmbedBlockChanges(&rmd.data.Changes) {
		return ImmutableRootMetadata{},
			errors.New("MD has embedded block changes, but shouldn't")
	}

	err = encryptMDPrivateData(
		ctx, md.config.Codec(), md.config.Crypto(),
		md.config.Crypto(), md.config.KeyManager(), session.UID, rmd)
	if err != nil {
		return ImmutableRootMetadata{}, err
	}

	rmds, err := SignBareRootMetadata(
		ctx, md.config.Codec(), md.config.Crypto(), md.config.Crypto(),
		rmd.bareMd, time.Time{})
	if err != nil {
		return ImmutableRootMetadata{}, err
	}

	err = md.config.MDServer().Put(ctx, rmds, rmd.extra, lockContext, priority)
	if err != nil {
		return ImmutableRootMetadata{}, err
	}

	mdID, err := kbfsmd.MakeID(md.config.Codec(), rmds.MD)
	if err != nil {
		return ImmutableRootMetadata{}, err
	}

	irmd := MakeImmutableRootMetadata(
		rmd, verifyingKey, mdID, md.config.Clock().Now(), true)
	// Revisions created locally should always override anything else
	// in the cache.
	err = md.config.MDCache().Replace(irmd, irmd.BID())
	if err != nil {
		return ImmutableRootMetadata{}, err
	}
	md.log.CDebugf(ctx, "Put MD rev=%d id=%s", rmd.Revision(), mdID)

	return irmd, nil
}

// Put implements the MDOps interface for MDOpsStandard.
func (md *MDOpsStandard) Put(ctx context.Context, rmd *RootMetadata,
	verifyingKey kbfscrypto.VerifyingKey, lockContext *keybase1.LockContext,
	priority keybase1.MDPriority) (ImmutableRootMetadata, error) {
	if rmd.MergedStatus() == kbfsmd.Unmerged {
		return ImmutableRootMetadata{}, UnexpectedUnmergedPutError{}
	}
	return md.put(ctx, rmd, verifyingKey, lockContext, priority)
}

// PutUnmerged implements the MDOps interface for MDOpsStandard.
func (md *MDOpsStandard) PutUnmerged(
	ctx context.Context, rmd *RootMetadata,
	verifyingKey kbfscrypto.VerifyingKey) (ImmutableRootMetadata, error) {
	rmd.SetUnmerged()
	if rmd.BID() == kbfsmd.NullBranchID {
		// new branch ID
		bid, err := md.config.Crypto().MakeRandomBranchID()
		if err != nil {
			return ImmutableRootMetadata{}, err
		}
		rmd.SetBranchID(bid)
	}
	return md.put(ctx, rmd, verifyingKey, nil, keybase1.MDPriorityNormal)
}

// PruneBranch implements the MDOps interface for MDOpsStandard.
func (md *MDOpsStandard) PruneBranch(
	ctx context.Context, id tlf.ID, bid kbfsmd.BranchID) error {
	return md.config.MDServer().PruneBranch(ctx, id, bid)
}

// ResolveBranch implements the MDOps interface for MDOpsStandard.
func (md *MDOpsStandard) ResolveBranch(
	ctx context.Context, id tlf.ID, bid kbfsmd.BranchID, _ []kbfsblock.ID,
	rmd *RootMetadata, verifyingKey kbfscrypto.VerifyingKey) (
	ImmutableRootMetadata, error) {
	// Put the MD first.
	irmd, err := md.Put(ctx, rmd, verifyingKey, nil, keybase1.MDPriorityNormal)
	if err != nil {
		return ImmutableRootMetadata{}, err
	}

	// Prune the branch ia the journal, if there is one.  If the
	// client fails before this is completed, we'll need to check for
	// resolutions on the next restart (see KBFS-798).
	err = md.PruneBranch(ctx, id, bid)
	if err != nil {
		return ImmutableRootMetadata{}, err
	}
	return irmd, nil
}

// GetLatestHandleForTLF implements the MDOps interface for MDOpsStandard.
func (md *MDOpsStandard) GetLatestHandleForTLF(ctx context.Context, id tlf.ID) (
	tlf.Handle, error) {
	// TODO: Verify this mapping using a Merkle tree.
	return md.config.MDServer().GetLatestHandleForTLF(ctx, id)
}

func (md *MDOpsStandard) getExtraMD(ctx context.Context, brmd kbfsmd.RootMetadata) (
	extra kbfsmd.ExtraMetadata, err error) {
	wkbID, rkbID := brmd.GetTLFWriterKeyBundleID(), brmd.GetTLFReaderKeyBundleID()
	if (wkbID == kbfsmd.TLFWriterKeyBundleID{}) || (rkbID == kbfsmd.TLFReaderKeyBundleID{}) {
		// Pre-v3 metadata embed key bundles and as such won't set any IDs.
		return nil, nil
	}
	mdserv := md.config.MDServer()
	kbcache := md.config.KeyBundleCache()
	tlf := brmd.TlfID()
	// Check the cache.
	wkb, err2 := kbcache.GetTLFWriterKeyBundle(wkbID)
	if err2 != nil {
		md.log.CDebugf(ctx, "Error fetching writer key bundle %s from cache for TLF %s: %s",
			wkbID, tlf, err2)
	}
	rkb, err2 := kbcache.GetTLFReaderKeyBundle(rkbID)
	if err2 != nil {
		md.log.CDebugf(ctx, "Error fetching reader key bundle %s from cache for TLF %s: %s",
			rkbID, tlf, err2)
	}
	if wkb != nil && rkb != nil {
		return kbfsmd.NewExtraMetadataV3(*wkb, *rkb, false, false), nil
	}
	if wkb != nil {
		// Don't need the writer bundle.
		_, rkb, err = mdserv.GetKeyBundles(ctx, tlf, kbfsmd.TLFWriterKeyBundleID{}, rkbID)
	} else if rkb != nil {
		// Don't need the reader bundle.
		wkb, _, err = mdserv.GetKeyBundles(ctx, tlf, wkbID, kbfsmd.TLFReaderKeyBundleID{})
	} else {
		// Need them both.
		wkb, rkb, err = mdserv.GetKeyBundles(ctx, tlf, wkbID, rkbID)
	}
	if err != nil {
		return nil, err
	}
	// Cache the results.
	kbcache.PutTLFWriterKeyBundle(wkbID, *wkb)
	kbcache.PutTLFReaderKeyBundle(rkbID, *rkb)
	return kbfsmd.NewExtraMetadataV3(*wkb, *rkb, false, false), nil
}
