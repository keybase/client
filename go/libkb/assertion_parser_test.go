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
	inp := "  a ||   b   && c ||\n d ||\n e && f || g && (h ||\ni)"
	outp := "(keybase://a || ((keybase://b && keybase://c) || (keybase://d || ((keybase://e && keybase://f) || (keybase://g && (keybase://h || keybase://i))))))"
	expr, err := AssertionParse(inp)
	if err != nil {
		t.Error(err)
	} else if expr.String() != outp {
		t.Errorf("Wrong parse result: %s v %s", expr.String(), outp)
	}
}

func TestParser2(t *testing.T) {
	inp := "  web://a.aa ||   http://b.bb   && dns://c.cc ||\n d ||\n fingerprint:e && reddit:f || twitter:g && (https:h.in ||\ndns:i.co)"
	outp := "(web://a.aa || ((http://b.bb && dns://c.cc) || (keybase://d || ((fingerprint://e && reddit://f) || (twitter://g && (https://h.in || dns://i.co))))))"
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
		{"a ||", "Unexpected EOF"},
		{"a &&", "Unexpected EOF"},
		{"(a", "Unbalanced parentheses"},
		{"a && dns:", "Bad assertion, no value given (key=dns)"},
		{"b && foo:a", "Unknown social network: foo"},
		{"&& a", "Unexpected token: &&"},
		{"|| a", "Unexpected token: ||"},
		{"a)", "Found junk at end of input: )"},
		{"()", "Illegal parenthetical expression"},
		{"dns://a", "Invalid hostname: a"},
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
