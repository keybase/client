// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func testLexer(t *testing.T, name string, s string, expected []Token) {
	lexer := NewLexer(s)
	i := 0
	for {
		tok := lexer.Get()
		if i >= len(expected) {
			t.Errorf("%s, unexpected token %d [T%v: '%v']", name, i, tok.Typ, string(tok.value))
			break
		}
		if !tok.Eq(expected[i]) {
			t.Errorf("%s, token %d: [T%v: '%v'] != [T%v: '%v']",
				name, i, tok.Typ, string(tok.value), expected[i].Typ, string(expected[i].value))
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

func TestLexer3(t *testing.T) {
	s := "aa && |bb"
	expected := []Token{
		{URL, []byte("aa")},
		{AND, []byte("&&")},
		{ERROR, []byte("|bb")},
		{EOF, []byte{}},
	}
	testLexer(t, "test3", s, expected)
}

func TestLexerSquareBrackets(t *testing.T) {
	s := "michal,[michal@zapu.net]@email"
	expected := []Token{
		{URL, []byte("michal")},
		{OR, []byte(",")},
		{URL, []byte("[michal@zapu.net]@email")},
		{EOF, []byte{}},
	}
	testLexer(t, "square brackets", s, expected)
}

func TestLexerEmailInvalidParentheses(t *testing.T) {
	// Rejected proposal for round brackets, but make sure
	// there is expected way in which it is parsed.

	s := "michal,(michal@zapu.net)@email"
	expected := []Token{
		{URL, []byte("michal")},
		{OR, []byte(",")},
		{LPAREN, []byte("(")},
		{URL, []byte("michal@zapu.net")},
		{RPAREN, []byte(")")},
		{URL, []byte("@email")},
		{EOF, []byte{}},
	}
	testLexer(t, "round brackets", s, expected)

	s = "twitter://alice&&(alice@keybasers.de)@email"
	expected = []Token{
		{URL, []byte("twitter://alice")},
		{AND, []byte("&&")},
		{LPAREN, []byte("(")},
		{URL, []byte("alice@keybasers.de")},
		{RPAREN, []byte(")")},
		{URL, []byte("@email")},
		{EOF, []byte{}},
	}
	testLexer(t, "round brackets", s, expected)
}

func TestLexerEmailPlusSign(t *testing.T) {
	s := "twitter://alice&&[a.li.c+e@keybasers.de]@email"
	expected := []Token{
		{URL, []byte("twitter://alice")},
		{AND, []byte("&&")},
		{URL, []byte("[a.li.c+e@keybasers.de]@email")},
		{EOF, []byte{}},
	}
	testLexer(t, "square brackets 1", s, expected)

	s = "alice@twitter||email:[a.li.c+e@keybasers.de]"
	expected = []Token{
		{URL, []byte("alice@twitter")},
		{OR, []byte("||")},
		{URL, []byte("email:[a.li.c+e@keybasers.de]")},
		{EOF, []byte{}},
	}
	testLexer(t, "square brackets 2", s, expected)

	s = "alice@twitter||email://[a.li.c+e@keybasers.de]"
	expected = []Token{
		{URL, []byte("alice@twitter")},
		{OR, []byte("||")},
		{URL, []byte("email://[a.li.c+e@keybasers.de]")},
		{EOF, []byte{}},
	}
	testLexer(t, "square brackets 3", s, expected)

	// This is not a valid email, but not caught at the lexer stage,
	// it's still supposed to generate URL token.
	s = "twitter:ae,email:[a,e@keybasers.de]"
	expected = []Token{
		{URL, []byte("twitter:ae")},
		{OR, []byte(",")},
		{URL, []byte("email:[a,e@keybasers.de]")},
		{EOF, []byte{}},
	}
	testLexer(t, "square brackets 4", s, expected)

	// Same here:
	s = "email:[],email://[]"
	expected = []Token{
		{URL, []byte("email:[]")},
		{OR, []byte(",")},
		{URL, []byte("email://[]")},
		{EOF, []byte{}},
	}
	testLexer(t, "square brackets 5", s, expected)

	// Weirdness
	s = "[michal]@[keybase]"
	expected = []Token{
		{URL, []byte("[michal]@")},
		{ERROR, []byte("[keybase]")},
		{EOF, []byte{}},
	}
	testLexer(t, "square brackets 6", s, expected)
}

func TestParser1(t *testing.T) {
	inp := "  aa ||   bb   && cc ||\n dd ||\n ee && ff || gg && (hh ||\nii)"
	outp := "aa,bb+cc,dd,ee+ff,gg+(hh,ii)"
	expr, err := AssertionParse(testAssertionContext{}, inp)
	if err != nil {
		t.Error(err)
	} else if expr.String() != outp {
		t.Errorf("Wrong parse result: %s v %s", expr.String(), outp)
	}
}

func TestParser2(t *testing.T) {
	inp := "  web://a.aa ||   http://b.bb   && dns://c.cc ||\n dd ||\n pgp:ee && reddit:foo || twitter:goo && (https:h.in ||\ndns:i.co)"
	outp := "a.aa@web,b.bb@http+c.cc@dns,dd,ee@pgp+foo@reddit,goo@twitter+(h.in@https,i.co@dns)"
	expr, err := AssertionParse(testAssertionContext{}, inp)
	if err != nil {
		t.Error(err)
	} else if expr.String() != outp {
		t.Errorf("Wrong parse result: %s v %s", expr.String(), outp)
	}
}

func TestNormalization(t *testing.T) {
	// Test moved to externals/ since it requires knowledge of social networks
}

type Pair struct {
	k, v string
}

func TestParserFail1(t *testing.T) {
	bads := []Pair{
		{"aa ||", "Unexpected EOF parsing assertion"},
		{"aa &&", "Unexpected EOF parsing assertion"},
		{"(aa", "Unbalanced parentheses"},
		{"aa && dns:", "Bad assertion, no value given (key=dns)"},
		{"&& aa", "Unexpected token: &&"},
		{"|| aa", "Unexpected token: ||"},
		{"aa)", "Found junk at end of input: )"},
		{"()", "Illegal parenthetical expression"},
		{"a@pgp", "bad hex string: 'a'"},
		{"aBCP@pgp", "bad hex string: 'abcp'"},
		{"jj@pgp", "bad hex string: 'jj'"},
		{"aa && |bb", "Syntax error when parsing: |bb"},
	}

	for _, bad := range bads {
		expr, err := AssertionParse(testAssertionContext{}, bad.k)
		if err == nil {
			t.Errorf("Expected a parse error in %s (got %v)", bad, expr)
		} else if err.Error() != bad.v {
			t.Errorf("Got wrong error; wanted '%s', but got '%s'", bad.v, err)
		}
	}
}

func TestParseAssertionsWithReaders(t *testing.T) {
	units := []struct {
		input   string
		writers string // expected writers (reserialized and comma-sep)
		readers string // expected readers
		error   string // expected error regex
	}{
		{
			input:   "alice,bob&&bob@twitter",
			writers: "alice,bob+bob@twitter",
		},
		{
			input:   "alice,bob&&bob@twitter#char",
			writers: "alice,bob+bob@twitter",
			readers: "char",
		},
		{
			input:   "alice#char,liz",
			writers: "alice",
			readers: "char,liz",
		},
		{
			input:   "alice",
			writers: "alice",
		},
		{
			// doesn't dedup at the moment
			input:   "alice#alice",
			writers: "alice",
			readers: "alice",
		},
		{
			input:   "alice+github:alice",
			writers: "alice+alice@github",
		},
		{
			input:   "1f5DE74F4D4E8884775F2BF1514FC07220D4A61A@pgp,milessteele.com@https",
			writers: "1f5de74f4d4e8884775f2bf1514fc07220d4a61a@pgp,milessteele.com@https",
		},
		{
			input: "",
			error: `^empty assertion$`,
		},
		{
			input: "#char,liz",
			error: `.*`,
		},
		{
			input: "char||liz",
			error: `disallowed.*OR`,
		},
	}

	ser := func(exprs []AssertionExpression) string {
		var strs []string
		for _, expr := range exprs {
			strs = append(strs, expr.String())
		}
		return strings.Join(strs, ",")
	}

	for i, unit := range units {
		t.Logf("%v: %v", i, unit.input)
		writers, readers, err := ParseAssertionsWithReaders(testAssertionContext{}, unit.input)
		if len(unit.error) == 0 {
			require.NoError(t, err)
			require.Equal(t, unit.writers, ser(writers))
			require.Equal(t, unit.readers, ser(readers))
		} else {
			require.Error(t, err)
			require.Regexp(t, unit.error, err.Error())
		}
	}
}
