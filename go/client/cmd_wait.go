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
	duration    time.Duration
	includeKBFS bool
}

const maxWaitTime = 60 * time.Second

func NewCmdWait(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "wait",
		Usage: "Waits for the keybase service to start up",
		Action: func(c *cli.Context) {
			cl.SetForkCmd(libcmdline.NoFork)
			cl.SetLogForward(libcmdline.LogForwardNone)
			cl.ChooseCommand(&CmdWait{Contextified: libkb.NewContextified(g)}, "wait", c)
		},
		Flags: []cli.Flag{
			cli.DurationFlag{
				Name:  "duration, d",
				Value: 10 * time.Second,
				Usage: "How long to wait before timing out",
			},
			cli.BoolFlag{
				Name:  "include-kbfs",
				Usage: "Wait on kbfs to start for an additional same amount of time",
			},
		},
	}
}

func (c *CmdWait) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) > 0 {
		return UnexpectedArgsError("wait")
	}

	c.duration = ctx.Duration("duration")
	if c.duration.Seconds() <= 0 || c.duration.Seconds() > maxWaitTime.Seconds() {
		return fmt.Errorf("invalid duration %s, must be between 1s and %s", c.duration, maxWaitTime)
	}

	c.includeKBFS = ctx.Bool("include-kbfs")

	return nil
}

func (c *CmdWait) Run() error {
	ctx, cancel := context.WithTimeout(context.Background(), c.duration)
	defer cancel()

	err := checkIsRunning(ctx, c.G(), false)
	if err != nil {
		return fmt.Errorf("service failed to startup: %v", err)
	}

	ctx, cancel = context.WithTimeout(context.Background(), c.duration)
	defer cancel()

	if c.includeKBFS {
		err := checkIsRunning(ctx, c.G(), true)
		if err != nil {
			return fmt.Errorf("kbfs failed to startup: %v", err)
		}
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

func checkIsRunning(ctx context.Context, g *libkb.GlobalContext, kbfs bool) error {
	for {
		client, err := getConfigClientWithRetry(g)
		if err != nil {
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(1 * time.Second):
			}
			continue
		}

		var isRunning bool

		if kbfs {
			isRunning, err = client.IsKBFSRunning(ctx, 0)
		} else {
			isRunning, err = client.IsServiceRunning(ctx, 0)
		}

		if err != nil {
			return err
		}

		if isRunning {
			break
		}

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(1 * time.Second):
		}
	}

	return nil
}
