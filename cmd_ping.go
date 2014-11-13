package main

import (
	"fmt"
	"github.com/codegangsta/cli"
	"github.com/keybase/go-libkb"
)

type CmdPing struct{}

func (v *CmdPing) Run() error {
	_, err := G.API.Post(libkb.ApiArg{
		Endpoint: "ping",
		Args: libkb.HttpArgs{
			"alice":   libkb.S{"hi alice"},
			"bob":     libkb.I{1000},
			"charlie": libkb.B{true},
		},
	})
	if err != nil {
		return err
	}
	_, err = G.API.Get(libkb.ApiArg{Endpoint: "ping"})
	if err != nil {
		return err
	}
	G.Log.Info(fmt.Sprintf("API Server at %s is up", G.Env.GetServerUri()))
	return nil
}

func NewCmdPing(cl *CommandLine) cli.Command {
	return cli.Command{
		Name:  "ping",
		Usage: "ping the keybase API server",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdPing{}, "ping", c)
		},
	}
}

func (c *CmdPing) ParseArgv(*cli.Context) error { return nil }

func (v *CmdPing) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
