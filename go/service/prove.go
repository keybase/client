package service

import (
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

// ProveHandler is the service side of proving ownership of social media accounts
// like Twitter and Github.
type ProveHandler struct {
	*BaseHandler
}

type proveUI struct {
	sessionID int
	cli       keybase1.ProveUiClient
}

// NewProveHandler makes a new ProveHandler object from an RPC transport.
func NewProveHandler(xp *rpc2.Transport) *ProveHandler {
	return &ProveHandler{BaseHandler: NewBaseHandler(xp)}
}

func (p *proveUI) PromptOverwrite(arg keybase1.PromptOverwriteArg) (b bool, err error) {
	arg.SessionID = p.sessionID
	return p.cli.PromptOverwrite(arg)
}
func (p *proveUI) PromptUsername(arg keybase1.PromptUsernameArg) (un string, err error) {
	arg.SessionID = p.sessionID
	return p.cli.PromptUsername(arg)
}
func (p *proveUI) OutputPrechecks(arg keybase1.OutputPrechecksArg) error {
	arg.SessionID = p.sessionID
	return p.cli.OutputPrechecks(arg)
}
func (p *proveUI) PreProofWarning(arg keybase1.PreProofWarningArg) (ok bool, err error) {
	arg.SessionID = p.sessionID
	return p.cli.PreProofWarning(arg)
}
func (p *proveUI) OutputInstructions(arg keybase1.OutputInstructionsArg) (err error) {
	arg.SessionID = p.sessionID
	return p.cli.OutputInstructions(arg)
}
func (p *proveUI) OkToCheck(arg keybase1.OkToCheckArg) (bool, error) {
	arg.SessionID = p.sessionID
	return p.cli.OkToCheck(arg)
}
func (p *proveUI) DisplayRecheckWarning(arg keybase1.DisplayRecheckWarningArg) error {
	arg.SessionID = p.sessionID
	return p.cli.DisplayRecheckWarning(arg)
}

func (ph *ProveHandler) getProveUI(sessionID int) libkb.ProveUI {
	return &proveUI{sessionID, keybase1.ProveUiClient{Cli: ph.rpcClient()}}
}

// Prove handles the `keybase.1.startProof` RPC.
func (ph *ProveHandler) StartProof(arg keybase1.StartProofArg) (res keybase1.StartProofResult, err error) {
	eng := engine.NewProve(&arg, G)
	ctx := engine.Context{
		ProveUI:  ph.getProveUI(arg.SessionID),
		SecretUI: ph.getSecretUI(arg.SessionID),
		LogUI:    ph.getLogUI(arg.SessionID),
	}
	err = engine.RunEngine(eng, &ctx)
	if err != nil {
		return res, err
	}
	res.SigID = eng.SigID()
	return res, err
}

func (ph *ProveHandler) CheckProof(arg keybase1.CheckProofArg) (res keybase1.CheckProofStatus, err error) {
	eng := engine.NewProveCheck(G, arg.SigID)
	ctx := &engine.Context{}
	if err = engine.RunEngine(eng, ctx); err != nil {
		return
	}
	found, status, text := eng.Results()
	res = keybase1.CheckProofStatus{Found: found, Status: status, ProofText: text}

	return
}
