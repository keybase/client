// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"fmt"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

type testAssertionContext struct{}

func (t testAssertionContext) NormalizeSocialName(service string, username string) (string, error) {
	return strings.ToLower(username), nil
}

type testAlwaysFailAssertionContext struct{}

const failAssertionContextErr = "Unknown social network BECAUSE IT'S A TEST"

func (t testAlwaysFailAssertionContext) NormalizeSocialName(service string, username string) (string, error) {
	return "", fmt.Errorf("%s: %s", failAssertionContextErr, service)
}

func TestSuccess1(t *testing.T) {
	a := "web://maxk.org && twitter://maxtaco"
	expr, err := AssertionParse(testAssertionContext{}, a)
	proofs := NewProofSet([]Proof{
		{"http", "maxk.org"},
		{"reddit", "maxtaco"},
		{"twitter", "maxtaco"},
	})
	require.NoError(t, err)
	require.True(t, expr.MatchSet(*proofs))
}

func TestAssertions1(t *testing.T) {
	a := "web://maxk.org && (https://foo.com || http://bar.com) && (bb@twitter || max || pgp://aabbcc) && (keybear@octodon.social || gubble.social:keybear)"
	goodProofsets := []ProofSet{
		*NewProofSet([]Proof{
			{"dns", "maxk.org"},
			{"https", "bar.com"},
			{"twitter", "bb"},
			{"github", "xxx"},
			{"keybase", "yyy"},
			{"gubble.social", "keybear"},
		}),
		*NewProofSet([]Proof{
			{"https", "maxk.org"},
			{"https", "foo.com"},
			{"keybase", "max"},
			{"octodon.social", "keybear"},
		}),
		*NewProofSet([]Proof{
			{"http", "maxk.org"},
			{"https", "foo.com"},
			{"pgp", "00aabbcc"},
			{"gubble.social", "keybear"},
		}),
		*NewProofSet([]Proof{
			{"http", "maxk.org"},
			{"https", "foo.com"},
			{"twitter", "bb"},
			{"octodon.social", "keybear"},
		}),
		*NewProofSet([]Proof{
			{"http", "maxk.org"},
			{"http", "bar.com"},
			{"twitter", "bb"},
			{"octodon.social", "keybear"},
		}),
	}

	badProofsets := []ProofSet{
		*NewProofSet([]Proof{
			{"dns", "max.org"},
			{"http", "bar.com"},
			{"twitter", "bb"},
			{"github", "xxx"},
			{"keybase", "yyy"},
			{"gubble", "keybear"},
		}),
		*NewProofSet([]Proof{
			{"https", "maxk.org"},
			{"http", "foo.com"},
			{"keybase", "maxi"},
			{"gubble.social", "keybase"},
		}),
		*NewProofSet([]Proof{
			{"http", "maxk.org"},
			{"http", "foo.com"},
			{"pgp", "00aabbcc"},
			{"octodon.social", "keybase"},
		}),
		*NewProofSet([]Proof{
			{"http", "maxk.org"},
			{"https", "foo.com"},
		}),
		*NewProofSet([]Proof{
			{"http", "maxk.org"},
			{"https", "foo.com"},
			{"pgp", "00aabbcce"},
			{"pentagon.social", "keybear"},
		}),
		*NewProofSet([]Proof{
			{"gubble.social", "keybear"},
			{"octodon.social", "keybear"},
		}),
	}
	expr, err := AssertionParse(testAssertionContext{}, a)
	require.NoError(t, err)
	for _, proofset := range goodProofsets {
		require.True(t, expr.MatchSet(proofset))
	}
	for _, proofset := range badProofsets {
		require.False(t, expr.MatchSet(proofset))
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
	require.NoError(t, err)
	for _, proofset := range goodProofsets {
		require.True(t, expr.MatchSet(proofset), "matching to %+v", proofset)
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
	require.NoError(t, err)
	for _, proofset := range goodProofsets {
		require.True(t, expr.MatchSet(proofset))
	}
}

func TestAssertions4(t *testing.T) {
	// Coyne-style grammar (2), now with 100% more paramproof assertions
	a := "alice@rooter+alice@cat.cafe+alice,https:nutflex.com+bob,jun@gubblers.eu+aabbcc@pgp"
	goodProofsets := []ProofSet{
		*NewProofSet([]Proof{
			{"rooter", "alice"},
			{"cat.cafe", "alice"},
			{"keybase", "alice"},
		}),
		*NewProofSet([]Proof{
			{"https", "nutflex.com"},
			{"keybase", "bob"},
		}),
		*NewProofSet([]Proof{
			{"gubblers.eu", "jun"},
			{"pgp", "2233aabbcc"},
		}),
	}
	badProofsets := []ProofSet{
		*NewProofSet([]Proof{
			{"cat.cafe", "alice"},
		}),
		*NewProofSet([]Proof{
			{"keybase", "bob"},
		}),
		*NewProofSet([]Proof{
			{"gubblers.eu", "jun"},
			{"cat.cafe", "alice"}, // alice, no! your cat.cafe account got compromised!
		}),
	}
	expr, err := AssertionParse(testAssertionContext{}, a)
	require.NoError(t, err)
	for _, proofset := range goodProofsets {
		require.True(t, expr.MatchSet(proofset), "matching to %+v", proofset)
	}
	for _, proofset := range badProofsets {
		require.False(t, expr.MatchSet(proofset), "matching to %+v", proofset)
	}
}

func TestNeedsParens(t *testing.T) {
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
		require.NoError(t, err)
		require.Equal(t, expr.NeedsParens(), test.needsParens)
	}
}

func TestAssertionCtxFailures(t *testing.T) {
	a := "michal@twitter,mark@zapu.net"
	_, err := AssertionParse(testAlwaysFailAssertionContext{}, a)
	require.Error(t, err)
	require.Contains(t, err.Error(), failAssertionContextErr)
	require.Contains(t, err.Error(), "zapu.net")
}
