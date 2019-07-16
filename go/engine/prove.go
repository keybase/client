// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"fmt"
	"strings"
	"time"

	"github.com/keybase/client/go/externals"
	libkb "github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

// Prove is an engine used for proving ownership of remote accounts,
// like Twitter, GitHub, etc.
type Prove struct {
	arg               *keybase1.StartProofArg
	me                *libkb.User
	serviceType       libkb.ServiceType
	serviceParameters *keybase1.ProveParameters
	supersede         bool
	proof             *libkb.ProofMetadataRes
	sig               string
	sigID             keybase1.SigID
	linkID            libkb.LinkID
	postRes           *libkb.PostProofRes
	signingKey        libkb.GenericKey
	sigInner          []byte

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
	proofs := p.me.IDTable().GetActiveProofsFor(p.serviceType)
	if len(proofs) != 0 && !p.arg.Force && p.serviceType.LastWriterWins() {
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
		remoteNameNormalized, err := p.serviceType.NormalizeRemoteName(m, p.arg.Username)
		if err == nil {
			p.remoteNameNormalized = remoteNameNormalized
		}
		return err
	}

	// Prompt for the name, retrying if it's invalid.
	var normalizationError error
	for {
		un, err := m.UIs().ProveUI.PromptUsername(m.Ctx(), keybase1.PromptUsernameArg{
			Prompt:     p.serviceType.GetPrompt(),
			PrevError:  libkb.ExportErrorAsStatus(m.G(), normalizationError),
			Parameters: p.serviceParameters,
		})
		if err != nil {
			// Errors here are conditions like EOF. Return them rather than retrying.
			return err
		}
		var remoteNameNormalized string
		remoteNameNormalized, normalizationError = p.serviceType.NormalizeRemoteName(m, un)
		if normalizationError == nil {
			p.remoteNameNormalized = remoteNameNormalized
			return nil
		}
	}
}

