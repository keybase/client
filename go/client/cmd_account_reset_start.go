package client

import (
	"fmt"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

// Start the reset pipeline
type CmdAccountResetStart struct {
	libkb.Contextified
	usernameOrEmail string
}

func NewCmdAccountResetStart(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "reset-start",
		Usage:        "Start the reset process for your account with your username or email",
		ArgumentHelp: "[username or email]",
		Action: func(c *cli.Context) {
			cmd := NewCmdAccountResetStartRunner(g)
			cl.ChooseCommand(cmd, "reset-start", c)
		},
	}
}

func NewCmdAccountResetStartRunner(g *libkb.GlobalContext) *CmdAccountResetStart {
	return &CmdAccountResetStart{Contextified: libkb.NewContextified(g)}
}

func (c *CmdAccountResetStart) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 1 {
		return fmt.Errorf("username or email required")
	}

	c.usernameOrEmail = ctx.Args().Get(0)
	return nil
}

func (c *CmdAccountResetStart) Run() error {
	protocols := []rpc.Protocol{
		NewSecretUIProtocol(c.G()),
		NewLoginUIProtocol(c.G()),
	}
	if err := RegisterProtocolsWithContext(protocols, c.G()); err != nil {
		return err
	}
	cli, err := GetAccountClient(c.G())
	if err != nil {
		return err
	}
	dui := c.G().UI.GetDumbOutputUI()
	err = cli.EnterResetPipeline(context.Background(), keybase1.EnterResetPipelineArg{
		UsernameOrEmail: c.usernameOrEmail,
	})
	if err != nil {
		dui.Printf("Unable to start account reset process: %v\n", err)
		return err
	}
	dui.Printf("Account reset started.\n")
	return nil

}

func (c *CmdAccountResetStart) GetUsage() libkb.Usage {
	return libkb.Usage{
		API:    true,
		Config: true,
	}
}
