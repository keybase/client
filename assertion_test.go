package libkbgo

import (
	"testing"
)

func TestSuccess1(t *testing.T) {
	a := "web://maxk.org && twitter://maxtaco"
	expr, err := AssertionParse(a)
	proofs := NewProofSet ([]Proof{
		{ "http", "maxk.org" },
		{ "reddit", "maxtaco" },
		{ "twitter", "maxtaco" },
	})
	if err != nil {
		t.Errorf("Error parsing %s: %s", a, err.Error())
	} else if ! expr.MatchSet(*proofs) {
		t.Errorf("Should have matched")
	}
}

func TestSucess2(t *testing.T) {
	a := "web://maxk.org && (https://foo.com || http://bar.com) && (twitter://bb || max || fingerprint://aabbcc)"	
	proofsets := []ProofSet {
		*NewProofSet([]Proof{
			{"dns", "maxk.org" },
			{"http", "bar.com" },
			{"twitter", "bb" },
		}),
		*NewProofSet([]Proof{
			{"https", "maxk.org" },
			{"http", "foo.com" },
			{"keybase", "max" },
		}),
		*NewProofSet([]Proof{
			{"http", "maxk.org" },
			{"https", "foo.com" },
			{"fingerprint", "00aabbcc" },
		}),
		*NewProofSet([]Proof{
			{"http", "maxk.org" },
			{"https", "foo.com" },
			{"twitter", "bb" },
		}),
	}
	expr, err := AssertionParse(a)
	if err != nil {
		t.Errorf("Error parsing %s: %s", a, err.Error())
	} else {
		for i, proofset := range(proofsets) {
			if !expr.MatchSet(proofset) {
				t.Errorf("proofset %d failed to match", i)
			}
		}
	}
}