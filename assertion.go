
package libkbgo

import (
	"fmt"
	"strings"
)

type AssertionExpression interface {
	ToString() string
}

type AssertionOr struct {
	terms []AssertionExpression
}

func (a AssertionOr) ToString() string {
	v := make([]string, len(a.terms))
	for i,t := range a.terms {
		v[i] = t.ToString()
	}
	return fmt.Sprintf("(%s)", strings.Join(v, " || " ))
}

type AssertionAnd struct {
	factors []AssertionExpression
}

func (a AssertionAnd) ToString() string {
	v := make([]string, len(a.factors))
	for i,f := range a.factors {
		v[i] = f.ToString()
	}
	return fmt.Sprintf("(%s)", strings.Join(v, " && " ))
}

type AssertionUrl interface {
	Keys() []string
	Check() error
	IsKeybase() bool
	ToString() string
}

type AssertionUrlBase struct {
	Key,Value string
}

type AssertionKeybase struct {
	AssertionUrlBase	
}

func (a AssertionUrlBase) Check() (err error) {
	if len(a.Value) == 0 {
		err = fmt.Errorf("Bad assertion, no value given")
	}
	return err
}

func (a AssertionUrlBase) Keys() []string {
	return []string { a.Key }
}

func (a AssertionUrlBase) IsKeybase() bool {
	return false;
}

func (a AssertionUrlBase) ToString() string {
	return fmt.Sprintf("%s://%s", a.Key, a.Value)	
}

func parseToKVPair(s string) (key string, value string) {
	colon := strings.IndexByte(s,byte(':'))
	if colon < 0 {
		value = s
	} else {
		key = s[0:colon]
		value := s[(colon+1):]
		if len(value) >= 2 && value[0:2] == "//" {
			value = value[2:]
		}
	}
	key = strings.ToLower(key)
	value = strings.ToLower(value)
	return
}

func ParseAssertionUrl(s string, strict bool) (ret AssertionUrl, err error) {
	key,value := parseToKVPair(s)

	if len(key) == 0 {
		if strict {
			err = fmt.Errorf("Bad assertion, no 'type' given: %s", s)
		} else {
			key = "keybase"
		}
	}

	switch key {
		case "keybase": 
			ret = ParseAssertionKeybase(key,value)
		default : 
			ret = ParseAssertionSocial(key,value)
	}


	return
}