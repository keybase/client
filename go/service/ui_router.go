// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	libkb "github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
)

type transporterAndConnectionID struct {
	transporter  rpc.Transporter
	connectionID libkb.ConnectionID
}

type getObj struct {
	ui    libkb.UIKind
	retCh chan<- transporterAndConnectionID
}

type uiWrapper struct {
	cid       libkb.ConnectionID
	sessionID int
}

type setObj struct {
	cid libkb.ConnectionID
	ui  libkb.UIKind
}

type UIRouter struct {
	libkb.Contextified
	cm         *libkb.ConnectionManager
	uis        map[libkb.UIKind]libkb.ConnectionID
	setCh      chan setObj
	getCh      chan getObj
	shutdownCh chan struct{}
}

func NewUIRouter(g *libkb.GlobalContext) *UIRouter {
	ret := &UIRouter{
		Contextified: libkb.NewContextified(g),
		cm:           g.ConnectionManager,
		uis:          make(map[libkb.UIKind]libkb.ConnectionID),
		setCh:        make(chan setObj),
		getCh:        make(chan getObj),
		shutdownCh:   make(chan struct{}),
	}
	go ret.run()
	return ret
}

func (u *UIRouter) Shutdown() {
	u.shutdownCh <- struct{}{}
}

func (u *UIRouter) run() {
	for {
		select {
		case <-u.shutdownCh:
			return
		case o := <-u.setCh:
			u.uis[o.ui] = o.cid
		case o := <-u.getCh:
			var ret rpc.Transporter
			cid, ok := u.uis[o.ui]
			if ok {
				if ret = u.cm.LookupConnection(cid); ret == nil {
					u.G().Log.Debug("UIRouter: connection %v inactive, deleting registered UI %s", cid, o.ui)
					delete(u.uis, o.ui)
				}
			}
			o.retCh <- transporterAndConnectionID{transporter: ret, connectionID: cid}
		}
	}
}

func (u *UIRouter) SetUI(c libkb.ConnectionID, k libkb.UIKind) {
	u.G().Log.Debug("UIRouter: connection %v registering UI %s", c, k)
	u.setCh <- setObj{c, k}
}

func (u *UIRouter) getUI(k libkb.UIKind) (rpc.Transporter, libkb.ConnectionID) {
	retCh := make(chan transporterAndConnectionID)
	u.getCh <- getObj{k, retCh}
	ret := <-retCh
	return ret.transporter, ret.connectionID
}

func (u *UIRouter) GetIdentifyUI() (libkb.IdentifyUI, error) {
	x, _ := u.getUI(libkb.IdentifyUIKind)
	if x == nil {
		return nil, nil
	}
	cli := rpc.NewClient(x, libkb.ErrorUnwrapper{}, nil)
	iuicli := keybase1.IdentifyUiClient{Cli: cli}
	sessionID, err := iuicli.DelegateIdentifyUI(context.TODO())
	if err != nil {
		return nil, err
	}
	ret := &RemoteIdentifyUI{
		sessionID: sessionID,
		uicli:     iuicli,
		logUI: &LogUI{
			sessionID,
			&keybase1.LogUiClient{Cli: cli},
		},
		Contextified: libkb.NewContextified(u.G()),
	}
	return ret, nil
}

func (u *UIRouter) GetIdentifyUICtx(ctx context.Context) (int, libkb.IdentifyUI, error) {
	x, _ := u.getUI(libkb.IdentifyUIKind)
	if x == nil {
		return 0, nil, nil
	}
	cli := rpc.NewClient(x, libkb.ErrorUnwrapper{}, nil)
	iuicli := keybase1.IdentifyUiClient{Cli: cli}
	sessionID, err := iuicli.DelegateIdentifyUI(ctx)
	if err != nil {
		return 0, nil, err
	}
	ret := &RemoteIdentifyUI{
		sessionID: sessionID,
		uicli:     iuicli,
		logUI: &LogUI{
			sessionID,
			&keybase1.LogUiClient{Cli: cli},
		},
		Contextified: libkb.NewContextified(u.G()),
	}
	return sessionID, ret, nil
}

func (u *UIRouter) GetSecretUI(sessionID int) (ui libkb.SecretUI, err error) {
	defer u.G().Trace("UIRouter#GetSecretUI", func() error { return err })()
	x, _ := u.getUI(libkb.SecretUIKind)
	if x == nil {
		u.G().Log.Debug("| getUI(libkb.SecretUIKind) returned nil")
		return nil, nil
	}
	cli := rpc.NewClient(x, libkb.ErrorUnwrapper{}, nil)
	scli := keybase1.SecretUiClient{Cli: cli}

	u.G().Log.Debug("| returning delegated SecretUI with sessionID = %d", sessionID)
	ret := &SecretUI{
		cli:          &scli,
		sessionID:    sessionID,
		Contextified: libkb.NewContextified(u.G()),
	}
	return ret, nil
}

func (u *UIRouter) GetRekeyUI() (keybase1.RekeyUIInterface, int, error) {
	var err error
	defer u.G().Trace("UIRouter#GetRekeyUI", func() error { return err })()

	x, cid := u.getUI(libkb.RekeyUIKind)
	if x == nil {
		u.G().Log.Debug("| getUI(libkb.RekeyUIKind) returned nil")
		return nil, 0, nil
	}
	cli := rpc.NewClient(x, libkb.ErrorUnwrapper{}, nil)
	uicli := keybase1.RekeyUIClient{Cli: cli}
	sessionID, err := uicli.DelegateRekeyUI(context.TODO())
	if err != nil {
		return nil, 0, err
	}
	ret := &RekeyUI{
		Contextified: libkb.NewContextified(u.G()),
		sessionID:    sessionID,
		cli:          &uicli,
		connectionID: cid,
	}
	return ret, sessionID, nil
}

func (u *UIRouter) getOrReuseRekeyUI(prev *RekeyUI) (ret *RekeyUI, err error) {
	defer u.G().Trace("UIRouter#GetOrReuseRekeyUI", func() error { return err })()
	x, cid := u.getUI(libkb.RekeyUIKind)

	if x == nil {
		return nil, nil
	}

	if prev != nil && prev.connectionID == cid {
		return prev, nil
	}

	cli := rpc.NewClient(x, libkb.ErrorUnwrapper{}, nil)
	uicli := keybase1.RekeyUIClient{Cli: cli}
	var sessionID int
	sessionID, err = uicli.DelegateRekeyUI(context.TODO())
	if err != nil {
		return nil, err
	}
	ret = &RekeyUI{
		Contextified: libkb.NewContextified(u.G()),
		sessionID:    sessionID,
		cli:          &uicli,
		connectionID: cid,
	}

	return ret, nil
}

func (u *UIRouter) GetRekeyUINoSessionID() (ret keybase1.RekeyUIInterface, err error) {
	defer u.G().Trace("UIRouter#GetRekeyUINoSessionID", func() error { return err })()
	return u.getOrReuseRekeyUI(nil)
}
