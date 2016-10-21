// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"errors"
	"fmt"
	"sync"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/kbfs/kbfscodec"
	"golang.org/x/net/context"
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
	if _, ok := err.(KeyNotFoundError); !ok {
		return err
	}

	tlf := handle.GetCanonicalPath()
	writer, nameErr := md.config.KBPKI().GetNormalizedUsername(ctx,
		rmds.MD.LastModifyingWriter())
	if nameErr != nil {
		writer = libkb.NormalizedUsername("uid: " +
			rmds.MD.LastModifyingWriter().String())
	}
	md.log.CDebugf(ctx, "Unverifiable update for TLF %s", rmds.MD.TlfID())
	return UnverifiableTlfUpdateError{tlf, writer, err}
}

func (md *MDOpsStandard) verifyWriterKey(ctx context.Context,
	rmds *RootMetadataSigned, handle *TlfHandle,
	getRangeLock *sync.Mutex) error {
	if !rmds.MD.IsWriterMetadataCopiedSet() {
		var err error
		if handle.IsFinal() {
			err = md.config.KBPKI().HasUnverifiedVerifyingKey(ctx,
				rmds.MD.LastModifyingWriter(),
				rmds.MD.GetWriterMetadataSigInfo().VerifyingKey)
		} else {
			err = md.config.KBPKI().HasVerifyingKey(ctx,
				rmds.MD.LastModifyingWriter(),
				rmds.MD.GetWriterMetadataSigInfo().VerifyingKey,
				rmds.untrustedServerTimestamp)
		}
		if err != nil {
			return md.convertVerifyingKeyError(ctx, rmds, handle, err)
		}
		return nil

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

	// The server timestamp on rmds does not reflect when the
	// writer MD was actually signed, since it was copied from a
	// previous revision.  Search backwards for the most recent
	// uncopied writer MD to get the right timestamp.
	prevHead := rmds.MD.RevisionNumber() - 1
	for {
		startRev := prevHead - maxMDsAtATime + 1
		if startRev < MetadataRevisionInitial {
			startRev = MetadataRevisionInitial
		}

		// Recursively call into MDOps.  Note that in the case where
		// we were already fetching a range of MDs, this could do
		// extra work by downloading the same MDs twice (for those
		// that aren't yet in the cache).  That should be so rare that
		// it's not worth optimizing.
		prevMDs, err := getMDRange(ctx, md.config, rmds.MD.TlfID(), rmds.MD.BID(),
			startRev, prevHead, rmds.MD.MergedStatus())
		if err != nil {
			return err
		}

		for i := len(prevMDs) - 1; i >= 0; i-- {
			if !prevMDs[i].IsWriterMetadataCopiedSet() {
				ok, err := kbfscodec.Equal(md.config.Codec(),
					rmds.MD.GetWriterMetadataSigInfo(),
					prevMDs[i].GetWriterMetadataSigInfo())
				if err != nil {
					return err
				}
				if !ok {
					return fmt.Errorf("Previous uncopied writer MD sig info "+
						"for revision %d of folder %s doesn't match copied "+
						"revision %d", prevMDs[i].Revision(), rmds.MD.TlfID(),
						rmds.MD.RevisionNumber())
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

func (md *MDOpsStandard) processMetadata(ctx context.Context,
	handle *TlfHandle, rmds *RootMetadataSigned, extra ExtraMetadata,
	getRangeLock *sync.Mutex) (ImmutableRootMetadata, error) {
	// First, verify validity and signatures.
	err := rmds.IsValidAndSigned(md.config.Codec(), md.config.Crypto(), extra)
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

	if handle.IsFinal() {
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

	rmd := RootMetadata{
		bareMd:    rmds.MD,
		tlfHandle: handle,
		extra:     extra,
	}

	_, uid, err := md.config.KBPKI().GetCurrentUserInfo(ctx)
	if err != nil {
		// If this is a public folder, it's ok to proceed if we have
		// no current session.
		if _, ok := err.(NoCurrentSessionError); ok && !handle.IsPublic() {
			return ImmutableRootMetadata{}, err
		} else if !ok {
			return ImmutableRootMetadata{}, err
		}
	}

	// Try to decrypt using the keys available in this md.  If that
	// doesn't work, a future MD may contain more keys and will be
	// tried later.
	err = decryptMDPrivateData(
		ctx, md.config.Codec(), md.config.Crypto(), md.config.BlockCache(),
		md.config.BlockOps(), md.config.KeyManager(), uid, &rmd, rmd.ReadOnly())
	if err != nil {
		return ImmutableRootMetadata{}, err
	}

	mdID, err := md.config.Crypto().MakeMdID(rmd.bareMd)
	if err != nil {
		return ImmutableRootMetadata{}, err
	}

	localTimestamp := rmds.untrustedServerTimestamp
	if offset, ok := md.config.MDServer().OffsetFromServerTime(); ok {
		localTimestamp = localTimestamp.Add(offset)
	}

	return MakeImmutableRootMetadata(&rmd, mdID, localTimestamp), nil
}

// GetForHandle implements the MDOps interface for MDOpsStandard.
func (md *MDOpsStandard) GetForHandle(ctx context.Context, handle *TlfHandle,
	mStatus MergeStatus) (TlfID, ImmutableRootMetadata, error) {
	mdserv := md.config.MDServer()
	bh, err := handle.ToBareHandle()
	if err != nil {
		return TlfID{}, ImmutableRootMetadata{}, err
	}

	id, rmds, err := mdserv.GetForHandle(ctx, bh, mStatus)
	if err != nil {
		return TlfID{}, ImmutableRootMetadata{}, err
	}

	if rmds == nil {
		if mStatus == Unmerged {
			// The caller ignores the id argument for
			// mStatus == Unmerged.
			return TlfID{}, ImmutableRootMetadata{}, nil
		}
		return id, ImmutableRootMetadata{}, nil
	}

	extra, err := md.getExtraMD(ctx, rmds.MD)
	if err != nil {
		return TlfID{}, ImmutableRootMetadata{}, err
	}

	bareMdHandle, err := rmds.MD.MakeBareTlfHandle(extra)
	if err != nil {
		return TlfID{}, ImmutableRootMetadata{}, err
	}

	mdHandle, err := MakeTlfHandle(ctx, bareMdHandle, md.config.KBPKI())
	if err != nil {
		return TlfID{}, ImmutableRootMetadata{}, err
	}

	// Check for mutual handle resolution.
	if err := mdHandle.MutuallyResolvesTo(ctx, md.config.Codec(),
		md.config.KBPKI(), *handle, rmds.MD.RevisionNumber(), rmds.MD.TlfID(),
		md.log); err != nil {
		return TlfID{}, ImmutableRootMetadata{}, err
	}

	// TODO: For now, use the mdHandle that came with rmds for
	// consistency. In the future, we'd want to eventually notify
	// the upper layers of the new name, either directly, or
	// through a rekey.
	rmd, err := md.processMetadata(ctx, mdHandle, rmds, extra, nil)
	if err != nil {
		return TlfID{}, ImmutableRootMetadata{}, err
	}

	return id, rmd, nil
}

func (md *MDOpsStandard) processMetadataWithID(ctx context.Context,
	id TlfID, bid BranchID, handle *TlfHandle, rmds *RootMetadataSigned,
	extra ExtraMetadata, getRangeLock *sync.Mutex) (ImmutableRootMetadata, error) {
	// Make sure the signed-over ID matches
	if id != rmds.MD.TlfID() {
		return ImmutableRootMetadata{}, MDMismatchError{
			rmds.MD.RevisionNumber(), id.String(), rmds.MD.TlfID(),
			fmt.Errorf("MD contained unexpected folder id %s, expected %s",
				rmds.MD.TlfID().String(), id.String()),
		}
	}
	// Make sure the signed-over branch ID matches
	if bid != NullBranchID && bid != rmds.MD.BID() {
		return ImmutableRootMetadata{}, MDMismatchError{
			rmds.MD.RevisionNumber(), id.String(), rmds.MD.TlfID(),
			fmt.Errorf("MD contained unexpected branch id %s, expected %s, "+
				"folder id %s", rmds.MD.BID().String(), bid.String(), id.String()),
		}
	}

	return md.processMetadata(ctx, handle, rmds, extra, getRangeLock)
}

func (md *MDOpsStandard) getForTLF(ctx context.Context, id TlfID,
	bid BranchID, mStatus MergeStatus) (ImmutableRootMetadata, error) {
	rmds, err := md.config.MDServer().GetForTLF(ctx, id, bid, mStatus)
	if err != nil {
		return ImmutableRootMetadata{}, err
	}
	if rmds == nil {
		// Possible if mStatus is Unmerged
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
	handle, err := MakeTlfHandle(ctx, bareHandle, md.config.KBPKI())
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
func (md *MDOpsStandard) GetForTLF(ctx context.Context, id TlfID) (
	ImmutableRootMetadata, error) {
	return md.getForTLF(ctx, id, NullBranchID, Merged)
}

// GetUnmergedForTLF implements the MDOps interface for MDOpsStandard.
func (md *MDOpsStandard) GetUnmergedForTLF(
	ctx context.Context, id TlfID, bid BranchID) (
	ImmutableRootMetadata, error) {
	return md.getForTLF(ctx, id, bid, Unmerged)
}

func (md *MDOpsStandard) processRange(ctx context.Context, id TlfID,
	bid BranchID, rmdses []*RootMetadataSigned) (
	[]ImmutableRootMetadata, error) {
	if len(rmdses) == 0 {
		return nil, nil
	}

	var wg sync.WaitGroup
	numWorkers := len(rmdses)
	if numWorkers > maxMDsAtATime {
		numWorkers = maxMDsAtATime
	}
	wg.Add(numWorkers)

	// Parallelize the MD decryption, because it could involve
	// fetching blocks to get unembedded block changes.
	rmdsChan := make(chan *RootMetadataSigned, len(rmdses))
	irmdChan := make(chan ImmutableRootMetadata, len(rmdses))
	errChan := make(chan error, 1)
	var getRangeLock sync.Mutex
	worker := func() {
		defer wg.Done()
		for rmds := range rmdsChan {
			extra, err := md.getExtraMD(ctx, rmds.MD)
			if err != nil {
				select {
				case errChan <- err:
				default:
				}
				return
			}
			bareHandle, err := rmds.MD.MakeBareTlfHandle(extra)
			if err != nil {
				select {
				case errChan <- err:
				default:
				}
				return
			}
			handle, err := MakeTlfHandle(ctx, bareHandle, md.config.KBPKI())
			if err != nil {
				select {
				case errChan <- err:
				default:
				}
				return
			}
			irmd, err := md.processMetadataWithID(ctx, id, bid,
				handle, rmds, extra, &getRangeLock)
			if err != nil {
				select {
				case errChan <- err:
				default:
				}
				return
			}
			irmdChan <- irmd
		}
	}

	for i := 0; i < numWorkers; i++ {
		go worker()
	}
	for _, rmds := range rmdses {
		rmdsChan <- rmds
	}
	close(rmdsChan)
	go func() {
		wg.Wait()
		close(errChan)
		close(irmdChan)
	}()
	err := <-errChan
	if err != nil {
		return nil, err
	}

	// Sort into slice based on revision.
	irmds := make([]ImmutableRootMetadata, len(rmdses))
	startRev := rmdses[0].MD.RevisionNumber()
	numExpected := MetadataRevision(len(irmds))
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

func (md *MDOpsStandard) getRange(ctx context.Context, id TlfID,
	bid BranchID, mStatus MergeStatus, start, stop MetadataRevision) (
	[]ImmutableRootMetadata, error) {
	rmds, err := md.config.MDServer().GetRange(
		ctx, id, bid, mStatus, start, stop)
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
func (md *MDOpsStandard) GetRange(ctx context.Context, id TlfID,
	start, stop MetadataRevision) ([]ImmutableRootMetadata, error) {
	return md.getRange(ctx, id, NullBranchID, Merged, start, stop)
}

// GetUnmergedRange implements the MDOps interface for MDOpsStandard.
func (md *MDOpsStandard) GetUnmergedRange(ctx context.Context, id TlfID,
	bid BranchID, start, stop MetadataRevision) ([]ImmutableRootMetadata, error) {
	return md.getRange(ctx, id, bid, Unmerged, start, stop)
}

func (md *MDOpsStandard) put(
	ctx context.Context, rmd *RootMetadata) (MdID, error) {
	_, me, err := md.config.KBPKI().GetCurrentUserInfo(ctx)
	if err != nil {
		return MdID{}, err
	}

	// Ensure that the block changes are properly unembedded.
	if !rmd.IsWriterMetadataCopiedSet() &&
		rmd.data.Changes.Info.BlockPointer == zeroPtr &&
		!md.config.BlockSplitter().ShouldEmbedBlockChanges(&rmd.data.Changes) {
		return MdID{},
			errors.New("MD has embedded block changes, but shouldn't")
	}

	brmd, err := encryptMDPrivateData(
		ctx, md.config.Codec(), md.config.Crypto(),
		md.config.Crypto(), md.config.KeyManager(), me, rmd.ReadOnly())
	if err != nil {
		return MdID{}, err
	}

	mbrmd, ok := brmd.(MutableBareRootMetadata)
	if !ok {
		return MdID{}, MutableBareRootMetadataNoImplError{}
	}

	rmds := RootMetadataSigned{MD: mbrmd}

	err = signMD(ctx, md.config.Codec(), md.config.Crypto(), &rmds)
	if err != nil {
		return MdID{}, err
	}

	err = md.config.MDServer().Put(ctx, &rmds, rmd.extra)
	if err != nil {
		return MdID{}, err
	}

	mdID, err := md.config.Crypto().MakeMdID(rmds.MD)
	if err != nil {
		return MdID{}, err
	}

	rmd.bareMd = rmds.MD
	return mdID, nil
}

// Put implements the MDOps interface for MDOpsStandard.
func (md *MDOpsStandard) Put(
	ctx context.Context, rmd *RootMetadata) (MdID, error) {
	if rmd.MergedStatus() == Unmerged {
		return MdID{}, UnexpectedUnmergedPutError{}
	}
	return md.put(ctx, rmd)
}

// PutUnmerged implements the MDOps interface for MDOpsStandard.
func (md *MDOpsStandard) PutUnmerged(
	ctx context.Context, rmd *RootMetadata) (MdID, error) {
	rmd.SetUnmerged()
	if rmd.BID() == NullBranchID {
		// new branch ID
		bid, err := md.config.Crypto().MakeRandomBranchID()
		if err != nil {
			return MdID{}, err
		}
		rmd.SetBranchID(bid)
	}
	return md.put(ctx, rmd)
}

// PruneBranch implements the MDOps interface for MDOpsStandard.
func (md *MDOpsStandard) PruneBranch(
	ctx context.Context, id TlfID, bid BranchID) error {
	return md.config.MDServer().PruneBranch(ctx, id, bid)
}

// GetLatestHandleForTLF implements the MDOps interface for MDOpsStandard.
func (md *MDOpsStandard) GetLatestHandleForTLF(ctx context.Context, id TlfID) (
	BareTlfHandle, error) {
	// TODO: Verify this mapping using a Merkle tree.
	return md.config.MDServer().GetLatestHandleForTLF(ctx, id)
}

// MDv3 TODO: cache extra metadata
func (md *MDOpsStandard) getExtraMD(ctx context.Context, brmd BareRootMetadata) (
	ExtraMetadata, error) {
	wkbID, rkbID := brmd.GetTLFWriterKeyBundleID(), brmd.GetTLFReaderKeyBundleID()
	if (wkbID == TLFWriterKeyBundleID{}) || (rkbID == TLFReaderKeyBundleID{}) {
		// pre-v3 metadata embed key bundles and as such won't set any IDs
		return nil, nil
	}
	mdserv := md.config.MDServer()
	wkb, rkb, err := mdserv.GetKeyBundles(ctx, brmd.TlfID(), wkbID, rkbID)
	if err != nil {
		return nil, err
	}
	return &ExtraMetadataV3{wkb: wkb, rkb: rkb}, nil
}
