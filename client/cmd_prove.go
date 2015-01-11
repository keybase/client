package main

import (
	"fmt"
	"github.com/codegangsta/cli"
	"github.com/keybase/go-libcmdline"
	"github.com/keybase/go/libkb"
	"github.com/keybase/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
	"io/ioutil"
	"os"
)

type CmdProve struct {
	force             bool
	service, username string
	output            string
}

func (v *CmdProve) ParseArgv(ctx *cli.Context) error {
	nargs := len(ctx.Args())
	var err error
	v.force = ctx.Bool("force")
	v.output = ctx.String("output")

	if nargs > 2 || nargs == 0 {
		err = fmt.Errorf("prove takes 1 or args: <service> [<username>]")
	} else {
		v.service = ctx.Args()[0]
		if nargs == 2 {
			v.username = ctx.Args()[1]
		}
	}
	return err
}

func (v *CmdProve) fileOutputHook(txt string) (err error) {
	G.Log.Info("Writing proof to file '" + v.output + "'...")
	err = ioutil.WriteFile(v.output, []byte(txt), os.FileMode(0644))
	G.Log.Info("Written.")
	return
}

type ProveUIServer struct {
	eng libkb.ProveUI
}

type SecretUIServer struct {
	eng libkb.SecretUI
}

func NewProveUIProtocol(ui ProveUI) rpc2.Protocol {
	return keybase_1.ProveUiProtocol(&ProveUIServer{ui})
}

func NewSecretUIProtocol() rpc2.Protocol {
	return keybase_1.SecretUiProtocol(&SecretUIServer{G_UI.GetSecretUI()})
}

func (p *ProveUIServer) PromptOverwrite1(arg keybase_1.PromptOverwrite1Arg) (bool, error) {
	return p.eng.PromptOverwrite1(arg.Account)
}
func (p *ProveUIServer) PromptOverwrite2(arg keybase_1.PromptOverwrite2Arg) (bool, error) {
	return p.eng.PromptOverwrite1(arg.Service)
}
func (p *ProveUIServer) PromptUsername(arg keybase_1.PromptUsernameArg) (string, error) {
	return p.eng.PromptUsername(arg.Prompt, libkb.ImportStatusAsError(arg.PrevError))
}
func (p *ProveUIServer) OutputPrechecks(arg keybase_1.OutputPrechecksArg) error {
	p.eng.OutputPrechecks(arg.Text)
	return nil
}
func (p *ProveUIServer) PreProofWarning(arg keybase_1.PreProofWarningArg) (bool, error) {
	return p.eng.PreProofWarning(arg.Text)
}
func (p *ProveUIServer) OutputInstructions(arg keybase_1.OutputInstructionsArg) error {
	return p.eng.OutputInstructions(arg.Instructions, arg.Proof)
}
func (p *ProveUIServer) OkToCheck(arg keybase_1.OkToCheckArg) (bool, error) {
	return p.eng.OkToCheck(arg.Name, arg.Attempt)
}
func (p *ProveUIServer) DisplayRecheckWarning(arg keybase_1.DisplayRecheckWarningArg) error {
	p.eng.DisplayRecheckWarning(arg.Text)
	return nil
}
func (s *SecretUIServer) GetSecret(arg keybase_1.GetSecretArg) (res keybase_1.SecretEntryRes, err error) {
	var resp *keybase_1.SecretEntryRes
	resp, err = s.eng.GetSecret(arg.Pinentry, arg.Terminal)
	if resp != nil {
		res = *resp
	}
	return
}
func (s *SecretUIServer) GetNewPassphrase(arg keybase_1.GetNewPassphraseArg) (string, error) {
	return s.eng.GetNewPassphrase(arg)
}
func (s *SecretUIServer) GetKeybasePassphrase(arg keybase_1.GetKeybasePassphraseArg) (string, error) {
	return s.eng.GetKeybasePassphrase(arg)
}

func (v *CmdProve) RunClient() (err error) {
	var cli keybase_1.ProveClient

	prove_ui := ProveUI{parent: G_UI}
	v.installOutputHook(&prove_ui)

	protocols := []rpc2.Protocol{
		NewProveUIProtocol(prove_ui),
		NewLoginUIProtocol(),
		NewSecretUIProtocol(),
		NewLogUIProtocol(),
	}

	if cli, err = GetProveClient(); err != nil {
	} else if err = RegisterProtocols(protocols); err != nil {
	} else {
		err = cli.Prove(keybase_1.ProveArg{
			Username: v.username,
			Service:  v.service,
			Force:    v.force,
		})
	}
	return
}

func (v *CmdProve) installOutputHook(ui *ProveUI) {
	if len(v.output) > 0 {
		ui.outputHook = func(s string) error {
			return v.fileOutputHook(s)
		}
	}
}

func (v *CmdProve) Run() (err error) {
	ui := ProveUI{parent: G_UI}
	v.installOutputHook(&ui)

	eng := &libkb.ProofEngine{
		Username: v.username,
		Service:  v.service,
		Force:    v.force,
		ProveUI:  ui,
	}
	err = eng.Run()
	return
}

func NewCmdProve(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "prove",
		Usage:       "keybase prove <service> [<username>]",
		Description: "generate a new proof",
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "output, o",
				Usage: "output proof text to a file (rather than standard out)",
			},
			cli.BoolFlag{
				Name:  "force, f",
				Usage: "don't stop for any prompts",
			},
		},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdProve{}, "prove", c)
		},
	}
}

func (v *CmdProve) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		Terminal:  true,
		KbKeyring: true,
	}
}
