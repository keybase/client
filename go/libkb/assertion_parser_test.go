// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"testing"
)

func testLexer(t *testing.T, name string, s string, expected []Token) {
	lexer := NewLexer(s)
	i := 0
	for {
		tok := lexer.Get()
		if !tok.Eq(expected[i]) {
			t.Errorf("%s, token %d: %v != %v", name, i, tok, expected[i])
		}
		if tok.Typ == EOF {
			break
		}
		i++
	}
}

func TestLexer1(t *testing.T) {
	s := "http://foo.com && http://bar.com"
	expected := []Token{
		{URL, []byte("http://foo.com")},
		{AND, []byte("&&")},
		{URL, []byte("http://bar.com")},
		{EOF, []byte{}},
	}
	testLexer(t, "test1", s, expected)
}

func TestLexer2(t *testing.T) {
	s := "   (   a    && b          ) || (  c && d && e )   "
	expected := []Token{
		{LPAREN, []byte("(")},
		{URL, []byte("a")},
		{AND, []byte("&&")},
		{URL, []byte("b")},
		{RPAREN, []byte(")")},
		{OR, []byte("||")},
		{LPAREN, []byte("(")},
		{URL, []byte("c")},
		{AND, []byte("&&")},
		{URL, []byte("d")},
		{AND, []byte("&&")},
		{URL, []byte("e")},
		{RPAREN, []byte(")")},
		{EOF, []byte{}},
	}
	testLexer(t, "test2", s, expected)
}

func TestParser1(t *testing.T) {
	inp := "  aa ||   bb   && cc ||\n dd ||\n ee && ff || gg && (hh ||\nii)"
	outp := "aa,bb+cc,dd,ee+ff,gg+(hh,ii)"
	expr, err := AssertionParse(inp)
	if err != nil {
		t.Error(err)
	} else if expr.String() != outp {
		t.Errorf("Wrong parse result: %s v %s", expr.String(), outp)
	}
}

func TestParser2(t *testing.T) {
	inp := "  web://a.aa ||   http://b.bb   && dns://c.cc ||\n dd ||\n pgp:ee && reddit:foo || twitter:goo && (https:h.in ||\ndns:i.co)"
	outp := "a.aa@web,b.bb@http+c.cc@dns,dd,ee@pgp+foo@reddit,goo@twitter+(h.in@https,i.co@dns)"
	expr, err := AssertionParse(inp)
	if err != nil {
		t.Error(err)
	} else if expr.String() != outp {
		t.Errorf("Wrong parse result: %s v %s", expr.String(), outp)
	}
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
