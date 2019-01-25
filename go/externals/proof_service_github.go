// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package externals

import (
	"regexp"
	"strings"

	libkb "github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
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

func (rc *GithubChecker) CheckStatus(mctx libkb.MetaContext, h libkb.SigHint, _ libkb.ProofCheckerMode,
	pvlU keybase1.MerkleStoreEntry) (*libkb.SigHint, libkb.ProofError) {
	// TODO CORE-8951 see if we can populate verifiedHint with anything useful.
	return nil, CheckProofPvl(mctx, keybase1.ProofType_GITHUB, rc.proof, h, pvlU)
}

//
//=============================================================================

type GithubServiceType struct{ libkb.BaseServiceType }

func (t *GithubServiceType) Key() string { return t.GetTypeName() }

var githubUsernameRegexp = regexp.MustCompile(`^(?i:[a-z0-9][a-z0-9-]{0,38})$`)

func (t *GithubServiceType) NormalizeUsername(s string) (string, error) {
	if !githubUsernameRegexp.MatchString(s) {
		return "", libkb.NewBadUsernameError(s)
	}
	return strings.ToLower(s), nil
}

func (t *GithubServiceType) NormalizeRemoteName(mctx libkb.MetaContext, s string) (ret string, err error) {
	// Allow a leading '@'.
	s = strings.TrimPrefix(s, "@")
	return t.NormalizeUsername(s)
}

func (t *GithubServiceType) GetPrompt() string {
	return "Your username on Github"
}

func (t *GithubServiceType) ToServiceJSON(un string) *jsonw.Wrapper {
	return t.BaseToServiceJSON(t, un)
}

func (t *GithubServiceType) PostInstructions(un string) *libkb.Markup {
	return libkb.FmtMarkup(`Please <strong>publicly</strong> post the following Gist,
and name it <strong><color name="red">keybase.md</color></strong>`)
}

func (t *GithubServiceType) DisplayName() string   { return "GitHub" }
func (t *GithubServiceType) GetTypeName() string   { return "github" }
func (t *GithubServiceType) PickerSubtext() string { return "github.com" }

func (t *GithubServiceType) RecheckProofPosting(tryNumber int, status keybase1.ProofStatus, _ string) (warning *libkb.Markup, err error) {
	if status == keybase1.ProofStatus_PERMISSION_DENIED {
		warning = libkb.FmtMarkup("Permission denied! Make sure your gist is <strong>public</strong>.")
	} else {
		warning, err = t.BaseRecheckProofPosting(tryNumber, status)
	}
	return
}
func (t *GithubServiceType) GetProofType() string { return t.BaseGetProofType(t) }

func (t *GithubServiceType) CheckProofText(text string, id keybase1.SigID, sig string) (err error) {
	return t.BaseCheckProofTextFull(text, id, sig)
}

func (t *GithubServiceType) MakeProofChecker(l libkb.RemoteProofChainLink) libkb.ProofChecker {
	return &GithubChecker{l}
}
