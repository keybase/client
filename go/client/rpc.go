// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

func GetRPCClient() (ret *rpc.Client, xp rpc.Transporter, err error) {
	return GetRPCClientWithContext(G)
}

func getSocketWithRetry(g *libkb.GlobalContext) (xp rpc.Transporter, err error) {
	return getSocket(g, true)
}

func getSocketNoRetry(g *libkb.GlobalContext) (xp rpc.Transporter, err error) {
	return getSocket(g, false)
}

func getSocket(g *libkb.GlobalContext, clearError bool) (xp rpc.Transporter, err error) {
	var isNew bool
	_, xp, isNew, err = g.GetSocket(clearError)
	if err == nil && isNew {
		introduceMyself(g, xp)
	}
	return xp, err
}

func GetRPCClientWithContext(g *libkb.GlobalContext) (ret *rpc.Client, xp rpc.Transporter, err error) {
	if xp, err = getSocketNoRetry(g); err == nil {
		ret = rpc.NewClient(xp, libkb.ErrorUnwrapper{})
	}
	return
}

func GetRPCServer(g *libkb.GlobalContext) (ret *rpc.Server, xp rpc.Transporter, err error) {
	if xp, err = getSocketNoRetry(g); err == nil {
		ret = rpc.NewServer(xp, libkb.WrapError)
	}
	if err != nil {
		DiagnoseSocketError(g.UI, err)
	}
	return
}

func GetSignupClient(g *libkb.GlobalContext) (cli keybase1.SignupClient, err error) {
	var rpc *rpc.Client
	if rpc, _, err = GetRPCClientWithContext(g); err == nil {
		cli = keybase1.SignupClient{Cli: rpc}
	}
	return
}

func GetConfigClient(g *libkb.GlobalContext) (cli keybase1.ConfigClient, err error) {
	var rpc *rpc.Client
	if rpc, _, err = GetRPCClientWithContext(g); err == nil {
		cli = keybase1.ConfigClient{Cli: rpc}
	}
	return
}

func GetSaltpackClient(g *libkb.GlobalContext) (cli keybase1.SaltpackClient, err error) {
	var rcli *rpc.Client
	if rcli, _, err = GetRPCClientWithContext(g); err == nil {
		cli = keybase1.SaltpackClient{Cli: rcli}
	}
	return
}

func GetLoginClient(g *libkb.GlobalContext) (cli keybase1.LoginClient, err error) {
	var rcli *rpc.Client
	if rcli, _, err = GetRPCClientWithContext(g); err == nil {
		cli = keybase1.LoginClient{Cli: rcli}
	}
	return
}

func GetLogClient(g *libkb.GlobalContext) (cli keybase1.LogClient, err error) {
	var rcli *rpc.Client
	if rcli, _, err = GetRPCClientWithContext(g); err == nil {
		cli = keybase1.LogClient{Cli: rcli}
	}
	return
}

func RegisterProtocolsWithContext(prots []rpc.Protocol, g *libkb.GlobalContext) (err error) {
	var srv *rpc.Server
	if srv, _, err = GetRPCServer(g); err != nil {
		return
	}
	prots = append(prots, NewLogUIProtocol())
	for _, p := range prots {
		if err = srv.Register(p); err != nil {
			if _, ok := err.(rpc.AlreadyRegisteredError); !ok {
				return err
			}
			err = nil
		}
	}
	return
}

func RegisterProtocols(prots []rpc.Protocol) (err error) {
	return RegisterProtocolsWithContext(prots, G)
}

func GetIdentifyClient(g *libkb.GlobalContext) (cli keybase1.IdentifyClient, err error) {
	var rcli *rpc.Client
	if rcli, _, err = GetRPCClientWithContext(g); err == nil {
		cli = keybase1.IdentifyClient{Cli: rcli}
	}
	return
}

func GetProveClient() (cli keybase1.ProveClient, err error) {
	var rcli *rpc.Client
	if rcli, _, err = GetRPCClient(); err == nil {
		cli = keybase1.ProveClient{Cli: rcli}
	}
	return
}

