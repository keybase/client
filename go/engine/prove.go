// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"strings"

	libkb "github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
	"golang.org/x/net/context"
)

// Prove is an engine used for proving ownership of remote accounts,
// like Twitter, GitHub, etc.
type Prove struct {
	arg        *keybase1.StartProofArg
	me         *libkb.User
	st         libkb.ServiceType
	supersede  bool
	proof      *jsonw.Wrapper
	sig        string
	sigID      keybase1.SigID
	postRes    *libkb.PostProofRes
	signingKey libkb.GenericKey

	remoteNameNormalized string

	libkb.Contextified
}

// NewProve makes a new Prove Engine given an RPC-friendly ProveArg.
func NewProve(arg *keybase1.StartProofArg, g *libkb.GlobalContext) *Prove {
	return &Prove{
		arg:          arg,
		Contextified: libkb.NewContextified(g),
	}
}

// Name provides the name of this engine for the engine interface contract
func (p *Prove) Name() string {
	return "Prove"
}

// GetPrereqs returns the engine prereqs.
func (p *Prove) Prereqs() Prereqs {
	return Prereqs{Device: true}
}

// RequiredUIs returns the required UIs.
func (p *Prove) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.LogUIKind,
		libkb.ProveUIKind,
		libkb.SecretUIKind,
	}
}

// SubConsumers returns the other UI consumers for this engine.
func (p *Prove) SubConsumers() []libkb.UIConsumer {
	return nil
}

func (p *Prove) loadMe() (err error) {
	p.me, err = libkb.LoadMe(libkb.NewLoadUserForceArg(p.G()))
	return
}

func (p *Prove) checkExists1(ctx *Context) (err error) {
	proofs := p.me.IDTable().GetActiveProofsFor(p.st)
	if len(proofs) != 0 && !p.arg.Force && p.st.LastWriterWins() {
		lst := proofs[len(proofs)-1]
		var redo bool
		redo, err = ctx.ProveUI.PromptOverwrite(context.TODO(), keybase1.PromptOverwriteArg{
			Account: lst.ToDisplayString(),
			Typ:     keybase1.PromptOverwriteType_SOCIAL,
		})
		if err != nil {
			return err
		}
		if !redo {
			return libkb.NotConfirmedError{}
		}
		p.supersede = true
	}
	return
}

func (p *Prove) promptRemoteName(ctx *Context) error {
	// If the name is already supplied, there's no need to prompt.
	if len(p.arg.Username) > 0 {
		remoteNameNormalized, err := p.st.NormalizeRemoteName(p.G(), p.arg.Username)
		if err == nil {
			p.remoteNameNormalized = remoteNameNormalized
		}
		return err
	}

	// Prompt for the name, retrying if it's invalid.
	var normalizationError error
	for {
		un, err := ctx.ProveUI.PromptUsername(context.TODO(), keybase1.PromptUsernameArg{
			Prompt:    p.st.GetPrompt(),
			PrevError: libkb.ExportErrorAsStatus(normalizationError),
		})
		if err != nil {
			// Errors here are conditions like EOF. Return them rather than retrying.
			return err
		}
		var remoteNameNormalized string
		remoteNameNormalized, normalizationError = p.st.NormalizeRemoteName(p.G(), un)
		if normalizationError == nil {
			p.remoteNameNormalized = remoteNameNormalized
			return nil
		}
	}
}

func (p *Prove) checkExists2(ctx *Context) (err error) {
	p.G().Log.Debug("+ CheckExists2")
	defer func() { p.G().Log.Debug("- CheckExists2 -> %s", libkb.ErrToOk(err)) }()
	if !p.st.LastWriterWins() {
		var found libkb.RemoteProofChainLink
		for _, proof := range p.me.IDTable().GetActiveProofsFor(p.st) {
			_, name := proof.ToKeyValuePair()
			if libkb.Cicmp(name, p.remoteNameNormalized) {
				found = proof
				break
			}
		}
		if found != nil {
			var redo bool
			redo, err = ctx.ProveUI.PromptOverwrite(context.TODO(), keybase1.PromptOverwriteArg{
				Account: found.ToDisplayString(),
				Typ:     keybase1.PromptOverwriteType_SITE,
			})
			if err != nil {
				return
			}
			if !redo {
				err = libkb.NotConfirmedError{}
				return
			}
			p.supersede = true
		}
	}
	return
}

