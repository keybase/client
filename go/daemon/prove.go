package main

import (
	"github.com/keybase/client/go/libkb"
	keybase_1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type ProveHandler struct {
	BaseHandler
	proveUI libkb.ProveUI
}

type ProveUI struct {
	sessionId int
	cli       keybase_1.ProveUiClient
}

func NewProveHandler(xp *rpc2.Transport) *ProveHandler {
	return &ProveHandler{BaseHandler{xp: xp}, nil}
}

func (p *ProveUI) PromptOverwrite(prompt string, typ keybase_1.PromptOverwriteType) (b bool, err error) {
	return p.cli.PromptOverwrite(keybase_1.PromptOverwriteArg{p.sessionId, prompt, typ})
}
func (p *ProveUI) PromptUsername(prompt string, prevError error) (un string, err error) {
	return p.cli.PromptUsername(keybase_1.PromptUsernameArg{p.sessionId, prompt, libkb.ExportErrorAsStatus(prevError)})
}
func (p *ProveUI) OutputPrechecks(txt keybase_1.Text) {
	p.cli.OutputPrechecks(keybase_1.OutputPrechecksArg{p.sessionId, txt})
}
func (p *ProveUI) PreProofWarning(txt keybase_1.Text) (ok bool, err error) {
	return p.cli.PreProofWarning(keybase_1.PreProofWarningArg{p.sessionId, txt})
}
func (p *ProveUI) OutputInstructions(instructions keybase_1.Text, proof string) (err error) {
	return p.cli.OutputInstructions(keybase_1.OutputInstructionsArg{p.sessionId, instructions, proof})
}
func (p *ProveUI) OkToCheck(name string, attempt int) (bool, error) {
	return p.cli.OkToCheck(keybase_1.OkToCheckArg{p.sessionId, name, attempt})
}
func (p *ProveUI) DisplayRecheckWarning(text keybase_1.Text) {
	p.cli.DisplayRecheckWarning(keybase_1.DisplayRecheckWarningArg{p.sessionId, text})
	return
}
func (l *SecretUI) GetSecret(pinentry keybase_1.SecretEntryArg, terminal *keybase_1.SecretEntryArg) (*keybase_1.SecretEntryRes, error) {
	res, err := l.cli.GetSecret(keybase_1.GetSecretArg{SessionID: l.sessionId, Pinentry: pinentry, Terminal: terminal})
	return &res, err
}
func (l *SecretUI) GetNewPassphrase(arg keybase_1.GetNewPassphraseArg) (string, error) {
	return l.cli.GetNewPassphrase(arg)
}
func (l *SecretUI) GetKeybasePassphrase(arg keybase_1.GetKeybasePassphraseArg) (string, error) {
	return l.cli.GetKeybasePassphrase(arg)
}

func (h *ProveHandler) getProveUI(sessionId int) libkb.ProveUI {
	if h.proveUI == nil {
		h.proveUI = &ProveUI{
			sessionId: sessionId,
			cli:       keybase_1.ProveUiClient{h.getRpcClient()},
		}
	}
	return h.proveUI
}

func (ph *ProveHandler) Prove(arg keybase_1.ProveArg) (err error) {
	sessionId := nextSessionId()
	eng := &libkb.ProofEngine{
		Username: arg.Username,
		Service:  arg.Service,
		Force:    arg.Force,
		ProveUI:  ph.getProveUI(sessionId),
		LoginUI:  ph.getLoginUI(sessionId),
		SecretUI: ph.getSecretUI(sessionId),
		LogUI:    ph.getLogUI(sessionId),
	}
	err = eng.Run()
	return
}
