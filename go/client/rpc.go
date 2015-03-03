package main

import (
	"github.com/keybase/client/go/libkb"
	keybase_1 "github.com/keybase/client/protocol/go"
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

func RegisterProtocols(prots []rpc2.Protocol) (err error) {
	var srv *rpc2.Server
	if srv, _, err = GetRpcServer(); err != nil {
		return
	}
	for _, p := range prots {
		if err = srv.Register(p); err != nil {
			return
		}
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

func GetProveClient() (cli keybase_1.ProveClient, err error) {
	var rcli *rpc2.Client
	if rcli, _, err = GetRpcClient(); err == nil {
		cli = keybase_1.ProveClient{rcli}
	}
	return
}

func GetMykeyClient() (cli keybase_1.MykeyClient, err error) {
	var rcli *rpc2.Client
	if rcli, _, err = GetRpcClient(); err == nil {
		cli = keybase_1.MykeyClient{rcli}
	}
	return
}

func GetTrackClient() (cli keybase_1.TrackClient, err error) {
	var rcli *rpc2.Client
	if rcli, _, err = GetRpcClient(); err == nil {
		cli = keybase_1.TrackClient{rcli}
	}
	return
}

func GetSibkeyClient() (cli keybase_1.SibkeyClient, err error) {
	var rcli *rpc2.Client
	if rcli, _, err = GetRpcClient(); err == nil {
		cli = keybase_1.SibkeyClient{rcli}
	}
	return
}

func GetDeviceClient() (cli keybase_1.DeviceClient, err error) {
	var rcli *rpc2.Client
	if rcli, _, err = GetRpcClient(); err == nil {
		cli = keybase_1.DeviceClient{rcli}
	}
	return
}
