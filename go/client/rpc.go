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
		cli = keybase_1.SignupClient{Cli: rpc}
	}
	return
}

func GetConfigClient() (cli keybase_1.ConfigClient, err error) {
	var rpc *rpc2.Client
	if rpc, _, err = GetRpcClient(); err == nil {
		cli = keybase_1.ConfigClient{Cli: rpc}
	}
	return
}

func GetLoginClient() (cli keybase_1.LoginClient, err error) {
	var rcli *rpc2.Client
	if rcli, _, err = GetRpcClient(); err == nil {
		cli = keybase_1.LoginClient{Cli: rcli}
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
		cli = keybase_1.IdentifyClient{Cli: rcli}
	}
	return
}

func GetProveClient() (cli keybase_1.ProveClient, err error) {
	var rcli *rpc2.Client
	if rcli, _, err = GetRpcClient(); err == nil {
		cli = keybase_1.ProveClient{Cli: rcli}
	}
	return
}

func GetMykeyClient() (cli keybase_1.MykeyClient, err error) {
	var rcli *rpc2.Client
	if rcli, _, err = GetRpcClient(); err == nil {
		cli = keybase_1.MykeyClient{Cli: rcli}
	}
	return
}

func GetTrackClient() (cli keybase_1.TrackClient, err error) {
	var rcli *rpc2.Client
	if rcli, _, err = GetRpcClient(); err == nil {
		cli = keybase_1.TrackClient{Cli: rcli}
	}
	return
}

func GetSibkeyClient() (cli keybase_1.SibkeyClient, err error) {
	var rcli *rpc2.Client
	if rcli, _, err = GetRpcClient(); err == nil {
		cli = keybase_1.SibkeyClient{Cli: rcli}
	}
	return
}

func GetDeviceClient() (cli keybase_1.DeviceClient, err error) {
	var rcli *rpc2.Client
	if rcli, _, err = GetRpcClient(); err == nil {
		cli = keybase_1.DeviceClient{Cli: rcli}
	}
	return
}

func GetUserClient() (cli keybase_1.UserClient, err error) {
	var rcli *rpc2.Client
	if rcli, _, err = GetRpcClient(); err == nil {
		cli = keybase_1.UserClient{Cli: rcli}
	}
	return
}

func GetSigsClient() (cli keybase_1.SigsClient, err error) {
	var rcli *rpc2.Client
	if rcli, _, err = GetRpcClient(); err == nil {
		cli = keybase_1.SigsClient{Cli: rcli}
	}
	return
}
