// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package externals

import (
	"net/url"
	"regexp"
	"strings"

	libkb "github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
)

//=============================================================================
// Reddit
//

type RedditChecker struct {
	proof libkb.RemoteProofChainLink
}

var _ libkb.ProofChecker = (*RedditChecker)(nil)

const (
	RedditPrefix = "https://www.reddit.com"
	RedditSub    = RedditPrefix + "/r/keybaseproofs"
)

func NewRedditChecker(p libkb.RemoteProofChainLink) (*RedditChecker, libkb.ProofError) {
	return &RedditChecker{p}, nil
}

func (rc *RedditChecker) GetTorError() libkb.ProofError { return nil }

func (rc *RedditChecker) CheckStatus(ctx libkb.ProofContext, h libkb.SigHint, _ libkb.ProofCheckerMode, pvlU libkb.PvlUnparsed) libkb.ProofError {
	return CheckProofPvl(ctx, keybase1.ProofType_REDDIT, rc.proof, h, pvlU)
}

//
//=============================================================================

func urlReencode(s string) string {
	// Use '+'-encoding for a smaller URL
	// Replace '(', ")" and "'" so that URL-detection works in Linux
	// Padding is not needed now, but might be in the future depending on
	// changes we make
	s = strings.Replace(s, `%20`, "+", -1)
	rxx := regexp.MustCompile(`[()']`)
	s = rxx.ReplaceAllStringFunc(s, func(r string) string {
		if r == "(" {
			return `%28`
		} else if r == ")" {
			return `%29`
		} else if r == "'" {
			return `%27`
		}
		return ""
	})
	return s
}

type RedditServiceType struct{ libkb.BaseServiceType }

func (t RedditServiceType) AllStringKeys() []string { return t.BaseAllStringKeys(t) }

var redditUsernameRegexp = regexp.MustCompile(`^(?i:[a-z0-9_-]{3,20})$`)

func (t RedditServiceType) NormalizeUsername(s string) (string, error) {
	if !redditUsernameRegexp.MatchString(s) {
		return "", libkb.NewBadUsernameError(s)
	}
	return strings.ToLower(s), nil
}

func (t RedditServiceType) NormalizeRemoteName(ctx libkb.ProofContext, s string) (ret string, err error) {
	return t.NormalizeUsername(s)
}

func (t RedditServiceType) GetTypeName() string { return "reddit" }

func (t RedditServiceType) GetPrompt() string { return "Your username on Reddit" }

func (t RedditServiceType) ToServiceJSON(un string) *jsonw.Wrapper {
	return t.BaseToServiceJSON(t, un)
}

func (t RedditServiceType) PostInstructions(un string) *libkb.Markup {
	return libkb.FmtMarkup(`Please click on the following link to post to Reddit:`)
}

func (t RedditServiceType) FormatProofText(ctx libkb.ProofContext, ppr *libkb.PostProofRes) (res string, err error) {

	var title string
	if title, err = ppr.Metadata.AtKey("title").GetString(); err != nil {
		return
	}

	q := urlReencode(libkb.HTTPArgs{"title": libkb.S{Val: title}, "text": libkb.S{Val: ppr.Text}}.EncodeToString())

	// The new reddit mobile site doesn't respect the post-pre-populate query
	// parameters. Use the old mobile site until they fix this.
	var host string
	if ctx.GetAppType() == libkb.MobileAppType {
		host = "i.reddit.com"
	} else {
		// Note that this is commonly libkb.NoAppType. Don't assume that we get
		// libkb.DesktopAppType in the non-mobile case.
		host = "www.reddit.com"
	}

	u := url.URL{
		Scheme:   "https",
		Host:     host,
		Path:     "/r/KeybaseProofs/submit",
		RawQuery: q,
	}

	res = u.String()
	return
}

func (t RedditServiceType) DisplayName(un string) string { return "Reddit" }

func (t RedditServiceType) RecheckProofPosting(tryNumber int, status keybase1.ProofStatus, _ string) (warning *libkb.Markup, err error) {
	warning, err = t.BaseRecheckProofPosting(tryNumber, status)
	return
}

func (t RedditServiceType) GetProofType() string { return t.BaseGetProofType(t) }

func (t RedditServiceType) CheckProofText(text string, id keybase1.SigID, sig string) (err error) {
	return t.BaseCheckProofTextFull(text, id, sig)
}

func (t RedditServiceType) MakeProofChecker(l libkb.RemoteProofChainLink) libkb.ProofChecker {
	return &RedditChecker{l}
}

//=============================================================================

func init() {
	externalServices.Register(RedditServiceType{})
}

//=============================================================================
