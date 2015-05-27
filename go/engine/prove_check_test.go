package engine

import (
	"fmt"
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
)

func TestProveCheck(t *testing.T) {
	tc := SetupEngineTest(t, "prove check")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUser(tc, "prove")
	arg := keybase1.StartProofArg{
		Service:      "rooter",
		Username:     fu.Username,
		Force:        false,
		PromptPosted: true,
	}

	eng := NewProve(&arg, tc.G)

	hook := func(arg keybase1.OkToCheckArg) (bool, error) {
		sigID := eng.sigID
		if sigID.IsNil() {
			return false, fmt.Errorf("empty sigID; can't make a post!")
		}
		apiArg := libkb.ApiArg{
			Endpoint:    "rooter",
			NeedSession: true,
			Args: libkb.HttpArgs{
				"post": libkb.S{Val: sigID.ToMediumID()},
			},
		}
		_, err := tc.G.API.Post(apiArg)
		return (err == nil), err
	}

	proveUI := &ProveUIMock{hook: hook}

	ctx := Context{
		LogUI:    tc.G.UI.GetLogUI(),
		SecretUI: fu.NewSecretUI(),
		ProveUI:  proveUI,
	}

	err := RunEngine(eng, &ctx)
	if err != nil {
		t.Fatal(err)
	}

	checkEng := NewProveCheck(tc.G, eng.sigID)
	err = RunEngine(checkEng, &ctx)
	if err != nil {
		t.Fatal(err)
	}

	found, status, text := checkEng.Results()
	if !found {
		t.Errorf("proof not found, expected to be found")
	}
	if status != 1 {
		t.Errorf("proof status: %d, expected 1", status)
	}
	if len(text) == 0 {
		t.Errorf("empty proof text, expected non-empty")
	}
}
