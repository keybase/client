// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"fmt"
	"regexp"
	"strings"
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
	case ERROR:
		return NewAssertionParseError("Unexpected ERROR: (%v)", t.getString())
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

func NewToken(typ int) Token {
	return Token{Typ: typ}
}

type Lexer struct {
	buffer  []byte
	last    Token
	putback bool
}

// Disjunction: '||' ','
// Conjunction: '&&' '+'
// Parens: '(' ')'
// URL: Characters except for ' \n\t&|(),+'
var lexerItemRxx = regexp.MustCompile(`^((\|\|)|(\,)|(\&\&)|(\+)|(\()|(\))|([^ \n\t&|(),+]+))`)
var lexerWhitespaceRxx = regexp.MustCompile(`^([\n\t ]+)`)

func NewLexer(s string) *Lexer {
	l := &Lexer{buffer: []byte(s)}
	l.stripBuffer()
	return l
}

// strip whitespace off the front
func (lx *Lexer) stripBuffer() {
	if len(lx.buffer) > 0 {
		if match := lexerWhitespaceRxx.FindSubmatchIndex(lx.buffer); match != nil {
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

func (lx *Lexer) Get() Token {
	var ret Token
	if lx.putback {
		ret = lx.last
		lx.putback = false
	} else if len(lx.buffer) == 0 {
		ret = NewToken(EOF)
	} else if match := lexerItemRxx.FindSubmatchIndex(lx.buffer); match != nil {
		// first 2 in seq are NONE: one for the full expr, another for the outer ^() group
		seq := []int{NONE, NONE, OR, OR, AND, AND, LPAREN, RPAREN, URL}
		for i := 2; i <= len(seq); i++ {
			if match[i*2] >= 0 {
				ret = Token{Typ: seq[i], value: lx.buffer[match[2*i]:match[2*i+1]]}
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

func NewAssertionOr(left, right AssertionExpression, symbol string) AssertionOr {
	terms := []AssertionExpression{left, right}
	return AssertionOr{
		terms:  terms,
		symbol: symbol,
	}
}

func NewAssertionKeybaseUsername(username string) AssertionKeybase {
	return AssertionKeybase{AssertionURLBase: AssertionURLBase{Key: "keybase", Value: username}}
}

func (p *Parser) Parse(ctx AssertionContext) AssertionExpression {
	ret := p.parseExpr(ctx)
	if ret != nil {
		tok := p.lexer.Get()
		switch tok.Typ {
		case EOF:
			// expected
		case ERROR:
			p.err = NewAssertionParseError("Found error at end of input (%s)",
				tok.value)
			ret = nil
		default:
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
		ret = NewAssertionOr(term, ex, string(tok.value))
	}
	return ret
}

func AssertionParse(ctx AssertionContext, s string) (AssertionExpression, error) {
	lexer := NewLexer(s)
	parser := Parser{
		lexer:   lexer,
		err:     nil,
		andOnly: false,
	}
	ret := parser.Parse(ctx)
	return ret, parser.err
}

func AssertionParseAndOnly(ctx AssertionContext, s string) (AssertionExpression, error) {
	lexer := NewLexer(s)
	parser := Parser{
		lexer:   lexer,
		err:     nil,
		andOnly: true,
	}
	ret := parser.Parse(ctx)
	return ret, parser.err
}

// Parse an assertion list like "alice,bob&&bob@twitter#char"
// OR nodes are not allowed (asides from the commas)
func ParseAssertionsWithReaders(ctx AssertionContext, assertions string) (writers, readers []AssertionExpression, err error) {
	if len(assertions) == 0 {
		return writers, readers, fmt.Errorf("empty assertion")
	}

	split := strings.Split(assertions, "#")
	if len(split) > 2 {
		return writers, readers, fmt.Errorf("too many reader divisions ('#') in assertions: %v", assertions)
	}

	writers, err = ParseAssertionList(ctx, split[0])
	if err != nil {
		return writers, readers, err
	}

	if len(split) >= 2 && len(split[1]) > 0 {
		readers, err = ParseAssertionList(ctx, split[1])
		if err != nil {
			return writers, readers, err
		}
	}
	return writers, readers, nil
}

// Parse a string into one or more assertions. Only AND assertions are allowed within each part.
// like "alice,bob&&bob@twitter"
func ParseAssertionList(ctx AssertionContext, assertionsStr string) (res []AssertionExpression, err error) {
	expr, err := AssertionParse(ctx, assertionsStr)
	if err != nil {
		return res, err
	}
	return unpackAssertionList(expr)
}

// Unpack an assertion with one or more comma-separated parts. Only AND assertions are allowed within each part.
func unpackAssertionList(expr AssertionExpression) (res []AssertionExpression, err error) {
	switch expr := expr.(type) {
	case AssertionOr:
		// List (or recursive tree) of comma-separated items.

		if expr.symbol != "," {
			// Don't allow "||". That would be confusing.
			return res, fmt.Errorf("disallowed OR expression: '%v'", expr.symbol)
		}
		for _, sub := range expr.terms {
			// Recurse because "a,b,c" could look like (OR a (OR b c))
			sublist, err := unpackAssertionList(sub)
			if err != nil {
				return res, err
			}
			res = append(res, sublist...)
		}
		return res, nil
	default:
		// Just one item.
		err = checkAssertionListItem(expr)
		return []AssertionExpression{expr}, err
	}
}

// A single item in a comma-separated assertion list must not have any ORs in its subtree.
func checkAssertionListItem(expr AssertionExpression) error {
	if expr.HasOr() {
		return fmt.Errorf("assertions with OR are not allowed here")
	}
	switch expr.(type) {
	case AssertionOr:
		// this should never happen
		return fmt.Errorf("assertion parse fault: unexpected OR")
	}
	// Anything else is allowed.
	return nil
}
