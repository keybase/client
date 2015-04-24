package main

import (
	"errors"
	"sync"

	"github.com/codegangsta/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

func NewCmdStress(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "stress",
		Usage:       "keybase stress",
		Description: "run some stressful commands on the daemon",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdStress{}, "stress", c)
		},
		Flags: []cli.Flag{
			cli.IntFlag{
				Name:  "n",
				Usage: "number of concurrent users to simulate",
			},
		},
	}
}

type CmdStress struct {
	numUsers int
}

func (c *CmdStress) Run() error {
	return errors.New("stress command only designed for client/daemon mode")
}

func (c *CmdStress) RunClient() error {
	cli, _, err := GetRpcClient()
	if err != nil {
		return err
	}
	protocols := []rpc2.Protocol{
		NewStreamUiProtocol(),
		NewSecretUIProtocol(),
		NewIdentifyUIProtocol(),
	}
	if err := RegisterProtocols(protocols); err != nil {
		return err
	}

	var wg sync.WaitGroup
	for i := 0; i < c.numUsers; i++ {
		wg.Add(1)
		go func() {
			c.simulate(cli)
			wg.Done()
		}()
	}
	wg.Wait()

	return nil
}

func (c *CmdStress) ParseArgv(ctx *cli.Context) error {
	c.numUsers = ctx.Int("n")
	if c.numUsers < 1 {
		return errors.New("n must be at least 1")
	}
	return nil
}

func (c *CmdStress) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}

func (c *CmdStress) simulate(cli *rpc2.Client) {

}
