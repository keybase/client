// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build !production

package libkb

import (
	"net/url"
	"regexp"
	"strings"

	keybase1 "github.com/keybase/client/go/protocol"
	jsonw "github.com/keybase/go-jsonw"
)

//=============================================================================
// Rooter
//

type RooterChecker struct {
	proof RemoteProofChainLink
}

func NewRooterChecker(p RemoteProofChainLink) (*RooterChecker, ProofError) {
	return &RooterChecker{p}, nil
}

func (rc *RooterChecker) GetTorError() ProofError { return nil }

func (rc *RooterChecker) CheckHint(g *GlobalContext, h SigHint) (err ProofError) {
	g.Log.Debug("+ Rooter check hint: %v", h)
	defer func() {
		g.Log.Debug("- Rooter check hint: %v", err)
	}()

	u, perr := url.Parse(strings.ToLower(h.apiURL))
	if perr != nil {
		err = NewProofError(keybase1.ProofStatus_BAD_API_URL,
			"Bad hint from server (%s): %v", h.apiURL, perr)
		return
	}
	wantedMedID := rc.proof.GetSigID().ToMediumID()
	wantedPathPrefix := APIURIPathPrefix + "/rooter/" + strings.ToLower(rc.proof.GetRemoteUsername()) + "/"
	if !strings.HasPrefix(u.Path, wantedPathPrefix) {
		err = NewProofError(keybase1.ProofStatus_BAD_API_URL,
			"Bad hint from server; URL should have path prefix '%s'; got %v", wantedPathPrefix, u)
	} else if !strings.Contains(h.checkText, wantedMedID) {
		err = NewProofError(keybase1.ProofStatus_BAD_SIGNATURE,
			"Bad proof-check text from server; need '%s' as a substring", wantedMedID)
	}
	return err
}

func (rc *RooterChecker) ScreenNameCompare(s1, s2 string) bool {
	return Cicmp(s1, s2)
}

func (rc *RooterChecker) CheckData(h SigHint, dat string) ProofError {
	_, sigID, err := OpenSig(rc.proof.GetArmoredSig())
	if err != nil {
		return NewProofError(keybase1.ProofStatus_BAD_SIGNATURE,
			"Bad signature: %s", err)
	} else if !strings.Contains(dat, sigID.ToMediumID()) {
		return NewProofError(keybase1.ProofStatus_TEXT_NOT_FOUND,
			"Missing signature ID (%s) in post title ('%s')",
			sigID.ToMediumID(), dat)
	}
	return nil
}

func (rc *RooterChecker) contentMissing(err error) ProofError {
	return NewProofError(keybase1.ProofStatus_CONTENT_MISSING, "Bad proof JSON: %s", err)
}

func (rc *RooterChecker) UnpackData(inp *jsonw.Wrapper) (string, ProofError) {
	var status, post string
	var err error

	cf := keybase1.ProofStatus_CONTENT_FAILURE

	inp.AtPath("status.name").GetStringVoid(&status, &err)
	if err != nil {
		return "", rc.contentMissing(err)
	}
	if status != "OK" {
		var code int
		inp.AtPath("status.code").GetIntVoid(&code, &err)
		if err != nil {
			return "", rc.contentMissing(err)
		}
		if code == SCNotFound {
			return "", NewProofError(keybase1.ProofStatus_NOT_FOUND, status)
		}
		return "", NewProofError(cf, "Rooter: Non-OK status: %s", status)
	}

	inp.AtPath("toot.post").GetStringVoid(&post, &err)
	if err != nil {
		return "", rc.contentMissing(err)
	}

	return post, nil

}

func (rc *RooterChecker) rewriteURL(g *GlobalContext, s string) (string, error) {
	u1, err := url.Parse(s)
	if err != nil {
		return "", err
	}
	u2, err := url.Parse(g.Env.GetServerURI())
	if err != nil {
		return "", err
	}

	u3 := url.URL{
		Host:     u2.Host,
		Scheme:   u2.Scheme,
		Path:     u1.Path,
		Fragment: u1.Fragment,
	}

	return u3.String(), nil
}

func (rc *RooterChecker) CheckStatus(g *GlobalContext, h SigHint) (perr ProofError) {

	g.Log.Debug("+ Checking rooter at API=%s", h.apiURL)
	defer func() {
		g.Log.Debug("- Rooter -> %v", perr)
	}()

	url, err := rc.rewriteURL(g, h.apiURL)
	if err != nil {
		return XapiError(err, url)
	}
	g.Log.Debug("| URL after rewriter is: %s", url)

	res, err := g.XAPI.Get(NewAPIArg(g, url))

	if err != nil {
		perr = XapiError(err, url)
		return perr
	}
	dat, perr := rc.UnpackData(res.Body)
	if perr != nil {
		return perr
	}

	perr = rc.CheckData(h, dat)
	return perr
}

//
//=============================================================================

type RooterServiceType struct{ BaseServiceType }

func (t RooterServiceType) AllStringKeys() []string { return t.BaseAllStringKeys(t) }

var rooterUsernameRegexp = regexp.MustCompile(`^(?i:[a-z0-9_]{1,20})$`)

func (t RooterServiceType) NormalizeUsername(s string) (string, error) {
	if !rooterUsernameRegexp.MatchString(s) {
		return "", BadUsernameError{s}
	}
	return strings.ToLower(s), nil
}

func (t RooterServiceType) NormalizeRemoteName(g *GlobalContext, s string) (string, error) {
	// Allow a leading '@'.
	s = strings.TrimPrefix(s, "@")
	return t.NormalizeUsername(s)
}

func (t RooterServiceType) GetPrompt() string {
	return "Your username on Rooter"
}

func (t RooterServiceType) ToServiceJSON(un string) *jsonw.Wrapper {
	return t.BaseToServiceJSON(t, un)
}

func (t RooterServiceType) PostInstructions(un string) *Markup {
	return FmtMarkup(`Please toot the following, and don't delete it:`)
}

func (t RooterServiceType) DisplayName(un string) string { return "Rooter" }
func (t RooterServiceType) GetTypeName() string          { return "rooter" }
func (t RooterServiceType) RecheckProofPosting(tryNumber int, status keybase1.ProofStatus, _ string) (warning *Markup, err error) {
	return t.BaseRecheckProofPosting(tryNumber, status)
}
func (t RooterServiceType) GetProofType() string { return "test.web_service_binding.rooter" }

func (t RooterServiceType) CheckProofText(text string, id keybase1.SigID, sig string) (err error) {
	return t.BaseCheckProofTextShort(text, id, true)
}

//=============================================================================

func init() {
	RegisterServiceType(RooterServiceType{})
	RegisterSocialNetwork("rooter")
	RegisterMakeProofCheckerFunc("rooter",
		func(l RemoteProofChainLink) (ProofChecker, ProofError) {
			return NewRooterChecker(l)
		})
}

//=============================================================================