func GetTrackClient(g *libkb.GlobalContext) (cli keybase1.TrackClient, err error) {
	var rcli *rpc.Client
	if rcli, _, err = GetRPCClientWithContext(g); err == nil {
		cli = keybase1.TrackClient{Cli: rcli}
	}
	return
}

func GetDeviceClient(g *libkb.GlobalContext) (cli keybase1.DeviceClient, err error) {
	var rcli *rpc.Client
	if rcli, _, err = GetRPCClientWithContext(g); err == nil {
		cli = keybase1.DeviceClient{Cli: rcli}
	}
	return
}

func GetUserClient(g *libkb.GlobalContext) (cli keybase1.UserClient, err error) {
	var rcli *rpc.Client
	if rcli, _, err = GetRPCClientWithContext(g); err == nil {
		cli = keybase1.UserClient{Cli: rcli}
	}
	return
}

func GetSigsClient(g *libkb.GlobalContext) (cli keybase1.SigsClient, err error) {
	var rcli *rpc.Client
	if rcli, _, err = GetRPCClientWithContext(g); err == nil {
		cli = keybase1.SigsClient{Cli: rcli}
	}
	return
}

func GetPGPClient(g *libkb.GlobalContext) (cli keybase1.PGPClient, err error) {
	var rcli *rpc.Client
	if rcli, _, err = GetRPCClientWithContext(g); err == nil {
		cli = keybase1.PGPClient{Cli: rcli}
	}
	return
}

func GetRevokeClient(g *libkb.GlobalContext) (cli keybase1.RevokeClient, err error) {
	var rcli *rpc.Client
	if rcli, _, err = GetRPCClientWithContext(g); err == nil {
		cli = keybase1.RevokeClient{Cli: rcli}
	}
	return
}

func GetCryptocurrencyClient(g *libkb.GlobalContext) (cli keybase1.CryptocurrencyClient, err error) {
	var rcli *rpc.Client
	if rcli, _, err = GetRPCClientWithContext(g); err == nil {
		cli = keybase1.CryptocurrencyClient{Cli: rcli}
	}
	return
}

func GetScanProofsClient(g *libkb.GlobalContext) (cli keybase1.ScanProofsClient, err error) {
	var rcli *rpc.Client
	if rcli, _, err = GetRPCClientWithContext(g); err == nil {
		cli = keybase1.ScanProofsClient{Cli: rcli}
	}
	return
}

func GetCtlClient(g *libkb.GlobalContext) (cli keybase1.CtlClient, err error) {
	var rcli *rpc.Client
	if rcli, _, err = GetRPCClientWithContext(g); err == nil {
		cli = keybase1.CtlClient{Cli: rcli}
	}
	return
}

func GetAccountClient(g *libkb.GlobalContext) (cli keybase1.AccountClient, err error) {
	var rcli *rpc.Client
	if rcli, _, err = GetRPCClientWithContext(g); err == nil {
		cli = keybase1.AccountClient{Cli: rcli}
	}
	return
}

func GetFavoriteClient() (cli keybase1.FavoriteClient, err error) {
	var rcli *rpc.Client
	if rcli, _, err = GetRPCClient(); err == nil {
		cli = keybase1.FavoriteClient{Cli: rcli}
	}
	return
}

func GetNotifyCtlClient(g *libkb.GlobalContext) (cli keybase1.NotifyCtlClient, err error) {
	rcli, _, err := GetRPCClientWithContext(g)
	if err != nil {
		return cli, err
	}
	cli = keybase1.NotifyCtlClient{Cli: rcli}
	return cli, nil
}

func GetKBFSClient(g *libkb.GlobalContext) (cli keybase1.KbfsClient, err error) {
	rcli, _, err := GetRPCClientWithContext(g)
	if err != nil {
		return cli, err
	}
	cli = keybase1.KbfsClient{Cli: rcli}
	return cli, nil
}

