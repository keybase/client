// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"encoding/json"
	"io/ioutil"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	jsonw "github.com/keybase/go-jsonw"
	"golang.org/x/net/context"
)

type APIServerHandler struct {
	*BaseHandler
	libkb.Contextified
}

func NewAPIServerHandler(xp rpc.Transporter, g *libkb.GlobalContext) *APIServerHandler {
	return &APIServerHandler{
		BaseHandler:  NewBaseHandler(g, xp),
		Contextified: libkb.NewContextified(g),
	}
}

func (a *APIServerHandler) Get(ctx context.Context, arg keybase1.GetArg) (keybase1.APIRes, error) {
	mctx := libkb.NewMetaContext(ctx, a.G())
	return a.doGet(mctx, arg, false)
}

func (a *APIServerHandler) GetWithSession(ctx context.Context, arg keybase1.GetWithSessionArg) (keybase1.APIRes, error) {
	mctx := libkb.NewMetaContext(ctx, a.G())
	return a.doGet(mctx, arg, true)
}

func (a *APIServerHandler) Post(ctx context.Context, arg keybase1.PostArg) (keybase1.APIRes, error) {
	mctx := libkb.NewMetaContext(ctx, a.G())
	return a.doPost(mctx, arg)
}

func (a *APIServerHandler) PostJSON(ctx context.Context, arg keybase1.PostJSONArg) (keybase1.APIRes, error) {
	mctx := libkb.NewMetaContext(ctx, a.G())
	return a.doPostJSON(mctx, arg)
}

func (a *APIServerHandler) Delete(ctx context.Context, arg keybase1.DeleteArg) (keybase1.APIRes, error) {
	mctx := libkb.NewMetaContext(ctx, a.G())
	return a.doDelete(mctx, arg)
}

type GenericArg interface {
	GetEndpoint() string
	GetHTTPArgs() []keybase1.StringKVPair
	GetHttpStatuses() []int
	GetAppStatusCodes() []int
}

func (a *APIServerHandler) setupArg(arg GenericArg) libkb.APIArg {
	// Form http arg dict
	kbargs := make(libkb.HTTPArgs)
	for _, harg := range arg.GetHTTPArgs() {
		kbargs[harg.Key] = libkb.S{Val: harg.Value}
	}

	// Acceptable http status list
	s := arg.GetHttpStatuses()
	httpStatuses := make([]int, len(s))
	copy(httpStatuses, s)

	// Acceptable app status code list
	c := arg.GetAppStatusCodes()
	appStatusCodes := make([]int, len(c))
	copy(appStatusCodes, c)

	// Do the API call
	kbarg := libkb.APIArg{
		Endpoint:       arg.GetEndpoint(),
		SessionType:    libkb.APISessionTypeREQUIRED,
		Args:           kbargs,
		HTTPStatus:     httpStatuses,
		AppStatusCodes: appStatusCodes,
	}

	return kbarg
}

func (a *APIServerHandler) doGet(mctx libkb.MetaContext, arg GenericArg, sessionRequired bool) (res keybase1.APIRes, err error) {
	defer mctx.Trace("APIServerHandler::Get", func() error { return err })()
	// turn off session requirement if not needed
	kbarg := a.setupArg(arg)
	if !sessionRequired {
		kbarg.SessionType = libkb.APISessionTypeNONE
	}
	if getWithSessionArg, ok := arg.(keybase1.GetWithSessionArg); ok && getWithSessionArg.UseText != nil && *getWithSessionArg.UseText {
		kbarg.UseText = true
		resp, finisher, err := mctx.G().API.GetResp(mctx, kbarg)
		defer finisher()
		if err != nil {
			return res, err
		}
		body, err := ioutil.ReadAll(resp.Body)
		if err != nil {
			return res, err
		}
		return keybase1.APIRes{
			Body:       string(body),
			HttpStatus: resp.StatusCode,
		}, nil
	}
	var ires *libkb.APIRes
	ires, err = mctx.G().API.Get(mctx, kbarg)
	if err != nil {
		return res, err
	}
	return a.convertRes(ires), nil
}

func (a *APIServerHandler) doPost(mctx libkb.MetaContext, arg keybase1.PostArg) (res keybase1.APIRes, err error) {
	defer mctx.Trace("APIServerHandler::Post", func() error { return err })()
	var ires *libkb.APIRes
	ires, err = mctx.G().API.Post(mctx, a.setupArg(arg))
	if err != nil {
		return res, err
	}
	return a.convertRes(ires), nil
}

func (a *APIServerHandler) doPostJSON(mctx libkb.MetaContext, rawarg keybase1.PostJSONArg) (res keybase1.APIRes, err error) {
	defer mctx.Trace("APIServerHandler::PostJSON", func() error { return err })()
	var ires *libkb.APIRes
	arg := a.setupArg(rawarg)
	jsonPayload := make(libkb.JSONPayload)
	for _, kvpair := range rawarg.JSONPayload {
		var value interface{}
		err = jsonw.EnsureMaxDepthBytesDefault([]byte(kvpair.Value))
		if err != nil {
			return keybase1.APIRes{}, err
		}
		err := json.Unmarshal([]byte(kvpair.Value), &value)
		if err != nil {
			return keybase1.APIRes{}, err
		}
		jsonPayload[kvpair.Key] = value
	}
	arg.JSONPayload = jsonPayload

	ires, err = mctx.G().API.PostJSON(mctx, arg)
	if err != nil {
		return keybase1.APIRes{}, err
	}

	return a.convertRes(ires), nil
}

func (a *APIServerHandler) doDelete(mctx libkb.MetaContext, arg keybase1.DeleteArg) (res keybase1.APIRes, err error) {
	a.G().Trace("APIServerHandler::Delete", func() error { return err })()
	var ires *libkb.APIRes
	ires, err = a.G().API.Delete(mctx, a.setupArg(arg))
	if err != nil {
		return res, err
	}
	return a.convertRes(ires), nil
}

func (a *APIServerHandler) convertRes(res *libkb.APIRes) keybase1.APIRes {
	// Translate the result
	var ares keybase1.APIRes
	mstatus, err := res.Status.Marshal()
	if err == nil {
		ares.Status = string(mstatus)
	}
	mbody, err := res.Body.Marshal()
	if err == nil {
		ares.Body = string(mbody)
	}
	ares.HttpStatus = res.HTTPStatus

	appStatus := jsonw.NewWrapper(res.AppStatus)
	mappstatus, err := appStatus.Marshal()
	if err == nil {
		ares.AppStatus = string(mappstatus)
	}

	return ares
}
