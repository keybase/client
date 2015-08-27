package service

import (
	keybase1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
	"strconv"
)

type TestHandler struct {
	*BaseHandler
}

func NewTestHandler(xp *rpc2.Transport) *TestHandler {
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
	i, err := strconv.Atoi(arg.Name)
	if err == nil {
		s = strconv.Itoa(i + 1)
	}
	return
}

func (t TestHandler) Panic(message string) error {
	G.Log.Info("Received panic() RPC")
	go func() {
		panic(message)
	}()
	return nil
}
