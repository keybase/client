package main

import (
	"github.com/keybase/protocol/go"
	fmprpc "github.com/maxtaco/go-framed-msgpack-rpc"
	"github.com/ugorji/go/codec"
	"net/rpc"
)

func GetRpcClient() (*rpc.Client, error) {
	conn, err := G.GetSocket()
	if err != nil {
		return nil, err
	} else {
		var mh codec.MsgpackHandle
		cdc := fmprpc.MsgpackSpecRpc.ClientCodec(conn, &mh, true)
		return rpc.NewClientWithCodec(cdc), nil
	}
}

func GetSignupClient() (cli keybase_1.SignupClient, err error) {
	var rpc *rpc.Client
	if rpc, err = GetRpcClient(); err != nil {
		cli = keybase_1.SignupClient{rpc}
	}
	return
}
