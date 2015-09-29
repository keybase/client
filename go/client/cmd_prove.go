package client

import (
	"fmt"
	"io/ioutil"
	"os"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

// CmdProve is the wrapper structure for the the `keybase prove` operation.
type CmdProve struct {
	arg    keybase1.StartProofArg
	output string
}

// ParseArgv parses arguments for the prove command.
func (p *CmdProve) ParseArgv(ctx *cli.Context) error {
	nargs := len(ctx.Args())
	var err error
	p.arg.Force = ctx.Bool("force")
	p.output = ctx.String("output")

	if nargs > 2 || nargs == 0 {
		err = fmt.Errorf("prove takes 1 or args: <service> [<username>]")
	} else {
		p.arg.Service = ctx.Args()[0]
		if nargs == 2 {
			p.arg.Username = ctx.Args()[1]
		}
	}
	return err
}

func (p *CmdProve) fileOutputHook(txt string) (err error) {
	G.Log.Info("Writing proof to file '" + p.output + "'...")
	err = ioutil.WriteFile(p.output, []byte(txt), os.FileMode(0644))
	G.Log.Info("Written.")
	return
}

func newProveUIProtocol(ui ProveUI) rpc2.Protocol {
	return keybase1.ProveUiProtocol(ui)
}

// RunClient runs the `keybase prove` subcommand in client/server mode.
func (p *CmdProve) Run() error {
	var cli keybase1.ProveClient

	proveUI := ProveUI{parent: GlobUI}
	p.installOutputHook(&proveUI)

	protocols := []rpc2.Protocol{
		newProveUIProtocol(proveUI),
		NewLoginUIProtocol(),
		NewSecretUIProtocol(),
	}

	cli, err := GetProveClient()
	if err != nil {
		return err
	}
	if err = RegisterProtocols(protocols); err != nil {
		return err
	}

	// command line interface wants the PromptPosted ui loop
	p.arg.PromptPosted = true

	_, err = cli.StartProof(p.arg)
	return err
}

func (p *CmdProve) installOutputHook(ui *ProveUI) {
	if len(p.output) > 0 {
		ui.outputHook = func(s string) error {
			return p.fileOutputHook(s)
		}
	}
}

// NewCmdProve makes a new prove command from the given CLI parameters.
func NewCmdProve(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:         "prove",
		ArgumentHelp: "<service> [service username]",
		Usage:        "Generate a new proof",
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "output, o",
				Usage: "Output proof text to a file (rather than standard out).",
			},
			cli.BoolFlag{
				Name:  "force, f",
				Usage: "Don't prompt.",
			},
		},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdProve{}, "prove", c)
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
