// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"strings"

	libkb "github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
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
	sigInner   []byte

	remoteNameNormalized string

	libkb.Contextified
}

// NewProve makes a new Prove Engine given an RPC-friendly ProveArg.
func NewProve(g *libkb.GlobalContext, arg *keybase1.StartProofArg) *Prove {
	if arg.SigVersion == nil || libkb.SigVersion(*arg.SigVersion) == libkb.KeybaseNullSigVersion {
		tmp := keybase1.SigVersion(libkb.GetDefaultSigVersion(g))
		arg.SigVersion = &tmp
	}
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

func (p *Prove) loadMe(m libkb.MetaContext) (err error) {
	p.me, err = libkb.LoadMe(libkb.NewLoadUserArgWithMetaContext(m).WithForceReload())
	return err
}

func (p *Prove) checkExists1(m libkb.MetaContext) (err error) {
	proofs := p.me.IDTable().GetActiveProofsFor(p.st)
	if len(proofs) != 0 && !p.arg.Force && p.st.LastWriterWins() {
		lst := proofs[len(proofs)-1]
		var redo bool
		redo, err = m.UIs().ProveUI.PromptOverwrite(m.Ctx(), keybase1.PromptOverwriteArg{
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
	return nil
}

func (p *Prove) promptRemoteName(m libkb.MetaContext) error {
	// If the name is already supplied, there's no need to prompt.
	if len(p.arg.Username) > 0 {
		remoteNameNormalized, err := p.st.NormalizeRemoteName(m, p.arg.Username)
		if err == nil {
			p.remoteNameNormalized = remoteNameNormalized
		}
		return err
	}

	// Prompt for the name, retrying if it's invalid.
	var normalizationError error
	for {
		un, err := m.UIs().ProveUI.PromptUsername(m.Ctx(), keybase1.PromptUsernameArg{
			Prompt:    p.st.GetPrompt(),
			PrevError: libkb.ExportErrorAsStatus(m.G(), normalizationError),
		})
		if err != nil {
			// Errors here are conditions like EOF. Return them rather than retrying.
			return err
		}
		var remoteNameNormalized string
		remoteNameNormalized, normalizationError = p.st.NormalizeRemoteName(m, un)
		if normalizationError == nil {
			p.remoteNameNormalized = remoteNameNormalized
			return nil
		}
	}
}

func (p *Prove) checkExists2(m libkb.MetaContext) (err error) {
	defer m.CTrace("Prove#CheckExists2", func() error { return err })()
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
			redo, err = m.UIs().ProveUI.PromptOverwrite(m.Ctx(), keybase1.PromptOverwriteArg{
				Account: found.ToDisplayString(),
				Typ:     keybase1.PromptOverwriteType_SITE,
			})
			if err != nil {
				return err
			}
			if !redo {
				err = libkb.NotConfirmedError{}
				return err
			}
			p.supersede = true
		}
	}
	return nil
}

func (p *Prove) doPrechecks(m libkb.MetaContext) (err error) {
	var w *libkb.Markup
	w, err = p.st.PreProofCheck(m, p.remoteNameNormalized)
	if w != nil {
		if uierr := m.UIs().ProveUI.OutputPrechecks(m.Ctx(), keybase1.OutputPrechecksArg{Text: w.Export()}); uierr != nil {
			m.CWarningf("prove ui OutputPrechecks call error: %s", uierr)
		}
	}
	return err
}

func (p *Prove) doWarnings(m libkb.MetaContext) (err error) {
	if mu := p.st.PreProofWarning(p.remoteNameNormalized); mu != nil {
		var ok bool
		arg := keybase1.PreProofWarningArg{Text: mu.Export()}
		if ok, err = m.UIs().ProveUI.PreProofWarning(m.Ctx(), arg); err == nil && !ok {
			err = libkb.NotConfirmedError{}
			return err
		}
	}
	return nil
}

func (p *Prove) generateProof(m libkb.MetaContext) (err error) {
	ska := libkb.SecretKeyArg{
		Me:      p.me,
		KeyType: libkb.DeviceSigningKeyType,
	}

	p.signingKey, err = m.G().Keyrings.GetSecretKeyWithPrompt(m, m.SecretKeyPromptArg(ska, "tracking signature"))
	if err != nil {
		return err
	}

	sigVersion := libkb.SigVersion(*p.arg.SigVersion)

	if p.proof, err = p.me.ServiceProof(m, p.signingKey, p.st, p.remoteNameNormalized, sigVersion); err != nil {
		return err
	}

	if p.sigInner, err = p.proof.Marshal(); err != nil {
		return err
	}

	p.sig, p.sigID, _, err = libkb.MakeSig(
		m,
		p.signingKey,
		libkb.LinkTypeWebServiceBinding,
		p.sigInner,
		libkb.SigHasRevokes(false),
		keybase1.SeqType_PUBLIC,
		libkb.SigIgnoreIfUnsupported(false),
		p.me,
		sigVersion,
	)

	return err
}

func (p *Prove) postProofToServer(m libkb.MetaContext) (err error) {
	arg := libkb.PostProofArg{
		Sig:               p.sig,
		ProofType:         p.st.GetProofType(),
		RemoteServiceType: p.st.GetTypeName(),
		ID:                p.sigID,
		Supersede:         p.supersede,
		RemoteUsername:    p.remoteNameNormalized,
		RemoteKey:         p.st.GetAPIArgKey(),
		SigningKey:        p.signingKey,
	}
	if libkb.SigVersion(*p.arg.SigVersion) == libkb.KeybaseSignatureV2 {
		arg.SigInner = p.sigInner
	}
	p.postRes, err = libkb.PostProof(m, arg)
	return err
}

func (p *Prove) instructAction(m libkb.MetaContext) (err error) {
	mkp := p.st.PostInstructions(p.remoteNameNormalized)
	var txt string
	if txt, err = p.st.FormatProofText(m, p.postRes, p.me.GetNormalizedName().String(), p.sigID); err != nil {
		return err
	}
	err = m.UIs().ProveUI.OutputInstructions(m.Ctx(), keybase1.OutputInstructionsArg{
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

	return p.checkAutoPost(m, txt)
}

func (p *Prove) checkAutoPost(m libkb.MetaContext, txt string) error {
	if !p.arg.Auto {
		return nil
	}
	if libkb.RemoteServiceTypes[p.arg.Service] != keybase1.ProofType_ROOTER {
		return nil
	}
	m.CDebugf("making automatic post of proof to rooter")
	apiArg := libkb.APIArg{
		Endpoint:    "rooter",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"post":     libkb.S{Val: txt},
			"username": libkb.S{Val: p.arg.Username},
		},
		NetContext: m.Ctx(),
	}
	if _, err := m.G().API.Post(apiArg); err != nil {
		m.CDebugf("error posting to rooter: %s", err)
		return err
	}
	return nil
}

func (p *Prove) promptPostedLoop(m libkb.MetaContext) (err error) {
	found := false
	for i := 0; ; i++ {
		var retry bool
		var status keybase1.ProofStatus
		var warn *libkb.Markup
		retry, err = m.UIs().ProveUI.OkToCheck(m.Ctx(), keybase1.OkToCheckArg{
			Name:    p.st.DisplayName(),
			Attempt: i,
		})
		if !retry || err != nil {
			break
		}
		found, status, _, err = libkb.CheckPosted(m, p.postRes.ID)
		if found || err != nil {
			break
		}
		warn, err = p.st.RecheckProofPosting(i, status, p.remoteNameNormalized)
		if warn != nil {
			uierr := m.UIs().ProveUI.DisplayRecheckWarning(m.Ctx(), keybase1.DisplayRecheckWarningArg{
				Text: warn.Export(),
			})
			if uierr != nil {
				m.CWarningf("prove ui DisplayRecheckWarning call error: %s", uierr)
			}
		}
		if err != nil {
			break
		}
	}
	if !found && err == nil {
		err = libkb.ProofNotYetAvailableError{}
	}

	return err
}

func (p *Prove) checkProofText(m libkb.MetaContext) error {
	m.CDebugf("p.postRes.Text: %q", p.postRes.Text)
	m.CDebugf("p.sigID: %q", p.sigID)
	return p.st.CheckProofText(p.postRes.Text, p.sigID, p.sig)
}

func (p *Prove) getServiceType(m libkb.MetaContext) (err error) {
	p.st = m.G().GetProofServices().GetServiceType(p.arg.Service)
	if p.st == nil {
		return libkb.BadServiceError{Service: p.arg.Service}
	}
	if !p.st.CanMakeNewProofs(m) {
		return libkb.ServiceDoesNotSupportNewProofsError{Service: p.arg.Service}
	}
	return nil
}

// SigID returns the signature id of the proof posted to the
// server.
func (p *Prove) SigID() keybase1.SigID {
	return p.sigID
}

// Run runs the Prove engine, performing all steps of the proof process.
func (p *Prove) Run(m libkb.MetaContext) (err error) {
	defer m.CTrace("ProofEngine.Run", func() error { return err })()

	stage := func(s string) {
		m.CDebugf("| ProofEngine.Run() %s", s)
	}

	stage("GetServiceType")
	if err = p.getServiceType(m); err != nil {
		return err
	}
	stage("LoadMe")
	if err = p.loadMe(m); err != nil {
		return err
	}
	stage("CheckExists1")
	if err = p.checkExists1(m); err != nil {
		return err
	}
	stage("PromptRemoteName")
	if err = p.promptRemoteName(m); err != nil {
		return err
	}
	stage("CheckExists2")
	if err = p.checkExists2(m); err != nil {
		return err
	}
	stage("DoPrechecks")
	if err = p.doPrechecks(m); err != nil {
		return err
	}
	stage("DoWarnings")
	if err = p.doWarnings(m); err != nil {
		return err
	}
	m.G().LocalSigchainGuard().Set(m.Ctx(), "Prove")
	defer m.G().LocalSigchainGuard().Clear(m.Ctx(), "Prove")
	stage("GenerateProof")
	if err = p.generateProof(m); err != nil {
		return err
	}
	stage("PostProofToServer")
	if err = p.postProofToServer(m); err != nil {
		return err
	}
	m.G().LocalSigchainGuard().Clear(m.Ctx(), "Prove")
	stage("CheckProofText")
	if err = p.checkProofText(m); err != nil {
		return err
	}
	stage("InstructAction")
	if err = p.instructAction(m); err != nil {
		return err
	}

	if !p.arg.PromptPosted {
		m.CDebugf("PromptPosted not set, prove run finished")
		return nil
	}

	stage("PromptPostedLoop")
	if err = p.promptPostedLoop(m); err != nil {
		return err
	}
	m.UIs().LogUI.Notice("Success!")
	return nil
}
