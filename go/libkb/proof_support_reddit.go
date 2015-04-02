package libkb

import (
	"github.com/keybase/go-jsonw"
	"net/url"
	"regexp"
	"strings"
)

//=============================================================================
// Reddit
//

type RedditChecker struct {
	proof RemoteProofChainLink
}

var REDDIT_PREFIX = "https://www.reddit.com"
var REDDIT_SUB = REDDIT_PREFIX + "/r/keybaseproofs"

func NewRedditChecker(p RemoteProofChainLink) (*RedditChecker, ProofError) {
	return &RedditChecker{p}, nil
}

func (rc *RedditChecker) CheckHint(h SigHint) ProofError {
	if strings.HasPrefix(strings.ToLower(h.apiUrl), REDDIT_SUB) {
		return nil
	} else {
		return NewProofError(PROOF_BAD_API_URL,
			"Bad hint from server; URL should start with '%s'", REDDIT_SUB)
	}
}

func (rc *RedditChecker) UnpackData(inp *jsonw.Wrapper) (*jsonw.Wrapper, ProofError) {
	var k1, k2 string
	var err error

	inp.AtIndex(0).AtKey("kind").GetStringVoid(&k1, &err)
	parent := inp.AtIndex(0).AtKey("data").AtKey("children").AtIndex(0)
	parent.AtKey("kind").GetStringVoid(&k2, &err)
	var ret *jsonw.Wrapper

	var pe ProofError
	var cf ProofStatus = PROOF_CONTENT_FAILURE
	var cm ProofStatus = PROOF_CONTENT_MISSING

	if err != nil {
		pe = NewProofError(cm, "Bad proof JSON: %s", err.Error())
	} else if k1 != "Listing" {
		pe = NewProofError(cf,
			"Reddit: Wanted a post of type 'Listing', but got %s", k1)
	} else if k2 != "t3" {
		pe = NewProofError(cf, "Wanted a child of type 't3' but got %s", k2)
	} else if ret = parent.AtKey("data"); ret.IsNil() {
		pe = NewProofError(cm, "Couldn't get child data for post")
	}

	return ret, pe

}

func (rc *RedditChecker) ScreenNameCompare(s1, s2 string) bool {
	return Cicmp(s1, s2)
}

func (rc *RedditChecker) CheckData(h SigHint, dat *jsonw.Wrapper) ProofError {
	sigBody, sigId, err := OpenSig(rc.proof.GetArmoredSig())
	if err != nil {
		return NewProofError(PROOF_BAD_SIGNATURE,
			"Bad signature: %s", err.Error())
	}

	var subreddit, author, selftext, title string

	dat.AtKey("subreddit").GetStringVoid(&subreddit, &err)
	dat.AtKey("author").GetStringVoid(&author, &err)
	dat.AtKey("selftext").GetStringVoid(&selftext, &err)
	dat.AtKey("title").GetStringVoid(&title, &err)

	var ret ProofError

	if err != nil {
		ret = NewProofError(PROOF_CONTENT_MISSING, "content missing: %s", err.Error())
	} else if strings.ToLower(subreddit) != "keybaseproofs" {
		ret = NewProofError(PROOF_SERVICE_ERROR, "the post must be to /r/KeybaseProofs")
	} else if wanted := rc.proof.GetRemoteUsername(); !rc.ScreenNameCompare(author, wanted) {
		ret = NewProofError(PROOF_BAD_USERNAME,
			"Bad post author; wanted '%s' but got '%s'", wanted, author)
	} else if psid := sigId.ToMediumId(); !strings.Contains(title, psid) {
		ret = NewProofError(PROOF_TITLE_NOT_FOUND,
			"Missing signature ID (%s) in post title ('%s')",
			psid, title)
	} else if !FindBase64Block(selftext, sigBody, false) {
		ret = NewProofError(PROOF_TEXT_NOT_FOUND, "signature not found in body")
	}

	return ret
}

func (rc *RedditChecker) CheckStatus(h SigHint) ProofError {
	res, err := G.XAPI.Get(ApiArg{
		Endpoint:    h.apiUrl,
		NeedSession: false,
	})
	if err != nil {
		return XapiError(err, h.apiUrl)
	}

	if dat, perr := rc.UnpackData(res.Body); perr != nil {
		return perr
	} else {
		return rc.CheckData(h, dat)
	}
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
		} else {
			return ""
		}
	})
	return s
}

type RedditServiceType struct{ BaseServiceType }

func (t RedditServiceType) AllStringKeys() []string     { return t.BaseAllStringKeys(t) }
func (t RedditServiceType) PrimaryStringKeys() []string { return t.BasePrimaryStringKeys(t) }

func (r RedditServiceType) CheckUsername(s string) (err error) {
	if !regexp.MustCompile(`^(?i:[a-z0-9_-]{3,20})$`).MatchString(s) {
		err = BadUsernameError{s}
	}
	return
}

func (t RedditServiceType) ToChecker() Checker {
	return t.BaseToChecker(t, "alphanumeric, up to 20 characters")
}

func (t RedditServiceType) GetTypeName() string { return "reddit" }

func (t RedditServiceType) GetPrompt() string { return "Your username on Reddit" }

func (t RedditServiceType) ToServiceJson(un string) *jsonw.Wrapper {
	return t.BaseToServiceJson(t, un)
}

func (t RedditServiceType) PostInstructions(un string) *Markup {
	return FmtMarkup(`Please click on the following link to post to Reddit:`)
}

func (t RedditServiceType) FormatProofText(ppr *PostProofRes) (res string, err error) {

	var title string
	if title, err = ppr.Metadata.AtKey("title").GetString(); err != nil {
		return
	}

	q := urlReencode(HttpArgs{"title": S{title}, "text": S{ppr.Text}}.EncodeToString())

	u := url.URL{
		Scheme:   "https",
		Host:     "www.reddit.com",
		Path:     "/r/KeybaseProofs/submit",
		RawQuery: q,
	}

	res = u.String()
	return
}

func (t RedditServiceType) DisplayName(un string) string { return "Reddit" }

func (t RedditServiceType) RecheckProofPosting(tryNumber, status int) (warning *Markup, err error) {
	warning, err = t.BaseRecheckProofPosting(tryNumber, status)
	return
}

func (t RedditServiceType) GetProofType() string { return t.BaseGetProofType(t) }

func (t RedditServiceType) CheckProofText(text string, id SigId, sig string) (err error) {
	return t.BaseCheckProofTextFull(text, id, sig)
}

//=============================================================================

func init() {
	RegisterServiceType(RedditServiceType{})
	RegisterSocialNetwork("reddit")
	RegisterProofCheckHook("reddit",
		func(l RemoteProofChainLink) (ProofChecker, ProofError) {
			return NewRedditChecker(l)
		})
}

//=============================================================================
