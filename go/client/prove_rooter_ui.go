package client

// An implementation of ProveUI for automatic posting of rooter
// proofs.

import (
	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type ProveRooterUI struct {
	libkb.Contextified
	Username string
}

func (p *ProveRooterUI) PromptUsername(_ context.Context, _ keybase1.PromptUsernameArg) (string, error) {
	return p.Username, nil
}

func (p *ProveRooterUI) OutputInstructions(_ context.Context, arg keybase1.OutputInstructionsArg) error {
	p.G().Log.Debug("rooter proof: %s", arg.Proof)
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

func (p *ProveRooterUI) Checking(_ context.Context, _ keybase1.CheckingArg) error {
	return nil
}

func (p *ProveRooterUI) ContinueChecking(_ context.Context, _ int) (bool, error) {
	return true, nil
}
