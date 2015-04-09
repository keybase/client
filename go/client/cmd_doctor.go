package main

import (
	"github.com/codegangsta/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

func NewCmdDoctor(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "doctor",
		Usage:       "keybase doctor",
		Description: "checks account status and offers to fix any issues",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdDoctor{}, "doctor", c)
		},
	}
}

type CmdDoctor struct{}

func (c *CmdDoctor) Run() error {
	/*
		arg := &engine.DoctorArg{
			Source:       c.source,
			Sink:         c.sink,
			AssertSigned: c.signed,
			SignedBy:     c.signedBy,
			TrackOptions: engine.TrackOptions{
				TrackLocalOnly: c.localOnly,
				TrackApprove:   c.approveRemote,
			},
		}
		ctx := &engine.Context{
			SecretUI:   G.UI.GetSecretUI(),
			IdentifyUI: G.UI.GetIdentifyTrackUI(true),
			LogUI:      G.UI.GetLogUI(),
		}
		eng := engine.NewDoctor(arg)
		err := engine.RunEngine(eng, ctx)
	*/

	return nil
}

func (c *CmdDoctor) RunClient() error {
	/*
		cli, err := GetPGPClient()
		if err != nil {
			return err
		}
		protocols := []rpc2.Protocol{
			NewStreamUiProtocol(),
			NewSecretUIProtocol(),
			NewIdentifyUIProtocol(),
			NewLogUIProtocol(),
		}
		if err := RegisterProtocols(protocols); err != nil {
			return err
		}
		snk, src, err := c.ClientFilterOpen()
		if err != nil {
			return err
		}
		opts := keybase_1.DoctorOptions{
			AssertSigned:  c.signed,
			SignedBy:      c.signedBy,
			LocalOnly:     c.localOnly,
			ApproveRemote: c.approveRemote,
		}
		arg := keybase_1.DoctorArg{Source: src, Sink: snk, Opts: opts}
		_, err = cli.Doctor(arg)

		c.Close(err)
	*/

	return c.Run()
}

func (c *CmdDoctor) ParseArgv(ctx *cli.Context) error {
	return nil
}

func (c *CmdDoctor) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
