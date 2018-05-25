package libkb

import (
	"fmt"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

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

	// We won't try more than 100 roots forward
	maxTries := 100
	q := arg.Prev.Seqno + 1
	cli := m.G().GetMerkleClient()
	var leaf *MerkleGenericLeaf
	var root *MerkleRoot
	found := false

	for i := 0; !found && i < maxTries; i++ {
		m.CDebugf("| Looking at merkle seqno=%d", q)
		leaf, root, err = cli.LookupLeafAtSeqno(m.Ctx(), arg.Uid.AsUserOrTeam(), q)
		if err != nil {
			return res, err
		}
		m.CDebugf("Leaf back: %+v", leaf)
		if leaf.Public == nil {
			return res, fmt.Errorf("user leaf returned with nil public part")
		}
		if leaf.Public.Seqno >= arg.Loc.Seqno {
			m.CDebugf("| Found at merkle seqno=%d", q)
			found = true
		}
	}
	if !found {
		return res, fmt.Errorf("tried %d roots, but seqno not found", maxTries)
	}
	sigID := u.GetSigIDFromSeqno(leaf.Public.Seqno)
	if sigID.IsNil() {
		return res, fmt.Errorf("unknown seqno in sigchain: %d", arg.Loc.Seqno)
	}
	if !sigID.Equal(leaf.Public.SigID) {
		return res, fmt.Errorf("sigID sent down by server didn't match: %s != %s", sigID.String(), leaf.Public.SigID.String())
	}
	res.Res = &keybase1.MerkleRootV2{
		HashMeta: root.HashMeta(),
		Seqno:    *root.Seqno(),
	}
	m.CDebugf("| res.Res: %+v", *res.Res)
	return res, nil
}
