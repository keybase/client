package service

import (
	"github.com/keybase/client/go/engine"
	keybase1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type CryptoHandler struct {
	*BaseHandler
}

func NewCryptoHandler(xp *rpc2.Transport) *CryptoHandler {
	return &CryptoHandler{BaseHandler: NewBaseHandler(xp)}
}

func (c *CryptoHandler) Sign(arg keybase1.SignArg) ([]byte, error) {
	ctx := &engine.Context{
		SecretUI: c.getSecretUI(arg.SessionID),
	}
	eng := engine.NewSignEngine(G, arg.Msg, arg.Reason)
	if err := engine.RunEngine(eng, ctx); err != nil {
		return nil, err
	}
	return eng.GetSignature(), nil
}
