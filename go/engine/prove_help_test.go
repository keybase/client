package engine

import (
	"fmt"

	libkb "github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

type ProveUIMock struct {
	username, recheck, overwrite, warning, checked bool
	postID                                         string
	hook                                           func(arg keybase1.OkToCheckArg) (bool, string, error)
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
		ok, postID, err := p.hook(arg)
		p.postID = postID
		return ok, err
	}
	return false, fmt.Errorf("Check should have worked the first time!")
}

func (p *ProveUIMock) DisplayRecheckWarning(arg keybase1.DisplayRecheckWarningArg) error {
	p.recheck = true
	return nil
}

func proveRooter(g *libkb.GlobalContext, fu *FakeUser) (*ProveUIMock, keybase1.SigID, error) {
	return proveRooterWithSecretUI(g, fu, fu.NewSecretUI())
}

func proveRooterWithSecretUI(g *libkb.GlobalContext, fu *FakeUser, secretUI libkb.SecretUI) (*ProveUIMock, keybase1.SigID, error) {
	arg := keybase1.StartProofArg{
		Service:      "rooter",
		Username:     fu.Username,
		Force:        false,
		PromptPosted: true,
	}

	eng := NewProve(&arg, g)

	hook := func(arg keybase1.OkToCheckArg) (bool, string, error) {
		sigID := eng.sigID
		if sigID.IsNil() {
			return false, "", fmt.Errorf("empty sigID; can't make a post")
		}
		apiArg := libkb.APIArg{
			Endpoint:    "rooter",
			NeedSession: true,
			Args: libkb.HTTPArgs{
				"post": libkb.S{Val: sigID.ToMediumID()},
			},
		}
		res, err := g.API.Post(apiArg)
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

	ctx := Context{
		LogUI:    g.UI.GetLogUI(),
		SecretUI: secretUI,
		ProveUI:  proveUI,
	}

	err := RunEngine(eng, &ctx)
	return proveUI, eng.sigID, err
}

func proveRooterFail(g *libkb.GlobalContext, fu *FakeUser) (*ProveUIMock, error) {
	arg := keybase1.StartProofArg{
		Service:      "rooter",
		Username:     fu.Username,
		Force:        false,
		PromptPosted: true,
	}

	eng := NewProve(&arg, g)

	hook := func(arg keybase1.OkToCheckArg) (bool, string, error) {
		apiArg := libkb.APIArg{
			Endpoint:    "rooter",
			NeedSession: true,
			Args: libkb.HTTPArgs{
				"post": libkb.S{Val: "XXXXXXX"},
			},
		}
		res, err := g.API.Post(apiArg)
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

	ctx := Context{
		LogUI:    g.UI.GetLogUI(),
		SecretUI: fu.NewSecretUI(),
		ProveUI:  proveUI,
	}

	err := RunEngine(eng, &ctx)
	return proveUI, err
}

func proveRooterRemove(g *libkb.GlobalContext, postID string) error {
	apiArg := libkb.APIArg{
		Endpoint:    "rooter/delete",
		NeedSession: true,
		Args: libkb.HTTPArgs{
			"post_id": libkb.S{Val: postID},
		},
	}
	_, err := g.API.Post(apiArg)
	return err
}

func proveRooterOther(g *libkb.GlobalContext, fu *FakeUser, rooterUsername string) (*ProveUIMock, keybase1.SigID, error) {
	arg := keybase1.StartProofArg{
		Service:      "rooter",
		Username:     rooterUsername,
		Force:        false,
		PromptPosted: true,
	}

	eng := NewProve(&arg, g)

	hook := func(arg keybase1.OkToCheckArg) (bool, string, error) {
		sigID := eng.sigID
		if sigID.IsNil() {
			return false, "", fmt.Errorf("empty sigID; can't make a post")
		}
		apiArg := libkb.APIArg{
			Endpoint:    "rooter",
			NeedSession: true,
			Args: libkb.HTTPArgs{
				"post":     libkb.S{Val: sigID.ToMediumID()},
				"username": libkb.S{Val: rooterUsername},
			},
		}
		res, err := g.API.Post(apiArg)
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

	ctx := Context{
		LogUI:    g.UI.GetLogUI(),
		SecretUI: fu.NewSecretUI(),
		ProveUI:  proveUI,
	}

	err := RunEngine(eng, &ctx)
	return proveUI, eng.sigID, err
}
