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
)

//=============================================================================

func MakeProofChecker(c ExternalServicesCollector, l RemoteProofChainLink) (ProofChecker, ProofError) {
	if c == nil {
		return nil, NewProofError(keybase1.ProofStatus_UNKNOWN_TYPE,
			"No proof services configured")
	}
	k := l.TableKey()
	st := c.GetServiceType(k)
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

func (t *BaseServiceType) BaseAllStringKeys(st ServiceType) []string {
	return []string{st.GetTypeName()}
}

func (t *BaseServiceType) LastWriterWins() bool                               { return true }
func (t *BaseServiceType) PreProofCheck(MetaContext, string) (*Markup, error) { return nil, nil }
func (t *BaseServiceType) PreProofWarning(remotename string) *Markup          { return nil }

func (t *BaseServiceType) FormatProofText(m MetaContext, ppr *PostProofRes,
	kbUsername string, sigID keybase1.SigID) (string, error) {
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

func (t *BaseServiceType) DisplayPriority() int {
	t.Lock()
	defer t.Unlock()
	if t.displayConf == nil {
		return 0
	}
	return t.displayConf.Priority
}

func (t *BaseServiceType) CanMakeNewProofs() bool {
	t.Lock()
	defer t.Unlock()
	if t.displayConf == nil {
		return true
	}
	return !t.displayConf.CreationDisabled
}

//=============================================================================

type assertionContext struct {
	esc ExternalServicesCollector
}

func MakeAssertionContext(s ExternalServicesCollector) AssertionContext {
	return assertionContext{esc: s}
}

func (a assertionContext) NormalizeSocialName(service string, username string) (string, error) {
	st := a.esc.GetServiceType(service)
	if st == nil {
		return "", fmt.Errorf("Unknown social network: %s", service)
	}
	return st.NormalizeUsername(username)
}

//=============================================================================

// NOTE the static methods should only be used in tests or as a basic sanity
// check for the syntactical correctness of an assertion. All other callers
// should use the non-static versions.
// This uses only the 'static' services which exclude any parameterized proofs.
type staticAssertionContext struct {
	esc ExternalServicesCollector
}

func MakeStaticAssertionContext(s ExternalServicesCollector) AssertionContext {
	return staticAssertionContext{esc: s}
}

func (a staticAssertionContext) NormalizeSocialName(service string, username string) (string, error) {
	st := a.esc.GetServiceType(service)
	if st == nil {
		// If we don't know about this service, normalize by going to lowercase
		return strings.ToLower(username), nil
	}
	return st.NormalizeUsername(username)
}

//=============================================================================
