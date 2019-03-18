package client

import (
	"fmt"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

// Start the reset pipeline
type CmdAccountResetStart struct {
	libkb.Contextified
	username string
	email    string
}

// TODO CORE-10466, add support for optional password prompt.
func NewCmdAccountResetStart(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "reset-start",
		Usage: "Start the reset process for your account with your username or email",
		Action: func(c *cli.Context) {
			cmd := NewCmdAccountResetStartRunner(g)
			cl.ChooseCommand(cmd, "reset-start", c)
		},
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "email",
				Usage: "Specify you account email",
			},
			cli.StringFlag{
				Name:  "username",
				Usage: "Specify your account username",
			},
		},
	}
}

func NewCmdAccountResetStartRunner(g *libkb.GlobalContext) *CmdAccountResetStart {
	return &CmdAccountResetStart{Contextified: libkb.NewContextified(g)}
}

func (c *CmdAccountResetStart) ParseArgv(ctx *cli.Context) error {
	c.email = ctx.String("email")
	c.username = ctx.String("username")

	if len(c.email) > 0 && len(c.username) > 0 {
		return fmt.Errorf("only email or username can be specified")
	}
	return nil
}

func (c *CmdAccountResetStart) Run() error {
	cli, err := GetAccountClient(c.G())
	if err != nil {
		return err
	}
	return cli.EnterResetPipeline(context.Background(), keybase1.EnterResetPipelineArg{
		Username: c.username,
		Email:    c.email,
	})
}

func (c *CmdAccountResetStart) GetUsage() libkb.Usage {
	return libkb.Usage{
		API:    true,
		Config: true,
	}
}
