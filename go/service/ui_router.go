// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"fmt"
	"sync"

	identify3 "github.com/keybase/client/go/identify3"
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
	sync.Mutex
	libkb.Contextified
	cm  *libkb.ConnectionManager
	uis map[libkb.UIKind]libkb.ConnectionID
}

func NewUIRouter(g *libkb.GlobalContext) *UIRouter {
	return &UIRouter{
		Contextified: libkb.NewContextified(g),
		cm:           g.ConnectionManager,
		uis:          make(map[libkb.UIKind]libkb.ConnectionID),
	}
}

func (u *UIRouter) Shutdown() {}

func (u *UIRouter) SetUI(c libkb.ConnectionID, k libkb.UIKind) {
	u.Lock()
	defer u.Unlock()
	u.G().Log.Debug("UIRouter: connection %v registering UI %s [%p]", c, k, u)
	u.uis[k] = c
}

func (u *UIRouter) getUI(k libkb.UIKind) (rpc.Transporter, libkb.ConnectionID) {
	u.Lock()
	defer u.Unlock()
	var ret rpc.Transporter
	cid, ok := u.uis[k]
	if ok {
		if ret = u.cm.LookupConnection(cid); ret == nil {
			u.G().Log.Debug("UIRouter: connection %v inactive, deleting registered UI %s", cid, k)
			delete(u.uis, k)
		}
	}
	return ret, cid
}

func (u *UIRouter) DumpUIs() map[libkb.UIKind]libkb.ConnectionID {
	u.Lock()
	defer u.Unlock()

	// Copy the map
	res := map[libkb.UIKind]libkb.ConnectionID{}
	for k, v := range u.uis {
		res[k] = v
	}
	return res
}

func (u *UIRouter) GetIdentifyUI() (libkb.IdentifyUI, error) {
	x, _ := u.getUI(libkb.IdentifyUIKind)
	if x == nil {
		return nil, nil
	}
	cli := rpc.NewClient(x, libkb.NewContextifiedErrorUnwrapper(u.G()), nil)
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

func (u *UIRouter) GetIdentify3UI(m libkb.MetaContext) (keybase1.Identify3UiInterface, error) {
	x, _ := u.getUI(libkb.Identify3UIKind)
	if x == nil {
		return nil, nil
	}
	cli := rpc.NewClient(x, libkb.NewContextifiedErrorUnwrapper(m.G()), nil)
	id3cli := keybase1.Identify3UiClient{Cli: cli}
	return id3cli, nil
}

func (u *UIRouter) GetIdentify3UIAdapter(m libkb.MetaContext) (libkb.IdentifyUI, error) {
	id3i, err := u.GetIdentify3UI(m)
	if err != nil {
		return nil, err
	}
	if id3i == nil {
		return nil, nil
	}
	return identify3.NewUIAdapterMakeSessionForUpcall(m, id3i)
}

func (u *UIRouter) GetChatUI() (libkb.ChatUI, error) {
	x, _ := u.getUI(libkb.ChatUIKind)
	if x == nil {
		return nil, nil
	}
	cli := rpc.NewClient(x, libkb.NewContextifiedErrorUnwrapper(u.G()), nil)
	return NewRemoteChatUI(0, cli), nil
}

func (u *UIRouter) GetIdentifyUICtx(ctx context.Context) (int, libkb.IdentifyUI, error) {
	x, _ := u.getUI(libkb.IdentifyUIKind)
	if x == nil {
		return 0, nil, nil
	}
	cli := rpc.NewClient(x, libkb.NewContextifiedErrorUnwrapper(u.G()), nil)
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
	cli := rpc.NewClient(x, libkb.NewContextifiedErrorUnwrapper(u.G()), nil)
	scli := keybase1.SecretUiClient{Cli: cli}

	u.G().Log.Debug("| returning delegated SecretUI with sessionID = %d", sessionID)
	ret := &SecretUI{
		cli:          &scli,
		sessionID:    sessionID,
		Contextified: libkb.NewContextified(u.G()),
	}
	return ret, nil
}

func (u *UIRouter) GetHomeUI() (keybase1.HomeUIInterface, error) {
	var err error
	defer u.G().Trace(fmt.Sprintf("UIRouter#GetHomeUI [%p]", u), func() error { return err })()

	x, _ := u.getUI(libkb.HomeUIKind)
	if x == nil {
		u.G().Log.Debug("| getUI(libkb.HomeUIKind) returned nil")
		return nil, nil
	}
	cli := rpc.NewClient(x, libkb.NewContextifiedErrorUnwrapper(u.G()), nil)
	uicli := keybase1.HomeUIClient{Cli: cli}
	return uicli, nil
}

func (u *UIRouter) GetRekeyUI() (keybase1.RekeyUIInterface, int, error) {
	var err error
	defer u.G().Trace("UIRouter#GetRekeyUI", func() error { return err })()

	x, cid := u.getUI(libkb.RekeyUIKind)
	if x == nil {
		u.G().Log.Debug("| getUI(libkb.RekeyUIKind) returned nil")
		return nil, 0, nil
	}
	cli := rpc.NewClient(x, libkb.NewContextifiedErrorUnwrapper(u.G()), nil)
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

	cli := rpc.NewClient(x, libkb.NewContextifiedErrorUnwrapper(u.G()), nil)
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
