// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build !production

package libkb

import (
	"errors"
	"io"
	"net/http"
	"testing"

	context "golang.org/x/net/context"
)

type offlineAPI struct {
	t *testing.T
}

var _ API = (*offlineAPI)(nil)

var errIsOffline = errors.New("API is offline due to test offlineAPI")

func (n *offlineAPI) Post(m MetaContext, args APIArg) (*APIRes, error) {
	return nil, errIsOffline
}

func (n *offlineAPI) PostJSON(m MetaContext, args APIArg) (*APIRes, error) {
	return nil, errIsOffline
}

func (n *offlineAPI) PostDecode(MetaContext, APIArg, APIResponseWrapper) error {
	return errIsOffline
}

func (n *offlineAPI) PostDecodeCtx(context.Context, APIArg, APIResponseWrapper) error {
	return errIsOffline
}

func (n *offlineAPI) PostRaw(MetaContext, APIArg, string, io.Reader) (*APIRes, error) {
	return nil, errIsOffline
}

func (n *offlineAPI) Get(m MetaContext, args APIArg) (*APIRes, error) {
	return nil, errIsOffline
}

func (n *offlineAPI) GetResp(m MetaContext, args APIArg) (*http.Response, func(), error) {
	return nil, func() {}, errIsOffline
}

func (n *offlineAPI) GetDecode(m MetaContext, args APIArg, wrap APIResponseWrapper) error {
	return errIsOffline
}

func (n *offlineAPI) GetDecodeCtx(ctx context.Context, args APIArg, wrap APIResponseWrapper) error {
	return errIsOffline
}

func (n *offlineAPI) Delete(MetaContext, APIArg) (*APIRes, error) {
	return nil, errIsOffline
}
