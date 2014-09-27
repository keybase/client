
package libkbgo

import (
	"regexp"
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

func NewToken(typ int) (* Token) {
	return &Token { typ, empty_string }	
}

type Lexer struct {
	buffer []byte
	putback *Token
	re *regexp.Regexp
	wss *regexp.Regexp
}

func NewLexer(s string) (* Lexer) {
	re := regexp.MustCompile(`^(\|\|)|(\&\&)|(\()|(\))|([^ \n\t&|()]+)`)
	wss := regexp.MustCompile(`^([\n\t ]+)`)
	l := &Lexer {[]byte(s), nil, re, wss};
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

func (lx *Lexer) Get() (* Token) {
	var ret *Token
	if lx.putback != nil {
		ret = lx.putback
		lx.putback = nil
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
	return ret
}

