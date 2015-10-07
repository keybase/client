package service

import (
	"github.com/keybase/client/go/engine"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
)

type AccountHandler struct {
	*BaseHandler
}

func NewAccountHandler(xp rpc.Transporter) *AccountHandler {
	return &AccountHandler{BaseHandler: NewBaseHandler(xp)}
}

func (h *AccountHandler) PassphraseChange(arg keybase1.PassphraseChangeArg) error {
	eng := engine.NewPassphraseChange(&arg, G)
	ctx := &engine.Context{
		SecretUI: h.getSecretUI(arg.SessionID),
	}
	return engine.RunEngine(eng, ctx)
}
