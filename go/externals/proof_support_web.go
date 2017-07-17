// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package externals

import (
	"fmt"
	"net/url"
	"regexp"
	"strings"

	libkb "github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
)

//=============================================================================
// Web
//

type WebChecker struct {
	proof libkb.RemoteProofChainLink
}

var _ libkb.ProofChecker = (*WebChecker)(nil)

var webKeybaseFiles = []string{".well-known/keybase.txt", "keybase.txt"}

func NewWebChecker(p libkb.RemoteProofChainLink) (*WebChecker, libkb.ProofError) {
	return &WebChecker{p}, nil
}

func (rc *WebChecker) GetTorError() libkb.ProofError {
	urlBase := rc.proof.ToDisplayString()

	u, err := url.Parse(urlBase)
	if err != nil || u.Scheme != "https" {
		return libkb.ProofErrorHTTPOverTor
	}

	return nil
}

func (rc *WebChecker) CheckStatus(ctx libkb.ProofContext, h libkb.SigHint, pcm libkb.ProofCheckerMode, pvlU libkb.PvlUnparsed) libkb.ProofError {
	if pcm != libkb.ProofCheckerModeActive {
		ctx.GetLog().CDebugf(ctx.GetNetContext(), "Web check skipped since proof checking was not in active mode (%s)", h.GetAPIURL())
		return libkb.ProofErrorUnchecked
	}
	return CheckProofPvl(ctx, keybase1.ProofType_GENERIC_WEB_SITE, rc.proof, h, pvlU)
}

//
//=============================================================================

type WebServiceType struct{ libkb.BaseServiceType }

func (t WebServiceType) AllStringKeys() []string     { return []string{"web", "http", "https"} }
func (t WebServiceType) PrimaryStringKeys() []string { return []string{"https", "http"} }

func (t WebServiceType) NormalizeUsername(s string) (ret string, err error) {
	// The username is just the (lowercased) hostname.
	if !libkb.IsValidHostname(s) {
		return "", libkb.NewInvalidHostnameError(s)
	}
	return strings.ToLower(s), nil
}

func ParseWeb(s string) (hostname string, prot string, err error) {
	rxx := regexp.MustCompile("^(http(s?))://(.*)$")
	if v := rxx.FindStringSubmatch(s); v != nil {
		s = v[3]
		prot = v[1]
	}
	if !libkb.IsValidHostname(s) {
		err = libkb.NewInvalidHostnameError(s)
	} else {
		hostname = s
	}
	return
}

func (t WebServiceType) NormalizeRemoteName(ctx libkb.ProofContext, s string) (ret string, err error) {
	// The remote name is a full (case-preserved) URL.
	var prot, host string
	if host, prot, err = ParseWeb(s); err != nil {
		return
	}
	var res *libkb.APIRes
	res, err = ctx.GetAPI().Get(libkb.APIArg{
		Endpoint:    "remotes/check",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"hostname": libkb.S{Val: host},
		},
	})
	if err != nil {
		return
	}
	var found string
	found, err = res.Body.AtPath("results.first").GetString()
	if err != nil {
		err = libkb.NewWebUnreachableError(host)
		return
	}
	if len(prot) > 0 && prot == "https" && found != "https:" {
		msg := fmt.Sprintf("You specified HTTPS for %s but only HTTP is available", host)
		err = libkb.NewProtocolDowngradeError(msg)
		return
	}
	ret = found + "//" + host

	return
}

func (t WebServiceType) GetPrompt() string {
	return "Web site to check"
}

func (t WebServiceType) ToServiceJSON(un string) *jsonw.Wrapper {
	h, p, _ := ParseWeb(un)
	ret := jsonw.NewDictionary()
	ret.SetKey("protocol", jsonw.NewString(p+":"))
	ret.SetKey("hostname", jsonw.NewString(h))
	return ret
}

func (t WebServiceType) MarkupFilenames(un string, mkp *libkb.Markup) {
	mkp.Append(`<ul>`)
	first := true
	for _, f := range webKeybaseFiles {
		var bullet string
		if first {
			bullet = "   "
			first = false
		} else {
			bullet = "OR "
		}
		mkp.Append(`<li bullet="` + bullet + `"><url>` + un + "/" + f + `</url></li>`)
	}
	mkp.Append(`</ul>`)
}

func (t WebServiceType) PreProofWarning(un string) *libkb.Markup {
	mkp := libkb.FmtMarkup(`<p>You will be asked to post a file to:</p>`)
	t.MarkupFilenames(un, mkp)
	return mkp
}

func (t WebServiceType) PostInstructions(un string) *libkb.Markup {
	mkp := libkb.FmtMarkup(`<p>Make the following file available at:</p>`)
	t.MarkupFilenames(un, mkp)
	return mkp
}

func (t WebServiceType) DisplayName(un string) string { return "Web" }
func (t WebServiceType) GetTypeName() string          { return "web" }

func (t WebServiceType) RecheckProofPosting(tryNumber int, status keybase1.ProofStatus, _ string) (warning *libkb.Markup, err error) {
	if status == keybase1.ProofStatus_PERMISSION_DENIED {
		warning = libkb.FmtMarkup("Permission denied! Make sure your proof page is <strong>public</strong>.")
	} else {
		warning, err = t.BaseRecheckProofPosting(tryNumber, status)
	}
	return
}
func (t WebServiceType) GetProofType() string { return "web_service_binding.generic" }

func (t WebServiceType) CheckProofText(text string, id keybase1.SigID, sig string) (err error) {
	return t.BaseCheckProofTextFull(text, id, sig)
}

func (t WebServiceType) GetAPIArgKey() string { return "remote_host" }
func (t WebServiceType) LastWriterWins() bool { return false }

func (t WebServiceType) MakeProofChecker(l libkb.RemoteProofChainLink) libkb.ProofChecker {
	return &WebChecker{l}
}

//=============================================================================

func init() {
	externalServices.Register(WebServiceType{})
}

//=============================================================================
