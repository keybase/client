// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"net/url"
	"strconv"
)

type HTTPValue interface {
	String() string
}

type HTTPArgs map[string]HTTPValue

type S struct {
	Val string
}

func HexArg(b []byte) S {
	return S{Val: hex.EncodeToString(b)}
}

func B64Arg(b []byte) S {
	return S{Val: base64.StdEncoding.EncodeToString(b)}
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

func (a *HTTPArgs) Add(s string, v HTTPValue) {
	(*a)[s] = v
}

func NewHTTPArgs() HTTPArgs {
	return make(HTTPArgs)
}

func (s S) String() string    { return s.Val }
func (i I) String() string    { return strconv.Itoa(i.Val) }
func (u U) String() string    { return strconv.FormatUint(u.Val, 10) }
func (h UHex) String() string { return fmt.Sprintf("%016x", h.Val) }
func (b B) String() string {
	if b.Val {
		return "1"
	}
	return "0"
}

func (a HTTPArgs) ToValues() url.Values {
	ret := url.Values{}
	for k, v := range a {
		ret.Set(k, v.String())
	}
	return ret
}

func (a HTTPArgs) EncodeToString() string {
	return a.ToValues().Encode()
}

func HTTPArgsFromKeyValuePair(key string, val HTTPValue) HTTPArgs {
	ret := HTTPArgs{}
	ret[key] = val
	return ret
}
