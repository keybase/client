package engine

import (
	"fmt"
	"testing"

	"github.com/keybase/client/go/libkb"
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
	fmt.Printf("id table: (%d) %+v\n", lenBefore, idt)

	eng := NewWotAttest(tc.G)
	mctx := NewMetaContextForTest(tc)
	err = RunEngine2(mctx, eng)
	require.NoError(t, err)

	me, err = libkb.LoadMe(libkb.NewLoadUserArg(tc.G))
	require.NoError(tc.T, err)
	idt = me.IDTable()
	fmt.Printf("id table: (%d) %+v\n", idt.Len(), idt)

	// for now, let's just check that it got bigger:
	require.Equal(tc.T, lenBefore+1, idt.Len())
}
