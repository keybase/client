package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"golang.org/x/net/context"
	"time"
)

type CmdWait struct {
	libkb.Contextified
}

func NewCmdWait(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "wait",
		Usage: "Waits for the keybase server to start up",
		Action: func(c *cli.Context) {
			cl.SetForkCmd(libcmdline.NoFork)
			cl.SetLogForward(libcmdline.LogForwardNone)
			cl.ChooseCommand(&CmdWait{Contextified: libkb.NewContextified(g)}, "wait", c)
		},
		Flags: []cli.Flag{},
	}
}

func (c *CmdWait) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) > 0 {
		return UnexpectedArgsError("wait")
	}
	return nil
}

func (c *CmdWait) Run() error {
	duration := 10

	for i := 0; i < duration; i++ {
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