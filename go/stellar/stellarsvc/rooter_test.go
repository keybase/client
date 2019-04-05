// Stuff copied from engine tests
package stellarsvc

import (
	"context"
	"fmt"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func proveRooter(tc *TestContext) (postID string, sigID keybase1.SigID) {
	ui, sigID, err := proveRooterWithSecretUI(tc.G, tc.Fu, &libkb.TestSecretUI{}, libkb.GetDefaultSigVersion(tc.G))
	require.NoError(tc.T, err)
	return ui.postID, sigID
}

func proveRooterWithSecretUI(g *libkb.GlobalContext, fu *kbtest.FakeUser, secretUI libkb.SecretUI, sigVersion libkb.SigVersion) (*ProveUIMock, keybase1.SigID, error) {
	sv := keybase1.SigVersion(sigVersion)
	arg := keybase1.StartProofArg{
		Service:      "rooter",
		Username:     fu.Username,
		Force:        false,
		PromptPosted: true,
		SigVersion:   &sv,
	}

	eng := engine.NewProve(g, &arg)

	hook := func(arg keybase1.OkToCheckArg) (bool, string, error) {
		sigID := eng.SigID()
		if sigID.IsNil() {
			return false, "", fmt.Errorf("empty sigID; can't make a post")
		}
		apiArg := libkb.APIArg{
			Endpoint:    "rooter",
			SessionType: libkb.APISessionTypeREQUIRED,
			Args: libkb.HTTPArgs{
				"post": libkb.S{Val: sigID.ToMediumID()},
			},
		}
		mctx := libkb.NewMetaContextTODO(g)
		res, err := g.API.Post(mctx, apiArg)
		ok := err == nil
		var postID string
		if ok {
			pid, err := res.Body.AtKey("post_id").GetString()
			if err == nil {
				postID = pid
			}
		}
		return ok, postID, err
	}

	proveUI := &ProveUIMock{hook: hook}

	uis := libkb.UIs{
		LogUI:    g.UI.GetLogUI(),
		SecretUI: secretUI,
		ProveUI:  proveUI,
	}
	m := libkb.NewMetaContextTODO(g).WithUIs(uis)
	err := engine.RunEngine2(m, eng)
	return proveUI, eng.SigID(), err
}

type ProveUIMock struct {
	username, recheck, overwrite, warning, checked bool
	postID                                         string
	hook                                           func(arg keybase1.OkToCheckArg) (bool, string, error)
}

func (p *ProveUIMock) PromptOverwrite(_ context.Context, arg keybase1.PromptOverwriteArg) (bool, error) {
	p.overwrite = true
	return true, nil
}

func (p *ProveUIMock) PromptUsername(_ context.Context, arg keybase1.PromptUsernameArg) (string, error) {
	p.username = true
	return "", nil
}

func (p *ProveUIMock) OutputPrechecks(_ context.Context, arg keybase1.OutputPrechecksArg) error {
	return nil
}

func (p *ProveUIMock) PreProofWarning(_ context.Context, arg keybase1.PreProofWarningArg) (bool, error) {
	p.warning = true
	return true, nil
}

func (p *ProveUIMock) OutputInstructions(_ context.Context, arg keybase1.OutputInstructionsArg) error {
	return nil
}

func (p *ProveUIMock) OkToCheck(_ context.Context, arg keybase1.OkToCheckArg) (bool, error) {
	if !p.checked {
		p.checked = true
		ok, postID, err := p.hook(arg)
		p.postID = postID
		return ok, err
	}
	return false, fmt.Errorf("Check should have worked the first time!")
}

func (p *ProveUIMock) Checking(_ context.Context, arg keybase1.CheckingArg) error {
	p.checked = true
	return nil
}

func (p *ProveUIMock) ContinueChecking(_ context.Context, _ int) (bool, error) {
	return true, nil
}

func (p *ProveUIMock) DisplayRecheckWarning(_ context.Context, arg keybase1.DisplayRecheckWarningArg) error {
	p.recheck = true
	return nil
}
