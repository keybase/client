// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"sync"
	"time"

	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/idutil"
	"github.com/keybase/client/go/kbfs/kbfsblock"
	"github.com/keybase/client/go/kbfs/kbfscrypto"
	"github.com/keybase/client/go/kbfs/kbfsmd"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/kbfs/tlfhandle"
	kbname "github.com/keybase/client/go/kbun"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/pkg/errors"
	"golang.org/x/net/context"
	"golang.org/x/sync/errgroup"
)

const (
	// Our contract with the server states that it won't accept KBFS
	// writes if more than 8 hours have passed since the last Merkle
	// roots (both global and KBFS) were published.  Add some padding
	// to that, and if we see any gaps larger than this, we will know
	// we shouldn't be trusting the server.  TODO: reduce this once
	// merkle computation is faster.
	maxAllowedMerkleGap = 8*time.Hour + 15*time.Minute

	// merkleGapEnforcementStartString indicates when the mdserver
	// started rejecting new writes based on the lack of recent merkle
	// updates (according to `maxAllowedMerkleGap` above).
	merkleGapEnforcementStartString = "2018-06-14T16:21:30-07:00"
)

var merkleGapEnforcementStart time.Time

func init() {
	var err error
	merkleGapEnforcementStart, err = time.Parse(
		"2006-01-02T15:04:05-07:00", merkleGapEnforcementStartString)
	if err != nil {
		// Can never happen without a bad global const string.
		panic(err)
	}
}

// MDOpsStandard provides plaintext RootMetadata objects to upper
// layers, and processes RootMetadataSigned objects (encrypted and
// signed) suitable for passing to/from the MDServer backend.
type MDOpsStandard struct {
	config Config
	log    logger.Logger
	vlog   *libkb.VDebugLog

	lock sync.Mutex
	// For each TLF, maps an MD revision representing the next MD
	// after a device revoke, with the minimum revision number that's
	// been validated in chain up to the given MD revision.  That is,
	// for TLF 1, if we have a next revision of 1000, and we've
	// validated that MDs 100-1000 form a valid chain, then the map
	// would contain: {1: {1000: 100}}
	leafChainsValidated map[tlf.ID]map[kbfsmd.Revision]kbfsmd.Revision
}

// NewMDOpsStandard returns a new MDOpsStandard
func NewMDOpsStandard(config Config) *MDOpsStandard {
	log := config.MakeLogger("")
	return &MDOpsStandard{
		config: config,
		log:    log,
		vlog:   config.MakeVLogger(log),
		leafChainsValidated: make(
			map[tlf.ID]map[kbfsmd.Revision]kbfsmd.Revision),
	}
}

// convertVerifyingKeyError gives a better error when the TLF was
// signed by a key that is no longer associated with the last writer.
func (md *MDOpsStandard) convertVerifyingKeyError(ctx context.Context,
	rmds *RootMetadataSigned, handle *tlfhandle.Handle, err error) error {
	if _, ok := err.(VerifyingKeyNotFoundError); !ok {
		return err
	}

	tlf := handle.GetCanonicalPath()
	writer, nameErr := md.config.KBPKI().GetNormalizedUsername(
		ctx, rmds.MD.LastModifyingWriter().AsUserOrTeam(),
		md.config.OfflineAvailabilityForPath(tlf))
	if nameErr != nil {
		writer = kbname.NormalizedUsername("uid: " +
			rmds.MD.LastModifyingWriter().String())
	}
	md.log.CDebugf(ctx, "Unverifiable update for TLF %s: %+v",
		rmds.MD.TlfID(), err)
	return UnverifiableTlfUpdateError{tlf, writer, err}
}

type ctxMDOpsSkipKeyVerificationType int

// This context key indicates that we should skip verification of
// revoked keys, to avoid recursion issues.  Any resulting MD
// that skips verification shouldn't be trusted or cached.
const ctxMDOpsSkipKeyVerification ctxMDOpsSkipKeyVerificationType = 1

