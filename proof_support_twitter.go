package libkb

import (
	"github.com/PuerkitoBio/goquery"
	"github.com/keybase/go-jsonw"
	"regexp"
	"strings"
)

//=============================================================================
// Reddit
//

type TwitterChecker struct {
	proof RemoteProofChainLink
}

func NewTwitterChecker(p RemoteProofChainLink) (*TwitterChecker, ProofError) {
	return &TwitterChecker{p}, nil
}

func (rc *TwitterChecker) CheckHint(h SigHint) ProofError {
	wanted_url := ("https://twitter.com/" + strings.ToLower(rc.proof.GetRemoteUsername()) + "/")
	wanted_short_id := (" " + rc.proof.GetSigId().ToShortId() + " /")
	if !strings.HasPrefix(strings.ToLower(h.apiUrl), wanted_url) {
		return NewProofError(PROOF_BAD_API_URL,
			"Bad hint from server; URL should start with '%s'", wanted_url)
	} else if !strings.Contains(h.checkText, wanted_short_id) {
		return NewProofError(PROOF_BAD_SIGNATURE,
			"Bad proof-check text from server; need '%s' as a substring", wanted_short_id)
	} else {
		return nil
	}
}

func (rc *TwitterChecker) ScreenNameCompare(s1, s2 string) bool {
	return Cicmp(s1, s2)
}

func (rc *TwitterChecker) findSigInTweet(h SigHint, s *goquery.Selection) ProofError {

	inside := s.Text()
	html, err := s.Html()

	checkText := h.checkText

	if err != nil {
		return NewProofError(PROOF_CONTENT_FAILURE, "No HTML tweet found: %s", err.Error())
	}

	G.Log.Debug("+ Checking tweet '%s' for signature '%s'", inside, checkText)
	G.Log.Debug("| HTML is: %s", html)

	rxx := regexp.MustCompile(`^(@[a-zA-Z0-9_-]+\s+)`)
	for {
		if m := rxx.FindStringSubmatchIndex(inside); m == nil {
			break
		} else {
			prefix := inside[m[2]:m[3]]
			inside = inside[m[3]:]
			G.Log.Debug("| Stripping off @prefx: %s", prefix)
		}
	}
	if strings.HasPrefix(inside, checkText) {
		return nil
	} else {
		return NewProofError(PROOF_DELETED, "Could not find '%s' in '%s'",
			checkText, inside)
	}
}

func (rc *TwitterChecker) CheckStatus(h SigHint) ProofError {
	res, err := G.XAPI.GetHtml(ApiArg{
		Endpoint:    h.apiUrl,
		NeedSession: false,
	})
	if err != nil {
		return XapiError(err, h.apiUrl)
	}
	csssel := "div.permalink-tweet-container div.permalink-tweet"
	div := res.GoQuery.Find(csssel)
	if div.Length() == 0 {
		return NewProofError(PROOF_FAILED_PARSE, "Couldn't find a div $(%s)", csssel)
	}

	// Only consider the first
	div = div.First()

	if author, ok := div.Attr("data-screen-name"); !ok {
		return NewProofError(PROOF_BAD_USERNAME,
			"Username not found in DOM")
	} else if wanted := rc.proof.GetRemoteUsername(); !rc.ScreenNameCompare(wanted, author) {
		return NewProofError(PROOF_BAD_USERNAME,
			"Bad post authored; wanted '%s' but got '%s'", wanted, author)
	} else if p := div.Find("p.tweet-text"); p.Length() == 0 {
		return NewProofError(PROOF_CONTENT_MISSING,
			"Missing <div class='tweet-text'> container for tweet")
	} else {
		return rc.findSigInTweet(h, p.First())
	}

	return nil
}

//
//=============================================================================

type TwitterServiceType struct{}

func (t TwitterServiceType) AllStringKeys() []string     { return []string{"twitter"} }
func (t TwitterServiceType) PrimaryStringKeys() []string { return []string{"twitter"} }
func (t TwitterServiceType) CheckUsername(s string) bool {
	return regexp.MustCompile(`^@?(?i:[a-z0-9_]{1,20})$`).MatchString(s)
}
func (t TwitterServiceType) NormalizeUsername(s string) string {
	if len(s) > 0 && s[0] == '@' {
		s = s[1:]
	}
	return strings.ToLower(s)
}
func (t TwitterServiceType) ToChecker() Checker {
	return Checker{
		F:             func(s string) bool { return t.CheckUsername(s) },
		Hint:          "alphanumeric, up to 20 characters",
		PreserveSpace: false,
	}
}
func (t TwitterServiceType) GetPrompt() string                         { return "Your username on Twitter" }
func (t TwitterServiceType) LastWriterWins() bool                      { return true }
func (t TwitterServiceType) PreProofCheck(string) error                { return nil }
func (t TwitterServiceType) PreProofWarning(remotename string) *Markup { return nil }
func (t TwitterServiceType) ToServiceJson(un string) *jsonw.Wrapper {
	ret := jsonw.NewDictionary()
	ret.SetKey("name", jsonw.NewString("twitter"))
	ret.SetKey("username", jsonw.NewString(un))
	return ret
}

func (t TwitterServiceType) PostInstructions(un string) *Markup {
	return FmtMarkup(`Please <strong>publicly</strong> the following, and don't delete it:`)
}
func (t TwitterServiceType) DisplayName(un string) string { return "Twitter" }

func (t TwitterServiceType) RecheckProofPosting(tryNumber, status int) (warning *Markup, err error) {
	if status == PROOF_STATUS_PERMISSION_DENIED {
		warning = FmtMarkup("Permission denied! We can't suppport <strong>private</strong feeds.")
	} else {
		warning = FmtMarkup("Couldn't find posted proof.")
	}
	return
}
func (t TwitterServiceType) GetProofType() string { return "web_service_binding.twitter" }

//=============================================================================

func init() {
	RegisterServiceType(TwitterServiceType{})
	RegisterProofCheckHook("twitter",
		func(l RemoteProofChainLink) (ProofChecker, ProofError) {
			return NewTwitterChecker(l)
		})
}

//=============================================================================
