// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package externals

import (
	"strings"

	libkb "github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
)

//=============================================================================
// Dns
//

type DNSChecker struct {
	proof libkb.RemoteProofChainLink
}

var _ libkb.ProofChecker = (*DNSChecker)(nil)

func NewDNSChecker(p libkb.RemoteProofChainLink) (*DNSChecker, libkb.ProofError) {
	return &DNSChecker{p}, nil
}

func (rc *DNSChecker) GetTorError() libkb.ProofError { return libkb.ProofErrorDNSOverTor }

func (rc *DNSChecker) CheckStatus(ctx libkb.ProofContext, h libkb.SigHint, pcm libkb.ProofCheckerMode, pvlU libkb.PvlUnparsed) libkb.ProofError {
	if pcm != libkb.ProofCheckerModeActive {
		ctx.GetLog().CDebugf(ctx.GetNetContext(), "DNS check skipped since proof checking was not in active mode (%s)", h.GetAPIURL())
		return libkb.ProofErrorUnchecked
	}
	return CheckProofPvl(ctx, keybase1.ProofType_DNS, rc.proof, h, pvlU)
}

//
//=============================================================================

type DNSServiceType struct{ libkb.BaseServiceType }

func (t DNSServiceType) AllStringKeys() []string { return t.BaseAllStringKeys(t) }

func (t DNSServiceType) NormalizeUsername(s string) (string, error) {
	if !libkb.IsValidHostname(s) {
		return "", libkb.NewInvalidHostnameError(s)
	}
	return strings.ToLower(s), nil
}

func (t DNSServiceType) NormalizeRemoteName(_ libkb.ProofContext, s string) (string, error) {
	// Allow a leading 'dns://' and preserve case.
	s = strings.TrimPrefix(s, "dns://")
	if !libkb.IsValidHostname(s) {
		return "", libkb.NewInvalidHostnameError(s)
	}
	return s, nil
}

func (t DNSServiceType) GetPrompt() string {
	return "Your DNS domain"
}

func (t DNSServiceType) ToServiceJSON(un string) *jsonw.Wrapper {
	ret := jsonw.NewDictionary()
	ret.SetKey("protocol", jsonw.NewString("dns"))
	ret.SetKey("domain", jsonw.NewString(un))
	return ret
}

func (t DNSServiceType) FormatProofText(ctx libkb.ProofContext, ppr *libkb.PostProofRes) (string, error) {
	return (ppr.Text + "\n"), nil
}

func (t DNSServiceType) PostInstructions(un string) *libkb.Markup {
	return libkb.FmtMarkup(`Please save the following as a DNS TXT entry for
<strong>` + un + `</strong> OR <strong>_keybase.` + un + `</strong>:`)
}

func (t DNSServiceType) DisplayName(un string) string { return "Dns" }
func (t DNSServiceType) GetTypeName() string          { return "dns" }

func (t DNSServiceType) RecheckProofPosting(tryNumber int, status keybase1.ProofStatus, dn string) (warning *libkb.Markup, err error) {
	warning = libkb.FmtMarkup(`<p>We couldn't find a DNS proof for ` + dn + ` ... <strong>yet</strong></p>
<p>DNS propagation can be slow; we'll keep trying and email you the result</p>`)
	err = libkb.WaitForItError{}
	return
}
func (t DNSServiceType) GetProofType() string { return t.BaseGetProofType(t) }

func (t DNSServiceType) CheckProofText(text string, id keybase1.SigID, sig string) (err error) {
	return t.BaseCheckProofTextShort(text, id, true)
}

func (t DNSServiceType) GetAPIArgKey() string { return "remote_host" }
func (t DNSServiceType) LastWriterWins() bool { return false }

func (t DNSServiceType) MakeProofChecker(l libkb.RemoteProofChainLink) libkb.ProofChecker {
	return &DNSChecker{l}
}

//=============================================================================

func init() {
	externalServices.Register(DNSServiceType{})
}

//=============================================================================
