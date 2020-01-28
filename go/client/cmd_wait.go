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
		client, err := getConfigClient(c.G())
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

func getConfigClient(g *libkb.GlobalContext) (cli keybase1.ConfigClient, err error) {
	var rpcClient *rpc.Client
	if rpcClient, _, err = getRPCClientWithContext(g); err == nil {
		cli = keybase1.ConfigClient{Cli: rpcClient}
	}
	return
}

func getRPCClientWithContext(g *libkb.GlobalContext) (ret *rpc.Client, xp rpc.Transporter, err error) {
	if xp, err = getSocketWithRetry(g); err == nil {
		ret = rpc.NewClient(xp, libkb.NewContextifiedErrorUnwrapper(g), nil)
	}
	return
}
