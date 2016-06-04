// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"regexp"
	"strings"

	keybase1 "github.com/keybase/client/go/protocol"
	jsonw "github.com/keybase/go-jsonw"
)

type ServiceType interface {
	AllStringKeys() []string

	// NormalizeUsername normalizes the given username, assuming
	// that it's free of any leading strings like '@' or 'dns://'.
	NormalizeUsername(string) (string, error)

	// NormalizeRemote normalizes the given remote username, which
	// is usually but not always the same as the username. It also
	// allows leaders like '@' and 'dns://'.
	NormalizeRemoteName(string) (string, error)

	ToChecker() Checker
	GetPrompt() string
	LastWriterWins() bool
	PreProofCheck(remotename string) (*Markup, error)
	PreProofWarning(remotename string) *Markup
	ToServiceJSON(remotename string) *jsonw.Wrapper
	PostInstructions(remotename string) *Markup
	DisplayName(remotename string) string
	RecheckProofPosting(tryNumber int, status keybase1.ProofStatus, remotename string) (warning *Markup, err error)
	GetProofType() string
	GetTypeName() string
	CheckProofText(text string, id keybase1.SigID, sig string) error
	FormatProofText(*PostProofRes) (string, error)
	GetAPIArgKey() string
}

var _stDispatch = make(map[string]ServiceType)

func RegisterServiceType(st ServiceType) {
	for _, k := range st.AllStringKeys() {
		_stDispatch[k] = st
	}
}

func GetServiceType(s string) ServiceType {
	return _stDispatch[strings.ToLower(s)]
}

//=============================================================================

type BaseServiceType struct{}

func (t BaseServiceType) BaseCheckProofTextShort(text string, id keybase1.SigID, med bool) error {
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

func (t BaseServiceType) BaseRecheckProofPosting(tryNumber int, status keybase1.ProofStatus) (warning *Markup, err error) {
	warning = FmtMarkup("Couldn't find posted proof.")
	return
}

func (t BaseServiceType) BaseToServiceJSON(st ServiceType, un string) *jsonw.Wrapper {
	ret := jsonw.NewDictionary()
	ret.SetKey("name", jsonw.NewString(st.GetTypeName()))
	ret.SetKey("username", jsonw.NewString(un))
	return ret
}

func (t BaseServiceType) BaseGetProofType(st ServiceType) string {
	return "web_service_binding." + st.GetTypeName()
}

func (t BaseServiceType) BaseToChecker(st ServiceType, hint string) Checker {
	return Checker{
		F: func(s string) bool {
			_, err := st.NormalizeRemoteName(s)
			return (err == nil)
		},
		Hint:          hint,
		PreserveSpace: false,
	}
}

func (t BaseServiceType) BaseAllStringKeys(st ServiceType) []string {
	return []string{st.GetTypeName()}
}

func (t BaseServiceType) LastWriterWins() bool                      { return true }
func (t BaseServiceType) PreProofCheck(string) (*Markup, error)     { return nil, nil }
func (t BaseServiceType) PreProofWarning(remotename string) *Markup { return nil }

func (t BaseServiceType) FormatProofText(ppr *PostProofRes) (string, error) {
	return ppr.Text, nil
}

func (t BaseServiceType) BaseCheckProofTextFull(text string, id keybase1.SigID, sig string) (err error) {
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

func (t BaseServiceType) BaseCheckProofForURL(text string, id keybase1.SigID) (err error) {
	urlRxx := regexp.MustCompile(`https://(\S+)`)
	target := id.ToMediumID()
	urls := urlRxx.FindAllString(text, -1)
	G.Log.Debug("Found urls %v", urls)
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

func (t BaseServiceType) GetAPIArgKey() string {
	return "remote_username"
}

//=============================================================================
