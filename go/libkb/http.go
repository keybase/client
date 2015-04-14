package libkb

import (
	"fmt"
	"net/url"
	"strconv"
)

type HttpValue interface {
	String() string
}

type HttpArgs map[string]HttpValue

type S struct {
	Val string
}

type I struct {
	Val int
}

type U struct {
	Val uint64
}

type UHex struct {
	Val uint64
}

type B struct {
	Val bool
}

func (a *HttpArgs) Add(s string, v HttpValue) {
	(*a)[s] = v
}

func NewHttpArgs() HttpArgs {
	return make(HttpArgs)
}

func (s S) String() string    { return s.Val }
func (i I) String() string    { return strconv.Itoa(i.Val) }
func (u U) String() string    { return strconv.FormatUint(u.Val, 10) }
func (h UHex) String() string { return fmt.Sprintf("%16x", h.Val) }
func (b B) String() string {
	if b.Val {
		return "1"
	}
	return "0"
}

func (a HttpArgs) ToValues() url.Values {
	ret := url.Values{}
	for k, v := range a {
		ret.Set(k, v.String())
	}
	return ret
}

func (a HttpArgs) EncodeToString() string {
	return a.ToValues().Encode()
}

func HttpArgsFromKeyValuePair(key string, val HttpValue) HttpArgs {
	ret := HttpArgs{}
	ret[key] = val
	return ret
}
