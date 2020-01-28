package client

import (
	"fmt"
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
	"time"
)

type CmdWait struct {
	libkb.Contextified
	duration time.Duration
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
			cli.DurationFlag{
				Name:   "duration, d",
				Value: 10 * time.Second,
				Usage:  "How long to wait before timing out",
			},
		},
	}
}

func (c *CmdWait) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) > 0 {
		return UnexpectedArgsError("wait")
	}

	c.duration = ctx.Duration("duration")
	if c.duration.Seconds() <= 0 || c.duration.Seconds() > maxWaitTime {
		return fmt.Errorf("invalid duration %s, must be between 1s and %ds", c.duration, maxWaitTime)
	}
	return nil
}

func (c *CmdWait) Run() error {
	durationSeconds := c.duration.Seconds()
	for i := float64(0); i < durationSeconds; i++ {
		client, err := getConfigClientWithRetry(c.G())
		if err != nil {
			time.Sleep(time.Second)
			continue
		}

		isRunning, err := client.IsServiceRunning(context.TODO(), 0)
		if err != nil {
			return err
		}

		if isRunning {
			return nil
		}

		time.Sleep(time.Second)
	}

	return nil
}

func (c *CmdWait) GetUsage() libkb.Usage {
	return libkb.Usage{}
}

func getConfigClientWithRetry(g *libkb.GlobalContext) (cli keybase1.ConfigClient, err error) {
	var rpcClient *rpc.Client
	if rpcClient, _, err = getRPCClientWithContextWithRetry(g); err == nil {
		cli = keybase1.ConfigClient{Cli: rpcClient}
	}
	return
}

func getRPCClientWithContextWithRetry(g *libkb.GlobalContext) (ret *rpc.Client, xp rpc.Transporter, err error) {
	if xp, err = getSocketWithRetry(g); err == nil {
		ret = rpc.NewClient(xp, libkb.NewContextifiedErrorUnwrapper(g), nil)
	}
	return
}
