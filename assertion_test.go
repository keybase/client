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