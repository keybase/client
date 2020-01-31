package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestWebOfTrust(t *testing.T) {
	tc := SetupEngineTest(t, "wot")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUser(tc, "wot")
	_ = fu

	me, err := libkb.LoadMe(libkb.NewLoadUserArg(tc.G))
	require.NoError(tc.T, err)
	idt := me.IDTable()
	lenBefore := idt.Len()

	arg := &WotAttestArg{
		Attestee:     keybase1.UserVersion{Uid: keybase1.UID("295a7eea607af32040647123732bc819"), EldestSeqno: 1}, // t_alice
		Attestations: []string{"alice is awesome"},
	}

	eng := NewWotAttest(tc.G, arg)
	mctx := NewMetaContextForTest(tc)
	err = RunEngine2(mctx, eng)
	require.NoError(t, err)

	me, err = libkb.LoadMe(libkb.NewLoadUserArg(tc.G))
	require.NoError(tc.T, err)
	idt = me.IDTable()

	// for now, let's just check that it got bigger:
	require.Equal(tc.T, lenBefore+1, idt.Len())

	// make an attest with confidence stuff
	arg = &WotAttestArg{
		Attestee:     keybase1.UserVersion{Uid: keybase1.UID("9d56bd0c02ac2711e142faf484ea9519"), EldestSeqno: 1}, // t_alice
		Attestations: []string{"charlie rocks"},
		Confidence: keybase1.Confidence{
			UsernameVerifiedVia: keybase1.UsernameVerificationType_VIDEO,
			VouchedBy:           []string{"t_doug"},
			KnownOnKeybaseDays:  78,
		},
	}
	eng = NewWotAttest(tc.G, arg)
	err = RunEngine2(mctx, eng)
	require.NoError(t, err)

	me, err = libkb.LoadMe(libkb.NewLoadUserArg(tc.G))
	require.NoError(tc.T, err)
	idt = me.IDTable()
	require.Equal(tc.T, lenBefore+2, idt.Len())

	// make sure that if the user is attesting to something about
	// a user and eldest seqno changes, that they get an error.
	arg = &WotAttestArg{
		Attestee:     keybase1.UserVersion{Uid: keybase1.UID("afb5eda3154bc13c1df0189ce93ba119"), EldestSeqno: 2}, // t_bob w/ wrong eldest seqno
		Attestations: []string{"bob is nice"},
	}
	eng = NewWotAttest(tc.G, arg)
	err = RunEngine2(mctx, eng)
	require.Error(t, err)

	me, err = libkb.LoadMe(libkb.NewLoadUserArg(tc.G))
	require.NoError(tc.T, err)
	idt = me.IDTable()
	require.Equal(tc.T, lenBefore+2, idt.Len())
}
