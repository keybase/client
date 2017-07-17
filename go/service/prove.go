// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

// ProveHandler is the service side of proving ownership of social media accounts
// like Twitter and Github.
type ProveHandler struct {
	*BaseHandler
	libkb.Contextified
}

type proveUI struct {
	sessionID int
	cli       keybase1.ProveUiClient
}

// NewProveHandler makes a new ProveHandler object from an RPC transport.
func NewProveHandler(xp rpc.Transporter, g *libkb.GlobalContext) *ProveHandler {
	return &ProveHandler{
		BaseHandler:  NewBaseHandler(xp),
		Contextified: libkb.NewContextified(g),
	}
}

func (p *proveUI) PromptOverwrite(ctx context.Context, arg keybase1.PromptOverwriteArg) (b bool, err error) {
	arg.SessionID = p.sessionID
	return p.cli.PromptOverwrite(ctx, arg)
}
func (p *proveUI) PromptUsername(ctx context.Context, arg keybase1.PromptUsernameArg) (un string, err error) {
	arg.SessionID = p.sessionID
	return p.cli.PromptUsername(ctx, arg)
}
func (p *proveUI) OutputPrechecks(ctx context.Context, arg keybase1.OutputPrechecksArg) error {
	arg.SessionID = p.sessionID
	return p.cli.OutputPrechecks(ctx, arg)
}
func (p *proveUI) PreProofWarning(ctx context.Context, arg keybase1.PreProofWarningArg) (ok bool, err error) {
	arg.SessionID = p.sessionID
	return p.cli.PreProofWarning(ctx, arg)
}
func (p *proveUI) OutputInstructions(ctx context.Context, arg keybase1.OutputInstructionsArg) (err error) {
	arg.SessionID = p.sessionID
	return p.cli.OutputInstructions(ctx, arg)
}
func (p *proveUI) OkToCheck(ctx context.Context, arg keybase1.OkToCheckArg) (bool, error) {
	arg.SessionID = p.sessionID
	return p.cli.OkToCheck(ctx, arg)
}
func (p *proveUI) DisplayRecheckWarning(ctx context.Context, arg keybase1.DisplayRecheckWarningArg) error {
	arg.SessionID = p.sessionID
	return p.cli.DisplayRecheckWarning(ctx, arg)
}

func (ph *ProveHandler) getProveUI(sessionID int) libkb.ProveUI {
	return &proveUI{sessionID, keybase1.ProveUiClient{Cli: ph.rpcClient()}}
}

// Prove handles the `keybase.1.startProof` RPC.
func (ph *ProveHandler) StartProof(_ context.Context, arg keybase1.StartProofArg) (res keybase1.StartProofResult, err error) {
	eng := engine.NewProve(&arg, ph.G())
	ctx := engine.Context{
		ProveUI:   ph.getProveUI(arg.SessionID),
		SecretUI:  ph.getSecretUI(arg.SessionID, ph.G()),
		LogUI:     ph.getLogUI(arg.SessionID),
		SessionID: arg.SessionID,
	}
	err = engine.RunEngine(eng, &ctx)
	if err != nil {
		return res, err
	}
	res.SigID = eng.SigID()
	return res, err
}

func (ph *ProveHandler) CheckProof(_ context.Context, arg keybase1.CheckProofArg) (res keybase1.CheckProofStatus, err error) {
	eng := engine.NewProveCheck(ph.G(), arg.SigID)
	ctx := &engine.Context{}
	if err = engine.RunEngine(eng, ctx); err != nil {
		return
	}
	found, status, state, text := eng.Results()
	res = keybase1.CheckProofStatus{Found: found, Status: status, State: state, ProofText: text}

	return
}
