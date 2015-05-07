package service

import (
	"errors"
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
	return nil, errors.New("Not implemented")
}

func (c *CryptoHandler) Unbox(arg keybase1.UnboxArg) ([]byte, error) {
	return nil, errors.New("Not implemented")
}
