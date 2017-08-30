// Copyright 2015 Keybase, Inc. All rights reserved. Use of
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
