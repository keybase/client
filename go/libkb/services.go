// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"fmt"
	"regexp"
	"strings"
	"sync"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
	"golang.org/x/net/context"
)

//=============================================================================

func MakeProofChecker(mctx MetaContext, c ExternalServicesCollector, l RemoteProofChainLink) (ProofChecker, ProofError) {
	if c == nil {
		return nil, NewProofError(keybase1.ProofStatus_UNKNOWN_TYPE,
			"No proof services configured")
	}
	k := l.TableKey()
	st := c.GetServiceType(mctx.Ctx(), k)
	if st == nil {
		return nil, NewProofError(keybase1.ProofStatus_UNKNOWN_TYPE,
			"No proof service for type: %s", k)
	}
	pc := st.MakeProofChecker(l)
	if pc == nil {
		return nil, NewProofError(keybase1.ProofStatus_UNKNOWN_TYPE,
			"No proof checker for type: %s", k)
	}
	return pc, nil
}

//=============================================================================

type BaseServiceType struct {
	sync.Mutex
	displayConf *keybase1.ServiceDisplayConfig
}

func (t *BaseServiceType) SetDisplayConfig(displayConf *keybase1.ServiceDisplayConfig) {
	t.Lock()
	defer t.Unlock()
	t.displayConf = displayConf
}

func (t *BaseServiceType) BaseCheckProofTextShort(text string, id keybase1.SigID, med bool) error {
	blocks := FindBase64Snippets(text)
	var target string
	if med {
		target = id.ToMediumID()
	} else {
		target = id.ToShortID()
	}
	for _, b := range blocks {
		if len(b) < len(target) {
			continue
		}
		if b != target {
			return WrongSigError{b}
		}
		// found match:
		return nil
	}
	return NotFoundError{"Couldn't find signature ID " + target + " in text"}
}

func (t *BaseServiceType) BaseRecheckProofPosting(tryNumber int, status keybase1.ProofStatus) (warning *Markup, err error) {
	warning = FmtMarkup("Couldn't find posted proof.")
	return
}

func (t *BaseServiceType) BaseToServiceJSON(st ServiceType, un string) *jsonw.Wrapper {
	ret := jsonw.NewDictionary()
	ret.SetKey("name", jsonw.NewString(st.GetTypeName()))
	ret.SetKey("username", jsonw.NewString(un))
	return ret
}

func (t *BaseServiceType) BaseGetProofType(st ServiceType) string {
	return "web_service_binding." + st.GetTypeName()
}

func (t *BaseServiceType) LastWriterWins() bool                               { return true }
func (t *BaseServiceType) PreProofCheck(MetaContext, string) (*Markup, error) { return nil, nil }
func (t *BaseServiceType) PreProofWarning(remotename string) *Markup          { return nil }

func (t *BaseServiceType) FormatProofText(m MetaContext, ppr *PostProofRes,
	kbUsername, remoteUsername string, sigID keybase1.SigID) (string, error) {
	return ppr.Text, nil
}

func (t *BaseServiceType) BaseCheckProofTextFull(text string, id keybase1.SigID, sig string) (err error) {
	blocks := FindBase64Blocks(text)
	target := FindFirstBase64Block(sig)
	if len(target) == 0 {
		err = BadSigError{"Generated sig was invalid"}
		return
	}
	found := false
	for _, b := range blocks {
		if len(b) < 80 {
			continue
		}
		if b != target {
			err = WrongSigError{b}
			return
		}
		found = true
	}
	if !found {
		err = NotFoundError{"Couldn't find signature ID " + target + " in text"}
	}
	return
}

var urlRxx = regexp.MustCompile(`https://(\S+)`)

func (t *BaseServiceType) BaseCheckProofForURL(text string, id keybase1.SigID) (err error) {
	target := id.ToMediumID()
	urls := urlRxx.FindAllString(text, -1)
	found := false
	for _, u := range urls {
		if strings.HasSuffix(u, target) {
			found = true
		}
	}
	if !found {
		err = NotFoundError{"Didn't find a URL with suffix '" + target + "'"}
	}
	return
}

func (t *BaseServiceType) GetAPIArgKey() string {
	return "remote_username"
}

func (t *BaseServiceType) IsDevelOnly() bool { return false }

func (t *BaseServiceType) GetLogoKey() string {
	t.Lock()
	defer t.Unlock()
	if t.displayConf == nil {
		return ""
	}
	if t.displayConf.LogoKey != "" {
		return t.displayConf.LogoKey
	}
	return t.displayConf.Key
}

func (t *BaseServiceType) DisplayPriority() int {
	t.Lock()
	defer t.Unlock()
	if t.displayConf == nil {
		return 0
	}
	return t.displayConf.Priority
}

func (t *BaseServiceType) DisplayGroup() string {
	t.Lock()
	defer t.Unlock()
	if t.displayConf == nil || t.displayConf.Group == nil {
		return ""
	}
	return *t.displayConf.Group
}

func (t *BaseServiceType) CanMakeNewProofs(mctx MetaContext) bool {
	return t.canMakeNewProofsHelper(mctx, false)
}

func (t *BaseServiceType) CanMakeNewProofsSkipFeatureFlag(mctx MetaContext) bool {
	return t.canMakeNewProofsHelper(mctx, true)
}

func (t *BaseServiceType) canMakeNewProofsHelper(mctx MetaContext, skipFeatureFlag bool) bool {
	t.Lock()
	defer t.Unlock()
	if mctx.G().GetEnv().GetProveBypass() {
		return true
	}
	if t.displayConf == nil {
		return true
	}
	if !skipFeatureFlag {
		if mctx.G().FeatureFlags.Enabled(mctx, ExperimentalGenericProofs) {
			return true
		}
	}
	return !t.displayConf.CreationDisabled
}

func (t *BaseServiceType) IsNew(mctx MetaContext) bool {
	if t.displayConf == nil {
		return false
	}
	return t.displayConf.New
}

//=============================================================================

type assertionContext struct {
	mctx MetaContext
	esc  ExternalServicesCollector
}

func MakeAssertionContext(mctx MetaContext, s ExternalServicesCollector) AssertionContext {
	return assertionContext{mctx: mctx, esc: s}
}

func (a assertionContext) Ctx() context.Context { return a.mctx.Ctx() }

func (a assertionContext) NormalizeSocialName(service string, username string) (string, error) {
	st := a.esc.GetServiceType(a.Ctx(), service)
	if st == nil {
		return "", fmt.Errorf("Unknown social network: %s", service)
	}
	return st.NormalizeUsername(username)
}
