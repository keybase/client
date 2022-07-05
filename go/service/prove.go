// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"fmt"
	"sort"

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
	defer ph.G().CTrace(ctx, fmt.Sprintf("StartProof: Service: %v, Username: %v", arg.Service, arg.Username), &err)()
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
	defer ph.G().CTrace(ctx, fmt.Sprintf("CheckProof: SigID: %v", arg.SigID), &err)()
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

var choiceProofServices = map[string]int{
	"twitter":         1,
	"github":          2,
	"reddit":          3,
	"hackernews":      4,
	"facebook":        5,
	"web":             6,
	"https":           7,
	"http":            8,
	"dns":             9,
	"rooter":          10,
	"mastodon.social": 11,
}

func (ph *ProveHandler) ListSomeProofServices(ctx context.Context) (res []string, err error) {
	ctx = libkb.WithLogTag(ctx, "PV")
	defer ph.G().CTrace(ctx, fmt.Sprintf("ListSomeProofServices"), &err)()
	mctx := libkb.NewMetaContext(ctx, ph.G())
	var services []string
	for _, service := range ph.G().GetProofServices().ListServicesThatAcceptNewProofs(mctx) {
		if _, found := choiceProofServices[service]; found {
			services = append(services, service)
		}
	}
	sort.SliceStable(services, func(i, j int) bool { return choiceProofServices[services[i]] < choiceProofServices[services[j]] })
	return services, nil
}

func (ph *ProveHandler) ListProofServices(ctx context.Context) (res []string, err error) {
	ctx = libkb.WithLogTag(ctx, "PV")
	defer ph.G().CTrace(ctx, fmt.Sprintf("ListProofServices"), &err)()
	mctx := libkb.NewMetaContext(ctx, ph.G())
	return ph.G().GetProofServices().ListServicesThatAcceptNewProofs(mctx), nil
}