func (md *MDOpsStandard) decryptMerkleLeaf(
	ctx context.Context, rmd ReadOnlyRootMetadata,
	kbfsRoot *kbfsmd.MerkleRoot, leafBytes []byte) (
	leaf *kbfsmd.MerkleLeaf, err error) {
	var eLeaf kbfsmd.EncryptedMerkleLeaf
	err = md.config.Codec().Decode(leafBytes, &eLeaf)
	if err != nil {
		return nil, err
	}

	if rmd.TypeForKeying() == tlf.TeamKeying {
		// For teams, only the Keybase service has access to the
		// private key that can decrypt the data, so send the request
		// over to the crypto client.
		cryptoLeaf := kbfscrypto.MakeEncryptedMerkleLeaf(
			eLeaf.Version, eLeaf.EncryptedData, kbfsRoot.Nonce)
		teamID := rmd.GetTlfHandle().FirstResolvedWriter().AsTeamOrBust()
		// The merkle tree doesn't yet record which team keygen is
		// used to encrypt a merkle leaf, so just use 1 as the min
		// number and let the service scan.  In the future, we should
		// have the server record the keygen in the merkle leaf header
		// and use that instead.  (Note that "team keygen" is
		// completely separate from "application keygen", so we can't
		// just use `rmd.LatestKeyGeneration()` here.)
		minKeyGen := keybase1.PerTeamKeyGeneration(1)
		md.vlog.CLogf(
			ctx, libkb.VLog1,
			"Decrypting Merkle leaf for team %s with min key generation %d",
			teamID, minKeyGen)
		leafBytes, err := md.config.Crypto().DecryptTeamMerkleLeaf(
			ctx, teamID, *kbfsRoot.EPubKey, cryptoLeaf, minKeyGen)
		if err != nil {
			return nil, err
		}
		var leaf kbfsmd.MerkleLeaf
		if err := md.config.Codec().Decode(leafBytes, &leaf); err != nil {
			return nil, err
		}
		return &leaf, nil
	}

	// The private key we need to decrypt the leaf does not live in
	// key bundles; it lives only in the MDs that were part of a
	// specific keygen.  But we don't yet know what the keygen was, or
	// what MDs were part of it, except that they have to have a
	// larger revision number than the given `rmd`.  So all we can do
	// is iterate up from `rmd`, looking for a key that will unlock
	// the leaf.
	//
	// Luckily, in the common case we'll be trying to verify the head
	// of the folder, so we should be able to use
	// rmd.data.TLFPrivateKey.

	// Fetch the latest MD so we have all possible TLF crypt keys
	// available to this device.
	head, err := md.getForTLF(
		ctx, rmd.TlfID(), rmd.BID(), rmd.MergedStatus(), nil)
	if err != nil {
		return nil, err
	}

	var uid keybase1.UID
	if rmd.TlfID().Type() != tlf.Public {
		session, err := md.config.KBPKI().GetCurrentSession(ctx)
		if err != nil {
			return nil, err
		}
		uid = session.UID
	}

	currRmd := rmd
	for {
		// If currRmd isn't readable, keep fetching MDs until it can
		// be read.  Then try currRmd.data.TLFPrivateKey to decrypt
		// the leaf.  If it doesn't work, fetch MDs until we find the
		// next keygen, and continue the loop.

		privKey := currRmd.data.TLFPrivateKey
		if !currRmd.IsReadable() {
			pmd, err := decryptMDPrivateData(
				ctx, md.config.Codec(), md.config.Crypto(),
				md.config.BlockCache(), md.config.BlockOps(),
				md.config.KeyManager(), md.config.KBPKI(), md.config,
				md.config.Mode(), uid, currRmd.GetSerializedPrivateMetadata(),
				currRmd, head.ReadOnlyRootMetadata, md.log)
			if err != nil {
				return nil, err
			}
			privKey = pmd.TLFPrivateKey
		}
		currKeyGen := currRmd.LatestKeyGeneration()
		if privKey == (kbfscrypto.TLFPrivateKey{}) {
			return nil, errors.Errorf(
				"Can't get TLF private key for key generation %d", currKeyGen)
		}

		mLeaf, err := eLeaf.Decrypt(
			md.config.Codec(), privKey, kbfsRoot.Nonce, *kbfsRoot.EPubKey)
		switch errors.Cause(err).(type) {
		case nil:
			return &mLeaf, nil
		case libkb.DecryptionError:
			// Fall-through to try another key generation.
		default:
			return nil, err
		}

		md.vlog.CLogf(
			ctx, libkb.VLog1, "Key generation %d didn't work; searching for "+
				"the next one", currKeyGen)

	fetchLoop:
		for {
			start := currRmd.Revision() + 1
			end := start + maxMDsAtATime - 1 // range is inclusive
			nextRMDs, err := getMergedMDUpdatesWithEnd(
				ctx, md.config, currRmd.TlfID(), start, end, nil)
			if err != nil {
				return nil, err
			}

			for _, nextRmd := range nextRMDs {
				if nextRmd.LatestKeyGeneration() > currKeyGen {
					md.vlog.CLogf(
						ctx, libkb.VLog1, "Revision %d has key gen %d",
						nextRmd.Revision(), nextRmd.LatestKeyGeneration())
					currRmd = nextRmd.ReadOnlyRootMetadata
					break fetchLoop
				}
			}

			if len(nextRMDs) < maxMDsAtATime {
				md.log.CDebugf(ctx,
					"We tried all revisions and couldn't find a working keygen")
				return nil, errors.Errorf("Can't decrypt merkle leaf")
			}
			currRmd = nextRMDs[len(nextRMDs)-1].ReadOnly()
		}
	}
}

func (md *MDOpsStandard) makeMerkleLeaf(
	ctx context.Context, rmd ReadOnlyRootMetadata,
	kbfsRoot *kbfsmd.MerkleRoot, leafBytes []byte) (
	leaf *kbfsmd.MerkleLeaf, err error) {
	if rmd.TlfID().Type() != tlf.Public {
		return md.decryptMerkleLeaf(ctx, rmd, kbfsRoot, leafBytes)
	}

	var mLeaf kbfsmd.MerkleLeaf
	err = md.config.Codec().Decode(leafBytes, &mLeaf)
	if err != nil {
		return nil, err
	}
	return &mLeaf, nil
}

func mdToMerkleTreeID(irmd ImmutableRootMetadata) keybase1.MerkleTreeID {
	switch irmd.TlfID().Type() {
	case tlf.Private:
		return keybase1.MerkleTreeID_KBFS_PRIVATE
	case tlf.Public:
		return keybase1.MerkleTreeID_KBFS_PUBLIC
	case tlf.SingleTeam:
		return keybase1.MerkleTreeID_KBFS_PRIVATETEAM
	default:
		panic(fmt.Sprintf("Unexpected TLF keying type: %d",
			irmd.TypeForKeying()))
	}
}

func (md *MDOpsStandard) checkMerkleTimes(ctx context.Context,
	latestRootTime time.Time, kbfsRoot *kbfsmd.MerkleRoot,
	timeToCheck time.Time, allowedGapSinceMerkle time.Duration) error {
	var latestKbfsTime time.Time
	if kbfsRoot != nil {
		latestKbfsTime = time.Unix(kbfsRoot.Timestamp, 0)
	}

	rootGap := timeToCheck.Sub(latestRootTime)
	kbfsGap := timeToCheck.Sub(latestKbfsTime)
	gapBound := allowedGapSinceMerkle

	// A negative gap means that we expect the merkle roots to have
	// happened second.
	if allowedGapSinceMerkle < 0 {
		if rootGap > 0 || kbfsGap > 0 {
			return errors.Errorf(
				"Roots were unexpectedly made before event being checked, "+
					"timeToCheck=%s, latestRootTime=%s, latestKbfsTime=%s",
				timeToCheck.Format(time.RFC3339Nano),
				latestRootTime.Format(time.RFC3339Nano),
				latestKbfsTime.Format(time.RFC3339Nano))
		}
		rootGap = -rootGap
		kbfsGap = -kbfsGap
		gapBound = -gapBound
	}

	// If it's been too long since the last published Merkle root,
	// we can't trust what the server told us.
	if rootGap > gapBound {
		return errors.Errorf("Gap too large between event and global Merkle "+
			"roots: gap=%s, timeToCheck=%s, latestRootTime=%s",
			allowedGapSinceMerkle,
			timeToCheck.Format(time.RFC3339Nano),
			latestRootTime.Format(time.RFC3339Nano))
	}
	if kbfsGap > gapBound {
		return errors.Errorf("Gap too large between event and KBFS Merkle "+
			"roots: gap=%s, timeToCheck=%s, latestRootTime=%s",
			allowedGapSinceMerkle,
			timeToCheck.Format(time.RFC3339Nano),
			latestKbfsTime.Format(time.RFC3339Nano))
	}
	return nil
}

