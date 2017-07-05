package teams

import (
	"encoding/hex"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
	"testing"
)

func createProofTerm(idInt int, seqno keybase1.Seqno) proofTerm {
	var id [16]byte
	id[15] = 0x25
	id[0] = byte(idInt)
	return proofTerm{
		leafID: keybase1.UserOrTeamID(hex.EncodeToString(id[:])),
		sigMeta: keybase1.SignatureMetadata{
			SigChainLocation: keybase1.SigChainLocation{
				Seqno: seqno,
			},
		},
	}
}

func proofEq(x, y proof) bool {
	return termEq(x.a, y.a) && termEq(x.b, y.b)
}

func termEq(a, b proofTerm) bool {
	return a.leafID == b.leafID && a.sigMeta.SigChainLocation.Seqno == b.sigMeta.SigChainLocation.Seqno
}

func TestAddNeededHappensBeforeProof(t *testing.T) {
	ps := newProofSet()

	a := createProofTerm(1, keybase1.Seqno(10))
	b := createProofTerm(2, keybase1.Seqno(100))
	c := createProofTerm(1, keybase1.Seqno(40))
	d := createProofTerm(2, keybase1.Seqno(400))
	e := createProofTerm(1, keybase1.Seqno(80))
	f := createProofTerm(2, keybase1.Seqno(800))

	// Test moving in only the right side
	g := createProofTerm(1, keybase1.Seqno(10))
	h := createProofTerm(2, keybase1.Seqno(98))

	// Test moving in only the left side
	i := createProofTerm(1, keybase1.Seqno(42))
	j := createProofTerm(2, keybase1.Seqno(400))

	// Test moving in both sides
	k := createProofTerm(1, keybase1.Seqno(84))
	l := createProofTerm(2, keybase1.Seqno(798))

	// Should be a new proof
	m := createProofTerm(2, keybase1.Seqno(402))
	n := createProofTerm(1, keybase1.Seqno(52))

	// Makes a new proof, also, since didn't overlap
	o := createProofTerm(2, keybase1.Seqno(404))
	p := createProofTerm(1, keybase1.Seqno(50))

	// Clamps the {m,n} proof
	q := createProofTerm(2, keybase1.Seqno(403))
	r := createProofTerm(1, keybase1.Seqno(49))

	ps = ps.AddNeededHappensBeforeProof(a, b)
	ps = ps.AddNeededHappensBeforeProof(c, d)
	ps = ps.AddNeededHappensBeforeProof(e, f)
	ps = ps.AddNeededHappensBeforeProof(g, h)
	ps = ps.AddNeededHappensBeforeProof(i, j)
	ps = ps.AddNeededHappensBeforeProof(k, l)
	ps = ps.AddNeededHappensBeforeProof(m, n)
	ps = ps.AddNeededHappensBeforeProof(o, p)
	ps = ps.AddNeededHappensBeforeProof(q, r)

	ret := ps.AllProofs()

	require.Equal(t, len(ret), 5)
	require.True(t, proofEq(ret[0], proof{a, h}))
	require.True(t, proofEq(ret[1], proof{i, d}))
	require.True(t, proofEq(ret[2], proof{k, l}))
	require.True(t, proofEq(ret[3], proof{q, r}))
	require.True(t, proofEq(ret[4], proof{o, p}))
}
