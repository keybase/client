package service

import (
	"github.com/keybase/client/go/engine"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
)

type BTCHandler struct {
	*BaseHandler
}

func NewBTCHandler(xp rpc.Transporter) *BTCHandler {
	return &BTCHandler{BaseHandler: NewBaseHandler(xp)}
}

// BTC creates a BTCEngine and runs it.
func (h *BTCHandler) RegisterBTC(arg keybase1.RegisterBTCArg) error {
	ctx := engine.Context{
		LogUI:    h.getLogUI(arg.SessionID),
		SecretUI: h.getSecretUI(arg.SessionID),
	}
	eng := engine.NewBTCEngine(arg.Address, arg.Force, G)
	return engine.RunEngine(eng, &ctx)
}