// startOfValidatedChainForLeaf returns the earliest revision in the
// chain leading up to `leafRev` that's been validated so far.  If no
// validations have occurred yet, it returns `leafRev`.
func (md *MDOpsStandard) startOfValidatedChainForLeaf(
	tlfID tlf.ID, leafRev kbfsmd.Revision) kbfsmd.Revision {
	md.lock.Lock()
	defer md.lock.Unlock()
	revs, ok := md.leafChainsValidated[tlfID]
	if !ok {
		return leafRev
	}
	min, ok := revs[leafRev]
	if !ok {
		return leafRev
	}
	return min
}

func (md *MDOpsStandard) mdserver(ctx context.Context) (
	mds MDServer, err error) {
	// The init code sets the MDOps before it sets the MDServer, and
	// so it might be used before the MDServer is available (e.g., if
	// the Keybase service is established before the MDServer is set,
	// and it tries to look up handles for the user's public and
	// private TLFs).  So just wait until it's available, which should
	// be happen very quickly.
	first := true
	for mds = md.config.MDServer(); mds == nil; mds = md.config.MDServer() {
		if first {
			md.log.CDebugf(ctx, "Waiting for mdserver")
			first = false
		}
		time.Sleep(10 * time.Millisecond)
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		default:
		}
	}
	return mds, nil
}

func (md *MDOpsStandard) checkRevisionCameBeforeMerkle(
	ctx context.Context, rmds *RootMetadataSigned,
	verifyingKey kbfscrypto.VerifyingKey, irmd ImmutableRootMetadata,
	root keybase1.MerkleRootV2, timeToCheck time.Time) (err error) {
	ctx = context.WithValue(ctx, ctxMDOpsSkipKeyVerification, struct{}{})
	kbfsRoot, merkleNodes, rootSeqno, err :=
		md.config.MDCache().GetNextMD(rmds.MD.TlfID(), root.Seqno)
	switch errors.Cause(err).(type) {
	case nil:
	case NextMDNotCachedError:
		md.vlog.CLogf(
			ctx, libkb.VLog1, "Finding next MD for TLF %s after global root %d",
			rmds.MD.TlfID(), root.Seqno)
		mdserv, err := md.mdserver(ctx)
		if err != nil {
			return err
		}
		kbfsRoot, merkleNodes, rootSeqno, err =
			mdserv.FindNextMD(ctx, rmds.MD.TlfID(), root.Seqno)
		if err != nil {
			return err
		}
		err = md.config.MDCache().PutNextMD(
			rmds.MD.TlfID(), root.Seqno, kbfsRoot, merkleNodes, rootSeqno)
		if err != nil {
			return err
		}
	default:
		return err
	}

	if len(merkleNodes) == 0 {
		// This can happen legitimately if we are still inside the
		// error window and no new merkle trees have been made yet, or
		// the server could be lying to us.
		md.log.CDebugf(ctx, "The server claims there haven't been any "+
			"KBFS merkle trees published since the merkle root")

		// Check the most recent global merkle root and KBFS merkle
		// root ctimes and make sure they fall within the expected
		// error window with respect to the revocation.
		_, latestRootTime, err := md.config.KBPKI().GetCurrentMerkleRoot(ctx)
		if err != nil {
			return err
		}
		treeID := mdToMerkleTreeID(irmd)
		// TODO: cache the latest KBFS merkle root somewhere for a while?
		mdserv, err := md.mdserver(ctx)
		if err != nil {
			return err
		}
		latestKbfsRoot, err := mdserv.GetMerkleRootLatest(ctx, treeID)
		if err != nil {
			return err
		}
		serverOffset, _ := mdserv.OffsetFromServerTime()
		if (serverOffset < 0 && serverOffset < -time.Hour) ||
			(serverOffset > 0 && serverOffset > time.Hour) {
			return errors.Errorf("The offset between the server clock "+
				"and the local clock is too large to check the revocation "+
				"time: %s", serverOffset)
		}
		currServerTime := md.config.Clock().Now().Add(-serverOffset)
		err = md.checkMerkleTimes(
			ctx, latestRootTime, latestKbfsRoot, currServerTime,
			maxAllowedMerkleGap)
		if err != nil {
			return err
		}

		// Verify the chain up to the current head.  By using `ctx`,
		// we'll avoid infinite loops in the writer-key-checking code
		// by skipping revoked key verification.  This is ok, because
		// we only care about the hash chain for the purposes of
		// verifying `irmd`.
		chain, err := getMergedMDUpdates(
			ctx, md.config, irmd.TlfID(), irmd.Revision()+1, nil)
		if err != nil {
			return err
		}
		if len(chain) > 0 {
			err = irmd.CheckValidSuccessor(
				irmd.mdID, chain[0].ReadOnlyRootMetadata)
			if err != nil {
				return err
			}
		}

		// TODO: Also eventually check the blockchain-published merkles to
		// make sure the server isn't lying (though that will have a
		// much larger error window).
		return nil
	}

	if !timeToCheck.IsZero() {
		// Check the gap between the event and the global/KBFS roots
		// that include the event, to make sure they fall within the
		// expected error window.  The server didn't begin enforcing this
		// until some time into KBFS's existence though.
		if timeToCheck.After(merkleGapEnforcementStart) {
			// TODO(KBFS-2954): get the right root time for the
			// corresponding global root.
			latestRootTime := time.Unix(kbfsRoot.Timestamp, 0)
			err = md.checkMerkleTimes(
				ctx, latestRootTime, kbfsRoot, timeToCheck,
				// Check the gap from the reverse direction, to make sure the
				// roots were made _after_ the revoke within the gap.
				-maxAllowedMerkleGap)
			if err != nil {
				return err
			}
		}
	}

	md.vlog.CLogf(
		ctx, libkb.VLog1,
		"Next KBFS merkle root is %d, included in global merkle root seqno=%d",
		kbfsRoot.SeqNo, rootSeqno)

	// Decode (and possibly decrypt) the leaf node, so we can see what
	// the given MD revision number was for the MD that followed the
	// revoke.
	leaf, err := md.makeMerkleLeaf(
		ctx, irmd.ReadOnlyRootMetadata, kbfsRoot,
		merkleNodes[len(merkleNodes)-1])
	if err != nil {
		return err
	}

	// If the given revision comes after the merkle leaf revision,
	// then don't verify it.
	if irmd.Revision() > leaf.Revision {
		return MDWrittenAfterRevokeError{
			irmd.TlfID(), irmd.Revision(), leaf.Revision, verifyingKey}
	} else if irmd.Revision() == leaf.Revision {
		return nil
	}

	// Otherwise it's valid, as long as there's a valid chain of MD
	// revisions between the two.  First, see which chain we've
	// already validated, and if this revision falls in that chain,
	// we're done.  Otherwise, just fetch the part of the chain we
	// haven't validated yet.
	newChainEnd := md.startOfValidatedChainForLeaf(irmd.TlfID(), leaf.Revision)
	if newChainEnd <= irmd.Revision() {
		return nil
	}

	// By using `ctx`, we'll avoid infinite loops in the
	// writer-key-checking code by skipping revoked key verification.
	// This is ok, because we only care about the hash chain for the
	// purposes of verifying `irmd`.
	md.vlog.CLogf(
		ctx, libkb.VLog1, "Validating MD chain for TLF %s between %d and %d",
		irmd.TlfID(), irmd.Revision()+1, newChainEnd)
	chain, err := getMergedMDUpdatesWithEnd(
		ctx, md.config, irmd.TlfID(), irmd.Revision()+1, newChainEnd, nil)
	if err != nil {
		return err
	}
	if len(chain) == 0 {
		return errors.Errorf("Unexpectedly found no revisions "+
			"after %d, even though the merkle tree includes revision %d",
			irmd.Revision(), leaf.Revision)
	}

	err = irmd.CheckValidSuccessor(irmd.mdID, chain[0].ReadOnlyRootMetadata)
	if err != nil {
		return err
	}

	// Cache this verified chain for later use.
	md.lock.Lock()
	defer md.lock.Unlock()
	revs, ok := md.leafChainsValidated[irmd.TlfID()]
	if !ok {
		revs = make(map[kbfsmd.Revision]kbfsmd.Revision)
		md.leafChainsValidated[irmd.TlfID()] = revs
	}
	revs[leaf.Revision] = irmd.Revision()
	return nil
}

