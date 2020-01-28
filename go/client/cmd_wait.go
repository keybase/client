package client

import (
	"fmt"
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"golang.org/x/net/context"
	"time"
)

type CmdWait struct {
	libkb.Contextified
	duration int
}

const maxWaitTime = 60

func NewCmdWait(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "wait",
		Usage: "Waits for the keybase server to start up",
		Action: func(c *cli.Context) {
			cl.SetForkCmd(libcmdline.NoFork)
			cl.SetLogForward(libcmdline.LogForwardNone)
			cl.ChooseCommand(&CmdWait{Contextified: libkb.NewContextified(g)}, "wait", c)
		},
		Flags: []cli.Flag{
			cli.IntFlag{
				Name:   "duration, d",
				Value: 10,
				Usage:  "How many seconds to wait before timing out",
			},
		},
	}
}

func (c *CmdWait) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) > 1 {
		return UnexpectedArgsError("wait")
	}

	c.duration = ctx.Int("duration")
	if c.duration <= 0 || c.duration > maxWaitTime {
		return fmt.Errorf("invalid duration %d, must be between 1 and %d", c.duration, maxWaitTime)
	}
	return nil
}

func (c *CmdWait) Run() error {
	for i := 0; i < c.duration; i++ {
		fmt.Println(i)
		client, err := GetConfigClient(c.G())
		if err != nil {
			time.Sleep(time.Second)
			continue
		}

		fstatus, err := client.GetFullStatus(context.TODO(), 0)
		if err != nil {
			return err
		}

		if fstatus != nil && fstatus.Service.Running {
			return nil
		}

		time.Sleep(time.Second)
	}

	return nil
}

func (c *CmdWait) GetUsage() libkb.Usage {
	return libkb.Usage{}
}