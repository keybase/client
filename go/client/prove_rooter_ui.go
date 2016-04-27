package client

// An implementation of ProveUI for automatic posting of rooter
// proofs.

import (
	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

type ProveRooterUI struct {
	libkb.Contextified
	rooterUsername string
}

func (p *ProveRooterUI) PromptUsername(_ context.Context, _ keybase1.PromptUsernameArg) (string, error) {
	return p.rooterUsername, nil
}

func (p *ProveRooterUI) OutputInstructions(_ context.Context, arg keybase1.OutputInstructionsArg) error {
	p.G().Log.Debug("rooter proof: %s", arg.Proof)
	p.G().Log.Debug("posting it to rooter...")
	apiArg := libkb.APIArg{
		Endpoint:    "rooter",
		NeedSession: true,
		Args: libkb.HTTPArgs{
			"post":     libkb.S{Val: arg.Proof},
			"username": libkb.S{Val: p.rooterUsername},
		},
		Contextified: libkb.NewContextified(p.G()),
	}
	_, err := p.G().API.Post(apiArg)
	if err != nil {
		p.G().Log.Debug("error posting to rooter: %s", err)
		return err
	}
	p.G().Log.Debug("rooter post success")
	return nil
}

func (p *ProveRooterUI) PromptOverwrite(_ context.Context, _ keybase1.PromptOverwriteArg) (bool, error) {
	return true, nil
}

func (p *ProveRooterUI) OutputPrechecks(_ context.Context, _ keybase1.OutputPrechecksArg) error {
	return nil
}

func (p *ProveRooterUI) PreProofWarning(_ context.Context, _ keybase1.PreProofWarningArg) (bool, error) {
	return true, nil
}

func (p *ProveRooterUI) DisplayRecheckWarning(_ context.Context, _ keybase1.DisplayRecheckWarningArg) error {
	return nil
}

func (p *ProveRooterUI) OkToCheck(_ context.Context, _ keybase1.OkToCheckArg) (bool, error) {
	return true, nil
}
