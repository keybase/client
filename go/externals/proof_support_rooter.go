// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build !production

package externals

import (
	"net/url"
	"regexp"
	"strings"

	libkb "github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	pvl "github.com/keybase/client/go/pvl"
	jsonw "github.com/keybase/go-jsonw"
)

//=============================================================================
// Rooter
//

type RooterChecker struct {
	proof libkb.RemoteProofChainLink
}

var _ libkb.ProofChecker = (*RooterChecker)(nil)

func NewRooterChecker(p libkb.RemoteProofChainLink) (*RooterChecker, libkb.ProofError) {
	return &RooterChecker{p}, nil
}

func (rc *RooterChecker) GetTorError() libkb.ProofError { return nil }

func (rc *RooterChecker) CheckHint(ctx libkb.ProofContext, h libkb.SigHint) (err libkb.ProofError) {
	if pvl.UsePvl {
		// checking the hint is done later in CheckStatus
		return nil
	}

	ctx.GetLog().Debug("+ Rooter check hint: %v", h)
	defer func() {
		ctx.GetLog().Debug("- Rooter check hint: %v", err)
	}()

	u, perr := url.Parse(strings.ToLower(h.GetAPIURL()))
	if perr != nil {
		err = libkb.NewProofError(keybase1.ProofStatus_BAD_API_URL,
			"Bad hint from server (%s): %v", h.GetAPIURL(), perr)
		return
	}
	wantedMedID := rc.proof.GetSigID().ToMediumID()
	wantedPathPrefix := libkb.APIURIPathPrefix + "/rooter/" + strings.ToLower(rc.proof.GetRemoteUsername()) + "/"
	if !strings.HasPrefix(u.Path, wantedPathPrefix) {
		err = libkb.NewProofError(keybase1.ProofStatus_BAD_API_URL,
			"Bad hint from server; URL should have path prefix '%s'; got %v", wantedPathPrefix, u)
	} else if !strings.Contains(h.GetCheckText(), wantedMedID) {
		err = libkb.NewProofError(keybase1.ProofStatus_BAD_SIGNATURE,
			"Bad proof-check text from server; need '%s' as a substring", wantedMedID)
	}
	return err
}

func (rc *RooterChecker) ScreenNameCompare(s1, s2 string) bool {
	return libkb.Cicmp(s1, s2)
}

func (rc *RooterChecker) CheckData(h libkb.SigHint, dat string) libkb.ProofError {
	_, sigID, err := libkb.OpenSig(rc.proof.GetArmoredSig())
	if err != nil {
		return libkb.NewProofError(keybase1.ProofStatus_BAD_SIGNATURE,
			"Bad signature: %s", err)
	} else if !strings.Contains(dat, sigID.ToMediumID()) {
		return libkb.NewProofError(keybase1.ProofStatus_TEXT_NOT_FOUND,
			"Missing signature ID (%s) in post title ('%s')",
			sigID.ToMediumID(), dat)
	}
	return nil
}

func (rc *RooterChecker) contentMissing(err error) libkb.ProofError {
	return libkb.NewProofError(keybase1.ProofStatus_CONTENT_MISSING, "Bad proof JSON: %s", err)
}

func (rc *RooterChecker) UnpackData(inp *jsonw.Wrapper) (string, libkb.ProofError) {
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
		if code == libkb.SCNotFound {
			return "", libkb.NewProofError(keybase1.ProofStatus_NOT_FOUND, status)
		}
		return "", libkb.NewProofError(cf, "Rooter: Non-OK status: %s", status)
	}

	inp.AtPath("toot.post").GetStringVoid(&post, &err)
	if err != nil {
		return "", rc.contentMissing(err)
	}

	return post, nil

}

func (rc *RooterChecker) rewriteURL(ctx libkb.ProofContext, s string) (string, error) {
	u1, err := url.Parse(s)
	if err != nil {
		return "", err
	}
	u2, err := url.Parse(ctx.GetServerURI())
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

func (rc *RooterChecker) CheckStatus(ctx libkb.ProofContext, h libkb.SigHint) (perr libkb.ProofError) {
	if pvl.UsePvl {
		return pvl.CheckProof(ctx, pvl.GetHardcodedPvlString(), keybase1.ProofType_ROOTER,
			pvl.NewProofInfo(rc.proof, h))
	}
	return rc.CheckStatusOld(ctx, h)
}

func (rc *RooterChecker) CheckStatusOld(ctx libkb.ProofContext, h libkb.SigHint) (perr libkb.ProofError) {
	ctx.GetLog().Debug("+ Checking rooter at API=%s", h.GetAPIURL())
	defer func() {
		ctx.GetLog().Debug("- Rooter -> %v", perr)
	}()

	url, err := rc.rewriteURL(ctx, h.GetAPIURL())
	if err != nil {
		return libkb.XapiError(err, url)
	}
	ctx.GetLog().Debug("| URL after rewriter is: %s", url)

	res, err := ctx.GetExternalAPI().Get(libkb.NewAPIArg(url))

	if err != nil {
		perr = libkb.XapiError(err, url)
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

type RooterServiceType struct{ libkb.BaseServiceType }

func (t RooterServiceType) AllStringKeys() []string { return t.BaseAllStringKeys(t) }

var rooterUsernameRegexp = regexp.MustCompile(`^(?i:[a-z0-9_]{1,20})$`)

func (t RooterServiceType) NormalizeUsername(s string) (string, error) {
	if !rooterUsernameRegexp.MatchString(s) {
		return "", libkb.NewBadUsernameError(s)
	}
	return strings.ToLower(s), nil
}

func (t RooterServiceType) NormalizeRemoteName(_ libkb.ProofContext, s string) (string, error) {
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

func (t RooterServiceType) PostInstructions(un string) *libkb.Markup {
	return libkb.FmtMarkup(`Please toot the following, and don't delete it:`)
}

func (t RooterServiceType) DisplayName(un string) string { return "Rooter" }
func (t RooterServiceType) GetTypeName() string          { return "rooter" }
func (t RooterServiceType) RecheckProofPosting(tryNumber int, status keybase1.ProofStatus, _ string) (warning *libkb.Markup, err error) {
	return t.BaseRecheckProofPosting(tryNumber, status)
}
func (t RooterServiceType) GetProofType() string { return "test.web_service_binding.rooter" }

func (t RooterServiceType) CheckProofText(text string, id keybase1.SigID, sig string) (err error) {
	return t.BaseCheckProofTextShort(text, id, true)
}

func (t RooterServiceType) MakeProofChecker(l libkb.RemoteProofChainLink) libkb.ProofChecker {
	return &RooterChecker{l}
}

func (t RooterServiceType) IsDevelOnly() bool { return true }

//=============================================================================

func init() {
	externalServices.Register(RooterServiceType{})
}

//=============================================================================
