package client

import (
	"github.com/keybase/client/go/engine"
	keybase1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type changer interface {
	change(arg keybase1.PassphraseChangeArg) error
}

func newChangeArg(newPassphrase string, force bool) keybase1.PassphraseChangeArg {
	return keybase1.PassphraseChangeArg{
		Passphrase: newPassphrase,
		Force:      force,
	}
}

type changerStandalone struct{}

func (s *changerStandalone) change(arg keybase1.PassphraseChangeArg) error {
	ctx := &engine.Context{
		SecretUI: G.UI.GetSecretUI(),
	}
	eng := engine.NewPassphraseChange(&arg, G)
	return engine.RunEngine(eng, ctx)
}

type changerClient struct{}

func (c *changerClient) change(arg keybase1.PassphraseChangeArg) error {
	cli, err := GetAccountClient()
	if err != nil {
		return err
	}
	protocols := []rpc2.Protocol{
		NewSecretUIProtocol(),
	}
	if err := RegisterProtocols(protocols); err != nil {
		return err
	}
	return cli.PassphraseChange(arg)
}
