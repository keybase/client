// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build !production

package libkb

import (
	"errors"
	"io"
	"net/http"

	context "golang.org/x/net/context"
)

type OfflineAPI struct{}

var _ API = (*OfflineAPI)(nil)

var errIsOffline = errors.New("API is offline due to test OfflineAPI")

func (n *OfflineAPI) Post(m MetaContext, args APIArg) (*APIRes, error) {
	return nil, errIsOffline
}

func (n *OfflineAPI) PostJSON(m MetaContext, args APIArg) (*APIRes, error) {
	return nil, errIsOffline
}

func (n *OfflineAPI) PostDecode(MetaContext, APIArg, APIResponseWrapper) error {
	return errIsOffline
}

func (n *OfflineAPI) PostDecodeCtx(context.Context, APIArg, APIResponseWrapper) error {
	return errIsOffline
}

func (n *OfflineAPI) PostRaw(MetaContext, APIArg, string, io.Reader) (*APIRes, error) {
	return nil, errIsOffline
}

func (n *OfflineAPI) Get(m MetaContext, args APIArg) (*APIRes, error) {
	return nil, errIsOffline
}

func (n *OfflineAPI) GetResp(m MetaContext, args APIArg) (*http.Response, func(), error) {
	return nil, func() {}, errIsOffline
}

func (n *OfflineAPI) GetDecode(m MetaContext, args APIArg, wrap APIResponseWrapper) error {
	return errIsOffline
}

func (n *OfflineAPI) GetDecodeCtx(ctx context.Context, args APIArg, wrap APIResponseWrapper) error {
	return errIsOffline
}

func (n *OfflineAPI) Delete(MetaContext, APIArg) (*APIRes, error) {
	return nil, errIsOffline
}
