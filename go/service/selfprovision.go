package service

import (
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

type SelfProvisionHandler struct {
	*BaseHandler
	libkb.Contextified
}

func NewSelfProvisionHandler(xp rpc.Transporter, g *libkb.GlobalContext) *SelfProvisionHandler {
	return &SelfProvisionHandler{
		BaseHandler:  NewBaseHandler(g, xp),
		Contextified: libkb.NewContextified(g),
	}
}

func (h *SelfProvisionHandler) SelfProvision(ctx context.Context, arg keybase1.SelfProvisionArg) error {
	uis := libkb.UIs{
		LogUI:       h.getLogUI(arg.SessionID),
		SecretUI:    h.getSecretUI(arg.SessionID, h.G()),
		LoginUI:     h.getLoginUI(arg.SessionID),
		ProvisionUI: h.getProvisionUI(arg.SessionID),
		SessionID:   arg.SessionID,
	}
	eng := engine.NewSelfProvisionEngine(h.G(), arg.DeviceName)
	m := libkb.NewMetaContext(ctx, h.G()).WithUIs(uis)
	return engine.RunEngine2(m, eng)
}
