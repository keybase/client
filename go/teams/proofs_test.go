package teams

import (
	"context"
	"encoding/hex"
	"testing"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
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

func TestProofSetAdd(t *testing.T) {
	tc := SetupTest(t, "ps", 1)
	defer tc.Cleanup()

	ps := newProofSet(tc.G)

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

	ps.AddNeededHappensBeforeProof(context.TODO(), a, b, "")
	ps.AddNeededHappensBeforeProof(context.TODO(), c, d, "")
	ps.AddNeededHappensBeforeProof(context.TODO(), e, f, "")
	ps.AddNeededHappensBeforeProof(context.TODO(), g, h, "")
	ps.AddNeededHappensBeforeProof(context.TODO(), i, j, "")
	ps.AddNeededHappensBeforeProof(context.TODO(), k, l, "")
	ps.AddNeededHappensBeforeProof(context.TODO(), m, n, "")
	ps.AddNeededHappensBeforeProof(context.TODO(), o, p, "")
	ps.AddNeededHappensBeforeProof(context.TODO(), q, r, "")

	ret := ps.AllProofs()

	require.Len(t, ret, 5)
	require.True(t, proofEq(ret[0], proof{a, h, ""}))
	require.True(t, proofEq(ret[1], proof{i, d, ""}))
	require.True(t, proofEq(ret[2], proof{k, l, ""}))
	require.True(t, proofEq(ret[3], proof{q, r, ""}))
	require.True(t, proofEq(ret[4], proof{o, p, ""}))
}

func TestProofSetImply(t *testing.T) {
	tc := SetupTest(t, "ps", 1)
	defer tc.Cleanup()

	ps := newProofSet(tc.G)

	a := createProofTerm(1, keybase1.Seqno(1)) // user provisions device
	b := createProofTerm(2, keybase1.Seqno(1)) // signed link
	c := createProofTerm(2, keybase1.Seqno(2)) // signed link
	d := createProofTerm(2, keybase1.Seqno(3)) // signed link

	ps.AddNeededHappensBeforeProof(context.TODO(), a, b, "")
	ps.AddNeededHappensBeforeProof(context.TODO(), a, c, "")
	ps.AddNeededHappensBeforeProof(context.TODO(), a, d, "")

	ret := ps.AllProofs()
	for _, p := range ret {
		t.Logf("%v\n", p.shortForm())
	}
	require.Len(t, ret, 1)
	require.True(t, proofEq(ret[0], proof{a, b, ""}))
}

// proof orderings on the same chain should get dropped because they are self evident
func TestProofSetSameChain(t *testing.T) {
	tc := SetupTest(t, "ps", 1)
	defer tc.Cleanup()

	ps := newProofSet(tc.G)

	a := createProofTerm(1, keybase1.Seqno(10))
	b := createProofTerm(1, keybase1.Seqno(11))
	c := createProofTerm(1, keybase1.Seqno(12))

	ps.AddNeededHappensBeforeProof(context.TODO(), a, b, "")
	ps.AddNeededHappensBeforeProof(context.TODO(), b, c, "")

	ret := ps.AllProofs()
	for _, p := range ret {
		t.Logf("%v\n", p.shortForm())
	}
	require.Len(t, ret, 0)
}