func (md *MDOpsStandard) verifyKey(
	ctx context.Context, rmds *RootMetadataSigned,
	uid keybase1.UID, verifyingKey kbfscrypto.VerifyingKey,
	irmd ImmutableRootMetadata) (cacheable bool, err error) {
	err = md.config.KBPKI().HasVerifyingKey(
		ctx, uid, verifyingKey, rmds.untrustedServerTimestamp,
		md.config.OfflineAvailabilityForID(irmd.TlfID()))
	var info idutil.RevokedKeyInfo
	switch e := errors.Cause(err).(type) {
	case nil:
		return true, nil
	case RevokedDeviceVerificationError:
		if ctx.Value(ctxMDOpsSkipKeyVerification) != nil {
			md.vlog.CLogf(
				ctx, libkb.VLog1,
				"Skipping revoked key verification due to recursion")
			return false, nil
		}
		if e.info.MerkleRoot.Seqno <= 0 {
			md.log.CDebugf(ctx, "Can't verify an MD written by a revoked "+
				"device if there's no valid root seqno to check: %+v", e)
			return true, nil
		}

		info = e.info
		// Fall through to check via the merkle tree.
	default:
		return false, err
	}

	md.vlog.CLogf(
		ctx, libkb.VLog1, "Revision %d for %s was signed by a device that was "+
			"revoked at time=%d,root=%d; checking via Merkle",
		irmd.Revision(), irmd.TlfID(), info.Time, info.MerkleRoot.Seqno)

	err = md.checkRevisionCameBeforeMerkle(
		ctx, rmds, verifyingKey, irmd, info.MerkleRoot,
		keybase1.FromTime(info.Time))
	if err != nil {
		return false, err
	}
	return true, nil
}

