
package libkbgo

import (
	"regexp"
	"fmt"
)

var empty_string []byte = []byte{}

const (
	NONE = iota
	OR = iota
	AND = iota
	LPAREN = iota
	RPAREN = iota
	URL = iota
	EOF = iota
	ERROR = iota
)

type Token struct {
	Typ int
	value []byte
}

func (t Token) getString() string {
	return string(t.value)
}

func byteArrayEq(a1, a2 []byte) bool {
	if len(a1) != len(a2) {
		return false;
	}
	for i,c := range(a1) {
		if c != a2[i] {
			return false;
		}	
	}
	return true;
}

func (t Token) Eq(t2 Token) bool {
	return (t.Typ == t2.Typ) && byteArrayEq(t.value, t2.value)	
}

func NewToken(typ int) (* Token) {
	return &Token { typ, empty_string }	
}

type Lexer struct {
	buffer []byte
	last *Token
	putback bool
	re *regexp.Regexp
	wss *regexp.Regexp
}

func NewLexer(s string) (* Lexer) {
	re := regexp.MustCompile(`^(\|\|)|(\&\&)|(\()|(\))|([^ \n\t&|()]+)`)
	wss := regexp.MustCompile(`^([\n\t ]+)`)
	l := &Lexer {[]byte(s), nil, false, re, wss};
	l.stripBuffer()
	return l;
}

func (lx *Lexer) stripBuffer() {
	if len(lx.buffer) > 0 {
		if match := lx.wss.FindSubmatchIndex(lx.buffer); match != nil {
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

func (lx *Lexer) Get() (* Token) {
	var ret *Token
	if lx.putback {
		ret = lx.last
		lx.putback = false
	} else if len(lx.buffer) == 0 {
		ret = NewToken(EOF)
	} else if match := lx.re.FindSubmatchIndex(lx.buffer); match != nil {
		i := OR
		for ; i <= URL; i++ {
			if match[i*2] >= 0 {
				ret = &Token { i, lx.buffer[match[2*i]:match[2*i+1]] }
				lx.advanceBuffer(match[2*i+1])
				break
			}
		}	
	} else {
		lx.buffer = empty_string
		ret = NewToken(ERROR)
	}
	lx.last = ret
	return ret
}

type AssertionExpression interface {

}

type AssertionOr struct {
	terms []AssertionExpression
}

type AssertionAnd struct {
	factors []AssertionExpression
}

type AssertionUrl struct {
	Value string
}

type Parser struct {
	lexer *Lexer
	err error
}

func NewAssertionAnd(left,right AssertionExpression) AssertionAnd {
	factors := []AssertionExpression{ left, right }
	return AssertionAnd { factors }	
}

func NewAssertionOr(left,right AssertionExpression) AssertionOr {
	terms := []AssertionExpression{ left, right }
	return AssertionOr { terms }	
}

func (p *Parser) Parse() AssertionExpression {
	return p.parseExpression()
}

func (p *Parser) parseTerm() AssertionExpression {
	return nil	
}
func (p *Parser) parseFactor() AssertionExpression {
	return nil	
}

func (p *Parser) parseExpression() AssertionExpression {
	tok := p.lexer.Get()
	var ret AssertionExpression
	switch tok.Typ {
		case LPAREN:
			ret = p.parseExpression()
			if tok = p.lexer.Get(); tok.Typ != RPAREN {
				p.err = fmt.Errorf("Unbalanced parentheses")
				ret = nil;
			}
		case URL:
			url := AssertionUrl { tok.getString() }
			nxt := p.lexer.Get()
			switch nxt.Typ {
				case EOF:
					ret = url;
				case AND:	
					right := p.parseFactor()
					ret = NewAssertionAnd(url,right)
				case OR:
					right := p.parseTerm()
					ret = NewAssertionOr(url,right)
				default:
					p.err = fmt.Errorf("Unexpected token: %s", nxt.getString())
			}
	}
	return ret
}
