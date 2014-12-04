package libkb

import (
	"github.com/keybase/go-jsonw"
	"regexp"
	"strings"
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
	given := strings.ToLower(h.apiUrl)
	u := rc.proof.GetRemoteUsername()
	ok1 := "https://gist.github.com/" + u + "/"
	ok2 := "https://gist.githubusercontent.com/" + u + "/"
	if strings.HasPrefix(given, ok1) || strings.HasPrefix(given, ok2) {
		return nil
	} else {
		return NewProofError(PROOF_BAD_API_URL,
			"Bad hint from server; URL start with either '%s' OR '%s'", ok1, ok2)
	}
}

func (rc *GithubChecker) CheckStatus(h SigHint) ProofError {
	res, err := G.XAPI.GetText(ApiArg{
		Endpoint:    h.apiUrl,
		NeedSession: false,
	})

	if err != nil {
		return XapiError(err, h.apiUrl)
	}

	var ps *ParsedSig
	ps, err = OpenSig(rc.proof.GetArmoredSig())
	var ret ProofError

	if err != nil {
		return NewProofError(PROOF_BAD_SIGNATURE,
			"Bad signature: %s", err.Error())
	}

	if !FindBase64Block(res.Body, ps.SigBody, false) {
		ret = NewProofError(PROOF_TEXT_NOT_FOUND, "signature not found in body")
	}

	return ret
}

//
//=============================================================================

type GithubServiceType struct{ BaseServiceType }

func (t GithubServiceType) AllStringKeys() []string     { return t.BaseAllStringKeys(t) }
func (t GithubServiceType) PrimaryStringKeys() []string { return t.BasePrimaryStringKeys(t) }

func (t GithubServiceType) CheckUsername(s string) bool {
	return regexp.MustCompile(`^@?(?i:[a-z0-9][a-z0-9-]{0,39})$`).MatchString(s)
}

func (t GithubServiceType) ToChecker() Checker {
	return t.BaseToChecker(t, "alphanumeric, up to 38 characters")
}

func (t GithubServiceType) GetPrompt() string {
	return "Your username on Github"
}

func (t GithubServiceType) ToServiceJson(un string) *jsonw.Wrapper {
	return t.BaseToServiceJson(t, un)
}

func (t GithubServiceType) PostInstructions(un string) *Markup {
	return FmtMarkup(`Please <strong>publicly</strong> post the following Gist,
and name it <strong><color name="red">keybase.md</color><strong>`)
}

func (t GithubServiceType) DisplayName(un string) string { return "Github" }
func (t GithubServiceType) GetTypeName() string          { return "github" }

func (t GithubServiceType) RecheckProofPosting(tryNumber, status int) (warning *Markup, err error) {
	if status == PROOF_PERMISSION_DENIED {
		warning = FmtMarkup("Permission denied! Make sure your gist is <strong>public</strong>.")
	} else {
		warning, err = t.BaseRecheckProofPosting(tryNumber, status)
	}
	return
}
func (t GithubServiceType) GetProofType() string { return t.BaseGetProofType(t) }

func (t GithubServiceType) CheckProofText(text string, id SigId, sig string) (err error) {
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
