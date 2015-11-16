package client

import (
	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
)

func NewCmdTestPassphrase(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "test-passphrase",
		Usage: "Test the GetPassphrase protocol",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdTestPassphrase{Contextified: libkb.NewContextified(g)}, "test-passphrase", c)
		},
	}
}

type CmdTestPassphrase struct {
	libkb.Contextified
}

func (s *CmdTestPassphrase) ParseArgv(ctx *cli.Context) error {
	return nil
}

func (s *CmdTestPassphrase) GetUsage() libkb.Usage {
	return libkb.Usage{}
}

func (s *CmdTestPassphrase) Run() (err error) {
	s.G().Log.Debug("+ CmdTestPassphrase.Run")
	defer func() { s.G().Log.Debug("- CmdTestPassphrase.Run -> %s", libkb.ErrToOk(err)) }()

	protocols := []rpc.Protocol{
		NewSecretUIProtocol(s.G()),
	}
	if err = RegisterProtocols(protocols); err != nil {
		return err
	}

	cli, err := GetAccountClient(s.G())
	if err != nil {
		return err
	}

	err = cli.PassphrasePrompt(context.TODO(), 0)
	return err
}
