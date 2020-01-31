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
		AttesteeUID:  keybase1.UID("295a7eea607af32040647123732bc819"), // t_alice
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
}