func (p *Prove) doPrechecks(ctx *Context) (err error) {
	var w *libkb.Markup
	w, err = p.st.PreProofCheck(p.G(), p.remoteNameNormalized)
	if w != nil {
		if uierr := ctx.ProveUI.OutputPrechecks(context.TODO(), keybase1.OutputPrechecksArg{Text: w.Export()}); uierr != nil {
			p.G().Log.Warning("prove ui OutputPrechecks call error: %s", uierr)
		}
	}
	return
}

func (p *Prove) doWarnings(ctx *Context) (err error) {
	if mu := p.st.PreProofWarning(p.remoteNameNormalized); mu != nil {
		var ok bool
		arg := keybase1.PreProofWarningArg{Text: mu.Export()}
		if ok, err = ctx.ProveUI.PreProofWarning(context.TODO(), arg); err == nil && !ok {
			err = libkb.NotConfirmedError{}
		}
	}
	return
}

func (p *Prove) generateProof(ctx *Context) (err error) {
	ska := libkb.SecretKeyArg{
		Me:      p.me,
		KeyType: libkb.DeviceSigningKeyType,
	}

	p.signingKey, err = p.G().Keyrings.GetSecretKeyWithPrompt(ctx.SecretKeyPromptArg(ska, "tracking signature"))
	if err != nil {
		return err
	}

	if p.proof, err = p.me.ServiceProof(p.signingKey, p.st, p.remoteNameNormalized); err != nil {
		return
	}
	if p.sig, p.sigID, _, err = libkb.SignJSON(p.proof, p.signingKey); err != nil {
		return
	}
	return
}

func (p *Prove) postProofToServer() (err error) {
	arg := libkb.PostProofArg{
		Sig:            p.sig,
		ProofType:      p.st.GetProofType(),
		ID:             p.sigID,
		Supersede:      p.supersede,
		RemoteUsername: p.remoteNameNormalized,
		RemoteKey:      p.st.GetAPIArgKey(),
		SigningKey:     p.signingKey,
	}
	p.postRes, err = libkb.PostProof(arg)
	return
}

func (p *Prove) instructAction(ctx *Context) (err error) {
	mkp := p.st.PostInstructions(p.remoteNameNormalized)
	var txt string
	if txt, err = p.st.FormatProofText(p.G() /* as ProofContext */, p.postRes); err != nil {
		return
	}
	err = ctx.ProveUI.OutputInstructions(context.TODO(), keybase1.OutputInstructionsArg{
		Instructions: mkp.Export(),
		// If we don't trim newlines here, we'll run into an issue where e.g.
		// Facebook links get corrupted on iOS. See:
		// - https://keybase.atlassian.net/browse/DESKTOP-3335
		// - https://keybase.atlassian.net/browse/CORE-4941
		// All of our proof verifying code (PVL) should already be flexible
		// with surrounding whitespace, because users are pasting proofs by
		// hand anyway.
		Proof: strings.TrimSpace(txt),
	})
	if err != nil {
		return err
	}

	return p.checkAutoPost(ctx, txt)
}

func (p *Prove) checkAutoPost(ctx *Context, txt string) error {
	if !p.arg.Auto {
		return nil
	}
	if libkb.RemoteServiceTypes[p.arg.Service] != keybase1.ProofType_ROOTER {
		return nil
	}
	p.G().Log.Debug("making automatic post of proof to rooter")
	apiArg := libkb.APIArg{
		Endpoint:    "rooter",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"post":     libkb.S{Val: txt},
			"username": libkb.S{Val: p.arg.Username},
		},
	}
	_, err := p.G().API.Post(apiArg)
	if err != nil {
		p.G().Log.Debug("error posting to rooter: %s", err)
		return err
	}
	return nil
}

