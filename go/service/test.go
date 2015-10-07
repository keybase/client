package service

import (
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
)

type TestHandler struct {
	*BaseHandler
}

func NewTestHandler(xp rpc.Transporter) *TestHandler {
	return &TestHandler{BaseHandler: NewBaseHandler(xp)}
}

func (t TestHandler) Test(arg keybase1.TestArg) (test keybase1.Test, err error) {
	client := t.rpcClient()
	cbArg := keybase1.TestCallbackArg{Name: arg.Name, SessionID: arg.SessionID}
	var cbReply string
	err = client.Call("keybase.1.test.testCallback", []interface{}{cbArg}, &cbReply)
	if err != nil {
		return
	}

	test.Reply = cbReply
	return
}

func (t TestHandler) TestCallback(arg keybase1.TestCallbackArg) (s string, err error) {
	return
}

func (t TestHandler) Panic(message string) error {
	G.Log.Info("Received panic() RPC")
	go func() {
		panic(message)
	}()
	return nil
}
