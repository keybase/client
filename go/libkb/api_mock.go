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

type APIMethodType int

const (
	MethodGet APIMethodType = iota
	MethodGetDecode
	MethodGetDecodeCtx
	MethodGetResp
	MethodPost
	MethodPostJSON
	MethodPostDecode
	MethodPostDecodeCtx
	MethodPostRaw
	MethodDelete
)

type APIRecord struct {
	Arg    APIArg
	Method APIMethodType
	// various inputs and outputs of the API interface methods.
	Res         *APIRes
	RespWrapper APIResponseWrapper
	HTTPResp    *http.Response
	Func        func()
	S           string
	R           io.Reader
	Err         error
}

// FilterAPIRecords returns only the records on which the filter function outputs true
func FilterAPIRecords(recs []APIRecord, filter func(*APIRecord) bool) (filtered []APIRecord) {
	for _, rec := range recs {
		if filter(&rec) {
			filtered = append(filtered, rec)
		}
	}
	return filtered
}

// APIArgRecorder forwards all its calls to the underlying API, but records all
// the inputs and outputs to be used in tests.
type APIArgRecorder struct {
	API
	Records []APIRecord
}

var _ API = (*APIArgRecorder)(nil)

func NewAPIArgRecorderWithNullAPI() *APIArgRecorder {
	return NewAPIArgRecorder(&NullMockAPI{})
}

func NewAPIArgRecorder(inner API) *APIArgRecorder {
	return &APIArgRecorder{API: inner}
}

func (a *APIArgRecorder) Reset() {
	a.Records = nil
}

func (a *APIArgRecorder) NumCalls() int {
	return len(a.Records)
}

func (a *APIArgRecorder) GetFilteredRecordsAndReset(filter func(*APIRecord) bool) (filtered []APIRecord) {
	filtered = FilterAPIRecords(a.Records, filter)
	a.Reset()
	return filtered
}

func (a *APIArgRecorder) Get(mctx MetaContext, arg APIArg) (*APIRes, error) {
	res, err := a.API.Get(mctx, arg)
	a.Records = append(a.Records, APIRecord{Arg: arg, Method: MethodGet, Res: res, Err: err})
	return res, err
}
func (a *APIArgRecorder) GetDecode(mctx MetaContext, arg APIArg, arw APIResponseWrapper) error {
	err := a.API.GetDecode(mctx, arg, arw)
	a.Records = append(a.Records, APIRecord{Arg: arg, Method: MethodGetDecode, RespWrapper: arw, Err: err})
	return err
}
func (a *APIArgRecorder) GetDecodeCtx(ctx context.Context, arg APIArg, arw APIResponseWrapper) error {
	err := a.API.GetDecodeCtx(ctx, arg, arw)
	a.Records = append(a.Records, APIRecord{Arg: arg, Method: MethodGetDecodeCtx, RespWrapper: arw, Err: err})
	return err
}
func (a *APIArgRecorder) GetResp(mctx MetaContext, arg APIArg) (*http.Response, func(), error) {
	httpR, f, err := a.API.GetResp(mctx, arg)
	a.Records = append(a.Records, APIRecord{Arg: arg, Method: MethodGetResp, HTTPResp: httpR, Func: f, Err: err})
	return httpR, f, err
}
func (a *APIArgRecorder) Post(mctx MetaContext, arg APIArg) (*APIRes, error) {
	res, err := a.API.Post(mctx, arg)
	a.Records = append(a.Records, APIRecord{Arg: arg, Method: MethodPost, Res: res, Err: err})
	return res, err
}
func (a *APIArgRecorder) PostJSON(mctx MetaContext, arg APIArg) (*APIRes, error) {
	res, err := a.API.PostJSON(mctx, arg)
	a.Records = append(a.Records, APIRecord{Arg: arg, Method: MethodPostJSON, Res: res, Err: err})
	return res, err
}
func (a *APIArgRecorder) PostDecode(mctx MetaContext, arg APIArg, arw APIResponseWrapper) error {
	err := a.API.PostDecode(mctx, arg, arw)
	a.Records = append(a.Records, APIRecord{Arg: arg, Method: MethodPostDecode, RespWrapper: arw, Err: err})
	return err
}
func (a *APIArgRecorder) PostDecodeCtx(ctx context.Context, arg APIArg, arw APIResponseWrapper) error {
	err := a.API.PostDecodeCtx(ctx, arg, arw)
	a.Records = append(a.Records, APIRecord{Arg: arg, Method: MethodPostDecodeCtx, RespWrapper: arw, Err: err})
	return err
}
func (a *APIArgRecorder) PostRaw(mctx MetaContext, arg APIArg, s string, r io.Reader) (*APIRes, error) {
	res, err := a.API.PostRaw(mctx, arg, s, r)
	a.Records = append(a.Records, APIRecord{Arg: arg, Method: MethodPostRaw, S: s, R: r, Res: res, Err: err})
	return res, err
}
func (a *APIArgRecorder) Delete(mctx MetaContext, arg APIArg) (*APIRes, error) {
	res, err := a.API.Delete(mctx, arg)
	a.Records = append(a.Records, APIRecord{Arg: arg, Method: MethodDelete, Res: res, Err: err})
	return res, err
}

