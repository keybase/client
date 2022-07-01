// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package externals

import (
	"context"
	"testing"

	libkb "github.com/keybase/client/go/libkb"
	"github.com/stretchr/testify/require"
)

func TestNormalization(t *testing.T) {
	tc := setupTest(t, "Normalization", 1)
	defer tc.Cleanup()
	inp := "Web://A.AA || HttP://B.bb && dnS://C.cc || MaxFactor@reddit || zQueal@keyBASE || XanxA@hackernews || foO@TWITTER || 0123456789ABCDEF0123456789abcd19@uid || josh@gubble.SoCiAl"
	outp := "a.aa@web,b.bb@http+c.cc@dns,maxfactor@reddit,zqueal,XanxA@hackernews,foo@twitter,0123456789abcdef0123456789abcd19@uid,josh@gubble.social"
	expr, err := AssertionParse(libkb.NewMetaContext(context.Background(), tc.G), inp)
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
		{"", "Unexpected EOF parsing assertion"},
		{"aa ||", "Unexpected EOF parsing assertion"},
		{"aa &&", "Unexpected EOF parsing assertion"},
		{"(aa", "Unbalanced parentheses"},
		{"aa && dns:", "Bad assertion, no value given (key=dns)"},
		{"bb && foo:a", "Unknown social network: foo"},
		{"&& aa", "Unexpected token: &&"},
		{"|| aa", "Unexpected token: ||"},
		{"aa)", "Found junk at end of input: )"},
		{"()", "Illegal parenthetical expression"},

		// Invalid usernames
		{"dns://a", "Invalid hostname: a"},
		{"a@pgp", "bad hex string: 'a'"},
		{"aBCP@pgp", "bad hex string: 'abcp'"},
		{"jj@pgp", "bad hex string: 'jj'"},
		{"[al@ice@keybase.io]@email", "Invalid email address: al@ice@keybase.io"},
		{"email:[al@ice@keybase.io]", "Invalid email address: al@ice@keybase.io"},
		{"phone:onetwothree", "Invalid phone number: onetwothree"},
		{"onetwothree@phone", "Invalid phone number: onetwothree"},
		{"1-555-222@phone", "Invalid phone number: 1-555-222"},

		// Username missing
		{"f@reddit", "Bad username: 'f'"},
		{"http://", "Bad assertion, no value given (key=http)"},
		{"reddit:", "Bad username: ''"},
		{"reddit://", "Bad username: ''"},
		{"gubble.social:", "username must be at least 2 characters, was 0"},
		{"@gubble.social", "username must be at least 2 characters, was 0"},
		{"@rooter", "Bad username: ''"},
		{"@zzzzz", "Unknown social network: zzzzz"},

		// Service name missing
		{"hello@", "Invalid key-value identity: hello@"},
		{":illegal", "Invalid key-value identity: :illegal"},
		{"://what", "Invalid key-value identity: ://what"},

		{"@", "Invalid key-value identity: @"},
		{":", "Invalid key-value identity: :"},
		{"://", "Invalid key-value identity: ://"},

		{"alice@rooter@email", "Invalid key-value identity: alice@rooter@email"},
		{"alice@keybase.io@email", "Invalid key-value identity: alice@keybase.io@email"},

		{"(alice@keybasers.de)@email", "Illegal parenthetical expression"},
		{"twitter://alice&&(alice@keybasers.de)@email", "Found junk at end of input: )"},
		{"bob,[al#ice@kb.io]@email", "Syntax error when parsing: [al#ice@kb.io]@email"}, // `bob,` parsed successfully, but lexer did not match anything after
		{"[al#ice@keybase.io]@email", "Syntax error when parsing: [al#ice@keybase.io]@email"},
		{"[b,b@keybase.io]@email", "Invalid key-value identity: [b,b@keybase.io]@email"},

		// Always require [] syntax for emails, even though this is theoretically { service: "email", name : "spam" }.
		{"spam@email", "expected bracket syntax for email assertion"},

		// entire email:alice@keybase.io is sweeped as URL and passet to
		// assertion parser, which does not recognize syntax with both : and @
		{"email:alice@keybase.io", "Invalid key-value identity: email:alice@keybase.io"},
		// similar to above
		{"email://alice@keybase.io", "Invalid key-value identity: email://alice@keybase.io"},
		// non-email example
		{"rooter:alice@twitter", "Invalid key-value identity: rooter:alice@twitter"},

		// [] is parser-level illegal
		{"[]@email", "Invalid key-value identity: []@email"},
		{"[]@rooter", "Invalid key-value identity: []@rooter"},
		{"rooter:[]", "Invalid key-value identity: rooter:[]"},
		{"email:[]", "Invalid key-value identity: email:[]"},
		{"email://[]", "Invalid key-value identity: email://[]"},

		{"[alice]@rooter", "unexpected bracket syntax for assertion: rooter"},
		{"rooter:[alice]", "unexpected bracket syntax for assertion: rooter"},

		{"[michal]", "Syntax error when parsing: [michal]"},
		// This is lexed as URL, ERROR, EOF, but it fails prematurely
		// with assertion parser error on "[michal]@" (first URL), so we
		// don't get to see "Syntax error".
		{"[michal]@[keybase]", "Invalid key-value identity: [michal]@"},

		{"[+1-555-222]@phone", "unexpected bracket syntax for assertion: phone"}, // nice try but no
	}

	for _, bad := range bads {
		ret, err := AssertionParse(libkb.NewMetaContext(context.Background(), tc.G), bad.k)
		require.Error(t, err, "for %q: ret is: %+v", bad.k, ret)
		require.Equal(t, bad.v, err.Error(), "when testing %q", bad.k)
	}
}
