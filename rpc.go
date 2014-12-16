package main

import (
	"github.com/keybase/protocol/go"
	fmprpc "github.com/maxtaco/go-framed-msgpack-rpc"
	"github.com/ugorji/go/codec"
	"net"
	"net/rpc"
)

var __cli *rpc.Client

func GetRpcClient() (ret *rpc.Client, err error) {
	var conn net.Conn
	if __cli != nil {
	} else if conn, err = G.GetSocket(); err == nil {
		var mh codec.MsgpackHandle
		cdc := fmprpc.MsgpackSpecRpc.ClientCodec(conn, &mh, true)
		__cli = rpc.NewClientWithCodec(cdc)
	}
	ret = __cli
	return
}

func GetSignupClient() (cli keybase_1.SignupClient, err error) {
	var rpc *rpc.Client
	if rpc, err = GetRpcClient(); err == nil {
		cli = keybase_1.SignupClient{rpc}
	}
	return
}

func GetConfigClient() (cli keybase_1.ConfigClient, err error) {
	var rpc *rpc.Client
	if rpc, err = GetRpcClient(); err == nil {
		cli = keybase_1.ConfigClient{rpc}
	}
	return
}
