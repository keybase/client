// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"fmt"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

type testAssertionContext struct{}

func (t testAssertionContext) Ctx() context.Context { return context.Background() }

func (t testAssertionContext) NormalizeSocialName(service string, username string) (string, error) {
	return strings.ToLower(username), nil
}

type testAlwaysFailAssertionContext struct{}

const failAssertionContextErr = "Unknown social network BECAUSE IT'S A TEST"

func (t testAlwaysFailAssertionContext) Ctx() context.Context { return context.Background() }

func (t testAlwaysFailAssertionContext) NormalizeSocialName(service string, username string) (string, error) {
	return "", fmt.Errorf("%s: %s", failAssertionContextErr, service)
}

func TestUsername(t *testing.T) {
	a := "max"
	expr, err := AssertionParse(testAssertionContext{}, a)
	require.NoError(t, err)
	require.IsType(t, AssertionKeybase{}, expr)
	require.Equal(t, expr.String(), a)
	proofset := NewProofSet([]Proof{
		{"keybase", "max"},
	})
	require.True(t, expr.MatchSet(*proofset))
}

func TestUsernameMultiple(t *testing.T) {
	a := "max,chris"
	expr, err := AssertionParse(testAssertionContext{}, a)
	require.NoError(t, err)

	usernameSet := func(username string) ProofSet {
		return *NewProofSet([]Proof{
			{"keybase", username},
		})
	}
	require.True(t, expr.MatchSet(usernameSet("max")))
	require.True(t, expr.MatchSet(usernameSet("chris")))
	require.False(t, expr.MatchSet(usernameSet("sam")))
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

func TestAssertionsUsernames(t *testing.T) {
	exprs := []string{"x_", "A2", "ed", "bob", "o_o"}
	fmts := []string{"%s", "%s@keybase", "keybase:%s"}
	for _, str := range exprs {
		for _, f := range fmts {
			expr, err := AssertionParse(testAssertionContext{}, fmt.Sprintf(f, str))
			require.NoError(t, err)
			require.IsType(t, AssertionKeybase{}, expr)
			require.Equal(t, strings.ToLower(str), expr.String())
		}
	}
}

func TestProofSetEmail(t *testing.T) {
	exprs := []string{
		"[m@keybasers.de]@email",
		"email:[m@keybasers.de]",
		"email://[m@keybasers.de]",
	}
	proofset := *NewProofSet([]Proof{
		{"email", "m@keybasers.de"},
	})
	for _, expr := range exprs {
		expr, err := AssertionParse(testAssertionContext{}, expr)
		require.NoError(t, err)
		require.Equal(t, "[m@keybasers.de]@email", expr.String())
		require.True(t, expr.MatchSet(proofset), "when checking %q", expr)
	}
}

func TestEmailAssertions(t *testing.T) {
	exprs := []string{
		"[m.a.x+2@kb.eu]@email",
		"email:[h.e.l.l.o@kb.eu]",
		"email://[test+spam@kb.eu]",
		"email://[test+spam@kb.eu]+[other@example.com]@email",
	}
	for _, expr := range exprs {
		_, err := AssertionParse(testAssertionContext{}, expr)
		require.NoError(t, err)
	}
}

func TestAssertionEmailsMultiple(t *testing.T) {
	exprs := []string{
		"[m@keybasers.de]@email,max",
		"max,[m@keybasers.de]@email",
		"email:[m@keybasers.de],max",
		"max,email:[m@keybasers.de]",
		"max,email://[m@keybasers.de]",
		"(max||[max@keybase.io]@email),email://[m@keybasers.de]",
	}
	goodProofsets := []ProofSet{
		*NewProofSet([]Proof{
			{"email", "m@keybasers.de"},
		}),
		*NewProofSet([]Proof{
			{"keybase", "max"},
		}),
		*NewProofSet([]Proof{
			{"email", "m@keybasers.de"},
			{"keybase", "m"},
		}),
	}
	badProofsets := []ProofSet{
		*NewProofSet([]Proof{
			{"keybase", "m"},
		}),
		*NewProofSet([]Proof{
			{"https", "keybase.io"},
		}),
		*NewProofSet([]Proof{
			{"http", "keybase.io"},
		}),
	}
	for _, expr := range exprs {
		ret, err := AssertionParse(testAssertionContext{}, expr)
		require.NoError(t, err, "when parsing %q", expr)
		for _, proofset := range goodProofsets {
			require.True(t, ret.MatchSet(proofset), "when checking %q with pset: %v", expr, proofset)
		}
		for _, proofset := range badProofsets {
			require.False(t, ret.MatchSet(proofset), "when checking %q with pset: %v", expr, proofset)
		}
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
