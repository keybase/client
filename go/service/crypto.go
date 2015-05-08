package service

import (
	"errors"
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

func (c *CryptoHandler) Sign(buf []byte) ([]byte, error) {
	ctx := &engine.Context{}
	eng := engine.NewSignEngine(G, buf)
	if err := engine.RunEngine(eng, ctx); err != nil {
		return nil, err
	}

	return eng.GetSignature(), nil
}

func (c *CryptoHandler) Unbox(arg keybase1.UnboxArg) ([]byte, error) {
	return nil, errors.New("Not implemented")
}
