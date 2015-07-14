package service

import (
	"github.com/keybase/client/go/engine"
	keybase1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type AccountHandler struct {
	*BaseHandler
}

func NewAccountHandler(xp *rpc2.Transport) *AccountHandler {
	return &AccountHandler{BaseHandler: NewBaseHandler(xp)}
}

func (h *AccountHandler) ChangePassphrase(arg keybase1.ChangePassphraseArg) error {
	eng := engine.NewChangePassphrase(&arg, G)
	ctx := &engine.Context{
		SecretUI: h.getSecretUI(arg.SessionID),
	}
	return engine.RunEngine(eng, ctx)
}
