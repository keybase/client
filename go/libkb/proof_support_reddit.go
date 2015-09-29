package libkb

import (
	"net/url"
	"regexp"
	"strings"

	keybase1 "github.com/keybase/client/go/protocol"
	jsonw "github.com/keybase/go-jsonw"
)

//=============================================================================
// Reddit
//

type RedditChecker struct {
	proof RemoteProofChainLink
}

const (
	RedditPrefix = "https://www.reddit.com"
	RedditSub    = RedditPrefix + "/r/keybaseproofs"
)

func NewRedditChecker(p RemoteProofChainLink) (*RedditChecker, ProofError) {
	return &RedditChecker{p}, nil
}

func (rc *RedditChecker) CheckHint(h SigHint) ProofError {
	if strings.HasPrefix(strings.ToLower(h.apiURL), RedditSub) {
		return nil
	}
	return NewProofError(keybase1.ProofStatus_BAD_API_URL,
		"Bad hint from server; URL should start with '%s'", RedditSub)
}

func (rc *RedditChecker) UnpackData(inp *jsonw.Wrapper) (*jsonw.Wrapper, ProofError) {
	var k1, k2 string
	var err error

	inp.AtIndex(0).AtKey("kind").GetStringVoid(&k1, &err)
	parent := inp.AtIndex(0).AtKey("data").AtKey("children").AtIndex(0)
	parent.AtKey("kind").GetStringVoid(&k2, &err)
	var ret *jsonw.Wrapper

	var pe ProofError
	cf := keybase1.ProofStatus_CONTENT_FAILURE
	cm := keybase1.ProofStatus_CONTENT_MISSING

	if err != nil {
		pe = NewProofError(cm, "Bad proof JSON: %s", err)
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
	sigBody, sigID, err := OpenSig(rc.proof.GetArmoredSig())
	if err != nil {
		return NewProofError(keybase1.ProofStatus_BAD_SIGNATURE, "Bad signature: %s", err)
	}

	var subreddit, author, selftext, title string

	dat.AtKey("subreddit").GetStringVoid(&subreddit, &err)
	dat.AtKey("author").GetStringVoid(&author, &err)
	dat.AtKey("selftext").GetStringVoid(&selftext, &err)
	dat.AtKey("title").GetStringVoid(&title, &err)

	if err != nil {
		return NewProofError(keybase1.ProofStatus_CONTENT_MISSING, "content missing: %s", err)
	}

	if strings.ToLower(subreddit) != "keybaseproofs" {
		return NewProofError(keybase1.ProofStatus_SERVICE_ERROR, "the post must be to /r/KeybaseProofs")
	}

	if wanted := rc.proof.GetRemoteUsername(); !rc.ScreenNameCompare(author, wanted) {
		return NewProofError(keybase1.ProofStatus_BAD_USERNAME,
			"Bad post author; wanted '%s' but got '%s'", wanted, author)
	}

	if psid := sigID.ToMediumID(); !strings.Contains(title, psid) {
		return NewProofError(keybase1.ProofStatus_TITLE_NOT_FOUND, "Missing signature ID (%s) in post title ('%s')", psid, title)
	}

	if !FindBase64Block(selftext, sigBody, false) {
		return NewProofError(keybase1.ProofStatus_TEXT_NOT_FOUND, "signature not found in body")
	}

	return nil
}

func (rc *RedditChecker) CheckStatus(h SigHint) ProofError {
	res, err := G.XAPI.Get(APIArg{
		Endpoint:    h.apiURL,
		NeedSession: false,
	})
	if err != nil {
		return XapiError(err, h.apiURL)
	}

	dat, perr := rc.UnpackData(res.Body)
	if perr != nil {
		return perr
	}
	return rc.CheckData(h, dat)
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

type RedditServiceType struct{ BaseServiceType }

func (t RedditServiceType) AllStringKeys() []string     { return t.BaseAllStringKeys(t) }
func (t RedditServiceType) PrimaryStringKeys() []string { return t.BasePrimaryStringKeys(t) }

func (t RedditServiceType) CheckUsername(s string) (err error) {
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

func (t RedditServiceType) ToServiceJSON(un string) *jsonw.Wrapper {
	return t.BaseToServiceJSON(t, un)
}

func (t RedditServiceType) PostInstructions(un string) *Markup {
	return FmtMarkup(`Please click on the following link to post to Reddit:`)
}

func (t RedditServiceType) FormatProofText(ppr *PostProofRes) (res string, err error) {

	var title string
	if title, err = ppr.Metadata.AtKey("title").GetString(); err != nil {
		return
	}

	q := urlReencode(HTTPArgs{"title": S{title}, "text": S{ppr.Text}}.EncodeToString())

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

func (t RedditServiceType) RecheckProofPosting(tryNumber int, status keybase1.ProofStatus) (warning *Markup, err error) {
	warning, err = t.BaseRecheckProofPosting(tryNumber, status)
	return
}

func (t RedditServiceType) GetProofType() string { return t.BaseGetProofType(t) }

func (t RedditServiceType) CheckProofText(text string, id keybase1.SigID, sig string) (err error) {
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
