// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"fmt"

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
		BaseHandler:  NewBaseHandler(g, xp),
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
func (p *proveUI) Checking(ctx context.Context, arg keybase1.CheckingArg) error {
	arg.SessionID = p.sessionID
	return p.cli.Checking(ctx, arg)
}
func (p *proveUI) ContinueChecking(ctx context.Context, _ int) (bool, error) {
	return p.cli.ContinueChecking(ctx, p.sessionID)
}
func (p *proveUI) DisplayRecheckWarning(ctx context.Context, arg keybase1.DisplayRecheckWarningArg) error {
	arg.SessionID = p.sessionID
	return p.cli.DisplayRecheckWarning(ctx, arg)
}

func (ph *ProveHandler) getProveUI(sessionID int) libkb.ProveUI {
	return &proveUI{sessionID, keybase1.ProveUiClient{Cli: ph.rpcClient()}}
}

// Prove handles the `keybase.1.startProof` RPC.
func (ph *ProveHandler) StartProof(ctx context.Context, arg keybase1.StartProofArg) (res keybase1.StartProofResult, err error) {
	ctx = libkb.WithLogTag(ctx, "PV")
	defer ph.G().CTraceTimed(ctx, fmt.Sprintf("StartProof: Service: %v, Username: %v", arg.Service, arg.Username), func() error { return err })()
	eng := engine.NewProve(ph.G(), &arg)
	uis := libkb.UIs{
		ProveUI:   ph.getProveUI(arg.SessionID),
		SecretUI:  ph.getSecretUI(arg.SessionID, ph.G()),
		LogUI:     ph.getLogUI(arg.SessionID),
		SessionID: arg.SessionID,
	}
	m := libkb.NewMetaContext(ctx, ph.G()).WithUIs(uis)
	if err = engine.RunEngine2(m, eng); err != nil {
		return res, err
	}
	res.SigID = eng.SigID()
	return res, err
}

func (ph *ProveHandler) ValidateUsername(ctx context.Context, arg keybase1.ValidateUsernameArg) error {
	mctx := libkb.NewMetaContext(ctx, ph.G())
	serviceType := mctx.G().GetProofServices().GetServiceType(ctx, arg.Service)
	if serviceType == nil {
		return libkb.BadServiceError{Service: arg.Service}
	}
	_, err := serviceType.NormalizeRemoteName(mctx, arg.Remotename)
	return err
}

// Prove handles the `keybase.1.checkProof` RPC.
func (ph *ProveHandler) CheckProof(ctx context.Context, arg keybase1.CheckProofArg) (res keybase1.CheckProofStatus, err error) {
	ctx = libkb.WithLogTag(ctx, "PV")
	defer ph.G().CTraceTimed(ctx, fmt.Sprintf("CheckProof: SigID: %v", arg.SigID), func() error { return err })()
	eng := engine.NewProveCheck(ph.G(), arg.SigID)
	m := libkb.NewMetaContext(ctx, ph.G())
	if err = engine.RunEngine2(m, eng); err != nil {
		return res, err
	}
	found, status, state, text := eng.Results()
	return keybase1.CheckProofStatus{
		Found:     found,
		Status:    status,
		State:     state,
		ProofText: text,
	}, nil
}

// Prove handles the `keybase.1.listProofServices` RPC.
func (ph *ProveHandler) ListProofServices(ctx context.Context) (res []string, err error) {
	ctx = libkb.WithLogTag(ctx, "PV")
	defer ph.G().CTraceTimed(ctx, fmt.Sprintf("ListProofServices"), func() error { return err })()
	mctx := libkb.NewMetaContext(ctx, ph.G())
	return ph.G().GetProofServices().ListServicesThatAcceptNewProofs(mctx), nil
}
