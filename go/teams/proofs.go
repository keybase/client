package teams

import (
	"context"
	"fmt"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"sort"
)

func newProofTerm(i keybase1.UserOrTeamID, s keybase1.SignatureMetadata, lm map[keybase1.Seqno]keybase1.LinkID) proofTerm {
	return proofTerm{leafID: i, sigMeta: s, linkMap: lm}
}

type proofTerm struct {
	leafID  keybase1.UserOrTeamID
	sigMeta keybase1.SignatureMetadata
	linkMap map[keybase1.Seqno]keybase1.LinkID
}

type proofTermBookends struct {
	left  proofTerm
	right *proofTerm
}

type proof struct {
	a proofTerm
	b proofTerm
}

type proofIndex struct {
	a keybase1.UserOrTeamID
	b keybase1.UserOrTeamID
}

func (t proofTerm) seqno() keybase1.Seqno { return t.sigMeta.SigChainLocation.Seqno }

func (t proofTerm) lessThanOrEqual(u proofTerm) bool {
	return t.seqno() <= u.seqno()
}

func (t proofTerm) max(u proofTerm) proofTerm {
	if t.lessThanOrEqual(u) {
		return u
	}
	return t
}

func (t proofTerm) min(u proofTerm) proofTerm {
	if t.lessThanOrEqual(u) {
		return t
	}
	return u
}

func newProofIndex(a keybase1.UserOrTeamID, b keybase1.UserOrTeamID) proofIndex {
	return proofIndex{b, a}
}

type proofSetT struct {
	proofs map[proofIndex][]proof
}

func newProofSet() *proofSetT {
	return &proofSetT{make(map[proofIndex][]proof)}
}

// AddNeededHappensBeforeProof adds a new needed proof to the proof set. The
// proof is that a happened before b.  If there are other proofs in the proof set
// that prove the same thing, then we can tighten those proofs with a and b if
// it makes sense.  For instance, if there is an existing proof that c<d,
// but we know that c<a and b<d, then it suffices to replace c<d with a<b as
// the needed proof. Each proof in the proof set in the end will correspond
// to a merkle tree lookup, so it makes sense to be stingy. Return the modified
// proof set with the new proofs needed, but the original arugment p will
// be mutated.
func (p *proofSetT) AddNeededHappensBeforeProof(a proofTerm, b proofTerm) *proofSetT {
	idx := newProofIndex(a.leafID, b.leafID)
	set := p.proofs[idx]
	for i := len(set) - 1; i >= 0; i-- {
		proof := set[i]
		if proof.a.lessThanOrEqual(a) && b.lessThanOrEqual(proof.b) {
			proof.a = proof.a.max(a)
			proof.b = proof.b.min(b)
			set[i] = proof
			return p
		}
	}
	p.proofs[idx] = append(p.proofs[idx], proof{a, b})
	return p
}

func (p *proofSetT) AllProofs() []proof {
	var ret []proof
	for _, v := range p.proofs {
		for _, proof := range v {
			ret = append(ret, proof)
		}
	}
	sort.Slice(ret, func(i, j int) bool {
		cmp := ret[i].a.leafID.Compare(ret[j].a.leafID)
		if cmp < 0 {
			return true
		}
		if cmp > 0 {
			return false
		}
		cmp = ret[i].b.leafID.Compare(ret[j].b.leafID)
		if cmp < 0 {
			return true
		}
		if cmp > 0 {
			return false
		}
		cs := ret[i].a.sigMeta.SigChainLocation.Seqno - ret[j].a.sigMeta.SigChainLocation.Seqno
		if cs < 0 {
			return true
		}
		if cs > 0 {
			return false
		}
		cs = ret[i].b.sigMeta.SigChainLocation.Seqno - ret[i].b.sigMeta.SigChainLocation.Seqno
		if cs < 0 {
			return true
		}
		return false
	})
	return ret
}

// lookupMerkleTreeChain loads the path up to the merkle tree and back down that corresponds
// to this proof. It will contact the API server.  Returns the sigchain tail on success.
func (p proof) lookupMerkleTreeChain(ctx context.Context, g *libkb.GlobalContext) (ret *libkb.MerkleTriple, err error) {
	leaf, err := g.MerkleClient.LookupLeafAtHashMeta(ctx, p.a.leafID, p.b.sigMeta.PrevMerkleRootSigned.HashMeta)
	if err != nil {
		return nil, err
	}
	if p.a.leafID.IsUser() {
		ret = leaf.Public
	} else {
		ret = leaf.Private
	}
	return ret, nil
}

// check a single proof. Call to the merkle API enddpoint, and then ensure that the
// data that comes back fits the proof and previously checked sighcain links.
func (p proof) check(ctx context.Context, g *libkb.GlobalContext) error {
	triple, err := p.lookupMerkleTreeChain(ctx, g)
	if err != nil {
		return err
	}

	// laterSeqno is the tail of chain A at the time when B was signed
	// earlierSeqno is the tail of chain A at the time when A was signed
	laterSeqno := triple.Seqno
	earlierSeqno := p.a.sigMeta.SigChainLocation.Seqno
	if earlierSeqno > laterSeqno {
		return NewProofError(p, fmt.Sprintf("seqno %d > %d", earlierSeqno, laterSeqno))
	}
	lm := p.a.linkMap
	if lm == nil {
		return NewProofError(p, "nil link map")
	}

	linkID, ok := lm[laterSeqno]

	// We loaded this user originally to get a sigchain as fresh as a certain key provisioning.
	// In this scenario, we might need a fresher version, so force a poll all the way through
	// the server, and then try again. If we fail the second time, we a force repoll, then
	// we're toast.
	if !ok && p.a.leafID.IsUser() {
		g.Log.CDebugf(ctx, "proof#check: missed load for %s at %d; trying a force repoll", p.a.leafID.String(), laterSeqno)
		lm, err := forceLinkMapRefreshForUser(ctx, g, p.a.leafID.AsUserOrBust())
		if err != nil {
			return err
		}
		linkID, ok = lm[laterSeqno]
	}

	if !ok {
		return NewProofError(p, fmt.Sprintf("no linkID for seqno %d", laterSeqno))
	}

	if !triple.LinkID.Export().Eq(linkID) {
		return NewProofError(p, fmt.Sprintf("hash mismatch: %s != %s", triple.LinkID, linkID))
	}
	return nil
}

// check the entire proof set, failing if any one proof fails.
func (p *proofSetT) check(ctx context.Context, g *libkb.GlobalContext) error {
	for _, v := range p.proofs {
		for _, proof := range v {
			err := proof.check(ctx, g)
			if err != nil {
				return err
			}
		}
	}
	return nil
}
