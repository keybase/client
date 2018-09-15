// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package externals

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/stretchr/testify/require"
)

func TestNormalization(t *testing.T) {
	tc := libkb.SetupTest(t, "Normalization", 1)
	inp := "Web://A.AA || HttP://B.bb && dnS://C.cc || MaxFactor@reddit || zQueal@keyBASE || XanxA@hackernews || foO@TWITTER || 0123456789ABCDEF0123456789abcd19@uid || josh@mastodon.SoCiAl"
	outp := "a.aa@web,b.bb@http+c.cc@dns,maxfactor@reddit,zqueal,XanxA@hackernews,foo@twitter,0123456789abcdef0123456789abcd19@uid,josh@mastodon.social"
	expr, err := AssertionParse(tc.G, inp)
	require.NoError(t, err)
	require.Equal(t, expr.String(), outp)
}

type Pair struct {
	k, v string
}

func TestParserFail1(t *testing.T) {
	tc := libkb.SetupTest(t, "ParserFail1", 1)
	bads := []Pair{
		{"aa ||", "Unexpected EOF"},
		{"aa &&", "Unexpected EOF"},
		{"(aa", "Unbalanced parentheses"},
		{"aa && dns:", "Bad assertion, no value given (key=dns)"},
		{"bb && foo:a", "Unknown social network: foo"},
		{"&& aa", "Unexpected token: &&"},
		{"|| aa", "Unexpected token: ||"},
		{"aa)", "Found junk at end of input: )"},
		{"()", "Illegal parenthetical expression"},
		{"dns://a", "Invalid hostname: a"},
		{"f@reddit", "Bad username: 'f'"},
		{"a@pgp", "bad hex string: 'a'"},
		{"aBCP@pgp", "bad hex string: 'abcp'"},
		{"jj@pgp", "bad hex string: 'jj'"},
	}

	for _, bad := range bads {
		_, err := AssertionParse(tc.G, bad.k)
		require.Error(t, err)
		require.Equal(t, err.Error(), bad.v)
	}
}
