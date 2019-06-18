// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"errors"
	"io"
	"net/http"

	"golang.org/x/net/context"
)

type NullMockAPI struct{}

var _ API = (*NullMockAPI)(nil)

func (n *NullMockAPI) Get(MetaContext, APIArg) (*APIRes, error)                       { return nil, nil }
func (n *NullMockAPI) GetDecode(MetaContext, APIArg, APIResponseWrapper) error        { return nil }
func (n *NullMockAPI) GetDecodeCtx(context.Context, APIArg, APIResponseWrapper) error { return nil }
func (n *NullMockAPI) GetResp(MetaContext, APIArg) (*http.Response, func(), error) {
	return nil, noopFinisher, nil
}
func (n *NullMockAPI) Post(MetaContext, APIArg) (*APIRes, error)                       { return nil, nil }
func (n *NullMockAPI) PostJSON(MetaContext, APIArg) (*APIRes, error)                   { return nil, nil }
func (n *NullMockAPI) PostDecode(MetaContext, APIArg, APIResponseWrapper) error        { return nil }
func (n *NullMockAPI) PostDecodeCtx(context.Context, APIArg, APIResponseWrapper) error { return nil }
func (n *NullMockAPI) PostRaw(MetaContext, APIArg, string, io.Reader) (*APIRes, error) {
	return nil, nil
}
func (n *NullMockAPI) Delete(MetaContext, APIArg) (*APIRes, error) { return nil, nil }

type APIArgRecorder struct {
	*NullMockAPI
	Args []APIArg
}

func NewAPIArgRecorder() *APIArgRecorder {
	return &APIArgRecorder{NullMockAPI: &NullMockAPI{}}
}

func (a *APIArgRecorder) Post(mctx MetaContext, arg APIArg) (*APIRes, error) {
	a.Args = append(a.Args, arg)
	return nil, nil
}

func (a *APIArgRecorder) Reset() {
	a.Args = nil
}

type ErrorMockAPI struct{}

var _ API = (*ErrorMockAPI)(nil)

var ErrFromMockAPI = errors.New("ErrorMockAPI error")

func (n *ErrorMockAPI) Get(MetaContext, APIArg) (*APIRes, error)                { return nil, ErrFromMockAPI }
func (n *ErrorMockAPI) GetDecode(MetaContext, APIArg, APIResponseWrapper) error { return ErrFromMockAPI }
func (n *ErrorMockAPI) GetDecodeCtx(context.Context, APIArg, APIResponseWrapper) error {
	return ErrFromMockAPI
}
func (n *ErrorMockAPI) GetResp(MetaContext, APIArg) (*http.Response, func(), error) {
	return nil, noopFinisher, nil
}
func (n *ErrorMockAPI) Post(MetaContext, APIArg) (*APIRes, error)     { return nil, ErrFromMockAPI }
func (n *ErrorMockAPI) PostJSON(MetaContext, APIArg) (*APIRes, error) { return nil, ErrFromMockAPI }
func (n *ErrorMockAPI) PostDecode(MetaContext, APIArg, APIResponseWrapper) error {
	return ErrFromMockAPI
}
func (n *ErrorMockAPI) PostDecodeCtx(context.Context, APIArg, APIResponseWrapper) error {
	return ErrFromMockAPI
}
func (n *ErrorMockAPI) PostRaw(MetaContext, APIArg, string, io.Reader) (*APIRes, error) {
	return nil, ErrFromMockAPI
}
func (n *ErrorMockAPI) Delete(MetaContext, APIArg) (*APIRes, error) { return nil, ErrFromMockAPI }
