package service

import (
	keybase1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
	"strconv"
)

type DebuggingHandler struct {
	*BaseHandler
}

func NewDebuggingHandler(xp *rpc2.Transport) *DebuggingHandler {
	return &DebuggingHandler{BaseHandler: NewBaseHandler(xp)}
}

func reverse(s string) string {
	runes := []rune(s)
	for i, j := 0, len(runes)-1; i < j; i, j = i+1, j-1 {
		runes[i], runes[j] = runes[j], runes[i]
	}
	return string(runes)
}

func (t DebuggingHandler) Debugtest(arg keybase1.DebugtestArg) (test keybase1.DebugTest, err error) {
	client := t.rpcClient()
	cbArg := keybase1.DebugtestCallbackArg{Name: reverse(arg.Name), SessionID: arg.SessionID}
	var cbReply string
	err = client.Call("keybase.1.debugging.debugtestCallback", []interface{}{cbArg}, &cbReply)
	if err != nil {
		return
	}

	test.Reply = cbReply
	return
}

func (t DebuggingHandler) DebugtestCallback(arg keybase1.DebugtestCallbackArg) (s string, err error) {
	i, err := strconv.Atoi(arg.Name)
	if err == nil {
		s = strconv.Itoa(i + 1)
	}
	return
}
