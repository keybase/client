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

func (c *CryptoHandler) Sign(arg keybase1.SignArg) (ret keybase1.SignatureInfo, err error) {
	ctx := &engine.Context{
		SecretUI: c.getSecretUI(arg.SessionID),
	}
	eng := engine.NewCryptoSignEngine(G, arg.Msg, arg.Reason)
	if err = engine.RunEngine(eng, ctx); err != nil {
		return
	}
	ret = keybase1.SignatureInfo{
		Sig:          keybase1.ED25519Signature(eng.GetSignature()),
		VerifyingKey: keybase1.ED25519PublicKey(eng.GetVerifyingKey()),
	}
	return
}
