// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"strings"
	"testing"
)

type testAssertionContext struct{}

func (t testAssertionContext) NormalizeSocialName(service string, username string) (string, error) {
	return strings.ToLower(username), nil
}

func TestSuccess1(t *testing.T) {
	a := "web://maxk.org && twitter://maxtaco"
	expr, err := AssertionParse(testAssertionContext{}, a)
	proofs := NewProofSet([]Proof{
		{"http", "maxk.org"},
		{"reddit", "maxtaco"},
		{"twitter", "maxtaco"},
	})
	if err != nil {
		t.Errorf("Error parsing %s: %s", a, err)
	} else if !expr.MatchSet(*proofs) {
		t.Errorf("Should have matched")
	}
}

func TestAssertions1(t *testing.T) {
	a := "web://maxk.org && (https://foo.com || http://bar.com) && (bb@twitter || max || pgp://aabbcc)"
	goodProofsets := []ProofSet{
		*NewProofSet([]Proof{
			{"dns", "maxk.org"},
			{"https", "bar.com"},
			{"twitter", "bb"},
			{"github", "xxx"},
			{"keybase", "yyy"},
		}),
		*NewProofSet([]Proof{
			{"https", "maxk.org"},
			{"https", "foo.com"},
			{"keybase", "max"},
		}),
		*NewProofSet([]Proof{
			{"http", "maxk.org"},
			{"https", "foo.com"},
			{"pgp", "00aabbcc"},
		}),
		*NewProofSet([]Proof{
			{"http", "maxk.org"},
			{"https", "foo.com"},
			{"twitter", "bb"},
		}),
	}

	badProofsets := []ProofSet{
		*NewProofSet([]Proof{
			{"dns", "max.org"},
			{"http", "bar.com"},
			{"twitter", "bb"},
			{"github", "xxx"},
			{"keybase", "yyy"},
		}),
		*NewProofSet([]Proof{
			{"https", "maxk.org"},
			{"http", "foo.com"},
			{"keybase", "maxi"},
		}),
		*NewProofSet([]Proof{
			{"http", "maxk.org"},
			{"http", "foo.com"},
			{"pgp", "00aabbcc"},
		}),
		*NewProofSet([]Proof{
			{"http", "maxk.org"},
			{"https", "foo.com"},
		}),
		*NewProofSet([]Proof{
			{"http", "maxk.org"},
			{"https", "foo.com"},
			{"pgp", "00aabbcce"},
		}),
	}
	expr, err := AssertionParse(testAssertionContext{}, a)
	if err != nil {
		t.Errorf("Error parsing %s: %s", a, err)
	} else {
		for i, proofset := range goodProofsets {
			if !expr.MatchSet(proofset) {
				t.Errorf("proofset %d failed to match", i)
			}
		}
		for i, proofset := range badProofsets {
			if expr.MatchSet(proofset) {
				t.Errorf("proofset %d should not have matched", i)
			}
		}
	}
}

func TestAssertions2(t *testing.T) {
	// Coyne-style grammar
	a := "web:maxk.org+max,malgorithms+https:nutflex.com+pgp:aabbcc,samwise+dns:match.com"
	goodProofsets := []ProofSet{
		*NewProofSet([]Proof{
			{"https", "maxk.org"},
			{"keybase", "max"},
		}),
		*NewProofSet([]Proof{
			{"https", "nutflex.com"},
			{"pgp", "2233aabbcc"},
			{"keybase", "malgorithms"},
		}),
		*NewProofSet([]Proof{
			{"keybase", "samwise"},
			{"dns", "match.com"},
		}),
	}
	expr, err := AssertionParse(testAssertionContext{}, a)
	if err != nil {
		t.Errorf("Error parsing %s: %s", a, err)
	} else {
		for i, proofset := range goodProofsets {
			if !expr.MatchSet(proofset) {
				t.Errorf("proofset %d failed to match", i)
			}
		}
	}
}

func TestAssertions3(t *testing.T) {
	a := "t_bob+twitter:kbtester1"
	goodProofsets := []ProofSet{
		*NewProofSet([]Proof{
			{"twitter", "kbtester1"},
			{"keybase", "t_bob"},
		}),
	}
	expr, err := AssertionParseAndOnly(testAssertionContext{}, a)
	if err != nil {
		t.Errorf("Error parsing %s: %s", a, err)
	} else {
		for i, proofset := range goodProofsets {
			if !expr.MatchSet(proofset) {
				t.Errorf("proofset %d failed to match", i)
			}
		}
	}
}

func TestNeedsParans(t *testing.T) {
	tests := []struct {
		expr        string
		needsParens bool
	}{
		{"max+foo@twitter,chris+chris@keybase", false},
		{"max+foo@twitter+(chris,bob)", true},
		{"max+foo@twitter+(chris)", false},
		{"max+foo@twitter+((chris))", false},
		{"max+foo@twitter+(chris+sam)", false},
		{"max", false},
	}

	for _, test := range tests {
		expr, err := AssertionParse(testAssertionContext{}, test.expr)
		if err != nil {
			t.Errorf("Error parsing %s: %s", test.expr, err)
		} else if expr.NeedsParens() != test.needsParens {
			t.Errorf("On expresssion %s: didn't agree on needing parens", test.expr)
		}
	}

}
