package main

import (
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase_1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type MykeyHandler struct {
	BaseHandler
}

func NewMykeyHandler(xp *rpc2.Transport) *MykeyHandler {
	return &MykeyHandler{BaseHandler{xp: xp}}
}

func (h *MykeyHandler) KeyGen(arg keybase_1.KeyGenArg) (err error) {
	iarg := libkb.ImportKeyGenArg(arg)
	return h.keygen(iarg, true)
}

func (h *MykeyHandler) keygen(iarg libkb.PGPGenArg, doInteractive bool) (err error) {
	sessionId := nextSessionId()
	ctx := &engine.Context{LogUI: h.getLogUI(sessionId), SecretUI: h.getSecretUI(sessionId)}
	iarg.AddDefaultUid()
	eng := engine.NewPGPEngine(engine.PGPEngineArg{Gen: &iarg})
	err = engine.RunEngine(eng, ctx, nil, nil)
	return err
}

func (h *MykeyHandler) KeyGenDefault(arg keybase_1.KeyGenDefaultArg) (err error) {
	iarg := libkb.PGPGenArg{
		Ids:         libkb.ImportPgpIdentities(arg.CreateUids.Ids),
		NoDefPGPUid: !arg.CreateUids.UseDefault,
	}
	return h.keygen(iarg, false)
}

func (h *MykeyHandler) DeletePrimary() (err error) {
	return libkb.DeletePrimary()
}

func (h *MykeyHandler) Show() (err error) {
	sessionId := nextSessionId()
	return libkb.ShowKeys(h.getLogUI(sessionId))
}

func (h *MykeyHandler) Select(query string) error {
	sessionID := nextSessionId()
	gpgui := NewRemoteGPGUI(sessionID, h.getRpcClient())
	secretui := h.getSecretUI(sessionID)
	gpg := engine.NewGPG()
	arg := engine.GPGArg{Query: query, LoadDeviceKey: true}
	ctx := &engine.Context{
		GPGUI:    gpgui,
		SecretUI: secretui,
		LogUI:    h.getLogUI(sessionID),
		LoginUI:  h.getLoginUI(sessionID),
	}
	return engine.RunEngine(gpg, ctx, arg, nil)
}