func (p *Prove) checkExists2(m libkb.MetaContext) (err error) {
	defer m.Trace("Prove#CheckExists2", func() error { return err })()
	if !p.serviceType.LastWriterWins() {
		var found libkb.RemoteProofChainLink
		for _, proof := range p.me.IDTable().GetActiveProofsFor(p.serviceType) {
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
	w, err = p.serviceType.PreProofCheck(m, p.remoteNameNormalized)
	if w != nil {
		if uierr := m.UIs().ProveUI.OutputPrechecks(m.Ctx(), keybase1.OutputPrechecksArg{Text: w.Export()}); uierr != nil {
			m.Warning("prove ui OutputPrechecks call error: %s", uierr)
		}
	}
	return err
}

func (p *Prove) doWarnings(m libkb.MetaContext) (err error) {
	if mu := p.serviceType.PreProofWarning(p.remoteNameNormalized); mu != nil {
		var ok bool
		arg := keybase1.PreProofWarningArg{Text: mu.Export()}
		if ok, err = m.UIs().ProveUI.PreProofWarning(m.Ctx(), arg); err == nil && !ok {
			err = libkb.NotConfirmedError{}
		}
		if err != nil {
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

	if p.proof, err = p.me.ServiceProof(m, p.signingKey, p.serviceType, p.remoteNameNormalized, sigVersion); err != nil {
		return err
	}

	if p.sigInner, err = p.proof.J.Marshal(); err != nil {
		return err
	}

	p.sig, p.sigID, p.linkID, err = libkb.MakeSig(
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
		UID:               p.me.GetUID(),
		Seqno:             p.proof.Seqno,
		Sig:               p.sig,
		ProofType:         p.serviceType.GetProofType(),
		RemoteServiceType: p.serviceType.GetTypeName(),
		SigID:             p.sigID,
		LinkID:            p.linkID,
		Supersede:         p.supersede,
		RemoteUsername:    p.remoteNameNormalized,
		RemoteKey:         p.serviceType.GetAPIArgKey(),
		SigningKey:        p.signingKey,
	}
	if libkb.SigVersion(*p.arg.SigVersion) == libkb.KeybaseSignatureV2 {
		arg.SigInner = p.sigInner
	}
	p.postRes, err = libkb.PostProof(m, arg)
	return err
}

func (p *Prove) instructAction(m libkb.MetaContext) (err error) {
	mkp := p.serviceType.PostInstructions(p.remoteNameNormalized)
	var txt string
	if txt, err = p.serviceType.FormatProofText(m, p.postRes, p.me.GetNormalizedName().String(), p.remoteNameNormalized, p.sigID); err != nil {
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
		Proof:      strings.TrimSpace(txt),
		Parameters: p.serviceParameters,
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
	m.Debug("making automatic post of proof to rooter")
	apiArg := libkb.APIArg{
		Endpoint:    "rooter",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"post":     libkb.S{Val: txt},
			"username": libkb.S{Val: p.arg.Username},
		},
	}
	if _, err := m.G().API.Post(m, apiArg); err != nil {
		m.Debug("error posting to rooter: %s", err)
		return err
	}
	return nil
}

// Keep asking the user whether they posted the proof
// until it works or they give up.
func (p *Prove) promptPostedLoop(m libkb.MetaContext) (err error) {
	found := false
	for i := 0; ; i++ {
		var retry bool
		var status keybase1.ProofStatus
		var warn *libkb.Markup
		retry, err = m.UIs().ProveUI.OkToCheck(m.Ctx(), keybase1.OkToCheckArg{
			Name:    p.serviceType.DisplayName(),
			Attempt: i,
		})
		if !retry || err != nil {
			break
		}
		found, status, _, err = libkb.CheckPosted(m, p.sigID)
		if found || err != nil {
			break
		}
		warn, err = p.serviceType.RecheckProofPosting(i, status, p.remoteNameNormalized)
		if warn != nil {
			uierr := m.UIs().ProveUI.DisplayRecheckWarning(m.Ctx(), keybase1.DisplayRecheckWarningArg{
				Text: warn.Export(),
			})
			if uierr != nil {
				m.Warning("prove ui DisplayRecheckWarning call error: %s", uierr)
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

// Poll until the proof succeeds, limited to an hour.
func (p *Prove) verifyLoop(m libkb.MetaContext) (err error) {
	timeout := time.Hour
	m, cancel := m.WithTimeout(timeout)
	defer cancel()
	defer func() {
		if err != nil && m.Ctx().Err() == context.DeadlineExceeded {
			m.Debug("Prove.verifyLoop rewriting error after timeout: %v", err)
			err = fmt.Errorf("Timed out after looking for proof for %v", timeout)
		}
	}()
	uierr := m.UIs().ProveUI.Checking(m.Ctx(), keybase1.CheckingArg{
		Name: p.serviceType.DisplayName(),
	})
	if uierr != nil {
		m.Warning("prove ui Checking call error: %s", uierr)
	}
	for i := 0; ; i++ {
		if shouldContinue, uierr := m.UIs().ProveUI.ContinueChecking(m.Ctx(), 0); !shouldContinue || uierr != nil {
			if uierr != nil {
				m.Warning("prove ui ContinueChecking call error: %s", uierr)
			}
			return libkb.CanceledError{}
		}
		found, status, _, err := libkb.CheckPosted(m, p.sigID)
		if err != nil {
			return err
		}
		m.Debug("Prove.verifyLoop round:%v found:%v status:%v", i, found, status)
		if found {
			return nil
		}
		wakeAt := m.G().Clock().Now().Add(2 * time.Second)
		err = libkb.SleepUntilWithContext(m.Ctx(), m.G().Clock(), wakeAt)
		if err != nil {
			return err
		}
	}
}

func (p *Prove) checkProofText(m libkb.MetaContext) error {
	m.Debug("p.postRes.Text: %q", p.postRes.Text)
	m.Debug("p.sigID: %q", p.sigID)
	return p.serviceType.CheckProofText(p.postRes.Text, p.sigID, p.sig)
}

func (p *Prove) getServiceType(m libkb.MetaContext) (err error) {
	p.serviceType = m.G().GetProofServices().GetServiceType(m.Ctx(), p.arg.Service)
	if p.serviceType == nil {
		return libkb.BadServiceError{Service: p.arg.Service}
	}
	if !p.serviceType.CanMakeNewProofs(m) {
		return libkb.ServiceDoesNotSupportNewProofsError{Service: p.arg.Service}
	}
	if serviceType, ok := p.serviceType.(*externals.GenericSocialProofServiceType); ok {
		tmp := serviceType.ProveParameters(m)
		p.serviceParameters = &tmp
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
	defer m.Trace("ProofEngine.Run", func() error { return err })()

	stage := func(s string) {
		m.Debug("| ProofEngine.Run() %s", s)
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
		m.Debug("PromptPosted not set, prove run finished")
		return nil
	}

	stage("CheckStart")
	if p.serviceParameters == nil {
		stage("PromptPostedLoop")
		if err = p.promptPostedLoop(m); err != nil {
			return err
		}
	} else {
		stage("VerifyLoop")
		if err = p.verifyLoop(m); err != nil {
			return err
		}
	}
	m.UIs().LogUI.Notice("Success!")
	return nil
}
