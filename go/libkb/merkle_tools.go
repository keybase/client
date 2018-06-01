package libkb

import (
	"fmt"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// leafPart is a simple accessor that takes the given leaf, and the private/public type,
// and returns the corresponding object.
func leafPart(leaf *MerkleGenericLeaf, typ keybase1.SeqType) *MerkleTriple {
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

// lookupLeafAtRootSeqno queries the server for the merkle root at rootSeqno, and then descends the tree to the
// leaf for the supplied id. It returns the leaf, the root, and the leaf part determed by SeqType.
func lookupLeafAtRootSeqno(m MetaContext, id keybase1.UserOrTeamID, rootSeqno keybase1.Seqno, typ keybase1.SeqType) (leaf *MerkleGenericLeaf, root *MerkleRoot, userChainSeqno keybase1.Seqno, err error) {
	m.CDebugf("lookupLeafAtRootSeqno(%s,%d)", id, rootSeqno)
	leaf, root, err = m.G().GetMerkleClient().LookupLeafAtSeqno(m.Ctx(), id, rootSeqno)
	if err != nil {
		return nil, nil, 0, err
	}
	part := leafPart(leaf, typ)
	if part == nil {
		return nil, nil, 0, MerkleClientError{fmt.Sprintf("leaf at root %d returned with nil %v part", rootSeqno, typ), merkleErrorBadLeaf}
	}
	return leaf, root, part.Seqno, nil
}

// findFirstLeafWithChainSeqno finds the first chronological leaf in the merkle tree that contains the given
// chainSeqno for the given UID. Start this search from the given prevRootSeqno, not from merkle position 1.
// The algorithm is to jump forward, in exponentially larger jumps, until we find a root that has a leaf
// that is >= the given chainSeqno. Then, to binary search to find the exact [a,b] pair in which a doesn't
// contain the leaf seqno, and b does. The leaf and root that correspond to be are returned.
func findFirstLeafWithChainSeqno(m MetaContext, id keybase1.UserOrTeamID, chainSeqno keybase1.Seqno, typ keybase1.SeqType, prevRootSeqno keybase1.Seqno) (leaf *MerkleGenericLeaf, root *MerkleRoot, err error) {
	defer m.CTrace(fmt.Sprintf("findFirstLeafWithChainSeqno(%s,%d,%d)", id, chainSeqno, prevRootSeqno), func() error { return err })()

	if m.G().Env.GetRunMode() == ProductionRunMode && prevRootSeqno < FirstProdMerkleTreeWithModernShape {
		return nil, nil, MerkleClientError{"can't operate on old merkle sequence number", merkleErrorOldTree}
	}

	cli := m.G().GetMerkleClient()
	low := prevRootSeqno
	lastp := cli.LastRoot().Seqno()
	if lastp == nil {
		return nil, nil, MerkleClientError{"unexpected nil high seqno", merkleErrorBadRoot}
	}
	last := *lastp
	var hi keybase1.Seqno
	inc := keybase1.Seqno(1)

	// First bump the hi pointer up to a merkle root that overshoots (or is equal to)
	// the request chainSeqno. Don't go any higher than the last known Merkle seqno.
	for hi = low + 1; hi <= last; hi += inc {
		var tmpSeqno keybase1.Seqno
		leaf, root, tmpSeqno, err = lookupLeafAtRootSeqno(m, id, hi, typ)
		if err != nil {
			return nil, nil, err
		}
		if tmpSeqno >= chainSeqno {
			break
		}
		inc *= 2
	}

	if hi > last {
		return nil, nil, MerkleClientError{fmt.Sprintf("given chainSeqno %d can't be found even as high as Merkle Root %d", chainSeqno, hi), merkleErrorNotFound}
	}

	m.CDebugf("Stopped at hi bookend; binary searching in [%d,%d]", low, hi)

	// Now binary search between prevRootSeqno and the hi we just got
	// to find the exact transition. Note that if we never enter this loop,
	// we'll still have set leaf and root in the above loop. Interestingly, this is
	// the most common case, since for most signatures, the next merkle root will
	// contain the signature. In those cases, we don't even go into this loop
	// (since hi = low + 1).
	for hi-low > 1 {
		mid := (hi + low) / 2
		tmpLeaf, tmpRoot, tmpSeqno, err := lookupLeafAtRootSeqno(m, id, mid, typ)
		if err != nil {
			return nil, nil, err
		}
		if tmpSeqno >= chainSeqno {
			hi = mid
			leaf = tmpLeaf
			root = tmpRoot
		} else {
			low = mid
		}
		m.CDebugf("Found user seqno %d; after update: [%d,%d]", tmpSeqno, low, hi)
	}
	m.CDebugf("settling at final seqno: %d", hi)

	return leaf, root, nil
}

// FindNextMerkleRootAfterRevoke loads the user for the given UID, and find the next merkle root
// after the given key revocation happens. It uses the paremter arg.Prev to figure out where to start
// looking and then keeps searching forward until finding a leaf that matches arg.Loc.
func FindNextMerkleRootAfterRevoke(m MetaContext, arg keybase1.FindNextMerkleRootAfterRevokeArg) (res keybase1.NextMerkleRootRes, err error) {

	defer m.CTrace(fmt.Sprintf("FindNextMerkleRootAfterRevoke(%+v)", arg), func() error { return err })()

	var u *User
	u, err = LoadUser(NewLoadUserArgWithMetaContext(m).WithUID(arg.Uid))
	if err != nil {
		return res, err
	}

	leaf, root, err := findFirstLeafWithChainSeqno(m, arg.Uid.AsUserOrTeam(), arg.Loc.Seqno, keybase1.SeqType_PUBLIC, arg.Prev.Seqno)
	if err != nil {
		return res, err
	}
	if leaf == nil {
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
	m.CDebugf("| res.Res: %+v", *res.Res)
	return res, nil
}

func VerifyMerkleRootAndKBFS(m MetaContext, arg keybase1.VerifyMerkleRootAndKBFSArg) (err error) {

	defer m.CTrace(fmt.Sprintf("VerifyMerkleRootAndKBFS(%+v)", arg), func() error { return err })()

	var mr *MerkleRoot
	mr, err = m.G().GetMerkleClient().LookupRootAtSeqno(m.Ctx(), arg.Root.Seqno)
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
