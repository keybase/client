
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

type AssertionUrl struct {
	Value string
}

func (a AssertionUrl) ToString() string {
	return a.Value	
}

