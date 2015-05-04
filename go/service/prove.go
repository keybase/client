package service

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type ProveHandler struct {
	*BaseHandler
	proveUI libkb.ProveUI
}

type ProveUI struct {
	sessionId int
	cli       keybase1.ProveUiClient
}

func NewProveHandler(xp *rpc2.Transport) *ProveHandler {
	return &ProveHandler{BaseHandler: NewBaseHandler(xp)}
}

func (p *ProveUI) PromptOverwrite(prompt string, typ keybase1.PromptOverwriteType) (b bool, err error) {
	return p.cli.PromptOverwrite(keybase1.PromptOverwriteArg{SessionID: p.sessionId, Account: prompt, Typ: typ})
}
func (p *ProveUI) PromptUsername(prompt string, prevError error) (un string, err error) {
	return p.cli.PromptUsername(keybase1.PromptUsernameArg{SessionID: p.sessionId, Prompt: prompt, PrevError: libkb.ExportErrorAsStatus(prevError)})
}
func (p *ProveUI) OutputPrechecks(txt keybase1.Text) {
	p.cli.OutputPrechecks(keybase1.OutputPrechecksArg{SessionID: p.sessionId, Text: txt})
}
func (p *ProveUI) PreProofWarning(txt keybase1.Text) (ok bool, err error) {
	return p.cli.PreProofWarning(keybase1.PreProofWarningArg{SessionID: p.sessionId, Text: txt})
}
func (p *ProveUI) OutputInstructions(instructions keybase1.Text, proof string) (err error) {
	return p.cli.OutputInstructions(keybase1.OutputInstructionsArg{SessionID: p.sessionId, Instructions: instructions, Proof: proof})
}
func (p *ProveUI) OkToCheck(name string, attempt int) (bool, error) {
	return p.cli.OkToCheck(keybase1.OkToCheckArg{SessionID: p.sessionId, Name: name, Attempt: attempt})
}
func (p *ProveUI) DisplayRecheckWarning(text keybase1.Text) {
	p.cli.DisplayRecheckWarning(keybase1.DisplayRecheckWarningArg{SessionID: p.sessionId, Text: text})
	return
}
func (l *SecretUI) GetSecret(pinentry keybase1.SecretEntryArg, terminal *keybase1.SecretEntryArg) (*keybase1.SecretEntryRes, error) {
	res, err := l.cli.GetSecret(keybase1.GetSecretArg{SessionID: l.sessionId, Pinentry: pinentry, Terminal: terminal})
	return &res, err
}
func (l *SecretUI) GetNewPassphrase(arg keybase1.GetNewPassphraseArg) (string, error) {
	return l.cli.GetNewPassphrase(arg)
}
func (l *SecretUI) GetKeybasePassphrase(arg keybase1.GetKeybasePassphraseArg) (string, error) {
	return l.cli.GetKeybasePassphrase(arg)
}

func (h *ProveHandler) getProveUI(sessionId int) libkb.ProveUI {
	if h.proveUI == nil {
		h.proveUI = &ProveUI{
			sessionId: sessionId,
			cli:       keybase1.ProveUiClient{Cli: h.getRpcClient()},
		}
	}
	return h.proveUI
}

func (ph *ProveHandler) Prove(arg keybase1.ProveArg) (err error) {
	sessionId := nextSessionID()
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
