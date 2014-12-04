package main

import (
	"fmt"
	"github.com/codegangsta/cli"
	"github.com/keybase/go-jsonw"
	"github.com/keybase/go-libkb"
	"io/ioutil"
	"os"
)

type CmdProve struct {
	me                 *libkb.User
	force              bool
	service, username  string
	output             string
	st                 libkb.ServiceType
	usernameNormalized string
	supersede          bool
	proof              *jsonw.Wrapper
	sig                string
	sigId              *libkb.SigId
	postRes            *libkb.PostProofRes
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
		if v.st = libkb.GetServiceType(v.service); v.st == nil {
			err = BadServiceError{v.service}
		}
	}
	return err
}

func (v *CmdProve) Login() (err error) {
	return G.LoginState.Login(libkb.LoginArg{})
}
func (v *CmdProve) LoadMe() (err error) {
	v.me, err = libkb.LoadMe(libkb.LoadUserArg{LoadSecrets: true, AllKeys: false})
	return
}
func (v *CmdProve) CheckExists1() (err error) {
	proofs := v.me.IdTable.GetActiveProofsFor(v.st)
	if len(proofs) != 0 && !v.force {
		lst := proofs[len(proofs)-1]
		prompt := "You already have a proof " +
			ColorString("bold", lst.ToDisplayString()) + "; overwrite?"
		def := false
		var redo bool
		redo, err = G_UI.PromptYesNo(prompt, &def)
		if err != nil {
		} else if !redo {
			err = NotConfirmedError{}
		} else {
			v.supersede = true
		}
	}
	return
}

func (v *CmdProve) PromptRemoteName() (err error) {
	if len(v.username) == 0 {
		v.username, err = G_UI.Prompt(v.st.GetPrompt(), false, v.st.ToChecker())
	} else if !v.st.CheckUsername(v.username) {
		err = BadUsername{v.username}
	}
	return
}

func (v *CmdProve) NormalizeRemoteName() (err error) {
	v.usernameNormalized = v.st.NormalizeUsername(v.username)
	return
}

func (v *CmdProve) CheckExists2() (err error) {
	G.Log.Debug("+ CheckExists2")
	defer func() { G.Log.Debug("- CheckExists2 -> %s", libkb.ErrToOk(err)) }()
	if !v.st.LastWriterWins() {
		var found libkb.RemoteProofChainLink
		for _, p := range v.me.IdTable.GetActiveProofsFor(v.st) {
			_, name := p.ToKeyValuePair()
			if libkb.Cicmp(name, v.usernameNormalized) {
				found = p
				break
			}
		}
		if found != nil {
			var redo bool
			prompt := "You already have claimed ownership of " +
				ColorString("bold", found.ToDisplayString()) + "; overwrite? "
			def := false
			redo, err = G_UI.PromptYesNo(prompt, &def)
			if err != nil {
			} else if !redo {
				err = NotConfirmedError{}
			} else {
				v.supersede = true
			}
		}
	}
	return
}

func (v *CmdProve) DoPrechecks() (err error) {
	err = v.st.PreProofCheck(v.usernameNormalized)
	return
}

func (v *CmdProve) DoWarnings() (err error) {
	if mu := v.st.PreProofWarning(v.usernameNormalized); mu != nil {
		Render(os.Stdout, mu)
		prompt := "Proceed?"
		def := false
		var ok bool
		ok, err = G_UI.PromptYesNo(prompt, &def)
		if err == nil && !ok {
			err = NotConfirmedError{}
		}
	}
	return
}
func (v *CmdProve) GenerateProof() (err error) {
	var key *libkb.PgpKeyBundle
	if v.proof, err = v.me.ServiceProof(v.st, v.usernameNormalized); err != nil {
		return
	}
	if key, err = G.Keyrings.GetSecretKey("proof signature"); err != nil {
		return
	}
	if v.sig, v.sigId, err = libkb.SimpleSignJson(v.proof, *key); err != nil {
		return
	}
	return
}

func (v *CmdProve) PostProofToServer() (err error) {
	arg := libkb.PostProofArg{
		Sig:            v.sig,
		ProofType:      v.st.GetProofType(),
		Id:             *v.sigId,
		Supersede:      v.supersede,
		RemoteUsername: v.usernameNormalized,
	}
	v.postRes, err = libkb.PostProof(arg)
	return
}

func (v *CmdProve) InstructAction() (err error) {
	mkp := v.st.PostInstructions(v.usernameNormalized)
	Render(os.Stdout, mkp)
	var txt string
	if txt, err = v.st.FormatProofText(v.postRes); err != nil {
		return
	}
	if len(v.output) > 0 {
		G.Log.Info("Writing proof to file '" + v.output + "'...")
		err = ioutil.WriteFile(v.output, []byte(txt), os.FileMode(0644))
		G.Log.Info("Written.")
	} else {
		err = G_UI.Output("\n" + txt + "\n")
	}
	return
}

func (v *CmdProve) PromptPostedLoop() (err error) {
	first := true
	found := false
	for i := 0; ; i++ {
		var agn string
		var retry bool
		var status int
		var warn *libkb.Markup
		if !first {
			agn = "again "
		}
		first = false
		prompt := "Check " + v.st.DisplayName(v.usernameNormalized) + " " + agn + "now?"
		def := true
		retry, err = G_UI.PromptYesNo(prompt, &def)
		if !retry || err != nil {
			break
		}
		found, status, err = libkb.CheckPosted(v.postRes.Id)
		if found || err != nil {
			break
		}
		warn, err = v.st.RecheckProofPosting(status, i)
		Render(os.Stderr, warn)
		if err != nil {
			break
		}
	}
	if !found && err == nil {
		err = ProofNotYetAvailableError{}
	}

	return
}

func (v *CmdProve) CheckProofText() error {
	return v.st.CheckProofText(v.postRes.Text, *v.sigId, v.sig)
}

func (v *CmdProve) Run() (err error) {

	if err = v.Login(); err != nil {
		return
	}
	if err = v.LoadMe(); err != nil {
		return
	}
	if err = v.CheckExists1(); err != nil {
		return
	}
	if err = v.PromptRemoteName(); err != nil {
		return
	}
	if err = v.NormalizeRemoteName(); err != nil {
		return
	}
	if err = v.CheckExists2(); err != nil {
		return
	}
	if err = v.DoPrechecks(); err != nil {
		return
	}
	if err = v.DoWarnings(); err != nil {
		return
	}
	if err = v.GenerateProof(); err != nil {
		return
	}
	if err = v.PostProofToServer(); err != nil {
		return
	}
	if err = v.CheckProofText(); err != nil {
		return
	}
	if err = v.InstructAction(); err != nil {
		return
	}
	if err = v.PromptPostedLoop(); err != nil {
		return
	}
	G.Log.Notice("Success!")
	return nil
}

func NewCmdProve(cl *CommandLine) cli.Command {
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
