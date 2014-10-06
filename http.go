package libkb

import (
	"fmt"
	"net/url"
)

type HttpArgs map[string]U

type U struct {
	S string
	B bool
	I int
}

func (u U) ToString() string {
	if len(u.S) > 0 {
		return u.S
	} else if u.B {
		return "1"
	} else {
		return fmt.Sprintf("%d", u.I)
	}
}

func (a HttpArgs) ToValues() url.Values {
	ret := url.Values{}
	for k, v := range a {
		ret.Set(k, v.ToString())
	}
	return ret
}
