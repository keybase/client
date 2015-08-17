package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
)

func TestPaperKeyPrimary(t *testing.T) {
	tc := SetupEngineTest(t, "paper")
	defer tc.Cleanup()

	f := func(arg *SignupEngineRunArg) {
		arg.SkipPaper = true
	}

	fu, signingKey := CreateAndSignupFakeUserCustomArg(tc, "paper", f)

	me, err := libkb.LoadMe(libkb.LoadUserArg{})
	if err != nil {
		t.Fatal(err)
	}

	ctx := &Context{
		LoginUI: libkb.TestLoginUI{},
	}
	args := &PaperKeyPrimaryArgs{
		Me:         me,
		SigningKey: signingKey,
	}
	eng := NewPaperKeyPrimary(tc.G, args)
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}

	hasOnePaperDev(t, fu)
}
