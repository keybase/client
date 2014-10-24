package libkb

import (
	"net"
	"strings"
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
	ps, err := OpenSig(rc.proof.GetArmoredSig())

	if err != nil {
		return NewProofError(PROOF_BAD_SIGNATURE,
			"Bad signature: %s", err.Error())
	}

	wanted := ps.ID().ToMediumId()

	if strings.HasSuffix(h.checkText, wanted) {
		return nil
	} else {
		return NewProofError(PROOF_BAD_HINT_TEXT,
			"Bad hint from server; wanted TXT value '%s' but got '%s'",
			wanted, h.checkText)
	}

	return nil
}

func (rc *DnsChecker) CheckDomain(sig string, domain string) ProofError {
	txt, err := net.LookupTXT(domain)
	if err != nil {
		return NewProofError(PROOF_DNS_ERROR,
			"DNS failure for %s: %s", domain, err.Error())
	}

	for _, record := range txt {
		G.Log.Debug("For %s, got TXT record: %s", domain, record)
		if record == sig {
			return nil
		}
	}
	return NewProofError(PROOF_NOT_FOUND,
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
