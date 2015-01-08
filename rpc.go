package main

import (
	"github.com/keybase/go-libkb"
	"github.com/keybase/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

func GetRpcClient() (ret *rpc2.Client, xp *rpc2.Transport, err error) {
	if _, xp, err = G.GetSocket(); err == nil {
		ret = rpc2.NewClient(xp, libkb.UnwrapError)
	}
	return
}

func GetRpcServer() (ret *rpc2.Server, xp *rpc2.Transport, err error) {
	if _, xp, err = G.GetSocket(); err == nil {
		ret = rpc2.NewServer(xp, libkb.WrapError)
	}
	return
}

func GetSignupClient() (cli keybase_1.SignupClient, err error) {
	var rpc *rpc2.Client
	if rpc, _, err = GetRpcClient(); err == nil {
		cli = keybase_1.SignupClient{rpc}
	}
	return
}

func GetConfigClient() (cli keybase_1.ConfigClient, err error) {
	var rpc *rpc2.Client
	if rpc, _, err = GetRpcClient(); err == nil {
		cli = keybase_1.ConfigClient{rpc}
	}
	return
}

func GetLoginClient() (cli keybase_1.LoginClient, err error) {
	var rcli *rpc2.Client
	if rcli, _, err = GetRpcClient(); err == nil {
		cli = keybase_1.LoginClient{rcli}
	}
	return
}

func RegisterLoginUiServer(i keybase_1.LoginUiInterface) (err error) {
	var srv *rpc2.Server
	if srv, _, err = GetRpcServer(); err == nil {
		srv.Register(keybase_1.LoginUiProtocol(i))
	}
	return
}

func GetIdentifyClient() (cli keybase_1.IdentifyClient, err error) {
	var rcli *rpc2.Client
	if rcli, _, err = GetRpcClient(); err == nil {
		cli = keybase_1.IdentifyClient{rcli}
	}
	return
}

func RegisterIdentifyUiServer(i keybase_1.IdentifyUiInterface) (err error) {
	var srv *rpc2.Server
	if srv, _, err = GetRpcServer(); err == nil {
		srv.Register(keybase_1.IdentifyUiProtocol(i))
	}
	return
}

func GetProveClient() (cli keybase_1.ProveClient, err error) {
	var rcli *rpc2.Client
	if rcli, _, err = GetRpcClient(); err == nil {
		cli = keybase_1.ProveClient{rcli}
	}
	return
}

func RegisterProveUiServer(i keybase_1.ProveUiInterface) (err error) {
	var srv *rpc2.Server
	if srv, _, err = GetRpcServer(); err == nil {
		srv.Register(keybase_1.ProveUiProtocol(i))
	}
	return
}
