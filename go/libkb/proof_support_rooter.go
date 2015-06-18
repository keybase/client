// +build !release

package libkb

import (
	"regexp"
	"strings"

	keybase1 "github.com/keybase/client/protocol/go"
	jsonw "github.com/keybase/go-jsonw"
)

//=============================================================================
// Rooter
//

type RooterChecker struct {
	proof RemoteProofChainLink
}

func NewRooterChecker(p RemoteProofChainLink) (*RooterChecker, ProofError) {
	return &RooterChecker{p}, nil
}

func (rc *RooterChecker) CheckHint(h SigHint) ProofError {
	wantedURL := G.Env.GetServerURI() + APIURIPathPrefix + "/rooter/" + strings.ToLower(rc.proof.GetRemoteUsername()) + "/"
	wantedMedID := rc.proof.GetSigID().ToMediumID()
	if !strings.HasPrefix(strings.ToLower(h.apiURL), wantedURL) {
		return NewProofError(keybase1.ProofStatus_BAD_API_URL,
			"Bad hint from server; URL should start with '%s'", wantedURL)
	} else if !strings.Contains(h.checkText, wantedMedID) {
		return NewProofError(keybase1.ProofStatus_BAD_SIGNATURE,
			"Bad proof-check text from server; need '%s' as a substring", wantedMedID)
	} else {
		return nil
	}
}

func (rc *RooterChecker) ScreenNameCompare(s1, s2 string) bool {
	return Cicmp(s1, s2)
}

func (rc *RooterChecker) CheckData(h SigHint, dat string) ProofError {
	_, sigID, err := OpenSig(rc.proof.GetArmoredSig())
	if err != nil {
		return NewProofError(keybase1.ProofStatus_BAD_SIGNATURE,
			"Bad signature: %s", err.Error())
	} else if !strings.Contains(dat, sigID.ToMediumID()) {
		return NewProofError(keybase1.ProofStatus_TEXT_NOT_FOUND,
			"Missing signature ID (%s) in post title ('%s')",
			sigID.ToMediumID(), dat)
	}
	return nil
}

func (rc *RooterChecker) UnpackData(inp *jsonw.Wrapper) (string, ProofError) {
	var status, post, ret string
	var err error

	inp.AtPath("status.name").GetStringVoid(&status, &err)
	inp.AtPath("toot.post").GetStringVoid(&post, &err)

	var pe ProofError
	cf := keybase1.ProofStatus_CONTENT_FAILURE
	cm := keybase1.ProofStatus_CONTENT_MISSING

	if err != nil {
		pe = NewProofError(cm, "Bad proof JSON: %s", err.Error())
	} else if status != "OK" {
		pe = NewProofError(cf, "Rooter: Non-OK status: %s", status)
	} else {
		ret = post
	}

	return ret, pe

}

func (rc *RooterChecker) CheckStatus(h SigHint) ProofError {
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

type RooterServiceType struct{ BaseServiceType }

func (t RooterServiceType) AllStringKeys() []string     { return t.BaseAllStringKeys(t) }
func (t RooterServiceType) PrimaryStringKeys() []string { return t.BasePrimaryStringKeys(t) }

func (t RooterServiceType) CheckUsername(s string) (err error) {
	if !regexp.MustCompile(`^@?(?i:[a-z0-9_]{1,20})$`).MatchString(s) {
		err = BadUsernameError{s}
	}
	return
}

func (t RooterServiceType) NormalizeUsername(s string) (string, error) {
	if len(s) > 0 && s[0] == '@' {
		s = s[1:]
	}
	return strings.ToLower(s), nil
}

func (t RooterServiceType) ToChecker() Checker {
	return t.BaseToChecker(t, "alphanumeric, up to 20 characters")
}

func (t RooterServiceType) GetPrompt() string {
	return "Your username on Rooter"
}

func (t RooterServiceType) ToServiceJSON(un string) *jsonw.Wrapper {
	return t.BaseToServiceJSON(t, un)
}

func (t RooterServiceType) PostInstructions(un string) *Markup {
	return FmtMarkup(`Please toot the following, and don't delete it:`)
}

func (t RooterServiceType) DisplayName(un string) string { return "Rooter" }
func (t RooterServiceType) GetTypeName() string          { return "rooter" }
func (t RooterServiceType) RecheckProofPosting(tryNumber int, status keybase1.ProofStatus) (warning *Markup, err error) {
	return t.BaseRecheckProofPosting(tryNumber, status)
}
func (t RooterServiceType) GetProofType() string { return "test.web_service_binding.rooter" }

func (t RooterServiceType) CheckProofText(text string, id keybase1.SigID, sig string) (err error) {
	return t.BaseCheckProofTextShort(text, id, true)
}

//=============================================================================

func init() {
	RegisterServiceType(RooterServiceType{})
	RegisterSocialNetwork("rooter")
	RegisterProofCheckHook("rooter",
		func(l RemoteProofChainLink) (ProofChecker, ProofError) {
			return NewRooterChecker(l)
		})
}

//=============================================================================
