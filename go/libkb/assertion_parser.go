// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"regexp"
)

const (
	NONE = iota
	OR
	AND
	LPAREN
	RPAREN
	URL
	EOF
	ERROR
)

type Token struct {
	Typ   int
	value []byte
}

func (t Token) getString() string {
	return string(t.value)
}

func (t Token) unexpectedError() error {
	switch t.Typ {
	case EOF:
		return NewAssertionParseError("Unexpected EOF")
	default:
		return NewAssertionParseError("Unexpected token: %s", t.getString())
	}
}

func byteArrayEq(a1, a2 []byte) bool {
	if len(a1) != len(a2) {
		return false
	}
	for i, c := range a1 {
		if c != a2[i] {
			return false
		}
	}
	return true
}

func (t Token) Eq(t2 Token) bool {
	return (t.Typ == t2.Typ) && byteArrayEq(t.value, t2.value)
}

func NewToken(typ int) *Token {
	return &Token{Typ: typ}
}

type Lexer struct {
	buffer  []byte
	last    *Token
	putback bool
}

// We're allowing '||' or ',' for disjunction
// We're allowing '&&' or '+' for conjunction
var re = regexp.MustCompile(`^(\|\|)|(\,)|(\&\&)|(\+)|(\()|(\))|([^ \n\t&|(),+]+)`)
var wss = regexp.MustCompile(`^([\n\t ]+)`)

func NewLexer(s string) *Lexer {
	l := &Lexer{buffer: []byte(s)}
	l.stripBuffer()
	return l
}

func (lx *Lexer) stripBuffer() {
	if len(lx.buffer) > 0 {
		if match := wss.FindSubmatchIndex(lx.buffer); match != nil {
			lx.buffer = lx.buffer[match[3]:]
		}
	}
}

func (lx *Lexer) advanceBuffer(i int) {
	lx.buffer = lx.buffer[i:]
	lx.stripBuffer()
}

func (lx *Lexer) Putback() {
	lx.putback = true
}

func (lx *Lexer) Get() *Token {
	var ret *Token
	if lx.putback {
		ret = lx.last
		lx.putback = false
	} else if len(lx.buffer) == 0 {
		ret = NewToken(EOF)
	} else if match := re.FindSubmatchIndex(lx.buffer); match != nil {
		seq := []int{NONE, OR, OR, AND, AND, LPAREN, RPAREN, URL}
		for i := 1; i <= len(seq); i++ {
			if match[i*2] >= 0 {
				ret = &Token{seq[i], lx.buffer[match[2*i]:match[2*i+1]]}
				lx.advanceBuffer(match[2*i+1])
				break
			}
		}
	} else {
		lx.buffer = nil
		ret = NewToken(ERROR)
	}
	lx.last = ret
	return ret
}

type Parser struct {
	lexer   *Lexer
	err     error
	andOnly bool
}

func NewParser(lexer *Lexer) *Parser {
	ret := &Parser{lexer, nil, false}
	return ret
}

func NewAssertionAnd(left, right AssertionExpression) AssertionAnd {
	factors := []AssertionExpression{left, right}
	return AssertionAnd{factors}
}

func NewAssertionOr(left, right AssertionExpression) AssertionOr {
	terms := []AssertionExpression{left, right}
	return AssertionOr{terms}
}

func (p *Parser) Parse(ctx AssertionContext) AssertionExpression {
	ret := p.parseExpr(ctx)
	if ret != nil {
		tok := p.lexer.Get()
		if tok.Typ != EOF {
			p.err = NewAssertionParseError("Found junk at end of input: %s",
				tok.value)
			ret = nil
		}
	}
	return ret
}

func (p *Parser) parseTerm(ctx AssertionContext) (ret AssertionExpression) {
	factor := p.parseFactor(ctx)
	tok := p.lexer.Get()
	if tok.Typ == AND {
		term := p.parseTerm(ctx)
		ret = NewAssertionAnd(factor, term)
	} else {
		ret = factor
		p.lexer.Putback()
	}
	return ret
}

func (p *Parser) parseFactor(ctx AssertionContext) (ret AssertionExpression) {
	tok := p.lexer.Get()
	switch tok.Typ {
	case URL:
		url, err := ParseAssertionURL(ctx, tok.getString(), false)
		if err != nil {
			p.err = err
		} else {
			ret = url
		}
	case LPAREN:
		if ex := p.parseExpr(ctx); ex == nil {
			ret = nil
			p.err = NewAssertionParseError("Illegal parenthetical expression")
		} else {
			tok = p.lexer.Get()
			if tok.Typ == RPAREN {
				ret = ex
			} else {
				ret = nil
				p.err = NewAssertionParseError("Unbalanced parentheses")
			}
		}
	default:
		p.err = tok.unexpectedError()
	}
	return ret
}

func (p *Parser) parseExpr(ctx AssertionContext) (ret AssertionExpression) {
	term := p.parseTerm(ctx)
	tok := p.lexer.Get()
	if tok.Typ != OR {
		ret = term
		p.lexer.Putback()
	} else if p.andOnly {
		p.err = NewAssertionParseError("Unexpected 'OR' operator")
	} else {
		ex := p.parseExpr(ctx)
		ret = NewAssertionOr(term, ex)
	}
	return ret
}

func AssertionParse(ctx AssertionContext, s string) (AssertionExpression, error) {
	lexer := NewLexer(s)
	parser := Parser{lexer, nil, false}
	ret := parser.Parse(ctx)
	return ret, parser.err
}

func AssertionParseAndOnly(ctx AssertionContext, s string) (AssertionExpression, error) {
	lexer := NewLexer(s)
	parser := Parser{lexer, nil, true}
	ret := parser.Parse(ctx)
	return ret, parser.err
}
