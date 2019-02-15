package stellarsvc

import (
	"context"
	"math/rand"
	"sort"
	"testing"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/stellar"
	"github.com/stretchr/testify/require"
)

// TestSeqno tests the seqno provider that predicts seqnos for
// rapid payments.
//
// In particular, it is going to test the following scenario:
// Each time a user does an in-chat send, they make a new
// seqno provider and use it.  There is currently a race
// where the "pending" tx doesn't make it to wallet state
// before the second seqno provider refreshes the seqno
// from the network.
//
func TestSeqno(t *testing.T) {
	tcs, cleanup := setupNTests(t, 1)
	defer cleanup()

	acceptDisclaimer(tcs[0])
	rm := tcs[0].Backend
	accountID1 := rm.AddAccount()
	err := tcs[0].Srv.ImportSecretKeyLocal(context.Background(), stellar1.ImportSecretKeyLocalArg{
		SecretKey:   rm.SecretKey(accountID1),
		MakePrimary: true,
		Name:        "qq",
	})
	require.NoError(t, err)

	mctx := tcs[0].MetaContext()
	ws := tcs[0].Srv.walletState

	// in-chat send creates a new seqno provider for each message, so this
	// is simulating three in-chat send messages starting before the submit
	// payment happens.

	sp0, unlock := stellar.NewSeqnoProvider(mctx, ws)
	seqno0, err := sp0.SequenceForAccount(accountID1.String())
	unlock()
	require.NoError(t, err)

	sp1, unlock := stellar.NewSeqnoProvider(mctx, ws)
	seqno1, err := sp1.SequenceForAccount(accountID1.String())
	unlock()
	require.NoError(t, err)

	sp2, unlock := stellar.NewSeqnoProvider(mctx, ws)
	seqno2, err := sp2.SequenceForAccount(accountID1.String())
	unlock()
	require.NoError(t, err)

	t.Logf("seqno0: %d", seqno0)
	t.Logf("seqno1: %d", seqno1)
	t.Logf("seqno2: %d", seqno2)

	require.Equal(t, seqno0+1, seqno1, "seqno1")
	require.Equal(t, seqno0+2, seqno2, "seqno2")

}

// TestSeqnoConcurrent will check that concurrent seqno attempts
// arrive at submitpayment in order.
func TestSeqnoConcurrent(t *testing.T) {
	tcs, cleanup := setupNTests(t, 1)
	defer cleanup()

	acceptDisclaimer(tcs[0])
	rm := tcs[0].Backend
	accountID1 := rm.AddAccount()
	err := tcs[0].Srv.ImportSecretKeyLocal(context.Background(), stellar1.ImportSecretKeyLocalArg{
		SecretKey:   rm.SecretKey(accountID1),
		MakePrimary: true,
		Name:        "qq",
	})
	require.NoError(t, err)

	ws := tcs[0].Srv.walletState
	submits := make(chan uint64, 100)

	// fakePayment simulates getting a seqno and then "submitting" that
	// seqno after a delay.
	var fakePayment = func(t *testing.T) {
		mctx := libkb.NewMetaContextBackground(tcs[0].G)
		sp, unlock := stellar.NewSeqnoProvider(mctx, ws)
		defer unlock()
		seqno, err := sp.SequenceForAccount(accountID1.String())
		require.NoError(t, err)
		time.Sleep(time.Duration(rand.Intn(50)) * time.Millisecond)
		submits <- uint64(seqno)
	}

	numPayments := 10
	for i := 0; i < numPayments; i++ {
		go fakePayment(t)
	}

	seqnos := make([]uint64, numPayments)
	for i := 0; i < numPayments; i++ {
		seqnos[i] = <-submits
	}

	require.True(t, sort.SliceIsSorted(seqnos, func(i, j int) bool { return seqnos[i] < seqnos[j] }), "seqnos in order")
}
