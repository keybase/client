// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"net"
	"strings"

	keybase1 "github.com/keybase/client/go/protocol"
	jsonw "github.com/keybase/go-jsonw"
)

//=============================================================================
// Dns
//

type DNSChecker struct {
	proof RemoteProofChainLink
}

func NewDNSChecker(p RemoteProofChainLink) (*DNSChecker, ProofError) {
	return &DNSChecker{p}, nil
}

func (rc *DNSChecker) GetTorError() ProofError { return ProofErrorDNSOverTor }

func (rc *DNSChecker) CheckHint(h SigHint) ProofError {
	_, sigID, err := OpenSig(rc.proof.GetArmoredSig())

	if err != nil {
		return NewProofError(keybase1.ProofStatus_BAD_SIGNATURE,
			"Bad signature: %s", err)
	}

	wanted := sigID.ToMediumID()

	if !strings.HasSuffix(h.checkText, wanted) {
		return NewProofError(keybase1.ProofStatus_BAD_HINT_TEXT,
			"Bad hint from server; wanted TXT value '%s' but got '%s'",
			wanted, h.checkText)
	}
	return nil
}

func (rc *DNSChecker) CheckDomain(sig string, domain string) ProofError {
	txt, err := net.LookupTXT(domain)
	if err != nil {
		return NewProofError(keybase1.ProofStatus_DNS_ERROR,
			"DNS failure for %s: %s", domain, err)
	}

	for _, record := range txt {
		G.Log.Debug("For %s, got TXT record: %s", domain, record)
		if record == sig {
			return nil
		}
	}
	return NewProofError(keybase1.ProofStatus_NOT_FOUND,
		"Checked %d TXT entries of %s, but didn't find signature %s",
		len(txt), domain, sig)
}

func (rc *DNSChecker) CheckStatus(h SigHint) ProofError {

	wanted := h.checkText
	G.Log.Debug("| DNS proof, want TXT value: %s", wanted)

	domain := rc.proof.GetHostname()

	// Try the apex first, and report its error if both
	// attempts fail
	pe := rc.CheckDomain(wanted, domain)
	if pe != nil {
		tmp := rc.CheckDomain(wanted, "_keybase."+domain)
		if tmp == nil {
			pe = nil
		}
	}
	return pe
}

//
//=============================================================================

type DNSServiceType struct{ BaseServiceType }

func (t DNSServiceType) AllStringKeys() []string { return t.BaseAllStringKeys(t) }

func (t DNSServiceType) NormalizeUsername(s string) (string, error) {
	if !IsValidHostname(s) {
		return "", InvalidHostnameError{s}
	}
	return strings.ToLower(s), nil
}

func (t DNSServiceType) NormalizeRemoteName(s string) (string, error) {
	// Allow a leading 'dns://' and preserve case.
	s = strings.TrimPrefix(s, "dns://")
	if !IsValidHostname(s) {
		return "", InvalidHostnameError{s}
	}
	return s, nil
}

func (t DNSServiceType) ToChecker() Checker {
	return t.BaseToChecker(t, "a valid domain name")
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

func (t DNSServiceType) FormatProofText(ppr *PostProofRes) (string, error) {
	return (ppr.Text + "\n"), nil
}

func (t DNSServiceType) PostInstructions(un string) *Markup {
	return FmtMarkup(`Please save the following as a DNS TXT entry for
<strong>` + un + `</strong> OR <strong>_keybase.` + un + `</strong>:`)
}

func (t DNSServiceType) DisplayName(un string) string { return "Dns" }
func (t DNSServiceType) GetTypeName() string          { return "dns" }

func (t DNSServiceType) RecheckProofPosting(tryNumber int, status keybase1.ProofStatus, dn string) (warning *Markup, err error) {
	warning = FmtMarkup(`<p>We couldn't find a DNS proof for ` + dn + ` ... <strong>yet</strong></p>
<p>DNS propagation can be slow; we'll keep trying and email you the result</p>`)
	err = WaitForItError{}
	return
}
func (t DNSServiceType) GetProofType() string { return t.BaseGetProofType(t) }

func (t DNSServiceType) CheckProofText(text string, id keybase1.SigID, sig string) (err error) {
	return t.BaseCheckProofTextShort(text, id, true)
}

func (t DNSServiceType) GetAPIArgKey() string { return "remote_host" }
func (t DNSServiceType) LastWriterWins() bool { return false }

//=============================================================================

func init() {
	RegisterServiceType(DNSServiceType{})
	RegisterSocialNetwork("dns")
	RegisterMakeProofCheckerFunc("dns",
		func(l RemoteProofChainLink) (ProofChecker, ProofError) {
			return NewDNSChecker(l)
		})
}

//=============================================================================
