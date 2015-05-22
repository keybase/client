package libkb

import (
	"regexp"
	"strings"

	"github.com/PuerkitoBio/goquery"
	keybase1 "github.com/keybase/client/protocol/go"
	jsonw "github.com/keybase/go-jsonw"
)

//=============================================================================
// Twitter
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
		return NewProofError(keybase1.ProofStatus_BAD_API_URL,
			"Bad hint from server; URL should start with '%s'", wanted_url)
	} else if !strings.Contains(h.checkText, wanted_short_id) {
		return NewProofError(keybase1.ProofStatus_BAD_SIGNATURE,
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
		return NewProofError(keybase1.ProofStatus_CONTENT_FAILURE, "No HTML tweet found: %s", err.Error())
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
		return NewProofError(keybase1.ProofStatus_DELETED, "Could not find '%s' in '%s'",
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
		return NewProofError(keybase1.ProofStatus_FAILED_PARSE, "Couldn't find a div $(%s)", csssel)
	}

	// Only consider the first
	div = div.First()

	if author, ok := div.Attr("data-screen-name"); !ok {
		return NewProofError(keybase1.ProofStatus_BAD_USERNAME,
			"Username not found in DOM")
	} else if wanted := rc.proof.GetRemoteUsername(); !rc.ScreenNameCompare(wanted, author) {
		return NewProofError(keybase1.ProofStatus_BAD_USERNAME,
			"Bad post authored; wanted '%s' but got '%s'", wanted, author)
	} else if p := div.Find("p.tweet-text"); p.Length() == 0 {
		return NewProofError(keybase1.ProofStatus_CONTENT_MISSING,
			"Missing <div class='tweet-text'> container for tweet")
	} else {
		return rc.findSigInTweet(h, p.First())
	}
}

//
//=============================================================================

type TwitterServiceType struct{ BaseServiceType }

func (t TwitterServiceType) AllStringKeys() []string     { return t.BaseAllStringKeys(t) }
func (t TwitterServiceType) PrimaryStringKeys() []string { return t.BasePrimaryStringKeys(t) }

func (t TwitterServiceType) CheckUsername(s string) (err error) {
	if !regexp.MustCompile(`^@?(?i:[a-z0-9_]{1,20})$`).MatchString(s) {
		err = BadUsernameError{s}
	}
	return
}

func (t TwitterServiceType) NormalizeUsername(s string) (string, error) {
	if len(s) > 0 && s[0] == '@' {
		s = s[1:]
	}
	return strings.ToLower(s), nil
}

func (t TwitterServiceType) ToChecker() Checker {
	return t.BaseToChecker(t, "alphanumeric, up to 20 characters")
}

func (t TwitterServiceType) GetPrompt() string {
	return "Your username on Twitter"
}

func (t TwitterServiceType) ToServiceJson(un string) *jsonw.Wrapper {
	return t.BaseToServiceJson(t, un)
}

func (t TwitterServiceType) PostInstructions(un string) *Markup {
	return FmtMarkup(`Please <strong>publicly</strong> tweet the following, and don't delete it:`)
}

func (t TwitterServiceType) DisplayName(un string) string { return "Twitter" }
func (t TwitterServiceType) GetTypeName() string          { return "twitter" }

func (t TwitterServiceType) RecheckProofPosting(tryNumber int, status keybase1.ProofStatus) (warning *Markup, err error) {
	if status == keybase1.ProofStatus_PERMISSION_DENIED {
		warning = FmtMarkup("Permission denied! We can't suppport <strong>private</strong feeds.")
	} else {
		warning, err = t.BaseRecheckProofPosting(tryNumber, status)
	}
	return
}
func (t TwitterServiceType) GetProofType() string { return t.BaseGetProofType(t) }

func (t TwitterServiceType) CheckProofText(text string, id SigId, sig string) (err error) {
	return t.BaseCheckProofTextShort(text, id, false)
}

//=============================================================================

func init() {
	RegisterServiceType(TwitterServiceType{})
	RegisterSocialNetwork("twitter")
	RegisterProofCheckHook("twitter",
		func(l RemoteProofChainLink) (ProofChecker, ProofError) {
			return NewTwitterChecker(l)
		})
}

//=============================================================================