func GetKBFSMountClient(g *libkb.GlobalContext) (cli keybase1.KbfsMountClient, err error) {
	rcli, _, err := GetRPCClientWithContext(g)
	if err != nil {
		return cli, err
	}
	cli = keybase1.KbfsMountClient{Cli: rcli}
	return cli, nil
}

func GetTlfClient(g *libkb.GlobalContext) (cli keybase1.TlfClient, err error) {
	rcli, _, err := GetRPCClientWithContext(g)
	if err != nil {
		return cli, err
	}
	cli = keybase1.TlfClient{Cli: rcli}
	return cli, nil
}

func GetFSClient(g *libkb.GlobalContext) (cli keybase1.FsClient, err error) {
	rcli, _, err := GetRPCClientWithContext(g)
	if err != nil {
		return cli, err
	}
	cli = keybase1.FsClient{Cli: rcli}
	return cli, nil
}

func GetUpdateClient(g *libkb.GlobalContext) (cli keybase1.UpdateClient, err error) {
	rcli, _, err := GetRPCClientWithContext(g)
	if err != nil {
		return cli, err
	}
	cli = keybase1.UpdateClient{Cli: rcli}
	return cli, nil
}

func GetSecretKeysClient(g *libkb.GlobalContext) (cli keybase1.SecretKeysClient, err error) {
	rcli, _, err := GetRPCClientWithContext(g)
	if err != nil {
		return cli, err
	}
	cli = keybase1.SecretKeysClient{Cli: rcli}
	return cli, nil
}

func GetChatLocalClient(g *libkb.GlobalContext) (cli chat1.LocalClient, err error) {
	rcli, _, err := GetRPCClientWithContext(g)
	if err != nil {
		return cli, err
	}
	cli = chat1.LocalClient{Cli: rcli}
	return cli, nil
}

func introduceMyself(g *libkb.GlobalContext, xp rpc.Transporter) error {
	cli := rpc.NewClient(xp, libkb.ErrorUnwrapper{})
	ccli := keybase1.ConfigClient{Cli: cli}
	return ccli.HelloIAm(context.TODO(), g.GetMyClientDetails())
}

func GetPaperProvisionClient(g *libkb.GlobalContext) (cli keybase1.PaperprovisionClient, err error) {
	rcli, _, err := GetRPCClientWithContext(g)
	if err != nil {
		return cli, err
	}
	cli = keybase1.PaperprovisionClient{Cli: rcli}
	return cli, nil
}

func GetRekeyClient(g *libkb.GlobalContext) (keybase1.RekeyClient, error) {
	rcli, _, err := GetRPCClientWithContext(g)
	if err != nil {
		return keybase1.RekeyClient{}, err
	}
	return keybase1.RekeyClient{Cli: rcli}, nil
}

func GetGregorClient(g *libkb.GlobalContext) (keybase1.GregorClient, error) {
	rcli, _, err := GetRPCClientWithContext(g)
	if err != nil {
		return keybase1.GregorClient{}, err
	}
	return keybase1.GregorClient{Cli: rcli}, nil
}

func GetAPIServerClient(g *libkb.GlobalContext) (cli keybase1.ApiserverClient, err error) {
	rcli, _, err := GetRPCClientWithContext(g)
	if err != nil {
		return cli, err
	}
	cli = keybase1.ApiserverClient{Cli: rcli}
	return cli, nil
}

func GetSessionClient(g *libkb.GlobalContext) (keybase1.SessionClient, error) {
	rcli, _, err := GetRPCClientWithContext(g)
	if err != nil {
		return keybase1.SessionClient{}, err
	}
	return keybase1.SessionClient{Cli: rcli}, nil
}

func GetSimpleFSClient(g *libkb.GlobalContext) (cli keybase1.SimpleFSClient, err error) {
	rcli, _, err := GetRPCClientWithContext(g)
	if err != nil {
		return cli, err
	}
	cli = keybase1.SimpleFSClient{Cli: rcli}
	return cli, nil
}
