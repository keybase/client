package service

import (
	"github.com/keybase/client/go/engine"
	keybase1 "github.com/keybase/client/go/protocol"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type CryptoHandler struct {
	*BaseHandler
}

func NewCryptoHandler(xp *rpc2.Transport) *CryptoHandler {
	return &CryptoHandler{BaseHandler: NewBaseHandler(xp)}
}

func (c *CryptoHandler) SignED25519(arg keybase1.SignED25519Arg) (keybase1.ED25519SignatureInfo, error) {
	return engine.SignED25519(G, c.getSecretUI(arg.SessionID), arg)
}

func (c *CryptoHandler) UnboxBytes32(arg keybase1.UnboxBytes32Arg) (keybase1.Bytes32, error) {
	return engine.UnboxBytes32(G, c.getSecretUI(arg.SessionID), arg)
}
