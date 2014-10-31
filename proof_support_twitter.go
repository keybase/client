package libkb

import (
	"github.com/PuerkitoBio/goquery"
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

	return cicmp(s1, s2)
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

func init() {
	RegisterProofCheckHook("twitter",
		func(l RemoteProofChainLink) (ProofChecker, ProofError) {
			return NewTwitterChecker(l)
		})
}

//=============================================================================
