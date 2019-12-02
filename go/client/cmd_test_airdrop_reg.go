package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

func newCmdTestAirdropReg(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "test-airdrop-reg",
		Usage: "Test the Airdrop Registration protocol",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdTestAirdropReg{Contextified: libkb.NewContextified(g)}, "test-airdrop-reg", c)
		},
	}
}

type CmdTestAirdropReg struct {
	libkb.Contextified
}

func (s *CmdTestAirdropReg) ParseArgv(ctx *cli.Context) error {
	return nil
}

func (s *CmdTestAirdropReg) GetUsage() libkb.Usage {
	return libkb.Usage{}
}

func (s *CmdTestAirdropReg) Run() (err error) {
	mctx := libkb.NewMetaContextBackground(s.G())
	test, err := GetTestClient(s.G())
	if err != nil {
		return err
	}
	err = test.TestAirdropReg(mctx.Ctx())
	if err != nil {
		return err
	}
	return nil
}
