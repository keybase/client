package client

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
)

func GetRPCClient() (ret *rpc.Client, xp rpc.Transporter, err error) {
	return GetRPCClientWithContext(G)
}

func GetRPCClientWithContext(g *libkb.GlobalContext) (ret *rpc.Client, xp rpc.Transporter, err error) {
	if _, xp, err = g.GetSocket(false); err == nil {
		ret = rpc.NewClient(xp, libkb.ErrorUnwrapper{})
	}
	return
}

func GetRPCServer() (ret *rpc.Server, xp rpc.Transporter, err error) {
	if _, xp, err = G.GetSocket(false); err == nil {
		ret = rpc.NewServer(xp, libkb.WrapError)
	}
	if err != nil {
		DiagnoseSocketError(err)
	}
	return
}

func GetSignupClient() (cli keybase1.SignupClient, err error) {
	var rpc *rpc.Client
	if rpc, _, err = GetRPCClient(); err == nil {
		cli = keybase1.SignupClient{Cli: rpc}
	}
	return
}

func GetConfigClient() (cli keybase1.ConfigClient, err error) {
	var rpc *rpc.Client
	if rpc, _, err = GetRPCClient(); err == nil {
		cli = keybase1.ConfigClient{Cli: rpc}
	}
	return
}

func GetLoginClient() (cli keybase1.LoginClient, err error) {
	var rcli *rpc.Client
	if rcli, _, err = GetRPCClient(); err == nil {
		cli = keybase1.LoginClient{Cli: rcli}
	}
	return
}

func RegisterProtocols(prots []rpc.Protocol) (err error) {
	var srv *rpc.Server
	if srv, _, err = GetRPCServer(); err != nil {
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

func GetIdentifyClient() (cli keybase1.IdentifyClient, err error) {
	var rcli *rpc.Client
	if rcli, _, err = GetRPCClient(); err == nil {
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

func GetTrackClient() (cli keybase1.TrackClient, err error) {
	var rcli *rpc.Client
	if rcli, _, err = GetRPCClient(); err == nil {
		cli = keybase1.TrackClient{Cli: rcli}
	}
	return
}

func GetDeviceClient() (cli keybase1.DeviceClient, err error) {
	var rcli *rpc.Client
	if rcli, _, err = GetRPCClient(); err == nil {
		cli = keybase1.DeviceClient{Cli: rcli}
	}
	return
}

func GetUserClient() (cli keybase1.UserClient, err error) {
	var rcli *rpc.Client
	if rcli, _, err = GetRPCClient(); err == nil {
		cli = keybase1.UserClient{Cli: rcli}
	}
	return
}

func GetSigsClient() (cli keybase1.SigsClient, err error) {
	var rcli *rpc.Client
	if rcli, _, err = GetRPCClient(); err == nil {
		cli = keybase1.SigsClient{Cli: rcli}
	}
	return
}

func GetPGPClient() (cli keybase1.PGPClient, err error) {
	var rcli *rpc.Client
	if rcli, _, err = GetRPCClient(); err == nil {
		cli = keybase1.PGPClient{Cli: rcli}
	}
	return
}

func GetRevokeClient() (cli keybase1.RevokeClient, err error) {
	var rcli *rpc.Client
	if rcli, _, err = GetRPCClient(); err == nil {
		cli = keybase1.RevokeClient{Cli: rcli}
	}
	return
}

func GetBTCClient() (cli keybase1.BTCClient, err error) {
	var rcli *rpc.Client
	if rcli, _, err = GetRPCClient(); err == nil {
		cli = keybase1.BTCClient{Cli: rcli}
	}
	return
}

func GetDoctorClient() (cli keybase1.DoctorClient, err error) {
	var rcli *rpc.Client
	if rcli, _, err = GetRPCClient(); err == nil {
		cli = keybase1.DoctorClient{Cli: rcli}
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

func GetAccountClient() (cli keybase1.AccountClient, err error) {
	var rcli *rpc.Client
	if rcli, _, err = GetRPCClient(); err == nil {
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
