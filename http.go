
package libkb

import (
	"net/url"
	"fmt"
)

type HttpArgs map[string]U

type U struct {
	S string
	I int
}

func (u U) ToString() string {
	if len(u.S) > 0 { 
		return u.S 
	} else { 
		return fmt.Sprintf("%d", u.I) 
	}
}

func (a HttpArgs) ToValues() url.Values {
	ret := url.Values{}
	for k,v := range(a) {
		ret.Set(k, v.ToString())
	}
	return ret
}
