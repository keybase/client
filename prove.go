package main

import (
	"github.com/keybase/go-libkb"
	"github.com/keybase/protocol/go"
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

func NextProveUI(c *rpc2.Client) *ProveUI {
	return &ProveUI{
		sessionId: nextSessionId(),
		cli:       keybase_1.ProveUiClient{c},
	}
}

func (p *ProveUI) PromptOverwrite1(prompt string) (b bool, err error) {
	return
}
func (p *ProveUI) PromptOverwrite2(prompt string) (b bool, err error) {
	return
}
func (p *ProveUI) PromptUsername(prompt string, prevError error) (un string, err error) {
	return
}
func (p *ProveUI) OutputPrechecks(keybase_1.Text) {
	return
}
func (p *ProveUI) PreProofWarning(keybase_1.Text) (ok bool, err error) {
	return
}
func (p *ProveUI) OutputInstructions(instructions keybase_1.Text, proof string) (err error) {
	return
}
func (p *ProveUI) OkToCheck(name string, attempt int) (ok bool, err error) {
	return
}
func (p *ProveUI) DisplayRecheckWarning(keybase_1.Text) {
	return
}

func (h *ProveHandler) getProveUI() libkb.ProveUI {
	if h.proveUI == nil {
		h.proveUI = NextProveUI(h.getRpcClient())
	}
	return h.proveUI
}

func (ph *ProveHandler) Prove(arg keybase_1.ProveArg) (err error) {
	eng := &libkb.ProofEngine{
		Username: arg.Username,
		Service:  arg.Service,
		Force:    arg.Force,
		ProveUI:  ph.getProveUI(),
	}
	err = eng.Run()
	return
}
