package engine

import ( 
	"testing"
	keybase1 "github.com/keybase/client/protocol/go"
	libkb "github.com/keybase/client/go/libkb"
	"fmt"
)

type ProveUIMock struct {
	username, recheck, overwrite, warning, checked bool
	hook func(arg keybase1.OkToCheckArg) (bool, error)
}

func (p *ProveUIMock) PromptOverwrite(arg keybase1.PromptOverwriteArg) (bool, error) {
	p.overwrite = true
	return true, nil
}

func (p *ProveUIMock) PromptUsername(arg keybase1.PromptUsernameArg) (string, error) {
	p.username = true
	return "", nil
}

func (p *ProveUIMock) OutputPrechecks(arg keybase1.OutputPrechecksArg) error {
	return nil
}

func (p *ProveUIMock) PreProofWarning(arg keybase1.PreProofWarningArg) (bool, error) {
	p.warning = true
	return true, nil
}

func (p *ProveUIMock) OutputInstructions(arg keybase1.OutputInstructionsArg) error {
	return nil
}

func (p *ProveUIMock) OkToCheck(arg keybase1.OkToCheckArg) (bool, error) {
	if !p.checked {
		p.checked = true
		return p.hook(arg)
	} else {
		return false, fmt.Errorf("Check should have worked the first time!")
	}
}

func (p *ProveUIMock) DisplayRecheckWarning(arg keybase1.DisplayRecheckWarningArg) error {
	p.recheck = true
	return nil
}

func TestProveRooter(t *testing.T) {

	tc := SetupEngineTest(t, "prove")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUser(tc, "prove")
	arg := keybase1.StartProofArg{
		Service : "rooter",
		Username : fu.Username,
		Force : false,
	}
	
	eng := NewProve(&arg, tc.G)

	hook := func(arg keybase1.OkToCheckArg) (bool, error) {
		sigID := eng.sigID
		if sigID == nil {
			return false, fmt.Errorf("nil sigID; can't make a post!")
		}
		apiArg := libkb.ApiArg {
			Endpoint : "rooter",
			NeedSession : true,
			Args : libkb.HttpArgs {
				"post" : libkb.S{Val:sigID.ToMediumId()},
			},
		}
		_, err := tc.G.API.Post(apiArg)
		return (err == nil), err
	}

	proveUI := &ProveUIMock{ hook: hook }

	ctx := Context{
		LogUI:      tc.G.UI.GetLogUI(),
		SecretUI:   fu.NewSecretUI(),
		ProveUI:    proveUI,
	}

	err := RunEngine(eng, &ctx)
	if err != nil {
		t.Fatal(err)
	}	
	if proveUI.overwrite {
		t.Fatal("unexpected prompt for overwrite in test")
	}
	if proveUI.warning {
		t.Fatal("got unexpected warning in test")
	}
	if proveUI.recheck {
		t.Fatal("unexpected recheck")
	}

}