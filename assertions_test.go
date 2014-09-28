
package libkbgo

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

func TestLexer1 (t *testing.T) {
	s := "http://foo.com && http://bar.com"
	expected := []Token{
		{URL, []byte("http://foo.com") },
		{AND, []byte("&&") },
		{URL, []byte("http://bar.com") },
		{EOF, []byte{} },
	}
	testLexer(t, "test1", s, expected)
}

func TestLexer2 (t *testing.T) {
	s := "   (   a    && b          ) || (  c && d && e )   "
	expected := []Token{
		{LPAREN, []byte("(") },
		{URL, []byte("a") },
		{AND, []byte("&&") },
		{URL, []byte("b") },
		{RPAREN, []byte(")") },
		{OR, []byte("||") },
		{LPAREN, []byte("(") },
		{URL, []byte("c") },
		{AND, []byte("&&") },
		{URL, []byte("d") },
		{AND, []byte("&&") },
		{URL, []byte("e") },
		{RPAREN, []byte(")") },
		{EOF, []byte{} },
	}
	testLexer(t, "test2", s, expected)
}

func TestParser(t *testing.T) {
	s := "  a ||   b   && c ||\n d ||\n e && f || g && (h ||\ni)"
	expr, err := AssertionParse(s)
	if err != nil {
		t.Errorf(err.Error());
	} else if expr.ToString() != "(a || ((b && c) || (d || ((e && f) || (g && (h || i))))))" {
		t.Errorf("Wrong parse result: %s", s)
	}
}