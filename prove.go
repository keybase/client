package libkb

import (
	"fmt"
	"github.com/codegangsta/cli"
	"github.com/keybase/go-jsonw"
	"io/ioutil"
	"os"
)

type ProofEngine struct {
	me                 *User
	force              bool
	service, username  string
	output             string
	st                 ServiceType
	usernameNormalized string
	supersede          bool
	proof              *jsonw.Wrapper
	sig                string
	sigId              *SigId
	postRes            *PostProofRes
	ui                 UI
}

func (v *ProofEngine) ParseArgv(ctx *cli.Context) error {
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
		if v.st = GetServiceType(v.service); v.st == nil {
			err = BadServiceError{v.service}
		}
	}
	return err
}

func (v *ProofEngine) Login() (err error) {
	return G.LoginState.Login(LoginArg{})
}

func (v *ProofEngine) LoadMe() (err error) {
	v.me, err = LoadMe(LoadUserArg{LoadSecrets: true, AllKeys: false})
	return
}
func (v *ProofEngine) CheckExists1() (err error) {
	proofs := v.me.IdTable.GetActiveProofsFor(v.st)
	if len(proofs) != 0 && !v.force && v.st.LastWriterWins() {
		lst := proofs[len(proofs)-1]
		prompt := "You already have a proof " +
			ColorString("bold", lst.ToDisplayString()) + "; overwrite?"
		def := false
		var redo bool
		redo, err = v.ui.PromptYesNo(prompt, &def)
		if err != nil {
		} else if !redo {
			err = NotConfirmedError{}
		} else {
			v.supersede = true
		}
	}
	return
}

func (v *ProofEngine) PromptRemoteName() (err error) {
	if len(v.username) == 0 {
		v.username, err = v.ui.Prompt(v.st.GetPrompt(), false, v.st.ToChecker())
	} else {
		err = v.st.CheckUsername(v.username)
	}
	return
}

func (v *ProofEngine) NormalizeRemoteName() (err error) {
	v.usernameNormalized, err = v.st.NormalizeUsername(v.username)
	return
}

func (v *ProofEngine) CheckExists2() (err error) {
	G.Log.Debug("+ CheckExists2")
	defer func() { G.Log.Debug("- CheckExists2 -> %s", ErrToOk(err)) }()
	if !v.st.LastWriterWins() {
		var found RemoteProofChainLink
		for _, p := range v.me.IdTable.GetActiveProofsFor(v.st) {
			_, name := p.ToKeyValuePair()
			if Cicmp(name, v.usernameNormalized) {
				found = p
				break
			}
		}
		if found != nil {
			var redo bool
			prompt := "You already have claimed ownership of " +
				ColorString("bold", found.ToDisplayString()) + "; overwrite? "
			def := false
			redo, err = v.ui.PromptYesNo(prompt, &def)
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

func (v *ProofEngine) DoPrechecks() (err error) {
	var w *Markup
	w, err = v.st.PreProofCheck(v.usernameNormalized)
	Render(os.Stdout, w)
	return
}

func (v *ProofEngine) DoWarnings() (err error) {
	if mu := v.st.PreProofWarning(v.usernameNormalized); mu != nil {
		Render(os.Stdout, mu)
		prompt := "Proceed?"
		def := false
		var ok bool
		ok, err = v.ui.PromptYesNo(prompt, &def)
		if err == nil && !ok {
			err = NotConfirmedError{}
		}
	}
	return
}
func (v *ProofEngine) GenerateProof() (err error) {
	var key *PgpKeyBundle
	if v.proof, err = v.me.ServiceProof(v.st, v.usernameNormalized); err != nil {
		return
	}
	if key, err = G.Keyrings.GetSecretKey("proof signature"); err != nil {
		return
	}
	if v.sig, v.sigId, err = SignJson(v.proof, key); err != nil {
		return
	}
	return
}

func (v *ProofEngine) PostProofToServer() (err error) {
	arg := PostProofArg{
		Sig:            v.sig,
		ProofType:      v.st.GetProofType(),
		Id:             *v.sigId,
		Supersede:      v.supersede,
		RemoteUsername: v.usernameNormalized,
		RemoteKey:      v.st.GetApiArgKey(),
	}
	v.postRes, err = PostProof(arg)
	return
}

func (v *ProofEngine) InstructAction() (err error) {
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
		err = v.ui.Output("\n" + txt + "\n")
	}
	return
}

func (v *ProofEngine) PromptPostedLoop() (err error) {
	first := true
	found := false
	for i := 0; ; i++ {
		var agn string
		var retry bool
		var status int
		var warn *Markup
		if !first {
			agn = "again "
		}
		first = false
		prompt := "Check " + v.st.DisplayName(v.usernameNormalized) + " " + agn + "now?"
		def := true
		retry, err = v.ui.PromptYesNo(prompt, &def)
		if !retry || err != nil {
			break
		}
		found, status, err = CheckPosted(v.postRes.Id)
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

func (v *ProofEngine) CheckProofText() error {
	return v.st.CheckProofText(v.postRes.Text, *v.sigId, v.sig)
}

func (v *ProofEngine) Run() (err error) {

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
