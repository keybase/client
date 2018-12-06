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

func (rc *RedditChecker) CheckStatus(mctx libkb.MetaContext, h libkb.SigHint, _ libkb.ProofCheckerMode,
	pvlU keybase1.MerkleStoreEntry) (*libkb.SigHint, libkb.ProofError) {
	// TODO CORE-8951 see if we can populate verifiedHint with anything useful.
	return nil, CheckProofPvl(mctx, keybase1.ProofType_REDDIT, rc.proof, h, pvlU)
}

//
//=============================================================================

func urlReencode(s string) string {
	// Reddit interprets plusses in the query string differently depending
	// on whether the user is using the old or new (2018) design, and
	// on whether it's the title or body of the post.
	// old,     *, '+'   -> ' '
	// old,     *, '%2B' -> '+'
	// new, title, '+'   -> ' '
	// new, title, '%2B' -> ' '
	// new,  body, '+'   -> '+'
	// new,  body, '%2B' -> '+'

	// Examples:
	// https://www.reddit.com/r/test/submit?text=content+fmt%0Aplus+x%2By%20z&title=title+fmt%0Aplus+x%2By%20z
	// old: https://www.reddit.com/r/test/comments/8eee0e/title_fmt_plus_xy_z/
	// new: https://www.reddit.com/r/test/comments/8eelwf/title_fmt_plus_x_y_z/

	// Replace '(', ")" and "'" so that URL-detection works in Linux
	// Padding is not needed now, but might be in the future depending on
	// changes we make
	rxx := regexp.MustCompile(`[()'+]`)
	s = rxx.ReplaceAllStringFunc(s, func(r string) string {
		switch r {
		case `(`:
			return `%28`
		case `)`:
			return `%29`
		case `'`:
			return `%27`
		case `+`:
			// HTTPArgs.EncodeToString has encoded ' ' -> '+'
			// we recode '+' -> '%20'.
			return `%20`
		default:
			return r
		}
	})
	return s
}

type RedditServiceType struct{ libkb.BaseServiceType }

func (t *RedditServiceType) AllStringKeys() []string { return t.BaseAllStringKeys(t) }

var redditUsernameRegexp = regexp.MustCompile(`^(?i:[a-z0-9_-]{3,20})$`)

func (t *RedditServiceType) NormalizeUsername(s string) (string, error) {
	if !redditUsernameRegexp.MatchString(s) {
		return "", libkb.NewBadUsernameError(s)
	}
	return strings.ToLower(s), nil
}

func (t *RedditServiceType) NormalizeRemoteName(mctx libkb.MetaContext, s string) (ret string, err error) {
	return t.NormalizeUsername(s)
}

func (t *RedditServiceType) GetTypeName() string { return "reddit" }

func (t *RedditServiceType) GetPrompt() string { return "Your username on Reddit" }

func (t *RedditServiceType) ToServiceJSON(un string) *jsonw.Wrapper {
	return t.BaseToServiceJSON(t, un)
}

func (t *RedditServiceType) PostInstructions(un string) *libkb.Markup {
	return libkb.FmtMarkup(`Please click on the following link to post to Reddit:`)
}

func (t *RedditServiceType) FormatProofText(mctx libkb.MetaContext, ppr *libkb.PostProofRes,
	kbUsername string, sigID keybase1.SigID) (res string, err error) {
	var title string
	if title, err = ppr.Metadata.AtKey("title").GetString(); err != nil {
		return
	}

	urlPre := libkb.HTTPArgs{"title": libkb.S{Val: title}, "text": libkb.S{Val: ppr.Text}}.EncodeToString()
	q := urlReencode(urlPre)

	chooseHost := func(untrustedHint, trustedDefault string) string {
		allowedHosts := []string{
			"reddit.com",
			"www.reddit.com",
			// 2017-04-18: The new reddit mobile site doesn't respect the post-pre-populate query parameters.
			//             The i.reddit.com site may be better.
			"i.reddit.com",
			"old.reddit.com",
		}
		if untrustedHint == "" {
			return trustedDefault
		}
		for _, h := range allowedHosts {
			if untrustedHint == h {
				return h
			}
		}
		return trustedDefault
	}
	var host string
	if mctx.G().GetAppType() == libkb.MobileAppType {
		hostHint, err := ppr.Metadata.AtKey("mobile_host").GetString()
		if err != nil {
			hostHint = ""
		}
		host = chooseHost(hostHint, "old.reddit.com")
	} else {
		// Note that GetAppType() often returns libkb.NoAppType. Don't assume that we get
		// libkb.DesktopAppType in the non-mobile case.
		// Use the old reddit design until this bug is fixed:
		// https://www.reddit.com/r/redesign/comments/8evfap/bug_post_contents_gets_dropped_when_using/
		hostHint, err := ppr.Metadata.AtKey("other_host").GetString()
		if err != nil {
			hostHint = ""
		}
		host = chooseHost(hostHint, "old.reddit.com")
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

func (t *RedditServiceType) DisplayName(un string) string { return "Reddit" }

func (t *RedditServiceType) RecheckProofPosting(tryNumber int, status keybase1.ProofStatus, _ string) (warning *libkb.Markup, err error) {
	warning, err = t.BaseRecheckProofPosting(tryNumber, status)
	return
}

func (t *RedditServiceType) GetProofType() string { return t.BaseGetProofType(t) }

func (t *RedditServiceType) CheckProofText(text string, id keybase1.SigID, sig string) (err error) {
	// Anything is fine. We might get rid of the body later.
	return nil
}

func (t *RedditServiceType) MakeProofChecker(l libkb.RemoteProofChainLink) libkb.ProofChecker {
	return &RedditChecker{l}
}
