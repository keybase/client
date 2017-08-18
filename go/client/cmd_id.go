// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type CmdID struct {
	libkb.Contextified
	user           string
	useDelegateUI  bool
	skipProofCache bool
	forceDisplay   bool
}

func (v *CmdID) ParseArgv(ctx *cli.Context) error {
	nargs := len(ctx.Args())
	if nargs > 1 {
		return fmt.Errorf("Identify only takes one argument, the user to lookup.")
	}

	if nargs == 1 {
		v.user = ctx.Args()[0]
	}
	v.useDelegateUI = ctx.Bool("ui")
	v.skipProofCache = ctx.Bool("skip-proof-cache")
	v.forceDisplay = ctx.Bool("force-display")
	return nil
}

func (v *CmdID) makeArg() keybase1.Identify2Arg {
	return keybase1.Identify2Arg{
		UserAssertion:    v.user,
		UseDelegateUI:    v.useDelegateUI || v.forceDisplay,
		ForceDisplay:     v.forceDisplay,
		Reason:           keybase1.IdentifyReason{Reason: "CLI id command"},
		ForceRemoteCheck: v.skipProofCache,
		AlwaysBlock:      true,
		NeedProofSet:     true,
		AllowEmptySelfID: true,
		NoSkipSelf:       true,
	}
}

func (v *CmdID) Run() error {
	var cli keybase1.IdentifyClient
	protocols := []rpc.Protocol{}

	// always register this, even if ui is delegated, so that
	// fallback to terminal UI works.
	protocols = append(protocols, NewIdentifyUIProtocol(v.G()))
	cli, err := GetIdentifyClient(v.G())
	if err != nil {
		return err
	}
	if err := RegisterProtocolsWithContext(protocols, v.G()); err != nil {
		return err
	}

	arg := v.makeArg()
	_, err = cli.Identify2(context.TODO(), arg)
	if _, ok := err.(libkb.SelfNotFoundError); ok {
		msg := `Could not find UID or username for you on this device.
You can either specify a user to id: keybase id <username>
Or log in once on this device and run "keybase id" again.
`
		v.G().UI.GetDumbOutputUI().Printf(msg)
		return nil
	}
	return err
}

func NewCmdID(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	ret := cli.Command{
		Name:         "id",
		ArgumentHelp: "[username]",
		Usage:        "Identify a user and check their signature chain",
		Description:  "Identify a user and check their signature chain. Don't specify a username to identify yourself. You can also specify proof assertions like user@twitter.",
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:      "ui",
				Usage:     "Use identify UI.",
				HideUsage: !develUsage,
			},
			cli.BoolFlag{
				Name:      "force-display",
				Usage:     "Force identify UI to draw (even if still fresh)",
				HideUsage: !develUsage,
			},
			cli.BoolFlag{
				Name:  "s, skip-proof-cache",
				Usage: "Skip cached proofs, force re-check",
			},
		},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdIDRunner(g), "id", c)
		},
	}
	return ret
}

func NewCmdIDRunner(g *libkb.GlobalContext) *CmdID {
	return &CmdID{Contextified: libkb.NewContextified(g)}
}

func (v *CmdID) SetUser(s string) {
	v.user = s
}

func (v *CmdID) UseDelegateUI() {
	v.useDelegateUI = true
}

func (v *CmdID) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}
