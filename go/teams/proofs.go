package teams

import (
	"github.com/keybase/client/go/protocol/keybase1"
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
	if string(a) < string(b) {
		return proofIndex{a, b}
	}
	return proofIndex{b, a}
}

type proofSetT struct {
	proofs map[proofIndex][]proof
}

func newProofSet() *proofSetT {
	return &proofSetT{make(map[proofIndex][]proof)}
}

func (p *proofSetT) AddNeededHappensBeforeProof(a proofTerm, b proofTerm) *proofSetT {
	idx := newProofIndex(a.leafID, b.leafID)
	set := p.proofs[idx]
	for i := len(set) - 1; i >= 0; i-- {
		proof := set[i]
		if proof.a.lessThanOrEqual(a) && b.lessThanOrEqual(proof.b) {
			proof.a = proof.a.max(a)
			proof.b = proof.b.min(b)
			return p
		}
	}
	p.proofs[idx] = append(p.proofs[idx], proof{a, b})
	return p
}
