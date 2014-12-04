package libkb

import (
	"fmt"
	"github.com/keybase/go-jsonw"
	"regexp"
	"strings"
)

//=============================================================================
// Web
//

type WebChecker struct {
	proof RemoteProofChainLink
}

var webKeybaseFiles = []string{".well-known/keybase.txt", "keybase.txt"}

func NewWebChecker(p RemoteProofChainLink) (*WebChecker, ProofError) {
	return &WebChecker{p}, nil
}

func (rc *WebChecker) CheckHint(h SigHint) ProofError {

	files := webKeybaseFiles
	url_base := rc.proof.ToDisplayString()
	their_url := strings.ToLower(h.apiUrl)

	for _, file := range files {
		our_url := url_base + "/" + file
		if our_url == their_url {
			return nil
		}
	}

	return NewProofError(PROOF_BAD_API_URL,
		"Bad hint from server; didn't recognize API url: %s",
		h.apiUrl)

}

func (rc *WebChecker) CheckStatus(h SigHint) ProofError {
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

type WebServiceType struct{ BaseServiceType }

func (t WebServiceType) AllStringKeys() []string     { return []string{"web", "http", "https"} }
func (t WebServiceType) PrimaryStringKeys() []string { return []string{"https", "http"} }

func ParseWeb(s string) (hostname string, prot string, err error) {
	rxx := regexp.MustCompile("^(http(s))://(.*)$")
	if v := rxx.FindStringSubmatch(s); v != nil {
		s = v[3]
		prot = v[1]
	}
	if !IsValidHostname(s) {
		err = InvalidHostnameError{s}
	} else {
		hostname = s
	}
	return
}

func (t WebServiceType) CheckUsername(s string) bool {
	_, _, e := ParseWeb(s)
	return (e == nil)
}

func (t WebServiceType) NormalizeUsername(s string) (ret string, err error) {
	var prot, host string
	if host, prot, err = ParseWeb(s); err != nil {
		return
	}
	var res *ApiRes
	res, err = G.API.Get(ApiArg{
		Endpoint:    "remotes/check",
		NeedSession: true,
		Args: HttpArgs{
			"hostname": S{host},
		},
	})
	if err != nil {
		return
	}
	var found string
	found, err = res.Body.AtPath("results.first").GetString()
	if err != nil {
		err = WebUnreachableError{host}
		return
	}
	if len(prot) > 0 && prot == "https" && found != "https:" {
		msg := fmt.Sprintf("You specified HTTPS for %s but only HTTP is available", host)
		err = ProtocolDowngradeError{msg}
		return
	}
	ret = found + "//" + host

	return
}

func (t WebServiceType) ToChecker() Checker {
	return t.BaseToChecker(t, "a valid domain name")
}

func (t WebServiceType) GetPrompt() string {
	return "Web site to check"
}

func (t WebServiceType) ToServiceJson(un string) *jsonw.Wrapper {
	h, p, _ := ParseWeb(un)
	ret := jsonw.NewDictionary()
	ret.SetKey("protocol", jsonw.NewString(p+":"))
	ret.SetKey("hostname", jsonw.NewString(h))
	return ret
}

func (t WebServiceType) MarkupFilenames(un string, mkp *Markup) {
	mkp.Append(`<ul>`)
	for _, f := range webKeybaseFiles {
		mkp.Append(`<li><url>` + un + "/" + f + `</url></li>`)
	}
	mkp.Append(`</ul>`)
}

func (t WebServiceType) PreProofWarning(un string) *Markup {
	mkp := FmtMarkup(`<p>You will be asked to post a file available at one of the following locations:</p>`)
	t.MarkupFilenames(un, mkp)
	return mkp
}

func (t WebServiceType) PostInstructions(un string) *Markup {
	mkp := FmtMarkup(`<p>Make the following file available at one of:</p>`)
	t.MarkupFilenames(un, mkp)
	return mkp
}

func (t WebServiceType) DisplayName(un string) string { return "Web" }
func (t WebServiceType) GetTypeName() string          { return "web" }

func (t WebServiceType) RecheckProofPosting(tryNumber, status int) (warning *Markup, err error) {
	if status == PROOF_PERMISSION_DENIED {
		warning = FmtMarkup("Permission denied! Make sure your proof page is <strong>public</strong>.")
	} else {
		warning, err = t.BaseRecheckProofPosting(tryNumber, status)
	}
	return
}
func (t WebServiceType) GetProofType() string { return "web_service_binding.generic" }

func (t WebServiceType) CheckProofText(text string, id SigId, sig string) (err error) {
	return t.BaseCheckProofTextFull(text, id, sig)
}

func (t WebServiceType) GetApiArgKey() string { return "remote_host" }
func (t WebServiceType) LastWriterWins() bool { return false }

//=============================================================================

func init() {
	RegisterServiceType(WebServiceType{})
	RegisterSocialNetwork("web")
	RegisterProofCheckHook("http",
		func(l RemoteProofChainLink) (ProofChecker, ProofError) {
			return NewWebChecker(l)
		})
}

//=============================================================================
