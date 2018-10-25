// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package externals

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestNormalization(t *testing.T) {
	tc := setupTest(t, "Normalization", 1)
	defer tc.Cleanup()
	inp := "Web://A.AA || HttP://B.bb && dnS://C.cc || MaxFactor@reddit || zQueal@keyBASE || XanxA@hackernews || foO@TWITTER || 0123456789ABCDEF0123456789abcd19@uid || josh@gubble.SoCiAl"
	outp := "a.aa@web,b.bb@http+c.cc@dns,maxfactor@reddit,zqueal,XanxA@hackernews,foo@twitter,0123456789abcdef0123456789abcd19@uid,josh@gubble.social"
	expr, err := AssertionParse(tc.G, inp)
	require.NoError(t, err)
	require.Equal(t, expr.String(), outp)
}

type Pair struct {
	k, v string
}

func TestParserFail1(t *testing.T) {
	tc := setupTest(t, "ParserFail1", 1)
	defer tc.Cleanup()
	bads := []Pair{
		{"", "Unexpected EOF"},
		{"aa ||", "Unexpected EOF"},
		{"aa &&", "Unexpected EOF"},
		{"(aa", "Unbalanced parentheses"},
		{"aa && dns:", "Bad assertion, no value given (key=dns)"},
		{"bb && foo:a", "Unknown social network: foo"},
		{"&& aa", "Unexpected token: &&"},
		{"|| aa", "Unexpected token: ||"},
		{"aa)", "Found junk at end of input: )"},

		// Invalid usernames
		{"()", "Illegal parenthetical expression"},
		{"dns://a", "Invalid hostname: a"},
		{"a@pgp", "bad hex string: 'a'"},
		{"aBCP@pgp", "bad hex string: 'abcp'"},
		{"jj@pgp", "bad hex string: 'jj'"},

		// Username missing
		{"f@reddit", "Bad username: 'f'"},
		{"http://", "Bad assertion, no value given (key=http)"},
		{"reddit:", "Bad username: ''"},
		{"reddit://", "Bad username: ''"},
		{"gubble.social:", "username must be at least 2 characters, was 0"},

		// Service name missing
		{"hello@", "Invalid key-value identity: hello@"},
		{"://", "Invalid key-value identity: ://"},
		{"://what", "Invalid key-value identity: ://what"},
		{":illegal", "Invalid key-value identity: :illegal"},

		{"alice@rooter@email", "Invalid key-value identity: alice@rooter@email"},
		{"alice@keybase.io@email", "Invalid key-value identity: alice@keybase.io@email"},

		{"(alice@keybasers.de)@email", "Illegal parenthetical expression"},
		{"twitter://alice&&(alice@keybasers.de)@email", "Found junk at end of input: )"},
		{"bob,[al#ice@kb.io]@email", "Syntax error when parsing: [al#ice@kb.io]@email"}, // `bob,` parsed successfully, but lexer did not match anything after
		{"[al#ice@keybase.io]@email", "Syntax error when parsing: [al#ice@keybase.io]@email"},

		// Always require [] syntax for emails, even though this is theoretically { service: "email", name : "spam" }.
		{"spam@email", "expected [...] syntax for email assertion"},

		// entire email:alice@keybase.io is sweeped as URL and passet to
		// assertion parser, which does not recognize syntax with both : and @
		{"email:alice@keybase.io", "Invalid key-value identity: email:alice@keybase.io"},
		// similar to above
		{"email://alice@keybase.io", "Invalid key-value identity: email://alice@keybase.io"},

		{"[]@email", "Syntax error when parsing: []@email"},
		{"[]@rooter", "Syntax error when parsing: []@rooter"},
		{"rooter:[]", "Bad username: ''"},
		{"email:[]", "expected [...] syntax for email assertion"}, // not ideal either

		{"[alice]@rooter", "unexpected [...] syntax for assertion: rooter"},
	}

	for _, bad := range bads {
		ret, err := AssertionParse(tc.G, bad.k)
		require.Error(t, err, "for %q: ret is: %+v", bad.k, ret)
		require.Equal(t, bad.v, err.Error())
	}
}
