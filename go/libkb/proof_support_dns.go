package libkb

import (
	"net"
	"strings"

	keybase1 "github.com/keybase/client/protocol/go"
	jsonw "github.com/keybase/go-jsonw"
)

//=============================================================================
// Dns
//

type DnsChecker struct {
	proof RemoteProofChainLink
}

func NewDnsChecker(p RemoteProofChainLink) (*DnsChecker, ProofError) {
	return &DnsChecker{p}, nil
}

func (rc *DnsChecker) CheckHint(h SigHint) ProofError {
	_, sigId, err := OpenSig(rc.proof.GetArmoredSig())

	if err != nil {
		return NewProofError(keybase1.ProofStatus_BAD_SIGNATURE,
			"Bad signature: %s", err.Error())
	}

	wanted := sigId.ToMediumId()

	if !strings.HasSuffix(h.checkText, wanted) {
		return NewProofError(keybase1.ProofStatus_BAD_HINT_TEXT,
			"Bad hint from server; wanted TXT value '%s' but got '%s'",
			wanted, h.checkText)
	}
	return nil
}

func (rc *DnsChecker) CheckDomain(sig string, domain string) ProofError {
	txt, err := net.LookupTXT(domain)
	if err != nil {
		return NewProofError(keybase1.ProofStatus_DNS_ERROR,
			"DNS failure for %s: %s", domain, err.Error())
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

func (rc *DnsChecker) CheckStatus(h SigHint) ProofError {

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

type DnsServiceType struct{ BaseServiceType }

func (t DnsServiceType) AllStringKeys() []string     { return t.BaseAllStringKeys(t) }
func (t DnsServiceType) PrimaryStringKeys() []string { return t.BasePrimaryStringKeys(t) }

func ParseDns(s string) (ret string, err error) {
	if strings.HasPrefix(s, "dns://") {
		s = s[6:]
	}
	if !IsValidHostname(s) {
		err = InvalidHostnameError{s}
	} else {
		ret = s
	}
	return
}

func (t DnsServiceType) CheckUsername(s string) error {
	_, e := ParseDns(s)
	return e
}

func (t DnsServiceType) NormalizeUsername(s string) (string, error) {
	return ParseDns(s)
}

func (t DnsServiceType) ToChecker() Checker {
	return t.BaseToChecker(t, "a valid domain name")
}

func (t DnsServiceType) GetPrompt() string {
	return "Your DNS domain"
}

func (t DnsServiceType) ToServiceJson(un string) *jsonw.Wrapper {
	ret := jsonw.NewDictionary()
	ret.SetKey("protocol", jsonw.NewString("dns"))
	ret.SetKey("domain", jsonw.NewString(un))
	return ret
}

func (t DnsServiceType) FormatProofText(ppr *PostProofRes) (string, error) {
	return (ppr.Text + "\n"), nil
}

func (t DnsServiceType) PostInstructions(un string) *Markup {
	return FmtMarkup(`Please save the following as a DNS TXT entry for
<strong>` + un + `</strong> OR <strong>_keybase.` + un + `</strong>:`)
}

func (t DnsServiceType) DisplayName(un string) string { return "Dns" }
func (t DnsServiceType) GetTypeName() string          { return "dns" }

func (t DnsServiceType) RecheckProofPosting(tryNumber int, status keybase1.ProofStatus) (warning *Markup, err error) {
	warning = FmtMarkup(`<p>We couldn't find a DNS proof for...<strong>yet</strong></p>
<p>DNS propogation can be slow; we'll keep trying and email you the result</p>`)
	err = WaitForItError{}
	return
}
func (t DnsServiceType) GetProofType() string { return t.BaseGetProofType(t) }

func (t DnsServiceType) CheckProofText(text string, id keybase1.SigID, sig string) (err error) {
	return t.BaseCheckProofTextShort(text, id, true)
}

func (t DnsServiceType) GetApiArgKey() string { return "remote_host" }
func (t DnsServiceType) LastWriterWins() bool { return false }

//=============================================================================

func init() {
	RegisterServiceType(DnsServiceType{})
	RegisterSocialNetwork("dns")
	RegisterProofCheckHook("dns",
		func(l RemoteProofChainLink) (ProofChecker, ProofError) {
			return NewDnsChecker(l)
		})
}

//=============================================================================
