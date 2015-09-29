package libkb

import (
	"regexp"
	"strings"

	keybase1 "github.com/keybase/client/go/protocol"
	jsonw "github.com/keybase/go-jsonw"
)

//=============================================================================
// Github
//

type GithubChecker struct {
	proof RemoteProofChainLink
}

func NewGithubChecker(p RemoteProofChainLink) (*GithubChecker, ProofError) {
	return &GithubChecker{p}, nil
}

func (rc *GithubChecker) CheckHint(h SigHint) ProofError {
	given := strings.ToLower(h.apiURL)
	u := strings.ToLower(rc.proof.GetRemoteUsername())
	ok1 := "https://gist.github.com/" + u + "/"
	ok2 := "https://gist.githubusercontent.com/" + u + "/"
	if strings.HasPrefix(given, ok1) || strings.HasPrefix(given, ok2) {
		return nil
	}
	return NewProofError(keybase1.ProofStatus_BAD_API_URL,
		"Bad hint from server; URL start with either '%s' OR '%s'", ok1, ok2)
}

func (rc *GithubChecker) CheckStatus(h SigHint) ProofError {
	res, err := G.XAPI.GetText(APIArg{
		Endpoint:    h.apiURL,
		NeedSession: false,
	})

	if err != nil {
		return XapiError(err, h.apiURL)
	}

	var sigBody []byte
	sigBody, _, err = OpenSig(rc.proof.GetArmoredSig())
	var ret ProofError

	if err != nil {
		return NewProofError(keybase1.ProofStatus_BAD_SIGNATURE,
			"Bad signature: %s", err)
	}

	if !FindBase64Block(res.Body, sigBody, false) {
		ret = NewProofError(keybase1.ProofStatus_TEXT_NOT_FOUND, "signature not found in body")
	}

	return ret
}

//
//=============================================================================

type GithubServiceType struct{ BaseServiceType }

func (t GithubServiceType) AllStringKeys() []string     { return t.BaseAllStringKeys(t) }
func (t GithubServiceType) PrimaryStringKeys() []string { return t.BasePrimaryStringKeys(t) }

func (t GithubServiceType) CheckUsername(s string) (err error) {
	if !regexp.MustCompile(`^@?(?i:[a-z0-9][a-z0-9-]{0,38})$`).MatchString(s) {
		err = BadUsernameError{s}
	}
	return
}

func (t GithubServiceType) ToChecker() Checker {
	return t.BaseToChecker(t, "alphanumeric, up to 39 characters")
}

func (t GithubServiceType) GetPrompt() string {
	return "Your username on Github"
}

func (t GithubServiceType) ToServiceJSON(un string) *jsonw.Wrapper {
	return t.BaseToServiceJSON(t, un)
}

func (t GithubServiceType) PostInstructions(un string) *Markup {
	return FmtMarkup(`Please <strong>publicly</strong> post the following Gist,
and name it <strong><color name="red">keybase.md</color></strong>`)
}

func (t GithubServiceType) DisplayName(un string) string { return "Github" }
func (t GithubServiceType) GetTypeName() string          { return "github" }

func (t GithubServiceType) RecheckProofPosting(tryNumber int, status keybase1.ProofStatus) (warning *Markup, err error) {
	if status == keybase1.ProofStatus_PERMISSION_DENIED {
		warning = FmtMarkup("Permission denied! Make sure your gist is <strong>public</strong>.")
	} else {
		warning, err = t.BaseRecheckProofPosting(tryNumber, status)
	}
	return
}
func (t GithubServiceType) GetProofType() string { return t.BaseGetProofType(t) }

func (t GithubServiceType) CheckProofText(text string, id keybase1.SigID, sig string) (err error) {
	return t.BaseCheckProofTextFull(text, id, sig)
}

//=============================================================================

func init() {
	RegisterServiceType(GithubServiceType{})
	RegisterSocialNetwork("github")
	RegisterProofCheckHook("github",
		func(l RemoteProofChainLink) (ProofChecker, ProofError) {
			return NewGithubChecker(l)
		})
}

//=============================================================================