// APIRouter forwards each API call to one of the underlying API implementations
// depending on an internal filter function passed to its constructor. Be
// careful that the filter always returns a value in bound for the api array.
// This is meant to be used in tests to mock some but not all api calls.
type APIRouter struct {
	APIs   []API
	Filter func(arg APIArg, method APIMethodType) int
}

var _ API = (*APIRouter)(nil)

func NewAPIRouter(apis []API, filter func(arg APIArg, method APIMethodType) int) *APIRouter {
	return &APIRouter{APIs: apis, Filter: filter}
}

func (a *APIRouter) Get(mctx MetaContext, arg APIArg) (*APIRes, error) {
	return a.APIs[a.Filter(arg, MethodGet)].Get(mctx, arg)
}
func (a *APIRouter) GetDecode(mctx MetaContext, arg APIArg, arw APIResponseWrapper) error {
	return a.APIs[a.Filter(arg, MethodGetDecode)].GetDecode(mctx, arg, arw)
}
func (a *APIRouter) GetDecodeCtx(ctx context.Context, arg APIArg, arw APIResponseWrapper) error {
	return a.APIs[a.Filter(arg, MethodGetDecodeCtx)].GetDecodeCtx(ctx, arg, arw)
}
func (a *APIRouter) GetResp(mctx MetaContext, arg APIArg) (*http.Response, func(), error) {
	return a.APIs[a.Filter(arg, MethodGetResp)].GetResp(mctx, arg)
}
func (a *APIRouter) Post(mctx MetaContext, arg APIArg) (*APIRes, error) {
	return a.APIs[a.Filter(arg, MethodPost)].Post(mctx, arg)
}
func (a *APIRouter) PostJSON(mctx MetaContext, arg APIArg) (*APIRes, error) {
	return a.APIs[a.Filter(arg, MethodPostJSON)].PostJSON(mctx, arg)
}
func (a *APIRouter) PostDecode(mctx MetaContext, arg APIArg, arw APIResponseWrapper) error {
	return a.APIs[a.Filter(arg, MethodPostDecode)].PostDecode(mctx, arg, arw)
}
func (a *APIRouter) PostDecodeCtx(ctx context.Context, arg APIArg, arw APIResponseWrapper) error {
	return a.APIs[a.Filter(arg, MethodPostDecodeCtx)].PostDecodeCtx(ctx, arg, arw)
}
func (a *APIRouter) PostRaw(mctx MetaContext, arg APIArg, s string, r io.Reader) (*APIRes, error) {
	return a.APIs[a.Filter(arg, MethodPostRaw)].PostRaw(mctx, arg, s, r)
}
func (a *APIRouter) Delete(mctx MetaContext, arg APIArg) (*APIRes, error) {
	return a.APIs[a.Filter(arg, MethodDelete)].Delete(mctx, arg)
}

type ErrorMockAPI struct{}

var _ API = (*ErrorMockAPI)(nil)

var errMockAPI = errors.New("ErrorMockAPI error")

func (n *ErrorMockAPI) Get(MetaContext, APIArg) (*APIRes, error)                { return nil, errMockAPI }
func (n *ErrorMockAPI) GetDecode(MetaContext, APIArg, APIResponseWrapper) error { return errMockAPI }
func (n *ErrorMockAPI) GetDecodeCtx(context.Context, APIArg, APIResponseWrapper) error {
	return errMockAPI
}
func (n *ErrorMockAPI) GetResp(MetaContext, APIArg) (*http.Response, func(), error) {
	return nil, noopFinisher, nil
}
func (n *ErrorMockAPI) Post(MetaContext, APIArg) (*APIRes, error)                { return nil, errMockAPI }
func (n *ErrorMockAPI) PostJSON(MetaContext, APIArg) (*APIRes, error)            { return nil, errMockAPI }
func (n *ErrorMockAPI) PostDecode(MetaContext, APIArg, APIResponseWrapper) error { return errMockAPI }
func (n *ErrorMockAPI) PostDecodeCtx(context.Context, APIArg, APIResponseWrapper) error {
	return errMockAPI
}
func (n *ErrorMockAPI) PostRaw(MetaContext, APIArg, string, io.Reader) (*APIRes, error) {
	return nil, errMockAPI
}
func (n *ErrorMockAPI) Delete(MetaContext, APIArg) (*APIRes, error) { return nil, errMockAPI }
