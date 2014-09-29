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
	good_proofsets := []ProofSet {
		*NewProofSet([]Proof{
			{"dns", "maxk.org" },
			{"https", "bar.com" },
			{"twitter", "bb" },
			{"github", "xxx"},
			{"keybase", "yyy"},
		}),
		*NewProofSet([]Proof{
			{"https", "maxk.org" },
			{"https", "foo.com" },
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

	bad_proofsets := []ProofSet {
		*NewProofSet([]Proof{
			{"dns", "max.org" },
			{"http", "bar.com" },
			{"twitter", "bb" },
			{"github", "xxx"},
			{"keybase", "yyy"},
		}),
		*NewProofSet([]Proof{
			{"https", "maxk.org" },
			{"http", "foo.com" },
			{"keybase", "maxi" },
		}),
		*NewProofSet([]Proof{
			{"http", "maxk.org" },
			{"http", "foo.com" },
			{"fingerprint", "00aabbcc" },
		}),
		*NewProofSet([]Proof{
			{"http", "maxk.org" },
			{"https", "foo.com" },
		}),
		*NewProofSet([]Proof{
			{"http", "maxk.org" },
			{"https", "foo.com" },
			{"fingerprint", "00aabbcce" },
		}),
	}
	expr, err := AssertionParse(a)
	if err != nil {
		t.Errorf("Error parsing %s: %s", a, err.Error())
	} else {
		for i, proofset := range(good_proofsets) {
			if !expr.MatchSet(proofset) {
				t.Errorf("proofset %d failed to match", i)
			}
		}
		for i, proofset := range(bad_proofsets) {
			if expr.MatchSet(proofset) {
				t.Errorf("proofset %d should not have matched", i)
			}
		}
	}
}