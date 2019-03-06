// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"golang.org/x/net/context"
	"io"
	"net/http"
)

type NullMockAPI struct{}

var _ API = (*NullMockAPI)(nil)

func (n *NullMockAPI) Get(MetaContext, APIArg) (*APIRes, error)                       { return nil, nil }
func (n *NullMockAPI) GetDecode(MetaContext, APIArg, APIResponseWrapper) error        { return nil }
func (n *NullMockAPI) GetDecodeCtx(context.Context, APIArg, APIResponseWrapper) error { return nil }
func (n *NullMockAPI) GetResp(MetaContext, APIArg) (*http.Response, func(), error) {
	return nil, noopFinisher, nil
}
func (n *NullMockAPI) Post(APIArg) (*APIRes, error)                       { return nil, nil }
func (n *NullMockAPI) PostJSON(APIArg) (*APIRes, error)                   { return nil, nil }
func (n *NullMockAPI) PostDecode(APIArg, APIResponseWrapper) error        { return nil }
func (n *NullMockAPI) PostRaw(APIArg, string, io.Reader) (*APIRes, error) { return nil, nil }
func (n *NullMockAPI) Delete(APIArg) (*APIRes, error)                     { return nil, nil }

type APIArgRecorder struct {
	*NullMockAPI
	Args []APIArg
}

func NewAPIArgRecorder() *APIArgRecorder {
	return &APIArgRecorder{NullMockAPI: &NullMockAPI{}}
}

func (a *APIArgRecorder) Post(arg APIArg) (*APIRes, error) {
	a.Args = append(a.Args, arg)
	return nil, nil
}

func (a *APIArgRecorder) Reset() {
	a.Args = nil
}
