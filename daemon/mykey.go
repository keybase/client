package main

import (
	"github.com/keybase/go/libkb"
	"github.com/keybase/go/engine"
	keybase_1 "github.com/keybase/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type MykeyHandler struct {
	BaseHandler
	keyGenUI libkb.KeyGenUI
}

type KeyGenUI struct {
	sessionId int
	cli       keybase_1.MykeyUiClient
}

func NewMykeyHandler(xp *rpc2.Transport) *MykeyHandler {
	return &MykeyHandler{BaseHandler{xp: xp}, nil}
}

func (p *KeyGenUI) GetPushPreferences() (ret keybase_1.PushPreferences, err error) {
	return p.cli.GetPushPreferences()
}

func (h *MykeyHandler) getKeyGenUI(sessionId int) libkb.KeyGenUI {
	if h.keyGenUI == nil {
		h.keyGenUI = &KeyGenUI{
			sessionId: sessionId,
			cli:       keybase_1.MykeyUiClient{h.getRpcClient()},
		}
	}
	return h.keyGenUI
}

func (h *MykeyHandler) KeyGen(arg keybase_1.KeyGenArg) (err error) {
	iarg := libkb.ImportKeyGenArg(arg)
	return h.keygen(iarg, true)
}

func (h *MykeyHandler) keygen(iarg libkb.KeyGenArg, doInteractive bool) (err error) {
	sessionId := nextSessionId()
	iarg.LogUI = h.getLogUI(sessionId)
	iarg.LoginUI = h.getLoginUI(sessionId)
	if doInteractive {
		iarg.KeyGenUI = h.getKeyGenUI(sessionId)
	}
	iarg.SecretUI = h.getSecretUI(sessionId)
	iarg.AddDefaultUid()
	eng := libkb.NewKeyGen(&iarg)
	_, err = eng.Run()
	return
}

func (h *MykeyHandler) KeyGenDefault(arg keybase_1.KeyGenDefaultArg) (err error) {
	iarg := libkb.KeyGenArg{
		Ids:          libkb.ImportPgpIdentities(arg.CreateUids.Ids),
		NoDefPGPUid:  !arg.CreateUids.UseDefault,
		Passphrase:   arg.Passphrase,
		KbPassphrase: (len(arg.Passphrase) == 0),
		NoPublicPush: !arg.PushPublic,
		DoSecretPush: arg.PushSecret,
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
	ctx := engine.NewContext(gpgui, secretui)
	return engine.RunEngine(gpg, ctx, arg, nil)
}
