package client

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type SecretUIServer struct {
	eng libkb.SecretUI
}

func NewSecretUIProtocol() rpc2.Protocol {
	return keybase1.SecretUiProtocol(&SecretUIServer{GlobUI.GetSecretUI()})
}

func (s *SecretUIServer) GetSecret(arg keybase1.GetSecretArg) (res keybase1.SecretEntryRes, err error) {
	var resp *keybase1.SecretEntryRes
	resp, err = s.eng.GetSecret(arg.Pinentry, arg.Terminal)
	if resp != nil {
		res = *resp
	}
	return
}

func (s *SecretUIServer) GetNewPassphrase(arg keybase1.GetNewPassphraseArg) (keybase1.GetNewPassphraseRes, error) {
	return s.eng.GetNewPassphrase(arg)
}

func (s *SecretUIServer) GetKeybasePassphrase(arg keybase1.GetKeybasePassphraseArg) (string, error) {
	return s.eng.GetKeybasePassphrase(arg)
}
