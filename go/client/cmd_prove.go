// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"
	"io/ioutil"
	"os"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

// CmdProve is the wrapper structure for the `keybase prove` operation.
type CmdProve struct {
	libkb.Contextified
	arg             keybase1.StartProofArg
	output          string
	listServices    bool
	listAllServices bool
}

// ParseArgv parses arguments for the prove command.
func (p *CmdProve) ParseArgv(ctx *cli.Context) error {
	nargs := len(ctx.Args())
	p.arg.Force = ctx.Bool("force")
	p.listServices = ctx.Bool("list-services")
	p.listAllServices = ctx.Bool("all")
	p.output = ctx.String("output")

	if p.listServices || p.listAllServices {
		return nil
	}

	if nargs > 2 || nargs == 0 {
		return fmt.Errorf("prove takes 1 or 2 args: <service> [<username>]")
	}
	p.arg.Service = ctx.Args()[0]
	if nargs == 2 {
		p.arg.Username = ctx.Args()[1]
	}

	if libkb.RemoteServiceTypes[p.arg.Service] == keybase1.ProofType_ROOTER {
		p.arg.Auto = ctx.Bool("auto")
		if p.arg.Auto && len(p.arg.Username) == 0 {
			return fmt.Errorf("must specify the username when using auto flag")
		}
	}
	return nil
}

func (p *CmdProve) fileOutputHook(txt string) (err error) {
	p.G().Log.Info("Writing proof to file '" + p.output + "'...")
	err = ioutil.WriteFile(p.output, []byte(txt), os.FileMode(0644))
	p.G().Log.Info("Written.")
	return
}

var proofServiceRewrite = map[string]string{
	"twitter.com":          "twitter",
	"github.com":           "github",
	"reddit.com":           "reddit",
	"news.ycombinator.com": "hackernews",
	"facebook.com":         "facebook",
}

// RunClient runs the `keybase prove` subcommand in client/server mode.
func (p *CmdProve) Run() error {
	cli, err := GetProveClient(p.G())
	if err != nil {
		return err
	}

	var proveUIProtocol rpc.Protocol

	if to, found := proofServiceRewrite[p.arg.Service]; found {
		p.arg.Service = to
	}

	if p.arg.Auto {
		ui := &ProveRooterUI{
			Contextified: libkb.NewContextified(p.G()),
			Username:     p.arg.Username,
		}
		proveUIProtocol = keybase1.ProveUiProtocol(ui)
	} else {
		proveUI := ProveUI{Contextified: libkb.NewContextified(p.G()), terminal: p.G().UI.GetTerminalUI()}
		p.installOutputHook(&proveUI)
		proveUIProtocol = keybase1.ProveUiProtocol(proveUI)
	}

	protocols := []rpc.Protocol{
		proveUIProtocol,
		NewSecretUIProtocol(p.G()),
	}

	if err = RegisterProtocolsWithContext(protocols, p.G()); err != nil {
		return err
	}

	if p.listAllServices {
		services, err := cli.ListProofServices(context.TODO())
		if err != nil {
			return err
		}
		ui := p.G().UI.GetTerminalUI()
		ui.Printf("All supported services:\n")
		for _, service := range services {
			ui.Printf("  %s\n", service)
		}
		if len(services) > 50 {
			ui.Printf("the end\n")
		}
		return nil
	}
	if p.listServices {
		services, err := cli.ListSomeProofServices(context.TODO())
		if err != nil {
			return err
		}
		ui := p.G().UI.GetTerminalUI()
		ui.Printf("Some supported services:\n")
		for _, service := range services {
			ui.Printf("  %s\n", service)
		}
		ui.Printf("\nFor a full list of services run: keybase prove --list-services --all\n")
		return nil
	}

	// command line interface wants the PromptPosted ui loop
	p.arg.PromptPosted = true

	_, err = cli.StartProof(context.TODO(), p.arg)
	return err
}

func (p *CmdProve) installOutputHook(ui *ProveUI) {
	if len(p.output) > 0 {
		ui.outputHook = p.fileOutputHook
	}
}

// NewCmdProve makes a new prove command from the given CLI parameters.
func NewCmdProve(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := cli.Command{
		Name:         "prove",
		ArgumentHelp: "<service> [service username]",
		Usage:        "Generate a new proof",
		Description:  "Run keybase prove --list-services to see available services.",
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "output, o",
				Usage: "Output proof text to a file (rather than standard out).",
			},
			cli.BoolFlag{
				Name:  "force, f",
				Usage: "Don't prompt.",
			},
			cli.BoolFlag{
				Name:  "list-services, l",
				Usage: "List some available services",
			},
			cli.BoolFlag{
				Name:  "all, a",
				Usage: "List the full gamut of available services",
			},
		},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdProve{Contextified: libkb.NewContextified(g)}, "prove", c)
		},
	}
	cmd.Flags = append(cmd.Flags, restrictedProveFlags...)
	return cmd
}

// NewCmdProveRooterRunner creates a CmdProve for proving rooter in tests.
func NewCmdProveRooterRunner(g *libkb.GlobalContext, username string) *CmdProve {
	return &CmdProve{
		Contextified: libkb.NewContextified(g),
		arg: keybase1.StartProofArg{
			Service:  "rooter",
			Username: username,
			Auto:     true,
		},
	}
}

// GetUsage specifics the library features that the prove command needs.
func (p *CmdProve) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
