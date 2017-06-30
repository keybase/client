package teams

import (
	"github.com/keybase/client/go/protocol/keybase1"
	"sort"
)

func newProofTerm(i keybase1.UserOrTeamID, s keybase1.SignatureMetadata) proofTerm {
	return proofTerm{leafID: i, sigMeta: s}
}

type proofTerm struct {
	leafID  keybase1.UserOrTeamID
	sigMeta keybase1.SignatureMetadata
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
		for _, p := range v {
			ret = append(ret, p)
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
