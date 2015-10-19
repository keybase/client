package client

import (
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
)

type CmdID struct {
	user           string
	trackStatement bool
}

func (v *CmdID) ParseArgv(ctx *cli.Context) error {
	nargs := len(ctx.Args())
	if nargs > 1 {
		return fmt.Errorf("Identify only takes one argument, the user to lookup.")
	}

	if nargs == 1 {
		v.user = ctx.Args()[0]
	}
	v.trackStatement = ctx.Bool("track-statement")
	return nil
}

func (v *CmdID) makeArg() *engine.IDEngineArg {
	return &engine.IDEngineArg{
		UserAssertion:  v.user,
		TrackStatement: v.trackStatement,
	}
}

func (v *CmdID) Run() error {
	var cli keybase1.IdentifyClient
	protocols := []rpc.Protocol{
		NewIdentifyUIProtocol(),
	}
	cli, err := GetIdentifyClient()
	if err != nil {
		return err
	}
	if err := RegisterProtocols(protocols); err != nil {
		return err
	}

	arg := v.makeArg()
	_, err = cli.Identify(context.TODO(), arg.Export())
	if _, ok := err.(libkb.SelfNotFoundError); ok {
		GlobUI.Println("Could not find UID or username for you on this device.")
		GlobUI.Println("You can either specify a user to id:  keybase id <username>")
		GlobUI.Println("Or log in once on this device and run `keybase id` again.")
		return nil
	}
	return err
}

func NewCmdID(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:         "id",
		ArgumentHelp: "[username]",
		Usage:        "Identify a user and check their signature chain",
		Description:  "Identify a user and check their signature chain.  Don't specify a username to identify yourself.  You can also specify proof assertions like user@twitter.",
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "t, track-statement",
				Usage: "Output a tracking statement (in JSON format).",
			},
		},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdID{}, "id", c)
		},
	}
}

func (v *CmdID) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}
