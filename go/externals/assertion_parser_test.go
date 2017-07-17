// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package externals

import (
	"testing"

	"github.com/keybase/client/go/libkb"
)

func testAssertionContext() libkb.AssertionContext {
	return libkb.MakeAssertionContext(GetServices())
}

func TestNormalization(t *testing.T) {
	inp := "Web://A.AA || HttP://B.bb && dnS://C.cc || MaxFactor@reddit || zQueal@keyBASE || XanxA@hackernews || foO@TWITTER || 0123456789ABCDEF0123456789abcd19@uid"
	outp := "a.aa@web,b.bb@http+c.cc@dns,maxfactor@reddit,zqueal,XanxA@hackernews,foo@twitter,0123456789abcdef0123456789abcd19@uid"
	expr, err := AssertionParse(inp)
	if err != nil {
		t.Error(err)
	} else if expr.String() != outp {
		t.Errorf("Wrong parse result: %s v %s", expr.String(), outp)
	}
}

type Pair struct {
	k, v string
}

func TestParserFail1(t *testing.T) {
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
		expr, err := AssertionParse(bad.k)
		if err == nil {
			t.Errorf("Expected a parse error in %s (got %v)", bad, expr)
		} else if err.Error() != bad.v {
			t.Errorf("Got wrong error; wanted '%s', but got '%s'", bad.v, err)
		}
	}
}
