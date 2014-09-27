
package libkbgo

import (
//	"regexp"
)

type Lexer struct {
	buffer string
	putback *string 
}

func NewLexer(s string) (* Lexer) {
	l := &Lexer {s, nil };
	return l;
}

