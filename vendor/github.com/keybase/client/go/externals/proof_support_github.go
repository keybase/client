// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package externals

import (
	"regexp"
	"strings"

	libkb "github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	pvl "github.com/keybase/client/go/pvl"
	jsonw "github.com/keybase/go-jsonw"
)

//=============================================================================
// Github
//

type GithubChecker struct {
	proof libkb.RemoteProofChainLink
}

var _ libkb.ProofChecker = (*GithubChecker)(nil)

func NewGithubChecker(p libkb.RemoteProofChainLink) (*GithubChecker, libkb.ProofError) {
	return &GithubChecker{p}, nil
}

func (rc *GithubChecker) GetTorError() libkb.ProofError { return nil }

func (rc *GithubChecker) CheckHint(ctx libkb.ProofContext, h libkb.SigHint) libkb.ProofError {
	if pvl.UsePvl {
		// checking the hint is done later in CheckStatus
		return nil
	}

	given := strings.ToLower(h.GetAPIURL())
	u := strings.ToLower(rc.proof.GetRemoteUsername())
	ok1 := "https://gist.github.com/" + u + "/"
	ok2 := "https://gist.githubusercontent.com/" + u + "/"
	if strings.HasPrefix(given, ok1) || strings.HasPrefix(given, ok2) {
		return nil
	}
	return libkb.NewProofError(keybase1.ProofStatus_BAD_API_URL,
		"Bad hint from server; URL start with either '%s' OR '%s'", ok1, ok2)
}

func (rc *GithubChecker) CheckStatus(ctx libkb.ProofContext, h libkb.SigHint) libkb.ProofError {
	if pvl.UsePvl {
		return pvl.CheckProof(ctx, pvl.GetHardcodedPvlString(), keybase1.ProofType_GITHUB,
			pvl.NewProofInfo(rc.proof, h))
	}
	return rc.CheckStatusOld(ctx, h)
}

func (rc *GithubChecker) CheckStatusOld(ctx libkb.ProofContext, h libkb.SigHint) libkb.ProofError {
	res, err := ctx.GetExternalAPI().GetText(libkb.NewAPIArg(h.GetAPIURL()))

	if err != nil {
		return libkb.XapiError(err, h.GetAPIURL())
	}

	var sigBody []byte
	sigBody, _, err = libkb.OpenSig(rc.proof.GetArmoredSig())
	var ret libkb.ProofError

	if err != nil {
		return libkb.NewProofError(keybase1.ProofStatus_BAD_SIGNATURE,
			"Bad signature: %s", err)
	}

	if !libkb.FindBase64Block(res.Body, sigBody, false) {
		ret = libkb.NewProofError(keybase1.ProofStatus_TEXT_NOT_FOUND, "signature not found in body")
	}

	return ret
}

//
//=============================================================================

type GithubServiceType struct{ libkb.BaseServiceType }

func (t GithubServiceType) AllStringKeys() []string { return t.BaseAllStringKeys(t) }

var githubUsernameRegexp = regexp.MustCompile(`^(?i:[a-z0-9][a-z0-9-]{0,38})$`)

func (t GithubServiceType) NormalizeUsername(s string) (string, error) {
	if !githubUsernameRegexp.MatchString(s) {
		return "", libkb.NewBadUsernameError(s)
	}
	return strings.ToLower(s), nil
}

func (t GithubServiceType) NormalizeRemoteName(ctx libkb.ProofContext, s string) (ret string, err error) {
	// Allow a leading '@'.
	s = strings.TrimPrefix(s, "@")
	return t.NormalizeUsername(s)
}

func (t GithubServiceType) GetPrompt() string {
	return "Your username on Github"
}

func (t GithubServiceType) ToServiceJSON(un string) *jsonw.Wrapper {
	return t.BaseToServiceJSON(t, un)
}

func (t GithubServiceType) PostInstructions(un string) *libkb.Markup {
	return libkb.FmtMarkup(`Please <strong>publicly</strong> post the following Gist,
and name it <strong><color name="red">keybase.md</color></strong>`)
}

func (t GithubServiceType) DisplayName(un string) string { return "Github" }
func (t GithubServiceType) GetTypeName() string          { return "github" }

func (t GithubServiceType) RecheckProofPosting(tryNumber int, status keybase1.ProofStatus, _ string) (warning *libkb.Markup, err error) {
	if status == keybase1.ProofStatus_PERMISSION_DENIED {
		warning = libkb.FmtMarkup("Permission denied! Make sure your gist is <strong>public</strong>.")
	} else {
		warning, err = t.BaseRecheckProofPosting(tryNumber, status)
	}
	return
}
func (t GithubServiceType) GetProofType() string { return t.BaseGetProofType(t) }

func (t GithubServiceType) CheckProofText(text string, id keybase1.SigID, sig string) (err error) {
	return t.BaseCheckProofTextFull(text, id, sig)
}

func (t GithubServiceType) MakeProofChecker(l libkb.RemoteProofChainLink) libkb.ProofChecker {
	return &GithubChecker{l}
}

//=============================================================================

func init() {
	externalServices.Register(GithubServiceType{})
}

//=============================================================================
