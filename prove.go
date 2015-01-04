package libkb

import (
	"github.com/keybase/go-jsonw"
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
	proveUi            ProveUI
	loginUi            LoginUI
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
		var redo bool
		redo, err = v.proveUi.PromptOverwrite1(lst.ToDisplayString())
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
		var prevErr error
		for len(v.username) == 0 && err == nil {
			var un string
			un, err = v.proveUi.PromptUsername(v.st.GetPrompt(), prevErr)
			if err != nil {
				prevErr = v.st.CheckUsername(un)
				if prevErr == nil {
					v.username = un
				}
			}
		}
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
			redo, err = v.proveUi.PromptOverwrite2(found.ToDisplayString())
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
	if w != nil {
		v.proveUi.OutputPrechecks(w.Export())
	}
	return
}

func (v *ProofEngine) DoWarnings() (err error) {
	if mu := v.st.PreProofWarning(v.usernameNormalized); mu != nil {
		var ok bool
		if ok, err = v.proveUi.PreProofWarning(mu.Export()); err == nil && !ok {
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
	var txt string
	if txt, err = v.st.FormatProofText(v.postRes); err != nil {
		return
	}
	err = v.proveUi.OutputInstructions(mkp.Export(), txt)
	return
}

func (v *ProofEngine) PromptPostedLoop() (err error) {
	found := false
	for i := 0; ; i++ {
		var retry bool
		var status int
		var warn *Markup
		retry, err = v.proveUi.OkToCheck(v.st.DisplayName(v.usernameNormalized), i)
		if !retry || err != nil {
			break
		}
		found, status, err = CheckPosted(v.postRes.Id)
		if found || err != nil {
			break
		}
		warn, err = v.st.RecheckProofPosting(status, i)
		if warn != nil {
			if err = v.proveUi.DisplayRecheck(warn.Export()); err != nil {
				break
			}
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
