package client

import (
	keybase1 "github.com/keybase/client/go/protocol"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

func newChangeArg(newPassphrase string, force bool) keybase1.PassphraseChangeArg {
	return keybase1.PassphraseChangeArg{
		Passphrase: newPassphrase,
		Force:      force,
	}
}

func passphraseChange(arg keybase1.PassphraseChangeArg) error {
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
