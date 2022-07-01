package client

import (
	"errors"
	"time"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	gregor1 "github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

// Cancel the reset pipeline
type CmdAccountResetTimeTravel struct {
	libkb.Contextified
	username string
	duration time.Duration
}

func NewCmdAccountResetTimeTravel(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "reset-time-travel",
		Usage: "Time travel further into the reset process [devel-only]",
		Action: func(c *cli.Context) {
			cmd := NewCmdAccountResetTimeTravelRunner(g)
			cl.ChooseCommand(cmd, "reset-time-travel", c)
			cl.SetSkipAccountResetCheck()
		},
	}
}

func NewCmdAccountResetTimeTravelRunner(g *libkb.GlobalContext) *CmdAccountResetTimeTravel {
	return &CmdAccountResetTimeTravel{Contextified: libkb.NewContextified(g)}
}

func (c *CmdAccountResetTimeTravel) ParseArgv(ctx *cli.Context) (err error) {
	if len(ctx.Args()) != 1 && len(ctx.Args()) != 2 {
		return errors.New("invalid usage, expected [username?] [duration]")
	}

	if len(ctx.Args()) == 2 {
		// [username] [duration]
		c.username = ctx.Args().Get(0)
		c.duration, err = time.ParseDuration(ctx.Args().Get(1))
		return err
	}

	c.duration, err = time.ParseDuration(ctx.Args().Get(0))
	return err
}

func (c *CmdAccountResetTimeTravel) Run() error {
	cli, err := GetAccountClient(c.G())
	if err != nil {
		return err
	}
	return cli.TimeTravelReset(context.Background(), keybase1.TimeTravelResetArg{
		Duration: gregor1.ToDurationSec(c.duration),
		Username: c.username,
	})
}

func (c *CmdAccountResetTimeTravel) GetUsage() libkb.Usage {
	return libkb.Usage{
		API:    true,
		Config: true,
	}
}
