package libkb

import (
	"fmt"
	"time"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// leafSlot is a simple accessor that takes the given leaf, and the private/public type,
// and returns the corresponding object.
func leafSlot(leaf *MerkleGenericLeaf, typ keybase1.SeqType) *MerkleTriple {
	if leaf == nil {
		return nil
	}
	switch typ {
	case keybase1.SeqType_PUBLIC:
		return leaf.Public
	case keybase1.SeqType_SEMIPRIVATE:
		return leaf.Private
	default:
		return nil
	}
}

// merkleSearchComparator is a comparator used to determine if the given leaf/root has overshot
// the mark, or no. If overshoot, then return a true, otherwrise return a false. And error will
// abort the attempt
type merkleSearchComparator func(leaf *MerkleGenericLeaf, root *MerkleRoot) (bool, error)

// lookup the max merkle root seqno from the server, or use a cached version if
// possible (and it's less than a minute old).
func lookupMaxMerkleSeqno(m MetaContext) (ret keybase1.Seqno, err error) {
	defer m.Trace("lookupMaxMerkleSeqno", func() error { return err })()
	cli := m.G().GetMerkleClient()
	mr, err := cli.FetchRootFromServer(m, time.Minute)
	if err != nil {
		return ret, err
	}
	lastp := mr.Seqno()
	if lastp == nil {
		return ret, MerkleClientError{"unexpected nil max merkle seqno", merkleErrorBadRoot}
	}
	return *lastp, nil
}

// findFirstLeafWithComparer finds the first chronological leaf in the merkle tree for which
// comparer(leaf, root) is true, where (leaf, root) is an historical (leaf,root) pair for this
// id. It's assumed that that false values are all earlier in history than the true values. We're
// looking for the point of transition. Start this search from the given prevRootSeqno, not from merkle seqno 1.
// The algorithm is to jump forward, in exponentially larger jumps, until we find a root that has a leaf
// that makes comparer true. Then, to binary search to find the exact [a,b] pair in which a makes the
// comparer false, and b makes it true. The leaf and root that correspond to b are returned.
func findFirstLeafWithComparer(m MetaContext, id keybase1.UserOrTeamID, comparator merkleSearchComparator, prevRootSeqno keybase1.Seqno) (leaf *MerkleGenericLeaf, root *MerkleRoot, err error) {
	defer m.Trace(fmt.Sprintf("findFirstLeafWithComparer(%s,%d)", id, prevRootSeqno), func() error { return err })()

	cli := m.G().GetMerkleClient()

	if !cli.CanExamineHistoricalRoot(m, prevRootSeqno) {
		return nil, nil, MerkleClientError{"can't operate on old merkle sequence number", merkleErrorOldTree}
	}

	low := prevRootSeqno
	last, err := lookupMaxMerkleSeqno(m)
	if err != nil {
		return nil, nil, err
	}
	m.Debug("found max merkle root: %d", last)
	var hi keybase1.Seqno
	inc := keybase1.Seqno(1)

	// First bump the hi pointer up to a merkle root that overshoots (or is equal to)
	// the request chainSeqno. Don't go any higher than the last known Merkle seqno.
	var found bool
	var final bool
	for hi = low + 1; !found && !final; hi += inc {
		if hi > last {
			hi = last
			final = true
		}
		m.Debug("FFLWC: Expontential forward jump: trying %d", hi)
		leaf, root, err = cli.LookupLeafAtSeqno(m, id, hi)
		if err != nil {
			return nil, nil, err
		}
		found, err = comparator(leaf, root)
		if err != nil {
			return nil, nil, err
		}
		if found || final {
			// Still make sure we `break` so we don't wind up incrementing
			// hi if we don't have to.
			break
		}
		inc *= 2
	}

	if !found {
		return nil, nil, MerkleClientError{fmt.Sprintf("given link can't be found even as high as Merkle Root %d", hi), merkleErrorNotFound}
	}

	m.Debug("FFLWC: Stopped at hi bookend; binary searching in [%d,%d]", low, hi)

	// Now binary search between prevRootSeqno and the hi we just got
	// to find the exact transition. Note that if we never enter this loop,
	// we'll still have set leaf and root in the above loop. Interestingly, this is
	// the most common case, since for most signatures, the next merkle root will
	// contain the signature. In those cases, we don't even go into this loop
	// (since hi = low + 1).
	for hi-low > 1 {
		mid := (hi + low) / 2
		tmpLeaf, tmpRoot, err := cli.LookupLeafAtSeqno(m, id, mid)
		if err != nil {
			return nil, nil, err
		}
		found, err := comparator(tmpLeaf, tmpRoot)
		if err != nil {
			return nil, nil, err
		}
		if found {
			hi = mid
			leaf = tmpLeaf
			root = tmpRoot
		} else {
			low = mid
		}
		m.Debug("FFLWC: Binary search: after update range is [%d,%d]", low, hi)
	}
	m.Debug("FFLWC: settling at final seqno: %d", hi)

	return leaf, root, nil
}

// FindNextMerkleRootAfterRevoke loads the user for the given UID, and find the
// next merkle root after the given key revocation happens. It uses the
// parameter arg.Prev to figure out where to start looking and then keeps
// searching forward until finding a leaf that matches arg.Loc.
func FindNextMerkleRootAfterRevoke(m MetaContext, arg keybase1.FindNextMerkleRootAfterRevokeArg) (res keybase1.NextMerkleRootRes, err error) {

	defer m.Trace(fmt.Sprintf("FindNextMerkleRootAfterRevoke(%+v)", arg), func() error { return err })()

	var u *User
	u, err = LoadUser(NewLoadUserArgWithMetaContext(m).WithUID(arg.Uid).WithPublicKeyOptional())
	if err != nil {
		return res, err
	}

	comparer := func(leaf *MerkleGenericLeaf, root *MerkleRoot) (bool, error) {
		slot := leafSlot(leaf, keybase1.SeqType_PUBLIC)
		if slot == nil {
			return false, MerkleClientError{fmt.Sprintf("leaf at root %d returned with nil public part", *root.Seqno()), merkleErrorBadLeaf}
		}
		m.Debug("Comprator at Merkle root %d: found chain location is %d; searching for %d", *root.Seqno(), slot.Seqno, arg.Loc.Seqno)
		return (slot.Seqno >= arg.Loc.Seqno), nil
	}

	leaf, root, err := findFirstLeafWithComparer(m, arg.Uid.AsUserOrTeam(), comparer, arg.Prev.Seqno)
	if err != nil {
		return res, err
	}
	if leaf == nil || root == nil {
		return res, MerkleClientError{"no suitable leaf found", merkleErrorNoUpdates}
	}
	sigID := u.GetSigIDFromSeqno(leaf.Public.Seqno)
	if sigID.IsNil() {
		return res, MerkleClientError{fmt.Sprintf("unknown seqno in sigchain: %d", arg.Loc.Seqno), merkleErrorBadSeqno}
	}
	if !sigID.Equal(leaf.Public.SigID) {
		return res, MerkleClientError{fmt.Sprintf("sigID sent down by server didn't match: %s != %s", sigID.String(), leaf.Public.SigID.String()), merkleErrorBadSigID}
	}
	res.Res = &keybase1.MerkleRootV2{
		HashMeta: root.HashMeta(),
		Seqno:    *root.Seqno(),
	}
	m.Debug("res.Res: %+v", *res.Res)
	return res, nil
}

func FindNextMerkleRootAfterReset(m MetaContext, arg keybase1.FindNextMerkleRootAfterResetArg) (res keybase1.NextMerkleRootRes, err error) {
	defer m.Trace(fmt.Sprintf("FindNextMerkleRootAfterReset(%+v)", arg), func() error { return err })()

	comparer := func(leaf *MerkleGenericLeaf, root *MerkleRoot) (bool, error) {
		user := leaf.userExtras
		if user == nil {
			return false, MerkleClientError{fmt.Sprintf("for root %d, expected a user leaf, didn't get one", *root.Seqno()), merkleErrorBadLeaf}
		}
		if user.resets == nil {
			return false, nil
		}
		return (user.resets.chainTail.Seqno >= arg.ResetSeqno), nil
	}
	leaf, root, err := findFirstLeafWithComparer(m, arg.Uid.AsUserOrTeam(), comparer, arg.Prev.Seqno)
	if err != nil {
		return res, err
	}
	if leaf == nil || root == nil {
		return res, MerkleClientError{"no suitable leaf found", merkleErrorNoUpdates}
	}
	res.Res = &keybase1.MerkleRootV2{
		HashMeta: root.HashMeta(),
		Seqno:    *root.Seqno(),
	}
	m.Debug("res.Res: %+v", *res.Res)
	return res, nil
}

func FindNextMerkleRootAfterTeamRemoval(m MetaContext, arg keybase1.FindNextMerkleRootAfterTeamRemovalArg) (res keybase1.NextMerkleRootRes, err error) {
	defer m.Trace(fmt.Sprintf("FindNextMerkleRootAfterTeamRemoval(%+v)", arg), func() error { return err })()
	comparer := func(leaf *MerkleGenericLeaf, root *MerkleRoot) (bool, error) {
		var trip *MerkleTriple
		if arg.IsPublic {
			trip = leaf.Public
		} else {
			trip = leaf.Private
		}
		if trip == nil {
			return false, MerkleClientError{fmt.Sprintf("No leaf found for team %v", arg.Team), merkleErrorNotFound}
		}
		return (trip.Seqno >= arg.TeamSigchainSeqno), nil
	}
	leaf, root, err := findFirstLeafWithComparer(m, arg.Team.AsUserOrTeam(), comparer, arg.Prev.Seqno)
	if err != nil {
		return res, err
	}
	if leaf == nil || root == nil {
		return res, MerkleClientError{"no suitable leaf found", merkleErrorNoUpdates}
	}
	res.Res = &keybase1.MerkleRootV2{
		HashMeta: root.HashMeta(),
		Seqno:    *root.Seqno(),
	}
	m.Debug("res.Res: %+v", *res.Res)
	return res, nil
}

func VerifyMerkleRootAndKBFS(m MetaContext, arg keybase1.VerifyMerkleRootAndKBFSArg) (err error) {

	defer m.Trace(fmt.Sprintf("VerifyMerkleRootAndKBFS(%+v)", arg), func() error { return err })()

	var mr *MerkleRoot
	mr, err = m.G().GetMerkleClient().LookupRootAtSeqno(m, arg.Root.Seqno)
	if err != nil {
		return nil
	}
	if mr == nil {
		return MerkleClientError{"no merkle root found", merkleErrorNotFound}
	}

	if !mr.HashMeta().Eq(arg.Root.HashMeta) {
		return MerkleClientError{"wrong hash meta", merkleErrorHashMeta}
	}

	var received keybase1.KBFSRootHash
	switch arg.ExpectedKBFSRoot.TreeID {
	case keybase1.MerkleTreeID_KBFS_PUBLIC:
		received = mr.payload.unpacked.Body.Kbfs.Public.Root
	case keybase1.MerkleTreeID_KBFS_PRIVATE:
		received = mr.payload.unpacked.Body.Kbfs.Private.Root
	case keybase1.MerkleTreeID_KBFS_PRIVATETEAM:
		received = mr.payload.unpacked.Body.Kbfs.PrivateTeam.Root
	default:
		return MerkleClientError{"unknown KBFS tree ID", merkleErrorKBFSBadTree}
	}

	if received == nil || arg.ExpectedKBFSRoot.Root == nil {
		if received != nil || arg.ExpectedKBFSRoot.Root != nil {
			return MerkleClientError{"KBFS hash mismatch; nil hash", merkleErrorKBFSMismatch}
		}
		return nil
	}
	if !received.Eq(arg.ExpectedKBFSRoot.Root) {
		return MerkleClientError{"KBFS hash mismatch", merkleErrorKBFSMismatch}
	}

	return nil
}

// Verify that the given link has been posted to the merkle tree.
// Used to detect a malicious server silently dropping sigchain link posts.
func MerkleCheckPostedUserSig(mctx MetaContext, uid keybase1.UID,
	seqno keybase1.Seqno, linkID LinkID) (err error) {
	defer mctx.TraceTimed(fmt.Sprintf("MerkleCheckPostedUserSig(%v, %v, %v)", uid, seqno, linkID.String()), func() error { return err })()
	for _, forcePoll := range []bool{false, true} {
		upak, _, err := mctx.G().GetUPAKLoader().LoadV2(
			NewLoadUserArgWithMetaContext(mctx).WithPublicKeyOptional().
				WithUID(uid).WithForcePoll(forcePoll))
		if err != nil {
			return err
		}
		if foundLinkID, found := upak.SeqnoLinkIDs[seqno]; found {
			if foundLinkID.Eq(linkID.Export()) {
				return nil
			}
		}
	}
	return fmt.Errorf("sigchain link not found at seqno %v", seqno)
}