func (p *Prove) promptPostedLoop(ctx *Context) (err error) {
	found := false
	for i := 0; ; i++ {
		var retry bool
		var status keybase1.ProofStatus
		var warn *libkb.Markup
		retry, err = ctx.ProveUI.OkToCheck(context.TODO(), keybase1.OkToCheckArg{
			Name:    p.st.DisplayName(p.remoteNameNormalized),
			Attempt: i,
		})
		if !retry || err != nil {
			break
		}
		found, status, _, err = libkb.CheckPosted(p.postRes.ID)
		if found || err != nil {
			break
		}
		warn, err = p.st.RecheckProofPosting(i, status, p.remoteNameNormalized)
		if warn != nil {
			uierr := ctx.ProveUI.DisplayRecheckWarning(context.TODO(), keybase1.DisplayRecheckWarningArg{
				Text: warn.Export(),
			})
			if uierr != nil {
				p.G().Log.Warning("prove ui DisplayRecheckWarning call error: %s", uierr)
			}
		}
		if err != nil {
			break
		}
	}
	if !found && err == nil {
		err = libkb.ProofNotYetAvailableError{}
	}

	return
}

func (p *Prove) checkProofText() error {
	p.G().Log.Debug("p.postRes.Text: %q", p.postRes.Text)
	p.G().Log.Debug("p.sigID: %q", p.sigID)
	return p.st.CheckProofText(p.postRes.Text, p.sigID, p.sig)
}

func (p *Prove) getServiceType() (err error) {
	if p.st = p.G().Services.GetServiceType(p.arg.Service); p.st == nil {
		err = libkb.BadServiceError{Service: p.arg.Service}
	}
	return
}

// SigID returns the signature id of the proof posted to the
// server.
func (p *Prove) SigID() keybase1.SigID {
	return p.sigID
}

// Run runs the Prove engine, performing all steps of the proof process.
func (p *Prove) Run(ctx *Context) (err error) {
	p.G().Log.Debug("+ ProofEngine.Run")
	defer func() {
		p.G().Log.Debug("- ProofEngine.Run -> %s", libkb.ErrToOk(err))
	}()

	stage := func(s string) {
		p.G().Log.Debug("| ProofEngine.Run() %s", s)
	}

	stage("GetServiceType")
	if err = p.getServiceType(); err != nil {
		return
	}
	stage("LoadMe")
	if err = p.loadMe(); err != nil {
		return
	}
	stage("CheckExists1")
	if err = p.checkExists1(ctx); err != nil {
		return
	}
	stage("PromptRemoteName")
	if err = p.promptRemoteName(ctx); err != nil {
		return
	}
	stage("CheckExists2")
	if err = p.checkExists2(ctx); err != nil {
		return
	}
	stage("DoPrechecks")
	if err = p.doPrechecks(ctx); err != nil {
		return
	}
	stage("DoWarnings")
	if err = p.doWarnings(ctx); err != nil {
		return
	}
	p.G().LocalSigchainGuard().Set(ctx.GetNetContext(), "Prove")
	defer p.G().LocalSigchainGuard().Clear(ctx.GetNetContext(), "Prove")
	stage("GenerateProof")
	if err = p.generateProof(ctx); err != nil {
		return
	}
	stage("PostProofToServer")
	if err = p.postProofToServer(); err != nil {
		return
	}
	p.G().LocalSigchainGuard().Clear(ctx.GetNetContext(), "Prove")
	stage("CheckProofText")
	if err = p.checkProofText(); err != nil {
		return
	}
	stage("InstructAction")
	if err = p.instructAction(ctx); err != nil {
		return
	}

	if !p.arg.PromptPosted {
		p.G().Log.Debug("PromptPosted not set, prove run finished")
		return
	}

	stage("PromptPostedLoop")
	if err = p.promptPostedLoop(ctx); err != nil {
		return
	}
	ctx.LogUI.Notice("Success!")
	return nil
}
