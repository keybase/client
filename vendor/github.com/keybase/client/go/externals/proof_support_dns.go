// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package externals

import (
	"net"
	"strings"

	libkb "github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	pvl "github.com/keybase/client/go/pvl"
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

func (rc *DNSChecker) CheckHint(ctx libkb.ProofContext, h libkb.SigHint) libkb.ProofError {
	if pvl.UsePvl {
		// checking the hint is done later in CheckStatus
		return nil
	}

	_, sigID, err := libkb.OpenSig(rc.proof.GetArmoredSig())

	if err != nil {
		return libkb.NewProofError(keybase1.ProofStatus_BAD_SIGNATURE,
			"Bad signature: %s", err)
	}

	wanted := sigID.ToMediumID()

	if !strings.HasSuffix(h.GetCheckText(), wanted) {
		return libkb.NewProofError(keybase1.ProofStatus_BAD_HINT_TEXT,
			"Bad hint from server; wanted TXT value '%s' but got '%s'",
			wanted, h.GetCheckText())
	}
	return nil
}

func (rc *DNSChecker) CheckDomain(ctx libkb.ProofContext, sig string, domain string) libkb.ProofError {
	txt, err := net.LookupTXT(domain)
	if err != nil {
		return libkb.NewProofError(keybase1.ProofStatus_DNS_ERROR,
			"DNS failure for %s: %s", domain, err)
	}

	for _, record := range txt {
		ctx.GetLog().Debug("For %s, got TXT record: %s", domain, record)
		if record == sig {
			return nil
		}
	}
	return libkb.NewProofError(keybase1.ProofStatus_NOT_FOUND,
		"Checked %d TXT entries of %s, but didn't find signature %s",
		len(txt), domain, sig)
}

func (rc *DNSChecker) CheckStatus(ctx libkb.ProofContext, h libkb.SigHint) libkb.ProofError {
	if pvl.UsePvl {
		return pvl.CheckProof(ctx, pvl.GetHardcodedPvlString(), keybase1.ProofType_DNS,
			pvl.NewProofInfo(rc.proof, h))
	}
	return rc.CheckStatusOld(ctx, h)
}

func (rc *DNSChecker) CheckStatusOld(ctx libkb.ProofContext, h libkb.SigHint) libkb.ProofError {
	wanted := h.GetCheckText()
	ctx.GetLog().Debug("| DNS proof, want TXT value: %s", wanted)

	domain := rc.proof.GetHostname()

	// Try the apex first, and report its error if both
	// attempts fail
	pe := rc.CheckDomain(ctx, wanted, domain)
	if pe != nil {
		tmp := rc.CheckDomain(ctx, wanted, "_keybase."+domain)
		if tmp == nil {
			pe = nil
		}
	}
	return pe
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

func (t DNSServiceType) FormatProofText(ppr *libkb.PostProofRes) (string, error) {
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