func (md *MDOpsStandard) verifyWriterKey(ctx context.Context,
	rmds *RootMetadataSigned, irmd ImmutableRootMetadata, handle *tlfhandle.Handle,
	getRangeLock *sync.Mutex) error {
	if !rmds.MD.IsWriterMetadataCopiedSet() {
		// Skip verifying the writer key if it's the same as the
		// overall signer's key (which must be verified elsewhere).
		if rmds.GetWriterMetadataSigInfo().VerifyingKey ==
			rmds.SigInfo.VerifyingKey {
			return nil
		}

		_, err := md.verifyKey(
			ctx, rmds, rmds.MD.LastModifyingWriter(),
			rmds.GetWriterMetadataSigInfo().VerifyingKey, irmd)
		if err != nil {
			return md.convertVerifyingKeyError(ctx, rmds, handle, err)
		}
		return nil
	}

	// The writer metadata can be copied only for rekeys or
	// finalizations, neither of which should happen while
	// unmerged.
	if rmds.MD.MergedStatus() != kbfsmd.Merged {
		return errors.Errorf("Revision %d for %s has a copied writer "+
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

	// The server timestamp on rmds does not reflect when the
	// writer MD was actually signed, since it was copied from a
	// previous revision.  Search backwards for the most recent
	// uncopied writer MD to get the right timestamp.
	for prevRev := rmds.MD.RevisionNumber() - 1; prevRev >= kbfsmd.RevisionInitial; prevRev-- {
		// Recursively call into MDOps.  Note that in the case where
		// we were already fetching a range of MDs, this could do
		// extra work by downloading the same MDs twice (for those
		// that aren't yet in the cache).  That should be so rare that
		// it's not worth optimizing.
		rmd, err := getSingleMD(ctx, md.config, rmds.MD.TlfID(),
			rmds.MD.BID(), prevRev, rmds.MD.MergedStatus(), nil)
		if err != nil {
			return err
		}

		if !rmd.IsWriterMetadataCopiedSet() {
			// We want to compare the writer signature of
			// rmds with that of prevMDs[i]. However, we've
			// already dropped prevMDs[i]'s writer
			// signature. We can just verify prevMDs[i]'s
			// writer metadata with rmds's signature,
			// though.
			buf, err := rmd.GetSerializedWriterMetadata(md.config.Codec())
			if err != nil {
				return err
			}

			err = kbfscrypto.Verify(
				buf, rmds.GetWriterMetadataSigInfo())
			if err != nil {
				return errors.Errorf("Could not verify "+
					"uncopied writer metadata "+
					"from revision %d of folder "+
					"%s with signature from "+
					"revision %d: %v",
					rmd.Revision(),
					rmds.MD.TlfID(),
					rmds.MD.RevisionNumber(), err)
			}

			// The fact the fact that we were able to process this
			// MD correctly means that we already verified its key
			// at the correct timestamp, so we're good.
			return nil
		}
	}
	return errors.Errorf(
		"Couldn't find uncopied MD previous to "+
			"revision %d of folder %s for checking the writer "+
			"timestamp", rmds.MD.RevisionNumber(), rmds.MD.TlfID())
}

type merkleBasedTeamChecker struct {
	teamMembershipChecker
	md           *MDOpsStandard
	rmds         *RootMetadataSigned
	irmd         ImmutableRootMetadata
	notCacheable bool
}

func (mbtc merkleBasedTeamChecker) IsTeamWriter(
	ctx context.Context, tid keybase1.TeamID, uid keybase1.UID,
	verifyingKey kbfscrypto.VerifyingKey,
	offline keybase1.OfflineAvailability) (bool, error) {
	isCurrentWriter, err := mbtc.teamMembershipChecker.IsTeamWriter(
		ctx, tid, uid, verifyingKey, offline)
	if err != nil {
		return false, err
	}
	if isCurrentWriter {
		return true, nil
	}

	if ctx.Value(ctxMDOpsSkipKeyVerification) != nil {
		// Don't cache this fake verification.
		mbtc.notCacheable = true
		mbtc.md.vlog.CLogf(
			ctx, libkb.VLog1,
			"Skipping old team writership verification due to recursion")
		return true, nil
	}

	// The user is not currently a writer of the team, but maybe they
	// were at the time this MD was written.  Find out the global
	// merkle root where they were no longer a writer, and make sure
	// this revision came before that.
	mbtc.md.vlog.CLogf(
		ctx, libkb.VLog1, "User %s is no longer a writer of team %s; "+
			"checking merkle trees to verify they were a writer at the time the "+
			"MD was written.", uid, tid)
	root, err := mbtc.teamMembershipChecker.NoLongerTeamWriter(
		ctx, tid, mbtc.irmd.TlfID().Type(), uid, verifyingKey, offline)
	switch e := errors.Cause(err).(type) {
	case nil:
		// TODO(CORE-8199): pass in the time for the writer downgrade.
		err = mbtc.md.checkRevisionCameBeforeMerkle(
			ctx, mbtc.rmds, verifyingKey, mbtc.irmd, root, time.Time{})
		if err != nil {
			return false, err
		}
	case libkb.MerkleClientError:
		if e.IsOldTree() {
			mbtc.md.vlog.CLogf(
				ctx, libkb.VLog1, "Merkle root is too old for checking "+
					"the revoked key: %+v", err)
		} else {
			return false, err
		}
	default:
		return false, err
	}

	return true, nil
}

func (mbtc merkleBasedTeamChecker) IsTeamReader(
	ctx context.Context, tid keybase1.TeamID, uid keybase1.UID,
	offline keybase1.OfflineAvailability) (
	bool, error) {
	if mbtc.irmd.TlfID().Type() == tlf.Public {
		return true, nil
	}

	isCurrentReader, err := mbtc.teamMembershipChecker.IsTeamReader(
		ctx, tid, uid, offline)
	if err != nil {
		return false, err
	}
	if isCurrentReader {
		return true, nil
	}

	// We don't yet have a way to check for past readership based on
	// the Merkle tree, so for now return true.  This isn't too bad,
	// since this is only called for checking the last modifying user
	// of an update (the last modifying _writer_ is tested with the
	// above function).  TODO: fix this once historic team readership
	// is available in the service.
	mbtc.md.vlog.CLogf(
		ctx, libkb.VLog1,
		"Faking old readership for user %s in team %s", uid, tid)
	return true, nil
}

// processMetadata converts the given rmds to an
// ImmutableRootMetadata. After this function is called, rmds
// shouldn't be used.
func (md *MDOpsStandard) processMetadata(ctx context.Context,
	handle *tlfhandle.Handle, rmds *RootMetadataSigned, extra kbfsmd.ExtraMetadata,
	getRangeLock *sync.Mutex) (ImmutableRootMetadata, error) {
	// First, construct the ImmutableRootMetadata object, even before
	// we validate the writer or the keys, because the irmd will be
	// used in that process to check for valid successors.

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
		md.config.KeyManager(), md.config.KBPKI(), md.config, md.config.Mode(),
		uid, rmd.GetSerializedPrivateMetadata(), rmd, rmd, md.log)
	if err != nil {
		return ImmutableRootMetadata{}, err
	}
	rmd.data = pmd

	mdID, err := kbfsmd.MakeID(md.config.Codec(), rmd.bareMd)
	if err != nil {
		return ImmutableRootMetadata{}, err
	}

	localTimestamp := rmds.untrustedServerTimestamp
	mdserv, err := md.mdserver(ctx)
	if err != nil {
		return ImmutableRootMetadata{}, err
	}
	if offset, ok := mdserv.OffsetFromServerTime(); ok {
		localTimestamp = localTimestamp.Add(offset)
	}

	key := rmds.GetWriterMetadataSigInfo().VerifyingKey
	irmd := MakeImmutableRootMetadata(rmd, key, mdID, localTimestamp, true)

	// Next, verify validity and signatures.  Use a checker that can
	// check for writership in the past, using the merkle tree.
	checker := merkleBasedTeamChecker{md.config.KBPKI(), md, rmds, irmd, false}
	err = rmds.IsValidAndSigned(
		ctx, md.config.Codec(), checker, extra,
		md.config.OfflineAvailabilityForID(handle.TlfID()))
	if err != nil {
		return ImmutableRootMetadata{}, MDMismatchError{
			rmds.MD.RevisionNumber(), handle.GetCanonicalPath(),
			rmds.MD.TlfID(), err,
		}
	}

	// Then, verify the verifying keys.  We do this after decrypting
	// the MD and making the ImmutableRootMetadata, since we may need
	// access to the private metadata when checking the merkle roots,
	// and we also need access to the `mdID`.
	if err := md.verifyWriterKey(
		ctx, rmds, irmd, handle, getRangeLock); err != nil {
		return ImmutableRootMetadata{}, err
	}

	cacheable, err := md.verifyKey(
		ctx, rmds, rmds.MD.GetLastModifyingUser(), rmds.SigInfo.VerifyingKey,
		irmd)
	if err != nil {
		return ImmutableRootMetadata{}, md.convertVerifyingKeyError(
			ctx, rmds, handle, err)
	}

	// Make sure the caller doesn't use rmds anymore.
	*rmds = RootMetadataSigned{}

	if cacheable && !checker.notCacheable {
		err = md.config.MDCache().Put(irmd)
		if err != nil {
			return ImmutableRootMetadata{}, err
		}
	}
	return irmd, nil
}

func (md *MDOpsStandard) getForHandle(ctx context.Context, handle *tlfhandle.Handle,
	mStatus kbfsmd.MergeStatus, lockBeforeGet *keybase1.LockID) (
	id tlf.ID, rmd ImmutableRootMetadata, err error) {
	// If we already know the tlf ID, we shouldn't be calling this
	// function.
	if handle.TlfID() != tlf.NullID {
		return tlf.ID{}, ImmutableRootMetadata{}, errors.Errorf(
			"GetForHandle called for %s with non-nil TLF ID %s",
			handle.GetCanonicalPath(), handle.TlfID())
	}

	// Check for handle readership, to give a nice error early.
	if handle.Type() == tlf.Private && !handle.IsBackedByTeam() {
		session, err := md.config.KBPKI().GetCurrentSession(ctx)
		if err != nil {
			return tlf.ID{}, ImmutableRootMetadata{}, err
		}

		if !handle.IsReader(session.UID) {
			return tlf.ID{}, ImmutableRootMetadata{},
				tlfhandle.NewReadAccessError(
					handle, session.Name, handle.GetCanonicalPath())
		}
	}

	md.log.CDebugf(
		ctx, "GetForHandle: %s %s", handle.GetCanonicalPath(), mStatus)
	defer func() {
		// Temporary debugging for KBFS-1921.  TODO: remove.
		switch {
		case err != nil:
			md.log.CDebugf(ctx, "GetForHandle done with err=%+v", err)
		case rmd != (ImmutableRootMetadata{}):
			md.log.CDebugf(ctx, "GetForHandle done, id=%s, revision=%d, "+
				"mStatus=%s", id, rmd.Revision(), rmd.MergedStatus())
		default:
			md.log.CDebugf(
				ctx, "GetForHandle done, id=%s, no %s MD revisions yet", id,
				mStatus)
		}
	}()

	mdserv, err := md.mdserver(ctx)
	if err != nil {
		return tlf.ID{}, ImmutableRootMetadata{}, err
	}
	bh, err := handle.ToBareHandle()
	if err != nil {
		return tlf.ID{}, ImmutableRootMetadata{}, err
	}
	if handle.IsLocalConflict() {
		md.log.CDebugf(ctx, "Stripping out local conflict info from %s "+
			"before fetching the ID", handle.GetCanonicalPath())
		bh.ConflictInfo = nil
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

	mdHandle, err := tlfhandle.MakeHandle(
		ctx, bareMdHandle, id.Type(), md.config.KBPKI(), md.config.KBPKI(), nil,
		md.config.OfflineAvailabilityForID(id))
	if err != nil {
		return tlf.ID{}, ImmutableRootMetadata{}, err
	}

	// Check for mutual handle resolution.
	if err := mdHandle.MutuallyResolvesTo(ctx, md.config.Codec(),
		md.config.KBPKI(), nil, md.config, *handle, rmds.MD.RevisionNumber(),
		rmds.MD.TlfID(), md.log); err != nil {
		return tlf.ID{}, ImmutableRootMetadata{}, err
	}
	// Set the ID after checking the resolve, because `handle` doesn't
	// have the TLF ID set yet.
	mdHandle.SetTlfID(id)

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
	ctx context.Context, handle *tlfhandle.Handle) (id tlf.ID, err error) {
	mdcache := md.config.MDCache()
	id, err = mdcache.GetIDForHandle(handle)
	switch errors.Cause(err).(type) {
	case NoSuchTlfIDError:
		// Do the server-based lookup below.
	case nil:
		return id, nil
	default:
		return tlf.NullID, err
	}
	id, _, err = md.getForHandle(ctx, handle, kbfsmd.Merged, nil)
	switch errors.Cause(err).(type) {
	case kbfsmd.ServerErrorClassicTLFDoesNotExist:
		// The server thinks we should create an implicit team for this TLF.
		return tlf.NullID, nil
	case nil:
	default:
		return tlf.NullID, err
	}
	if !handle.IsLocalConflict() {
		err = mdcache.PutIDForHandle(handle, id)
		if err != nil {
			return tlf.NullID, err
		}
	}
	return id, nil
}

func (md *MDOpsStandard) processMetadataWithID(ctx context.Context,
	id tlf.ID, bid kbfsmd.BranchID, handle *tlfhandle.Handle, rmds *RootMetadataSigned,
	extra kbfsmd.ExtraMetadata, getRangeLock *sync.Mutex) (ImmutableRootMetadata, error) {
	// Make sure the signed-over ID matches
	if id != rmds.MD.TlfID() {
		return ImmutableRootMetadata{}, MDMismatchError{
			rmds.MD.RevisionNumber(), id.String(), rmds.MD.TlfID(),
			errors.Errorf("MD contained unexpected folder id %s, expected %s",
				rmds.MD.TlfID().String(), id.String()),
		}
	}
	// Make sure the signed-over branch ID matches
	if bid != kbfsmd.NullBranchID && bid != rmds.MD.BID() {
		return ImmutableRootMetadata{}, MDMismatchError{
			rmds.MD.RevisionNumber(), id.String(), rmds.MD.TlfID(),
			errors.Errorf("MD contained unexpected branch id %s, expected %s, "+
				"folder id %s", rmds.MD.BID().String(), bid.String(), id.String()),
		}
	}

	return md.processMetadata(ctx, handle, rmds, extra, getRangeLock)
}

func (md *MDOpsStandard) processSignedMD(
	ctx context.Context, id tlf.ID, bid kbfsmd.BranchID,
	rmds *RootMetadataSigned) (ImmutableRootMetadata, error) {
	extra, err := md.getExtraMD(ctx, rmds.MD)
	if err != nil {
		return ImmutableRootMetadata{}, err
	}
	bareHandle, err := rmds.MD.MakeBareTlfHandle(extra)
	if err != nil {
		return ImmutableRootMetadata{}, err
	}
	handle, err := tlfhandle.MakeHandleWithTlfID(
		ctx, bareHandle, rmds.MD.TlfID().Type(), md.config.KBPKI(),
		md.config.KBPKI(), id, md.config.OfflineAvailabilityForID(id))
	if err != nil {
		return ImmutableRootMetadata{}, err
	}
	rmd, err := md.processMetadataWithID(ctx, id, bid, handle, rmds, extra, nil)
	if err != nil {
		return ImmutableRootMetadata{}, err
	}
	return rmd, nil
}

func (md *MDOpsStandard) getForTLF(ctx context.Context, id tlf.ID,
	bid kbfsmd.BranchID, mStatus kbfsmd.MergeStatus, lockBeforeGet *keybase1.LockID) (
	ImmutableRootMetadata, error) {
	mdserv, err := md.mdserver(ctx)
	if err != nil {
		return ImmutableRootMetadata{}, err
	}
	rmds, err := mdserv.GetForTLF(ctx, id, bid, mStatus, lockBeforeGet)
	if err != nil {
		return ImmutableRootMetadata{}, err
	}
	if rmds == nil {
		// Possible if mStatus is kbfsmd.Unmerged
		return ImmutableRootMetadata{}, nil
	}
	return md.processSignedMD(ctx, id, bid, rmds)
}

// GetForTLF implements the MDOps interface for MDOpsStandard.
func (md *MDOpsStandard) GetForTLF(
	ctx context.Context, id tlf.ID, lockBeforeGet *keybase1.LockID) (
	ImmutableRootMetadata, error) {
	return md.getForTLF(ctx, id, kbfsmd.NullBranchID, kbfsmd.Merged, lockBeforeGet)
}

// GetForTLFByTime implements the MDOps interface for MDOpsStandard.
func (md *MDOpsStandard) GetForTLFByTime(
	ctx context.Context, id tlf.ID, serverTime time.Time) (
	irmd ImmutableRootMetadata, err error) {
	md.log.CDebugf(ctx, "GetForTLFByTime %s %s", id, serverTime)
	defer func() {
		if err == nil {
			md.log.CDebugf(ctx, "GetForTLFByTime %s %s done: %d",
				id, serverTime, irmd.Revision())
		} else {
			md.log.CDebugf(ctx, "GetForTLFByTime %s %s done: %+v",
				id, serverTime, err)
		}
	}()
	mdserv, err := md.mdserver(ctx)
	if err != nil {
		return ImmutableRootMetadata{}, err
	}
	rmds, err := mdserv.GetForTLFByTime(ctx, id, serverTime)
	if err != nil {
		return ImmutableRootMetadata{}, err
	}

	return md.processSignedMD(ctx, id, kbfsmd.NullBranchID, rmds)
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
			handle, err := tlfhandle.MakeHandleWithTlfID(
				groupCtx, bareHandle, rmds.MD.TlfID().Type(), md.config.KBPKI(),
				md.config.KBPKI(), id, md.config.OfflineAvailabilityForID(id))
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
			return nil, errors.Errorf("Unexpected revision %d; expected "+
				"something between %d and %d inclusive", irmd.Revision(),
				startRev, startRev+numExpected-1)
		} else if irmds[i] != (ImmutableRootMetadata{}) {
			return nil, errors.Errorf("Got revision %d twice", irmd.Revision())
		}
		irmds[i] = irmd
	}

	// Now that we have all the immutable RootMetadatas, verify that
	// the given MD objects form a valid sequence.
	var prevIRMD ImmutableRootMetadata
	for _, irmd := range irmds {
		if prevIRMD != (ImmutableRootMetadata{}) {
			err = prevIRMD.CheckValidSuccessor(
				prevIRMD.mdID, irmd.ReadOnlyRootMetadata)
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
	mdserv, err := md.mdserver(ctx)
	if err != nil {
		return nil, err
	}
	rmds, err := mdserv.GetRange(
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
	priority keybase1.MDPriority, bps data.BlockPutState) (
	ImmutableRootMetadata, error) {
	session, err := md.config.KBPKI().GetCurrentSession(ctx)
	if err != nil {
		return ImmutableRootMetadata{}, err
	}

	// Ensure that the block changes are properly unembedded.
	if !rmd.IsWriterMetadataCopiedSet() &&
		rmd.data.Changes.Info.BlockPointer == data.ZeroPtr &&
		!md.config.BlockSplitter().ShouldEmbedData(
			rmd.data.Changes.SizeEstimate()) {
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

	mdserv, err := md.mdserver(ctx)
	if err != nil {
		return ImmutableRootMetadata{}, err
	}
	err = mdserv.Put(ctx, rmds, rmd.extra, lockContext, priority)
	if err != nil {
		return ImmutableRootMetadata{}, err
	}

	mdID, err := kbfsmd.MakeID(md.config.Codec(), rmds.MD)
	if err != nil {
		return ImmutableRootMetadata{}, err
	}

	rmd = rmd.loadCachedBlockChanges(
		ctx, bps, md.log, md.vlog, md.config.Codec())
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
	priority keybase1.MDPriority, bps data.BlockPutState) (
	ImmutableRootMetadata, error) {
	if rmd.MergedStatus() == kbfsmd.Unmerged {
		return ImmutableRootMetadata{}, UnexpectedUnmergedPutError{}
	}
	return md.put(ctx, rmd, verifyingKey, lockContext, priority, bps)
}

// PutUnmerged implements the MDOps interface for MDOpsStandard.
func (md *MDOpsStandard) PutUnmerged(
	ctx context.Context, rmd *RootMetadata,
	verifyingKey kbfscrypto.VerifyingKey, bps data.BlockPutState) (
	ImmutableRootMetadata, error) {
	rmd.SetUnmerged()
	if rmd.BID() == kbfsmd.NullBranchID {
		// new branch ID
		bid, err := md.config.Crypto().MakeRandomBranchID()
		if err != nil {
			return ImmutableRootMetadata{}, err
		}
		rmd.SetBranchID(bid)
	}
	return md.put(ctx, rmd, verifyingKey, nil, keybase1.MDPriorityNormal, bps)
}

// PruneBranch implements the MDOps interface for MDOpsStandard.
func (md *MDOpsStandard) PruneBranch(
	ctx context.Context, id tlf.ID, bid kbfsmd.BranchID) error {
	mdserv, err := md.mdserver(ctx)
	if err != nil {
		return err
	}
	return mdserv.PruneBranch(ctx, id, bid)
}

// ResolveBranch implements the MDOps interface for MDOpsStandard.
func (md *MDOpsStandard) ResolveBranch(
	ctx context.Context, id tlf.ID, bid kbfsmd.BranchID, _ []kbfsblock.ID,
	rmd *RootMetadata, verifyingKey kbfscrypto.VerifyingKey,
	bps data.BlockPutState) (ImmutableRootMetadata, error) {
	// Put the MD first.
	irmd, err := md.Put(
		ctx, rmd, verifyingKey, nil, keybase1.MDPriorityNormal, bps)
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
	mdserv, err := md.mdserver(ctx)
	if err != nil {
		return tlf.Handle{}, err
	}
	// TODO: Verify this mapping using a Merkle tree.
	return mdserv.GetLatestHandleForTLF(ctx, id)
}

// ValidateLatestHandleNotFinal implements the MDOps interface for
// MDOpsStandard.
func (md *MDOpsStandard) ValidateLatestHandleNotFinal(
	ctx context.Context, h *tlfhandle.Handle) (bool, error) {
	if h.IsFinal() || h.TlfID() == tlf.NullID {
		return false, nil
	}

	// First check the cache to avoid a costly RTT to the mdserver.
	// If the handle associated with the TLF has really become
	// finalized, then the cache entry should have been updated.
	mdcache := md.config.MDCache()
	id, err := mdcache.GetIDForHandle(h)
	switch errors.Cause(err).(type) {
	case NoSuchTlfIDError:
		// Do the server-based lookup below.
	case nil:
		return id == h.TlfID(), nil
	default:
		return false, err
	}

	md.log.CDebugf(ctx, "Checking the latest handle for %s; "+
		"curr handle is %s", h.TlfID(), h.GetCanonicalName())
	latestHandle, err := md.GetLatestHandleForTLF(ctx, h.TlfID())
	switch errors.Cause(err).(type) {
	case kbfsmd.ServerErrorUnauthorized:
		// The server sends this in the case that it doesn't know
		// about the TLF ID.  If the server didn't have the mapping,
		// we're likely dealing with an implicit team TLF.  Trust what
		// is in the sigchain in that case.  (If the error happens
		// because we really looked up a TLF we are unauthorized for,
		// earlier calls to the server should have failed before we
		// even got access to the TLF ID.)
		md.log.CDebugf(ctx,
			"Assuming unauthorized error implies implicit team TLF: %+v", err)
		return true, nil
	case nil:
		if latestHandle.IsFinal() {
			md.log.CDebugf(ctx,
				"Latest handle is finalized, so ID is incorrect")
			return false, nil
		}
		err = mdcache.PutIDForHandle(h, h.TlfID())
		if err != nil {
			return false, err
		}
		return true, nil
	default:
		return false, err
	}
}

func (md *MDOpsStandard) getExtraMD(ctx context.Context, brmd kbfsmd.RootMetadata) (
	extra kbfsmd.ExtraMetadata, err error) {
	wkbID, rkbID := brmd.GetTLFWriterKeyBundleID(), brmd.GetTLFReaderKeyBundleID()
	if (wkbID == kbfsmd.TLFWriterKeyBundleID{}) || (rkbID == kbfsmd.TLFReaderKeyBundleID{}) {
		// Pre-v3 metadata embed key bundles and as such won't set any IDs.
		return nil, nil
	}
	mdserv, err := md.mdserver(ctx)
	if err != nil {
		return nil, err
	}
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
	switch {
	case wkb != nil:
		// Don't need the writer bundle.
		_, rkb, err = mdserv.GetKeyBundles(ctx, tlf, kbfsmd.TLFWriterKeyBundleID{}, rkbID)
	case rkb != nil:
		// Don't need the reader bundle.
		wkb, _, err = mdserv.GetKeyBundles(ctx, tlf, wkbID, kbfsmd.TLFReaderKeyBundleID{})
	default:
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
